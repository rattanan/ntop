# ADR-033: Runtime AI API Key Is Encrypted in the Database

---
status: accepted
date: 2026-07-11
---

เพื่อให้ Admin rotate AI API Key ผ่านระบบได้ runtime AI configuration เก็บ Enabled, API URL, Model และ Timeout ใน database ส่วน API Key เก็บเป็น authenticated encrypted value ใน database โดยใช้ `AI_CONFIG_MASTER_KEY` จาก environment เป็น encryption master key API/UI แสดงเพียง `apiKeyConfigured` และห้ามคืน plaintext key

## Considered Options

- Environment-only API key ถูกปฏิเสธเพราะ Admin เปลี่ยน runtime ไม่ได้และต้อง restart/redeploy
- External secret manager ถูกเลื่อนออกเพื่อรักษาความ simple ของระยะนี้
- Plaintext database storage ถูกปฏิเสธเพราะ credential exposure risk

## Consequences

Schema change ในอนาคตต้องมี migration และแยก encrypted value/nonce/authentication metadata Master key ห้ามอยู่ใน database/source control/log หาก master key หายหรือเปลี่ยนจน decrypt ไม่ได้ ให้ mark key unavailable และ Admin กรอกใหม่ การ rotate audit เฉพาะ actor/time/config version ไม่เก็บ old/new key

Acceptance criteria: authenticated encryption ใช้ random nonce; ciphertext tamper/decrypt failure fail closed; non-Admin อ่าน/เขียนไม่ได้ฝั่ง server; API/UI/log/audit ไม่มี plaintext; master-key rotation/failure runbook มี; backup contains ciphertext only; tests ครอบคลุม encrypt/decrypt, wrong key, tamper, key overwrite และ redaction
