/**
 * SCHEDULE API ENDPOINTS
 * Manage user schedules in user-db
 */

const { app } = require('@azure/functions');
const { ScheduleService } = require('../../services/schedule-service');
const { ResponseHelper } = require('../../utils/response-helper');

const scheduleService = new ScheduleService();
const response = new ResponseHelper();

/**
 * POST /api/schedules
 * Create new schedule for user
 */
app.http('schedules-create', {
    methods: ['POST', 'OPTIONS'],
    route: 'schedules',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const body = await request.json();
            const { userId, scheduleName, courses, user } = body;

            if (!userId || !courses || !Array.isArray(courses) || courses.length === 0) {
                return {
                    ...response.validationError(['userId and courses array are required']),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            // Pass user data for creating user in DB if needed
            const userData = user || { email: userId };
            const result = await scheduleService.createSchedule(userId, scheduleName, courses, userData);

            return {
                ...response.success(result, 'Schedule created successfully'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Create schedule error:', error);
            return {
                ...response.serverError('Failed to create schedule', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
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

        try {
            const userId = request.params.userId;

            if (!userId) {
                return {
                    ...response.validationError(['userId is required']),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            // Can accept email or numeric ID
            const result = await scheduleService.getUserSchedules(userId);

            return {
                ...response.success(result, 'Schedules retrieved successfully'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Get user schedules error:', error);
            return {
                ...response.serverError('Failed to get schedules', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
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

        try {
            const scheduleId = request.params.scheduleId;

            if (!scheduleId) {
                return {
                    ...response.validationError(['scheduleId is required']),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            const result = await scheduleService.getScheduleDetails(parseInt(scheduleId));

            return {
                ...response.success(result, 'Schedule details retrieved successfully'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Get schedule details error:', error);
            return {
                ...response.serverError('Failed to get schedule details', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
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
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const scheduleId = request.params.scheduleId;
            const body = await request.json();
            const { scheduleName, courses } = body;

            if (!scheduleId || !courses || !Array.isArray(courses)) {
                return {
                    ...response.validationError(['scheduleId and courses array are required']),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            const result = await scheduleService.updateSchedule(parseInt(scheduleId), scheduleName, courses);

            return {
                ...response.success(result, 'Schedule updated successfully'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Update schedule error:', error);
            return {
                ...response.serverError('Failed to update schedule', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
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
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const scheduleId = request.params.scheduleId;

            if (!scheduleId) {
                return {
                    ...response.validationError(['scheduleId is required']),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            const result = await scheduleService.deleteSchedule(parseInt(scheduleId));

            return {
                ...response.success(result, 'Schedule deleted successfully'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Delete schedule error:', error);
            return {
                ...response.serverError('Failed to delete schedule', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }
    }
});

module.exports = { app };
