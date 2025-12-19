const { app } = require('@azure/functions');
const { getCoursesBySemester } = require('../../database');

// Dynamic CORS origin based on environment
const getAllowedOrigin = (request) => {
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://student-schedule-frontend.azurewebsites.net'
    ];
    return allowedOrigins.includes(origin) ? origin : 'https://student-schedule-frontend.azurewebsites.net';
};

const getCorsHeaders = (request) => ({
    'Access-Control-Allow-Origin': getAllowedOrigin(request),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
});

app.http('courses', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const corsHeaders = getCorsHeaders(request);
        
        // Handle OPTIONS preflight
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders };
        }

        context.log('HTTP trigger function processed a request for courses');

        // Lấy parameter semester từ query string
        const semester = request.query.get('semester') || '2025A';

        try {
            // Lấy data từ Azure SQL Database
            context.log(`Fetching courses from Azure SQL Database`);
            const courses = await getCoursesBySemester(semester);

            context.log(`Loaded ${courses.length} courses from Azure SQL Database`);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
                body: JSON.stringify(courses)
            };
        } catch (error) {
            context.error('Error loading courses:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
                body: JSON.stringify({
                    error: 'Failed to load courses',
                    message: error.message
                })
            };
        }
    }
});
