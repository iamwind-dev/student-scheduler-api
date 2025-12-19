/**
 * Remove demo user from database
 */

require('dotenv').config();
const sql = require('mssql');

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

async function removeDemoUser() {
    let pool;
    
    try {
        console.log('🔌 Connecting to Azure SQL Database...');
        pool = await sql.connect(config);
        console.log('✅ Connected!\n');

        // Delete demo user and related data
        console.log('🗑️  Removing demo user and related data...');
        
        await pool.request().query(`
            DELETE FROM ScheduleDetails 
            WHERE ScheduleId IN (
                SELECT ScheduleId FROM Schedules 
                WHERE UserId IN (SELECT UserId FROM Users WHERE Email = 'demo@example.com')
            );
        `);
        console.log('✅ Deleted ScheduleDetails');

        await pool.request().query(`
            DELETE FROM Schedules 
            WHERE UserId IN (SELECT UserId FROM Users WHERE Email = 'demo@example.com');
        `);
        console.log('✅ Deleted Schedules');

        await pool.request().query(`
            DELETE FROM Users WHERE Email = 'demo@example.com';
        `);
        console.log('✅ Deleted demo user');

        // Verify
        const result = await pool.request().query('SELECT * FROM Users');
        console.log('\n📊 Remaining users:');
        console.table(result.recordset);

        console.log('\n✅ Demo user removed successfully!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

removeDemoUser();
