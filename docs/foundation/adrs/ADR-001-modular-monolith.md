# ADR-001: Modular Monolith Architecture

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-11 |
| Owners | Enterprise and Application Architecture |
| Authority | Architecture Board |
| Requirements | BR-002, NFR-004, OPS-004 |
| Backlog | FND-002, FND-003 |
| Accepted | 2026-07-11 — project owner confirmation in Codex task |

## Context

NTOP ต้องส่งมอบ lead-to-order ภายใน 12 เดือน ขณะที่ domain และทีมยังต้องเรียนรู้ร่วมกัน การเริ่มด้วย microservices จะเพิ่ม network contracts, distributed transactions, deployment และ operations burden ก่อน boundary มีเสถียรภาพ ปัจจุบัน prototype เป็น Next.js application ที่ coupling สูงและยังไม่มี module ownership

## Decision drivers

- ส่งมอบเร็วโดยไม่เสีย domain boundaries
- transaction consistency สำหรับ customer, quote, approval และ audit
- รองรับ 2M+ customers แต่ initial concurrency 100 users
- แยกทีมและ deploy ได้ในอนาคตเมื่อมี evidence
- ห้าม cross-module table writes และ accidental coupling

## Options

1. **Modular monolith (recommended):** deployable เดียว, strict internal module APIs/events
2. Microservices from day one: strong deployment isolation แต่ distributed complexity สูง
3. Layered monolith without domain modules: เริ่มง่ายแต่ coupling/regression สูง

## Proposed decision

ใช้ modular monolith แบ่ง Identity, Customer, Sales Engagement, Opportunity/Forecast, Presales, Commercial, Order Handoff, Documents, Integration, Audit และ Administration แต่ละ module เป็นเจ้าของ application service, domain model และ persistence access ของตน Cross-module mutation ผ่าน public application interface หรือ domain event เท่านั้น

## Consequences and controls

- Positive: local transactions, simpler deployment/test, clearer evolution path
- Cost: ต้อง enforce imports/ownership ใน CI และ review
- Database เดียวได้แต่ table ownership ต้องชัด; reporting ห้าม bypass permissions
- Extraction to service ทำเมื่อมี scaling/team/release evidence และ contract tests พร้อม
- Reversal: module สามารถ extract โดยรักษา public contract/event; no shared-domain object leakage

## Evidence required for acceptance

- [Module Boundaries](../module-boundaries.md) reviewed
- forbidden dependency rules และ exception process defined
- architecture/security/data/operations sign-off

## Acceptance record

Accepted unchanged on 2026-07-11 by explicit project owner instruction (“Accepted all”). Named Architecture Board signatures were not supplied and are not fabricated; they may be attached administratively without changing this decision.
