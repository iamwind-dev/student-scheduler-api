/**
 * SYSTEM LOGGER v2.0
 * Comprehensive logging system for audit trails, performance monitoring, and debugging
 */

const fs = require('fs').promises;
const path = require('path');

class SystemLogger {
    constructor() {
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };

        this.currentLogLevel = process.env.LOG_LEVEL || 'INFO';
        this.logDirectory = process.env.LOG_DIRECTORY || path.join(__dirname, '../../logs');

        // Ensure log directory exists
        this.initializeLogDirectory();

        // Log categories
        this.categories = {
            SYSTEM: 'system',
            USER: 'user',
            API: 'api',
            DATABASE: 'database',
            PERFORMANCE: 'performance',
            SECURITY: 'security',
            ERROR: 'error'
        };
    }

    /**
     * Initialize log directory
     */
    async initializeLogDirectory() {
        try {
            await fs.access(this.logDirectory);
        } catch (error) {
            await fs.mkdir(this.logDirectory, { recursive: true });
        }
    }

    /**
     * Get log file path based on category and date
     */
    getLogFilePath(category, date = new Date()) {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(this.logDirectory, `${category}-${dateStr}.log`);
    }

    /**
     * Write log entry to file
     */
    async writeLogEntry(category, level, message, metadata = {}) {
        if (this.logLevels[level] > this.logLevels[this.currentLogLevel]) {
            return; // Skip if log level is higher than current setting
        }

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            category,
            message,
            metadata,
            environment: process.env.NODE_ENV || 'development',
            processId: process.pid
        };

        const logLine = JSON.stringify(logEntry) + '\n';
        const filePath = this.getLogFilePath(category);

        try {
            await fs.appendFile(filePath, logLine, 'utf8');

            // Also log to console in development
            if (process.env.NODE_ENV === 'development') {
                console.log(`[${timestamp}] [${level}] [${category}] ${message}`,
                    Object.keys(metadata).length > 0 ? metadata : '');
            }

        } catch (error) {
            console.error('Failed to write log entry:', error);
        }
    }

    // =====================================
    // USER ACTION LOGGING
    // =====================================

    /**
     * Log user actions for audit trail
     */
    async logUserAction(userID, action, details = {}) {
        const metadata = {
            userID,
            action,
            details,
            ipAddress: this.getCurrentIP(),
            userAgent: this.getCurrentUserAgent(),
            sessionID: this.getCurrentSessionID()
        };

        await this.writeLogEntry(
            this.categories.USER,
            'INFO',
            `User ${userID} performed action: ${action}`,
            metadata
        );

        // Also store in database for quick queries
        await this.storeUserActionInDB(metadata);
    }

    /**
     * Log authentication events
     */
    async logAuthEvent(userID, event, details = {}) {
        const metadata = {
            userID,
            event,
            details,
            ipAddress: this.getCurrentIP(),
            userAgent: this.getCurrentUserAgent(),
            timestamp: new Date()
        };

        await this.writeLogEntry(
            this.categories.SECURITY,
            'INFO',
            `Authentication event: ${event} for user ${userID}`,
            metadata
        );
    }

    /**
     * Log security events
     */
    async logSecurityEvent(event, severity, details = {}) {
        const level = severity === 'high' ? 'ERROR' :
            severity === 'medium' ? 'WARN' : 'INFO';

        const metadata = {
            event,
            severity,
            details,
            ipAddress: this.getCurrentIP(),
            userAgent: this.getCurrentUserAgent()
        };

        await this.writeLogEntry(
            this.categories.SECURITY,
            level,
            `Security event: ${event}`,
            metadata
        );

        // Send alerts for high severity events
        if (severity === 'high') {
            await this.sendSecurityAlert(event, details);
        }
    }

    // =====================================
    // API REQUEST/RESPONSE LOGGING
    // =====================================

    /**
     * Log API requests
     */
    async logAPIRequest(method, path, userID, requestData = {}) {
        const metadata = {
            method,
            path,
            userID,
            requestData: this.sanitizeRequestData(requestData),
            ipAddress: this.getCurrentIP(),
            userAgent: this.getCurrentUserAgent(),
            requestId: this.generateRequestId()
        };

        await this.writeLogEntry(
            this.categories.API,
            'INFO',
            `API Request: ${method} ${path}`,
            metadata
        );

        return metadata.requestId;
    }

    /**
     * Log API responses
     */
    async logAPIResponse(requestId, statusCode, responseTime, responseData = {}) {
        const level = statusCode >= 500 ? 'ERROR' :
            statusCode >= 400 ? 'WARN' : 'INFO';

        const metadata = {
            requestId,
            statusCode,
            responseTime,
            responseData: this.sanitizeResponseData(responseData)
        };

        await this.writeLogEntry(
            this.categories.API,
            level,
            `API Response: ${statusCode} (${responseTime}ms)`,
            metadata
        );
    }

    // =====================================
    // ERROR LOGGING
    // =====================================

    /**
     * Log errors with stack traces
     */
    async logError(errorCode, errorMessage, context = {}, error = null) {
        const metadata = {
            errorCode,
            errorMessage,
            context,
            stackTrace: error?.stack || new Error().stack,
            userID: context.userID,
            ipAddress: this.getCurrentIP(),
            timestamp: new Date()
        };

        await this.writeLogEntry(
            this.categories.ERROR,
            'ERROR',
            `Error [${errorCode}]: ${errorMessage}`,
            metadata
        );

        // Send error notifications for critical errors
        if (this.isCriticalError(errorCode)) {
            await this.sendErrorNotification(metadata);
        }
    }

    /**
     * Log database errors
     */
    async logDatabaseError(operation, query, error, params = {}) {
        const metadata = {
            operation,
            query: query?.substring(0, 200), // Truncate long queries
            error: error.message,
            params,
            stackTrace: error.stack
        };

        await this.writeLogEntry(
            this.categories.DATABASE,
            'ERROR',
            `Database Error in ${operation}: ${error.message}`,
            metadata
        );
    }

    // =====================================
    // PERFORMANCE LOGGING
    // =====================================

    /**
     * Log performance metrics
     */
    async logPerformance(operation, metrics = {}) {
        const metadata = {
            operation,
            metrics: {
                duration: metrics.duration,
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                ...metrics
            }
        };

        await this.writeLogEntry(
            this.categories.PERFORMANCE,
            'INFO',
            `Performance: ${operation} took ${metrics.duration}ms`,
            metadata
        );

        // Alert on slow operations
        if (metrics.duration > 10000) { // 10 seconds
            await this.logPerformanceAlert(operation, metrics);
        }
    }

    /**
     * Log slow database queries
     */
    async logSlowQuery(query, duration, params = {}) {
        const metadata = {
            query: query?.substring(0, 200),
            duration,
            params,
            memoryUsage: process.memoryUsage()
        };

        await this.writeLogEntry(
            this.categories.PERFORMANCE,
            'WARN',
            `Slow Query: ${duration}ms - ${query?.substring(0, 50)}...`,
            metadata
        );
    }

    // =====================================
    // SYSTEM EVENT LOGGING
    // =====================================

    /**
     * Log system events
     */
    async logSystemEvent(event, details = {}) {
        const metadata = {
            event,
            details,
            systemInfo: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage()
            }
        };

        await this.writeLogEntry(
            this.categories.SYSTEM,
            'INFO',
            `System Event: ${event}`,
            metadata
        );
    }

    /**
     * Log application startup
     */
    async logApplicationStartup() {
        const metadata = {
            environment: process.env.NODE_ENV,
            nodeVersion: process.version,
            platform: process.platform,
            pid: process.pid,
            memoryUsage: process.memoryUsage(),
            startTime: new Date()
        };

        await this.writeLogEntry(
            this.categories.SYSTEM,
            'INFO',
            'Application Started',
            metadata
        );
    }

    /**
     * Log application shutdown
     */
    async logApplicationShutdown() {
        const metadata = {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            shutdownTime: new Date()
        };

        await this.writeLogEntry(
            this.categories.SYSTEM,
            'INFO',
            'Application Shutdown',
            metadata
        );
    }

    // =====================================
    // LOG ANALYSIS & RETRIEVAL
    // =====================================

    /**
     * Get logs by category and date range
     */
    async getLogs(category, startDate, endDate, level = null) {
        const logs = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const filePath = this.getLogFilePath(category, currentDate);

            try {
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const logEntry = JSON.parse(line);

                        if (!level || logEntry.level === level) {
                            logs.push(logEntry);
                        }
                    } catch (parseError) {
                        // Skip malformed log entries
                        continue;
                    }
                }
            } catch (error) {
                // File doesn't exist for this date, continue
                continue;
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    /**
     * Get error summary for a date range
     */
    async getErrorSummary(startDate, endDate) {
        const errors = await this.getLogs(this.categories.ERROR, startDate, endDate);

        const summary = {
            totalErrors: errors.length,
            errorsByCode: {},
            errorsByHour: {},
            criticalErrors: 0
        };

        errors.forEach(error => {
            const code = error.metadata?.errorCode || 'UNKNOWN';
            const hour = new Date(error.timestamp).getHours();

            summary.errorsByCode[code] = (summary.errorsByCode[code] || 0) + 1;
            summary.errorsByHour[hour] = (summary.errorsByHour[hour] || 0) + 1;

            if (this.isCriticalError(code)) {
                summary.criticalErrors++;
            }
        });

        return summary;
    }

    // =====================================
    // HELPER METHODS
    // =====================================

    /**
     * Store user action in database for quick queries
     */
    async storeUserActionInDB(actionData) {
        try {
            // This would integrate with DatabaseService to store in SystemLogs table
            // For now, just log to file
        } catch (error) {
            // Silently fail - don't break application flow
        }
    }

    /**
     * Sanitize request data to remove sensitive information
     */
    sanitizeRequestData(data) {
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        const sanitized = { ...data };

        Object.keys(sanitized).forEach(key => {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                sanitized[key] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    /**
     * Sanitize response data
     */
    sanitizeResponseData(data) {
        // Remove large response bodies to prevent log bloat
        if (typeof data === 'object' && data.data && Array.isArray(data.data)) {
            return {
                ...data,
                data: `[Array with ${data.data.length} items]`
            };
        }

        return data;
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if error is critical
     */
    isCriticalError(errorCode) {
        const criticalErrors = [
            'DATABASE_CONNECTION_FAILED',
            'AUTHENTICATION_BYPASS_ATTEMPT',
            'SQL_INJECTION_DETECTED',
            'SYSTEM_OUT_OF_MEMORY'
        ];

        return criticalErrors.includes(errorCode);
    }

    /**
     * Send security alert (placeholder)
     */
    async sendSecurityAlert(event, details) {
        // This would integrate with notification service
        console.warn(`🚨 SECURITY ALERT: ${event}`, details);
    }

    /**
     * Send error notification (placeholder)
     */
    async sendErrorNotification(errorData) {
        // This would integrate with notification service
        console.error(`🔥 CRITICAL ERROR:`, errorData);
    }

    /**
     * Log performance alert
     */
    async logPerformanceAlert(operation, metrics) {
        console.warn(`⚡ PERFORMANCE ALERT: ${operation} took ${metrics.duration}ms`);
    }

    /**
     * Get current IP (placeholder - would be set by request middleware)
     */
    getCurrentIP() {
        return process.env.REQUEST_IP || '127.0.0.1';
    }

    /**
     * Get current user agent (placeholder)
     */
    getCurrentUserAgent() {
        return process.env.REQUEST_USER_AGENT || 'Student-Scheduler-API';
    }

    /**
     * Get current session ID (placeholder)
     */
    getCurrentSessionID() {
        return process.env.REQUEST_SESSION_ID || null;
    }

    /**
     * Clean up old log files
     */
    async cleanupOldLogs(retentionDays = 30) {
        try {
            const files = await fs.readdir(this.logDirectory);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logDirectory, file);
                    const stats = await fs.stat(filePath);

                    if (stats.mtime < cutoffDate) {
                        await fs.unlink(filePath);
                        console.log(`Cleaned up old log file: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old logs:', error);
        }
    }

    /**
     * Rotate log files if they get too large
     */
    async rotateLogIfNeeded(category, maxSizeMB = 100) {
        try {
            const filePath = this.getLogFilePath(category);
            const stats = await fs.stat(filePath);
            const sizeInMB = stats.size / (1024 * 1024);

            if (sizeInMB > maxSizeMB) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const archivePath = filePath.replace('.log', `-${timestamp}.log`);

                await fs.rename(filePath, archivePath);
                console.log(`Rotated log file: ${category} -> ${archivePath}`);
            }
        } catch (error) {
            // File might not exist yet, which is fine
        }
    }
}

module.exports = { SystemLogger };
