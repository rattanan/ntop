# ADR-023: AI Exposes Source Conflicts Instead of Inventing a Single Fact

---
status: accepted
date: 2026-07-11
---

Grounded AI Output ต้อง cite sources และแยก fact, inference และ recommendation เมื่อ sources ให้ข้อมูลไม่ตรงกัน AI ต้องแสดง Conflicting Evidence พร้อมค่า source และวันที่ โดยใช้ Source Authority เป็น approved NT master/contract → approved internal document → authoritative external source → general web ห้ามเขียนค่าใดกลับ Customer record อัตโนมัติ หากไม่มี source ที่เพียงพอให้ abstain และตอบว่าข้อมูลไม่เพียงพอ

## Considered Options

- เลือกข้อมูลล่าสุดอัตโนมัติถูกปฏิเสธเพราะข้อมูลใหม่อาจไม่มี authority
- เลือก source ที่ ranked สูงสุดถูกปฏิเสธเพราะ search relevance ไม่เท่ากับ business truth

## Consequences

UI ต้องแสดง citation, source date/authority, conflicts และ recommendation แยกจาก facts Conflict ที่กระทบ master data ส่งให้ Data Steward review AI evaluation ต้องวัด citation correctness, unsupported-claim rate และ abstention behavior
