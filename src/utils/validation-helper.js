/**
 * VALIDATION HELPER v2.0
 * Comprehensive input validation and sanitization
 */

class ValidationHelper {
    constructor() {
        this.patterns = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            phone: /^[\+]?[1-9][\d]{0,15}$/,
            studentCode: /^[A-Z0-9]{6,12}$/,
            semesterCode: /^(HK|GK)[1-3][\d]{4}$/, // HK12024, GK22024, etc.
            courseCode: /^[A-Z]{2,4}[\d]{3,4}[A-Z]?$/,
            timeSlot: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
            url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/
        };

        this.limits = {
            maxStringLength: 500,
            maxTextLength: 2000,
            maxArrayLength: 100,
            minPasswordLength: 8,
            maxCredits: 30,
            minCredits: 0
        };
    }

    /**
     * Validate login request
     */
    validateLoginRequest(data) {
        const errors = [];

        if (!data.accessToken) {
            errors.push({
                field: 'accessToken',
                code: 'REQUIRED',
                message: 'Access token is required'
            });
        } else if (typeof data.accessToken !== 'string' || data.accessToken.length < 10) {
            errors.push({
                field: 'accessToken',
                code: 'INVALID_FORMAT',
                message: 'Invalid access token format'
            });
        }

        if (data.tokenType && !['Bearer', 'bearer'].includes(data.tokenType)) {
            errors.push({
                field: 'tokenType',
                code: 'INVALID_VALUE',
                message: 'Token type must be Bearer'
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate user update request
     */
    validateUserUpdateRequest(data) {
        const errors = [];

        // Full name validation
        if (data.fullName !== undefined) {
            if (!this.isValidString(data.fullName, 1, 100)) {
                errors.push({
                    field: 'fullName',
                    code: 'INVALID_LENGTH',
                    message: 'Full name must be between 1 and 100 characters'
                });
            }
        }

        // Student code validation
        if (data.studentCode !== undefined) {
            if (data.studentCode && !this.patterns.studentCode.test(data.studentCode)) {
                errors.push({
                    field: 'studentCode',
                    code: 'INVALID_FORMAT',
                    message: 'Student code must be 6-12 alphanumeric characters'
                });
            }
        }

        // Department validation
        if (data.department !== undefined) {
            if (data.department && !this.isValidString(data.department, 1, 100)) {
                errors.push({
                    field: 'department',
                    code: 'INVALID_LENGTH',
                    message: 'Department must be between 1 and 100 characters'
                });
            }
        }

        // Year of study validation
        if (data.yearOfStudy !== undefined) {
            if (!this.isValidInteger(data.yearOfStudy, 1, 10)) {
                errors.push({
                    field: 'yearOfStudy',
                    code: 'OUT_OF_RANGE',
                    message: 'Year of study must be between 1 and 10'
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate course enrollment request
     */
    validateEnrollmentRequest(data) {
        const errors = [];

        if (!data.courseID) {
            errors.push({
                field: 'courseID',
                code: 'REQUIRED',
                message: 'Course ID is required'
            });
        } else if (!this.isValidInteger(data.courseID, 1)) {
            errors.push({
                field: 'courseID',
                code: 'INVALID_TYPE',
                message: 'Course ID must be a positive integer'
            });
        }

        if (data.enrollmentType && !['Enrolled', 'Waitlisted'].includes(data.enrollmentType)) {
            errors.push({
                field: 'enrollmentType',
                code: 'INVALID_VALUE',
                message: 'Enrollment type must be Enrolled or Waitlisted'
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate preference request
     */
    validatePreferenceRequest(data) {
        const errors = [];

        // Semester code validation
        if (!data.semesterCode) {
            errors.push({
                field: 'semesterCode',
                code: 'REQUIRED',
                message: 'Semester code is required'
            });
        } else if (!this.patterns.semesterCode.test(data.semesterCode)) {
            errors.push({
                field: 'semesterCode',
                code: 'INVALID_FORMAT',
                message: 'Semester code must follow format HK12024 or GK22024'
            });
        }

        // Credits validation
        if (data.maxCredits !== undefined) {
            if (!this.isValidInteger(data.maxCredits, this.limits.minCredits, this.limits.maxCredits)) {
                errors.push({
                    field: 'maxCredits',
                    code: 'OUT_OF_RANGE',
                    message: `Max credits must be between ${this.limits.minCredits} and ${this.limits.maxCredits}`
                });
            }
        }

        // Campus codes validation
        if (data.preferredCampuses !== undefined) {
            if (!Array.isArray(data.preferredCampuses)) {
                errors.push({
                    field: 'preferredCampuses',
                    code: 'INVALID_TYPE',
                    message: 'Preferred campuses must be an array'
                });
            } else if (data.preferredCampuses.length > this.limits.maxArrayLength) {
                errors.push({
                    field: 'preferredCampuses',
                    code: 'TOO_MANY_ITEMS',
                    message: `Too many preferred campuses (max ${this.limits.maxArrayLength})`
                });
            }
        }

        // Boolean validations
        const booleanFields = ['avoidMorning', 'avoidEvening'];
        booleanFields.forEach(field => {
            if (data[field] !== undefined && typeof data[field] !== 'boolean') {
                errors.push({
                    field,
                    code: 'INVALID_TYPE',
                    message: `${field} must be a boolean value`
                });
            }
        });

        // Time slots validation
        if (data.preferredTimeSlots !== undefined) {
            if (!Array.isArray(data.preferredTimeSlots)) {
                errors.push({
                    field: 'preferredTimeSlots',
                    code: 'INVALID_TYPE',
                    message: 'Preferred time slots must be an array'
                });
            } else {
                const invalidSlots = data.preferredTimeSlots.filter(slot =>
                    !this.isValidInteger(slot, 1, 12)
                );
                if (invalidSlots.length > 0) {
                    errors.push({
                        field: 'preferredTimeSlots',
                        code: 'INVALID_VALUE',
                        message: 'Time slot IDs must be integers between 1 and 12'
                    });
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate preference update request
     */
    validatePreferenceUpdateRequest(data) {
        // Same validation as create, but all fields are optional
        return this.validatePreferenceRequest(data);
    }

    /**
     * Validate preference copy request
     */
    validatePreferenceCopyRequest(data) {
        const errors = [];

        if (!data.sourceSemesterCode) {
            errors.push({
                field: 'sourceSemesterCode',
                code: 'REQUIRED',
                message: 'Source semester code is required'
            });
        } else if (!this.patterns.semesterCode.test(data.sourceSemesterCode)) {
            errors.push({
                field: 'sourceSemesterCode',
                code: 'INVALID_FORMAT',
                message: 'Source semester code format is invalid'
            });
        }

        if (!data.targetSemesterCode) {
            errors.push({
                field: 'targetSemesterCode',
                code: 'REQUIRED',
                message: 'Target semester code is required'
            });
        } else if (!this.patterns.semesterCode.test(data.targetSemesterCode)) {
            errors.push({
                field: 'targetSemesterCode',
                code: 'INVALID_FORMAT',
                message: 'Target semester code format is invalid'
            });
        }

        if (data.overwrite !== undefined && typeof data.overwrite !== 'boolean') {
            errors.push({
                field: 'overwrite',
                code: 'INVALID_TYPE',
                message: 'Overwrite must be a boolean value'
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate preference import request
     */
    validatePreferenceImportRequest(data) {
        const errors = [];

        if (!data.semesterCode) {
            errors.push({
                field: 'semesterCode',
                code: 'REQUIRED',
                message: 'Semester code is required'
            });
        } else if (!this.patterns.semesterCode.test(data.semesterCode)) {
            errors.push({
                field: 'semesterCode',
                code: 'INVALID_FORMAT',
                message: 'Semester code format is invalid'
            });
        }

        if (!data.preferenceData) {
            errors.push({
                field: 'preferenceData',
                code: 'REQUIRED',
                message: 'Preference data is required'
            });
        }

        if (data.format && !['json', 'csv'].includes(data.format.toLowerCase())) {
            errors.push({
                field: 'format',
                code: 'INVALID_VALUE',
                message: 'Format must be json or csv'
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate schedule generation request
     */
    validateScheduleGenerationRequest(data) {
        const errors = [];

        if (!data.semesterCode) {
            errors.push({
                field: 'semesterCode',
                code: 'REQUIRED',
                message: 'Semester code is required'
            });
        } else if (!this.patterns.semesterCode.test(data.semesterCode)) {
            errors.push({
                field: 'semesterCode',
                code: 'INVALID_FORMAT',
                message: 'Semester code format is invalid'
            });
        }

        if (data.algorithmType && !['balanced', 'minimal', 'flexible', 'compact'].includes(data.algorithmType)) {
            errors.push({
                field: 'algorithmType',
                code: 'INVALID_VALUE',
                message: 'Algorithm type must be balanced, minimal, flexible, or compact'
            });
        }

        if (data.maxRecommendations !== undefined) {
            if (!this.isValidInteger(data.maxRecommendations, 1, 10)) {
                errors.push({
                    field: 'maxRecommendations',
                    code: 'OUT_OF_RANGE',
                    message: 'Max recommendations must be between 1 and 10'
                });
            }
        }

        if (data.useExistingPreferences !== undefined && typeof data.useExistingPreferences !== 'boolean') {
            errors.push({
                field: 'useExistingPreferences',
                code: 'INVALID_TYPE',
                message: 'useExistingPreferences must be a boolean value'
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate schedule optimization request
     */
    validateScheduleOptimizationRequest(data) {
        const errors = [];

        if (!data.semesterCode) {
            errors.push({
                field: 'semesterCode',
                code: 'REQUIRED',
                message: 'Semester code is required'
            });
        }

        if (data.baseScheduleId && !this.isValidInteger(data.baseScheduleId, 1)) {
            errors.push({
                field: 'baseScheduleId',
                code: 'INVALID_TYPE',
                message: 'Base schedule ID must be a positive integer'
            });
        }

        if (data.optimizationGoals && !Array.isArray(data.optimizationGoals)) {
            errors.push({
                field: 'optimizationGoals',
                code: 'INVALID_TYPE',
                message: 'Optimization goals must be an array'
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Helper Methods

    /**
     * Validate string length and content
     */
    isValidString(value, minLength = 0, maxLength = this.limits.maxStringLength) {
        return typeof value === 'string' &&
            value.length >= minLength &&
            value.length <= maxLength;
    }

    /**
     * Validate integer range
     */
    isValidInteger(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
        return Number.isInteger(value) && value >= min && value <= max;
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        return typeof email === 'string' && this.patterns.email.test(email);
    }

    /**
     * Validate phone number format
     */
    isValidPhone(phone) {
        return typeof phone === 'string' && this.patterns.phone.test(phone);
    }

    /**
     * Validate URL format
     */
    isValidURL(url) {
        return typeof url === 'string' && this.patterns.url.test(url);
    }

    /**
     * Sanitize string input
     */
    sanitizeString(input, maxLength = this.limits.maxStringLength) {
        if (typeof input !== 'string') {
            return '';
        }

        return input
            .trim()
            .substring(0, maxLength)
            .replace(/[<>'"&]/g, ''); // Basic XSS prevention
    }

    /**
     * Sanitize integer input
     */
    sanitizeInteger(input, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
        const num = parseInt(input);
        if (isNaN(num)) {
            return null;
        }

        return Math.max(min, Math.min(max, num));
    }

    /**
     * Sanitize boolean input
     */
    sanitizeBoolean(input) {
        if (typeof input === 'boolean') {
            return input;
        }

        if (typeof input === 'string') {
            return ['true', '1', 'yes', 'on'].includes(input.toLowerCase());
        }

        return Boolean(input);
    }

    /**
     * Validate pagination parameters
     */
    validatePagination(page, limit) {
        const errors = [];

        const sanitizedPage = this.sanitizeInteger(page, 1, 1000);
        const sanitizedLimit = this.sanitizeInteger(limit, 1, 100);

        if (!sanitizedPage) {
            errors.push({
                field: 'page',
                code: 'INVALID_TYPE',
                message: 'Page must be a positive integer'
            });
        }

        if (!sanitizedLimit) {
            errors.push({
                field: 'limit',
                code: 'INVALID_TYPE',
                message: 'Limit must be a positive integer'
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: {
                page: sanitizedPage || 1,
                limit: sanitizedLimit || 20
            }
        };
    }

    /**
     * Validate array of IDs
     */
    validateIDArray(array, fieldName, required = false) {
        const errors = [];

        if (required && (!array || array.length === 0)) {
            errors.push({
                field: fieldName,
                code: 'REQUIRED',
                message: `${fieldName} is required`
            });
            return { isValid: false, errors };
        }

        if (array && !Array.isArray(array)) {
            errors.push({
                field: fieldName,
                code: 'INVALID_TYPE',
                message: `${fieldName} must be an array`
            });
            return { isValid: false, errors };
        }

        if (array && array.length > this.limits.maxArrayLength) {
            errors.push({
                field: fieldName,
                code: 'TOO_MANY_ITEMS',
                message: `${fieldName} exceeds maximum length of ${this.limits.maxArrayLength}`
            });
        }

        if (array) {
            const invalidItems = array.filter(item => !this.isValidInteger(item, 1));
            if (invalidItems.length > 0) {
                errors.push({
                    field: fieldName,
                    code: 'INVALID_VALUE',
                    message: `${fieldName} must contain only positive integers`
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = { ValidationHelper };
