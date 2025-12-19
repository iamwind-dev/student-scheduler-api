/**
 * Setup User Database Tables
 * Run this to create all necessary tables in user-db
 */

require('dotenv').config();
const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE || 'user-db',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: false
    }
};

async function setupDatabase() {
    let pool;
    
    try {
        console.log('🔌 Connecting to Azure SQL Database...');
        console.log('Server:', config.server);
        console.log('Database:', config.database);
        
        pool = await sql.connect(config);
        console.log('✅ Connected successfully!\n');

        // Create Users table
        console.log('📋 Creating Users table...');
        await pool.request().query(`
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
        `);
        console.log('✅ Users table ready\n');

        // Create Courses table
        console.log('📋 Creating Courses table...');
        await pool.request().query(`
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
        `);
        console.log('✅ Courses table ready\n');

        // Create Schedules table
        console.log('📋 Creating Schedules table...');
        await pool.request().query(`
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
        `);
        console.log('✅ Schedules table ready\n');

        // Create ScheduleDetails table
        console.log('📋 Creating ScheduleDetails table...');
        await pool.request().query(`
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
        `);
        console.log('✅ ScheduleDetails table ready\n');

        // Insert demo user if not exists
        console.log('👤 Creating demo user...');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM Users WHERE Email = 'demo@example.com')
            BEGIN
                INSERT INTO Users (Email, Name, StudentId, Password, Role)
                VALUES ('demo@example.com', 'Demo User', 'SV001', 'MTIzNDU2', 'student');
            END
        `);
        console.log('✅ Demo user ready\n');

        // Verify tables
        console.log('🔍 Verifying tables...');
        const result = await pool.request().query(`
            SELECT 
                t.name AS TableName,
                c.name AS ColumnName,
                ty.name AS DataType,
                c.max_length AS MaxLength,
                c.is_nullable AS IsNullable
            FROM sys.tables t
            INNER JOIN sys.columns c ON t.object_id = c.object_id
            INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            WHERE t.name IN ('Users', 'Courses', 'Schedules', 'ScheduleDetails')
            ORDER BY t.name, c.column_id
        `);

        console.log('\n📊 Database Structure:');
        let currentTable = '';
        result.recordset.forEach(row => {
            if (row.TableName !== currentTable) {
                currentTable = row.TableName;
                console.log(`\n${currentTable}:`);
            }
            console.log(`  - ${row.ColumnName} (${row.DataType}${row.MaxLength > 0 ? `(${row.MaxLength})` : ''})`);
        });

        console.log('\n✅ Database setup completed successfully!');
        console.log('\n📝 Summary:');
        console.log('   - Users table created');
        console.log('   - Courses table created');
        console.log('   - Schedules table created');
        console.log('   - ScheduleDetails table created');
        console.log('   - Demo user inserted');

    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run setup
console.log('🚀 Starting database setup...\n');
setupDatabase();
