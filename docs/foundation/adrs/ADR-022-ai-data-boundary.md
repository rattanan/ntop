# ADR-022: AI Uses Least-Privilege Data Boundaries

---
status: accepted
date: 2026-07-11
---

AI capability ทุกตัวต้องสร้าง AI Input Scope จากข้อมูลขั้นต่ำที่ผู้ใช้มีสิทธิ์และ capability ได้รับอนุมัติ Public/Internal data ใช้ได้ Customer Confidential และ Commercial Sensitive ใช้เฉพาะ use case ที่อนุมัติและ mask เมื่อไม่จำเป็นต้องใช้ค่าจริง Credentials, API keys, tokens, MFA secrets และ private keys ห้ามส่งให้ AI ทุกกรณี Document/RAG retrieval ใช้ ACL เดียวกับผู้ใช้และ Grounded AI Output ต้อง cite source

## Considered Options

- ส่ง full customer context ถูกปฏิเสธเพราะเพิ่ม privacy, leakage และ prompt-injection impact โดยไม่จำเป็น
- ห้ามใช้ข้อมูล confidential ทั้งหมดถูกปฏิเสธเพราะทำให้ Proposal, TOR และ Meeting assistance ใช้งานจริงไม่ได้

## Consequences

ต้องมี capability-specific allowlist, redaction, ACL-preserving retrieval, prompt-injection controls, input/output retention policy และ provenance ห้ามนำข้อมูล NT ไป train model โดยไม่มี approved contract AI provider outage ต้อง degrade เป็น manual workflow โดยไม่หยุด core sales process
