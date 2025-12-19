/**
 * Express server with Swagger documentation - Azure SQL Database
 * Run with: node server.js
 */

// Load environment variables
const path = require('path');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.resolve(__dirname, envFile) });
const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const sql = require('mssql');

const app = express();
const PORT = process.env.PORT || 7071;

// Azure SQL Database configuration - Courses DB (student-scheduler-db)
const coursesDbConfig = {
    user: process.env.DB_USER || 'sqladmin',
    password: process.env.DB_PASSWORD || 'Wind060304@',
    server: process.env.DB_SERVER || 'student-schedule.database.windows.net',
    database: 'student-scheduler-db',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
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

// Azure SQL Database configuration - Users DB (user-db)
const usersDbConfig = {
    user: process.env.DB_USER || 'sqladmin',
    password: process.env.DB_PASSWORD || 'Wind060304@',
    server: process.env.DB_SERVER || 'student-schedule.database.windows.net',
    database: 'user-db',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
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

// Retry configuration for Azure SQL Free tier auto-pause
const retryConfig = {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2
};

// Sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if error is related to Azure SQL paused state
function isAzurePausedError(error) {
    const pausedErrorPatterns = [
        'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'ENOTOPEN',
        'Connection lost', 'connection is closed',
        'Database .* on server .* is not currently available',
        'Cannot open server', 'Login failed',
        'Server is not found or not accessible',
        'TCP Provider', 'network-related', 'instance-specific error'
    ];
    const errorMessage = error.message || error.toString();
    const errorCode = error.code || '';
    return pausedErrorPatterns.some(pattern => 
        errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
        errorCode.includes(pattern)
    );
}

// Connect with retry for Azure SQL wake-up
async function connectWithRetry(config, dbName) {
    let lastError;
    let delay = retryConfig.initialDelayMs;

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
        try {
            console.log(`🔄 [${dbName}] Connection attempt ${attempt}/${retryConfig.maxRetries}...`);
            const pool = await new sql.ConnectionPool(config).connect();
            console.log(`✅ [${dbName}] Connected successfully on attempt ${attempt}`);
            return pool;
        } catch (error) {
            lastError = error;
            console.log(`❌ [${dbName}] Attempt ${attempt} failed: ${error.message}`);

            if (isAzurePausedError(error) && attempt < retryConfig.maxRetries) {
                console.log(`⏳ [${dbName}] Azure SQL might be paused. Waiting ${delay/1000}s...`);
                await sleep(delay);
                delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelayMs);
            } else if (attempt < retryConfig.maxRetries) {
                await sleep(retryConfig.initialDelayMs);
            }
        }
    }
    throw new Error(`[${dbName}] Failed to connect after ${retryConfig.maxRetries} attempts: ${lastError.message}`);
}

// Database connection pools
let coursesPool = null;
let usersPool = null;
let coursesPoolConnecting = false;
let usersPoolConnecting = false;

async function getCoursesPool() {
    // Wait if another request is already connecting
    if (coursesPoolConnecting) {
        while (coursesPoolConnecting) {
            await sleep(500);
        }
        if (coursesPool && coursesPool.connected) return coursesPool;
    }

    // Check if pool exists and is connected
    if (coursesPool && coursesPool.connected) {
        return coursesPool;
    }

    // Reset pool if disconnected
    if (coursesPool && !coursesPool.connected) {
        console.log('🔄 [Courses DB] Pool disconnected, reconnecting...');
        coursesPool = null;
    }

    coursesPoolConnecting = true;
    try {
        coursesPool = await connectWithRetry(coursesDbConfig, 'Courses DB');
        coursesPool.on('error', (err) => {
            console.error('❌ [Courses DB] Pool error:', err.message);
            coursesPool = null;
        });
        return coursesPool;
    } finally {
        coursesPoolConnecting = false;
    }
}

async function getUsersPool() {
    // Wait if another request is already connecting
    if (usersPoolConnecting) {
        while (usersPoolConnecting) {
            await sleep(500);
        }
        if (usersPool && usersPool.connected) return usersPool;
    }

    // Check if pool exists and is connected
    if (usersPool && usersPool.connected) {
        return usersPool;
    }

    // Reset pool if disconnected
    if (usersPool && !usersPool.connected) {
        console.log('🔄 [Users DB] Pool disconnected, reconnecting...');
        usersPool = null;
    }

    usersPoolConnecting = true;
    try {
        usersPool = await connectWithRetry(usersDbConfig, 'Users DB');
        usersPool.on('error', (err) => {
            console.error('❌ [Users DB] Pool error:', err.message);
            usersPool = null;
        });
        return usersPool;
    } finally {
        usersPoolConnecting = false;
    }
}

// Execute query with auto-retry on connection errors
async function executeWithRetry(getPoolFn, queryFn, operationName = 'Query') {
    let lastError;
    let delay = retryConfig.initialDelayMs;

    for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
        try {
            const pool = await getPoolFn();
            return await queryFn(pool);
        } catch (error) {
            lastError = error;

            if (isAzurePausedError(error)) {
                console.log(`⚠️ [${operationName}] Failed (attempt ${attempt}): ${error.message}`);
                
                // Reset the appropriate pool
                if (getPoolFn === getCoursesPool) coursesPool = null;
                if (getPoolFn === getUsersPool) usersPool = null;

                if (attempt < retryConfig.maxRetries) {
                    console.log(`⏳ [${operationName}] Retrying in ${delay/1000}s...`);
                    await sleep(delay);
                    delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelayMs);
                }
            } else {
                throw error;
            }
        }
    }
    throw new Error(`[${operationName}] Failed after ${retryConfig.maxRetries} attempts: ${lastError.message}`);
}

// Legacy function for backward compatibility
async function getPool() {
    return await getCoursesPool();
}

// Swagger configuration
const isProduction = process.env.NODE_ENV === 'production';
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Student Scheduler API',
            version: '1.0.0',
            description: 'API quản lý thời khóa biểu sinh viên - Azure SQL Database',
            contact: {
                name: 'Student Scheduler Team'
            }
        },
        servers: isProduction ? [
            {
                url: process.env.API_URL || 'https://func-student-schedule-gbcpezaghachdkfn.eastasia-01.azurewebsites.net',
                description: 'Production server'
            }
        ] : [
            {
                url: `http://localhost:${PORT}`,
                description: 'Development server'
            }
        ]
    },
    apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// CORS configuration - Allow both local and production origins
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://student-schedule-frontend.azurewebsites.net',
    'https://student-scheduler-frontend.azurewebsites.net',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json());

// Content Security Policy for Swagger UI
app.use('/api-docs', (req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' " + allowedOrigins.filter(Boolean).join(' ') + ";"
    );
    next();
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
    res.json(swaggerSpec);
});

// Root endpoint
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Student Scheduler API</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                h1 { color: #333; }
                a { color: #0066cc; text-decoration: none; }
                a:hover { text-decoration: underline; }
                .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>🎓 Student Scheduler API</h1>
            <p>API Server đang chạy thành công!</p>
            
            <h2>📚 Endpoints:</h2>
            <div class="endpoint">
                <strong>API Documentation:</strong> <a href="/api-docs">/api-docs</a>
            </div>
            <div class="endpoint">
                <strong>Health Check:</strong> <a href="/api/health">/api/health</a>
            </div>
            <div class="endpoint">
                <strong>Courses:</strong> <a href="/api/courses">/api/courses</a>
            </div>
            
            <h2>🗄️ Databases:</h2>
            <ul>
                <li><strong>Courses DB:</strong> student-scheduler-db (read courses)</li>
                <li><strong>Users DB:</strong> user-db (store users & schedules)</li>
            </ul>
            
            <h2>🌐 Frontend:</h2>
            <p>Vào UI tại: <a href="http://localhost:5173">http://localhost:5173</a></p>
        </body>
        </html>
    `);
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Kiểm tra trạng thái server và database
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server và database đang hoạt động
 */
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        databases: {}
    };

    try {
        const coursesDb = await getCoursesPool();
        await coursesDb.request().query('SELECT 1');
        health.databases.courses = 'connected (student-scheduler-db)';
    } catch (error) {
        health.databases.courses = `disconnected: ${error.message}`;
    }

    try {
        const usersDb = await getUsersPool();
        await usersDb.request().query('SELECT 1');
        health.databases.users = 'connected (user-db)';
    } catch (error) {
        health.databases.users = `disconnected: ${error.message}`;
    }

    res.json(health);
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Course:
 *       type: object
 *       properties:
 *         courseId:
 *           type: integer
 *         courseName:
 *           type: string
 *         courseCode:
 *           type: string
 *         credits:
 *           type: integer
 *         lecturer:
 *           type: string
 *         time:
 *           type: string
 *         room:
 *           type: string
 *         weeks:
 *           type: string
 *         quantity:
 *           type: integer
 */

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Lấy danh sách tất cả môn học từ Azure SQL
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: Danh sách môn học
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Course'
 */
app.get('/api/courses', async (req, res) => {
    try {
        const dbPool = await getCoursesPool();
        const result = await dbPool.request().query(`
            SELECT 
                ID as courseId,
                Name as courseName,
                'COURSE' + CAST(ID as NVARCHAR) as courseCode,
                ISNULL(Credits, 2) as credits,
                Lecturer as lecturer,
                Time as time,
                Room as room,
                Weeks as weeks,
                ISNULL(Quantity, 0) as quantity
            FROM Courses
            ORDER BY Name
        `);

        console.log(`[API] Loaded ${result.recordset.length} courses from Azure SQL`);
        res.json(result.recordset);
    } catch (error) {
        console.error('[API] Error loading courses:', error);
        res.status(500).json({ error: 'Database Error', message: error.message });
    }
});

/**
 * @swagger
 * /api/courses/{id}:
 *   get:
 *     summary: Lấy thông tin môn học theo ID
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Thông tin môn học
 *       404:
 *         description: Không tìm thấy môn học
 */
app.get('/api/courses/:id', async (req, res) => {
    try {
        const dbPool = await getCoursesPool();
        const result = await dbPool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT 
                    ID as courseId,
                    Name as courseName,
                    'COURSE' + CAST(ID as NVARCHAR) as courseCode,
                    ISNULL(Credits, 2) as credits,
                    Lecturer as lecturer,
                    Time as time,
                    Room as room,
                    Weeks as weeks,
                    ISNULL(Quantity, 0) as quantity
                FROM Courses
                WHERE ID = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy môn học' });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/courses/subjects:
 *   get:
 *     summary: Lấy danh sách môn học (không trùng lặp)
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: Danh sách môn học
 */
app.get('/api/courses/subjects', async (req, res) => {
    try {
        const dbPool = await getPool();
        const result = await dbPool.request().query(`
            SELECT DISTINCT 
                ROW_NUMBER() OVER (ORDER BY Name) as subjectId,
                Name as subjectName
            FROM Courses
            ORDER BY Name
        `);
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/courses/semesters:
 *   get:
 *     summary: Lấy danh sách học kỳ
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: Danh sách học kỳ
 */
app.get('/api/courses/semesters', (req, res) => {
    res.json([
        { semesterCode: '2025A', semesterName: 'Học kỳ 1 - 2024-2025' },
        { semesterCode: '2025B', semesterName: 'Học kỳ 2 - 2024-2025' }
    ]);
});

/**
 * @swagger
 * /api/courses/campuses:
 *   get:
 *     summary: Lấy danh sách cơ sở
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: Danh sách cơ sở
 */
app.get('/api/courses/campuses', async (req, res) => {
    try {
        const dbPool = await getPool();
        const result = await dbPool.request().query(`
            SELECT DISTINCT 
                LEFT(Room, CHARINDEX('.', Room) - 1) as campusCode
            FROM Courses
            WHERE Room IS NOT NULL AND CHARINDEX('.', Room) > 0
        `);
        
        const campuses = result.recordset
            .filter(r => r.campusCode)
            .map((r, index) => ({
                campusId: index + 1,
                campusCode: r.campusCode,
                campusName: `Cơ sở ${r.campusCode}`
            }));
        
        res.json(campuses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Đăng ký user mới
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               studentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng ký thành công
 */
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, name, studentId } = req.body;
        
        if (!email || !password || !name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Vui lòng nhập đầy đủ thông tin (email, password, name)' 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email không hợp lệ' 
            });
        }

        // Validate password (minimum 6 characters)
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                error: 'Mật khẩu phải có ít nhất 6 ký tự' 
            });
        }

        const dbPool = await getPool();
        
        // Tạo table Users nếu chưa có
        await dbPool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
            CREATE TABLE Users (
                UserId NVARCHAR(100) PRIMARY KEY,
                Email NVARCHAR(255) NOT NULL UNIQUE,
                Name NVARCHAR(255),
                StudentId NVARCHAR(50),
                Password NVARCHAR(255),
                Role NVARCHAR(50),
                CreatedAt DATETIME DEFAULT GETDATE(),
                LastLoginAt DATETIME DEFAULT GETDATE()
            )
        `);

        // Kiểm tra email đã tồn tại chưa
        const checkEmail = await dbPool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT UserId FROM Users WHERE Email = @email');

        if (checkEmail.recordset.length > 0) {
            return res.status(409).json({ 
                success: false, 
                error: 'Email đã được đăng ký' 
            });
        }

        // Tạo userId từ email
        const userId = email.split('@')[0] + '-' + Date.now();

        // Hash password đơn giản (production nên dùng bcrypt)
        const hashedPassword = Buffer.from(password).toString('base64');

        // Insert user mới
        await dbPool.request()
            .input('userId', sql.NVarChar, userId)
            .input('email', sql.NVarChar, email)
            .input('name', sql.NVarChar, name)
            .input('studentId', sql.NVarChar, studentId || '')
            .input('password', sql.NVarChar, hashedPassword)
            .input('role', sql.NVarChar, 'Student')
            .query(`
                INSERT INTO Users (UserId, Email, Name, StudentId, Password, Role)
                VALUES (@userId, @email, @name, @studentId, @password, @role)
            `);

        console.log(`[API] New user registered: ${email}`);

        res.json({ 
            success: true, 
            message: 'Đăng ký thành công!',
            data: {
                userId,
                email,
                name,
                studentId,
                role: 'Student'
            }
        });
    } catch (error) {
        console.error('[API] Error signing up:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi đăng ký', 
            message: error.message 
        });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Vui lòng nhập email và password' 
            });
        }

        const dbPool = await getPool();
        
        // Tìm user
        const result = await dbPool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Users WHERE Email = @email');

        if (result.recordset.length === 0) {
            return res.status(401).json({ 
                success: false, 
                error: 'Email hoặc mật khẩu không đúng' 
            });
        }

        const user = result.recordset[0];
        const hashedPassword = Buffer.from(password).toString('base64');

        if (user.Password !== hashedPassword) {
            return res.status(401).json({ 
                success: false, 
                error: 'Email hoặc mật khẩu không đúng' 
            });
        }

        // Update last login
        await dbPool.request()
            .input('userId', sql.NVarChar, user.UserId)
            .query('UPDATE Users SET LastLoginAt = GETDATE() WHERE UserId = @userId');

        console.log(`[API] User logged in: ${email}`);

        res.json({ 
            success: true, 
            message: 'Đăng nhập thành công!',
            data: {
                userId: user.UserId,
                email: user.Email,
                name: user.Name,
                studentId: user.StudentId,
                role: user.Role || 'Student'
            }
        });
    } catch (error) {
        console.error('[API] Error logging in:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi đăng nhập', 
            message: error.message 
        });
    }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Lưu/cập nhật thông tin user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lưu user thành công
 */
app.post('/api/users', async (req, res) => {
    try {
        const { userId, email, name, role } = req.body;
        
        if (!userId || !email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Thiếu thông tin userId hoặc email' 
            });
        }

        const dbPool = await getUsersPool();
        
        // Tạo table Users nếu chưa có
        await dbPool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
            CREATE TABLE Users (
                UserId NVARCHAR(100) PRIMARY KEY,
                Email NVARCHAR(255) NOT NULL,
                Name NVARCHAR(255),
                Role NVARCHAR(50),
                CreatedAt DATETIME DEFAULT GETDATE(),
                LastLoginAt DATETIME DEFAULT GETDATE()
            )
        `);

        // Kiểm tra user đã tồn tại chưa
        const checkResult = await dbPool.request()
            .input('userId', sql.NVarChar, userId)
            .query('SELECT UserId FROM Users WHERE UserId = @userId');

        if (checkResult.recordset.length > 0) {
            // Update existing user
            await dbPool.request()
                .input('userId', sql.NVarChar, userId)
                .input('email', sql.NVarChar, email)
                .input('name', sql.NVarChar, name || '')
                .input('role', sql.NVarChar, role || 'Student')
                .query(`
                    UPDATE Users 
                    SET Email = @email, 
                        Name = @name,
                        Role = @role,
                        LastLoginAt = GETDATE()
                    WHERE UserId = @userId
                `);
            console.log(`[API] Updated user: ${userId}`);
        } else {
            // Insert new user
            await dbPool.request()
                .input('userId', sql.NVarChar, userId)
                .input('email', sql.NVarChar, email)
                .input('name', sql.NVarChar, name || '')
                .input('role', sql.NVarChar, role || 'Student')
                .query(`
                    INSERT INTO Users (UserId, Email, Name, Role)
                    VALUES (@userId, @email, @name, @role)
                `);
            console.log(`[API] Created new user: ${userId}`);
        }

        res.json({ 
            success: true, 
            message: 'Lưu thông tin user thành công',
            data: { userId, email, name, role }
        });
    } catch (error) {
        console.error('[API] Error saving user:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Lỗi khi lưu thông tin user', 
            message: error.message 
        });
    }
});

/**
 * @swagger
 * /api/schedules:
 *   post:
 *     summary: Lưu thời khóa biểu với thông tin chi tiết
 *     tags: [Schedules]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               courses:
 *                 type: array
 *               totalCredits:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Lưu thành công
 */

// ENDPOINT REMOVED - Using ScheduleService below instead

/**
 * @swagger
 * /api/schedules/{userId}:
 *   get:
 *     summary: Lấy thời khóa biểu của user
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thời khóa biểu
 */
// OLD ENDPOINT REMOVED - Use /api/schedules/user/:userId instead
// app.get('/api/schedules/:userId') conflicts with /api/schedules/:scheduleId

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               studentId:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Thiếu thông tin hoặc email đã tồn tại
 */
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, studentId, password } = req.body;

        // Validate input
        if (!name || !email || !studentId || !password) {
            return res.status(400).json({
                success: false,
                error: 'Vui lòng điền đầy đủ thông tin'
            });
        }

        const dbPool = await getUsersPool();

        // Check if email already exists
        const existingUser = await dbPool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT UserId FROM Users WHERE Email = @email');

        if (existingUser.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email đã được sử dụng'
            });
        }

        // Hash password (simple base64 for demo - use bcrypt in production)
        const hashedPassword = Buffer.from(password).toString('base64');

        // Insert new user
        const result = await dbPool.request()
            .input('email', sql.NVarChar, email)
            .input('name', sql.NVarChar, name)
            .input('studentId', sql.NVarChar, studentId)
            .input('password', sql.NVarChar, hashedPassword)
            .input('role', sql.NVarChar, 'student')
            .query(`
                INSERT INTO Users (Email, Name, StudentId, Password, Role)
                OUTPUT INSERTED.UserId, INSERTED.Email, INSERTED.Name, INSERTED.StudentId, INSERTED.Role
                VALUES (@email, @name, @studentId, @password, @role)
            `);

        const newUser = result.recordset[0];

        console.log('[API] User created:', newUser.Email);

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công',
            user: {
                id: newUser.UserId,
                email: newUser.Email,
                name: newUser.Name,
                studentId: newUser.StudentId,
                role: newUser.Role
            }
        });
    } catch (error) {
        console.error('[API] Signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi đăng ký',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         description: Email hoặc mật khẩu không đúng
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Vui lòng nhập email và mật khẩu'
            });
        }

        const dbPool = await getUsersPool();

        // Find user
        const result = await dbPool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT UserId, Email, Name, StudentId, Password, Role FROM Users WHERE Email = @email');

        if (result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Email hoặc mật khẩu không đúng'
            });
        }

        const user = result.recordset[0];

        // Verify password
        const hashedPassword = Buffer.from(password).toString('base64');
        if (user.Password !== hashedPassword) {
            return res.status(401).json({
                success: false,
                error: 'Email hoặc mật khẩu không đúng'
            });
        }

        console.log('[API] User logged in:', user.Email);

        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            user: {
                id: user.UserId,
                email: user.Email,
                name: user.Name,
                studentId: user.StudentId,
                role: user.Role
            }
        });
    } catch (error) {
        console.error('[API] Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi đăng nhập',
            message: error.message
        });
    }
});

// =========================================
// SCHEDULES ENDPOINTS
// =========================================

const { ScheduleService } = require('./src/services/schedule-service');
const scheduleService = new ScheduleService();

/**
 * POST /api/schedules
 * Create new schedule
 */
app.post('/api/schedules', async (req, res) => {
    try {
        const { userId, scheduleName, courses, user } = req.body;

        console.log('[API] Creating schedule for user:', userId);

        if (!userId || !courses || !Array.isArray(courses) || courses.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'userId and courses array are required'
            });
        }

        const userData = user || { email: userId };
        const result = await scheduleService.createSchedule(userId, scheduleName, courses, userData);

        console.log('[API] Schedule created successfully:', result.scheduleId);

        res.json({
            success: true,
            message: 'Schedule created successfully',
            data: result.data
        });
    } catch (error) {
        console.error('[API] Error saving schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lưu thời khóa biểu',
            message: error.message
        });
    }
});

/**
 * GET /api/schedules/user/:userId
 * Get all schedules for a user
 */
app.get('/api/schedules/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        console.log('[API] Getting schedules for user:', userId);

        const result = await scheduleService.getUserSchedules(userId);

        res.json({
            success: true,
            schedules: result.schedules
        });
    } catch (error) {
        console.error('[API] Error getting schedules:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy danh sách schedules',
            message: error.message
        });
    }
});

/**
 * GET /api/schedules/:scheduleId
 * Get schedule details with courses
 */
app.get('/api/schedules/:scheduleId', async (req, res) => {
    try {
        const scheduleId = parseInt(req.params.scheduleId);

        console.log('[API] Getting schedule details:', scheduleId);

        const result = await scheduleService.getScheduleDetails(scheduleId);

        res.json({
            success: true,
            data: {
                schedule: result.schedule,
                courses: result.courses
            }
        });
    } catch (error) {
        console.error('[API] Error getting schedule details:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy chi tiết schedule',
            message: error.message
        });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`\n🚀 API Server running at http://localhost:${PORT}`);
    console.log(`📖 Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`📚 Courses endpoint: http://localhost:${PORT}/api/courses`);
    console.log(`📅 Schedules endpoint: http://localhost:${PORT}/api/schedules`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
    console.log(`\n🔌 Connecting to Azure SQL Databases...`);
    
    try {
        await getCoursesPool();
        await getUsersPool();
        console.log('✅ Both databases connected successfully\n');
    } catch (error) {
        console.log(`⚠️  Some database connections failed. API will retry on first request.\n`);
    }
});