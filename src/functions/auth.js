const { app } = require('@azure/functions');
const { AuthenticationService } = require('../services/auth-service');
const { ResponseHelper } = require('../utils/response-helper');
const { ValidationHelper } = require('../utils/validation-helper');

const authService = new AuthenticationService();
const response = new ResponseHelper();
const validator = new ValidationHelper();

app.http('auth-login', {
    methods: ['POST', 'OPTIONS'],
    route: 'session/signin',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const body = await request.json();
            context.log('Login request received:', { hasAccessToken: !!body.accessToken });

            if (!body.accessToken) {
                return {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    body: JSON.stringify({
                        success: false,
                        message: 'Access token required',
                        errors: [{ field: 'accessToken', message: 'Access token required' }]
                    })
                };
            }

            // Authenticate with Microsoft token
            const result = await authService.authenticateWithMicrosoft(body.accessToken);

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify({
                    success: true,
                    data: result,
                    message: 'Login successful'
                })
            };

        } catch (error) {
            context.log('Login error:', error.message, error.stack);

            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Authentication failed',
                    error: error.message
                })
            };
        }
    }
});

app.http('auth-refresh', {
    methods: ['POST', 'OPTIONS'],
    route: 'session/refresh',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const body = await request.json();

            if (!body.refreshToken) {
                return {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    body: JSON.stringify({
                        success: false,
                        message: 'Refresh token required'
                    })
                };
            }

            const result = await authService.refreshToken(body.refreshToken);

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify({
                    success: true,
                    data: result,
                    message: 'Token refreshed'
                })
            };

        } catch (error) {
            context.log.error('Refresh error:', error.message);

            return {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Invalid refresh token'
                })
            };
        }
    }
});

app.http('auth-logout', {
    methods: ['POST', 'OPTIONS'],
    route: 'session/signout',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const body = await request.json();
            await authService.logout(body.userId);

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify({
                    success: true,
                    message: 'Logout successful'
                })
            };

        } catch (error) {
            context.log.error('Logout error:', error.message);

            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Logout failed',
                    error: error.message
                })
            };
        }
    }
});

app.http('auth-me', {
    methods: ['GET', 'OPTIONS'],
    route: 'session/info',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const authHeader = request.headers.get('authorization');

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    body: JSON.stringify({
                        success: false,
                        message: 'Missing or invalid authorization header'
                    })
                };
            }

            const token = authHeader.substring(7);
            const user = await authService.validateToken(token);

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify({
                    success: true,
                    data: user,
                    message: 'User retrieved'
                })
            };

        } catch (error) {
            context.log.error('Get user error:', error.message);

            return {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                },
                body: JSON.stringify({
                    success: false,
                    message: 'Invalid or expired token'
                })
            };
        }
    }
});
