# Identity Provider and Authorization Contract

| Metadata | Value |
|---|---|
| Status | In Review |
| Version | 0.1 |
| Owner | Security Architecture |
| Requirements | SEC-001, SEC-002, COMP-001 |
| Related | [Permissions](../roles-and-permissions.md), [ADR-001](adrs/ADR-001-modular-monolith.md) |

## Identity provider boundary

`IdentityProvider.authenticate()` returns stable external subject, assurance/MFA level and claims; `UserDirectory.resolve()` maps provider+subject to immutable NTOP user ID Domain modules receive `ActorContext`, never password/session/token Local provider and future OIDC/SAML provider share this boundary; provider migration must not change domain user IDs

## Actor and authorization inputs

```text
ActorContext {
  userId, provider, assuranceLevel,
  activeRoleAssignments[{role, organizationScope, validFrom, validTo}],
  sessionId, correlationId
}

AuthorizationRequest {
  actor, permission, resourceType, resourceId,
  organizationUnitId, ownerId, workflowAssignment, dataClass
}
```

Policy result is `ALLOW` or `DENY` plus allowed fields/actions; default is deny Detail lookup returns 404 for invisible cross-scope records Mutation re-evaluates policy and workflow invariant inside application command, never trusts UI-provided owner/scope

## Required controls

- Privileged MFA, login throttling/lockout, session idle/absolute timeout and revoke-all
- JML: disable/revoke before role transfer; effective-dated assignments
- Maker-checker and delegation limits for approval/export/admin/merge
- No Admin implicit commercial approval
- Structured denial audit without leaking secrets or record existence

## Acceptance scenarios

- local subject maps to same NTOP ID after SSO transition
- expired/revoked assignment and stale session denied
- cross-unit ID guessing returns indistinguishable 404
- maker self-approval, admin self-escalation and expired delegation denied
- list/query and detail use same scoped policy predicate

