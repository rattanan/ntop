# Prospect Management — Phase 1

## Acceptance criteria

- Prospect is a separate Sales Engagement aggregate and does not change existing Lead workflow semantics.
- Mutable commands use server validation, scoped authorization, optimistic version and idempotency receipts.
- Permission checks use `prospect.*` permission grants; list and detail use the same ownership/organization predicate.
- Status transitions use an allowlist. `CONVERTED` is conversion-command-only and conversion cannot be repeated.
- Contacts support one transactionally enforced primary contact. Activities update contact/follow-up facts and timeline.
- Authorized users can create, edit, and soft-delete Contacts from the Prospect detail page. Contact mutations enforce Prospect scope and permission on the server, use the parent Prospect version for optimistic concurrency, promote a replacement when the primary Contact is removed, and append audit evidence in the same transaction.
- Existing environments receive the approved `prospect.*` role grants through a forward data migration, so edit and document-upload actions do not depend on reseeding.
- Duplicate detection considers normalized Thai/English company names, tax ID, contact email/phone/mobile and website domain.
- Assignment, status, activity, contact, merge, conversion, import-created rows and AI confirmation write audit evidence.
- Conversion creates Lead and links Prospect contacts, activities and document metadata in one transaction without copying objects.
- Money uses `Decimal(19,4)`, operational dates are UTC instants, and deletion is soft-delete only.
- CSV/XLSX import follows preview and promote steps with persistent batches/rows. Export uses authorization scope and current supported filters.
- AI enrichment uses the configured provider, stores a READY draft with provenance, and changes primary AI fields only after confirmation.
- The Prospect detail page exposes `Request AI Insight` to authorized users, previews the READY draft, and requires an explicit `ยืนยันใช้ AI Insight` action before applying AI fields.
- The company-research API uses authoritative public sources, a strict allowlist schema, no personal-contact collection, and never infers commercial or security facts.
- Every company-research success or provider failure writes an audit event with provider provenance and source URLs; provider outage leaves the manual create flow available.
- `/prospects/new` exposes the company name as a normal form field without an AI Search button; the manual create flow remains unchanged.

## API

- `GET|POST /api/v1/prospects`
- `GET|PATCH|DELETE /api/v1/prospects/{id}`
- `POST /api/v1/prospects/{id}/contacts|activities|assign|status|convert|merge|enrich`
- `PATCH|DELETE /api/v1/prospects/{id}/contacts/{contactId}`
- `POST /api/v1/prospects/{id}/documents` (multipart, private storage + malware scan required)
- `POST /api/v1/prospects/{id}/enrich/confirm`
- `POST /api/v1/prospects/check-duplicate|bulk`
- `POST /api/v1/prospects/research` (AI web search draft; no Prospect mutation)
- `POST /api/v1/prospects/import/preview`, `POST /api/v1/prospects/import`, `GET /api/v1/prospects/import/template`
- `GET /api/v1/prospects/export|dashboard`
- `GET|POST /api/v1/prospects/views`, `DELETE /api/v1/prospects/views/{id}`

## Database and compatibility

The forward-only migration is `20260714220000_add_prospect_management/migration.sql`. It is compatible with the MariaDB 5.5 disposable environment and MySQL 8. It does not drop or redefine existing module tables beyond additively extending Activity types/fields. The migration was applied to the `ntop` test database on 2026-07-14, followed by synthetic seed data.

## Manual smoke flow

1. Sign in as `sales1@example.test`, open `/prospects`, and create a Prospect with a primary contact.
2. Confirm duplicate warning by trying the same tax ID or contact email.
3. Add an Activity and verify last-contact/next-follow-up and timeline.
4. Sign in as manager, assign the Prospect and move it through qualifying states.
5. Convert a QUALIFIED Prospect and verify the Lead link, shared activity/contact references, histories and audit.
6. Repeat conversion with another key and verify it is rejected without a second Lead.
7. Upload CSV/XLSX at `/prospects/import`, preview errors and confirm accepted rows.

## Private document upload configuration

Binary upload records `SalesDocument` metadata only after the selected private storage adapter succeeds. Storage configuration stays outside source control.

### Local private storage

The approved development-server mode stores files outside `public/`, creates the storage root with mode `0700`, writes files atomically with mode `0600`, rejects path traversal, and intentionally skips malware scanning:

- `DOCUMENT_STORAGE_DRIVER=local`
- `DOCUMENT_LOCAL_STORAGE_PATH=/opt/apps/ntop-private/documents`

### S3-compatible storage

The existing S3-compatible adapter remains backward compatible. Set `DOCUMENT_STORAGE_DRIVER=s3`; this mode requires the scanner to return `CLEAN` before metadata is recorded:

- `DOCUMENT_STORAGE_ENDPOINT`
- `DOCUMENT_STORAGE_BUCKET`
- `DOCUMENT_STORAGE_REGION` (defaults to `us-east-1`)
- `DOCUMENT_STORAGE_ACCESS_KEY_ID`
- `DOCUMENT_STORAGE_SECRET_ACCESS_KEY`
- `DOCUMENT_MALWARE_SCANNER_ENDPOINT`
- `DOCUMENT_MALWARE_SCANNER_TOKEN` (optional when the approved scanner uses another network control)

The scanner endpoint receives object location, SHA-256, MIME type and size, and must return `{ "status": "CLEAN" }`. Missing configuration fails closed with a recoverable service-unavailable response. Files are never written to local disk or a database BLOB.

## Known limitations and technical debt

- Document download/preview remains disabled until an expiring signed-access policy is approved. Local mode has no malware scan and must remain an explicit operator choice.
- The dashboard implements real KPI/status/hot drill-down; the remaining industry/province/region/source/owner/trend chart visualizations are exposed by the dashboard API but need richer chart components.
- Bulk API supports up to 100 items; the list-page checkbox interaction remains a UI follow-up.
- The Playwright smoke test covers unauthenticated API protection. Authenticated three-role browser fixtures require a test-only session/bootstrap mechanism that does not yet exist.
- Dependency installation reported four moderate transitive vulnerabilities; do not run a breaking `npm audit fix --force` without dependency-impact review.
