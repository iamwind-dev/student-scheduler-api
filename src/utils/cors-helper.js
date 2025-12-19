/**
 * CORS HELPER
 * Allow all origins for cross-device access
 */

/**
 * Get CORS headers for response
 * @returns {Object} - CORS headers object
 */
function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
}

module.exports = {
    getCorsHeaders
};
