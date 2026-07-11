# NTOP Enterprise Decision Workshop

| Metadata | Value |
|---|---|
| Status | Draft for Review |
| Version | 0.1 |
| Workshop format | Full day, 09:00–17:30 Asia/Bangkok |
| Owner | Program Sponsor |
| Facilitator | Product Director or independent facilitator appointed by Program Sponsor |
| Decision authority | NTOP Steering Committee |
| Last updated | 2026-07-11 |
| Related documents | [Product Requirements](../product-requirements.md), [Architecture](../system-architecture.md), [Roadmap](../implementation-roadmap.md), [Decision Register](decision-register.md), [RACI](raci-matrix.md), [Approval Checklist](baseline-approval-checklist.md), [Minutes](workshop-minutes-template.md) |

## 1. Purpose and required outcome

Workshop นี้มีเป้าหมายปิด Open Decisions `OD-001` ถึง `OD-006` เพื่อให้ Requirements Baseline v1 สามารถเข้าสู่ Foundation backlog ได้โดยทีมไม่ต้องเดา business policy, data ownership, integration boundary หรือ operational target

ผลลัพธ์สุดท้ายต้องเป็นหนึ่งในสถานะต่อไปนี้เท่านั้น:

- **Approved** — Decisions และ acceptance checklist ครบ ไม่มี blocking action
- **Approved with Actions** — มีเฉพาะ non-blocking actions ที่ไม่กระทบ Foundation sprint แรก พร้อม owner/due date
- **Not Approved** — มี blocking decision/action, quorum ไม่ครบ หรือ evidence ไม่พอ

## 2. Quorum and participants

### Mandatory voting representatives

| Seat | Authority required | Primary responsibility |
|---|---|---|
| Program Sponsor | อนุมัติ scope, funding direction และ escalation | Chair/final tie resolution |
| Sales | อนุมัติ sales process, forecast, pilot และ adoption | Business authority |
| IT/Enterprise Architecture | อนุมัติ platform/deployment direction | Technical authority |
| Information Security | อนุมัติ security, identity และ data controls | Security authority |
| Data Governance | อนุมัติ ownership, quality และ lifecycle | Data authority |
| Operations | อนุมัติ availability, DR, support และ integration operations | Operational authority |

Commercial/Pricing, Integration Owners, DBA/SRE, Legal/Compliance, Product Owners และ Business SMEs เข้าร่วม session ที่เกี่ยวข้องในฐานะ subject-matter experts

**Quorum:** mandatory voting representatives ครบทั้ง 6 seats หรือมี written delegate ที่มีอำนาจเทียบเท่า หากขาด seat ใด Baseline ต้องเป็น `Not Approved`; ผู้แทนหนึ่งคนอาจถือได้ไม่เกินหนึ่ง voting seat เพื่อรักษา segregation of interests

## 3. Pre-read and preparation

แจก pre-read อย่างน้อย 5 business days ก่อน workshop:

1. [Product Requirements](../product-requirements.md) — requirements, success metrics, risk register และ OD-001–006
2. [System Architecture](../system-architecture.md) — target architecture, HA/DR และ ADRs
3. [Roles and Permissions](../roles-and-permissions.md) — scoped access, maker-checker และ local identity risks
4. [Approval Workflow](../approval-workflow.md) — policy inputs, SoD และ unresolved thresholds
5. [Integration Design](../integration-design.md) — source-of-truth hypothesis และ adapter/fallback model
6. [Implementation Roadmap](../implementation-roadmap.md) — dependencies และ phase gates
7. [Decision Register](decision-register.md) — alternatives/evidence ที่เจ้าของต้องเตรียม

แต่ละ accountable role ต้องกรอก proposal, evidence, preferred option และ known dissent ใน Decision Register ล่วงหน้า 2 business days หากไม่มี evidence ที่จำเป็น facilitator ต้อง flag decision เป็น `At Risk` ก่อนประชุม

## 4. Agenda

| Time | Session | Decisions/evidence | Required participants | Exit condition |
|---|---|---|---|---|
| 09:00–09:30 | Context and approval rules | scope, assumptions, risk severity, quorum, decision rules | All voting seats | rules accepted; conflicts declared |
| 09:30–10:45 | OD-001 Customer ownership and identity | Data Owner, identifiers, duplicate/merge/stewardship | Sales, Data, Security, Product | OD-001 decision or blocking action |
| 10:45–11:00 | Break | — | — | — |
| 11:00–12:00 | OD-002 Data lifecycle | classification, retention, masking, export, deletion, legal hold | Data, Security, Legal, Operations | OD-002 decision or blocking action |
| 12:00–13:00 | Lunch | — | — | — |
| 13:00–14:15 | OD-003 Commercial approval | thresholds, authority, SoD, delegation, SLA, legal triggers | Sales, Pricing, Finance, Legal, Security | OD-003 decision or blocking action |
| 14:15–15:15 | OD-004 Integration priorities | 1–2 systems, field SoT, owners, fallback | IT, Integration, Data, Operations, Business owners | OD-004 decision or blocking action |
| 15:15–15:30 | Break | — | — | — |
| 15:30–16:15 | OD-005 Availability and recovery | 99.9%, RPO/RTO, backup, DR, exercise | IT, SRE/DBA, Security, Operations | OD-005 decision or blocking action |
| 16:15–16:45 | OD-006 Pilot and adoption | division, users, volume, training, KPIs, rollback | Sales, Product, Change, Operations | OD-006 decision or blocking action |
| 16:45–17:30 | Baseline approval | decisions, actions, affected docs, signatures | All voting seats | baseline status signed |

## 5. Facilitation protocol

สำหรับทุก decision facilitator ทำตามลำดับ:

1. อ่าน decision statement และ requirement/risk IDs ที่ได้รับผลกระทบ
2. ยืนยัน facts/evidence และแยก facts ออกจาก assumptions
3. ให้ accountable owner นำเสนอ recommended option และ rationale
4. ทบทวน alternatives อย่างน้อยสองทาง รวมผลกระทบด้าน business, security, data, operations, cost/time
5. เปิด objections/dissent และบันทึกโดยไม่ลบความเห็นส่วนน้อย
6. Steering Committee เลือก `Approve`, `Reject` หรือ `Time-boxed Action`
7. Recorder บันทึก owner, due date, impacted documents และ approval seats ก่อนเริ่มหัวข้อถัดไป

Time-boxed Action ใช้ได้เมื่อ evidence ขาดและ action ไม่เกิน 10 business days หาก action กระทบ Foundation sprint แรก baseline ต้องเป็น `Not Approved`

## 6. Decision rules

- ห้ามใช้สถานะ “Discussed”, “TBD” หรือ verbal agreement เป็นผลลัพธ์
- Decision ต้องมี accountable owner, alternatives, rationale, requirement/risk impact และ approvers
- Approval thresholds, retention periods และ system-of-record ห้ามถูกสมมติหรือ hard-codeก่อนลงนาม
- Conflict of interest ต้อง declare; maker ของ commercial policy ไม่มีสิทธิ์อนุมัติข้อยกเว้นของตนเอง
- เปลี่ยน requirement ต้องระบุเอกสารต้นทาง, version increment และ acceptance/test impact
- Dissent ไม่ block decision โดยอัตโนมัติ แต่ต้องบันทึก rationale และ risk acceptance owner
- Steering Committee ใช้ consensus; หากไม่สำเร็จ Program Sponsor ตัดสินเฉพาะ business scope ส่วน Security/Data/Operations authority สามารถ block เมื่อ breach control หรือ readiness obligation

## 7. Expected outputs

- Decision Register ปิด OD-001–006 หรือมี blocking/non-blocking actions ชัดเจน
- Named accountable roles และ RACI ที่ยอมรับร่วมกัน
- Critical/High risk owner, mitigation และ trigger ได้รับการยืนยัน
- Baseline Approval Checklist พร้อม signatures/status
- Minutes, dissent และ action log
- Document impact list สำหรับเอกสาร baseline ทั้ง 12 ฉบับ
- Foundation backlog entry criteria ที่ไม่เหลือ business-policy ambiguity

## 8. Post-workshop sequence

ภายใน 1 business day recorder ส่ง minutes/decision register; ภายใน 2 business days participants ส่ง factual correction; ภายใน 5 business days owners ปรับเอกสาร baseline และสร้าง traceability matrix การเปลี่ยน decision หลัง sign-off ต้องผ่าน change control และเพิ่ม decision/version history ห้ามแก้ผลเดิมย้อนหลัง

