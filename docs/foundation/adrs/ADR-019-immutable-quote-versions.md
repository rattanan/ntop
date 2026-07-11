# ADR-019: Submitted Quote Versions Are Immutable

---
status: accepted
date: 2026-07-11
---

Quote เป็น identity ของข้อเสนอหนึ่งชุด ส่วน Quote Version เป็น snapshot ของสินค้า ราคา discount margin เงื่อนไข และ validity เมื่อ Quote Version ถูก submit แล้วห้ามแก้ไข การเปลี่ยน commercial data ต้องสร้าง Quote Version ใหม่ และ Approval ต้องอ้าง version ที่แน่นอน หาก version ใหม่เปลี่ยน policy inputs ให้ Approval เดิมเป็น Superseded และประเมิน route ใหม่

## Considered Options

- แก้ Quote ที่ submit แล้วถูกปฏิเสธเพราะทำลายหลักฐานว่าผู้อนุมัติเห็นข้อมูลใด
- Copy Quote เป็น Quote ใหม่ทุกครั้งถูกปฏิเสธเพราะทำให้ commercial thread และ customer-facing reference แตกกระจาย

## Consequences

Quote Version และ Approval Decision เป็น immutable evidence UI ต้องแสดง version ที่กำลังดู/อนุมัติอย่างชัดเจน และ Internal Order ต้องอ้าง accepted/approved Quote Version ไม่ใช่ mutable Quote identity
