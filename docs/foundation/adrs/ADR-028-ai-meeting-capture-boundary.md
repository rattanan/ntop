# ADR-028: Meeting AI Uses Explicit, Consented Sources

---
status: accepted
date: 2026-07-11
---

Meeting AI สร้าง Meeting Note, MOM และ Activity เป็น Meeting Draft ที่ผู้ใช้ตรวจและยืนยันก่อนเป็น business record Phase 1 รับเฉพาะข้อความที่ผู้ใช้พิมพ์หรือ paste หลังประชุม Pasted transcript ถือเป็น user-provided text ที่ผู้ใช้รับรองสิทธิ์ใช้งาน Phase 1 ไม่รับ audio/video, transcript file และไม่มี recording หรือ transcription endpoint/UI/job

## Considered Options

- Automatic recording ถูกปฏิเสธเพราะ consent, privacy และ customer-trust risk
- Text-only input ถูกปฏิเสธเพราะไม่รองรับ workflow ที่ผู้ใช้มี transcript/audio อย่างถูกต้อง

## Consequences

Input text ต้องมีขนาดจำกัดและผ่าน secret/prompt-injection checks ก่อนส่ง AI Meeting Draft ต้องมี Human Confirmation/audit Future audio/transcript capability ต้องผ่าน decision ใหม่พร้อม classification, ACL, consent, encryption และ retention

Acceptance criteria for Phase 1: รับเฉพาะ typed/pasted text; ไม่มี audio/video/file upload สำหรับ meeting source; ไม่มี recording/transcription path; pasted transcript มี user attestation; rejected secret/oversize input ไม่ถูกส่ง AI; core Activity creation ยังใช้ได้เมื่อ AI unavailable
