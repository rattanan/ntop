# NTOP Definition of Ready Checklist

| Metadata | Value |
|---|---|
| Status | Approved Process |
| Version | 1.0 |
| Owner | Product Owner / Delivery Lead / QA Lead |
| Last updated | 2026-07-11 |
| Related | [Foundation Backlog](foundation-backlog.md), [RTM](requirements-traceability-matrix.md), [Sprint 0](sprint-0-plan.md) |

## Decision rule

ทุก Mandatory item ต้อง `Pass` พร้อม evidence `N/A` ต้องมี rationale/approver Story ที่เป็น `Conditional` หรือ `Blocked Until Approval` ห้าม reclassify หากไม่มี signed decision reference

## Checklist

| Area | Mandatory readiness check | Result | Evidence/owner |
|---|---|---|---|
| Intent | outcome และ user/business value ชัดเจน | — | — |
| Trace | requirement IDs, risk IDs และ epic/story ID ถูกต้อง | — | — |
| Authority | accountable owner และ required reviewers named | — | — |
| Decision | OD/ADR dependencies มี approved reference หรือ story จำกัดแค่ discovery | — | — |
| Scope | in/out of scope และ non-goals ชัดเจน | — | — |
| Domain | aggregate/invariant/event impact reviewed | — | — |
| Data | classification, owner, schema/migration/retention impact identified | — | — |
| API | request/response/error/idempotency/version impact specified | — | — |
| Permission | role/scope/SoD positive and negative cases specified | — | — |
| Security | threat/control/secrets/encryption/log-redaction reviewed | — | — |
| Operations | SLO, metrics, alerts, runbook/support impact identified | — | — |
| Failure | timeout/retry/concurrency/degradation/recovery behavior specified | — | — |
| Testing | unit/integration/contract/E2E/NFR evidence and owner identified | — | — |
| Dependency | upstream/downstream/team/environment dependencies resolved | — | — |
| Delivery | acceptance criteria observable and independently testable | — | — |
| Rollout | feature flag, migration order, compatibility and rollback identified | — | — |
| Data safety | no production data or destructive action without explicit approval | — | — |
| Simulation guard | no simulated value treated as approved/hard-coded | — | — |

## Classification outcome

- [ ] **Safe to Start** — all mandatory checks pass and no unapproved decision dependency
- [ ] **Conditional Discovery Only** — reversible discovery/spike allowed; activation blocked
- [ ] **Blocked Until Approval** — policy/value/authority/procurement/data dependency unresolved
- [ ] **Not Ready** — quality/security/ownership/acceptance information incomplete

**Story:**  
**Reviewer roles:**  
**Decision/ADR references:**  
**Open actions and due dates:**  
**Classification date/expiry:**

## Foundation-specific blockers

The following always block activation/implementation:

- Missing approved design/test evidence for merge execution
- Missing approved retention job design, legal-hold and backup tests
- Missing approved technical configuration/release evidence for commercial tiers
- Missing accepted ADR/capacity/procurement evidence for production HA/DR
- Missing named pilot division, data-readiness and user-provisioning approval
- Critical threat or cross-scope authorization gap
- migration/rollback or required test evidence absent
