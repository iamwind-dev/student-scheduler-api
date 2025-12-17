// ============================================
// SCHEDULES API - SQL Server Storage
// ============================================

const { app } = require('@azure/functions');
const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER || 'student-scheduler-server.database.windows.net',
    database: process.env.SQL_DATABASE || 'student-scheduler-db',
    user: process.env.SQL_USER || 'sqladmin',
    password: process.env.SQL_PASSWORD || 'admin123@',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

app.http('schedules-save', {
    methods: ['POST', 'OPTIONS'],
    route: 'schedules',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const body = await request.json();
            const { userId, courses, totalCredits } = body;

            const pool = await sql.connect(config);

            const result = await pool.request()
                .input('userId', sql.NVarChar, userId || 'demo-user')
                .input('coursesJson', sql.NVarChar, JSON.stringify(courses))
                .input('totalCredits', sql.Int, totalCredits)
                .query(`
                    INSERT INTO Schedules (userId, coursesJson, totalCredits, createdAt)
                    VALUES (@userId, @coursesJson, @totalCredits, GETDATE())
                `);

            await pool.close();

            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    message: 'Đã lưu thời khóa biểu'
                })
            };

        } catch (error) {
            context.log('Save schedule error:', error);

            return {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: false,
                    error: error.message
                })
            };
        }
    }
});

app.http('schedules-get', {
    methods: ['GET', 'OPTIONS'],
    route: 'schedules/{userId}',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const userId = request.params.userId || 'demo-user';

            const pool = await sql.connect(config);

            const result = await pool.request()
                .input('userId', sql.NVarChar, userId)
                .query(`
                    SELECT TOP 1 id, userId, coursesJson, totalCredits, createdAt
                    FROM Schedules
                    WHERE userId = @userId
                    ORDER BY createdAt DESC
                `);

            await pool.close();

            if (result.recordset.length > 0) {
                const schedule = result.recordset[0];
                return {
                    status: 200,
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: true,
                        data: {
                            id: schedule.id,
                            userId: schedule.userId,
                            courses: JSON.parse(schedule.coursesJson),
                            totalCredits: schedule.totalCredits,
                            createdAt: schedule.createdAt
                        }
                    })
                };
            } else {
                return {
                    status: 404,
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        success: false,
                        message: 'Chưa có thời khóa biểu'
                    })
                };
            }

        } catch (error) {
            context.log('Get schedule error:', error);

            return {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: false,
                    error: error.message
                })
            };
        }
    }
});
