# Phase 1 Solution Design, Site Survey and BOQ

## Repository assessment

NTOP is a Next.js 16 modular monolith using Prisma/MySQL, REST `/api/v1`, server-side scoped authorization, configurable role-permission grants, hash-chained audit, transactions, and Decimal financial arithmetic. This implementation extends the existing `SolutionDesign` aggregate and reuses `Opportunity`, `OpportunityRequirement`, `Customer`, `Contact`, `Product`, `User`, `OrganizationUnit`, and `AuditEvent`. It does not duplicate those shared entities.

The existing `SalesDocument` service is currently scoped to Prospect/Lead storage ownership. Site Survey DTOs therefore use internal document identifiers as their attachment contract, but Phase 1 does not introduce a second document store or permanent public file URLs.

## Acceptance criteria implemented

- Create one backward-compatible Solution Design aggregate from an accessible Opportunity.
- Add configured service categories/products and automatically derive survey/BOQ/physical-installation requirements.
- Override survey requirement only with a reason and audited previous/new values.
- Add multiple sites with decimal GPS coordinates and server validation for latitude/longitude.
- Create manual survey requests with at least one validated contact and a preferred period.
- Submit an internal normalized `NTSPSiteSurveyRequestV1` snapshot without an external API call.
- Assign, schedule, start, enter a structured manual result, submit, return/reject/approve with assigned-record checks and maker-checker.
- Store findings, measurements, conditions, risks, customer actions, estimated items and versioned response snapshots.
- Generate BOQ draft lines from approved survey estimates with source-reference uniqueness, provisional pricing and repeat-safe conversion.
- Calculate wastage, cost, selling price, gross profit, margin, one-time/recurring totals and contract value using `Prisma.Decimal`.
- Preserve BOQ version snapshots and prevent in-place mutation outside editable statuses.
- Create components, network connections, requirement mappings, assumptions/constraints/risks, technical reviews and commercial reviews.
- Enforce Opportunity/team scope, assigned survey scope, explicit permissions, restricted cost serialization and audit critical mutations in the same transaction.
- Show Solution Design, Site Survey and BOQ work queues, KPI summaries, detail pages and assigned-survey notifications.

## Routes and APIs

UI routes:

- `/solution-designs`, `/solution-designs/:id`
- `/site-surveys`, `/site-surveys/:id`
- `/boqs`, `/boqs/:id`

REST resources live under `/api/v1/solution-designs`, `/api/v1/site-surveys`, and `/api/v1/boqs`. Child command routes cover services, sites, components, network connections, requirement mappings, risks, workflow transitions, reviews, survey assignment/scheduling/results and BOQ generation/revisions.

## RBAC

New capability codes are seeded for Solution Design view/manage/submit/review, Site Survey view/request/coordinate/perform/result approval, and BOQ view/manage/cost view/approval. Default mappings use the existing enterprise roles: KAM, PRESALES, SOLUTION_ARCHITECT, COVERAGE and PRICING_APPROVER. Domain code checks permission grants; it does not hard-code these roles.

Survey engineers may execute only requests assigned to their user ID. Technical/commercial reviewers and survey-result reviewers cannot approve their own submitted work.

## Configurable workflow and rules

`ServiceCategoryConfig` stores survey, BOQ and physical-installation flags. `SolutionStatusDefinition` and `SolutionStatusTransition` use an `entityType` discriminator for `SOLUTION_DESIGN`, `SITE_SURVEY`, and `BOQ`. Required fields are evaluated server-side from configuration.

Default survey-required categories include Broadband Internet, Fiber Broadband, Dedicated Internet, Leased Line, MPLS, IP VPN, SD-WAN, Metro Ethernet, domestic/international data networks, Cloud Connectivity and Data Center Connectivity.

## NTSP integration contract

`lib/solution-design/contracts.ts` defines version 1 request/response DTOs and the adapter interface. `ManualSiteSurveyProvider` is the default and performs no network request. `MockNTSPSiteSurveyProvider` is deterministic and throws if instantiated in production. No NTSP authentication or production HTTP client exists.

Environment defaults:

```text
NTSP_SITE_SURVEY_INTEGRATION_ENABLED=false
SITE_SURVEY_INTEGRATION_MODE=MANUAL
```

Other future NTSP variable names are documented in `.env.example`; values are not required and no credentials are committed.

## Migration and seed

Migration: `20260715150000_add_solution_design_site_survey_boq`

It adds service/status configuration, versioning, sites, services, components, network connections, traceability, risks, survey requests/contacts/results/estimates/integration logs, BOQ headers/sections/items/versions, review decisions, indexes, foreign keys and GPS/quantity checks. Existing Solution Design financial columns remain available with expanded decimal precision.

`prisma/seed.ts` seeds status definitions/transitions, BOQ sections, category rules, permissions and synthetic demo users/products when demo mode is enabled. Seed identities use `example.test` and contain no real personal data.

## Manual role flow

1. KAM or Pre-Sales opens an Opportunity and creates the Solution Design.
2. Pre-Sales selects a service; configured physical services set `surveyRequired`.
3. Pre-Sales adds a site/GPS/contact and creates/submits the manual survey request.
4. Coverage/Solution Architect assigns an engineer and schedule.
5. Assigned engineer starts the survey, records findings/estimates, and submits the result.
6. A different authorized reviewer approves or returns it.
7. Pre-Sales creates a BOQ draft, sets selling prices, and submits technical/commercial workflows.
8. Separate technical and commercial approvers decide the Solution Design.

## Validation and test commands

```bash
npx prisma validate
npm run lint
npm run typecheck
npm test
PLAYWRIGHT_PORT=3107 npm run test:e2e
npm run build
```

Real-database integration coverage is in `tests/integration/solution-design-real-db.test.ts` and runs only with `RUN_DB_INTEGRATION=1` against a migrated disposable test database.

## Known limitations

- Production NTSP submission, polling, webhook, authentication, retries and reconciliation are intentionally not implemented.
- The shared document store has not yet been generalized beyond its current Prospect/Lead ownership model; Site Survey attachment DTO fields are prepared, but Survey photo/document upload requires that separate Documents-module extension.
- Map-pin selection is not included because the repository has no existing map component; validated manual GPS entry is supported.
- Full performance/security/DR/UAT evidence and a live MySQL migration rehearsal require the dedicated test environment; the configured database was unreachable during this local run.

## Integration status

```text
NTSP Site Survey Integration Status:
Prepared for future integration.
Current Phase 1 operating mode: Manual.
No production NTSP API connection implemented.
```
