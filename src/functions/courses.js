const { app } = require('@azure/functions');
const coursesData = require('../data/data.json');

app.http('courses', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle OPTIONS preflight
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        context.log('HTTP trigger function processed a request for courses');

        const semester = request.query.get('semester') || '2025A';

        try {
            context.log(`Fetching courses from JSON file`);

            const courses = coursesData.map(course => ({
                courseId: course.id,
                courseName: course.name,
                courseCode: `COURSE${course.id}`,
                credits: 2,
                lecturer: course.lecturer,
                time: course.time,
                room: course.room,
                weeks: course.weeks,
                quantity: parseInt(course['Sỉ số']) || 0
            }));

            context.log(`Loaded ${courses.length} courses from JSON file`);

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify(courses)
            };
        } catch (error) {
            context.error('Error loading courses:', error);
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify({
                    error: 'Internal Server Error',
                    message: error.message
                })
            };
        }
    }
});
