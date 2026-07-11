# ADR-026: AI Document Analysis Is Read-Only and Evidence-Linked

---
status: accepted
date: 2026-07-11
---

AI อ่าน External Sales Document เพื่อสรุป ตรวจ completeness เปรียบเทียบกับ Quote/Coverage/Solution และสร้าง Compliance Findings ได้แบบ read-only ตาม ACL เดียวกับผู้ใช้ Output ต้อง cite page/section และเก็บแยกจากไฟล์ต้นฉบับ AI ห้ามแก้ไฟล์, เปลี่ยน document version หรือถือผลวิเคราะห์เป็น legal/commercial approval

## Considered Options

- ปิด AI document access ทั้งหมดถูกปฏิเสธเพราะลดประโยชน์ของ TOR/completeness analysis
- ให้ AI edit uploaded document ถูกปฏิเสธเพราะทำลาย evidence/version ownership และเพิ่ม legal risk

## Consequences

เอกสารต้องผ่าน malware scan, classification และ capability allowlist ก่อนส่งให้ AI Encrypted/unsupported/restricted documents ต้องถูก deny หรือใช้ approved secure extraction path Finding ต้องเชื่อม requirement → capability → evidence → gap และผู้ใช้ต้องยืนยันก่อนนำไปเปลี่ยน workflow/business record
