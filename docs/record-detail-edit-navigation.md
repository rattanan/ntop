# Record Detail and Edit Navigation

## Scope

This increment separates the primary edit form from the detail view for Prospect, Lead, Customer, Opportunity, and Proposal. Customer contact maintenance moves with the Customer form, while Proposal content editing and AI draft generation move with the Proposal editor. Workflow-specific controls such as conversion, assignment, stage transition, approval, and governed related-record actions remain on the detail page so existing workflows are preserved.

## Acceptance criteria

- Each record detail page displays data without rendering its primary edit form.
- An authorized user sees an accessible pencil-labelled edit link that navigates to `/{module}/{id}/edit`.
- Each edit page preloads the current scoped record into the existing form component.
- Direct access to an edit page is denied when the record is outside the actor's authorization scope or the actor lacks the corresponding update permission.
- Terminal or merged records keep their existing non-editable behavior.
- Existing mutation services, API contracts, workflow controls, audit behavior, and database schema remain unchanged.

## Verification

- `tests/unit/record-detail-edit-navigation.test.ts` checks all record modules that expose a primary edit route.
- Existing Lead and Customer UI contract tests verify that scoped forms and workflows remain available in their intended routes.

## Audited detail routes

| Route/module | Result |
|---|---|
| Activity | Already uses a dedicated scoped edit route and pencil action. |
| Prospect, Lead, Customer, Opportunity | Primary edit forms use dedicated scoped edit routes. |
| Proposal | Content editor and AI content generation use the dedicated scoped edit route; detail renders the latest version read-only. |
| Approval, Quote, Contract | Detail contains governed decision, submission, commercial transition, or contract workflow commands rather than primary record edit forms. |
| Solution Design, Site Survey, BOQ | Detail contains presales workflow and related-record commands; no primary record edit form is embedded. |
| AI Meeting Draft, AI Risk Explanation | These are explicit human-review workflows, not record detail/edit pages. |
