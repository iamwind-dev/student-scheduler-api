/**
 * STUDENT SCHEDULER - BACKEND API ARCHITECTURE v2.0
 * Professional RESTful API Design
 * 
 * API Structure:
 * - /api/auth/*          - Authentication endpoints
 * - /api/users/*         - User management
 * - /api/courses/*       - Course data
 * - /api/preferences/*   - User preferences
 * - /api/schedules/*     - Schedule recommendations
 * - /api/admin/*         - Administrative functions
 */

// =====================================
// API ENDPOINTS SPECIFICATION
// =====================================

const API_ENDPOINTS = {

    // AUTHENTICATION APIs
    auth: {
        // POST /api/auth/login
        login: {
            method: 'POST',
            path: '/api/auth/login',
            description: 'Microsoft Entra ID authentication',
            body: {
                accessToken: 'string', // From Microsoft login
                tokenType: 'Bearer',
                expiresIn: 'number'
            },
            response: {
                success: 'boolean',
                user: 'UserProfile',
                sessionToken: 'string',
                refreshToken: 'string',
                expiresAt: 'datetime'
            }
        },

        // POST /api/auth/refresh
        refresh: {
            method: 'POST',
            path: '/api/auth/refresh',
            description: 'Refresh authentication token',
            headers: { 'Authorization': 'Bearer <refreshToken>' },
            response: {
                sessionToken: 'string',
                expiresAt: 'datetime'
            }
        },

        // POST /api/auth/logout
        logout: {
            method: 'POST',
            path: '/api/auth/logout',
            description: 'Logout and invalidate session',
            headers: { 'Authorization': 'Bearer <sessionToken>' },
            response: { success: 'boolean' }
        },

        // GET /api/auth/profile
        profile: {
            method: 'GET',
            path: '/api/auth/profile',
            description: 'Get current user profile',
            headers: { 'Authorization': 'Bearer <sessionToken>' },
            response: 'UserProfile'
        }
    },

    // USER MANAGEMENT APIs
    users: {
        // GET /api/users/me
        getCurrentUser: {
            method: 'GET',
            path: '/api/users/me',
            description: 'Get current user details',
            response: 'UserProfile'
        },

        // PUT /api/users/me
        updateProfile: {
            method: 'PUT',
            path: '/api/users/me',
            description: 'Update user profile',
            body: {
                fullName: 'string',
                department: 'string',
                yearOfStudy: 'number'
            },
            response: 'UserProfile'
        },

        // GET /api/users/me/enrollments
        getEnrollments: {
            method: 'GET',
            path: '/api/users/me/enrollments',
            description: 'Get user course enrollments',
            query: { semesterCode: 'string?' },
            response: ['CourseEnrollment']
        }
    },

    // COURSE DATA APIs
    courses: {
        // GET /api/courses
        getAll: {
            method: 'GET',
            path: '/api/courses',
            description: 'Get all available courses',
            query: {
                semesterCode: 'string?',
                subjectCode: 'string?',
                campusCode: 'string?',
                dayOfWeek: 'number?',
                page: 'number?',
                limit: 'number?'
            },
            response: {
                courses: ['Course'],
                pagination: {
                    page: 'number',
                    limit: 'number',
                    total: 'number',
                    totalPages: 'number'
                }
            }
        },

        // GET /api/courses/{courseId}
        getById: {
            method: 'GET',
            path: '/api/courses/{courseId}',
            description: 'Get course details by ID',
            response: 'CourseDetails'
        },

        // GET /api/courses/search
        search: {
            method: 'GET',
            path: '/api/courses/search',
            description: 'Search courses by criteria',
            query: {
                q: 'string', // Search query
                credits: 'number?',
                timeSlot: 'string?',
                lecturer: 'string?'
            },
            response: ['Course']
        }
    },

    // PREFERENCES APIs
    preferences: {
        // GET /api/preferences
        get: {
            method: 'GET',
            path: '/api/preferences',
            description: 'Get user preferences',
            query: { semesterCode: 'string?' },
            response: 'StudentPreferences'
        },

        // POST /api/preferences
        save: {
            method: 'POST',
            path: '/api/preferences',
            description: 'Save user preferences',
            body: {
                semesterCode: 'string',
                maxCredits: 'number',
                preferredCampuses: ['string'],
                avoidMorning: 'boolean',
                avoidEvening: 'boolean',
                preferredTimeSlots: ['string'],
                blockedTimeSlots: ['string']
            },
            response: 'StudentPreferences'
        },

        // PUT /api/preferences/{preferenceId}
        update: {
            method: 'PUT',
            path: '/api/preferences/{preferenceId}',
            description: 'Update existing preferences',
            body: 'StudentPreferences',
            response: 'StudentPreferences'
        }
    },

    // SCHEDULE RECOMMENDATIONS APIs
    schedules: {
        // POST /api/schedules/generate
        generate: {
            method: 'POST',
            path: '/api/schedules/generate',
            description: 'Generate schedule recommendations',
            body: {
                semesterCode: 'string',
                useExistingPreferences: 'boolean?',
                customPreferences: 'StudentPreferences?',
                algorithmType: 'string?' // 'balanced', 'minimal', 'flexible'
            },
            response: {
                recommendations: ['ScheduleRecommendation'],
                generatedAt: 'datetime',
                algorithm: 'string',
                stats: {
                    totalOptions: 'number',
                    averageScore: 'number',
                    processingTime: 'number'
                }
            }
        },

        // GET /api/schedules/history
        getHistory: {
            method: 'GET',
            path: '/api/schedules/history',
            description: 'Get user schedule history',
            query: {
                semesterCode: 'string?',
                page: 'number?',
                limit: 'number?'
            },
            response: {
                schedules: ['ScheduleRecommendation'],
                pagination: 'PaginationInfo'
            }
        },

        // POST /api/schedules/{scheduleId}/bookmark
        bookmark: {
            method: 'POST',
            path: '/api/schedules/{scheduleId}/bookmark',
            description: 'Bookmark a schedule recommendation',
            response: { success: 'boolean' }
        },

        // POST /api/schedules/{scheduleId}/apply
        apply: {
            method: 'POST',
            path: '/api/schedules/{scheduleId}/apply',
            description: 'Apply schedule (enroll in courses)',
            response: {
                success: 'boolean',
                enrolledCourses: ['CourseEnrollment'],
                conflicts: ['ConflictInfo']
            }
        }
    },

    // ADMINISTRATIVE APIs
    admin: {
        // GET /api/admin/stats
        getStats: {
            method: 'GET',
            path: '/api/admin/stats',
            description: 'Get system statistics',
            response: {
                totalUsers: 'number',
                activeUsers: 'number',
                totalCourses: 'number',
                totalEnrollments: 'number'
            }
        },

        // GET /api/admin/logs
        getLogs: {
            method: 'GET',
            path: '/api/admin/logs',
            description: 'Get system logs',
            query: {
                action: 'string?',
                userId: 'number?',
                startDate: 'datetime?',
                endDate: 'datetime?',
                page: 'number?',
                limit: 'number?'
            },
            response: {
                logs: ['SystemLog'],
                pagination: 'PaginationInfo'
            }
        }
    }
};

// =====================================
// DATA MODELS
// =====================================

const DATA_MODELS = {

    UserProfile: {
        userID: 'number',
        email: 'string',
        studentCode: 'string?',
        fullName: 'string',
        firstName: 'string',
        lastName: 'string',
        avatar: 'string?',
        department: 'string?',
        faculty: 'string?',
        yearOfStudy: 'number?',
        role: {
            roleID: 'number',
            roleName: 'string'
        },
        isActive: 'boolean',
        isVerified: 'boolean',
        createdAt: 'datetime',
        lastLoginAt: 'datetime?'
    },

    Course: {
        courseID: 'number',
        courseCode: 'string',
        subject: {
            subjectID: 'number',
            subjectCode: 'string',
            subjectName: 'string',
            credits: 'number',
            department: 'string'
        },
        lecturer: {
            lecturerID: 'number',
            lecturerName: 'string',
            title: 'string',
            email: 'string'
        },
        semester: {
            semesterID: 'number',
            semesterCode: 'string',
            semesterName: 'string'
        },
        schedule: {
            room: {
                roomID: 'number',
                roomCode: 'string',
                campus: {
                    campusID: 'number',
                    campusCode: 'string',
                    campusName: 'string'
                }
            },
            timeSlot: {
                timeSlotID: 'number',
                dayOfWeek: 'string',
                dayNumber: 'number',
                startTime: 'time',
                endTime: 'time',
                timeDescription: 'string'
            },
            weeksSchedule: 'string'
        },
        enrollment: {
            maxStudents: 'number',
            enrolledCount: 'number',
            availableSpots: 'number'
        },
        status: 'string',
        isVisible: 'boolean'
    },

    StudentPreferences: {
        preferenceID: 'number',
        userID: 'number',
        semesterCode: 'string',
        credits: {
            min: 'number',
            max: 'number',
            preferred: 'number'
        },
        campuses: {
            preferred: ['string'],
            blocked: ['string']
        },
        timePreferences: {
            avoidMorning: 'boolean',
            avoidEvening: 'boolean',
            preferredSlots: ['number'],
            blockedSlots: ['number'],
            preferredDays: ['number'],
            restDays: ['number']
        },
        subjectPreferences: {
            preferred: ['number'],
            blocked: ['number']
        },
        advancedSettings: {
            allowOnlineClasses: 'boolean',
            maxConsecutiveHours: 'number',
            minBreakBetweenClasses: 'number'
        },
        updatedAt: 'datetime'
    },

    ScheduleRecommendation: {
        recommendationID: 'number',
        recommendationName: 'string',
        totalCredits: 'number',
        courses: [{
            course: 'Course',
            priority: 'number'
        }],
        schedule: {
            monday: ['CourseSlot'],
            tuesday: ['CourseSlot'],
            wednesday: ['CourseSlot'],
            thursday: ['CourseSlot'],
            friday: ['CourseSlot'],
            saturday: ['CourseSlot']
        },
        scoring: {
            totalScore: 'number',
            preferenceMatchRate: 'number',
            conflictCount: 'number',
            timeDistribution: 'number',
            campusDistribution: 'number'
        },
        metadata: {
            algorithm: 'string',
            generatedAt: 'datetime',
            isBookmarked: 'boolean',
            isApplied: 'boolean'
        }
    },

    CourseEnrollment: {
        enrollmentID: 'number',
        userID: 'number',
        course: 'Course',
        enrollmentType: 'string', // 'Enrolled', 'Waitlisted', 'Dropped'
        enrollmentDate: 'datetime',
        status: 'string',
        grade: 'string?'
    }
};

// =====================================
// ERROR CODES & RESPONSES
// =====================================

const ERROR_CODES = {
    // Authentication Errors (401)
    AUTH_INVALID_TOKEN: 'AUTH_001',
    AUTH_TOKEN_EXPIRED: 'AUTH_002',
    AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_003',

    // Validation Errors (400)
    VALIDATION_REQUIRED_FIELD: 'VAL_001',
    VALIDATION_INVALID_FORMAT: 'VAL_002',
    VALIDATION_OUT_OF_RANGE: 'VAL_003',

    // Business Logic Errors (422)
    COURSE_NOT_AVAILABLE: 'BIZ_001',
    SCHEDULE_CONFLICT: 'BIZ_002',
    ENROLLMENT_FULL: 'BIZ_003',
    CREDIT_LIMIT_EXCEEDED: 'BIZ_004',

    // System Errors (500)
    DATABASE_CONNECTION_ERROR: 'SYS_001',
    EXTERNAL_SERVICE_ERROR: 'SYS_002'
};

const STANDARD_RESPONSES = {
    success: {
        success: true,
        data: 'any',
        message: 'string?',
        timestamp: 'datetime'
    },

    error: {
        success: false,
        error: {
            code: 'string',
            message: 'string',
            details: 'any?',
            timestamp: 'datetime'
        }
    },

    validation: {
        success: false,
        error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            fields: [{
                field: 'string',
                code: 'string',
                message: 'string'
            }]
        }
    }
};

module.exports = {
    API_ENDPOINTS,
    DATA_MODELS,
    ERROR_CODES,
    STANDARD_RESPONSES
};
