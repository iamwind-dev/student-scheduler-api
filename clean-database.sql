-- ========================================
-- Clean database: Remove all tables
-- Run this FIRST if you want to start fresh
-- ========================================

-- Drop tables in correct order (child tables first)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ScheduleDetails')
BEGIN
    DROP TABLE ScheduleDetails;
    PRINT 'Dropped ScheduleDetails table';
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Schedules')
BEGIN
    DROP TABLE Schedules;
    PRINT 'Dropped Schedules table';
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Courses')
BEGIN
    DROP TABLE Courses;
    PRINT 'Dropped Courses table';
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    DROP TABLE Users;
    PRINT 'Dropped Users table';
END

PRINT 'All tables removed successfully!';
PRINT 'Now you can run setup-user-db.sql to create fresh tables';
