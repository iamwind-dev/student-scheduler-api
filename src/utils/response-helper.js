/**
 * RESPONSE HELPER v2.0
 * Standardized API response formatting and HTTP status codes
 */

class ResponseHelper {
    constructor() {
        this.timestamp = new Date().toISOString();
    }

    /**
     * Success response (200 OK)
     */
    success(data, message = 'Operation successful', statusCode = 200) {
        return {
            status: statusCode,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                data,
                message,
                timestamp: new Date().toISOString()
            })
        };
    }

    /**
     * Created response (201 Created)
     */
    created(data, message = 'Resource created successfully') {
        return this.success(data, message, 201);
    }

    /**
     * No content response (204 No Content)
     */
    noContent() {
        return {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            }
        };
    }

    /**
     * Bad request error (400 Bad Request)
     */
    badRequest(message = 'Bad request', details = null) {
        return {
            status: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: 'BAD_REQUEST',
                    message,
                    details,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * Unauthorized error (401 Unauthorized)
     */
    unauthorized(message = 'Authentication required') {
        return {
            status: 401,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * Forbidden error (403 Forbidden)
     */
    forbidden(message = 'Access forbidden') {
        return {
            status: 403,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * Not found error (404 Not Found)
     */
    notFound(message = 'Resource not found') {
        return {
            status: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * Conflict error (409 Conflict)
     */
    conflict(message = 'Resource conflict') {
        return {
            status: 409,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: 'CONFLICT',
                    message,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * Validation error (422 Unprocessable Entity)
     */
    validationError(errors, message = 'Validation failed') {
        return {
            status: 422,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message,
                    errors,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * Too many requests error (429 Too Many Requests)
     */
    tooManyRequests(message = 'Rate limit exceeded', retryAfter = null) {
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        };

        if (retryAfter) {
            headers['Retry-After'] = retryAfter.toString();
        }

        return {
            status: 429,
            headers,
            body: JSON.stringify({
                success: false,
                error: {
                    code: 'TOO_MANY_REQUESTS',
                    message,
                    retryAfter,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * Internal server error (500 Internal Server Error)
     */
    serverError(message = 'Internal server error', details = null) {
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message,
                    details: process.env.NODE_ENV === 'development' ? details : null,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * Service unavailable error (503 Service Unavailable)
     */
    serviceUnavailable(message = 'Service temporarily unavailable') {
        return {
            status: 503,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * Paginated response with metadata
     */
    paginated(data, pagination, message = 'Data retrieved successfully') {
        return this.success({
            items: data,
            pagination: {
                page: pagination.page || 1,
                limit: pagination.limit || 20,
                total: pagination.total || 0,
                totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 20)),
                hasNext: pagination.hasNext || false,
                hasPrev: pagination.hasPrev || false
            }
        }, message);
    }

    /**
     * Handle CORS preflight requests
     */
    corsPreflightResponse() {
        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Max-Age': '86400'
            }
        };
    }

    /**
     * Custom error with specific error code
     */
    customError(statusCode, errorCode, message, details = null) {
        return {
            status: statusCode,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: {
                    code: errorCode,
                    message,
                    details,
                    timestamp: new Date().toISOString()
                }
            })
        };
    }

    /**
     * File download response
     */
    fileDownload(fileBuffer, fileName, contentType = 'application/octet-stream') {
        return {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Access-Control-Allow-Origin': '*'
            },
            body: fileBuffer
        };
    }

    /**
     * Redirect response
     */
    redirect(location, permanent = false) {
        return {
            status: permanent ? 301 : 302,
            headers: {
                'Location': location,
                'Access-Control-Allow-Origin': '*'
            }
        };
    }
}

module.exports = { ResponseHelper };
