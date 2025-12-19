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
            server: 'student-schedule.database.windows.net',
            database: 'student-scheduler-db',  // Use same database as courses
            user: 'sqladmin',
            password: 'Wind060304@',
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
     * Get or create UserId from email
     * Note: UserId in student-scheduler-db is NVARCHAR (stores email)
     */
    async getOrCreateUserId(userIdentifier, userData = {}) {
        return this.executeWithRetry(async (pool) => {
            const email = userData.email || userIdentifier;
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

            // Create new user if not exists - UserId is the email
            console.log('[getOrCreateUserId] Creating new user...');
            await pool.request()
                .input('userId', sql.NVarChar, email)
                .input('email', sql.NVarChar, email)
                .input('name', sql.NVarChar, userData.name || email.split('@')[0])
                .input('studentId', sql.NVarChar, userData.studentId || null)
                .input('role', sql.NVarChar, userData.role || 'Student')
                .query(`
                    INSERT INTO Users (UserId, Email, Name, StudentId, Role, CreatedAt)
                    VALUES (@userId, @email, @name, @studentId, @role, GETDATE())
                `);

            console.log('[getOrCreateUserId] Created new user:', email);
            return email;
        }, 'getOrCreateUserId');
    }

    /**
     * Create new schedule for user
     * Uses coursesJson column to store courses as JSON
     */
    async createSchedule(userIdentifier, scheduleName, courses, userData = {}) {
        return this.executeWithRetry(async (pool) => {
            const email = userData.email || userIdentifier;
            console.log('[createSchedule] Creating schedule for:', email);
            
            if (!email) {
                throw new Error('Email is required');
            }

            // Ensure user exists
            const existingUser = await pool.request()
                .input('email', sql.NVarChar, email)
                .query('SELECT UserId FROM Users WHERE Email = @email');

            if (existingUser.recordset.length === 0) {
                // Create new user
                console.log('[createSchedule] Creating new user...');
                await pool.request()
                    .input('userId', sql.NVarChar, email)
                    .input('email', sql.NVarChar, email)
                    .input('name', sql.NVarChar, userData.name || email.split('@')[0])
                    .input('studentId', sql.NVarChar, userData.studentId || null)
                    .input('role', sql.NVarChar, userData.role || 'Student')
                    .query(`
                        INSERT INTO Users (UserId, Email, Name, StudentId, Role, CreatedAt)
                        VALUES (@userId, @email, @name, @studentId, @role, GETDATE())
                    `);
                console.log('[createSchedule] Created new user');
            }

            // Calculate total credits
            const totalCredits = courses.reduce((sum, course) => sum + (course.credits || 0), 0);

            // Insert schedule with coursesJson
            const scheduleResult = await pool.request()
                .input('userId', sql.NVarChar, email)
                .input('coursesJson', sql.NVarChar, JSON.stringify(courses))
                .input('totalCredits', sql.Int, totalCredits)
                .query(`
                    INSERT INTO Schedules (userId, coursesJson, totalCredits, createdAt, updatedAt)
                    OUTPUT INSERTED.id
                    VALUES (@userId, @coursesJson, @totalCredits, GETDATE(), GETDATE())
                `);

            const scheduleId = scheduleResult.recordset[0].id;
            console.log('[createSchedule] Created schedule:', scheduleId);

            return {
                success: true,
                scheduleId,
                message: 'Tạo thời khóa biểu thành công!',
                data: {
                    scheduleId,
                    scheduleName: scheduleName || `Thời khóa biểu ${new Date().toLocaleDateString('vi-VN')}`,
                    totalCredits,
                    courseCount: courses.length
                }
            };
        }, 'createSchedule');
    }

    /**
     * Get all schedules for a user
     */
    async getUserSchedules(userIdentifier) {
        return this.executeWithRetry(async (pool) => {
            const email = userIdentifier.includes('@') ? userIdentifier : null;
            
            if (!email) {
                return { success: true, schedules: [] };
            }
            
            const result = await pool.request()
                .input('userId', sql.NVarChar, email)
                .query(`
                    SELECT 
                        id as scheduleId,
                        userId,
                        coursesJson,
                        totalCredits,
                        createdAt,
                        updatedAt
                    FROM Schedules
                    WHERE userId = @userId
                    ORDER BY createdAt DESC
                `);

            // Parse coursesJson for each schedule
            const schedules = result.recordset.map(s => ({
                ...s,
                courses: JSON.parse(s.coursesJson || '[]'),
                courseCount: JSON.parse(s.coursesJson || '[]').length
            }));

            return {
                success: true,
                schedules
            };
        }, 'getUserSchedules');
    }

    /**
     * Get schedule details
     */
    async getScheduleDetails(scheduleId) {
        return this.executeWithRetry(async (pool) => {
            const result = await pool.request()
                .input('scheduleId', sql.Int, scheduleId)
                .query(`
                    SELECT 
                        id as scheduleId,
                        userId,
                        coursesJson,
                        totalCredits,
                        createdAt,
                        updatedAt
                    FROM Schedules
                    WHERE id = @scheduleId
                `);

            if (result.recordset.length === 0) {
                return { success: false, error: 'Schedule not found' };
            }

            const schedule = result.recordset[0];
            return {
                success: true,
                schedule: {
                    ...schedule,
                    courses: JSON.parse(schedule.coursesJson || '[]')
                }
            };
        }, 'getScheduleDetails');
    }

    /**
     * Delete a schedule
     */
    async deleteSchedule(scheduleId, userIdentifier) {
        return this.executeWithRetry(async (pool) => {
            const email = userIdentifier.includes('@') ? userIdentifier : null;
            
            const result = await pool.request()
                .input('scheduleId', sql.Int, scheduleId)
                .input('userId', sql.NVarChar, email)
                .query(`
                    DELETE FROM Schedules 
                    WHERE id = @scheduleId AND userId = @userId
                `);

            return {
                success: result.rowsAffected[0] > 0,
                message: result.rowsAffected[0] > 0 ? 'Đã xóa thời khóa biểu' : 'Không tìm thấy thời khóa biểu'
            };
        }, 'deleteSchedule');
    }

    /**
     * Update a schedule
     */
    async updateSchedule(scheduleId, userIdentifier, courses) {
        return this.executeWithRetry(async (pool) => {
            const email = userIdentifier.includes('@') ? userIdentifier : null;
            const totalCredits = courses.reduce((sum, course) => sum + (course.credits || 0), 0);
            
            const result = await pool.request()
                .input('scheduleId', sql.Int, scheduleId)
                .input('userId', sql.NVarChar, email)
                .input('coursesJson', sql.NVarChar, JSON.stringify(courses))
                .input('totalCredits', sql.Int, totalCredits)
                .query(`
                    UPDATE Schedules 
                    SET coursesJson = @coursesJson, 
                        totalCredits = @totalCredits,
                        updatedAt = GETDATE()
                    WHERE id = @scheduleId AND userId = @userId
                `);

            return {
                success: result.rowsAffected[0] > 0,
                message: result.rowsAffected[0] > 0 ? 'Đã cập nhật thời khóa biểu' : 'Không tìm thấy thời khóa biểu'
            };
        }, 'updateSchedule');
    }
}

module.exports = { ScheduleService };
