# ADR-035: AI Next Action Becomes a Task Only After Confirmation

---
status: accepted
date: 2026-07-11
---

AI Next Action Recommendation ไม่สร้างงานจนผู้ใช้ยืนยัน เมื่อยืนยันจึงสร้าง Activity หรือ Task หนึ่งรายการ ผูก Customer และ Opportunity ตาม context Owner เป็นผู้ยืนยันโดย default หรือผู้รับผิดชอบอื่นที่ผู้ยืนยันมีสิทธิ์เลือก Due date แสดง Asia/Bangkok และเก็บ timezone-correct ใช้ idempotency ป้องกัน confirmation ซ้ำ คำแนะนำที่ไม่ยืนยันไม่เป็น business record และหมดอายุได้

## Considered Options

- Auto-create task ถูกปฏิเสธเพราะสร้างงานรบกวนและละเมิด AI autonomy boundary
- เก็บเป็นข้อความใน summary อย่างเดียวถูกปฏิเสธเพราะติดตาม owner/due date ไม่ได้

## Consequences

Confirmed task เป็น business record ปกติแต่เก็บ provenance link กลับ AI Suggestion Authorization ตรวจฝั่ง server Suggested owner ที่ resolve ไม่ได้หรืออยู่นอก scope ต้องให้ผู้ใช้เลือกใหม่

Acceptance criteria: unconfirmed suggestion ไม่สร้าง task; confirmed suggestion สร้างหนึ่ง taskแม้ retry; owner/scope authorization ผ่าน server; due date round-trip ถูกต้องใน Asia/Bangkok/UTC; provenance/audit ครบ; manual task creation ทำงานได้เมื่อ AI unavailable
