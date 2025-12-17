/**
 * COURSE SERVICE v2.0
 * Professional course management and search functionality
 */

const { DatabaseService } = require('./database-service');
const { SystemLogger } = require('../utils/logger');

class CourseService {
    constructor() {
        this.db = new DatabaseService();
        this.logger = new SystemLogger();
    }

    /**
     * Get courses with advanced filtering and pagination
     */
    async getCourses(filters = {}, pagination = { page: 1, limit: 20 }) {
        try {
            const result = await this.db.getCourses(filters, pagination);

            // Enrich courses with additional data
            const enrichedCourses = await Promise.all(
                result.courses.map(async (course) => {
                    return await this.enrichCourseData(course);
                })
            );

            return {
                courses: enrichedCourses,
                pagination: result.pagination,
                filters: filters
            };

        } catch (error) {
            await this.logger.logError('GET_COURSES_FAILED', error.message, { filters });
            throw error;
        }
    }

    /**
     * Get detailed course information
     */
    async getCourseDetails(courseID) {
        try {
            const course = await this.db.getCourseDetails(courseID);

            if (!course) {
                return null;
            }

            // Enrich with additional details
            const enrichedCourse = await this.enrichCourseData(course);

            // Get enrollment statistics
            const enrollmentStats = await this.db.getCourseEnrollmentStats(courseID);

            // Get related courses (same subject)
            const relatedCourses = await this.db.getRelatedCourses(
                course.subject.subjectCode,
                course.semester.semesterCode,
                courseID
            );

            // Get course reviews/ratings (if available)
            const courseReviews = await this.db.getCourseReviews(courseID);

            return {
                ...enrichedCourse,
                enrollmentStats,
                relatedCourses: relatedCourses.slice(0, 5), // Limit to 5
                reviews: courseReviews,
                lastUpdated: new Date()
            };

        } catch (error) {
            await this.logger.logError('GET_COURSE_DETAILS_FAILED', error.message, { courseID });
            throw error;
        }
    }

    /**
     * Advanced course search with multiple criteria
     */
    async searchCourses(searchParams = {}, pagination = { page: 1, limit: 20 }) {
        try {
            const result = await this.db.searchCourses(searchParams, pagination);

            // Enrich search results
            const enrichedCourses = await Promise.all(
                result.courses.map(async (course) => {
                    const enriched = await this.enrichCourseData(course);

                    // Add relevance score for search results
                    enriched.relevanceScore = this.calculateRelevanceScore(course, searchParams);

                    return enriched;
                })
            );

            // Sort by relevance score
            enrichedCourses.sort((a, b) => b.relevanceScore - a.relevanceScore);

            return {
                courses: enrichedCourses,
                pagination: result.pagination,
                searchParams,
                totalFound: result.totalFound
            };

        } catch (error) {
            await this.logger.logError('SEARCH_COURSES_FAILED', error.message, { searchParams });
            throw error;
        }
    }

    /**
     * Get available semesters
     */
    async getAvailableSemesters() {
        try {
            const semesters = await this.db.getAvailableSemesters();

            return semesters.map(semester => ({
                ...semester,
                isActive: this.isSemesterActive(semester),
                registrationStatus: this.getSemesterRegistrationStatus(semester)
            }));

        } catch (error) {
            await this.logger.logError('GET_AVAILABLE_SEMESTERS_FAILED', error.message);
            throw error;
        }
    }

    /**
     * Get available subjects with optional filtering
     */
    async getAvailableSubjects(filters = {}) {
        try {
            const subjects = await this.db.getAvailableSubjects(filters);

            // Add course count for each subject
            const enrichedSubjects = await Promise.all(
                subjects.map(async (subject) => {
                    const courseCount = await this.db.getSubjectCourseCount(
                        subject.subjectCode,
                        filters.semesterCode
                    );

                    return {
                        ...subject,
                        courseCount,
                        hasPrerequisites: await this.db.hasSubjectPrerequisites(subject.subjectID)
                    };
                })
            );

            return enrichedSubjects;

        } catch (error) {
            await this.logger.logError('GET_AVAILABLE_SUBJECTS_FAILED', error.message, { filters });
            throw error;
        }
    }

    /**
     * Get available lecturers with optional filtering
     */
    async getAvailableLecturers(filters = {}) {
        try {
            const lecturers = await this.db.getAvailableLecturers(filters);

            // Add lecturer statistics
            const enrichedLecturers = await Promise.all(
                lecturers.map(async (lecturer) => {
                    const stats = await this.db.getLecturerStats(lecturer.lecturerID, filters.semesterCode);

                    return {
                        ...lecturer,
                        courseCount: stats.courseCount || 0,
                        averageRating: stats.averageRating || null,
                        totalStudents: stats.totalStudents || 0
                    };
                })
            );

            return enrichedLecturers;

        } catch (error) {
            await this.logger.logError('GET_AVAILABLE_LECTURERS_FAILED', error.message, { filters });
            throw error;
        }
    }

    /**
     * Get available campuses
     */
    async getAvailableCampuses() {
        try {
            const campuses = await this.db.getAvailableCampuses();

            // Add campus statistics
            const enrichedCampuses = await Promise.all(
                campuses.map(async (campus) => {
                    const courseCount = await this.db.getCampusCourseCount(campus.campusID);

                    return {
                        ...campus,
                        courseCount,
                        facilities: await this.db.getCampusFacilities(campus.campusID)
                    };
                })
            );

            return enrichedCampuses;

        } catch (error) {
            await this.logger.logError('GET_AVAILABLE_CAMPUSES_FAILED', error.message);
            throw error;
        }
    }

    /**
     * Check course conflicts for a user
     */
    async checkCourseConflicts(courseID, userID, semesterCode) {
        try {
            const targetCourse = await this.db.getCourseDetails(courseID);

            if (!targetCourse) {
                throw new Error('Course not found');
            }

            const userEnrollments = await this.db.getUserEnrollments(userID, semesterCode);
            const conflicts = [];

            for (const enrollment of userEnrollments) {
                if (enrollment.status !== 'Enrolled') continue;

                const enrolledCourse = await this.db.getCourseDetails(enrollment.courseID);

                // Check various types of conflicts
                const conflictChecks = [
                    this.checkTimeConflict(targetCourse, enrolledCourse),
                    this.checkSubjectConflict(targetCourse, enrolledCourse),
                    this.checkPrerequisiteConflict(targetCourse, userID)
                ];

                for (const conflict of conflictChecks) {
                    if (conflict) {
                        conflicts.push({
                            ...conflict,
                            conflictWith: enrolledCourse
                        });
                    }
                }
            }

            // Check enrollment capacity
            if (targetCourse.enrolledCount >= targetCourse.maxStudents) {
                conflicts.push({
                    type: 'capacity',
                    severity: 'warning',
                    message: 'Course is at full capacity, will be waitlisted',
                    canProceed: true
                });
            }

            return {
                hasConflicts: conflicts.length > 0,
                conflicts,
                canEnroll: !conflicts.some(c => c.severity === 'error')
            };

        } catch (error) {
            await this.logger.logError('CHECK_COURSE_CONFLICTS_FAILED', error.message, { courseID, userID });
            throw error;
        }
    }

    /**
     * Get course enrollment statistics (admin only)
     */
    async getCourseStatistics(filters = {}) {
        try {
            const stats = await this.db.getCourseStatistics(filters);

            return {
                overview: {
                    totalCourses: stats.totalCourses || 0,
                    totalEnrollments: stats.totalEnrollments || 0,
                    averageEnrollmentRate: stats.averageEnrollmentRate || 0,
                    fullCourses: stats.fullCourses || 0
                },
                bySubject: stats.subjectBreakdown || [],
                byCampus: stats.campusBreakdown || [],
                byTimeSlot: stats.timeSlotBreakdown || [],
                trends: stats.enrollmentTrends || []
            };

        } catch (error) {
            await this.logger.logError('GET_COURSE_STATISTICS_FAILED', error.message, { filters });
            throw error;
        }
    }

    // Helper Methods

    /**
     * Enrich course data with additional information
     */
    async enrichCourseData(course) {
        try {
            // Calculate enrollment percentage
            const enrollmentPercentage = course.maxStudents > 0
                ? Math.round((course.enrolledCount / course.maxStudents) * 100)
                : 0;

            // Determine enrollment status
            let enrollmentStatus = 'available';
            if (course.enrolledCount >= course.maxStudents) {
                enrollmentStatus = 'full';
            } else if (enrollmentPercentage >= 80) {
                enrollmentStatus = 'almost_full';
            }

            // Add convenience fields
            return {
                ...course,
                enrollmentPercentage,
                enrollmentStatus,
                availableSpots: Math.max(0, course.maxStudents - course.enrolledCount),
                timeSlotFormatted: this.formatTimeSlot(course.schedule?.timeSlot),
                scheduleDescription: this.formatScheduleDescription(course.schedule)
            };

        } catch (error) {
            return course; // Return original if enrichment fails
        }
    }

    /**
     * Calculate relevance score for search results
     */
    calculateRelevanceScore(course, searchParams) {
        let score = 0;

        // Title/code match
        if (searchParams.query) {
            const query = searchParams.query.toLowerCase();
            const courseText = `${course.courseCode} ${course.subject.subjectName}`.toLowerCase();

            if (courseText.includes(query)) {
                score += 10;

                // Exact match bonus
                if (course.courseCode.toLowerCase() === query) {
                    score += 20;
                }
            }
        }

        // Credits match
        if (searchParams.credits && course.subject.credits === searchParams.credits) {
            score += 5;
        }

        // Lecturer match
        if (searchParams.lecturer &&
            course.lecturer.lecturerName.toLowerCase().includes(searchParams.lecturer.toLowerCase())) {
            score += 8;
        }

        // Time slot preference
        if (searchParams.timeSlot &&
            course.schedule?.timeSlot?.timeDescription?.includes(searchParams.timeSlot)) {
            score += 3;
        }

        return score;
    }

    /**
     * Check for time conflicts between courses
     */
    checkTimeConflict(course1, course2) {
        if (!course1.schedule?.timeSlot || !course2.schedule?.timeSlot) {
            return null;
        }

        // Check same day
        if (course1.schedule.timeSlot.dayNumber !== course2.schedule.timeSlot.dayNumber) {
            return null;
        }

        // Check time overlap
        const start1 = this.parseTime(course1.schedule.timeSlot.startTime);
        const end1 = this.parseTime(course1.schedule.timeSlot.endTime);
        const start2 = this.parseTime(course2.schedule.timeSlot.startTime);
        const end2 = this.parseTime(course2.schedule.timeSlot.endTime);

        if (start1 < end2 && start2 < end1) {
            return {
                type: 'time',
                severity: 'error',
                message: 'Time slot conflict detected',
                canProceed: false
            };
        }

        return null;
    }

    /**
     * Check for subject conflicts (e.g., duplicate subjects)
     */
    checkSubjectConflict(course1, course2) {
        if (course1.subject.subjectCode === course2.subject.subjectCode) {
            return {
                type: 'subject',
                severity: 'warning',
                message: 'Already enrolled in this subject',
                canProceed: false
            };
        }

        return null;
    }

    /**
     * Check prerequisite requirements
     */
    async checkPrerequisiteConflict(course, userID) {
        try {
            const prerequisites = await this.db.getCoursePrerequisites(course.courseID);

            if (prerequisites.length === 0) {
                return null;
            }

            const userCompletedCourses = await this.db.getUserCompletedCourses(userID);
            const completedSubjects = userCompletedCourses.map(c => c.subjectCode);

            const missingPrerequisites = prerequisites.filter(
                prereq => !completedSubjects.includes(prereq.subjectCode)
            );

            if (missingPrerequisites.length > 0) {
                return {
                    type: 'prerequisite',
                    severity: 'error',
                    message: `Missing prerequisites: ${missingPrerequisites.map(p => p.subjectCode).join(', ')}`,
                    canProceed: false,
                    missing: missingPrerequisites
                };
            }

            return null;

        } catch (error) {
            return null; // Don't block enrollment due to prerequisite check failure
        }
    }

    /**
     * Parse time string to minutes
     */
    parseTime(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Format time slot for display
     */
    formatTimeSlot(timeSlot) {
        if (!timeSlot) return 'TBA';

        return `${timeSlot.dayOfWeek} ${timeSlot.startTime}-${timeSlot.endTime}`;
    }

    /**
     * Format schedule description
     */
    formatScheduleDescription(schedule) {
        if (!schedule) return 'Schedule TBA';

        const { timeSlot, room } = schedule;

        let description = `${timeSlot?.dayOfWeek || 'TBA'} ${timeSlot?.startTime || ''}-${timeSlot?.endTime || ''}`;

        if (room) {
            description += ` at ${room.roomCode}`;

            if (room.campus) {
                description += ` (${room.campus.campusCode})`;
            }
        }

        return description;
    }

    /**
     * Check if semester is currently active
     */
    isSemesterActive(semester) {
        const now = new Date();
        return semester.startDate <= now && now <= semester.endDate;
    }

    /**
     * Get semester registration status
     */
    getSemesterRegistrationStatus(semester) {
        const now = new Date();

        if (now < semester.registrationStartDate) {
            return 'not_open';
        } else if (now >= semester.registrationStartDate && now <= semester.registrationEndDate) {
            return 'open';
        } else {
            return 'closed';
        }
    }
}

module.exports = { CourseService };
