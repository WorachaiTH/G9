# G9
# กลุ่ม 9 การทำโปรเจกต์เกี่ยวกับ ระบบศูนย์ติดต่อสอบถามของหาย

## การรันระบบ

1. เปิด MySQL และตั้งค่าการเชื่อมต่อฐานข้อมูลใน `src/main/resources/application.properties`
2. จากโฟลเดอร์ `G9` รัน backend:
   ```sh
   bash mvnw spring-boot:run
   ```
3. จากโฟลเดอร์ `G9/frontend` รัน Express:
   ```sh
   npm start
   ```
4. เปิด `http://localhost:3000` โดย Express จะเสิร์ฟหน้าเว็บและส่งต่อ `/api` ไปยัง Spring Boot ที่ `http://localhost:8080`

กำหนด `BACKEND_URL` เพื่อเปลี่ยน URL ของ Spring Boot หรือ `PORT` เพื่อเปลี่ยนพอร์ตของ Express ได้

## API

| Method | Path | การทำงาน |
| --- | --- | --- |
| `POST` | `/api/login` | รับ `{ "email": "...", "password": "..." }` แล้วคืน `{ "token": "...", "email": "..." }` |
| `POST` | `/api/logout` | ยกเลิก token ปัจจุบัน โดยส่ง `Authorization: Bearer <token>` |
| `GET` | `/api/me` | ตรวจสอบ token และคืน `{ "email": "..." }` |
| `GET` | `/api/posts` | ดึงโพสต์ทั้งหมด; กรองได้ด้วย `?type=lost` หรือ `?type=found` |
| `POST` | `/api/posts` | สร้างโพสต์ด้วย `{ "type", "desc", "place", "name", "contact", "img" }`; ต้องส่ง Bearer token และ `img` เป็น data URL ของ JPG/PNG หรือ `null` |

การอ่านโพสต์เป็นสาธารณะ ส่วนการสร้างโพสต์ต้องล็อกอิน รูปที่ส่งต้องไม่เกิน 5 MB

API สำหรับล็อกอินปัจจุบันเป็นเดโม: ตรวจรูปแบบอีเมล `@dome.tu.ac.th` และรหัสผ่านภาษาอังกฤษ/ตัวเลข แล้วออก bearer token ชั่วคราวในหน่วยความจำ ไม่ได้ตรวจรหัสผ่านกับบัญชีจริง และ token จะใช้ไม่ได้หลัง restart Express
