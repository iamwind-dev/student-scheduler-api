/**
 * SCHEDULE API ENDPOINTS
 * Manage user schedules in user-db
 */

const { app } = require('@azure/functions');
const { ScheduleService } = require('../../services/schedule-service');

const scheduleService = new ScheduleService();

// Dynamic CORS origin based on environment
const getAllowedOrigin = (request) => {
    const origin = request.headers.get('origin') || '';
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://student-schedule-frontend.azurewebsites.net'
    ];
    
    if (allowedOrigins.includes(origin)) {
        return origin;
    }
    return 'https://student-schedule-frontend.azurewebsites.net';
};

const getCorsHeaders = (request) => ({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getAllowedOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
});

// Simple response helpers
const jsonResponse = (status, data, headers) => ({
    status,
    headers,
    body: JSON.stringify(data)
});

/**
 * POST /api/schedules
 * Create new schedule for user
 */
app.http('schedules-create', {
    methods: ['POST', 'OPTIONS'],
    route: 'schedules',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const corsHeaders = getCorsHeaders(request);
        
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders };
        }

        try {
            const body = await request.json();
            const { userId, scheduleName, courses, user } = body;

            context.log('[schedules-create] Request:', { userId, scheduleName, courseCount: courses?.length });

            if (!userId || !courses || !Array.isArray(courses) || courses.length === 0) {
                return jsonResponse(400, {
                    success: false,
                    error: 'userId and courses array are required'
                }, corsHeaders);
            }

            // Pass user data for creating user in DB if needed
            const userData = user || { email: userId };
            const result = await scheduleService.createSchedule(userId, scheduleName, courses, userData);

            context.log('[schedules-create] Success:', result);

            return jsonResponse(200, {
                success: true,
                data: result,
                message: 'Schedule created successfully'
            }, corsHeaders);

        } catch (error) {
            context.log.error('[schedules-create] Error:', error.message, error.stack);
            return jsonResponse(500, {
                success: false,
                error: 'Failed to create schedule',
                details: error.message
            }, corsHeaders);
        }
    }
});

/**
 * GET /api/schedules/user/:userId
 * Get all schedules for a user
 */
app.http('schedules-get-by-user', {
    methods: ['GET', 'OPTIONS'],
    route: 'schedules/user/{userId}',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const corsHeaders = getCorsHeaders(request);
        
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders };
        }

        try {
            const userId = request.params.userId;

            if (!userId) {
                return jsonResponse(400, {
                    success: false,
                    error: 'userId is required'
                }, corsHeaders);
            }

            // Can accept email or numeric ID
            const result = await scheduleService.getUserSchedules(userId);

            return jsonResponse(200, {
                success: true,
                data: result,
                message: 'Schedules retrieved successfully'
            }, corsHeaders);

        } catch (error) {
            context.log.error('Get user schedules error:', error.message);
            return jsonResponse(500, {
                success: false,
                error: 'Failed to get schedules',
                details: error.message
            }, corsHeaders);
        }
    }
});

/**
 * GET /api/schedules/:scheduleId
 * Get schedule details with courses
 */
app.http('schedules-get-details', {
    methods: ['GET', 'OPTIONS'],
    route: 'schedules/{scheduleId}',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const corsHeaders = getCorsHeaders(request);
        
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders };
        }

        try {
            const scheduleId = request.params.scheduleId;

            if (!scheduleId) {
                return jsonResponse(400, {
                    success: false,
                    error: 'scheduleId is required'
                }, corsHeaders);
            }

            const result = await scheduleService.getScheduleDetails(parseInt(scheduleId));

            return jsonResponse(200, {
                success: true,
                data: result,
                message: 'Schedule details retrieved successfully'
            }, corsHeaders);

        } catch (error) {
            context.log.error('Get schedule details error:', error.message);
            return jsonResponse(500, {
                success: false,
                error: 'Failed to get schedule details',
                details: error.message
            }, corsHeaders);
        }
    }
});

/**
 * PUT /api/schedules/:scheduleId
 * Update existing schedule
 */
app.http('schedules-update', {
    methods: ['PUT', 'OPTIONS'],
    route: 'schedules/{scheduleId}',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const corsHeaders = getCorsHeaders(request);
        
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders };
        }

        try {
            const scheduleId = request.params.scheduleId;
            const body = await request.json();
            const { scheduleName, courses } = body;

            if (!scheduleId || !courses || !Array.isArray(courses)) {
                return jsonResponse(400, {
                    success: false,
                    error: 'scheduleId and courses array are required'
                }, corsHeaders);
            }

            const result = await scheduleService.updateSchedule(parseInt(scheduleId), scheduleName, courses);

            return jsonResponse(200, {
                success: true,
                data: result,
                message: 'Schedule updated successfully'
            }, corsHeaders);

        } catch (error) {
            context.log.error('Update schedule error:', error.message);
            return jsonResponse(500, {
                success: false,
                error: 'Failed to update schedule',
                details: error.message
            }, corsHeaders);
        }
    }
});

/**
 * DELETE /api/schedules/:scheduleId
 * Delete schedule
 */
app.http('schedules-delete', {
    methods: ['DELETE', 'OPTIONS'],
    route: 'schedules/{scheduleId}',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const corsHeaders = getCorsHeaders(request);
        
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders };
        }

        try {
            const scheduleId = request.params.scheduleId;

            if (!scheduleId) {
                return jsonResponse(400, {
                    success: false,
                    error: 'scheduleId is required'
                }, corsHeaders);
            }

            const result = await scheduleService.deleteSchedule(parseInt(scheduleId));

            return jsonResponse(200, {
                success: true,
                data: result,
                message: 'Schedule deleted successfully'
            }, corsHeaders);

        } catch (error) {
            context.log.error('Delete schedule error:', error.message);
            return jsonResponse(500, {
                success: false,
                error: 'Failed to delete schedule',
                details: error.message
            }, corsHeaders);
        }
    }
});

module.exports = { app };
