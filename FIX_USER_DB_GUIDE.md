# 🔧 Hướng dẫn Fix lỗi lưu Schedule vào User-DB

## ❌ Vấn đề ban đầu
- API trả về lỗi 500 khi lưu schedules
- Không thể lưu user vào database
- Bảng trong user-db chưa được tạo

## ✅ Đã fix

### 1. Tạo database schema cho user-db
```bash
cd /home/phanhoailang/LangPhan/Azure/final_project/student-scheduler-api
node setup-database.js
```

**Kết quả:**
- ✅ Tạo bảng `Users`
- ✅ Tạo bảng `Courses` 
- ✅ Tạo bảng `Schedules`
- ✅ Tạo bảng `ScheduleDetails`
- ✅ Insert demo user

### 2. Sửa lỗi Schedule Service
**File:** `src/services/schedule-service.js`

**Thay đổi:**
- Thêm logic tự động insert course vào bảng `Courses` nếu chưa tồn tại
- Sử dụng `CourseCode` làm unique identifier
- Lưu đầy đủ thông tin course (name, lecturer, time, room, etc.)

### 3. Sửa lỗi Frontend
**File:** `frontend/src/pages/schedule/SchedulePage.jsx`

**Thay đổi:**
- Gửi đầy đủ thông tin course (không chỉ courseId và credits)
- Bỏ bước save user riêng (schedule service sẽ tự tạo user)

**File:** `frontend/src/pages/profile/ProfilePage.jsx`
- Fix route từ `/schedules/demo-user` → `/schedules/user/demo-user`

## 🧪 Test lại chức năng

### Bước 1: Khởi động API server
```bash
cd /home/phanhoailang/LangPhan/Azure/final_project/student-scheduler-api
node server.js
```

### Bước 2: Khởi động Frontend
```bash
cd /home/phanhoailang/LangPhan/Azure/fe/student-scheduler/frontend
npm run dev
```

### Bước 3: Test flow
1. **Đăng nhập** với tài khoản Azure AD
2. **Chọn môn học** trong trang Schedule
3. **Click "Lưu thời khóa biểu"**
4. **Kiểm tra:**
   - Không có lỗi 500 trong console
   - Thấy thông báo thành công
   - Data được lưu vào user-db

### Bước 4: Verify trong Database
```bash
cd /home/phanhoailang/LangPhan/Azure/final_project/student-scheduler-api
node -e "
const sql = require('mssql');
const config = {
  server: 'student-schedule.database.windows.net',
  database: 'user-db',
  user: 'sqladmin',
  password: 'Wind060304@',
  options: { encrypt: true }
};

(async () => {
  const pool = await sql.connect(config);
  
  console.log('=== USERS ===');
  const users = await pool.request().query('SELECT * FROM Users');
  console.table(users.recordset);
  
  console.log('\n=== SCHEDULES ===');
  const schedules = await pool.request().query('SELECT * FROM Schedules');
  console.table(schedules.recordset);
  
  console.log('\n=== COURSES ===');
  const courses = await pool.request().query('SELECT TOP 5 * FROM Courses');
  console.table(courses.recordset);
  
  await pool.close();
})();
"
```

## 📝 API Endpoints đã fix

### POST /api/schedules
Tạo schedule mới
- **Request Body:**
```json
{
  "userId": "user-email@example.com",
  "scheduleName": "Thời khóa biểu - 19/12/2025",
  "courses": [
    {
      "courseId": 1,
      "courseName": "Lập trình Web",
      "courseCode": "IT4409",
      "credits": 3,
      "lecturer": "Nguyễn Văn A",
      "time": "Thứ 2 (7:00-9:30)",
      "room": "TC-205",
      "weeks": "1-15",
      "quantity": 120
    }
  ],
  "user": {
    "email": "user@example.com",
    "name": "Nguyễn Văn B",
    "studentId": "20210001",
    "role": "Student"
  }
}
```

### GET /api/schedules/user/{userId}
Lấy tất cả schedules của user
- **Response:**
```json
{
  "success": true,
  "schedules": [
    {
      "ScheduleId": 1,
      "ScheduleName": "Thời khóa biểu - 19/12/2025",
      "TotalCredits": 15,
      "CourseCount": 5,
      "CreatedAt": "2025-12-19T03:00:00.000Z"
    }
  ]
}
```

## 🎯 Kết quả
- ✅ Database schema đã được setup
- ✅ Schedule service tự động tạo user nếu chưa tồn tại
- ✅ Course data được lưu vào bảng Courses
- ✅ Schedule và ScheduleDetails được lưu đúng
- ✅ Frontend gửi đầy đủ thông tin
- ✅ API routes đã được fix

## 🚨 Lưu ý
- Đảm bảo `.env` có đúng connection string đến user-db
- API server phải đang chạy trên port 7071
- Frontend phải đang chạy trên port 5173
