/**
 * SCHEDULE API ENDPOINTS
 * Manage user schedules in user-db
 */

const { app } = require('@azure/functions');
const { ScheduleService } = require('../../services/schedule-service');
const { ResponseHelper } = require('../../utils/response-helper');

const scheduleService = new ScheduleService();
const response = new ResponseHelper();

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
    // Default to production frontend if origin not in list
    return 'https://student-schedule-frontend.azurewebsites.net';
};

const getCorsHeaders = (request) => ({
    'Access-Control-Allow-Origin': getAllowedOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
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
                return {
                    ...response.validationError(['userId and courses array are required']),
                    headers: corsHeaders
                };
            }

            // Pass user data for creating user in DB if needed
            const userData = user || { email: userId };
            const result = await scheduleService.createSchedule(userId, scheduleName, courses, userData);

            context.log('[schedules-create] Success:', result);

            return {
                ...response.success(result, 'Schedule created successfully'),
                headers: corsHeaders
            };

        } catch (error) {
            context.log.error('[schedules-create] Error:', error);
            return {
                ...response.serverError('Failed to create schedule', error.message),
                headers: corsHeaders
            };
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
                return {
                    ...response.validationError(['userId is required']),
                    headers: corsHeaders
                };
            }

            // Can accept email or numeric ID
            const result = await scheduleService.getUserSchedules(userId);

            return {
                ...response.success(result, 'Schedules retrieved successfully'),
                headers: corsHeaders
            };

        } catch (error) {
            context.log.error('Get user schedules error:', error);
            return {
                ...response.serverError('Failed to get schedules', error.message),
                headers: corsHeaders
            };
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
                return {
                    ...response.validationError(['scheduleId is required']),
                    headers: corsHeaders
                };
            }

            const result = await scheduleService.getScheduleDetails(parseInt(scheduleId));

            return {
                ...response.success(result, 'Schedule details retrieved successfully'),
                headers: corsHeaders
            };

        } catch (error) {
            context.log.error('Get schedule details error:', error);
            return {
                ...response.serverError('Failed to get schedule details', error.message),
                headers: corsHeaders
            };
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
                return {
                    ...response.validationError(['scheduleId and courses array are required']),
                    headers: corsHeaders
                };
            }

            const result = await scheduleService.updateSchedule(parseInt(scheduleId), scheduleName, courses);

            return {
                ...response.success(result, 'Schedule updated successfully'),
                headers: corsHeaders
            };

        } catch (error) {
            context.log.error('Update schedule error:', error);
            return {
                ...response.serverError('Failed to update schedule', error.message),
                headers: corsHeaders
            };
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
                return {
                    ...response.validationError(['scheduleId is required']),
                    headers: corsHeaders
                };
            }

            const result = await scheduleService.deleteSchedule(parseInt(scheduleId));

            return {
                ...response.success(result, 'Schedule deleted successfully'),
                headers: corsHeaders
            };

        } catch (error) {
            context.log.error('Delete schedule error:', error);
            return {
                ...response.serverError('Failed to delete schedule', error.message),
                headers: corsHeaders
            };
        }
    }
});

module.exports = { app };
