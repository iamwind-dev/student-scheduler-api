const sql = require('mssql');

/**
 * Database Service Layer
 * Handles all SQL Server connections and queries
 * With auto-reconnect support for Azure SQL Free tier (auto-pause)
 */

const config = {
    user: 'sqladmin',
    password: 'Wind060304@',
    server: 'student-schedule.database.windows.net',
    database: 'student-scheduler-db',
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: false,
        requestTimeout: 60000,        // Increased for Azure wake-up
        connectionTimeout: 60000      // Increased for Azure wake-up
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 120000  // Increased for Azure wake-up
    }
};

// Retry configuration for Azure SQL Free tier
const retryConfig = {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
};

let poolPromise = null;
let isConnecting = false;

// Sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if error is related to Azure SQL paused state
function isAzurePausedError(error) {
    const pausedErrorPatterns = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ESOCKET',
        'ENOTOPEN',
        'Connection lost',
        'connection is closed',
        'Database .* on server .* is not currently available',
        'Cannot open server',
        'Login failed',
        'Server is not found or not accessible',
        'TCP Provider',
        'network-related',
        'instance-specific error'
    ];

    const errorMessage = error.message || error.toString();
    const errorCode = error.code || '';

    return pausedErrorPatterns.some(pattern => 
        errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
        errorCode.includes(pattern)
    );
}

// Connect with retry for Azure SQL wake-up
async function connectWithRetry() {
    let lastError;
    let delay = retryConfig.initialDelayMs;

    console.log(`📊 [database.js] Connecting to database: ${config.database} on ${config.server}`);

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
        try {
            console.log(`🔄 [database.js] Connection attempt ${attempt}/${retryConfig.maxRetries} to ${config.database}...`);
            
            const pool = await sql.connect(config);
            
            console.log(`✅ [database.js] Connected successfully on attempt ${attempt}`);
            return pool;

        } catch (error) {
            lastError = error;
            console.log(`❌ [database.js] Attempt ${attempt} failed: ${error.message}`);

            if (isAzurePausedError(error) && attempt < retryConfig.maxRetries) {
                console.log(`⏳ [database.js] Azure SQL might be paused. Waiting ${delay/1000}s...`);
                await sleep(delay);
                delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelayMs);
            } else if (attempt < retryConfig.maxRetries) {
                await sleep(retryConfig.initialDelayMs);
            }
        }
    }

    throw new Error(`Failed to connect after ${retryConfig.maxRetries} attempts: ${lastError.message}`);
}

// Initialize connection pool with retry
async function getPool() {
    // If already connecting, wait
    if (isConnecting) {
        while (isConnecting) {
            await sleep(500);
        }
        if (poolPromise) {
            return poolPromise;
        }
    }

    if (!poolPromise) {
        isConnecting = true;
        
        try {
            poolPromise = await connectWithRetry();

            // Handle pool errors - reset to force reconnection
            poolPromise.on('error', (err) => {
                console.error('❌ [database.js] Pool error:', err.message);
                poolPromise = null;
            });

        } catch (error) {
            console.error('❌ [database.js] Connection failed:', error.message);
            poolPromise = null;
            throw error;
        } finally {
            isConnecting = false;
        }
    }
    
    return poolPromise;
}

// Execute query with auto-retry on connection errors
async function executeWithRetry(operation) {
    let lastError;
    let delay = retryConfig.initialDelayMs;

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
        try {
            return await operation();

        } catch (error) {
            lastError = error;

            if (isAzurePausedError(error)) {
                console.log(`⚠️ [database.js] Query failed (attempt ${attempt}): ${error.message}`);
                
                // Reset pool to force reconnection
                poolPromise = null;

                if (attempt < retryConfig.maxRetries) {
                    console.log(`⏳ [database.js] Retrying in ${delay/1000}s...`);
                    await sleep(delay);
                    delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelayMs);
                }
            } else {
                throw error;
            }
        }
    }

    throw new Error(`Operation failed after ${retryConfig.maxRetries} attempts: ${lastError.message}`);
}

// =====================================
// COURSES SERVICE
// =====================================

/**
 * Get all courses for a specific semester
 */
async function getCoursesBySemester(semesterCode = '2025A') {
    return executeWithRetry(async () => {
        const pool = await getPool();

        const result = await pool.request()
            .query(`
                SELECT 
                    ID as courseId,
                    Name as courseName,
                    'COURSE' + CAST(ID as NVARCHAR) as courseCode,
                    Credits as credits,
                    Lecturer as lecturer,
                    Time as time,
                    Room as room,
                    Weeks as weeks,
                    Quantity as quantity
                FROM Courses
                ORDER BY Name
            `);

        return result.recordset;
    });
}

/**
 * Get course by ID
 */
async function getCourseById(courseId) {
    return executeWithRetry(async () => {
        const pool = await getPool();

        const result = await pool.request()
            .input('courseId', sql.Int, courseId)
            .query(`
                SELECT 
                    c.*,
                    s.SubjectName,
                    l.LecturerName,
                    r.RoomCode,
                    cam.CampusName,
                    ts.DayOfWeek,
                    ts.TimeRange
                FROM Courses c
                INNER JOIN Subjects s ON c.SubjectID = s.SubjectID
                INNER JOIN Lecturers l ON c.LecturerID = l.LecturerID
                LEFT JOIN Rooms r ON c.RoomID = r.RoomID
                LEFT JOIN Campuses cam ON r.CampusID = cam.CampusID
                LEFT JOIN TimeSlots ts ON c.TimeSlotID = ts.TimeSlotID
                WHERE c.CourseID = @courseId
            `);

        return result.recordset[0];
    });
}

// =====================================
// STUDENTS & PREFERENCES SERVICE
// =====================================

/**
 * Save student preferences
 */
async function saveStudentPreferences(studentId, preferences) {
    return executeWithRetry(async () => {
        const pool = await getPool();

        // First, ensure student exists
        await pool.request()
            .input('studentCode', sql.NVarChar(20), studentId)
            .input('fullName', sql.NVarChar(255), `Student ${studentId}`)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM Students WHERE StudentCode = @studentCode)
                BEGIN
                    INSERT INTO Students (StudentCode, FullName) VALUES (@studentCode, @fullName)
                END
            `);

        // Get student internal ID
        const studentResult = await pool.request()
            .input('studentCode', sql.NVarChar(20), studentId)
            .query('SELECT StudentID FROM Students WHERE StudentCode = @studentCode');

        const internalStudentId = studentResult.recordset[0].StudentID;

        // Save/Update preferences
        await pool.request()
            .input('studentId', sql.Int, internalStudentId)
            .input('maxCredits', sql.Int, preferences.maxCredits || 18)
            .input('preferredCampus', sql.NVarChar(20), preferences.campus || 'all')
            .input('avoidMorning', sql.Bit, preferences.avoidMorning || false)
            .input('avoidEvening', sql.Bit, preferences.avoidEvening || false)
            .input('freeTimeSlots', sql.NVarChar(1000), JSON.stringify(preferences.freeTime || []))
            .query(`
                IF EXISTS (SELECT 1 FROM StudentPreferences WHERE StudentID = @studentId)
                BEGIN
                    UPDATE StudentPreferences SET
                        MaxCredits = @maxCredits,
                        PreferredCampus = @preferredCampus,
                        AvoidMorning = @avoidMorning,
                        AvoidEvening = @avoidEvening,
                        FreeTimeSlots = @freeTimeSlots,
                        UpdatedAt = GETDATE()
                    WHERE StudentID = @studentId
                END
                ELSE
                BEGIN
                    INSERT INTO StudentPreferences (StudentID, MaxCredits, PreferredCampus, AvoidMorning, AvoidEvening, FreeTimeSlots)
                    VALUES (@studentId, @maxCredits, @preferredCampus, @avoidMorning, @avoidEvening, @freeTimeSlots)
                END
            `);

        return { success: true, studentId, preferences };
    });
}

/**
 * Get student preferences
 */
async function getStudentPreferences(studentId) {
    return executeWithRetry(async () => {
        const pool = await getPool();

        const result = await pool.request()
            .input('studentCode', sql.NVarChar(20), studentId)
            .query(`
                SELECT 
                    p.MaxCredits,
                    p.PreferredCampus,
                    p.AvoidMorning,
                    p.AvoidEvening,
                    p.FreeTimeSlots
                FROM Students s
                INNER JOIN StudentPreferences p ON s.StudentID = p.StudentID
                WHERE s.StudentCode = @studentCode
            `);

        if (result.recordset.length > 0) {
            const prefs = result.recordset[0];
            return {
                maxCredits: prefs.MaxCredits,
                campus: prefs.PreferredCampus,
                avoidMorning: prefs.AvoidMorning,
                avoidEvening: prefs.AvoidEvening,
                freeTime: JSON.parse(prefs.FreeTimeSlots || '[]')
            };
        }

        return null;
    });
}

// =====================================
// RECOMMENDATIONS SERVICE  
// =====================================

/**
 * Generate schedule recommendations
 */
async function generateRecommendations(studentId, preferences) {
    try {
        // Get all available courses
        const courses = await getCoursesBySemester('2025A');

        // Apply filters based on preferences
        let filteredCourses = courses.filter(course => {
            // Filter by campus
            if (preferences.campus && preferences.campus !== 'all') {
                if (course.CampusCode !== preferences.campus.toUpperCase()) {
                    return false;
                }
            }

            // Filter by time constraints
            if (preferences.avoidMorning && course.StartPeriod <= 3) {
                return false;
            }

            if (preferences.avoidEvening && course.StartPeriod >= 9) {
                return false;
            }

            // Filter by free time (avoid conflicts)
            if (preferences.freeTime && Array.isArray(preferences.freeTime)) {
                const courseTimeSlot = `${course.DayOfWeek} - ${course.TimeRange}`;
                if (preferences.freeTime.includes(courseTimeSlot)) {
                    return false;
                }
            }

            return true;
        });

        // Generate multiple schedule options
        const recommendations = [];
        const maxCredits = preferences.maxCredits || 18;

        // Simple algorithm: create 3 different combinations
        for (let i = 0; i < 3; i++) {
            const schedule = generateScheduleOption(filteredCourses, maxCredits, i);
            if (schedule.courses.length > 0) {
                recommendations.push(schedule);
            }
        }

        return recommendations;

    } catch (error) {
        console.error('Error generating recommendations:', error);
        throw new Error(`Database error: ${error.message}`);
    }
}

/**
 * Helper function to generate one schedule option
 */
function generateScheduleOption(courses, maxCredits, seedOffset = 0) {
    const selectedCourses = [];
    const usedTimeSlots = new Set();
    let totalCredits = 0;

    // Shuffle courses for variety
    const shuffledCourses = [...courses].sort(() => Math.random() - 0.5 + (seedOffset * 0.1));

    for (const course of shuffledCourses) {
        const credits = course.Credits || 3;

        // Check credit limit
        if (totalCredits + credits > maxCredits) {
            continue;
        }

        // Check time conflicts
        const timeSlotKey = `${course.DayOfWeek}-${course.StartPeriod}-${course.EndPeriod}`;
        if (usedTimeSlots.has(timeSlotKey)) {
            continue;
        }

        // Add course to schedule
        selectedCourses.push({
            courseCode: course.id,
            courseName: course.name,
            lecturer: course.lecturer,
            credits: credits,
            slot: {
                day: course.DayOfWeek,
                time: course.TimeRange,
                room: course.room,
                campus: course.CampusName
            }
        });

        usedTimeSlots.add(timeSlotKey);
        totalCredits += credits;
    }

    return {
        totalCredits,
        courses: selectedCourses
    };
}

// =====================================
// EXPORTS
// =====================================

module.exports = {
    // Connection
    getPool,

    // Courses
    getCoursesBySemester,
    getCourseById,

    // Students & Preferences
    saveStudentPreferences,
    getStudentPreferences,

    // Recommendations
    generateRecommendations
};
// Deploy timestamp: Sat Dec 20 12:58:17 AM +07 2025
