#!/bin/bash

# Test save schedule API

curl -X POST http://localhost:7071/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "langph.22it@vku.udn.vn",
    "scheduleName": "Test Schedule",
    "courses": [
      {
        "courseId": 1,
        "courseName": "Lập trình Web",
        "courseCode": "IT4409",
        "credits": 3,
        "lecturer": "Nguyễn Văn A",
        "time": "Thứ 2 | Tiết 1->3",
        "room": "TC-205",
        "weeks": "1-15",
        "quantity": 120
      }
    ],
    "user": {
      "email": "langph.22it@vku.udn.vn",
      "name": "Lang Phan",
      "studentId": "22IT001",
      "role": "Student"
    }
  }' | jq .
