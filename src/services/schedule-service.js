/**
 * SCHEDULE SERVICE
 * Handle schedule operations in user-db
 * With auto-reconnect for Azure SQL Free tier (auto-pauses after 1 hour)
 */

const sql = require('mssql');

// =========================================
// AUTO-RECONNECT CONFIGURATION
// Azure SQL Free tier pauses after 1 hour inactivity
// =========================================
const retryConfig = {
    maxRetries: 5,
    initialDelay: 2000,      // 2 seconds
    maxDelay: 30000,         // 30 seconds max
    multiplier: 2
};

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Check if error is from Azure SQL paused state
const isAzurePausedError = (error) => {
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    return (
        errorMessage.includes('login failed') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('Connection lost') ||
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('Server is in paused') ||
        errorMessage.includes('Database is paused') ||
        errorMessage.includes('Database is resuming') ||
        errorCode === 'ESOCKET' ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ENETUNREACH'
    );
};

class ScheduleService {
    constructor() {
        this.userDbConfig = {
            server: process.env.DB_SERVER || 'student-schedule.database.windows.net',
            database: 'user-db',  // Always use user-db for schedules, NOT from env
            user: process.env.DB_USER || 'sqladmin',
            password: process.env.DB_PASSWORD || 'Wind060304@',
            options: {
                encrypt: true,
                enableArithAbort: true,
                trustServerCertificate: false,
                requestTimeout: 60000,      // 60 seconds
                connectionTimeout: 60000    // 60 seconds
            },
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000,
                acquireTimeoutMillis: 120000  // 2 minutes - enough for Azure to wake up
            }
        };
        this.pool = null;
        this.isConnecting = false;
    }

    /**
     * Connect to database with retry logic for Azure SQL auto-pause
     */
    async connectWithRetry() {
        // If already connecting, wait
        if (this.isConnecting) {
            while (this.isConnecting) {
                await sleep(500);
            }
            if (this.pool && this.pool.connected) {
                return this.pool;
            }
        }

        // If already connected, return existing pool
        if (this.pool && this.pool.connected) {
            return this.pool;
        }

        this.isConnecting = true;
        let lastError;
        let delay = retryConfig.initialDelay;

        for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
            try {
                console.log(`[ScheduleService] Connection attempt ${attempt}/${retryConfig.maxRetries} to ${this.userDbConfig.database}...`);
                
                // Close existing pool if any
                if (this.pool) {
                    try {
                        await this.pool.close();
                    } catch (e) { /* ignore */ }
                }

                this.pool = await sql.connect(this.userDbConfig);
                console.log(`[ScheduleService] ✅ Connected to ${this.userDbConfig.database}`);
                this.isConnecting = false;
                return this.pool;

            } catch (error) {
                lastError = error;
                console.error(`[ScheduleService] Connection attempt ${attempt} failed:`, error.message);

                if (isAzurePausedError(error) && attempt < retryConfig.maxRetries) {
                    console.log(`[ScheduleService] 🔄 Azure SQL may be paused. Waiting ${delay}ms before retry...`);
                    await sleep(delay);
                    delay = Math.min(delay * retryConfig.multiplier, retryConfig.maxDelay);
                } else if (attempt >= retryConfig.maxRetries) {
                    break;
                } else {
                    await sleep(delay);
                    delay = Math.min(delay * retryConfig.multiplier, retryConfig.maxDelay);
                }
            }
        }

        this.isConnecting = false;
        console.error(`[ScheduleService] ❌ All ${retryConfig.maxRetries} connection attempts failed`);
        throw lastError;
    }

    /**
     * Execute database operation with retry logic
     */
    async executeWithRetry(operation, operationName = 'unknown') {
        let lastError;
        let delay = retryConfig.initialDelay;

        for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
            try {
                const pool = await this.connectWithRetry();
                return await operation(pool);

            } catch (error) {
                lastError = error;
                console.error(`[ScheduleService] ${operationName} attempt ${attempt} failed:`, error.message);

                // Reset pool on connection errors
                if (isAzurePausedError(error)) {
                    this.pool = null;
                    
                    if (attempt < retryConfig.maxRetries) {
                        console.log(`[ScheduleService] 🔄 Retrying ${operationName} in ${delay}ms...`);
                        await sleep(delay);
                        delay = Math.min(delay * retryConfig.multiplier, retryConfig.maxDelay);
                    }
                } else {
                    // Non-retryable error
                    throw error;
                }
            }
        }

        console.error(`[ScheduleService] ❌ ${operationName} failed after ${retryConfig.maxRetries} attempts`);
        throw lastError;
    }

    /**
     * Get or create numeric UserId from email or string ID
     */
    async getOrCreateUserId(userIdentifier, userData = {}) {
        return this.executeWithRetry(async (pool) => {
            console.log('[getOrCreateUserId] Input:', { userIdentifier, userData });
            
            // Extract email from identifier (could be email or string ID like "user-123")
            const email = userData.email || (userIdentifier.includes('@') ? userIdentifier : null);
            console.log('[getOrCreateUserId] Using email:', email);
            
            if (!email) {
                throw new Error('Email is required to create/find user');
            }

            // Try to find existing user by email
            const existingUser = await pool.request()
                .input('email', sql.NVarChar, email)
                .query('SELECT UserId FROM Users WHERE Email = @email');

            if (existingUser.recordset.length > 0) {
                const userId = existingUser.recordset[0].UserId;
                console.log('[getOrCreateUserId] Found existing user:', userId);
                return userId;
            }

            // Create new user if not exists
            console.log('[getOrCreateUserId] Creating new user...');
            const newUser = await pool.request()
                .input('email', sql.NVarChar, email)
                .input('name', sql.NVarChar, userData.name || email.split('@')[0])
                .input('studentId', sql.NVarChar, userData.studentId || null)
                .input('role', sql.NVarChar, userData.role || 'Student')
                .query(`
                    INSERT INTO Users (Email, Name, StudentId, Role, CreatedAt, UpdatedAt)
                    OUTPUT INSERTED.UserId
                    VALUES (@email, @name, @studentId, @role, GETDATE(), GETDATE())
                `);

            const userId = newUser.recordset[0].UserId;
            console.log('[getOrCreateUserId] Created new user:', userId);
            return userId;
        }, 'getOrCreateUserId');
    }

    /**
     * Create new schedule for user
     */
    async createSchedule(userIdentifier, scheduleName, courses, userData = {}) {
        return this.executeWithRetry(async (pool) => {
            let numericUserId;
            
            // Get or create user ID using the same pool
            const email = userData.email || (userIdentifier.includes('@') ? userIdentifier : null);
            console.log('[createSchedule] Getting UserId for email:', email);
            
            if (!email) {
                throw new Error('Email is required');
            }

            // Try to find existing user
            const existingUser = await pool.request()
                .input('email', sql.NVarChar, email)
                .query('SELECT UserId FROM Users WHERE Email = @email');

            if (existingUser.recordset.length > 0) {
                numericUserId = existingUser.recordset[0].UserId;
                console.log('[createSchedule] Found existing user ID:', numericUserId);
            } else {
                // Create new user
                console.log('[createSchedule] Creating new user...');
                const newUser = await pool.request()
                    .input('email', sql.NVarChar, email)
                    .input('name', sql.NVarChar, userData.name || email.split('@')[0])
                    .input('studentId', sql.NVarChar, userData.studentId || null)
                    .input('role', sql.NVarChar, userData.role || 'Student')
                    .query(`
                        INSERT INTO Users (Email, Name, StudentId, Role, CreatedAt, UpdatedAt)
                        OUTPUT INSERTED.UserId
                        VALUES (@email, @name, @studentId, @role, GETDATE(), GETDATE())
                    `);

                numericUserId = newUser.recordset[0].UserId;
                console.log('[createSchedule] Created new user ID:', numericUserId);
            }
            
            if (!numericUserId) {
                throw new Error('Failed to get or create UserId - result is null/undefined');
            }
            
            // Start transaction
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // Calculate total credits
                const totalCredits = courses.reduce((sum, course) => sum + (course.credits || 0), 0);

                // Insert into Schedules table
                const scheduleResult = await transaction.request()
                    .input('userId', sql.Int, numericUserId)
                    .input('scheduleName', sql.NVarChar, scheduleName || `Thời khóa biểu ${new Date().toLocaleDateString('vi-VN')}`)
                    .input('totalCredits', sql.Int, totalCredits)
                    .query(`
                        INSERT INTO Schedules (UserId, ScheduleName, TotalCredits, CreatedAt, UpdatedAt)
                        OUTPUT INSERTED.ScheduleId
                        VALUES (@userId, @scheduleName, @totalCredits, GETDATE(), GETDATE())
                    `);

                const scheduleId = scheduleResult.recordset[0].ScheduleId;

                // Insert courses and create schedule details
                for (const course of courses) {
                    // First, check if course exists in Courses table
                    const existingCourse = await transaction.request()
                        .input('courseCode', sql.NVarChar, course.courseCode || `COURSE-${course.courseId || course.id}`)
                        .query('SELECT CourseId FROM Courses WHERE CourseCode = @courseCode');

                    let courseId;
                    
                    if (existingCourse.recordset.length > 0) {
                        // Course exists, use existing ID
                        courseId = existingCourse.recordset[0].CourseId;
                    } else {
                        // Course doesn't exist, insert it
                        const newCourse = await transaction.request()
                            .input('courseName', sql.NVarChar, course.courseName || course.name || 'Unknown Course')
                            .input('courseCode', sql.NVarChar, course.courseCode || `COURSE-${course.courseId || course.id}`)
                            .input('credits', sql.Int, course.credits || 0)
                            .input('lecturer', sql.NVarChar, course.lecturer || course.instructor || null)
                            .input('time', sql.NVarChar, course.time || course.schedule || null)
                            .input('room', sql.NVarChar, course.room || null)
                            .input('weeks', sql.NVarChar, course.weeks || null)
                            .input('quantity', sql.Int, course.quantity || course.maxStudents || null)
                            .query(`
                                INSERT INTO Courses (CourseName, CourseCode, Credits, Lecturer, Time, Room, Weeks, Quantity, CreatedAt)
                                OUTPUT INSERTED.CourseId
                                VALUES (@courseName, @courseCode, @credits, @lecturer, @time, @room, @weeks, @quantity, GETDATE())
                            `);
                        
                        courseId = newCourse.recordset[0].CourseId;
                    }

                    // Insert into ScheduleDetails
                    await transaction.request()
                        .input('scheduleId', sql.Int, scheduleId)
                        .input('courseId', sql.Int, courseId)
                        .query(`
                            INSERT INTO ScheduleDetails (ScheduleId, CourseId, CreatedAt)
                            VALUES (@scheduleId, @courseId, GETDATE())
                        `);
                }

                // Commit transaction
                await transaction.commit();

                return {
                    success: true,
                    scheduleId,
                    message: 'Tạo thời khóa biểu thành công!',
                    data: {
                        scheduleId,
                        scheduleName,
                        totalCredits,
                        courseCount: courses.length
                    }
                };

            } catch (error) {
                // Rollback on error
                await transaction.rollback();
                throw error;
            }
        }, 'createSchedule');
    }

    /**
     * Get all schedules for a user
     */
    async getUserSchedules(userIdentifier) {
        return this.executeWithRetry(async (pool) => {
            // Get numeric UserId - note: this uses its own retry, so we call directly
            let numericUserId;
            
            // Find user by email
            const email = userIdentifier.includes('@') ? userIdentifier : null;
            if (email) {
                const existingUser = await pool.request()
                    .input('email', sql.NVarChar, email)
                    .query('SELECT UserId FROM Users WHERE Email = @email');

                if (existingUser.recordset.length > 0) {
                    numericUserId = existingUser.recordset[0].UserId;
                }
            }

            if (!numericUserId) {
                return {
                    success: true,
                    schedules: []
                };
            }
            
            const result = await pool.request()
                .input('userId', sql.Int, numericUserId)
                .query(`
                    SELECT 
                        s.ScheduleId,
                        s.ScheduleName,
                        s.TotalCredits,
                        s.CreatedAt,
                        s.UpdatedAt,
                        COUNT(sd.DetailId) as CourseCount
                    FROM Schedules s
                    LEFT JOIN ScheduleDetails sd ON s.ScheduleId = sd.ScheduleId
                    WHERE s.UserId = @userId
                    GROUP BY s.ScheduleId, s.ScheduleName, s.TotalCredits, s.CreatedAt, s.UpdatedAt
                    ORDER BY s.CreatedAt DESC
                `);

            return {
                success: true,
                schedules: result.recordset
            };
        }, 'getUserSchedules');
    }

    /**
     * Get schedule details with courses
     */
    async getScheduleDetails(scheduleId) {
        return this.executeWithRetry(async (pool) => {
            // Get schedule info
            const scheduleResult = await pool.request()
                .input('scheduleId', sql.Int, scheduleId)
                .query(`
                    SELECT * FROM Schedules WHERE ScheduleId = @scheduleId
                `);

            if (scheduleResult.recordset.length === 0) {
                throw new Error('Schedule not found');
            }

            // Get courses in schedule
            const coursesResult = await pool.request()
                .input('scheduleId', sql.Int, scheduleId)
                .query(`
                    SELECT 
                        c.*,
                        sd.CreatedAt as AddedAt
                    FROM ScheduleDetails sd
                    INNER JOIN Courses c ON sd.CourseId = c.CourseId
                    WHERE sd.ScheduleId = @scheduleId
                `);

            return {
                success: true,
                schedule: scheduleResult.recordset[0],
                courses: coursesResult.recordset
            };
        }, 'getScheduleDetails');
    }

    /**
     * Update schedule
     */
    async updateSchedule(scheduleId, scheduleName, courses) {
        return this.executeWithRetry(async (pool) => {
            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                // Calculate total credits
                const totalCredits = courses.reduce((sum, course) => sum + (course.credits || 0), 0);

                // Update schedule info
                await transaction.request()
                    .input('scheduleId', sql.Int, scheduleId)
                    .input('scheduleName', sql.NVarChar, scheduleName)
                    .input('totalCredits', sql.Int, totalCredits)
                    .query(`
                        UPDATE Schedules 
                        SET ScheduleName = @scheduleName,
                            TotalCredits = @totalCredits,
                            UpdatedAt = GETDATE()
                        WHERE ScheduleId = @scheduleId
                    `);

                // Delete old schedule details
                await transaction.request()
                    .input('scheduleId', sql.Int, scheduleId)
                    .query(`DELETE FROM ScheduleDetails WHERE ScheduleId = @scheduleId`);

                // Insert new courses
                for (const course of courses) {
                    await transaction.request()
                        .input('scheduleId', sql.Int, scheduleId)
                        .input('courseId', sql.Int, course.courseId || course.id)
                        .query(`
                            INSERT INTO ScheduleDetails (ScheduleId, CourseId, CreatedAt)
                            VALUES (@scheduleId, @courseId, GETDATE())
                        `);
                }

                await transaction.commit();

                return {
                    success: true,
                    message: 'Cập nhật thời khóa biểu thành công!'
                };

            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        }, 'updateSchedule');
    }

    /**
     * Delete schedule
     */
    async deleteSchedule(scheduleId) {
        return this.executeWithRetry(async (pool) => {
            await pool.request()
                .input('scheduleId', sql.Int, scheduleId)
                .query(`DELETE FROM Schedules WHERE ScheduleId = @scheduleId`);

            return {
                success: true,
                message: 'Xóa thời khóa biểu thành công!'
            };
        }, 'deleteSchedule');
    }
}

module.exports = { ScheduleService };
