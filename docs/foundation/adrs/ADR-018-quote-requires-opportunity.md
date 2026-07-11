# ADR-018: Every Quote Belongs to One Opportunity

---
status: accepted
date: 2026-07-11
---

Quote ทุกใบต้องอยู่ภายใต้ Opportunity เดียว และ Contracting Customer ของ Quote ต้องสืบทอดจาก Opportunity โดยห้ามเลือกหรือแก้ Customer แยกจากกัน งานเร่งด่วนต้องสร้าง Quick Capture Opportunity ที่มีข้อมูลขั้นต่ำก่อนสร้าง Quote เพื่อรักษา pipeline, ownership, forecast และ approval audit chain

## Considered Options

- Standalone Quote ถูกปฏิเสธเพราะหลุดจาก sales ownership, forecast และ Opportunity workflow
- การเก็บ `customerId` ที่แก้ได้แยกบน Quote ถูกปฏิเสธเพราะเปิดช่องให้ Quote กับ Opportunity อ้างคนละ Customer

## Consequences

ระบบต้องตรวจ Opportunity permission/gates ก่อนสร้าง Quote และ API/UI ไม่รับ Customer เป็นอิสระสำหรับ Quote การเปลี่ยน Contracting Customer ต้องเป็น governed Opportunity correction ที่ประเมินผลต่อ Quote/Approval versions ทั้งหมด
