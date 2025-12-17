const { app } = require('@azure/functions');
const { getPool } = require('../../database');

app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'health',
    handler: async (request, context) => {
        try {
            const pool = await getPool();
            await pool.request().query('SELECT 1');
            
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'ok',
                    database: 'connected',
                    timestamp: new Date().toISOString()
                })
            };
        } catch (error) {
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'ok',
                    database: 'disconnected',
                    error: error.message,
                    timestamp: new Date().toISOString()
                })
            };
        }
    }
});
