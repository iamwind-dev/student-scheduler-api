/**
 * AUTHENTICATION API ENDPOINTS v2.0
 * Professional authentication routes with Microsoft Entra ID
 */

const { app } = require('@azure/functions');
const { AuthenticationService } = require('../../services/auth-service');
const { ResponseHelper } = require('../../utils/response-helper');
const { ValidationHelper } = require('../../utils/validation-helper');

// Initialize services
const authService = new AuthenticationService();
const response = new ResponseHelper();
const validator = new ValidationHelper();

/**
 * POST /api/auth/login
 * Microsoft Entra ID authentication
 */
app.http('auth-login', {
    methods: ['POST', 'OPTIONS'],
    route: 'auth/login',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle OPTIONS preflight
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const body = await request.json();

            // Validate request body
            const validation = validator.validateLoginRequest(body);
            if (!validation.isValid) {
                return response.validationError(validation.errors);
            }

            // Authenticate with Microsoft
            const result = await authService.authenticateWithMicrosoft(
                body.accessToken,
                body.tokenType
            );

            return {
                ...response.success(result, 'Login successful'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Login error:', error.message);

            if (error.message.includes('Invalid Microsoft token')) {
                return {
                    ...response.unauthorized('Invalid authentication token'),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            return {
                ...response.serverError('Authentication failed', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }
    }
});

/**
 * POST /api/auth/refresh
 * Refresh authentication token
 */
app.http('auth-refresh', {
    methods: ['POST', 'OPTIONS'],
    route: 'auth/refresh',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const authHeader = request.headers.get('authorization');

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    ...response.unauthorized('Refresh token required'),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            const refreshToken = authHeader.substring(7);
            const result = await authService.refreshToken(refreshToken);

            return {
                ...response.success(result, 'Token refreshed successfully'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Token refresh error:', error.message);

            if (error.message.includes('Invalid refresh token') ||
                error.message.includes('not found') ||
                error.message.includes('revoked')) {
                return {
                    ...response.unauthorized('Invalid or expired refresh token'),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            return {
                ...response.serverError('Token refresh failed', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }
    }
});

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
app.http('auth-logout', {
    methods: ['POST', 'OPTIONS'],
    route: 'auth/logout',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }

        try {
            const authHeader = request.headers.get('authorization');

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    ...response.unauthorized('Session token required'),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            const sessionToken = authHeader.substring(7);
            const result = await authService.logout(sessionToken);

            return {
                ...response.success(result, 'Logout successful'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Logout error:', error.message);
            return {
                ...response.serverError('Logout failed', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }
    }
});

/**
 * GET /api/auth/profile
 * Get current user profile
 */
app.http('auth-profile', {
    methods: ['GET', 'OPTIONS'],
    route: 'auth/profile',
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
            const authHeader = request.headers.get('authorization');

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    ...response.unauthorized('Session token required'),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            const sessionToken = authHeader.substring(7);
            const userProfile = await authService.getUserProfile(sessionToken);

            return {
                ...response.success(userProfile, 'Profile retrieved successfully'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Get profile error:', error.message);

            if (error.message.includes('Invalid session token')) {
                return {
                    ...response.unauthorized('Invalid or expired session token'),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            return {
                ...response.serverError('Failed to get profile', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }
    }
});

/**
 * GET /api/auth/validate
 * Validate current session token
 */
app.http('auth-validate', {
    methods: ['GET', 'OPTIONS'],
    route: 'auth/validate',
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
            const authHeader = request.headers.get('authorization');

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    ...response.unauthorized('Session token required'),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            const sessionToken = authHeader.substring(7);
            const validation = await authService.validateSessionToken(sessionToken);

            if (!validation) {
                return {
                    ...response.unauthorized('Invalid or expired session token'),
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:5173',
                        'Access-Control-Allow-Credentials': 'true'
                    }
                };
            }

            return {
                ...response.success({
                    valid: true,
                    user: validation.user,
                    expiresAt: validation.session.expiresAt
                }, 'Token is valid'),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };

        } catch (error) {
            context.log.error('Token validation error:', error.message);
            return {
                ...response.serverError('Token validation failed', error.message),
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Credentials': 'true'
                }
            };
        }
    }
});

module.exports = { app };
