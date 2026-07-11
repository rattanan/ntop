# NTOP Sprint 0 Plan — Foundation Readiness

| Metadata | Value |
|---|---|
| Status | Approved for Planning/Readiness Work |
| Duration | 2 weeks / 10 working days |
| Owner | Product Director and Foundation Delivery Lead |
| Last updated | 2026-07-11 |
| Related | [Foundation Backlog](foundation-backlog.md), [RTM](requirements-traceability-matrix.md), [ADR Register](adr-register.md), [DoR](definition-of-ready-checklist.md) |

## Sprint goal

ทำให้ Foundation implementation สามารถเริ่มได้อย่างมี governance โดยปิดเอกสาร/contract/experiment ที่ reversible และสร้าง evidence สำหรับ Architecture/Security/Data/Operations review ค่า OD-001–006 ที่อนุมัติแล้วต้องเป็น versioned configuration/policy และห้ามฝังใน domain logic

## Committed work

| Work package | Backlog | Output | Owner | Dependencies | Acceptance/evidence |
|---|---|---|---|---|---|
| Governance and traceability | FND-001/025 | version/change rules, RTM format, quality evidence model | Product + QA | workshop pack | reviewers/approval path named; 38 requirements traceable |
| Architecture boundary | FND-002/003 | ADR-001 draft, module/context dependency diagram, forbidden dependency rules | Enterprise/App Architecture | governance | all modules mapped; exceptions documented |
| Identity boundary | FND-004/006 | provider/subject and authorization policy contracts | Security Architecture | module map | local/SSO mapping and deny-by-default scenarios reviewed |
| Audit contract | FND-007 | audit envelope/redaction/tamper options | Security + Audit | authorization contract | critical actions mapped; secrets/PII rules explicit |
| MySQL 8 readiness plan | FND-010/011 | environment specification and migration rehearsal plan | DBA/Data Architecture | ADR-002 draft | TLS/accounts/topology/migration evidence checklist complete |
| API governance | FND-019 | `/api/v1`, errors, cursor, idempotency and concurrency conventions | App Architecture | authorization | OpenAPI rules and contract test approach reviewed |
| Quality and threat baseline | FND-025/030 | CI gate design, threat model workshop outputs | QA/DevSecOps/Security | above contracts | Critical threats/control/test owners mapped |

## Discovery/stretch only

- [FND-012 ID benchmark design](discovery/id-benchmark-plan.md)
- [FND-013 platform evaluation scorecard](discovery/platform-evaluation-scorecard.md)
- [FND-020 outbox/inbox spike design](discovery/outbox-inbox-spike-plan.md)
- [FND-022 telemetry catalog](discovery/telemetry-catalog.md)

Stretch work cannot displace committed governance/security/data outputs

## Explicitly excluded

- Application feature coding or schema migration
- Production infrastructure procurement/provisioning
- Activation of merge, retention, approval tiers or pilot users
- Live integration implementation
- Production data import

## Daily sequence

| Day | Focus | Review point |
|---:|---|---|
| 1 | kickoff, owners, scope, risk/OD guardrails | Product/Delivery |
| 2–3 | module/API/identity boundaries | Architecture/Security |
| 4 | audit and threat modeling | Security/Audit |
| 5 | MySQL/migration readiness | Data/DBA/Operations |
| 6–7 | ADR drafts, RTM and quality gates | Architecture/QA |
| 8 | cross-document consistency walkthrough | all workstream leads |
| 9 | close review findings and decision dependencies | Product/Architecture |
| 10 | Sprint 0 evidence review and Foundation readiness recommendation | governance quorum |

## Exit recommendation

Use one status:

- `Ready for Approved Safe-to-Start Foundation Work`
- `Ready with Non-blocking Actions`
- `Not Ready`

Any unresolved Critical threat, missing accountable owner, broken requirement trace, or attempted activation of simulated policy results in `Not Ready`

ADR-001/002/004 decisions use the [Architecture Review Pack](reviews/architecture-review-pack.md); Sprint 0 cannot mark them Accepted without recorded authority and review minutes.

## Exit evidence

- RTM 38/38 mapped
- ADR register owners/status/evidence defined
- committed outputs reviewed with findings/actions
- DoR applied to next candidate stories
- OD-dependent stories remain conditional/blocked
- no feature code/schema/infrastructure mutation occurred during Sprint 0 planning
