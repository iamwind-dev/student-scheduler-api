/**
 * DATABASE SERVICE v2.0
 * Professional Azure SQL Database integration with connection pooling
 */

const sql = require('mssql');
const { SystemLogger } = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.logger = new SystemLogger();
        this.pool = null;
        this.config = {
            server: process.env.SQL_SERVER || 'student-scheduler-server.database.windows.net',
            database: process.env.SQL_DATABASE || 'student-scheduler-db',
            user: process.env.SQL_USER || 'sqladmin',
            password: process.env.SQL_PASSWORD || 'admin123@',
            port: parseInt(process.env.SQL_PORT) || 1433,
            options: {
                encrypt: true,
                trustServerCertificate: false,
                enableArithAbort: true,
                requestTimeout: 30000,
                connectionTimeout: 30000
            },
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000,
                acquireTimeoutMillis: 60000,
                createTimeoutMillis: 30000,
                destroyTimeoutMillis: 5000,
                reapIntervalMillis: 1000,
                createRetryIntervalMillis: 200
            }
        };
    }

    /**
     * Initialize database connection pool
     */
    async initialize() {
        try {
            if (this.pool) {
                return this.pool;
            }

            this.pool = await new sql.ConnectionPool(this.config).connect();

            await this.logger.logSystemEvent('DATABASE_CONNECTED', {
                server: this.config.server,
                database: this.config.database
            });

            // Handle pool events
            this.pool.on('error', async (err) => {
                await this.logger.logError('DATABASE_POOL_ERROR', err.message);
            });

            return this.pool;

        } catch (error) {
            await this.logger.logError('DATABASE_CONNECTION_FAILED', error.message);
            throw error;
        }
    }

    /**
     * Get database connection
     */
    async getConnection() {
        if (!this.pool) {
            await this.initialize();
        }

        return this.pool;
    }

    /**
     * Execute query with error handling and logging
     */
    async executeQuery(query, params = {}, operation = 'QUERY') {
        try {
            const pool = await this.getConnection();
            const request = pool.request();

            // Add parameters
            Object.keys(params).forEach(key => {
                request.input(key, params[key]);
            });

            const startTime = Date.now();
            const result = await request.query(query);
            const duration = Date.now() - startTime;

            // Log slow queries
            if (duration > 5000) {
                await this.logger.logPerformance('SLOW_QUERY', {
                    query: query.substring(0, 100),
                    duration,
                    operation
                });
            }

            return result;

        } catch (error) {
            await this.logger.logError('DATABASE_QUERY_FAILED', error.message, {
                query: query.substring(0, 100),
                operation
            });
            throw error;
        }
    }

    // =====================================
    // USER MANAGEMENT METHODS
    // =====================================

    /**
     * Get user by ID with role information
     */
    async getUserById(userID) {
        const query = `
            SELECT u.*, r.roleName 
            FROM Users u 
            LEFT JOIN Roles r ON u.roleID = r.roleID 
            WHERE u.userID = @userID AND u.isActive = 1
        `;

        const result = await this.executeQuery(query, { userID }, 'GET_USER_BY_ID');
        return result.recordset[0] || null;
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email) {
        const query = `
            SELECT u.*, r.roleName 
            FROM Users u 
            LEFT JOIN Roles r ON u.roleID = r.roleID 
            WHERE u.email = @email AND u.isActive = 1
        `;

        const result = await this.executeQuery(query, { email }, 'GET_USER_BY_EMAIL');
        return result.recordset[0] || null;
    }

    /**
     * Create new user
     */
    async createUser(userData) {
        const query = `
            INSERT INTO Users (
                email, microsoftId, firstName, lastName, fullName, 
                studentCode, avatar, department, faculty, yearOfStudy, 
                roleID, isActive, isVerified, createdAt
            ) 
            OUTPUT INSERTED.*
            VALUES (
                @email, @microsoftId, @firstName, @lastName, @fullName,
                @studentCode, @avatar, @department, @faculty, @yearOfStudy,
                @roleID, @isActive, @isVerified, @createdAt
            )
        `;

        const params = {
            ...userData,
            createdAt: new Date(),
            isActive: userData.isActive !== false,
            isVerified: userData.isVerified !== false
        };

        const result = await this.executeQuery(query, params, 'CREATE_USER');
        return result.recordset[0];
    }

    /**
     * Update user information
     */
    async updateUser(userID, updateData) {
        const allowedFields = [
            'fullName', 'firstName', 'lastName', 'studentCode',
            'department', 'faculty', 'yearOfStudy', 'avatar', 'microsoftId'
        ];

        const updates = [];
        const params = { userID, updatedAt: new Date() };

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key) && updateData[key] !== undefined) {
                updates.push(`${key} = @${key}`);
                params[key] = updateData[key];
            }
        });

        if (updates.length === 0) {
            throw new Error('No valid fields to update');
        }

        const query = `
            UPDATE Users 
            SET ${updates.join(', ')}, updatedAt = @updatedAt
            OUTPUT INSERTED.*
            WHERE userID = @userID
        `;

        const result = await this.executeQuery(query, params, 'UPDATE_USER');
        return result.recordset[0];
    }

    /**
     * Update user last login timestamp
     */
    async updateUserLastLogin(userID) {
        const query = `
            UPDATE Users 
            SET lastLoginAt = @lastLoginAt 
            WHERE userID = @userID
        `;

        await this.executeQuery(query, {
            userID,
            lastLoginAt: new Date()
        }, 'UPDATE_LAST_LOGIN');
    }

    // =====================================
    // SESSION MANAGEMENT METHODS
    // =====================================

    /**
     * Create user session
     */
    async createUserSession(sessionData) {
        const query = `
            INSERT INTO UserSessions (
                userID, sessionToken, refreshToken, expiresAt, 
                ipAddress, userAgent, createdAt
            )
            OUTPUT INSERTED.*
            VALUES (
                @userID, @sessionToken, @refreshToken, @expiresAt,
                @ipAddress, @userAgent, @createdAt
            )
        `;

        const params = {
            ...sessionData,
            createdAt: new Date()
        };

        const result = await this.executeQuery(query, params, 'CREATE_SESSION');
        return result.recordset[0];
    }

    /**
     * Get session by token
     */
    async getSessionByToken(tokenHash) {
        const query = `
            SELECT * FROM UserSessions 
            WHERE sessionToken = @tokenHash AND isRevoked = 0
        `;

        const result = await this.executeQuery(query, { tokenHash }, 'GET_SESSION_BY_TOKEN');
        return result.recordset[0] || null;
    }

    /**
     * Get session by refresh token
     */
    async getSessionByRefreshToken(refreshTokenHash) {
        const query = `
            SELECT * FROM UserSessions 
            WHERE refreshToken = @refreshTokenHash AND isRevoked = 0
        `;

        const result = await this.executeQuery(query, { refreshTokenHash }, 'GET_SESSION_BY_REFRESH_TOKEN');
        return result.recordset[0] || null;
    }

    /**
     * Update user session
     */
    async updateUserSession(sessionID, updateData) {
        const updates = [];
        const params = { sessionID, lastUsedAt: new Date() };

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                updates.push(`${key} = @${key}`);
                params[key] = updateData[key];
            }
        });

        const query = `
            UPDATE UserSessions 
            SET ${updates.join(', ')}, lastUsedAt = @lastUsedAt
            WHERE sessionID = @sessionID
        `;

        await this.executeQuery(query, params, 'UPDATE_SESSION');
    }

    /**
     * Revoke session
     */
    async revokeSession(sessionID) {
        const query = `
            UPDATE UserSessions 
            SET isRevoked = 1, revokedAt = @revokedAt 
            WHERE sessionID = @sessionID
        `;

        await this.executeQuery(query, {
            sessionID,
            revokedAt: new Date()
        }, 'REVOKE_SESSION');
    }

    // =====================================
    // COURSE MANAGEMENT METHODS
    // =====================================

    /**
     * Get courses with filtering and pagination
     */
    async getCourses(filters = {}, pagination = { page: 1, limit: 20 }) {
        let whereConditions = ['c.isVisible = 1'];
        const params = {};
        let paramCounter = 1;

        // Build WHERE conditions
        if (filters.semesterCode) {
            whereConditions.push(`s.semesterCode = @param${paramCounter}`);
            params[`param${paramCounter}`] = filters.semesterCode;
            paramCounter++;
        }

        if (filters.subjectCode) {
            whereConditions.push(`sub.subjectCode = @param${paramCounter}`);
            params[`param${paramCounter}`] = filters.subjectCode;
            paramCounter++;
        }

        if (filters.campusCode) {
            whereConditions.push(`cam.campusCode = @param${paramCounter}`);
            params[`param${paramCounter}`] = filters.campusCode;
            paramCounter++;
        }

        if (filters.dayOfWeek) {
            whereConditions.push(`ts.dayNumber = @param${paramCounter}`);
            params[`param${paramCounter}`] = filters.dayOfWeek;
            paramCounter++;
        }

        if (filters.lecturerName) {
            whereConditions.push(`l.lecturerName LIKE @param${paramCounter}`);
            params[`param${paramCounter}`] = `%${filters.lecturerName}%`;
            paramCounter++;
        }

        if (filters.credits) {
            whereConditions.push(`sub.credits = @param${paramCounter}`);
            params[`param${paramCounter}`] = filters.credits;
            paramCounter++;
        }

        const whereClause = whereConditions.join(' AND ');
        const offset = (pagination.page - 1) * pagination.limit;

        // Count query
        const countQuery = `
            SELECT COUNT(*) as total
            FROM Courses c
            LEFT JOIN Subjects sub ON c.subjectID = sub.subjectID
            LEFT JOIN Semesters s ON c.semesterID = s.semesterID
            LEFT JOIN Lecturers l ON c.lecturerID = l.lecturerID
            LEFT JOIN Rooms r ON c.roomID = r.roomID
            LEFT JOIN Campuses cam ON r.campusID = cam.campusID
            LEFT JOIN TimeSlots ts ON c.timeSlotID = ts.timeSlotID
            WHERE ${whereClause}
        `;

        // Main query
        const mainQuery = `
            SELECT 
                c.*,
                sub.subjectCode, sub.subjectName, sub.credits, sub.department as subjectDepartment,
                s.semesterCode, s.semesterName, s.startDate, s.endDate,
                l.lecturerName, l.title as lecturerTitle, l.email as lecturerEmail,
                r.roomCode, r.capacity as roomCapacity,
                cam.campusCode, cam.campusName, cam.address as campusAddress,
                ts.dayOfWeek, ts.dayNumber, ts.startTime, ts.endTime, ts.timeDescription
            FROM Courses c
            LEFT JOIN Subjects sub ON c.subjectID = sub.subjectID
            LEFT JOIN Semesters s ON c.semesterID = s.semesterID
            LEFT JOIN Lecturers l ON c.lecturerID = l.lecturerID
            LEFT JOIN Rooms r ON c.roomID = r.roomID
            LEFT JOIN Campuses cam ON r.campusID = cam.campusID
            LEFT JOIN TimeSlots ts ON c.timeSlotID = ts.timeSlotID
            WHERE ${whereClause}
            ORDER BY c.courseID
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `;

        params.offset = offset;
        params.limit = pagination.limit;

        const [countResult, coursesResult] = await Promise.all([
            this.executeQuery(countQuery, params, 'COUNT_COURSES'),
            this.executeQuery(mainQuery, params, 'GET_COURSES')
        ]);

        const total = countResult.recordset[0].total;

        return {
            courses: coursesResult.recordset.map(row => this.mapCourseRow(row)),
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total,
                totalPages: Math.ceil(total / pagination.limit),
                hasNext: pagination.page * pagination.limit < total,
                hasPrev: pagination.page > 1
            }
        };
    }

    /**
     * Get course details by ID
     */
    async getCourseDetails(courseID) {
        const query = `
            SELECT 
                c.*,
                sub.subjectCode, sub.subjectName, sub.credits, sub.department as subjectDepartment,
                s.semesterCode, s.semesterName, s.startDate, s.endDate,
                l.lecturerName, l.title as lecturerTitle, l.email as lecturerEmail,
                r.roomCode, r.capacity as roomCapacity,
                cam.campusCode, cam.campusName, cam.address as campusAddress,
                ts.dayOfWeek, ts.dayNumber, ts.startTime, ts.endTime, ts.timeDescription
            FROM Courses c
            LEFT JOIN Subjects sub ON c.subjectID = sub.subjectID
            LEFT JOIN Semesters s ON c.semesterID = s.semesterID
            LEFT JOIN Lecturers l ON c.lecturerID = l.lecturerID
            LEFT JOIN Rooms r ON c.roomID = r.roomID
            LEFT JOIN Campuses cam ON r.campusID = cam.campusID
            LEFT JOIN TimeSlots ts ON c.timeSlotID = ts.timeSlotID
            WHERE c.courseID = @courseID AND c.isVisible = 1
        `;

        const result = await this.executeQuery(query, { courseID }, 'GET_COURSE_DETAILS');
        return result.recordset[0] ? this.mapCourseRow(result.recordset[0]) : null;
    }

    /**
     * Search courses with advanced criteria
     */
    async searchCourses(searchParams = {}, pagination = { page: 1, limit: 20 }) {
        let whereConditions = ['c.isVisible = 1'];
        const params = {};
        let paramCounter = 1;

        if (searchParams.query) {
            whereConditions.push(`(
                sub.subjectCode LIKE @param${paramCounter} OR 
                sub.subjectName LIKE @param${paramCounter} OR
                c.courseCode LIKE @param${paramCounter}
            )`);
            params[`param${paramCounter}`] = `%${searchParams.query}%`;
            paramCounter++;
        }

        if (searchParams.credits) {
            whereConditions.push(`sub.credits = @param${paramCounter}`);
            params[`param${paramCounter}`] = searchParams.credits;
            paramCounter++;
        }

        if (searchParams.lecturer) {
            whereConditions.push(`l.lecturerName LIKE @param${paramCounter}`);
            params[`param${paramCounter}`] = `%${searchParams.lecturer}%`;
            paramCounter++;
        }

        if (searchParams.department) {
            whereConditions.push(`sub.department = @param${paramCounter}`);
            params[`param${paramCounter}`] = searchParams.department;
            paramCounter++;
        }

        if (searchParams.semesterCode) {
            whereConditions.push(`s.semesterCode = @param${paramCounter}`);
            params[`param${paramCounter}`] = searchParams.semesterCode;
            paramCounter++;
        }

        return await this.getCourses({
            ...searchParams,
            _customWhere: whereConditions.join(' AND '),
            _customParams: params
        }, pagination);
    }

    // =====================================
    // ENROLLMENT MANAGEMENT METHODS
    // =====================================

    /**
     * Get user enrollments
     */
    async getUserEnrollments(userID, semesterCode = null) {
        let query = `
            SELECT e.*, c.courseCode, s.semesterCode
            FROM CourseEnrollments e
            LEFT JOIN Courses c ON e.courseID = c.courseID
            LEFT JOIN Semesters s ON c.semesterID = s.semesterID
            WHERE e.userID = @userID AND e.status = 'Active'
        `;

        const params = { userID };

        if (semesterCode) {
            query += ` AND s.semesterCode = @semesterCode`;
            params.semesterCode = semesterCode;
        }

        query += ` ORDER BY e.enrollmentDate DESC`;

        const result = await this.executeQuery(query, params, 'GET_USER_ENROLLMENTS');
        return result.recordset;
    }

    /**
     * Get user course enrollment
     */
    async getUserCourseEnrollment(userID, courseID) {
        const query = `
            SELECT * FROM CourseEnrollments 
            WHERE userID = @userID AND courseID = @courseID AND status = 'Active'
        `;

        const result = await this.executeQuery(query, { userID, courseID }, 'GET_USER_COURSE_ENROLLMENT');
        return result.recordset[0] || null;
    }

    /**
     * Create enrollment
     */
    async createEnrollment(enrollmentData) {
        const query = `
            INSERT INTO CourseEnrollments (
                userID, courseID, enrollmentType, enrollmentDate, status
            )
            OUTPUT INSERTED.*
            VALUES (
                @userID, @courseID, @enrollmentType, @enrollmentDate, @status
            )
        `;

        const result = await this.executeQuery(query, enrollmentData, 'CREATE_ENROLLMENT');
        return result.recordset[0];
    }

    /**
     * Update enrollment
     */
    async updateEnrollment(enrollmentID, updateData) {
        const updates = [];
        const params = { enrollmentID };

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                updates.push(`${key} = @${key}`);
                params[key] = updateData[key];
            }
        });

        const query = `
            UPDATE CourseEnrollments 
            SET ${updates.join(', ')}
            OUTPUT INSERTED.*
            WHERE enrollmentID = @enrollmentID
        `;

        const result = await this.executeQuery(query, params, 'UPDATE_ENROLLMENT');
        return result.recordset[0];
    }

    /**
     * Get enrollment details
     */
    async getEnrollmentDetails(enrollmentID) {
        const query = `
            SELECT e.*, c.courseCode, s.semesterCode
            FROM CourseEnrollments e
            LEFT JOIN Courses c ON e.courseID = c.courseID
            LEFT JOIN Semesters s ON c.semesterID = s.semesterID
            WHERE e.enrollmentID = @enrollmentID
        `;

        const result = await this.executeQuery(query, { enrollmentID }, 'GET_ENROLLMENT_DETAILS');
        return result.recordset[0] || null;
    }

    // =====================================
    // PREFERENCE MANAGEMENT METHODS
    // =====================================

    /**
     * Get user preferences
     */
    async getUserPreferences(userID, semesterCode = null) {
        let query = `
            SELECT * FROM StudentPreferences 
            WHERE userID = @userID
        `;

        const params = { userID };

        if (semesterCode) {
            query += ` AND semesterCode = @semesterCode`;
            params.semesterCode = semesterCode;
        }

        query += ` ORDER BY updatedAt DESC`;

        const result = await this.executeQuery(query, params, 'GET_USER_PREFERENCES');
        return result.recordset[0] || null;
    }

    /**
     * Create user preferences
     */
    async createUserPreferences(preferenceData) {
        const query = `
            INSERT INTO StudentPreferences (
                userID, semesterCode, minCredits, maxCredits, preferredCredits,
                preferredCampuses, blockedCampuses, avoidMorning, avoidEvening,
                preferredTimeSlots, blockedTimeSlots, preferredDays, restDays,
                preferredSubjects, blockedSubjects, allowOnlineClasses,
                maxConsecutiveHours, minBreakBetweenClasses, createdAt, updatedAt
            )
            OUTPUT INSERTED.*
            VALUES (
                @userID, @semesterCode, @minCredits, @maxCredits, @preferredCredits,
                @preferredCampuses, @blockedCampuses, @avoidMorning, @avoidEvening,
                @preferredTimeSlots, @blockedTimeSlots, @preferredDays, @restDays,
                @preferredSubjects, @blockedSubjects, @allowOnlineClasses,
                @maxConsecutiveHours, @minBreakBetweenClasses, @createdAt, @updatedAt
            )
        `;

        const params = {
            ...preferenceData,
            // Convert arrays to JSON strings
            preferredCampuses: JSON.stringify(preferenceData.campuses?.preferred || []),
            blockedCampuses: JSON.stringify(preferenceData.campuses?.blocked || []),
            preferredTimeSlots: JSON.stringify(preferenceData.timePreferences?.preferredSlots || []),
            blockedTimeSlots: JSON.stringify(preferenceData.timePreferences?.blockedSlots || []),
            preferredDays: JSON.stringify(preferenceData.timePreferences?.preferredDays || []),
            restDays: JSON.stringify(preferenceData.timePreferences?.restDays || []),
            preferredSubjects: JSON.stringify(preferenceData.subjectPreferences?.preferred || []),
            blockedSubjects: JSON.stringify(preferenceData.subjectPreferences?.blocked || []),
            // Extract nested values
            minCredits: preferenceData.credits?.min || 12,
            maxCredits: preferenceData.credits?.max || 18,
            preferredCredits: preferenceData.credits?.preferred || 15,
            avoidMorning: preferenceData.timePreferences?.avoidMorning || false,
            avoidEvening: preferenceData.timePreferences?.avoidEvening || false,
            allowOnlineClasses: preferenceData.advancedSettings?.allowOnlineClasses || true,
            maxConsecutiveHours: preferenceData.advancedSettings?.maxConsecutiveHours || 4,
            minBreakBetweenClasses: preferenceData.advancedSettings?.minBreakBetweenClasses || 30,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await this.executeQuery(query, params, 'CREATE_PREFERENCES');
        return result.recordset[0];
    }

    // =====================================
    // UTILITY METHODS
    // =====================================

    /**
     * Map course database row to object
     */
    mapCourseRow(row) {
        return {
            courseID: row.courseID,
            courseCode: row.courseCode,
            subject: {
                subjectID: row.subjectID,
                subjectCode: row.subjectCode,
                subjectName: row.subjectName,
                credits: row.credits,
                department: row.subjectDepartment
            },
            lecturer: {
                lecturerID: row.lecturerID,
                lecturerName: row.lecturerName,
                title: row.lecturerTitle,
                email: row.lecturerEmail
            },
            semester: {
                semesterID: row.semesterID,
                semesterCode: row.semesterCode,
                semesterName: row.semesterName,
                startDate: row.startDate,
                endDate: row.endDate
            },
            schedule: {
                room: {
                    roomID: row.roomID,
                    roomCode: row.roomCode,
                    capacity: row.roomCapacity,
                    campus: {
                        campusID: row.campusID,
                        campusCode: row.campusCode,
                        campusName: row.campusName,
                        address: row.campusAddress
                    }
                },
                timeSlot: {
                    timeSlotID: row.timeSlotID,
                    dayOfWeek: row.dayOfWeek,
                    dayNumber: row.dayNumber,
                    startTime: row.startTime,
                    endTime: row.endTime,
                    timeDescription: row.timeDescription
                },
                weeksSchedule: row.weeksSchedule
            },
            maxStudents: row.maxStudents,
            enrolledCount: row.enrolledCount || 0,
            status: row.status,
            isVisible: row.isVisible
        };
    }

    /**
     * Close database connection
     */
    async close() {
        try {
            if (this.pool) {
                await this.pool.close();
                this.pool = null;
                await this.logger.logSystemEvent('DATABASE_DISCONNECTED');
            }
        } catch (error) {
            await this.logger.logError('DATABASE_CLOSE_ERROR', error.message);
        }
    }
}

module.exports = { DatabaseService };
