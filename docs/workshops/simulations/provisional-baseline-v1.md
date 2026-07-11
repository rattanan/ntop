# NTOP Provisional Baseline v1 — Simulation Only

> **SUPERSEDED BY APPROVED BASELINE 1.0**  
> Steering approval was confirmed unchanged on 2026-07-11. This file is preserved as historical simulation input; use the approved baseline documents for implementation.

| Metadata | Value |
|---|---|
| Status | Superseded — Approved Baseline 1.0 |
| Version | Simulation 0.1 |
| Simulation owner | Product Architecture Working Group |
| Approval authority | NTOP Steering Committee — approval not yet obtained |
| Last updated | 2026-07-11 |
| Related documents | [Decision Register](../decision-register.md), [Product Requirements](../../product-requirements.md), [Decision Impact](provisional-decision-impact.md), [Approved Backlog](../../foundation/foundation-backlog.md), [Validation Scenarios](simulation-validation-scenarios.md) |
| Supersedes | None |
| Expiry | เมื่อ Steering Committee อนุมัติ baseline จริง หรือ 30 วันหลังสร้าง โดยเหตุการณ์ใดเกิดก่อน |

## 1. Simulation purpose and controls

Simulation นี้ตอบคำถามว่า หากใช้ recommended defaults แล้ว requirement, architecture, workflow, operations และ M1–M2 backlog จะสอดคล้องกันหรือไม่ ผลลัพธ์ทุกข้อเป็น working hypothesis และ rollback ได้ทั้งหมด

Controls:

- เอกสาร baseline 12 ฉบับและ workshop records คงสถานะเดิม
- Story ที่พึ่ง policy/value จำลองต้องเป็น `Conditional` หรือ `Blocked Until Approval`
- ทีมทำได้เฉพาะ discovery, interface design, spike และ reversible foundation ที่ไม่ฝังค่าจำลอง
- เมื่อ decision จริงต่างออกไป ให้ใช้ impact/rollback ใน [provisional-decision-impact.md](provisional-decision-impact.md)

## 2. Simulated decision summary

| Decision | Simulated selection | Requirements | Primary risks | Approval state |
|---|---|---|---|---|
| OD-001 | Central Customer Data Governance + stable internal ID + governed merge | BR-001, FR-001, DATA-001/003 | R-02, R-07 | Simulated — Not Approved |
| OD-002 | Class-based retention: 7y commercial, 3y activity, 1y security logs | COMP-002, SEC-003, DATA-001/003 | R-04, R-07 | Simulated — Not Approved |
| OD-003 | Risk-based commercial approval, 3 value tiers + exception routing | BR-004, FR-006, FR-007, SEC-002, COMP-001 | R-08 | Simulated — Not Approved |
| OD-004 | No live integration in year one; adapters + governed manual handoff | BR-005, INT-001–004 | R-06, R-11, R-15 | Simulated — Not Approved |
| OD-005 | 99.9%; RPO ≤15m; RTO ≤4h; quarterly restore | NFR-003, OPS-001/003/004 | R-01, R-13 | Simulated — Not Approved |
| OD-006 | One division, 75 named users, 4-week pilot + 2-week hypercare | BR-002/003, NFR-002 | R-12, R-15 | Simulated — Not Approved |

## 3. OD-001 — Customer identity and governance

### Simulated policy

- Enterprise Customer Data Owner เป็น accountable role; Data Stewards เป็น responsible operators
- `customerId` เป็น stable opaque NTOP ID ไม่เปลี่ยนเมื่อ external identity หรือ legal details เปลี่ยน
- External identity unique ภายใน `(sourceSystem, externalId)`; tax/legal ID uniqueness ขึ้นกับ jurisdiction/type
- Duplicate detection มีสองชั้น: deterministic match สำหรับ exact governed identifiers และ scored candidates สำหรับ normalized name/address/contact
- ระบบห้าม auto-merge scored candidate; Data Steward ต้อง review และระบุ reason/evidence
- Merge เก็บ surviving ID, aliases, source IDs, before/after summary, actor, timestamp และ audit; downstream references re-point ผ่าน governed job
- Conflict ข้าม sales units escalate ไป Customer Data Owner; ownership ไม่เป็นเกณฑ์ตัดสิน identity

### Rationale and risk

ลด duplicate Customer 360/forecast และรักษา traceability ที่ 2M+ records แต่เพิ่ม stewardship capacity/SLA และต้องออกแบบ merge recovery (BR-001, DATA-001/003, R-07)

### Rollback point

ก่อน implement merge execution ให้รองรับเพียง candidate flag/review queue หาก workshop ไม่อนุมัติ central merge; stable internal/external ID separation ยังเป็น safe architectural foundation

## 4. OD-002 — Data lifecycle

### Simulated policy

| Data class | Examples | Retention from closure/last activity | End-of-retention action |
|---|---|---:|---|
| Commercial evidence | Quote versions, approvals, orders, commercial audit | 7 years | governed archive/anonymize/delete per legal decision |
| Sales operational | Activities, meeting notes, reminders | 3 years | delete/anonymize after dependency/legal-hold check |
| Security/technical logs | login, session, access and system logs | 1 year | secure purge; aggregated non-identifying metrics may remain |
| Credentials/secrets | password hashes, tokens, keys | lifecycle-based, not business retention | revoke/rotate/delete immediately when expired/replaced |

- Legal hold suspends archive/delete for in-scope records and is itself audited
- Export requires explicit permission, purpose/reason, scoped dataset, expiry and download audit
- Deletion/anonymization uses governed workflow + dry-run + maker-checker; direct SQL is prohibited
- Backups follow separate approved rotation and must not silently restore deleted active data

### Rollback point

สร้าง data-class tags, retention interface และ dry-run reporting ได้ แต่ห้าม activate purge schedules จน OD-002 approved

## 5. OD-003 — Commercial approval

### Simulated tiers

| Tier | Quote total (THB) | Mandatory authority | Execution |
|---|---:|---|---|
| T1 | ≤10,000,000 | Team Manager + independent maker-checker | sequential |
| T2 | >10,000,000 and ≤100,000,000 | Sales Director + Pricing Approver | parallel after completeness gate, both required |
| T3 | >100,000,000 | Commercial Committee or formally authorized executives | sequential/committee evidence |

Exception routing escalates at least one authority level, and never lowers approval, when discount >10%, gross margin <15%, non-standard legal terms, unconfirmed coverage/cost, conflict of interest or policy override For T3 exception, route to the committee plus named exception authority defined by the eventual approved policy

Rules:

- Quote creator/editor cannot approve their own mandatory step
- Policy and quote version are snapshotted at submission; relevant change supersedes approval
- Delegation includes scope, maximum amount and effective period; cannot exceed delegator authority
- No eligible approver causes escalation; never auto-approve
- All decisions are append-only and reconstructable (BR-004, COMP-001)

### Rollback point

Implement policy engine contracts and configurable tiers only; do not seed/activate simulated thresholds in production configuration before approval

## 6. OD-004 — Integration posture

### Simulated policy

- No live integration during year-one baseline simulation
- Build canonical adapter ports, versioned contracts, outbox/inbox, idempotency, delivery status and reconciliation model
- OM, CRM, Billing and Coverage/GIS use manual handoff packages with version, checksum, scoped fields, maker-checker and external reference
- Status distinguishes `MANUAL_PENDING`, `MANUAL_ACKNOWLEDGED`, `INTEGRATION_PENDING` and `INTEGRATED`; year-one workflow must not claim synchronization
- Live interface selection returns to Steering Committee after system owner, API, field SoT, security, test environment and support readiness evidence exists

### Rollback point

Adapter boundaries/outbox are reusable if live integrations are later approved; manual package formats remain fallback contracts

## 7. OD-005 — Availability and recovery

### Simulated target

- Monthly availability 99.9%, excluding approved maintenance
- RPO ≤15 minutes; RTO ≤4 hours
- Production MySQL 8 InnoDB Cluster; MariaDB 5.5 development compatibility only
- Quarterly restore exercise; failover and DR rehearsal before production
- Search outage retains exact governed lookup; queue outage records commands/outbox for recovery; external outage uses manual handoff
- Every exercise records actual RPO/RTO, data reconciliation, alerting and corrective actions

### Rollback point

Observability, backup design and failure-mode testing are safe to start; final infrastructure sizing/procurement and signed SLO remain blocked until approval

## 8. OD-006 — Pilot and adoption

### Simulated pilot

- One representative enterprise-sales division
- 75 named users across KAM, manager, Presales, Coverage, Pricing and Order Operations
- Architecture benchmark remains 100 concurrent users + 30% capacity headroom
- 4-week pilot followed by 2-week hypercare
- Controlled production-shaped dataset only after data/security readiness approval

| Success metric | Simulated target |
|---|---:|
| Weekly active pilot users | ≥80% |
| Required opportunity field completeness | ≥90% |
| Lead/opportunity transitions completed through NTOP | ≥95% |
| Commercial decisions with complete audit evidence | 100% |
| Critical security/data-loss defects | 0 |

Rollback triggers: unauthorized access, data corruption, approval bypass, sustained critical outage beyond approved incident tolerance or workflow completion <60% Pilot rollback disables new mutations, preserves evidence and returns to controlled manual process; it does not delete pilot data

### Rollback point

Design analytics/events/training template can start; named division, user provisioning and production-shaped data remain blocked until approval

## 9. Cross-decision consistency

- Central identity supports scoped pilot and later integrations without changing internal IDs
- Retention applies equally to manual and future integrated evidence
- Approval audit survives manual handoff; handoff cannot elevate approval state
- Availability target covers NTOP only; no-live-integration avoids claiming external SLA
- Pilot capacity is below architecture target but uses production-shaped security/workflow controls

## 10. Simulation expiry and replacement

เมื่อ workshop มีผลจริง ให้ mark เอกสารนี้ `Superseded by Requirements Baseline v1 decision date …` แล้วห้ามแก้ simulated recordย้อนหลัง Decision Impact ระบุสิ่งที่ต้อง update/rework และ backlog ต้อง reclassify ก่อน implementation
