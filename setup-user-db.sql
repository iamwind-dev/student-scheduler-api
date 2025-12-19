-- ========================================
-- Setup script for user-db database
-- Azure SQL Database
-- ========================================

-- Drop existing tables if needed (uncomment if you want to recreate)
-- DROP TABLE IF EXISTS ScheduleDetails;
-- DROP TABLE IF EXISTS Schedules;
-- DROP TABLE IF EXISTS Users;
-- DROP TABLE IF EXISTS Courses;

-- ========================================
-- Table: Users
-- ========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        UserId INT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        Name NVARCHAR(255) NULL,
        StudentId NVARCHAR(50) NULL,
        Password NVARCHAR(255) NULL,
        Role NVARCHAR(50) DEFAULT 'student',
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
    PRINT 'Created Users table';
END
ELSE
BEGIN
    PRINT 'Users table already exists';
    
    -- Add StudentId column if not exists
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'StudentId')
    BEGIN
        ALTER TABLE Users ADD StudentId NVARCHAR(50) NULL;
        PRINT 'Added StudentId column to Users';
    END
    
    -- Add Password column if not exists
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Password')
    BEGIN
        ALTER TABLE Users ADD Password NVARCHAR(255) NULL;
        PRINT 'Added Password column to Users';
    END
    
    -- Add Role column if not exists
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Role')
    BEGIN
        ALTER TABLE Users ADD Role NVARCHAR(50) DEFAULT 'student';
        PRINT 'Added Role column to Users';
    END
END
GO

-- ========================================
-- Table: Courses
-- ========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Courses')
BEGIN
    CREATE TABLE Courses (
        CourseId INT IDENTITY(1,1) PRIMARY KEY,
        CourseName NVARCHAR(255) NOT NULL,
        CourseCode NVARCHAR(50) NOT NULL,
        Credits INT NOT NULL,
        Lecturer NVARCHAR(255) NULL,
        Time NVARCHAR(100) NULL,
        Room NVARCHAR(50) NULL,
        Weeks NVARCHAR(100) NULL,
        Quantity INT NULL,
        CreatedAt DATETIME DEFAULT GETDATE()
    );
    PRINT 'Created Courses table';
END
ELSE
BEGIN
    PRINT 'Courses table already exists';
END
GO

-- ========================================
-- Table: Schedules
-- ========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Schedules')
BEGIN
    CREATE TABLE Schedules (
        ScheduleId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        ScheduleName NVARCHAR(255) NULL,
        TotalCredits INT DEFAULT 0,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE
    );
    PRINT 'Created Schedules table';
END
ELSE
BEGIN
    PRINT 'Schedules table already exists';
END
GO

-- ========================================
-- Table: ScheduleDetails
-- ========================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ScheduleDetails')
BEGIN
    CREATE TABLE ScheduleDetails (
        DetailId INT IDENTITY(1,1) PRIMARY KEY,
        ScheduleId INT NOT NULL,
        CourseId INT NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (ScheduleId) REFERENCES Schedules(ScheduleId) ON DELETE CASCADE,
        FOREIGN KEY (CourseId) REFERENCES Courses(CourseId) ON DELETE CASCADE
    );
    PRINT 'Created ScheduleDetails table';
END
ELSE
BEGIN
    PRINT 'ScheduleDetails table already exists';
END
GO

-- ========================================
-- Verify table structure
-- ========================================
SELECT TableName, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM (
    SELECT 'Users' AS TableName, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Users'
    UNION ALL
    SELECT 'Courses' AS TableName, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Courses'
    UNION ALL
    SELECT 'Schedules' AS TableName, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Schedules'
    UNION ALL
    SELECT 'ScheduleDetails' AS TableName, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'ScheduleDetails'
) AS AllColumns
ORDER BY TableName, ORDINAL_POSITION;

-- ========================================
-- Insert sample data (optional)
-- ========================================
-- Sample user (password is '123456' encoded in base64: MTIzNDU2)
IF NOT EXISTS (SELECT * FROM Users WHERE Email = 'demo@example.com')
BEGIN
    INSERT INTO Users (Email, Name, StudentId, Password, Role)
    VALUES ('demo@example.com', 'Demo User', 'SV001', 'MTIzNDU2', 'student');
    PRINT 'Inserted demo user';
END
GO

PRINT 'Database setup completed successfully!';
