# Prospect Management — Phase 1

## Acceptance criteria

- Prospect is a separate Sales Engagement aggregate and does not change existing Lead workflow semantics.
- Mutable commands use server validation, scoped authorization, optimistic version and idempotency receipts.
- Permission checks use `prospect.*` permission grants; list and detail use the same ownership/organization predicate.
- Authorized users may move a non-terminal Prospect directly between any active business statuses without a transition-order lock. `CONVERTED` is conversion-command-only, `ARCHIVED` remains archive-command-only, and conversion cannot be repeated.
- Contacts support one transactionally enforced primary contact. Activities update contact/follow-up facts and timeline.
- Authorized users can create, edit, and soft-delete Contacts from the Prospect detail page. Contact mutations enforce Prospect scope and permission on the server, use the parent Prospect version for optimistic concurrency, promote a replacement when the primary Contact is removed, and append audit evidence in the same transaction.
- Existing environments receive the approved `prospect.*` role grants through a forward data migration, so edit and document-upload actions do not depend on reseeding.
- Duplicate detection considers normalized Thai/English company names, tax ID, contact email/phone/mobile and website domain.
- Assignment, status, activity, contact, merge, conversion, import-created rows and AI confirmation write audit evidence.
- After owner assignment, the API reports whether the actor retains read access. The detail UI refreshes when access remains and redirects to the scoped Prospect list with a success notice when the record moves outside the actor's organization scope, avoiding a misleading detail-page 404 without weakening authorization.
- Conversion creates Lead and links Prospect contacts, activities and document metadata in one transaction without copying objects.
- Money uses `Decimal(19,4)`, operational dates are UTC instants, and deletion is soft-delete only.
- CSV/XLSX import follows preview and promote steps with persistent batches/rows. Export uses authorization scope and current supported filters.
- AI enrichment uses the configured provider, stores a READY draft with provenance, and changes primary AI fields only after confirmation.
- AI enrichment is grounded in the authorized Prospect details plus at most 20 Contacts, 50 recent Activities and 10 recent uploaded documents. It extracts bounded text from PDF, DOCX, XLSX, PPTX, CSV and TXT; unsupported/unreadable files contribute metadata without failing the whole request. Phone, email, mobile and LINE values are represented only as availability flags.
- AI provider output accepts a JSON object with or without a Markdown code fence, normalizes bounded list/score values, and maps invalid output to a retryable AI-unavailable response instead of a generic server error.
- The Prospect detail page exposes `Request AI Insight` to authorized users, previews the READY draft, and requires an explicit `ยืนยันใช้ AI Insight` action before applying AI fields.
- The Activities & Timeline panel exposes `เพิ่ม Activity` only to authorized users. Its form is collapsed by default, opens inside the panel with accessible expanded-state semantics, closes after a successful save, and uses the existing scoped/audited Activity command.
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

### Shared customer classification and form behavior (2026-08-26)

- Prospect และ Customer ใช้ชุดข้อมูลอ้างอิง `CustomerSegment` และ `SubIndustryReference` เดียวกัน โดยตัวเลือกแสดง `รหัส — ชื่อ` และอุตสาหกรรมย่อยขึ้นกับ Segment
- `companySize` รับเฉพาะ `SMALL`, `MEDIUM`, `LARGE`; UI แสดง `รหัส — เล็ก/กลาง/ใหญ่`
- `taxId` เป็นเลขนิติบุคคลแบบ optional ที่ไม่บังคับรูปแบบหรือความยาว 13 หลัก; server trim และจำกัดตามคอลัมน์ `VARCHAR(32)` เท่านั้น
- หน้า Prospect แสดงชื่อ `Target Close Date` แต่ยังส่ง field REST v1 เดิม `currentContractEndDate` เพื่อรักษา backward compatibility จนกว่าจะมี API version ใหม่
- ฟอร์มใน Portal แสดงคำอธิบายภาษาไทยและตัวอย่างจาก field metadata กลาง และ numeric input ที่รู้จักแสดงหน่วยท้ายช่อง
- Prospect detail ย้าย Assign Owner ไปที่ปุ่มดินสอข้าง Owner และใช้ dialog; card เดิมด้านล่างไม่ถูก render แล้ว
- Convert to Lead ใช้ dialog ด้านบน ถ้าไม่มี Contact จะต้องกรอกชื่อและช่องทางอย่างน้อยหนึ่งรายการก่อน ระบบจะเก็บ dialog และค่าที่กรอกไว้เมื่อ validation ไม่ผ่าน
- Prospect → Lead conversion เลือกเบอร์มือถือเมื่อมีค่า มิฉะนั้นใช้เบอร์โทรศัพท์ และต้องไม่ให้ช่องมือถือว่างทับเบอร์โทรศัพท์ที่ผู้ใช้กรอก
- Convert to Lead แสดงสำหรับทุก active Prospect ที่ผู้ใช้มี `prospect.convert` และไม่บังคับให้ Prospect อยู่สถานะ `QUALIFIED`; server ยังคงตรวจสิทธิ์, scope, Contact, version, idempotency และป้องกันการ Convert ซ้ำ
- การสร้าง Contact ก่อน Convert เพิ่ม Prospect version แล้วใช้ version ใหม่นั้นกับ convert command เพื่อรักษา optimistic concurrency
- Migration เพิ่มข้อมูลอ้างอิงและ Customer classification แบบ forward-only ที่ `20260826100000_add_customer_classification_reference`; ยังไม่ได้รันกับ production
- Prospect → Lead conversion ส่งต่อ classification, address, provider, Target Close Date และ Estimated Opportunity Value พร้อม link Contact/Activity/SalesDocument เดิม โดยไม่ duplicate เอกสาร
- Lead create/edit ใช้ core field ชุดเดียวกับ Prospect; migration `20260826113000_align_lead_and_add_province_reference` เพิ่ม Lead fields, AI confirmation fields และข้อมูลอ้างอิง 77 จังหวัด (ยังไม่ได้รันกับ production)
- Lead detail ใช้ dialog สำหรับ Assign/Reassign, Create Activity และ Convert; conversion แยก action เชื่อม Customer เดิม/สร้างใหม่ แสดงผลสำเร็จก่อน redirect ไป Opportunity
- Lead AI Insight อ่านเฉพาะ bounded Lead/Contact/Activity/document context ที่ผ่าน scope, ถือข้อความเอกสารเป็น untrusted evidence และไม่แก้ Lead Score/Temperature; draft ต้องให้มนุษย์ยืนยันก่อน
- Lead document download/upload/delete ตรวจ Lead scope ฝั่ง serverและเขียน audit; เอกสารที่เชื่อมมาจาก Prospect ใช้ SalesDocument record เดิม

## Manual smoke flow

1. Sign in as `sales1@example.test`, open `/prospects`, and create a Prospect with a primary contact.
2. Confirm duplicate warning by trying the same tax ID or contact email.
3. Add an Activity and verify last-contact/next-follow-up and timeline.
4. Sign in as manager, assign the Prospect and verify it can move directly between active statuses in either direction.
5. Convert a non-terminal Prospect from any active status and verify the Lead link, shared activity/contact references, histories and audit.
6. Repeat conversion with another key and verify it is rejected without a second Lead.
7. Upload CSV/XLSX at `/prospects/import`, preview errors and confirm accepted rows.
8. Upload a text-bearing Prospect document, add a Contact and Activity, request AI Insight, verify the draft provenance lists all source records, then confirm before checking the saved AI fields.

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

- Document preview และ direct object-storage URL ยังปิดอยู่; download ทำผ่าน scoped application route พร้อม private/no-store headers และ audit. AI capabilities อ่านได้เฉพาะ bounded extraction หลัง authorization check. Local mode ไม่มี malware scanและต้องเป็น explicit operator choice เท่านั้น
- The dashboard implements real KPI/status/hot drill-down; the remaining industry/province/region/source/owner/trend chart visualizations are exposed by the dashboard API but need richer chart components.
- Bulk API supports up to 100 items; the list-page checkbox interaction remains a UI follow-up.
- The Playwright smoke test covers unauthenticated API protection. Authenticated three-role browser fixtures require a test-only session/bootstrap mechanism that does not yet exist.
- Dependency installation reported four moderate transitive vulnerabilities; do not run a breaking `npm audit fix --force` without dependency-impact review.
