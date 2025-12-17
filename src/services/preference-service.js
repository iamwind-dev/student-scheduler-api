/**
 * PREFERENCE SERVICE v2.0
 * Professional user preference management and validation
 */

const { DatabaseService } = require('./database-service');
const { SystemLogger } = require('../utils/logger');

class PreferenceService {
    constructor() {
        this.db = new DatabaseService();
        this.logger = new SystemLogger();
    }

    /**
     * Get user preferences with defaults
     */
    async getUserPreferences(userID, semesterCode) {
        try {
            let preferences = await this.db.getUserPreferences(userID, semesterCode);

            if (!preferences) {
                // Return default preferences
                preferences = this.getDefaultPreferences(userID, semesterCode);
            } else {
                // Ensure all fields are present with defaults
                preferences = this.normalizePreferences(preferences);
            }

            return preferences;

        } catch (error) {
            await this.logger.logError('GET_USER_PREFERENCES_FAILED', error.message, { userID, semesterCode });
            throw error;
        }
    }

    /**
     * Create new user preferences
     */
    async createUserPreferences(preferenceData) {
        try {
            // Check if preferences already exist
            const existing = await this.db.getUserPreferences(
                preferenceData.userID,
                preferenceData.semesterCode
            );

            if (existing) {
                throw new Error('Preferences already exist for this semester');
            }

            // Validate preference data
            const validationResult = this.validatePreferenceData(preferenceData);
            if (!validationResult.isValid) {
                throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Normalize and create preferences
            const normalizedData = this.normalizePreferences(preferenceData);
            const preferences = await this.db.createUserPreferences(normalizedData);

            // Log creation
            await this.logger.logUserAction(preferenceData.userID, 'PREFERENCES_CREATED', {
                semesterCode: preferenceData.semesterCode
            });

            return preferences;

        } catch (error) {
            await this.logger.logError('CREATE_PREFERENCES_FAILED', error.message, {
                userID: preferenceData.userID
            });
            throw error;
        }
    }

    /**
     * Update existing preferences
     */
    async updateUserPreferences(preferenceID, userID, updateData) {
        try {
            // Check if preferences exist and belong to user
            const existing = await this.db.getPreferencesByID(preferenceID);

            if (!existing) {
                throw new Error('Preferences not found');
            }

            if (existing.userID !== userID) {
                throw new Error('Not authorized to update these preferences');
            }

            // Validate update data
            const validationResult = this.validatePreferenceData(updateData, true);
            if (!validationResult.isValid) {
                throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Merge with existing data
            const mergedData = {
                ...existing,
                ...updateData,
                preferenceID,
                updatedAt: new Date()
            };

            const normalizedData = this.normalizePreferences(mergedData);
            const updatedPreferences = await this.db.updateUserPreferences(preferenceID, normalizedData);

            // Log update
            await this.logger.logUserAction(userID, 'PREFERENCES_UPDATED', {
                preferenceID,
                updatedFields: Object.keys(updateData)
            });

            return updatedPreferences;

        } catch (error) {
            await this.logger.logError('UPDATE_PREFERENCES_FAILED', error.message, {
                preferenceID, userID
            });
            throw error;
        }
    }

    /**
     * Delete user preferences
     */
    async deleteUserPreferences(preferenceID, userID) {
        try {
            // Check if preferences exist and belong to user
            const existing = await this.db.getPreferencesByID(preferenceID);

            if (!existing) {
                throw new Error('Preferences not found');
            }

            if (existing.userID !== userID) {
                throw new Error('Not authorized to delete these preferences');
            }

            // Delete preferences
            const result = await this.db.deleteUserPreferences(preferenceID);

            // Log deletion
            await this.logger.logUserAction(userID, 'PREFERENCES_DELETED', {
                preferenceID,
                semesterCode: existing.semesterCode
            });

            return { success: true, deleted: true };

        } catch (error) {
            await this.logger.logError('DELETE_PREFERENCES_FAILED', error.message, {
                preferenceID, userID
            });
            throw error;
        }
    }

    /**
     * Get preference templates for quick setup
     */
    async getPreferenceTemplates() {
        try {
            const templates = [
                {
                    id: 'morning_person',
                    name: 'Morning Person',
                    description: 'Prefers morning classes, avoids evening sessions',
                    preferences: {
                        timePreferences: {
                            avoidMorning: false,
                            avoidEvening: true,
                            preferredSlots: [1, 2, 3], // Morning slots
                            blockedSlots: [7, 8, 9], // Evening slots
                        },
                        credits: { min: 12, max: 18, preferred: 15 },
                        advancedSettings: {
                            maxConsecutiveHours: 3,
                            minBreakBetweenClasses: 15
                        }
                    }
                },
                {
                    id: 'night_owl',
                    name: 'Night Owl',
                    description: 'Prefers afternoon/evening classes, avoids early morning',
                    preferences: {
                        timePreferences: {
                            avoidMorning: true,
                            avoidEvening: false,
                            preferredSlots: [5, 6, 7, 8], // Afternoon/Evening
                            blockedSlots: [1, 2], // Early morning
                        },
                        credits: { min: 12, max: 18, preferred: 15 },
                        advancedSettings: {
                            maxConsecutiveHours: 4,
                            minBreakBetweenClasses: 30
                        }
                    }
                },
                {
                    id: 'compact_schedule',
                    name: 'Compact Schedule',
                    description: 'Prefers classes concentrated on fewer days',
                    preferences: {
                        timePreferences: {
                            preferredDays: [2, 4], // Tuesday, Thursday
                            restDays: [1, 3, 5], // Monday, Wednesday, Friday
                        },
                        credits: { min: 12, max: 18, preferred: 15 },
                        advancedSettings: {
                            maxConsecutiveHours: 6,
                            minBreakBetweenClasses: 15
                        }
                    }
                },
                {
                    id: 'balanced',
                    name: 'Balanced Schedule',
                    description: 'Even distribution throughout the week',
                    preferences: {
                        timePreferences: {
                            avoidMorning: false,
                            avoidEvening: false,
                            preferredSlots: [3, 4, 5], // Mid-day
                        },
                        credits: { min: 12, max: 18, preferred: 15 },
                        advancedSettings: {
                            maxConsecutiveHours: 3,
                            minBreakBetweenClasses: 30
                        }
                    }
                }
            ];

            return templates;

        } catch (error) {
            await this.logger.logError('GET_PREFERENCE_TEMPLATES_FAILED', error.message);
            throw error;
        }
    }

    /**
     * Copy preferences from one semester to another
     */
    async copyUserPreferences(userID, sourceSemesterCode, targetSemesterCode, overwrite = false) {
        try {
            // Get source preferences
            const sourcePreferences = await this.db.getUserPreferences(userID, sourceSemesterCode);

            if (!sourcePreferences) {
                throw new Error('Source preferences not found');
            }

            // Check if target preferences already exist
            const targetExists = await this.db.getUserPreferences(userID, targetSemesterCode);

            if (targetExists && !overwrite) {
                throw new Error('Target preferences already exist');
            }

            // Prepare new preference data
            const newPreferenceData = {
                ...sourcePreferences,
                semesterCode: targetSemesterCode,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Remove ID fields
            delete newPreferenceData.preferenceID;

            let copiedPreferences;

            if (targetExists && overwrite) {
                // Update existing preferences
                copiedPreferences = await this.updateUserPreferences(
                    targetExists.preferenceID,
                    userID,
                    newPreferenceData
                );
            } else {
                // Create new preferences
                copiedPreferences = await this.createUserPreferences(newPreferenceData);
            }

            // Log copy operation
            await this.logger.logUserAction(userID, 'PREFERENCES_COPIED', {
                sourceSemesterCode,
                targetSemesterCode,
                overwrite
            });

            return copiedPreferences;

        } catch (error) {
            await this.logger.logError('COPY_PREFERENCES_FAILED', error.message, {
                userID, sourceSemesterCode, targetSemesterCode
            });
            throw error;
        }
    }

    /**
     * Validate user preferences against available courses
     */
    async validateUserPreferences(userID, semesterCode) {
        try {
            const preferences = await this.getUserPreferences(userID, semesterCode);
            const availableCourses = await this.db.getCourses(
                { semesterCode },
                { page: 1, limit: 1000 }
            );

            const validation = {
                isValid: true,
                warnings: [],
                errors: [],
                suggestions: [],
                availableOptions: {
                    campuses: [],
                    timeSlots: [],
                    subjects: []
                }
            };

            // Check campus preferences
            const availableCampuses = [...new Set(
                availableCourses.courses.map(c => c.schedule?.room?.campus?.campusCode).filter(Boolean)
            )];

            const invalidPreferredCampuses = preferences.campuses.preferred.filter(
                campus => !availableCampuses.includes(campus)
            );

            if (invalidPreferredCampuses.length > 0) {
                validation.warnings.push({
                    type: 'campus',
                    message: `Preferred campuses not available: ${invalidPreferredCampuses.join(', ')}`
                });
            }

            // Check time slot preferences
            const availableTimeSlots = [...new Set(
                availableCourses.courses.map(c => c.schedule?.timeSlot?.timeSlotID).filter(Boolean)
            )];

            const invalidPreferredSlots = preferences.timePreferences.preferredSlots.filter(
                slot => !availableTimeSlots.includes(slot)
            );

            if (invalidPreferredSlots.length > 0) {
                validation.warnings.push({
                    type: 'timeSlot',
                    message: `Some preferred time slots are not available`
                });
            }

            // Check credit requirements
            const availableCredits = availableCourses.courses.reduce(
                (sum, course) => sum + (course.subject?.credits || 0), 0
            );

            if (availableCredits < preferences.credits.min) {
                validation.errors.push({
                    type: 'credits',
                    message: 'Not enough courses available to meet minimum credit requirement'
                });
                validation.isValid = false;
            }

            // Generate suggestions
            if (preferences.campuses.preferred.length === 0) {
                validation.suggestions.push({
                    type: 'campus',
                    message: 'Consider setting preferred campuses to optimize your schedule'
                });
            }

            if (preferences.timePreferences.preferredSlots.length === 0) {
                validation.suggestions.push({
                    type: 'timeSlot',
                    message: 'Setting preferred time slots can improve schedule recommendations'
                });
            }

            // Set available options
            validation.availableOptions = {
                campuses: availableCampuses,
                timeSlots: availableTimeSlots,
                totalCourses: availableCourses.courses.length
            };

            return validation;

        } catch (error) {
            await this.logger.logError('VALIDATE_PREFERENCES_FAILED', error.message, { userID, semesterCode });
            throw error;
        }
    }

    /**
     * Get user preference change history
     */
    async getUserPreferenceHistory(userID, semesterCode = null, pagination = { page: 1, limit: 20 }) {
        try {
            const history = await this.db.getUserPreferenceHistory(userID, semesterCode, pagination);

            return history;

        } catch (error) {
            await this.logger.logError('GET_PREFERENCE_HISTORY_FAILED', error.message, { userID });
            throw error;
        }
    }

    /**
     * Import preferences from external format
     */
    async importUserPreferences(userID, semesterCode, preferenceData, format = 'json') {
        try {
            let parsedData;

            switch (format.toLowerCase()) {
                case 'json':
                    parsedData = typeof preferenceData === 'string'
                        ? JSON.parse(preferenceData)
                        : preferenceData;
                    break;

                case 'csv':
                    parsedData = this.parseCSVPreferences(preferenceData);
                    break;

                default:
                    throw new Error('Unsupported import format');
            }

            // Add user and semester info
            parsedData.userID = userID;
            parsedData.semesterCode = semesterCode;

            // Create preferences
            const importedPreferences = await this.createUserPreferences(parsedData);

            // Log import
            await this.logger.logUserAction(userID, 'PREFERENCES_IMPORTED', {
                format,
                semesterCode
            });

            return {
                success: true,
                preferences: importedPreferences,
                format
            };

        } catch (error) {
            await this.logger.logError('IMPORT_PREFERENCES_FAILED', error.message, { userID, format });
            throw error;
        }
    }

    // Helper Methods

    /**
     * Get default preferences template
     */
    getDefaultPreferences(userID, semesterCode) {
        return {
            userID,
            semesterCode: semesterCode || 'current',
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
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Normalize preferences to ensure all fields are present
     */
    normalizePreferences(preferences) {
        const defaults = this.getDefaultPreferences(preferences.userID, preferences.semesterCode);

        return {
            ...defaults,
            ...preferences,
            credits: { ...defaults.credits, ...preferences.credits },
            campuses: { ...defaults.campuses, ...preferences.campuses },
            timePreferences: { ...defaults.timePreferences, ...preferences.timePreferences },
            subjectPreferences: { ...defaults.subjectPreferences, ...preferences.subjectPreferences },
            advancedSettings: { ...defaults.advancedSettings, ...preferences.advancedSettings }
        };
    }

    /**
     * Validate preference data
     */
    validatePreferenceData(data, isUpdate = false) {
        const errors = [];

        // Required fields for creation
        if (!isUpdate) {
            if (!data.userID) errors.push('User ID is required');
            if (!data.semesterCode) errors.push('Semester code is required');
        }

        // Credit validation
        if (data.credits) {
            if (data.credits.min && (data.credits.min < 0 || data.credits.min > 30)) {
                errors.push('Minimum credits must be between 0 and 30');
            }

            if (data.credits.max && (data.credits.max < 0 || data.credits.max > 30)) {
                errors.push('Maximum credits must be between 0 and 30');
            }

            if (data.credits.min && data.credits.max && data.credits.min > data.credits.max) {
                errors.push('Minimum credits cannot exceed maximum credits');
            }
        }

        // Advanced settings validation
        if (data.advancedSettings) {
            if (data.advancedSettings.maxConsecutiveHours &&
                (data.advancedSettings.maxConsecutiveHours < 1 || data.advancedSettings.maxConsecutiveHours > 12)) {
                errors.push('Max consecutive hours must be between 1 and 12');
            }

            if (data.advancedSettings.minBreakBetweenClasses &&
                (data.advancedSettings.minBreakBetweenClasses < 0 || data.advancedSettings.minBreakBetweenClasses > 240)) {
                errors.push('Minimum break between classes must be between 0 and 240 minutes');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Parse CSV preferences (placeholder implementation)
     */
    parseCSVPreferences(csvData) {
        // This would contain actual CSV parsing logic
        throw new Error('CSV import not implemented yet');
    }
}

module.exports = { PreferenceService };
