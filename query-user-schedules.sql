-- ================================================
-- QUERY USER SCHEDULES FROM user-db
-- Hiển thị thời khóa biểu đã chọn của user
-- ================================================

-- 0. QUERY NHANH - Kiểm tra data cho profile page
-- Thay email của bạn vào đây:
DECLARE @MyEmail NVARCHAR(255) = 'langph.22it@vku.udn.vn';

-- Lấy tất cả schedules + courses của user (giống ProfilePage.jsx)
SELECT 
    s.ScheduleId,
    s.ScheduleName,
    s.TotalCredits,
    s.CreatedAt,
    c.CourseId,
    c.CourseName,
    c.CourseCode,
    c.Credits,
    c.Lecturer,
    c.Time,
    c.Room,
    c.Weeks
FROM Users u
INNER JOIN Schedules s ON u.UserId = s.UserId
INNER JOIN ScheduleDetails sd ON s.ScheduleId = sd.ScheduleId
INNER JOIN Courses c ON sd.CourseId = c.CourseId
WHERE u.Email = @MyEmail
ORDER BY s.CreatedAt DESC, c.CourseName;

-- 1. Xem tất cả users đã đăng ký
SELECT 
    UserId,
    Email,
    Name,
    StudentId,
    Role,
    CreatedAt
FROM Users
ORDER BY CreatedAt DESC;

-- 2. Xem schedules của user cụ thể (thay email ở đây)
DECLARE @UserEmail NVARCHAR(255) = 'langph.22it@vku.udn.vn';

SELECT 
    u.UserId,
    u.Email,
    u.Name,
    s.ScheduleId,
    s.ScheduleName,
    s.TotalCredits,
    s.CreatedAt as ScheduleCreatedAt,
    COUNT(sd.DetailId) as TotalCourses
FROM Users u
INNER JOIN Schedules s ON u.UserId = s.UserId
LEFT JOIN ScheduleDetails sd ON s.ScheduleId = sd.ScheduleId
WHERE u.Email = @UserEmail
GROUP BY 
    u.UserId, u.Email, u.Name,
    s.ScheduleId, s.ScheduleName, s.TotalCredits, s.CreatedAt
ORDER BY s.CreatedAt DESC;

-- 3. Xem chi tiết courses trong schedule (thay ScheduleId)
DECLARE @ScheduleId INT = 25; -- Thay bằng ScheduleId muốn xem

SELECT 
    s.ScheduleId,
    s.ScheduleName,
    s.TotalCredits,
    c.CourseId,
    c.CourseName,
    c.CourseCode,
    c.Credits,
    c.Lecturer,
    c.Time,
    c.Room,
    c.Weeks,
    sd.CreatedAt as AddedToScheduleAt
FROM Schedules s
INNER JOIN ScheduleDetails sd ON s.ScheduleId = sd.ScheduleId
INNER JOIN Courses c ON sd.CourseId = c.CourseId
WHERE s.ScheduleId = @ScheduleId
ORDER BY c.CourseName;

-- 4. Query tổng hợp - Lấy schedule mới nhất của user với tất cả courses
WITH LatestSchedule AS (
    SELECT TOP 1
        u.UserId,
        u.Email,
        u.Name,
        s.ScheduleId,
        s.ScheduleName,
        s.TotalCredits,
        s.CreatedAt
    FROM Users u
    INNER JOIN Schedules s ON u.UserId = s.UserId
    WHERE u.Email = @UserEmail
    ORDER BY s.CreatedAt DESC
)
SELECT 
    ls.ScheduleId,
    ls.ScheduleName,
    ls.TotalCredits,
    ls.CreatedAt,
    c.CourseId,
    c.CourseName,
    c.CourseCode,
    c.Credits,
    c.Lecturer,
    c.Time,
    c.Room,
    c.Weeks,
    c.Quantity
FROM LatestSchedule ls
INNER JOIN ScheduleDetails sd ON ls.ScheduleId = sd.ScheduleId
INNER JOIN Courses c ON sd.CourseId = c.CourseId
ORDER BY c.CourseName;

-- 5. Thống kê tổng quan
SELECT 
    'Tổng số users' as Metric,
    COUNT(*) as Value
FROM Users
UNION ALL
SELECT 
    'Tổng số schedules',
    COUNT(*)
FROM Schedules
UNION ALL
SELECT 
    'Tổng số courses đã lưu',
    COUNT(*)
FROM Courses
UNION ALL
SELECT 
    'Tổng số course registrations',
    COUNT(*)
FROM ScheduleDetails;

-- 6. Top users có nhiều schedules nhất
SELECT TOP 5
    u.Email,
    u.Name,
    COUNT(s.ScheduleId) as TotalSchedules,
    SUM(s.TotalCredits) as TotalCreditsAcrossSchedules
FROM Users u
LEFT JOIN Schedules s ON u.UserId = s.UserId
GROUP BY u.UserId, u.Email, u.Name
ORDER BY TotalSchedules DESC, TotalCreditsAcrossSchedules DESC;
