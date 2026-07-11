# ADR-027: AI Capabilities Roll Out by Risk and Evidence Readiness

---
status: accepted
date: 2026-07-11
---

AI Release 1 เปิด Meeting/Visit Summary Draft จาก user-provided post-meeting input, Next Action Recommendation และ rule-based Deal Risk/Pipeline Health พร้อม AI explanation โดยไม่ทำ in-system recording/transcription และไม่ทำ public-web Customer Research Release 2 เพิ่ม Research Connector/Grounded Customer Research, Opportunity Finder/Territory Planning, AI Opportunity Draft, read-only Document/TOR Analysis และ Pricing Recommendation Release 3 เพิ่ม calibrated AI Forecast probability, Revenue Forecast และ Provisioning/Customer Success/Renewal predictions หลังมีข้อมูลจริงและ evaluation/calibration เพียงพอ

## Considered Options

- เปิดทุก capability พร้อมกันถูกปฏิเสธเพราะไม่มี evaluation data, governance และ support capacity เพียงพอ
- เลื่อน AI ทั้งหมดถูกปฏิเสธเพราะ Meeting/Research/Next Action ให้ประโยชน์สูงด้วย risk ที่ควบคุมได้

## Consequences

แต่ละ release มี capability-specific data allowlist, evaluation dataset/metrics, security review, human-confirmation UX, provenance, monitoring, fallback และ rollback gate Capability ใน release หลังห้ามเปิดเพียงเพราะ endpoint พร้อม

Acceptance criteria for Release 1: ไม่มี network research connector, browser fetch, audio capture หรือ transcription path; Meeting Draft รับเฉพาะ input mode ที่ได้รับอนุมัติภายหลัง; core workflow ทำงานได้เมื่อ AI unavailable
