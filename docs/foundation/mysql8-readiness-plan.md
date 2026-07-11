# MySQL 8 Environment and Migration Readiness Plan

| Metadata | Value |
|---|---|
| Status | In Review |
| Version | 0.1 |
| Owner | DBA / Data Architecture / IT Operations |
| Requirements | DATA-002, NFR-001, OPS-003 |
| Related | [ADR-002](adrs/ADR-002-mysql8-innodb-cluster.md), [Database Design](../database-design.md) |

## Environment specification

- MySQL 8 supported release, 3-member InnoDB Cluster across failure domains
- Router/proxy endpoint, TLS, encrypted storage and secrets-vault credentials
- Accounts separated: application, migration, read-only diagnostics, backup and operations
- UTC, strict SQL mode, utf8mb4/collation approved for Thai/English search semantics
- Monitoring: replication/cluster state, connection/pool, locks, slow queries, storage, backup and binlog lag
- No production customer data in readiness environment

## Migration workflow

1. Expand backward-compatible schema
2. Deploy compatible application version
3. Backfill in bounded resumable batches
4. Verify counts/checksums/invariants and performance
5. Switch reads/writes behind controlled release
6. Contract obsolete schema only after compatibility window

Every migration has owner, estimate, lock/online-DDL analysis, rollback/forward-fix, monitoring and rehearsal evidence No direct production schema editing

## Rehearsals

- Prisma/client compatibility without making Prisma Migrate responsible for MariaDB 5.5
- representative table/index/query plan at 2.5M customers
- online schema change under workload
- primary failover with idempotent transaction retry
- full + binlog restore to isolated environment and reconciliation
- backup encryption/key access and deleted/legal-hold data behavior

## Exit checklist

- [ ] topology/product/support approved
- [ ] TLS/accounts/secrets verified
- [ ] sample expand/backfill/verify/contract migration passed
- [ ] p95/query plans meet targets
- [ ] failover/restore meet RPO15/RTO4 target
- [ ] runbooks, alerts, owners and corrective actions reviewed

