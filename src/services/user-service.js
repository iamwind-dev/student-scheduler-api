/**
 * USER SERVICE v2.0
 * Professional user management business logic
 */

const { DatabaseService } = require('./database-service');
const { SystemLogger } = require('../utils/logger');

class UserService {
    constructor() {
        this.db = new DatabaseService();
        this.logger = new SystemLogger();
    }

    /**
     * Get complete user details with role and statistics
     */
    async getUserDetails(userID) {
        try {
            const user = await this.db.getUserById(userID);

            if (!user) {
                throw new Error('User not found');
            }

            // Get user statistics
            const statistics = await this.getUserStatistics(userID);

            // Get current semester enrollments
            const currentEnrollments = await this.db.getUserEnrollments(userID);

            return {
                profile: this.formatUserProfile(user),
                statistics,
                currentEnrollments: currentEnrollments.length,
                lastActivity: user.lastLoginAt
            };

        } catch (error) {
            await this.logger.logError('GET_USER_DETAILS_FAILED', error.message, { userID });
            throw error;
        }
    }

    /**
     * Update user profile information
     */
    async updateUserProfile(userID, updateData) {
        try {
            // Validate update data
            const allowedFields = [
                'fullName', 'firstName', 'lastName', 'studentCode',
                'department', 'faculty', 'yearOfStudy', 'avatar'
            ];

            const filteredData = {};
            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredData[key] = updateData[key];
                }
            });

            if (Object.keys(filteredData).length === 0) {
                throw new Error('No valid fields to update');
            }

            // Update user in database
            const updatedUser = await this.db.updateUser(userID, filteredData);

            // Log the update
            await this.logger.logUserAction(userID, 'PROFILE_UPDATED', {
                updatedFields: Object.keys(filteredData)
            });

            return this.formatUserProfile(updatedUser);

        } catch (error) {
            await this.logger.logError('UPDATE_PROFILE_FAILED', error.message, { userID });
            throw error;
        }
    }

    /**
     * Get user course enrollments with details
     */
    async getUserEnrollments(userID, semesterCode = null) {
        try {
            const enrollments = await this.db.getUserEnrollments(userID, semesterCode);

            // Enrich with course details
            const enrichedEnrollments = await Promise.all(
                enrollments.map(async (enrollment) => {
                    const courseDetails = await this.db.getCourseDetails(enrollment.courseID);
                    return {
                        ...enrollment,
                        course: courseDetails
                    };
                })
            );

            return enrichedEnrollments;

        } catch (error) {
            await this.logger.logError('GET_USER_ENROLLMENTS_FAILED', error.message, { userID });
            throw error;
        }
    }

    /**
     * Enroll user in a course with validation
     */
    async enrollInCourse(userID, courseID, enrollmentType = 'Enrolled') {
        try {
            // Check if course exists and is available
            const course = await this.db.getCourseDetails(courseID);

            if (!course) {
                throw new Error('Course not found');
            }

            if (course.status !== 'Active') {
                throw new Error('Course not available for enrollment');
            }

            // Check if user is already enrolled
            const existingEnrollment = await this.db.getUserCourseEnrollment(userID, courseID);

            if (existingEnrollment && existingEnrollment.status === 'Enrolled') {
                throw new Error('Already enrolled in this course');
            }

            // Check for schedule conflicts
            const conflicts = await this.checkScheduleConflicts(userID, courseID, course.semesterCode);

            if (conflicts.length > 0) {
                throw new Error('Schedule conflict with existing enrollment');
            }

            // Check enrollment capacity
            if (enrollmentType === 'Enrolled' && course.enrolledCount >= course.maxStudents) {
                // Try to waitlist instead
                enrollmentType = 'Waitlisted';
            }

            // Check credit limits
            const currentCredits = await this.getUserSemesterCredits(userID, course.semesterCode);
            const userPreferences = await this.db.getUserPreferences(userID, course.semesterCode);

            if (userPreferences && currentCredits + course.credits > userPreferences.maxCredits) {
                throw new Error('Credit limit exceeded');
            }

            // Create enrollment
            const enrollmentData = {
                userID,
                courseID,
                enrollmentType,
                enrollmentDate: new Date(),
                status: 'Active'
            };

            const enrollment = await this.db.createEnrollment(enrollmentData);

            // Update course enrollment count
            await this.db.updateCourseEnrollmentCount(courseID);

            // Log enrollment
            await this.logger.logUserAction(userID, 'COURSE_ENROLLED', {
                courseID,
                enrollmentType,
                courseCode: course.courseCode
            });

            return {
                ...enrollment,
                course
            };

        } catch (error) {
            await this.logger.logError('COURSE_ENROLLMENT_FAILED', error.message, { userID, courseID });
            throw error;
        }
    }

    /**
     * Drop a course enrollment
     */
    async dropEnrollment(userID, enrollmentID) {
        try {
            // Get enrollment details
            const enrollment = await this.db.getEnrollmentDetails(enrollmentID);

            if (!enrollment) {
                throw new Error('Enrollment not found');
            }

            if (enrollment.userID !== userID) {
                throw new Error('Not authorized to drop this enrollment');
            }

            if (enrollment.status === 'Dropped') {
                throw new Error('Enrollment already dropped');
            }

            // Check if dropping is allowed (business rules)
            const canDrop = await this.canDropEnrollment(enrollment);

            if (!canDrop.allowed) {
                throw new Error(`Cannot drop: ${canDrop.reason}`);
            }

            // Update enrollment status
            const updatedEnrollment = await this.db.updateEnrollment(enrollmentID, {
                status: 'Dropped',
                dropDate: new Date()
            });

            // Update course enrollment count
            await this.db.updateCourseEnrollmentCount(enrollment.courseID);

            // Promote waitlisted student if applicable
            await this.promoteFromWaitlist(enrollment.courseID);

            // Log the drop
            await this.logger.logUserAction(userID, 'COURSE_DROPPED', {
                enrollmentID,
                courseID: enrollment.courseID
            });

            return updatedEnrollment;

        } catch (error) {
            await this.logger.logError('DROP_ENROLLMENT_FAILED', error.message, { userID, enrollmentID });
            throw error;
        }
    }

    /**
     * Get user preferences for scheduling
     */
    async getUserPreferences(userID, semesterCode = null) {
        try {
            const preferences = await this.db.getUserPreferences(userID, semesterCode);

            if (!preferences) {
                // Return default preferences
                return this.getDefaultPreferences(userID, semesterCode);
            }

            return preferences;

        } catch (error) {
            await this.logger.logError('GET_USER_PREFERENCES_FAILED', error.message, { userID });
            throw error;
        }
    }

    /**
     * Get user academic statistics
     */
    async getUserStatistics(userID) {
        try {
            const stats = await this.db.getUserStatistics(userID);

            return {
                totalEnrollments: stats.totalEnrollments || 0,
                completedCourses: stats.completedCourses || 0,
                totalCredits: stats.totalCredits || 0,
                currentSemesterCredits: stats.currentSemesterCredits || 0,
                averageGrade: stats.averageGrade || null,
                preferredCampus: stats.mostUsedCampus || null,
                preferredTimeSlots: stats.preferredTimeSlots || [],
                enrollmentHistory: stats.semesterHistory || []
            };

        } catch (error) {
            await this.logger.logError('GET_USER_STATISTICS_FAILED', error.message, { userID });
            throw error;
        }
    }

    /**
     * Update user avatar
     */
    async updateUserAvatar(userID, avatarUrl) {
        try {
            const updatedUser = await this.db.updateUser(userID, { avatar: avatarUrl });

            await this.logger.logUserAction(userID, 'AVATAR_UPDATED', { avatarUrl });

            return avatarUrl;

        } catch (error) {
            await this.logger.logError('UPDATE_AVATAR_FAILED', error.message, { userID });
            throw error;
        }
    }

    // Helper Methods

    /**
     * Check for schedule conflicts
     */
    async checkScheduleConflicts(userID, courseID, semesterCode) {
        try {
            const newCourse = await this.db.getCourseDetails(courseID);
            const userEnrollments = await this.db.getUserEnrollments(userID, semesterCode);

            const conflicts = [];

            for (const enrollment of userEnrollments) {
                if (enrollment.status !== 'Enrolled') continue;

                const enrolledCourse = await this.db.getCourseDetails(enrollment.courseID);

                // Check time slot conflicts
                if (this.hasTimeConflict(newCourse.schedule, enrolledCourse.schedule)) {
                    conflicts.push({
                        conflictType: 'time',
                        conflictWith: enrolledCourse,
                        details: 'Time slot overlap detected'
                    });
                }
            }

            return conflicts;

        } catch (error) {
            await this.logger.logError('CHECK_SCHEDULE_CONFLICTS_FAILED', error.message, { userID, courseID });
            return [];
        }
    }

    /**
     * Check if two schedules have time conflicts
     */
    hasTimeConflict(schedule1, schedule2) {
        // Check if same day of week
        if (schedule1.timeSlot.dayNumber !== schedule2.timeSlot.dayNumber) {
            return false;
        }

        // Check time overlap
        const start1 = this.parseTime(schedule1.timeSlot.startTime);
        const end1 = this.parseTime(schedule1.timeSlot.endTime);
        const start2 = this.parseTime(schedule2.timeSlot.startTime);
        const end2 = this.parseTime(schedule2.timeSlot.endTime);

        return (start1 < end2 && start2 < end1);
    }

    /**
     * Parse time string to minutes
     */
    parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Get user's current semester credits
     */
    async getUserSemesterCredits(userID, semesterCode) {
        try {
            const enrollments = await this.db.getUserEnrollments(userID, semesterCode);
            let totalCredits = 0;

            for (const enrollment of enrollments) {
                if (enrollment.status === 'Enrolled') {
                    const course = await this.db.getCourseDetails(enrollment.courseID);
                    totalCredits += course.credits || 0;
                }
            }

            return totalCredits;

        } catch (error) {
            return 0;
        }
    }

    /**
     * Check if enrollment can be dropped
     */
    async canDropEnrollment(enrollment) {
        // Business rules for dropping courses
        const dropDeadline = new Date(); // This would be configured per semester
        dropDeadline.setDate(dropDeadline.getDate() - 30); // 30 days ago as example

        if (enrollment.enrollmentDate < dropDeadline) {
            return {
                allowed: false,
                reason: 'Drop deadline has passed'
            };
        }

        return { allowed: true };
    }

    /**
     * Promote student from waitlist
     */
    async promoteFromWaitlist(courseID) {
        try {
            const waitlistedStudents = await this.db.getWaitlistedStudents(courseID);

            if (waitlistedStudents.length > 0) {
                const course = await this.db.getCourseDetails(courseID);

                if (course.enrolledCount < course.maxStudents) {
                    // Promote the first waitlisted student
                    const firstWaitlisted = waitlistedStudents[0];

                    await this.db.updateEnrollment(firstWaitlisted.enrollmentID, {
                        enrollmentType: 'Enrolled',
                        promotedDate: new Date()
                    });

                    await this.logger.logUserAction(firstWaitlisted.userID, 'PROMOTED_FROM_WAITLIST', {
                        courseID,
                        enrollmentID: firstWaitlisted.enrollmentID
                    });
                }
            }

        } catch (error) {
            await this.logger.logError('PROMOTE_FROM_WAITLIST_FAILED', error.message, { courseID });
        }
    }

    /**
     * Get default preferences template
     */
    getDefaultPreferences(userID, semesterCode) {
        return {
            userID,
            semesterCode,
            credits: {
                min: 12,
                max: 18,
                preferred: 15
            },
            campuses: {
                preferred: [],
                blocked: []
            },
            timePreferences: {
                avoidMorning: false,
                avoidEvening: false,
                preferredSlots: [],
                blockedSlots: [],
                preferredDays: [],
                restDays: []
            },
            subjectPreferences: {
                preferred: [],
                blocked: []
            },
            advancedSettings: {
                allowOnlineClasses: true,
                maxConsecutiveHours: 4,
                minBreakBetweenClasses: 30
            }
        };
    }

    /**
     * Format user profile for API response
     */
    formatUserProfile(user) {
        return {
            userID: user.userID,
            email: user.email,
            studentCode: user.studentCode,
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
            department: user.department,
            faculty: user.faculty,
            yearOfStudy: user.yearOfStudy,
            role: {
                roleID: user.roleID,
                roleName: user.roleName
            },
            isActive: user.isActive,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
        };
    }
}

module.exports = { UserService };
