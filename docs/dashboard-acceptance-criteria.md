# NT Enterprise Dashboard acceptance criteria

1. Successful login redirects to `/dashboard`; the root route also resolves to the dashboard.
2. Every dashboard request requires an authenticated user and the database-granted `dashboard.view` permission.
3. Prospect, Lead, Opportunity, Customer, Activity, Approval, Contract, Service Order, Incident, and Target queries are constrained by the actor's effective SELF, TEAM, ORG_UNIT, ASSIGNED_TASK, or ENTERPRISE scope on the server.
4. Global filters support date range, department, team, owner, customer segment, product, and opportunity status. An inaccessible organization or owner filter is rejected rather than widening scope.
5. The last filter selection is retained in browser storage and restored when the user returns to an unfiltered dashboard.
6. KPI cards and chart rows are links to their source modules with corresponding query parameters where supported.
7. The common dashboard includes source-backed lifecycle counts, pipeline, weighted forecast, commit/best case, active revenue target and gap, pending approvals, SLA work, expiring contracts, delayed orders, incidents, conversion, win/loss, funnel, charts, recent activity, notifications, and action items.
8. Role-focus sections are granted through database permission codes for Executive, Sales, Sales Manager, Solution/Engineer, Approver, Operations, Customer Success, and Admin; the UI does not infer authorization from hidden controls.
9. CSV and XLSX export reuse the same scoped/filter query as the dashboard and append a hash-chained audit event.
10. The page exposes loading, empty, recoverable error, and permission-denied states and shows the last successful refresh time in Asia/Bangkok.
11. The dashboard uses semantic NT yellow/white design tokens, a persisted light/dark/system-compatible theme, visible focus states, reduced-motion support, and layouts verified at desktop, tablet, and mobile widths.
12. Unit, real-database integration, and Playwright tests prove role visibility, cross-owner isolation, filters, drill-down, source-count reconciliation, export, responsive layouts, and state rendering.
