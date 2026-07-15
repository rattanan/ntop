# Contract Management — Phase 2 implementation

## Scope and boundaries

Contract Management is a module of the existing modular monolith. It consumes an
accepted, immutable `QuoteVersion`; it does not recalculate or mutate Proposal,
Quotation, Solution Design, BOQ, Site Survey, Opportunity, or Customer data.
Contract writes use the application transaction boundary and the shared audit
writer. Documents use private object storage and fail-closed malware scanning.
External e-signature providers and NTSP are represented by ports only in Phase 2;
the supported production paths are verified manual signed-copy upload and manual
service-order handover.

## Acceptance criteria

1. A contract can only be created from an accessible `ACCEPTED` Quote Version.
   Customer, opportunity, proposal and quote references are copied server-side.
2. Each edit creates an immutable contract version. Optimistic concurrency rejects
   stale commands. Monetary values are calculated with `Decimal` at four-decimal
   precision and never with binary floating point.
3. Contract type, lifecycle statuses, transitions, transition permissions and
   maker-checker behavior are data-configured. APIs preserve the existing v1 error,
   correlation and idempotency conventions.
4. Important commands write an audit event in the same transaction. Authorization
   is enforced server-side and records remain constrained to the actor's scope.
5. A contract cannot become effective until current-version customer and NT
   signatures reference clean, immutable document versions.
6. Only an effective contract version can create a service order. Phase 2 records a
   real manual handover with an immutable prefill snapshot; the future NTSP adapter
   is not called from the production path.
7. Amendments create linked versions; renewal events and 90/60/30/7-day reminders,
   customer POs, legal/internal reviews, and signature evidence are normalized and
   queryable. PO and financial amounts use Decimal.
8. AI endpoints create suggestions only, record provider/model/prompt provenance,
   never change contract state, and leave all manual workflows usable when the AI
   provider is unavailable.
9. Lists use bounded cursor/page-size queries and indexed filters for owner,
   customer, status, type, expiry and renewal date. Documents are never returned as
   public object-storage URLs.
10. Unit/integration tests cover financial calculations, lifecycle guards,
    maker-checker, immutable versioning, accepted-quote creation, signatures,
    amendments, renewals and service-order eligibility.

## Lifecycle

`DRAFT → INTERNAL_REVIEW → LEGAL_REVIEW → CUSTOMER_REVIEW → PENDING_APPROVAL →
CUSTOMER_SIGN_PENDING → NT_SIGN_PENDING → EFFECTIVE → READY_FOR_SERVICE_ORDER →
COMPLETED`. `REVISION_REQUIRED`, `CANCELLED`, and `EXPIRED` are configured branches.
The service reads the allowed edge and required permission from
`ContractStatusTransition`; role names are not embedded in application code.

## Data and integration design

- `Contract` is the searchable current-state projection; `ContractVersion` and
  `ContractItem` are immutable history.
- Review, document/version, signature, amendment, renewal/reminder, purchase order,
  and service-order records are separate aggregates linked by IDs and foreign keys.
- Approval routing is a versioned JSON policy evaluated from total contract value,
  organization unit, region and contract type. Each request stores its input and
  policy snapshot so later configuration changes cannot rewrite history.
- Renewal timestamps are UTC instants. Display uses the user's configured timezone.
- A background worker may claim due reminders by indexed `dueAt/status` fields;
  uniqueness prevents duplicate reminder delivery.
- E-signature and NTSP integrations implement explicit ports. Provider webhooks must
  be authenticated, replay-safe and mapped to an idempotent command before enablement.

## REST surface

The Phase 2 surface is rooted at `/api/v1/contracts`: bounded list/create, detail,
immutable version edit, status transition, reviews, documents, signatures,
amendments, renewals, purchase orders, service orders and AI analysis. Mutating
requests require `Idempotency-Key`; responses include a correlation identifier and
use the shared API error envelope.

## Operational notes

The migration adds composite indexes for the dashboard and reminder worker. Large
files are streamed to object storage rather than buffered after Phase 2's configured
upload limit. Retention, legal hold, encryption keys and malware-signature updates
remain deployment controls. The module exposes no hard-delete command.
