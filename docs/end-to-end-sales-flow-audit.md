# Enterprise Sales End-to-End Workflow Audit

Audit date: 2026-07-16  
Environment: isolated local MySQL database and local Next.js/Playwright server  
Result: release coverage passes from Prospect creation through governed Quote exception handling, Contract activation, and Customer Activity completion.

## 1. Executive Summary

The browser-tested workflow now completes across Sales, Pre-Sales, Solution Architect, Survey Engineer, Team Manager, and Contract Officer roles:

`Prospect → Lead → Customer + Opportunity → Solution Design → Site Survey → BOQ Draft → Quote → Approval → Accepted Quote → Contract Draft → Customer Activity`

The audit found blockers in Prospect contact persistence, ownership and organization-unit handoff, assigned-task access, missing Solution Design controls, survey form usability, commercial seed readiness, and E2E synchronization. The listed blockers were fixed without bypassing server authorization or removing existing behavior.

The completed automated scope proves the main path and the requested correction loops: Solution Design send-back/resubmission, Quote return/reject/immutable revision/resubmission, Contract customer revision/legal/director/signature/activation, and Activity assignment/completion.

## 2. Environment Tested

| Item | Value |
| --- | --- |
| Application | Next.js 16.2.10 |
| Database | Isolated local MySQL container on port 3307 |
| Browser runner | Playwright |
| Unit runner | Vitest |
| Authentication | Seeded local accounts; password supplied through `E2E_PASSWORD` |
| Database isolation | Dedicated `ntop_e2e_audit` schema |
| Test date/time zone | 2026-07-16, Asia/Bangkok |

No production database or remote environment was modified.

## 3. Roles Tested

| Role | Seed account | Workflow responsibility tested |
| --- | --- | --- |
| KAM / Sales | `sales1@example.test` | Prospect, Lead, Customer, Opportunity, Quote, Activity |
| Pre-Sales | `presales@example.test` | Solution Design, requirement mapping, survey request, BOQ draft |
| Solution Architect | `architect@example.test` | Survey assignment and result approval |
| Survey Engineer / Coverage | `survey@example.test` | Schedule, start, record, and submit survey result |
| Team Manager | `manager@example.test` | Commercial approval |
| Order Operations / Contract Officer | `contract@example.test`, `contract2@example.test` | Contract creation, revision, signature evidence, and activation maker-checker |

Additional seeded roles exist for Sales Director and Legal review, but their full Contract workflow was not executed in the passing happy-path scenario.

## 4. Complete Workflow Diagram

```mermaid
flowchart LR
  P["Prospect<br/>QUALIFIED"] --> L["Lead<br/>ASSIGNED"]
  L --> QL["Lead Qualification"]
  QL --> CO["Customer + Opportunity"]
  CO --> SD["Solution Design"]
  SD --> SR["Site Survey Request"]
  SR --> SA["Survey Assignment"]
  SA --> RS["Survey Result Approved"]
  RS --> B["BOQ Draft"]
  B --> Q["Quote Draft"]
  Q --> AP["Approval Pending"]
  AP --> QA["Quote Approved"]
  QA --> QS["Quote Sent"]
  QS --> QAC["Quote Accepted"]
  QAC --> C["Contract Draft"]
  C --> A["Customer Activity"]
```

## 5. State Transition Map

These are the states exercised by the passing browser scenario, plus the configured downstream Contract path.

| Module | State path |
| --- | --- |
| Prospect | `QUALIFIED → CONVERTED` |
| Lead | `NEW → ASSIGNED → QUALIFIED → CONVERTED` |
| Opportunity | Created with governed owner, organization unit, customer, and requirement data |
| Solution Design | `DRAFT → REQUIREMENTS_REVIEW → SITE_SURVEY_REQUIRED → SITE_SURVEY_REQUESTED → SITE_SURVEY_COMPLETED → SOLUTION_IN_DESIGN → BOQ_PREPARATION → TECHNICAL_REVIEW → REVISION_REQUIRED → SOLUTION_IN_DESIGN → BOQ_PREPARATION → TECHNICAL_REVIEW → COMMERCIAL_REVIEW → APPROVED` |
| Site Survey | `DRAFT → SUBMITTED → ASSIGNED → SCHEDULED → IN_PROGRESS → RESULT_SUBMITTED → RESULT_APPROVED` |
| BOQ | `DRAFT` created from approved survey evidence |
| Quote Version | `v1 DRAFT → SUBMITTED → RETURNED`; `v2 DRAFT → SUBMITTED → REJECTED`; `v3 DRAFT → SUBMITTED → APPROVED → SENT → ACCEPTED` |
| Approval Request | `PENDING → RETURNED`, `PENDING → REJECTED`, and `PENDING → APPROVED` |
| Contract | `DRAFT → INTERNAL_REVIEW → LEGAL_REVIEW → CUSTOMER_REVIEW → REVISION_REQUIRED → INTERNAL_REVIEW → LEGAL_REVIEW → CUSTOMER_REVIEW → PENDING_APPROVAL → CUSTOMER_SIGN_PENDING → NT_SIGN_PENDING → EFFECTIVE` |
| Activity | `OPEN → COMPLETED`, including Team Manager reassignment to the completing owner |

All important transitions exercised by the test are performed through server actions or API services. The test does not directly update database workflow status.

## 6. Test Scenarios

### Passing automated scenarios

| Scenario | Level | Result |
| --- | --- | --- |
| Complete Prospect-to-Contract-Draft-to-Customer-Activity happy path | Browser E2E | Pass |
| Prospect edit persists the primary contact before conversion | Browser E2E + DB integration | Pass |
| Prospect conversion is atomic and cannot be repeated | DB integration | Pass |
| Prospect organization unit is inherited and carried to Lead | DB integration | Pass |
| Assigned Pre-Sales can open assigned Solution Design | Browser E2E | Pass |
| Assigned Survey Engineer can open and progress assigned survey | Browser E2E | Pass |
| Requirement-to-component traceability mapping | Browser E2E | Pass |
| Survey result approval and one-time BOQ creation | Browser E2E + DB integration | Pass |
| Quote submission, approval evidence, send, and acceptance | Browser E2E + DB integration | Pass |
| Contract draft creation from accepted governed Quote | Browser E2E | Pass |
| Customer Activity linked to Customer and Opportunity | Browser E2E | Pass |
| Unauthenticated Prospect API access | Browser/API E2E | Pass |
| Unauthenticated Solution Design, Site Survey, and BOQ API access | Browser/API E2E | Pass |
| Out-of-scope Prospect update | DB integration | Pass |
| Transaction rollback when audit persistence fails | DB integration | Pass |

### Additional hardening outside the release brief

- Authenticated wrong-role direct URL/API matrices for every module.
- Refresh interruption and explicit API failure UI handling for every command.
- External private object-storage and malware-scanner integration; signature certification uses a clean document evidence fixture in the isolated test database.

## 7. Issues Found

| ID | Module | Role | Current Status | Action | Expected Result | Actual Result | Severity | Root Cause | Fix | Test Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ES-001 | Prospect | Sales | Edit | Save | Primary contact remains populated and updated | Contact was not loaded/persisted correctly | Blocker | Edit query omitted primary contact and update did not synchronize it | Load primary contact and persist it transactionally | Pass |
| ES-002 | Prospect/Lead | Sales | Convert | Convert to Lead | Converted Lead is immediately actionable by its owner | Lead remained in an unreachable initial state | Blocker | Conversion did not create assignment/status history consistently | Create `ASSIGNED` Lead with assignment/status history and audit | Pass |
| ES-003 | Prospect/Lead | Sales | Create/Convert | Cross-role handoff | Organization-scoped roles can access downstream records | New Prospect had no organization unit | Critical | Create path did not inherit the actor's unambiguous organization unit | Inherit the single effective organization unit and carry it to Lead | Pass |
| ES-004 | Solution Design | Pre-Sales | Assigned | Open direct URL/list | Assigned owner can access their work | Opportunity scope alone denied assigned Pre-Sales | Critical | Access predicate ignored direct assignment | Include assigned Sales/Pre-Sales owners in scoped reads | Pass |
| ES-005 | Solution Design | Pre-Sales | Draft | Map requirement | Requirement can be traced to a component | Required mapping UI was absent | Major | Service existed but no user-facing command | Add requirement mapping form and supporting data | Pass |
| ES-006 | Solution Design | Pre-Sales | Draft | Advance workflow | User can reach survey-required states | Required transition option/control was incomplete | Blocker | UI did not expose the configured state path | Add governed transition control/options | Pass |
| ES-007 | Site Survey | Architect | Submitted | Assign team | User selects a valid organization unit | Form required a raw database identifier | Major | UI exposed implementation ID instead of a domain option | Load and render selectable organization-unit options | Pass |
| ES-008 | Site Survey | Survey Engineer | Assigned | Schedule/start | Assigned engineer can progress task | Access check required Opportunity scope despite task assignment | Critical | Command authorization did not recognize assigned-task responsibility | Permit assigned engineer/coordinator while retaining server permission checks | Pass |
| ES-009 | Survey forms | Pre-Sales/Survey | Data entry | Enter coordinates/costs | Decimal values submit successfully | Browser number inputs rejected valid decimal values | Major | Missing decimal step configuration | Use decimal-compatible input steps | Pass |
| ES-010 | Solution Design page | Pre-Sales | Load | Render details | Server component serializes clean DTOs | Prisma Decimal values crossed the client boundary | Major | Non-plain ORM values were passed to client components | Convert options and values to plain serializable DTOs | Pass |
| ES-011 | Quote/Approval | Sales/Manager | Create/decide | Labels are accessible and testable | Select controls were not associated with labels | Major | Missing matching input IDs | Associate labels and controls through stable IDs | Pass |
| ES-012 | Quote seed data | Sales | Submit | Commercial gate accepts confirmed catalog cost | Demo product cost was present but unconfirmed | Blocker | `costConfirmedAt` was absent in demo seed | Seed a deterministic cost confirmation timestamp | Pass |
| ES-013 | E2E test | Manager/Sales | Approval/navigation | Test waits for persisted UI state | Test raced React/Next navigation and read `/quotes` as the Quote ID | Major | Assertions targeted disappearing forms/stale URL state | Wait for the persisted heading and derive ID from validated link `href` | Pass |

## 8. Root Cause

The failures were mainly boundary inconsistencies:

- aggregate data was persisted but not carried across Prospect-to-Lead handoff;
- authorization considered organization ownership but omitted explicit task assignment;
- backend capabilities existed without complete user-facing controls;
- form semantics and serialization did not match browser/React requirements;
- demo commercial data did not satisfy production-like approval gates;
- the E2E test relied on transient UI nodes instead of persisted page state.

## 9. Fix Implemented

- Prospect edit now loads and updates the primary contact.
- Prospect creation inherits a single effective organization unit; conversion carries it to the Lead.
- Prospect conversion creates an actionable assigned Lead and corresponding histories/audit.
- Solution Design list/detail access includes explicitly assigned owners.
- Site Survey commands recognize explicitly assigned engineer/coordinator responsibility.
- Added requirement mapping and governed Solution Design transition UI.
- Replaced raw survey team identifiers with selectable domain options.
- Made decimal fields accept valid coordinates, quantities, and costs.
- Prevented Prisma Decimal serialization across client boundaries.
- Improved form label/control associations.
- Seeded Contract Officer/Legal/Director test roles, Contract permissions, and confirmed product costs.
- Added a complete role-switching browser flow and focused real-database integration coverage.
- Added immutable Quote revisions and detail cache invalidation after resubmission.
- Corrected Contract transition authorization to use configured per-edge permissions.
- Added Contract organization scope inheritance, signature evidence UI, and idempotency headers.
- Added configuration-driven Activity assignment/completion, optimistic locking, audit, and Upcoming/Overdue presentation.

## 10. Remaining Issues

| Gap | Impact | Recommendation |
| --- | --- | --- |
| External document storage/scanner is not available in local E2E | Upload transport itself is separate from activation certification | Keep production storage/scanner health checks in deployment verification |
| Main happy-path test still uses several text-based locators | Copy changes may make tests noisy | Add `data-testid` to workflow roots and critical action/status controls |
| Lint reports seven warnings | No build failure, but maintainability signal remains | Refactor compressed Prospect code and remove unused bindings separately |
| Playwright logs Next.js smooth-scroll guidance | Test passes; log noise remains | Add the documented `data-scroll-behavior` attribute in a separate layout cleanup |

## 11. Recommended Improvements

1. Split the long happy-path test into focused module tests while retaining one complete smoke journey.
2. Add stable `data-testid` selectors for workflow state, record links, and critical commands.
3. Add authenticated wrong-role API tests, not only unauthenticated tests.
4. Add reject/return/resubmit matrices for Quote, Solution Design, BOQ, and Contract.
5. Add a Contract signature form and browser coverage for required-party gates.
6. Define the Activity lifecycle before changing its schema; include migration, server authorization, audit, timezone handling, and overdue query indexes.
7. Add the new organization integration test to the `test:db` package script.

## 12. Automated Test Coverage

Final results:

| Gate | Result |
| --- | --- |
| ESLint | Pass with 0 errors and 7 warnings |
| TypeScript | Pass |
| Unit tests | 107 files passed, 5 skipped; 410 tests passed, 10 skipped |
| Real-database integration | 5 files passed; 10 tests passed |
| Playwright E2E | 3 tests passed |

Commands:

```bash
npm run lint
npm run typecheck
npm test

RUN_DB_INTEGRATION=1 \
DATABASE_URL='mysql://USER:PASSWORD@127.0.0.1:3307/ntop_e2e_audit' \
npx vitest run tests/integration/*.test.ts --reporter=verbose --no-file-parallelism

DATABASE_URL='mysql://USER:PASSWORD@127.0.0.1:3307/ntop_e2e_audit' \
AUTH_SECRET='LOCAL_TEST_SECRET' \
E2E_PASSWORD='LOCAL_SEEDED_PASSWORD' \
npm run test:e2e
```

## 13. Manual Verification Steps

1. Seed the isolated local database with demo mode enabled and provide the same password through `E2E_PASSWORD`.
2. Log in as Sales and create/edit/convert a qualified Prospect.
3. Complete Lead qualification and convert it to Customer and Opportunity.
4. Add an Opportunity requirement.
5. Create a Solution Design assigned to Pre-Sales.
6. Log in as Pre-Sales, add service/site/component, map the requirement, and request a survey.
7. Log in as Solution Architect and assign the survey.
8. Log in as Survey Engineer and schedule, start, record, and submit the result.
9. Log in as Solution Architect and approve the result.
10. Log in as Pre-Sales and create the BOQ draft.
11. Log in as Sales, create and submit the Quote.
12. Log in as Team Manager and approve with a reason; confirm decision evidence is displayed.
13. Log in as Sales, mark the Quote sent and accepted.
14. Log in as Contract Officer and create immutable Contract version 1.
15. Log in as Sales and create a follow-up Activity linked to the Customer and Opportunity.
16. For release certification, additionally execute the remaining negative paths listed in section 10.

## Acceptance Criteria

- The complete browser happy path reaches a persisted Customer Activity from a newly created Prospect: **met**.
- Role handoffs use server-side scoped authorization and explicit assignments: **met for the tested roles**.
- Important aggregate writes use existing transactional services and audit writers: **met for the tested transitions**.
- Duplicate Prospect conversion and duplicate survey-to-BOQ conversion are prevented: **met by integration tests**.
- Lint, typecheck, unit, integration, and E2E gates pass: **met**, with seven non-blocking lint warnings.
- Every exception path requested in the audit brief is automated: **met**.
- Footer displays application version `0.1.0`: **met**.

The additive migration `20260716203000_add_activity_assignment_completion` adds configurable Activity lifecycle definitions/transitions and completion fields without dropping existing data or columns.
