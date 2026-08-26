---
name: table-list-pattern
description: Build or revise NTOP list and administration tables with the repository-standard search, sortable columns, numbered pagination, server-side controls, and accessible states. Use whenever a task creates or materially changes a table or record list in NTOP.
---

# NTOP List Table Pattern

Apply this pattern to new or materially revised list tables unless the user's
latest requirement explicitly calls for a different interaction.

## Required behavior

- Provide a clearly labelled search box for the meaningful identifiers and text
  fields of the list. Search on the server, bound the input length, provide an
  empty state and reset action, and preserve the current sort.
- Make meaningful data columns sortable. Use a server-side allowlist for sort
  keys, toggle ascending/descending from the header, reset to page 1 when sort
  changes, add a deterministic tie-breaker, and expose the state with
  `aria-sort`. Rules, descriptions and action columns need not be sortable.
- Use fixed-size server-side numbered pagination. Make every displayed page
  number clickable, include previous/next controls, and condense long ranges to
  first/nearby/current/last pages with ellipses. Clamp invalid page values and
  preserve search and sort parameters between pages.
- Keep queries bounded and indexed appropriately. Do not fetch the full dataset
  for client-side filtering, sorting or pagination; for large datasets choose a
  safe server-side strategy that still presents the numbered UI requested by
  the product owner.
- Use semantic `table`, `thead`, `tbody`, `th` and `nav` elements,
  visible keyboard focus, `aria-current="page"`, labelled search, and useful
  empty states.
- Enforce authorization and scope on the server. UI visibility is not an access
  control.

## Repository reuse

Prefer the existing primitives:

- `components/page-number-navigation.tsx`
- `components/sortable-table-header.tsx`
- `.table`, `.table-tools`, `.table-sort`, `.table-pagination` and
  `.page-number*` styles in `app/globals.css`

Add proportionate tests for search parameter preservation, sort allowlisting
and direction toggling, page-range generation, invalid page clamping, empty
results, and authorization when the list is scoped.
