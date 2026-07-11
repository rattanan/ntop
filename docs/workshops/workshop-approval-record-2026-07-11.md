# NTOP Requirements Baseline 1.0 — Approval Record

| Metadata | Value |
|---|---|
| Status | Approved |
| Version | 1.0 |
| Effective date | 2026-07-11 |
| Decision scope | OD-001 through OD-006 |
| Approval source | Explicit project owner confirmation in the Codex task |
| Related documents | [Decision Register](decision-register.md), [Approval Checklist](baseline-approval-checklist.md), [Product Requirements](../product-requirements.md) |

## Decision

The project owner approved all values in Provisional Baseline Simulation 0.1 unchanged. This record establishes Requirements Baseline 1.0 and closes OD-001 through OD-006.

## Approved summary

- Central Customer Data Governance with stable internal IDs and governed duplicate merge
- 7-year commercial/audit, 3-year sales activity and 1-year security-log retention; legal hold override
- Three commercial approval tiers at 10M and 100M THB boundaries plus risk exceptions
- No live integrations in year one; adapter-ready architecture and governed manual handoff
- 99.9% availability, RPO 15 minutes, RTO 4 hours and quarterly restore exercises
- One-division pilot, 75 named users, four weeks plus two-week hypercare and approved success/rollback metrics

## Evidence and limitation

Approval was provided directly in the project task on 2026-07-11 and confirmed as applying to OD-001–OD-006 unchanged. The repository does not contain verified personal names, signature images or organizational signature references; none are fabricated. Those references may be attached later as administrative evidence without altering the approved decision content or effective date.

## Follow-up

1. Treat the 12 baseline documents at version 1.0 as the source of truth
2. Use approved values as configurable policy, never hard-coded domain logic
3. Process remaining technical choices through the ADR authorities
4. Apply Definition of Ready before implementation
5. Preserve simulation documents as historical inputs marked superseded

