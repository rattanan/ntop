# ADR-002: MySQL 8 InnoDB Cluster for Production Transactions

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-11 |
| Owners | Data Architecture and DBA |
| Authority | Architecture Board + IT Operations |
| Requirements | DATA-002, NFR-001, OPS-003 |
| Backlog | FND-010, FND-011 |
| Accepted | 2026-07-11 — project owner confirmation in Codex task |

## Context

MariaDB 5.5 ใน development ไม่รองรับ production-grade migration, support และ HA target Approved baseline กำหนด MySQL 8 InnoDB Cluster, RPO ≤15m และ RTO ≤4h แต่ topology/tooling ยังต้องผ่าน operational evidence

## Options

1. **MySQL 8 InnoDB Cluster (recommended):** relational compatibility, group replication, supported tooling
2. Modern MariaDB cluster: compatibility บางส่วนแต่ diverges จาก approved target
3. PostgreSQL HA: strong platform แต่เพิ่ม migration/toolchain change
4. MySQL NDB Cluster: high availability แต่ data/query semantics ไม่เหมาะโดยไม่มี workload proof

## Proposed decision

ใช้ MySQL 8 InnoDB Cluster อย่างน้อย 3 members ในแยก failure domains ผ่าน approved router/proxy Application ใช้ connection pooling, TLS และ least-privilege accounts Search/analytics เป็น projection แยก ไม่ใช้ replica เป็น permission bypass

## Consequences and controls

- Forward-only expand/backfill/verify/contract migrations
- Backward compatibility อย่างน้อยหนึ่ง release; online DDL สำหรับ large tables
- Automated encrypted backup + binlog, quarterly restore, pre-go-live failover/DR
- MariaDB 5.5 เป็น development compatibility only และไม่เป็น schema authority
- Reversal ต้องผ่าน migration ADR และ data rehearsal; ห้าม dual-write แบบไม่มี reconciliation

## Evidence required

- [MySQL Readiness](../mysql8-readiness-plan.md) checklist complete
- compatibility/load/failover/restore rehearsal
- support/version, topology, router and backup products approved

## Acceptance record

Accepted unchanged on 2026-07-11 by explicit project owner instruction (“Accepted all”). This accepts the technical direction, not a specific SKU/topology or evidence that failover/restore targets have already been achieved. Named Architecture/Data/Operations signatures remain administrative attachments.
