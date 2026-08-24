# Searchable Product Selection

## Scope

Product selection in Solution Design and governed Quotation uses a searchable native combobox backed by the Product options already authorized and loaded by each server page. Proposal AI Product selection keeps its multi-select behavior and uses the same code/name/category matching rule. No API contract, server authorization rule, workflow, or database schema is changed.

## Acceptance criteria

- Users can search Product options by code or name in Solution Design and every governed Quotation line.
- Proposal AI Product selection can be searched by code, name, or category and shows an explicit empty result.
- Selecting a Quotation Product continues to populate its list price and show its floor price; the submitted payload remains the stable Product ID.
- Clearing the optional Solution Design Product keeps the existing “unspecified Product” behavior.
- The single-select control exposes an associated label, native suggestions, and combobox semantics for keyboard and assistive-technology use.
- Product matching is case-insensitive, trims whitespace, is bounded in Proposal rendering, and has unit coverage.
- Existing server-side authorization, Product-active validation, Quote floor-price enforcement, and API compatibility remain unchanged.
