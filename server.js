/**
 * Express server with Swagger documentation - Azure SQL Database
 * Run with: node server.js
 */

// Load environment variables
const path = require('path');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '../.env';
require('dotenv').config({ path: path.resolve(__dirname, envFile) });
const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const sql = require('mssql');

const app = express();
const PORT = process.env.PORT || 7071;

// Azure SQL Database configuration
const dbConfig = {
    user: process.env.DB_USER || 'sqladmin',
    password: process.env.DB_PASSWORD || 'Wind060304@',
    server: process.env.DB_SERVER || 'student-schedule.database.windows.net',
    database: process.env.DB_DATABASE || 'student-scheduler-db',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Database connection pool
let pool = null;

async function getPool() {
    if (!pool) {
        try {
            pool = await sql.connect(dbConfig);
            console.log('✅ Connected to Azure SQL Database');
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            throw error;
        }
    }
    return pool;
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

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
    res.json(swaggerSpec);
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
    try {
        const dbPool = await getPool();
        await dbPool.request().query('SELECT 1');
        res.json({ 
            status: 'ok', 
            database: 'connected',
            timestamp: new Date().toISOString() 
        });
    } catch (error) {
        res.json({ 
            status: 'ok', 
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString() 
        });
    }
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
        const dbPool = await getPool();
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
        const dbPool = await getPool();
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

// Start server
app.listen(PORT, async () => {
    console.log(`\n🚀 API Server running at http://localhost:${PORT}`);
    console.log(`📖 Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`📚 Courses endpoint: http://localhost:${PORT}/api/courses`);
    console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
    console.log(`\n🔌 Connecting to Azure SQL Database...`);
    
    try {
        await getPool();
    } catch (error) {
        console.log(`⚠️  Database connection failed. API will retry on first request.\n`);
    }
});