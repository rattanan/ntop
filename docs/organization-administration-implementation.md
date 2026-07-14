# Organization Administration & Quotation Approvers

## Scope

- Admin creates active organization units and optionally selects a parent unit.
- Admin moves an organization unit in the hierarchy. The server rejects self-parent and cyclic hierarchy updates.
- Admin assigns an active user to an organization-scoped Enterprise role and creates or reuses a matching `approval.decide` authority grant for Quotation approval.
- The configured role remains policy-driven: it must match the role required by the active Approval Policy. No approval role or level is hard-coded.
- Existing Workflow & Authority administration remains available and unchanged.

## Acceptance criteria

1. Only a caller with `organization.manage` can create units, update hierarchy, or assign managers/approvers.
2. Organization code is unique and normalized to upper case; only an active parent may be selected.
3. A hierarchy mutation cannot create a cycle and writes an audit event in the same transaction.
4. Manager assignment creates an effective `ORG_UNIT` role assignment and an effective `approval.decide` authority for the same organization, role, date range, optional customer segment, and Decimal maximum amount.
5. Administrator self-escalation is rejected. Existing overlapping role assignments are rejected.
6. Role assignment, authority creation/reuse, and the privileged audit event are atomic.
7. Quotation approval still enforces maker-checker, Approval Policy role, organization scope, segment, effective dates, and maximum amount on the server.
8. Existing APIs and Workflow & Authority behavior remain backward compatible.

## Database impact

No schema change or migration is required. The feature uses the existing `OrganizationUnit`, `UserRoleAssignment`, `ApprovalAuthorityGrant`, and append-only audit models.
