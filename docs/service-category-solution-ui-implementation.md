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

Product and Service Category list rows link to dedicated detail pages. Product
detail is available to authorized catalog viewers, while Product edit/delete and
all Service Category detail mutations require `product.catalog.manage`. Edit and
soft-delete commands retain optimistic version checking and append audit evidence;
Service Category deletion remains blocked while a non-deleted Product references it.

The Product Catalog supports bounded server-side search across code, name,
category and description with numbered pagination and allowlisted column
sorting. Service Category administration uses a numbered, sortable table.
Deletion requires an explicit browser confirmation but no free-text reason; the
server allows the audited soft-delete only when no non-deleted Product
references the category code.

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
- Product search and both administration lists use fixed page sizes and
  allowlisted server-side sorting.
- Service Category create/update/delete requires server-side catalog-manage
  permission and writes audit in the same transaction.
- Service Category deletion is denied when any non-deleted Product still
  references the category, regardless of client state.
- Cascading filtering and server-side category/Product matching agree.
- BOQ Draft create, replay and unauthorized paths are covered proportionately by
  unit/contract tests; real database verification remains in the configured DB
  integration suite.
