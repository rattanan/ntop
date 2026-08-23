# Identity Administration — Acceptance Criteria

## Scope

Admin Console ครอบคลุมการสร้างและเปิด/ปิดบัญชี, legacy role, enterprise role assignment, login history และ hash-chained audit log โดยไม่เปลี่ยนพฤติกรรมของ Workflow Admin เดิม

## Acceptance criteria

- เฉพาะผู้มี `user.admin.manage` เท่านั้นที่เข้าหน้าและเรียก mutation ได้ และระบบตรวจสิทธิ์ที่ server ทุกครั้ง
- การสร้าง/แก้ไข user และการมอบหมาย/ถอน role ทำใน transaction เดียวกับ audit event
- ผู้ดูแลระบบปิดบัญชี เปลี่ยน role หรือมอบ/ถอน role ของตนเองไม่ได้ เพื่อป้องกัน self-grant และ lockout
- บัญชีที่ถูกปิดใช้งาน login ไม่ได้ และ session เดิมไม่ผ่าน `getSession`
- Login ทุกครั้งบันทึกผล `SUCCESS`, `INVALID_CREDENTIALS` หรือ `DISABLED` พร้อม correlation ID
- ความพยายามจากบัญชีที่ไม่รู้จักไม่เก็บอีเมล, IP หรือ User-Agent ดิบ แต่เก็บ HMAC fingerprint สำหรับ correlation
- Audit และ Login History แสดงแบบ bounded สูงสุด 200 รายการล่าสุด และเวลาแสดงตาม Asia/Bangkok
- User/Role Administration อยู่ที่ `/admin/users` และ Login History/Audit Log อยู่ที่เมนูแยก `/admin/audit`; แต่ละหน้าตรวจ `user.admin.manage` และ `audit.read` ฝั่ง server ตามลำดับ
- MySQL 8 forward migration และ MariaDB 5.5 compatibility migration เป็น additive และไม่มีคำสั่ง destructive

## Compact user list and dedicated editing

- `/admin/users` แสดงข้อมูลบัญชี, สถานะ, สิทธิ์, InsightKM connection และเวลาแก้ไขล่าสุดแบบ read-only โดยไม่มี mutation control ภายในแถว
- ปุ่มแก้ไขของแต่ละบัญชีนำไปยัง `/admin/users/{id}/edit` ซึ่งเป็นหน้าเดียวสำหรับแก้บัญชี, หมุน API Key และจัดการ Enterprise role assignments
- ทั้งหน้ารายการและหน้าแก้ไขตรวจ `user.admin.manage` ฝั่ง server; user ID ที่ไม่มีอยู่ตอบด้วย not-found โดยไม่เปิดเผยข้อมูลเพิ่มเติม
- หน้าแก้ไขยังคงป้องกันการเปลี่ยน role, ปิดบัญชี หรือมอบ/ถอน role ของตนเอง และใช้ identity administration service, transaction และ audit event เดิม
- ตารางต้องใช้พื้นที่แนวตั้งอย่างกระชับบน desktop และปรับเป็นรายการแบบ card บนจอเล็กโดยไม่เกิด horizontal scroll

## Deferred

Password reset, MFA, login throttling/lockout policy และ session-device revocation แยกเป็น milestone ด้าน Identity Security เพื่อไม่ขยาย scope ของหน้าจัดการครั้งนี้
