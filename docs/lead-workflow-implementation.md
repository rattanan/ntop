# Lead Workflow Implementation

## Acceptance criteria

- Lead list แสดงข้อมูลตาม authorization scope แบบ bounded ไม่เกิน 200 รายการ และทุกแถวเปิดหน้า detail ได้
- ผู้มี `record.update` แก้ไข Lead ที่อยู่ใน scope ได้ โดยใช้ optimistic version; stale update ต้องไม่ overwrite
- สถานะ `CONVERTED` เปลี่ยนผ่าน Convert command เท่านั้น และ Lead ที่ Convert แล้วแก้ไขซ้ำไม่ได้
- Convert ทำได้เมื่อ Lead ผ่านการคัดกรอง และรองรับทั้งเชื่อม Customer เดิมหรือสร้าง Customer ใหม่
- Customer ที่เชื่อมต้องอยู่ใน authorization scope; การซ่อนปุ่ม UI ไม่ถือเป็น security control
- หากสร้าง Customer ใหม่แล้วพบ deterministic duplicate ต้องระบุเหตุผล override หรือเลือก Customer เดิม
- Customer, ownership/contact, Lead conversion, receipt และ hash-chained audit ต้องอยู่ transaction เดียวกัน
- Convert ซ้ำด้วย idempotency key เดิมไม่สร้าง Customer หรือ audit ซ้ำ
- API/UI เดิมสำหรับสร้างและอ่าน Lead ยังใช้งานต่อได้ และ schema expansion ไม่มี destructive migration

## Migration policy

- MySQL 8 forward migration: `20260714120000_add_lead_workflow/migration.sql` เตรียมไว้แต่ยังไม่ deploy
- MariaDB 5.5 development compatibility: `prisma/legacy-mariadb-5.5-lead-workflow.sql` ตามด้วย `prisma/legacy-mariadb-5.5-lead-receipt-index.sql`; ไฟล์หลังใช้ hash-backed exact uniqueness เพื่อหลีกเลี่ยง legacy InnoDB index limit

## Phase 1 expansion (2026-07-14)

### Acceptance criteria implemented in this increment

- Workflow transition allowlist is enforced in `LeadService`; `CONVERTED` remains convert-command-only and immutable.
- Every status change is written to `LeadStatusHistory` in the same transaction as the aggregate update and append-only audit event.
- Rule-based scoring, qualification completeness, duplicate normalization, and first-contact SLA are deterministic domain functions with unit tests and centralized defaults.
- Lead list search, filters, sorting, overdue view, archived visibility, and pagination execute on the server and persist in URL query parameters.
- Lead detail exposes activity, assignment, and status timelines within the authorization-bounded query.
- Schema expansion is additive; money uses `Decimal(19,4)` and operational dates use timezone-safe instants.
- CSV import provides a template and server-authorized preview with row validation and scoped duplicate candidates before confirmation.
- Saved Views persist user-scoped filters, default view, and visible columns; users cannot read or delete another user's views.
- Configurable assignment rules support prioritized owner and organization round-robin strategies. Matching, owner availability, assignment, SLA, status/assignment history, receipt, and audit execute in the Lead transaction.

### Migration policy

- MySQL 8: `20260714170000_expand_lead_management/migration.sql`.
- MariaDB 5.5 development compatibility: `prisma/legacy-mariadb-5.5-lead-management.sql`; JSON payloads use `LONGTEXT` because MariaDB 5.5 has no native JSON type.
- Lead operations: `20260714190000_add_lead_operations/migration.sql` or `prisma/legacy-mariadb-5.5-lead-operations.sql` for saved views and assignment rules.
- Apply only after the earlier Lead workflow migrations. Rehearse and back up before applying to any shared environment.

### Architecture expansion approved by the user

- Enterprise roles now include `MARKETING` and `SOLUTION_ARCHITECT`; role codes remain administration-managed strings and legacy authentication is unchanged.
- Lead owns an optional organization unit. SELF, TEAM, ORG_UNIT, and ENTERPRISE reads are enforced by the shared server query scope. Solution Architect scope is additionally constrained to Qualified Leads.
- Manager assignment validates target owner and organization membership, uses optimistic concurrency, writes assignment/status history, receipt, and hash-chained audit in one transaction.
- Conversion creates or links Customer, reuses or creates Contact, creates Opportunity, updates Lead only after all records succeed, and stores Customer/Contact/Opportunity identifiers in the idempotency receipt.
- Lead activity updates `lastContactedAt`, next follow-up, and the first-contact status transition in one audited transaction. Bangkok-local form values are converted to timezone-aware instants.
- Qualification calculates completeness and an explainable rule score. Manager override requires a reason and is audited.
- Campaign, running Lead number, CSV import (1,000 rows/batch), permission-aware CSV export (5,000 rows/request), scoped dashboard aggregates, and follow-up notifications are included.

### API endpoints

- `GET|POST /api/v1/leads`
- `GET|PUT /api/v1/leads/{id}`
- `POST /api/v1/leads/{id}/assign`
- `POST /api/v1/leads/{id}/convert`
- `POST /api/v1/leads/{id}/merge`
- `POST /api/v1/leads/import` (`text/csv`, `Idempotency-Key` required)
- `POST /api/v1/leads/import/preview`
- `GET /api/v1/leads/import/template`
- `GET /api/v1/leads/export`
- `GET|POST /api/v1/leads/views`
- `DELETE /api/v1/leads/views/{id}`
- `GET|POST /api/v1/leads/assignment-rules` (Admin only)

Every mutation requires a session, scoped authorization, validated input, and an idempotency key where it can create a duplicate business effect.

### Permission summary

| Role | Scope and Lead capability |
|---|---|
| KAM | Own Leads; create, update, activity, qualify, convert |
| Team Manager / Sales Director | Team or organization Leads; assign/reassign and qualification override |
| Solution Architect | Qualified Leads in assigned organization; add Lead activity/technical note |
| Marketing | Create/import campaign Leads and export without estimated budget |
| Admin | Enterprise Lead administration and audit visibility |

### Demo seed and manual test

Demo data is never seeded by default. Set `SEED_DEMO_DATA=1` and a 12+ character `SEED_DEMO_PASSWORD` in a test environment, then run `npm run db:seed`. This creates three synthetic sales users, one manager, one marketer, one solution architect, two campaigns, and twenty synthetic Leads. In demo mode an existing active Admin can be reused without changing its password; otherwise Admin credentials still come from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

The MariaDB 5.5 Lead management and Lead operations migrations were applied successfully to the disposable `ntop` test database on 2026-07-14. Demo seed and real-database integration tests completed successfully after migration.

Manual smoke flow: sign in as a sales user, create a Lead, have the manager assign it, record a contact activity, complete Qualification, then Convert with Customer and Opportunity data. Confirm links to Customer and Opportunity, status/assignment/activity timelines, and audit events. Repeat Convert with the same idempotency key and verify no additional records are created.

### Known limitations

- Excel import is not enabled because the project has no existing Excel dependency; CSV is supported without adding a large dependency.
- Import uses partial-row processing and a bounded synchronous batch. Atomic import and resumable background jobs remain follow-up work.
- Lead merge transfers activities but attachment transfer remains follow-up work because no attachment aggregate exists in the current Lead architecture.
- A custom-field builder remains follow-up work and requires a separately approved data-model/migration design.
