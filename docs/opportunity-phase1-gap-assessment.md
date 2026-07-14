# Opportunity Phase 1 Gap Assessment

## Repository assessment

- Stack: Next.js 16 App Router, React 19, TypeScript, Prisma 6/MySQL with MariaDB 5.5 compatibility scripts, Zod, Vitest and Playwright.
- Existing governed foundation: scoped Opportunity CRUD, configurable transition policies, optimistic versioning, command receipts, hash-chained audit, Decimal forecast snapshots, versioned quotations and configurable approval routing.
- Existing Lead conversion is transactional, idempotent and links the source Lead to one Opportunity without deleting the Lead.
- Existing architecture baseline uses eight canonical stages. The attached twelve-stage proposal conflicts with the approved workflow, so this increment preserves the canonical enum and does not silently change active workflow behavior.

## Acceptance criteria delivered in this increment

- New Opportunities receive a human-readable `OPP-YYYY-000001` number from a transaction-safe sequence; existing Opportunities are backfilled by migration.
- Probability override requires explicit server-side permission, reason, optimistic version and idempotency key.
- Probability history, aggregate update, audit event and command receipt are committed in one transaction.
- Opportunity Health is deterministic, configurable, explainable and calculated only after authorization-scoped record lookup.
- Opportunity list/detail use organization-aware authorization context rather than legacy `ADMIN/ownerId` checks.
- List/detail expose identity, forecast, weighted value, health, probability evidence and responsive layouts.

## Remaining Phase 1 scope

Structured pain points, requirements, stakeholders and competitors are now delivered through scoped, audited and idempotent services and responsive Opportunity workspace UI.

The full attached prompt is not complete. Product line-item management at Opportunity level, document versioning, closed-won handover, configurable twelve-stage mapping, broader forecast dimensions/dashboard, complete seed pack and the requested cross-role E2E flows remain future implementation work. These must not be represented as complete until their schema, services, APIs, UI and tests are delivered.

## Migration

- MySQL 8: `20260714233000_add_opportunity_number_probability_history`
- MariaDB 5.5: `prisma/legacy-mariadb-5.5-opportunity-number-probability.sql`
