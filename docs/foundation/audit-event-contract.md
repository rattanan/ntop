# Audit Event and Redaction Contract

| Metadata | Value |
|---|---|
| Status | In Review |
| Version | 0.1 |
| Owner | Information Security / Internal Audit |
| Requirements | COMP-001, SEC-002, OPS-001 |
| Related | [Database](../database-design.md), [Identity Contract](identity-authorization-contract.md) |

## Canonical event

```json
{
  "auditEventId":"aud_...","occurredAt":"2026-07-11T00:00:00.000Z",
  "actor":{"userId":"usr_...","provider":"local","assurance":"MFA"},
  "action":"approval.decide","outcome":"SUCCESS",
  "target":{"type":"ApprovalRequest","id":"apr_...","version":4},
  "scope":{"organizationUnitId":"ou_..."},
  "reason":"Within approved authority","policyVersion":"ap-1",
  "correlationId":"...","requestId":"...",
  "changes":[{"field":"status","from":"PENDING","to":"APPROVED"}],
  "integrity":{"previousHash":"...","hash":"..."}
}
```

## Mandatory actions

Authentication/admin grants, ownership/merge, sensitive export/document access, workflow transition, quote submit/version, approval/delegation/override, retention/legal hold, handoff/reference/replay and break-glass

## Redaction

- Never record password, token, secret, MFA seed, document body or unrestricted request payload
- Contact/PII changes record classification and masked/hash summary unless audit purpose explicitly requires encrypted restricted evidence
- Error stack/SQL belongs operational logs and must be sanitized; audit stores stable error code
- Read access to audit is scoped and audited; business roles cannot mutate/delete

## Integrity and retention

Audit append occurs in same transaction/outbox reliability boundary as business command Tamper evidence uses hash chaining or equivalent approved design Commercial audit retained 7 years; security access logs 1 year; legal hold overrides deletion Verification job reports gaps/chain mismatch

## Acceptance

100% critical-action coverage, duplicate command creates one business effect with traceable retries, redaction tests find no secrets, audit query reconstructs actor/policy/version/reason and tamper test alerts

