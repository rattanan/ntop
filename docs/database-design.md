# NTOP Database Design

| Metadata | Value |
|---|---|
| Status | Draft for Review |
| Version | 0.1 |
| Owner | Data Architecture |
| Reviewers | Domain Architecture, DBA, Security, Data Governance, Integration, QA |
| Last Updated | 2026-07-11 |
| Related Documents | [Requirements](product-requirements.md), [Architecture](system-architecture.md), [Domain](domain-model.md), [API](api-design.md), [Testing](testing-strategy.md) |
| Assumptions | MySQL 8 InnoDB Cluster production; UTC storage; UUIDv7/ULID-style sortable opaque IDs selected during implementation ADR |
| Open Decisions | Final ID encoding; partition thresholds; retention periods; approved online migration tool; encryption/KMS product |

## 1. Design principles

- Normalized transactional schema; denormalized search/analytics เป็น projection
- Stable opaque internal ID ไม่ผูกกับ tax ID หรือ external system (DATA-001)
- `created_at`, `updated_at`, `version` สำหรับ mutable aggregates; UTC `DATETIME(6)`
- Monetary fields ใช้ `DECIMAL(19,4)` + ISO currency; percentage ใช้ `DECIMAL(7,4)` ไม่ใช้ float
- Soft delete ใช้เฉพาะเมื่อ business retention ต้องการ; immutable commercial/audit facts ห้าม delete ผ่าน application
- Foreign key และ unique constraints ป้องกัน invariant ที่ database ตรวจได้

## 2. Logical schema groups

| Group | Principal tables |
|---|---|
| Identity | `users`, `credentials`, `mfa_factors`, `sessions`, `roles`, `role_assignments`, `organization_units` |
| Customer | `customers`, `customer_external_ids`, `customer_relationships`, `contacts`, `ownership_assignments`, `customer_merge_history` |
| Sales | `leads`, `lead_conversion_history`, `activities`, `opportunities`, `opportunity_stage_history` |
| Presales | `products`, `product_versions`, `coverage_checks`, `coverage_results`, `solution_versions`, `solution_items` |
| Commercial | `quotes`, `quote_versions`, `quote_items`, `approval_policies`, `approval_policy_versions`, `approval_requests`, `approval_steps`, `approval_decisions` |
| Order | `internal_orders`, `order_handoff_versions`, `handoff_attempts`, `external_references` |
| Forecast | `forecast_snapshots`, `forecast_items`, `forecast_quality_metrics` |
| Platform | `documents`, `outbox_events`, `inbox_receipts`, `background_jobs`, `audit_events`, `integration_reconciliation` |

## 3. Customer scale and indexing

- `customers`: PK internal ID; indexes `(status, id)`, `(segment, id)`, `(owner_id, status, id)`, `(organization_unit_id, status, id)`, `(updated_at, id)`
- `customer_external_ids`: unique `(source_system, external_id)`; lookup index `(customer_id, source_system)`
- tax/legal identifier: normalized field + jurisdiction/type; uniqueness เป็น Open Decision ไม่บังคับ global unique ก่อน OD-001
- hierarchy: adjacency relationship + unique `(parent_id, child_id, relationship_type)`; cycle validation ใน domain service; optional closure table เมื่อ benchmark พิสูจน์ว่าจำเป็น
- Cursor เป็น signed/opaque encoding ของ deterministic sort tuple เช่น `(updated_at, id)`; ห้าม arbitrary offset เกิน operational limit (FR-010)
- OpenSearch document เก็บ searchable customer summary และ permission facets; ไม่เก็บ secret fields; projection มี `source_version` สำหรับ reconcile

## 4. History, audit and deletion

- Ownership ใช้ effective-dated rows (`valid_from`, `valid_to`) และ constraint ให้ active assignment เดียวต่อ scope
- Opportunity stage/history, quote versions, approval decisions, handoff versions และ forecast snapshots เป็น append-only
- `audit_events` มี actor, action, target, before/after redacted summary, reason, request/correlation ID, timestamp และ hash/tamper-evidence field (COMP-001)
- Referential deletion policy: restrict สำหรับ commercial/order; cascade เฉพาะ dependent draft detail; customer anonymization/retention รอ COMP-002

## 5. Partition and archive

- Candidate time partitions: `audit_events`, `activities`, `outbox_events`, `inbox_receipts`, `forecast_items`; เริ่ม partition เมื่อ benchmark/volume model ยืนยัน ไม่ทำ premature partition
- Outbox/inbox เก็บ hot rows ตาม replay window แล้ว archive/purge ตาม approved retention
- Historical forecast และ commercial evidence ย้าย archive ได้แต่ต้อง query ผ่าน governed service
- ทุก archive job มี reconciliation count/checksum และ legal-hold bypass

## 6. Migration strategy

1. MariaDB 5.5 เป็น local compatibility environment เท่านั้น; ห้ามใช้เป็น production schema authority
2. สร้าง MySQL 8 integration environment ตั้งแต่ Foundation phase
3. ใช้ forward-only versioned SQL migrations; migration มี expand/backfill/verify/contract phases
4. Schema change ต้อง backward compatible อย่างน้อยหนึ่ง release; online DDL/tool สำหรับ large tables
5. Seed/reference data versioned แยกจาก production customer data
6. ก่อน production data onboarding ทำ rehearsal ด้วย masked/synthetic volume, checksum, rollback และ timing evidence
7. Full migration ถูก defer จน Customer/Production gates ผ่าน (R-01, DATA-003)

## 7. Backup, recovery and encryption

- Full + incremental/binlog backups, encrypted at rest/in transit และแยก failure domain
- Restore exercise อย่างน้อยรายไตรมาส; failover exercise ก่อน go-live
- Target draft: RPO ≤15 minutes, RTO ≤4 hours (OPS-003/OD-005)
- Least-privilege DB accounts แยก app, migration, read-only reporting, backup และ operations
- Logs/backups/object exports ต้องใช้ retention และ key rotation ที่ได้รับอนุมัติ

## 8. Data quality and reconciliation

- Import เข้า staging พร้อม batch ID, row number, normalized values, validation status และ error codes
- Promote เฉพาะ accepted rows ด้วย idempotency key; rejection report ต้องไม่มี secret leakage
- Metrics: accepted/rejected/duplicate/merged counts, source checksum, target checksum, unresolved exceptions
- MySQL↔OpenSearch และ NTOP↔external systems มี scheduled reconcile และ repair queue (DATA-002, INT-004)

## 9. Database acceptance

- Query plans ของ critical lookup/search fallback/pagination ไม่มี full scan ที่ volume target
- Migration upgrade/rollback compatibility ผ่าน rehearsal
- Restore/failover และ data consistency ผ่าน test strategy
- Domain-to-table mapping ใน [domain-model.md](domain-model.md) และ API optimistic concurrency ใช้ `version`

