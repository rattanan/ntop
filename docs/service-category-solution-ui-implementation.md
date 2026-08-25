# Service Category and Solution Design Workspace

## Scope

Service Category is the shared configuration source for Product Catalog and
Solution Design. Product creation selects an active category instead of accepting
free text. The Product stores the stable category code and copies the display
name plus Survey/BOQ/installation flags for backward-compatible reads.

Administrators with `product.catalog.manage` can create, read, update and
soft-delete Service Categories at `/admin/service-categories`. Changes use
optimistic versions and append audit evidence. Renaming a category updates the
denormalized Product label/code in the same transaction; historical Solution
Service rows remain linked by category ID.

## Solution Design behavior

- Catalog Item is a cascading dropdown filtered by the selected Service Category.
- The server rejects a Product whose `serviceCategoryCode` does not match the
  selected category, so client filtering is not a security or integrity control.
- Services, Sites, Components, Surveys, BOQ, Traceability and Versions render as
  accessible tabs with a short Thai explanation; only the selected panel is shown.
- An authorized user can create an empty BOQ Draft from the BOQ tab. The command
  requires an idempotency key and reuses an existing editable Draft instead of
  creating a duplicate.
- Quotation navigation is backfilled from existing Quote permissions. No Quote
  workflow or `/api/v1` contract is removed.

## Verification

- Product creation cannot submit a free-text category.
- Service Category create/update/delete requires server-side catalog-manage
  permission and writes audit in the same transaction.
- Cascading filtering and server-side category/Product matching agree.
- BOQ Draft create, replay and unauthorized paths are covered proportionately by
  unit/contract tests; real database verification remains in the configured DB
  integration suite.
