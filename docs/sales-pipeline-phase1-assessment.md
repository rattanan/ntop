# Sales Pipeline & Forecast Phase 1 — Repository Assessment

## Scope and acceptance criteria

This assessment covers only the Sales Pipeline & Forecast bounded context. Existing Prospect, Lead, Opportunity, Quote, Approval, authorization, and audit behavior must remain backward compatible.

The increment is accepted when calculation services are decimal-safe, fiscal periods are timezone-aware and configurable, recurring schedules do not mix MRR with TCV, existing forecast API fields remain available, and unit tests cover normal, empty, omitted, terminal, and zero-denominator cases.

## Reuse opportunities

- `Opportunity` is the single pipeline fact source; Prospect and Lead are not queried, avoiding double counting.
- `buildOpportunityScopeWhere` already derives server-side owner and organization scope.
- accepted/approved/submitted primary Quote versions already provide an evidence-backed forecast amount fallback to Opportunity estimated value.
- `Decimal(19,4)` and `decimal-money.ts` provide safe financial arithmetic.
- `ForecastSnapshot` and `ForecastItem` already persist reconstructable, immutable facts with formula, cutoff, scope, risk, and quality evidence.
- snapshot creation already uses a repeatable-read transaction, authorization, idempotent key behavior, and audit logging.
- `/api/v1/forecasts/*` and `/api/v1/pipeline` establish backward-compatible API conventions.

## Gaps

- The current calculation exposes only total and weighted pipeline; Commit, Best Case, target, coverage, win rate, sales cycle, velocity, accuracy, and recurring schedules are missing.
- Calendar-month boundaries and `Asia/Bangkok` are assembled in multiple runtime locations instead of coming from fiscal configuration.
- No persistent fiscal calendar, sales target, forecast submission/adjustment/lock, recurring-revenue fact, movement comparison, or notification preference models exist.
- The current pipeline UI has no server-driven global filters, KPI drill-down, funnel, aging, risk, quality, target comparison, or accessible chart alternative.
- Snapshot reads use creator-or-enterprise visibility, which is narrower than the standard organization-scope policy and must be aligned before manager review workflows are added.
- Pipeline fact reads are capped at 10,000 and snapshot detail reads at 10,000 without cursor pagination; large deployments need aggregation queries or paginated extraction.

## Risks and controls

- Forecast category persistence currently supports `PIPELINE`, `BEST_CASE`, `COMMIT`, and `OMITTED`; `UPSIDE` and derived `CLOSED` require an additive migration and compatibility mapping.
- Closed Won actuals need an authoritative closure timestamp and revenue basis. `OpportunityStageHistory` can supply closure evidence, but Finance reconciliation rules must remain configurable.
- Target uniqueness spans nullable dimensions. MySQL nullable unique keys do not fully prevent overlaps, so target writes need transaction-level overlap validation plus indexes.
- Fiscal boundaries must be computed in the configured IANA timezone and stored as UTC instants.
- Historical snapshots must never be updated in place; corrections require a new snapshot/version and an audit event.

## Implementation order

1. Decimal-safe calculation, fiscal-period, and recurring-schedule services.
2. Additive fiscal calendar and target schema with migrations, authorization, audit, and seed configuration.
3. Scoped server-side dashboard query/API and enterprise UI.
4. Funnel, detail list, aging, risk, and quality.
5. Submission, review, adjustment, approve, lock, and reopen workflows.
6. Snapshot comparison, movement, accuracy, export, notification, and E2E hardening.
