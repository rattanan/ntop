# Provisional Baseline Simulation — Validation Scenarios

> **RATIFIED AS BASELINE TEST DESIGN — NOT PRODUCTION EVIDENCE**  
> Decisions were approved on 2026-07-11; these scenarios remain designs and do not prove implementation acceptance.

| Metadata | Value |
|---|---|
| Status | Approved Test Design — Execution Evidence Pending |
| Version | Simulation 0.1 |
| Owner | QA and Product Architecture Working Group |
| Last updated | 2026-07-11 |
| Related documents | [Provisional Baseline](provisional-baseline-v1.md), [Decision Impact](provisional-decision-impact.md), [Approved Backlog](../../foundation/foundation-backlog.md), [Testing Strategy](../../testing-strategy.md) |

## 1. Validation method

แต่ละ scenario ต้องยืนยัน preconditions, actors/scopes, action, expected state/audit/event, failure handling และ rollback หากพบ contradiction ให้บันทึกเป็น simulation finding ไม่แก้ baseline โดยตรง

## VS-01 — Duplicate customer merge and audit

**Trace:** OD-001; BR-001, FR-001, DATA-001/003, COMP-001; R-02/R-07

- Given CRM external ID ตรงกันแต่ชื่อ normalize ต่าง และ KAM ownership อยู่คนละ unit
- When matching service สร้าง deterministic duplicate candidate
- Then ห้าม auto-merge; Data Steward review, cross-unit conflict escalate ไป Customer Data Owner
- On approval surviving internal ID remains stable; external IDs/aliases/references move through governed job; before/after/reason/actor audited
- Duplicate retry must not merge twice; failed reference update leaves reconcileable job state
- **Pass:** Customer 360/forecast ไม่ double count และ audit reconstruct ได้
- **Rollback:** disable merge execution, retain candidate links; no source record deleted

## VS-02 — Deletion request under legal hold

**Trace:** OD-002; COMP-002, DATA-001/003, SEC-003

- Given closed sales activity older than 3 years linked to customer under active legal hold
- When lifecycle job/dry-run evaluates deletion
- Then record is retained, reason `LEGAL_HOLD` reported, no sensitive payload in job log
- Removing hold requires authorized audited action; next eligible run may anonymize/delete per approved dependency rules
- Backup restore must not make deleted record active without reapplying lifecycle ledger
- **Pass:** hold always overrides retention and direct SQL path is excluded

## VS-03 — Quote 8M THB

**Trace:** OD-003 T1; FR-006/007, SEC-002, COMP-001

- Given complete quote THB 8,000,000, discount 5%, margin 20%, no exception
- When maker submits
- Then route requires Team Manager + independent maker-checker; maker cannot approve own step
- All approvals complete before status Approved; retry is idempotent
- **Pass:** policy version and quote hash reconstructable

## VS-04 — Quote 50M THB

**Trace:** OD-003 T2

- Given quote THB 50,000,000, discount 8%, margin 18%, standard terms
- Then Sales Director and Pricing Approver are both mandatory; parallel order may vary but final state waits for both
- One rejection results in Rejected; quote change requires new version/resubmission
- **Pass:** unavailable approver escalates and never auto-approves

## VS-05 — Quote 150M THB

**Trace:** OD-003 T3

- Given quote THB 150,000,000 with otherwise normal terms
- Then Commercial Committee/authorized executives are mandatory; committee evidence and decision members recorded
- Delegated authority below 150M is denied
- **Pass:** no lower-tier actor can approve or override

## VS-06 — Margin/discount exception

**Trace:** OD-003 exception; BR-004, R-08

- Given quote 8M with discount 12% or margin 14%
- Then exception escalates at least one authority level above T1 and captures exception reason
- Given unconfirmed coverage/cost, submission is blocked or routed through explicitly approved exception control; it cannot appear standard-approved
- Conflict-of-interest approver is excluded and reassigned/escalated
- **Pass:** threshold boundary tests at 10%, 10.01%, 15%, 14.99% deterministic

## VS-07 — Manual order handoff

**Trace:** OD-004; BR-005, FR-008, INT-001/004

- Given accepted approved quote and no live OM integration
- When Order Operations creates handoff
- Then package is versioned, checksummed, scoped and maker-checker verified; status `MANUAL_PENDING`
- Operator records external receipt/reference; second verifier acknowledges; status `MANUAL_ACKNOWLEDGED`
- UI/report must not label record synchronized/integrated
- **Pass:** package and external evidence reconstructable

## VS-08 — Duplicate manual acknowledgement

**Trace:** OD-004; INT-003/004, NFR-004

- Given same external reference/checksum submitted twice or acknowledgement retry after timeout
- Then unique idempotency key/reference prevents second business effect; response returns existing result
- Conflicting payload with same key is rejected and audited; reconciliation flags mismatched external status
- **Pass:** one handoff/acknowledgement, no duplicate order effect

## VS-09 — MySQL failover

**Trace:** OD-005; NFR-003, OPS-001/003; R-13

- Given normal transactional load and queued outbox events
- When primary member fails
- Then routing moves to healthy primary within approved operational procedure; in-flight ambiguous commands retry idempotently
- Audit/outbox/customer/quote counts reconcile; alerts and incident timeline generated
- **Pass:** measured availability/RPO/RTO within approved targets and no duplicate commercial decision

## VS-10 — Restore and dependency degradation

**Trace:** OD-005; OPS-003/004

- Restore encrypted backup + logs to isolated environment and verify critical hashes/counts/permissions
- Search outage: exact governed lookup remains, full-text shows degraded/freshness status
- Queue outage: committed command/outbox retained and processed after recovery
- External dependency outage: manual handoff remains available
- **Pass:** RPO ≤15m, RTO ≤4h in simulation target; any miss produces corrective action and blocks Production gate

## VS-11 — Pilot success measurement

**Trace:** OD-006; BR-002/003, NFR-002; R-15

- Given 75 named users in one division and approved controlled dataset
- Weekly calculate active users, opportunity completeness, NTOP transition rate, approval audit coverage and Critical defects
- Metrics use defined denominators and permission-safe aggregate views
- **Pass:** ≥80%, ≥90%, ≥95%, 100%, and zero Critical respectively; missing telemetry is failure, not zero

## VS-12 — Pilot rollback on approval bypass

**Trace:** OD-006 + OD-003; R-08/R-15

- Given any quote reaches Approved/Order without mandatory approval evidence
- Then raise Critical incident, stop new commercial mutations via feature/control switch, preserve audit, notify owners and return to governed manual process
- Do not delete/overwrite pilot evidence; reconcile affected quotes/orders and revoke compromised access if applicable
- Pilot baseline status becomes failed pending root-cause/remediation/retest
- **Pass:** containment and evidence preservation work; rollback does not corrupt customer/opportunity history

## 2. Cross-scenario consistency checks

- Merge cannot remove legal-hold/commercial evidence
- Retention cannot delete active approval/order references before commercial period
- Manual handoff cannot bypass approval or claim live synchronization
- DR restore preserves audit and reapplies lifecycle/legal-hold state
- Pilot metrics exclude duplicates using surviving customer IDs and immutable forecast snapshots
- All failure/retry paths use idempotency and correlation IDs

## 3. Simulation findings log

| Finding ID | Scenario | Contradiction/gap | Severity | Owner role | Required decision/change | Status |
|---|---|---|---|---|---|---|
| SIM-F-001 | — | — | — | — | — | Open |

## 4. Exit criteria

Simulation is internally consistent when VS-01–VS-12 have an expected outcome, no unresolved Critical contradiction, every policy-dependent implementation is blocked/conditional, and document/backlog traceability is complete This does not convert any decision to Approved
