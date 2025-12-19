const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.DB_SERVER,
    authentication: {
        type: 'default',
        options: {
            userName: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        }
    },
    options: {
        encrypt: true,
        trustServerCertificate: false,
        database: 'user-db' // Sẽ switch giữa 2 databases
    }
};

async function importRealCourses() {
    let poolSource, poolDest;
    
    try {
        console.log('🔄 Connecting to databases...');
        
        // Connect to source database (student-scheduler-db)
        const sourceConfig = { ...config, options: { ...config.options, database: 'student-scheduler-db' }};
        poolSource = await sql.connect(sourceConfig);
        console.log('✅ Connected to student-scheduler-db (source)');
        
        // Query all courses from source
        console.log('📥 Loading courses from student-scheduler-db...');
        const result = await poolSource.request().query(`
            SELECT 
                ID as CourseId,
                Name as CourseName,
                Credits,
                Lecturer,
                Time,
                Room,
                Weeks,
                Quantity
            FROM Courses
            ORDER BY ID
        `);
        
        const courses = result.recordset;
        console.log(`✅ Found ${courses.length} courses in student-scheduler-db`);
        
        // Close source connection
        await poolSource.close();
        
        // Connect to destination database (user-db)
        const destConfig = { ...config, options: { ...config.options, database: 'user-db' }};
        poolDest = await sql.connect(destConfig);
        console.log('✅ Connected to user-db (destination)');
        
        // Clear existing courses in user-db (optional)
        console.log('🗑️  Clearing existing courses in user-db...');
        await poolDest.request().query('DELETE FROM Courses WHERE CourseId > 0');
        
        // Insert courses into user-db
        console.log('📤 Importing courses to user-db...');
        let imported = 0;
        let failed = 0;
        
        for (const course of courses) {
            try {
                // Generate CourseCode from CourseName (first letters of words)
                const courseCode = course.CourseName
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 10);
                
                await poolDest.request()
                    .input('courseId', sql.Int, course.CourseId)
                    .input('courseName', sql.NVarChar, course.CourseName)
                    .input('courseCode', sql.NVarChar, courseCode)
                    .input('credits', sql.Int, course.Credits)
                    .input('lecturer', sql.NVarChar, course.Lecturer)
                    .input('time', sql.NVarChar, course.Time)
                    .input('room', sql.NVarChar, course.Room)
                    .input('weeks', sql.NVarChar, course.Weeks)
                    .input('quantity', sql.Int, course.Quantity || 0)
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM Courses WHERE CourseId = @courseId)
                        BEGIN
                            INSERT INTO Courses (
                                CourseId, CourseName, CourseCode, Credits, 
                                Lecturer, Time, Room, Weeks, Quantity
                            )
                            VALUES (
                                @courseId, @courseName, @courseCode, @credits,
                                @lecturer, @time, @room, @weeks, @quantity
                            )
                        END
                    `);
                imported++;
                
                if (imported % 100 === 0) {
                    console.log(`   ⏳ Imported ${imported}/${courses.length} courses...`);
                }
            } catch (err) {
                failed++;
                console.error(`   ❌ Failed to import course ${course.CourseId}: ${err.message}`);
            }
        }
        
        console.log(`\n✅ Import completed!`);
        console.log(`   📊 Total: ${courses.length} courses`);
        console.log(`   ✅ Imported: ${imported} courses`);
        console.log(`   ❌ Failed: ${failed} courses`);
        
        // Verify import
        const verifyResult = await poolDest.request().query('SELECT COUNT(*) as total FROM Courses');
        console.log(`\n🔍 Verification: ${verifyResult.recordset[0].total} courses now in user-db`);
        
    } catch (error) {
        console.error('❌ Import error:', error);
        throw error;
    } finally {
        if (poolSource) await poolSource.close();
        if (poolDest) await poolDest.close();
        console.log('\n👋 Database connections closed');
    }
}

// Run import
importRealCourses()
    .then(() => {
        console.log('\n✅ All done!');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Failed:', err);
        process.exit(1);
    });
