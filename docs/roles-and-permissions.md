# NTOP Roles and Permissions

| Metadata | Value |
|---|---|
| Status | Draft for Review |
| Version | 0.1 |
| Owner | Product Owner / Information Security |
| Reviewers | Business Role Owners, HR/Identity Operations, Auditor, Architecture, QA |
| Last Updated | 2026-07-11 |
| Related Documents | [Requirements](product-requirements.md), [API](api-design.md), [Opportunity Workflow](opportunity-workflow.md), [Approval Workflow](approval-workflow.md), [Testing](testing-strategy.md) |
| Assumptions | Local identity initially; deny by default; organization and ownership scopes |
| Open Decisions | Named role owners; delegation limits; break-glass process; sensitive field classification; SSO schedule |

## 1. Access model

Authorization = Role capability ∩ Organization scope ∩ Record ownership/assignment ∩ Workflow responsibility ∩ Data classification. การมี role เพียงอย่างเดียวไม่ให้สิทธิ์ข้าม organization หรือ approve เกิน authority (SEC-002)

Scopes: `SELF`, `TEAM`, `ORG_UNIT`, `ENTERPRISE`, `ASSIGNED_TASK`, `AUDIT_READ`. ทุก query ใช้ server-side policy predicate และ detail lookup คืน 404 เมื่อไม่มีสิทธิ์เห็น record

## 2. Roles

- **Admin:** account/reference configuration; ไม่มี commercial approval โดยอัตโนมัติ
- **Executive:** enterprise read dashboards/forecast; sensitive contact fields masked ตาม policy
- **Sales Director:** org pipeline, assignment, stage exception ตาม policy
- **Team Manager:** team records, coaching, reassignment ภายใน scope
- **KAM:** owned/assigned customers, leads, activities, opportunities, draft quotes
- **Presales:** assigned solution/technical data; ไม่แก้ commercial decision
- **Coverage:** assigned feasibility request/result
- **Pricing Approver:** assigned approval step ภายใน authority
- **Order Operations:** approved handoff/order state และ external references
- **Viewer:** scoped read-only
- **Auditor:** immutable audit/commercial evidence read; ไม่มี business mutation

## 3. Permission matrix

Legend: `S` scoped, `A` assigned task, `E` enterprise read, `P` policy/authority, `—` denied

| Capability | Admin | Executive | Sales Dir. | Manager | KAM | Presales | Coverage | Pricing | Order Ops | Viewer | Auditor |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Customer view | S | E | S | S | S | S | A | A | A | S | S |
| Customer create/update | config/S | — | S | S | S | — | — | — | — | — | — |
| Ownership assign | S | — | S | S | — | — | — | — | — | — | audit |
| Lead/activity manage | — | — | S | S | S | — | — | — | — | — | audit |
| Opportunity view/update | — | E | S | S | S | A | A | A | A | S | S |
| Opportunity transition | — | — | P | S | S | — | — | — | — | — | audit |
| Coverage result | — | — | view | view | request | A | A | — | — | — | audit |
| Solution manage | — | — | view | view | request | A | view | — | — | — | audit |
| Quote draft/update | — | view | view | S | S | cost input | — | view | — | — | audit |
| Submit approval | — | — | S | S | S | — | — | — | — | — | audit |
| Approve/reject | — | — | P | P | — | — | — | A/P | — | — | audit |
| Order handoff | — | view | view | view | view | — | — | — | A | — | audit |
| Bulk import/export | P | P/read | P | P | limited | — | — | — | P | — | audit |
| User/role administer | P | — | — | request | — | — | — | — | — | — | audit |
| Audit search | P | — | limited | limited | own | own | own | own | own | — | E |

Matrix นี้เป็น baseline; policy engine ต้องใช้ explicit permission names เช่น `opportunity.transition.proposal` ไม่ hard-code role name ใน domain logic

## 4. Segregation of duties

- Quote maker ห้าม approve ขั้นที่ policy ระบุ maker-checker
- Admin grant role ให้ตนเองไม่ได้โดยไม่มี second approver/audit
- Ownership reassignment, exceptional discount, approval override, bulk export และ break-glass ต้องมี reason + audit
- Delegation ต้องมี approver, effective period, scope และ authority ไม่เกิน delegator; ห้าม onward delegation โดย default
- ผู้ Coverage/Presales ยืนยันเฉพาะข้อมูล technical/cost ตามหน้าที่ ไม่ approve commercial terms โดยอัตโนมัติ (BR-004, FR-007)

## 5. Account lifecycle

- Joiner: verified sponsor, role owner approval, least privilege, temporary password out-of-band
- Privileged roles เปิด MFA ก่อน activate; password hash ใช้ approved adaptive algorithm
- Login throttling, progressive lockout, credential rotation policy, session idle/absolute timeout และ revoke-all
- Mover: revoke old scopes ก่อนเพิ่มใหม่; Leaver: disable immediately, revoke sessions/tokens, retain audit ownership
- Quarterly access review สำหรับ privileged/approval/export roles; dormant account disable ตาม approved period
- Corporate SSO provider ต้องแทน local provider ผ่าน stable subject/claims mapping โดยไม่เปลี่ยน domain user ID (SEC-001)

## 6. Sensitive data and audit

Field classes: Public Internal, Confidential Customer, Commercial Sensitive, Credential/Secret. API serializer mask phone/email, pricing cost/margin และ documents ตาม capability; export ใช้ same policy และ watermark/job audit

Audit event สำหรับ login/admin grant, ownership, export, transition, quote, approval, handoff และ document access ที่ sensitive ต้องมี actor, scope, reason, result, target version และ correlation ID (COMP-001)

## 7. Permission acceptance

- Positive/negative matrix tests ครบทุก role × scope × critical action
- Cross-org/customer guessing ต้องไม่เปิดเผย existence
- Maker-checker, delegated/expired authority, admin self-escalation และ export limits ต้องถูก deny
- Break-glass (เมื่ออนุมัติ OD) ต้อง alert แบบ real time และ review หลังเหตุการณ์

