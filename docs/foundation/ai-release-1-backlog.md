# NTOP AI Release 1 Implementation Backlog

| Metadata | Value |
|---|---|
| Status | Approved Backlog — Story DoR Required |
| Version | 1.0 |
| Owner | Product / AI Foundation Delivery Lead |
| Requirements | FR-013–016, NFR-005, SEC-004, DATA-005, OPS-005 |
| Related | [AI Design](../ai-design.md), [DoR](definition-of-ready-checklist.md), [RTM](requirements-traceability-matrix.md), [Testing](../testing-strategy.md) |

## Current-state gaps

- No automated test framework or `test` script
- Authorization is direct `ADMIN/SALES/VIEWER` branching rather than permission policy
- No append-only audit framework
- Server actions are concentrated in `app/actions.ts`
- Current meeting `aiSummary`/`actionItems` are local heuristics and must remain backward compatible until replacement is verified
- No AI configuration, encrypted secret, provenance, job, feedback or risk-rule persistence

These are prerequisites, not permission to rewrite unrelated modules

## Delivery rules

- Every story passes [Definition of Ready](definition-of-ready-checklist.md)
- Before code changes list exact files; keep one module/scope per task
- Every schema change has a forward migration and compatibility plan
- Every behavior has unit/integration tests; server authorization and audit are mandatory
- Money remains Decimal; timestamps stored UTC and displayed Asia/Bangkok
- No secret/mock data in production paths

## Epic A — Safe foundation

| ID | Story | File/module scope | Dependencies | Acceptance criteria/tests | Status |
|---|---|---|---|---|---|
| AI-001 | Add Vitest test foundation and `test`/`typecheck` scripts | package config, test config only | none | unit test runs locally/CI; lint/typecheck/test/build commands documented; existing build unchanged | Implemented |
| AI-002 | Introduce permission-policy interface without changing existing behavior | Identity/Auth module only | AI-001, FND-006 | current ADMIN/SALES/VIEWER behavior covered by regression tests; `ai.config.manage` evaluated server-side; UI hiding not relied on | Implemented |
| AI-003 | Introduce append-only audit writer contract | Audit module only | AI-001, AI-002, FND-007 | transaction-compatible API; redaction tests; audit failure policy defined; no secrets in events | Implemented with persistent ledger |
| AI-004 | Split AI-related actions/routes from monolithic `app/actions.ts` without changing existing actions | AI module/routing only | AI-001–003, ADR-001 | existing actions remain backward compatible; import boundaries pass; no unrelated rewrite | Implemented |

## Epic B — Provider administration

| ID | Story | File/module scope | Dependencies | Acceptance criteria/tests | Status |
|---|---|---|---|---|---|
| AI-010 | Add versioned AI provider configuration persistence | Prisma AI config model + migration only | AI-003, ADR-033 | singleton/version invariant; enabled/url/model/timeout + ciphertext/nonce/tag; forward migration; no plaintext column | Implemented — MySQL 8 forward migration plus MariaDB 5.5 development compatibility migration |
| AI-011 | Implement AES-256-GCM configuration encryption | AI crypto helper only | AI-001, AI-010 | random nonce; authenticated encryption; wrong key/tamper fail closed; key never logged; unit tests | Implemented |
| AI-012 | Implement Admin provider read/update service | AI application service only | AI-002/003/010/011 | non-secret read; write-only replacement key; timeout/url/model validation; transaction + audit; non-Admin denied | Implemented — runtime migration gate |
| AI-013 | Implement OpenAI-compatible client and sanitized Test Connection | AI provider adapter only | AI-011/012 | bounded timeout; no public fallback; sanitized errors; no key/raw response logs; adapter unit/integration tests | Implemented |
| AI-014 | Build Admin AI settings UI | Admin AI page/components only | AI-012/013 | fields: enabled/url/model/key/timeout; configured flag; connection result sanitized; server auth negative test | Implemented — requires environment master key and the target-database migration |

## Epic C — AI execution and governance

| ID | Story | File/module scope | Dependencies | Acceptance criteria/tests | Status |
|---|---|---|---|---|---|
| AI-020 | Add AI output/job/feedback persistence | Prisma AI governance models + migration only | AI-003, DATA-005 | provenance/version/status/expiry fields; no raw prompt/full response by default; indexes/retention fields; migration tests | Implemented — MySQL 8 migration gate |
| AI-021 | Implement AI job runner abstraction | AI Jobs module only | AI-013/020 | idempotent create/claim/cancel; bounded retry; non-retryable safety errors; quota/concurrency config; tests for duplicate/crash/timeout | Implemented — durable Prisma repository and environment policy wired |
| AI-022 | Implement input policy and output schema validation | AI Safety module only | AI-001/002 | capability allowlists, size/secret checks, strict schemas, prompt-injection isolation; unauthorized fields rejected before provider call | Implemented |
| AI-023 | Implement provenance, feedback and abandoned-metadata purge | AI Governance module only | AI-003/020–022 | Helpful/Incorrect/Unsafe; feedback not training consent; 30-day purge; legal-hold hook; audit/redaction/reconciliation tests | Implemented — scheduler/persistence wiring gate |
| AI-024 | Add capability feature flags and operational telemetry | AI Operations module only | AI-013/021 | per-capability enable/disable; latency/error/queue/token metrics; no prompt content; AI disabled/outage leaves manual flows operational | Implemented |

## Epic D — Meeting Draft and Next Action

| ID | Story | File/module scope | Dependencies | Acceptance criteria/tests | Status |
|---|---|---|---|---|---|
| AI-030 | Define/version Meeting Draft schema and prompt template | AI Meeting module only | AI-022, ADR-034 | approved seven output groups only; unknown stays empty; Thai/English fixture tests; no autonomous fields | Implemented |
| AI-031 | Generate Meeting Draft from typed/pasted text | AI Meeting application/API only | AI-021/022/030 | text only; no audio/video/file/transcription/web; user attestation for pasted transcript; timeout/manual fallback; provenance | Implemented — runtime job/repository wiring gate |
| AI-032 | Add Meeting Draft review/select/confirm UI | Activity create UI only | AI-031 | editable/selectable fields; clear Draft label; no save without user confirmation; existing manual Activity form preserved | Implemented — migration/runtime generation-entry gate |
| AI-033 | Persist confirmed Meeting fields transactionally | Activity + AI provenance transaction only | AI-003/020/032 | selected fields only; server auth; transaction and audit; existing heuristic records remain readable; integration tests | Implemented — migration application gate |
| AI-034 | Confirm Next Action into one Activity/Task | Activity confirmation service/UI only | AI-003/020/033, ADR-035 | idempotent; authorized owner; Customer/Opportunity context; UTC storage/Asia-Bangkok display; manual task unchanged | Implemented — migration application gate |

## Epic E — Deal Risk/Pipeline Health

| ID | Story | File/module scope | Dependencies | Acceptance criteria/tests | Status |
|---|---|---|---|---|---|
| AI-040 | Add versioned risk-rule configuration and signals | Prisma Risk models + migration only | AI-003, ADR-036 | no hard-coded role/stage/threshold; effective versions; immutable historical signal evidence; migration tests | Implemented — MySQL 8 migration gate |
| AI-041 | Implement deterministic risk evaluator | Opportunity/Forecast risk module only | AI-001/040 | same facts/version same result; no-follow-up/overdue/missing-next-action fixtures; Decimal/timezone safe; unit tests | Implemented |
| AI-042 | Build Admin risk-rule management | Admin Risk page/service only | AI-002/003/040/041 | server-authorized CRUD/version/activate; invalid config denied; audit; non-Admin tests | Implemented — migration application gate |
| AI-043 | Show risk signals in Opportunity/Pipeline | Opportunity read UI/query only | AI-041 | rule/version/threshold/facts visible; works without AI; no existing workflow mutation | Implemented — migration application gate |
| AI-044 | Add optional AI explanation/Next Action suggestion | AI Risk adapter/UI only | AI-021–024/041/043 | deterministic signal remains source of truth; explanation failure degrades cleanly; confirmation uses AI-034 | Implemented — provider configuration/UAT gate |

## Explicit Release 1 negative scope tests

- No browser/search/research connector or arbitrary URL fetch
- No audio/video/media or transcript-file upload and no transcription job
- No AI-created Opportunity/Quote/Approval/Order or stage transition
- No Proposal/TOR authoring or document analysis
- No Pricing Recommendation or numeric AI forecast
- No automatic external/public provider fallback

## Recommended sequence

1. AI-001–004
2. AI-010–014 and AI-020–024
3. AI-030–034
4. AI-040–044
5. Full AI-disabled/provider-down regression, security review and Release 1 UAT

Do not combine provider administration, Meeting Draft and Deal Risk schema changes into one migration/task Each epic must be independently reviewable and reversible
