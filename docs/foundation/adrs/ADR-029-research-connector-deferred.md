# ADR-029: Public-Web AI Research Uses a Connector and Is Deferred Beyond Phase 1

---
status: accepted
date: 2026-07-11
---

Public-web AI Research ต้องใช้ server-side Research Connector ที่เรียกเฉพาะ approved sources โดย model ห้าม fetch URL โดยตรง Connector บังคับ URL rules, content size/type limits, sanitization และ citation metadata ได้แก่ URL, title, publisher, published/retrieved time และ excerpt อย่างไรก็ตาม Research Connector และ public-web Customer Research ถูก defer ออกจาก Phase 1

## Considered Options

- Direct model web access ถูกปฏิเสธเพราะ SSRF, data leakage และ source-governance risk
- ทำ Research Connector ใน Phase 1 ถูกปฏิเสธเพื่อจำกัด scope และให้ทีมสร้าง core workflow/AI governance ก่อน

## Consequences

Phase 1 AI ใช้เฉพาะ approved internal/user-provided sources และต้องแจ้งว่า public-web research unavailable Release 2 ต้องผ่าน source allowlist, security testing, citation correctness, outage fallback และ monitoring ก่อนเปิดใช้

Acceptance criteria: Phase 1 ไม่มี URL fetch/browser/search connector path; AI ไม่อ้างว่าค้นเว็บแล้ว; Release 2 output แยก internal facts กับ public facts และ cite sources ครบ
