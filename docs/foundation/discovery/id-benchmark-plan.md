# Internal ID Benchmark Plan

| Metadata | Value |
|---|---|
| Status | Discovery Ready |
| Backlog | FND-012 / ADR-003 |
| Owner | Data and Application Architecture |
| Requirements | DATA-001, NFR-001 |

## Question

เลือก stable opaque sortable ID ระหว่าง UUIDv7 binary/text และ ULID โดยไม่เปิดเผย business meaning และรองรับ index/pagination ที่ 2.5M+ customers

## Candidates and workload

- UUIDv7 stored `BINARY(16)` with canonical API string
- UUIDv7 stored `CHAR(36)` as comparison baseline
- ULID stored `BINARY(16)`/`CHAR(26)`

Generate deterministic 2.5M IDs plus related insert bursts Test PK/secondary-index size, insert throughput, random/exact lookup, `(updated_at,id)` cursor pagination, sort locality, serialization and collision/clock-skew behavior

## Controls and acceptance

- Same MySQL version/schema/resources and repeated warm/cold runs
- Report p50/p95/p99, storage/index bytes, CPU/IO and query plans
- No candidate accepted if collision, unstable ordering under clock skew or cross-language round-trip mismatch
- Decision weights: correctness 40%, index/storage 25%, performance 20%, ecosystem/operability 15%
- Output: reproducible scripts/results, recommendation and ADR-003 update; this plan does not authorize schema migration

