# ADR-030: Minimize AI Draft Retention and Separate Feedback from Training Consent

---
status: accepted
date: 2026-07-11
---

AI Draft ที่ผู้ใช้ยืนยันเป็น business record ให้เก็บตาม retention ของ record นั้น AI Draft ที่ reject/abandon เก็บเฉพาะ redacted metadata และเหตุผลไม่เกิน 30 วันเพื่อ quality monitoring แล้วลบ Raw prompt และ full model response ไม่เก็บโดย default เก็บ provenance, latency, token usage, error/safety result โดย redact PII/secrets ผู้ใช้ให้ AI Feedback แบบ Helpful, Incorrect หรือ Unsafe ได้ แต่ feedback และ Draft-to-Final diff ไม่เป็น consent ให้นำไป train model

## Considered Options

- เก็บทุก prompt/response ถูกปฏิเสธเพราะ privacy, storage และ secret-leakage risk
- ไม่เก็บ telemetry/feedback เลยถูกปฏิเสธเพราะตรวจคุณภาพและ incident ไม่ได้

## Consequences

Evaluation dataset ต้องผ่าน Data Governance approval และ de-identification Draft-to-Final diff เก็บเป็น redacted quality metric AI incident/legal hold อาจ override purge ตาม governed process

Acceptance criteria: raw prompt/response storage off by default; abandoned sensitive content ถูกลบตาม policy; 30-day purge/reconciliation test ผ่าน; feedback แยกจาก Human Confirmation/training consent; secrets ไม่ปรากฏใน telemetry
