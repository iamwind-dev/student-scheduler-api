const sql = require('mssql');

/**
 * Database Service Layer
 * Handles all SQL Server connections and queries
 */

const config = {
    user: 'sqladmin',
    password: 'Wind060304@',
    server: 'student-schedule.database.windows.net',
    database: 'student-scheduler-db',
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: false
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise;

// Initialize connection pool
function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(config);

        poolPromise.catch(error => {
            console.error('Database connection failed:', error);
            poolPromise = null;
        });
    }
    return poolPromise;
}

// =====================================
// COURSES SERVICE
// =====================================

/**
 * Get all courses for a specific semester
 */
async function getCoursesBySemester(semesterCode = '2025A') {
    try {
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

    } catch (error) {
        console.error('Error getting courses:', error);
        throw new Error(`Database error: ${error.message}`);
    }
}

/**
 * Get course by ID
 */
async function getCourseById(courseId) {
    try {
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

    } catch (error) {
        console.error('Error getting course by ID:', error);
        throw new Error(`Database error: ${error.message}`);
    }
}

// =====================================
// STUDENTS & PREFERENCES SERVICE
// =====================================

/**
 * Save student preferences
 */
async function saveStudentPreferences(studentId, preferences) {
    try {
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

    } catch (error) {
        console.error('Error saving preferences:', error);
        throw new Error(`Database error: ${error.message}`);
    }
}

/**
 * Get student preferences
 */
async function getStudentPreferences(studentId) {
    try {
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

    } catch (error) {
        console.error('Error getting preferences:', error);
        throw new Error(`Database error: ${error.message}`);
    }
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
