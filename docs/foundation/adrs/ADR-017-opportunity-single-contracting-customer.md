# ADR-017: One Contracting Customer per Opportunity

---
status: accepted
date: 2026-07-11
---

Opportunity หนึ่งรายการมี Customer ที่เป็นคู่สัญญาหรือผู้ตัดสินใจซื้อหลักได้เพียงหนึ่งราย เพื่อให้ ownership, forecast, quote และ approval มีความหมายแน่นอน Customer อื่นที่ได้รับบริการเชื่อมเป็น Beneficiary Customer และสถานที่ให้บริการเชื่อมเป็น Service Site หากการจัดซื้อเดียวมีคู่สัญญาหลายราย ให้สร้างหลาย Opportunities และรวมด้วย Pursuit Group แทนการสร้าง multi-customer Opportunity

## Considered Options

- Multi-customer Opportunity ถูกปฏิเสธเพราะทำให้ commercial ownership และ forecast attribution กำกวม
- Opportunity ต่อคู่สัญญาพร้อม Pursuit Group ถูกเลือกเพราะรักษา aggregate boundary แต่ยังเห็นภาพโครงการรวมได้

## Consequences

Quote และ Internal Order ต้องอ้าง Contracting Customer ของ Opportunity; cross-customer reporting ใช้ Pursuit Group และ Beneficiary relationships โดยไม่รวมมูลค่าซ้ำ
