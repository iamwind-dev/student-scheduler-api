# HUONG DAN CAI DAT DATABASE USER-DB

## Buoc 1: Vao Azure Portal
1. Mo trinh duyet: https://portal.azure.com
2. Dang nhap voi tai khoan Azure cua ban

## Buoc 2: Mo Query Editor
1. Tim "SQL databases" trong thanh tim kiem
2. Click vao database "user-db"
3. Trong menu ben trai, click "Query editor (preview)"
4. Dang nhap voi:
   - Login: sqladmin
   - Password: Wind060304@

## Buoc 3: Xoa database cu (neu co)

**CHU Y: Buoc nay se xoa TOAN BO du lieu cu!**

Copy va paste noi dung file `clean-database.sql` vao Query Editor, roi click "Run":

```sql
-- Xem noi dung trong file: clean-database.sql
```

Ket qua:
- Dropped ScheduleDetails table
- Dropped Schedules table  
- Dropped Courses table
- Dropped Users table
- All tables removed successfully!

## Buoc 4: Tao database moi

Copy va paste noi dung file `setup-user-db.sql` vao Query Editor, roi click "Run":

```sql
-- Xem noi dung trong file: setup-user-db.sql
```

Ket qua:
- Created Users table
- Created Courses table
- Created Schedules table
- Created ScheduleDetails table
- Inserted demo user
- Database setup completed successfully!

## Buoc 5: Kiem tra ket qua

Chay cau lenh sau de xem cau truc bang:

```sql
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
```

Ban se thay 4 bang:
1. Courses
2. ScheduleDetails
3. Schedules
4. Users

## Buoc 6: Test signup

1. Mo trinh duyet vao http://localhost:5173/signup
2. Dien thong tin:
   - Ho va ten: Nguyen Van A
   - Email: nguyenvana@example.com
   - Ma sinh vien: SV001
   - Mat khau: 123456
3. Click "Dang ky"
4. Neu thanh cong, ban se duoc chuyen ve trang chu

## Demo User

Database da co san 1 tai khoan demo:
- Email: demo@example.com
- Password: 123456
- Student ID: SV001

Ban co the dang nhap bang tai khoan nay de test.

## Cau truc bang Users

| Column    | Type         | Nullable |
|-----------|--------------|----------|
| UserId    | INT          | NO       |
| Email     | NVARCHAR(255)| NO       |
| Name      | NVARCHAR(255)| YES      |
| StudentId | NVARCHAR(50) | YES      |
| Password  | NVARCHAR(255)| YES      |
| Role      | NVARCHAR(50) | YES      |
| CreatedAt | DATETIME     | YES      |
| UpdatedAt | DATETIME     | YES      |

## Files

- `clean-database.sql` - Xoa tat ca bang cu
- `setup-user-db.sql` - Tao bang moi va insert demo user

## Neu gap loi

### Loi: "Cannot drop the table because it does not exist"
-> Khong sao, tiep tuc chay setup-user-db.sql

### Loi: "There is already an object named 'Users'"
-> Chay clean-database.sql truoc, roi chay setup-user-db.sql

### Loi: "Foreign key constraint"
-> Phai xoa bang con (ScheduleDetails) truoc, roi moi xoa bang cha (Schedules, Users)
-> File clean-database.sql da xu ly dung thu tu roi
