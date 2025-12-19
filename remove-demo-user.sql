-- Remove demo user from user-db database

DELETE FROM ScheduleDetails WHERE ScheduleId IN (SELECT ScheduleId FROM Schedules WHERE UserId = 1);
DELETE FROM Schedules WHERE UserId = 1;
DELETE FROM Users WHERE Email = 'demo@example.com';

PRINT 'Demo user removed successfully!';

-- Verify
SELECT * FROM Users;
