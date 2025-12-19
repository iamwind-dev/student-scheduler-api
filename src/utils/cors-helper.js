/**
 * CORS HELPER
 * Dynamic CORS origin based on environment
 */

const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://student-schedule-frontend.azurewebsites.net'
];

/**
 * Get allowed origin from request
 * @param {Request} request - The HTTP request object
 * @returns {string} - The allowed origin
 */
function getAllowedOrigin(request) {
    const origin = request.headers.get('origin') || '';
    
    if (ALLOWED_ORIGINS.includes(origin)) {
        return origin;
    }
    
    // Default to production frontend if origin not in list
    return 'https://student-schedule-frontend.azurewebsites.net';
}

/**
 * Get CORS headers for response
 * @param {Request} request - The HTTP request object
 * @returns {Object} - CORS headers object
 */
function getCorsHeaders(request) {
    return {
        'Access-Control-Allow-Origin': getAllowedOrigin(request),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
    };
}

module.exports = {
    getAllowedOrigin,
    getCorsHeaders,
    ALLOWED_ORIGINS
};
