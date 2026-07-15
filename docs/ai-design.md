# NTOP AI Assistance Design

| Metadata | Value |
|---|---|
| Status | Approved Baseline |
| Version | 1.0 |
| Owner | Product / AI Governance |
| Reviewers | Sales Operations, Security, Data Governance, Architecture, QA, SRE |
| Last Updated | 2026-07-11 |
| Related Documents | [Requirements](product-requirements.md), [Architecture](system-architecture.md), [API](api-design.md), [Testing](testing-strategy.md), [Glossary](../CONTEXT.md), [FAQ](../FAQ.md) |
| Scope | AI Release 1 plus governance boundaries for later releases |

## 1. Principles

- **AI proposes, human decides:** AI suggests or drafts; authorized users confirm all business mutations
- **Optional capability:** AI outage never blocks Customer, Activity, Opportunity, Quote, Approval or Order workflows
- **Least privilege:** input is limited by user permission, capability allowlist and data classification; secrets are always excluded
- **Grounded and explainable:** cite permitted sources, expose conflicts, separate facts/inferences/recommendations and abstain when evidence is insufficient
- **Simple operations:** Admin manages one OpenAI-compatible provider; no automatic public fallback
- **No hard-coded policy:** model/provider, timeouts, quotas and risk thresholds are configuration

## 2. Release scope

### Release 1

1. Admin AI Provider Configuration and Test Connection
2. Meeting/Visit Draft from typed or pasted text only
3. Next Action Recommendation converted to Activity/Task after Human Confirmation
4. Deterministic Deal Risk/Pipeline Health with optional AI explanation
5. Provenance, feedback, audit, bounded timeout/quota and manual fallback
6. Human-triggered Proposal Draft generation from authorized Opportunity,
   Customer, Meeting Note, Product and Template context, delivered by the
   additive Proposal Phase 1 increment

### Release 1 exclusions

- Public-web Research Connector and web browsing
- Recording, audio/video upload, transcription and transcript-file upload
- AI Opportunity generation or stage mutation
- TOR authoring and uploaded-document authoring/analysis
- Uploaded-document analysis
- Pricing Recommendation
- Numeric AI probability/revenue forecast
- Provisioning, Customer Success and Renewal prediction

### Later releases

- **Release 2:** Research Connector, Opportunity Finder/Territory Planning, Opportunity Draft, read-only Document/TOR Analysis and Pricing Recommendation
- **Release 3:** calibrated Forecast/Revenue, Provisioning, Customer Success and Renewal predictions after representative data/evaluation gates

Proposal Draft generation is governed by
[`proposal-quotation-phase1-implementation.md`](proposal-quotation-phase1-implementation.md).
It is editable, strictly schema-validated and never changes pricing, Opportunity,
Approval or workflow state autonomously.

## 3. Phase 1 capabilities

### Admin Provider Configuration

Fields: `enabled`, `apiUrl`, `model`, write-only `apiKey`, `requestTimeoutMs`; action `Test Connection` returns success or sanitized error only Admin authorization is enforced server-side API key is authenticated-encrypted in database using environment `AI_CONFIG_MASTER_KEY`; API returns only `apiKeyConfigured`

Provider environment/bootstrap names are `OPENAI_API_URL`, `OPENAI_API_KEY` and `OPENAI_MODEL` Existing or chat-provided secret values must never appear in source, docs, UI responses, logs or audit and should be rotated after exposure

### Meeting/Visit Draft

Input is typed/pasted text after a meeting Pasted external transcript is treated as user-provided text with user attestation Release 1 has no audio/video/file/transcription path

Strict output schema:

- Meeting Summary
- Key Requirements
- Decisions/Agreements
- Action Items with suggested owner/due date
- Risks/Concerns
- Suggested Next Action
- Suggested Activity type/date

Unknown fields remain empty/unknown User reviews, edits and selects fields to save No Opportunity, Quote, Proposal or Stage mutation is permitted

### Next Action

An AI Suggestion creates no record until confirmation Confirmation creates one Activity/Task with Customer/Opportunity context, authorized owner and timezone-correct due date Default owner is the confirming user Duplicate confirmation is idempotent Saved record retains provenance link

### Deal Risk/Pipeline Health

Triggering is deterministic and based on versioned Admin configuration by risk type, stage and segment Examples include no follow-up, overdue close date and missing next action AI explains impact/recommended action only Every signal shows rule/version, threshold and triggering facts Historical snapshots do not change after rule edits

## 4. AI provider and execution

- Core workflow calls do not wait for AI
- Short requests use bounded timeout; long work uses cancellable/idempotent AI Jobs
- Concurrency/quota applies per user/team/capability and is configured, not role-hard-coded
- Retry transient failures only; safety/validation rejection is non-retryable
- Circuit breaker, feature flag and manual fallback are mandatory
- No automatic fallback to a different/public provider
- Admin endpoint/model changes are accepted without shadow/canary in this simple phase; changes and key rotation are audited

## 5. Data, safety and provenance

Allowed inputs are capability-specific minimum fields the user can access Public/Internal data may be used; Customer Confidential/Commercial Sensitive only for approved capabilities and masked where possible Passwords, API keys, tokens, MFA secrets, private keys and credentials are never sent

Every output records:

- capability and output-schema version
- provider/model identifier
- prompt/template version
- authorized input-source references
- timestamp, latency/token usage and confidence band
- safety result and Human Confirmation actor/time when saved

Raw prompts/full model responses are not stored by default Confirmed content follows business-record retention Rejected/abandoned drafts retain redacted metadata/reason for at most 30 days AI Feedback (`Helpful`, `Incorrect`, `Unsafe`) is not training consent Evaluation datasets require Data Governance approval and de-identification

## 6. Grounding and confidence

Phase 1 has no public-web research Internal/user-provided facts must keep source references When evidence conflicts, display values, sources and dates and do not update Customer master automatically Source authority is approved NT master/contract → approved internal document → authoritative external source → general web

Before representative calibration, show `Low/Medium/High` confidence only Numeric model probabilities are prohibited Official Opportunity probability remains human-confirmed Rule-based signals are labelled separately from AI predictions

## 7. Interfaces

Representative future `/api/v1` resources:

- `GET/PUT /admin/ai-provider` — returns non-secret fields and `apiKeyConfigured`; PUT accepts optional replacement key
- `POST /admin/ai-provider/test` — sanitized connection result
- `POST /ai/meeting-drafts` — typed/pasted text, Customer/Opportunity context and idempotency key
- `GET /ai/jobs/{id}` / `POST /ai/jobs/{id}/cancel`
- `POST /ai/suggestions/{id}/confirm` — creates authorized Activity/Task once
- `POST /ai/outputs/{id}/feedback` — Helpful/Incorrect/Unsafe
- `GET /opportunities/{id}/risk-signals` — deterministic signals and optional explanation status

All mutations require server authorization, optimistic concurrency/idempotency where applicable, transaction for multi-table changes and audit events No API returns decrypted provider key or raw prompt/provider payload

## 8. Acceptance criteria

- Non-Admin cannot read/write/test AI provider; API key is never returned/logged/audited in plaintext
- AI endpoint timeout/outage/circuit-open leaves manual workflows operational
- Release 1 exposes no web fetch, audio/video/transcription, document analysis or autonomous mutation path
- Meeting output validates strict schema and saves only user-selected confirmed fields
- Confirming one Next Action repeatedly creates one authorized task with correct timezone
- Risk signal is deterministic for same facts/rule version and remains available without AI
- Secrets/unauthorized fields are rejected before provider call
- Provenance/audit/feedback/30-day abandoned-metadata purge tests pass
- Feature flag disables each AI capability independently

## 9. Risks

- Provider behavior can change after Admin configuration change; accepted trade-off is manual fallback and simple rollback
- Prompt injection in pasted text; mitigate with input limits, secret scan, instruction isolation, output schema validation and no tool/autonomous actions
- Sensitive-data leakage; mitigate with server-side allowlists, ACL, masking, redaction tests and no raw prompt storage
- Users may over-trust output; mitigate with Draft/Suggestion labels, sources/confidence and Human Confirmation
