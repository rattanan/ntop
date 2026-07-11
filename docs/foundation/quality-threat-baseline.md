# Quality Gates and Threat Baseline

| Metadata | Value |
|---|---|
| Status | In Review |
| Version | 0.1 |
| Owner | QA / DevSecOps / Information Security |
| Requirements | SEC-001–003, NFR-001–004, OPS-001–004, COMP-001 |
| Related | [Testing Strategy](../testing-strategy.md), [DoR](definition-of-ready-checklist.md) |

## CI quality gates

| Stage | Required evidence | Blocks |
|---|---|---|
| Pull request | lint/type/unit, targeted integration/contract, SAST, dependencies, secrets | merge |
| Main/nightly | full integration, migration compatibility, permission matrix, critical E2E | release candidate |
| Release candidate | performance delta, DAST, restore smoke, SBOM, UAT evidence | production approval |
| Production gate | 2.5M/100-user evidence, security, failover/restore/DR, runbooks | go-live |

Critical/High unauthorized access, data loss, approval bypass, migration/recovery failure or secret exposure always blocks promotion

## Threat baseline

| Threat | Control | Verification owner |
|---|---|---|
| Credential/session takeover | MFA, lockout, secure cookies, revoke-all, rotation | Security QA |
| Cross-org data leakage/IDOR | scoped authorization, 404 masking, query predicates | Security/Product QA |
| Privilege/approval escalation | maker-checker, effective delegation, policy snapshot/audit | Commercial/Security QA |
| Injection/XSS/CSRF/SSRF | validation, parameterized data access, output encoding, CSRF/egress controls | AppSec |
| Bulk import/file attack | staging, type/size allowlist, malware scan, quarantine | Data/Security QA |
| Duplicate/replay effects | idempotency, optimistic concurrency, inbox/outbox | Integration QA |
| Audit tampering | append-only store, restricted access, integrity verification | Audit/Security |
| Data loss/failover inconsistency | backup/binlog, reconciliation, restore/failover tests | DBA/SRE |
| Search/cache leakage | permission facets, short TTL/invalidation, no secrets | Security/Architecture |
| Supply chain/secrets | lockfiles/SBOM/scans/vault/no secrets in logs | DevSecOps |

## Sprint 0 exit

Threat owners and planned tests must be assigned No unresolved Critical threat, missing authorization boundary or absent recovery plan Sprint 0 produces design evidence only; implementation test evidence remains pending

