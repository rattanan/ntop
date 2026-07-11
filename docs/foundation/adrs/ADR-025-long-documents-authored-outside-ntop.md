# ADR-025: Long Sales Documents Are Authored Outside NTOP

---
status: accepted
date: 2026-07-11
---

NTOP ไม่เป็น document authoring system สำหรับ Proposal, TOR response และเอกสารยาว ผู้ใช้จัดทำเอกสารด้วยเครื่องมือภายนอกตามกระบวนการของตน แล้ว upload กลับเข้า NTOP เป็น External Sales Document เพื่อเก็บ version, metadata, access control, relation กับ Customer/Opportunity/Quote, malware-scan status และ audit

## Considered Options

- In-system AI generation/editor ถูกปฏิเสธเพราะ template/layout/legal review และ office-document lifecycle อยู่นอก core sales control tower
- ไม่เก็บเอกสารใน NTOP ถูกปฏิเสธเพราะทำให้ workflow evidence และ document completeness ตรวจสอบไม่ได้

## Consequences

AI ห้ามสร้าง final long-form Proposal/TOR ใน NTOP ระบบเน้น upload, classification, versioning, preview/download permission และ document checklist หากมี AI assistance ในอนาคตต้องจำกัดเป็น analysis/summary/checking ของเอกสารที่ upload ตาม ACL และ Human Confirmation ไม่ใช่ authoring หรือแก้ไฟล์ต้นฉบับ
