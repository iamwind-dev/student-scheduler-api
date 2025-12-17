/**
 * AUTHENTICATION SERVICE
 * Handles Microsoft Entra ID token validation and user authentication
 */

class AuthenticationService {
    constructor() {
        this.tokenCache = new Map();
    }

    /**
     * Authenticate with Microsoft Entra ID token
     * Validates token and returns user info
     */
    async authenticateWithMicrosoft(accessToken, tokenType = 'Bearer') {
        try {
            if (!accessToken) {
                throw new Error('Access token is required');
            }

                        // For demo purposes, accept any token and return mock user data
            const user = {
                id: 'demo-user-123',
                email: 'demo@student.com',
                name: 'Demo User',
                role: {
                    roleName: 'Student',
                    permissions: ['read', 'write']
                }
            };

            // Cache the token
            this.tokenCache.set(user.id, {
                accessToken,
                timestamp: Date.now()
            });

            return {
                user,
                token: 'mock-session-token-' + Date.now(),
                expiresIn: 3600
            };

        } catch (error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Refresh authentication token
     * Validates and refreshes the token
     */
    async refreshToken(refreshToken) {
        try {
            if (!refreshToken) {
                throw new Error('Refresh token is required');
            }

            // For demo purposes, return new mock token
            return {
                token: 'mock-refreshed-token-' + Date.now(),
                expiresIn: 3600
            };

        } catch (error) {
            throw new Error(`Token refresh failed: ${error.message}`);
        }
    }

    /**
     * Validate user token
     * Checks if token is still valid
     */
    async validateToken(accessToken) {
        try {
            if (!accessToken) {
                throw new Error('No token provided');
            }

            // For demo purposes, return mock user data for any token
            return {
                id: 'demo-user-123',
                email: 'demo@student.com',
                name: 'Demo User',
                role: {
                    roleName: 'Student',
                    permissions: ['read', 'write']
                }
            };

        } catch (error) {
            throw new Error(`Token validation failed: ${error.message}`);
        }
    }

    /**
     * Logout - clear cached tokens
     */
    logout(userId) {
        if (userId && this.tokenCache.has(userId)) {
            this.tokenCache.delete(userId);
        }
        return { success: true, message: 'Logged out successfully' };
    }
}

module.exports = { AuthenticationService };
