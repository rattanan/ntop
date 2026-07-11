# ADR-021: AI Proposes, Human Decides

---
status: accepted
date: 2026-07-11
---

AI ใน NTOP ทำหน้าที่ research, summarize, analyze, recommend และสร้าง Draft เท่านั้น การสร้างหรือเปลี่ยน business record และ workflow state ต้องได้รับ Human Confirmation จากผู้ใช้ที่มีสิทธิ์ AI ห้ามเปลี่ยน stage, submit Quote, approve, create Internal Order, merge Customer หรือส่งข้อมูลออกนอกระบบเอง Deterministic policy/rules อาจ block invalid action; AI มีหน้าที่อธิบายและจัดลำดับความเสี่ยง ไม่ใช่ override policy

## Considered Options

- Fully autonomous agent ถูกปฏิเสธเพราะ commercial, privacy, authorization และ audit risk สูง
- Read-only recommendation อย่างเดียวถูกปฏิเสธเพราะไม่ช่วยลดงาน Visit Report, Opportunity หรือ Proposal drafting ได้เต็มที่

## Consequences

ทุก AI output ต้องมี provenance ได้แก่ model/version, prompt/template version, input sources, timestamp และ confidence การยืนยันต้องเก็บ actor/time และ diff จาก Draft ไป final record AI provider configuration ใช้ environment/secret management ผ่าน `OPENAI_API_URL`, `OPENAI_API_KEY` และ `OPENAI_MODEL`; ห้าม commit key หรือเก็บใน prompt/audit logs
