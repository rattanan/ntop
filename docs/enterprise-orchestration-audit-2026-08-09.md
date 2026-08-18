# NTOP Enterprise Orchestration Audit — 2026-08-09

## Executive outcome

รอบนี้แก้ Critical/High defects ที่ขวาง workflow ปัจจุบันตั้งแต่ Prospect ถึง Contract และสร้าง Service Order แบบ manual orchestration record ได้จริง พร้อมแก้ RBAC navigation ให้ใช้ permission grants ฝั่ง server และซ่อม MySQL collation drift ทั้งฐานทดสอบ

Definition of Done ฉบับเต็มจาก Prospect ถึง Customer Success **ยังไม่ครบ** เพราะ repository ปัจจุบันยังไม่มี delivery workflow ที่ใช้งานจริงหลัง Service Order สถานะ `DRAFT` สำหรับ Service Qualification, Provisioning/Installation, Testing/Handover, Customer Acceptance, Billing acknowledgement และ Incident/SLA จึงไม่แสดงสถานะ integration success ปลอม

Test Run ID ล่าสุด: `1786290207552`

## 1. Current Architecture

- Next.js 16 App Router, React 19, TypeScript และ Tailwind CSS 4
- Modular monolith แบ่ง domain service/repository/API v1 และ server-rendered portal routes
- Prisma 6 กับ MySQL/MariaDB-compatible schema
- Authorization สองชั้น: legacy session role เพื่อ backward compatibility และ enterprise `UserRoleAssignment` + `RolePermissionGrant`
- Workflow สำคัญใช้ transaction, idempotency key/command receipt และ append-only hash-chained audit ledger
- เงินใช้ Prisma `Decimal`; วันเวลาเก็บเป็น `DateTime` และ format ด้วย timezone ที่ระบุ
- Vitest สำหรับ unit/integration และ Playwright สำหรับ authenticated E2E/security
- Integration boundary ที่มี implementation จริง: Site Survey manual provider พร้อม versioned payload snapshot; Service Order เป็น manual NTOP record เท่านั้น

## 2. UI/UX Improvements

- Sidebar, quick create และ command palette เปลี่ยนจาก hard-coded legacy role เป็น server-loaded permission grants
- Header แสดง enterprise role assignment จริง แทนการแสดงผู้ใช้ demo ทุกคนเป็น Sales
- Contract detail มี Order Handoff card พร้อม confirmation, pending/duplicate-submit protection, success/error notice และ stable `data-testid`
- Service Order card ระบุชัดว่า `DRAFT` ยังไม่ใช่ NTSP integration success
- รักษา design direction เดิมของระบบ: NT Yellow `#FFD200`, dense enterprise layout, responsive shell, keyboard-accessible command dialog และ reusable card/form/status patterns
- ใช้แนวทางจาก `ui-ux-pro-max` และ `ui-styling`: permission-aware information architecture, WCAG AA focus/labels และ low-motion enterprise interaction

ข้อจำกัดที่ยังเหลือ: command palette ค้นหาเฉพาะ route/menu ยังไม่ใช่ cross-entity search ของ Customer/Prospect/Lead/Opportunity/Quote/Contract/Order

## 3. Workflow Gaps Found

| Severity | Gap | Outcome |
|---|---|---|
| Critical | MySQL foreign-key columns ใช้ `utf8mb4_general_ci` และ `utf8mb4_unicode_ci` ปะปน ทำให้ Lead/Solution Design query ล้ม | แก้แล้ว; FK mismatch = 0 และ non-Unicode application tables = 0 |
| High | Contract API สร้าง Service Order ได้ แต่ไม่มี UI handoff | แก้แล้ว |
| High | การส่งสร้าง Service Order ซ้ำต่าง idempotency key สร้าง order ซ้ำได้ | แก้ด้วย deterministic `businessKey` + unique index + upsert |
| High | Navigation/quick actions ใช้ legacy `ADMIN/SALES/VIEWER` ไม่ตรง enterprise assignments | แก้แล้วด้วย permission grants |
| High | Presales 500 error กลืน audit/storage cause ทำให้ trace ด้วย correlation ID ไม่ได้ | เก็บ cause ฝั่ง server และ log เฉพาะ safe name/code แล้ว; response ยังคง sanitized |
| Critical | Service Qualification → Provisioning → Testing/Handover → Acceptance → Billing ไม่มี usable workflow/API/UI | ยังเหลือ |
| Critical | Customer Care Incident/Ticket/SLA และ handoff ไป SCOMS Next ไม่มี usable workflow/API/UI | ยังเหลือ |
| High | Field Team และ Customer Care role/work queue ไม่ได้อยู่ใน enterprise role catalog ปัจจุบัน | ยังเหลือ |
| High | Persistent notification/outbox/deep-link work queue สำหรับ downstream handoff ยังไม่มี | ยังเหลือ |
| Medium | Command palette ยังไม่ค้นหา business records | ยังเหลือ |
| Low | Next.js เตือนให้เพิ่ม `data-scroll-behavior="smooth"` ที่ root HTML | ยังเหลือ; ไม่ขวาง flow |

## 4. Missing Fields and Controls Added

- `ContractServiceOrder.businessKey` สำหรับ uniqueness ข้าม idempotency keys
- Order Handoff control บน Contract detail
- Current Service Order number/status บน Contract detail
- Confirmation ก่อนสร้าง order
- Disable submit ระหว่าง request เพื่อกัน double click
- ข้อความแยก created/reused order และระบุ integration boundary
- Granted-permission payload สำหรับ shell/navigation/command palette
- Safe internal error identity (`name`, `code`, cause name/code) โดยไม่ log message, payload, SQL หรือ PII

## 5. Permission and Approval Fixes

### Role × Module × Action matrix ที่ตรวจจาก implementation

| Enterprise role | Modules/actions ที่มีจริง | E2E evidence |
|---|---|---|
| KAM / Sales | Prospect, Lead, Customer, Opportunity, Activity, Solution handoff, Quote, Contract create | ผ่าน |
| PRESALES | Solution Design, Site Survey request, BOQ prepare, technical resubmit | ผ่าน |
| SOLUTION_ARCHITECT | Survey assignment/result approval, technical review approve/return | ผ่าน |
| COVERAGE | Assigned survey schedule/start/result entry | ผ่าน |
| PRICING_APPROVER | Commercial review, BOQ cost visibility | ผ่าน |
| TEAM_MANAGER | Quote return/reject/approve, Contract manager review, Activity assignment | ผ่าน |
| SALES_DIRECTOR | Contract approval | ผ่าน |
| LEGAL | Contract legal review | ผ่าน |
| ORDER_OPERATIONS | Contract signature/effective transition และ Service Order create | ผ่าน |
| ADMIN / SYSTEM_ADMIN | Admin navigation/configuration ตาม grants | unit/integration coverage; ไม่ได้เดินใน business E2E รอบนี้ |
| AUDITOR | Read navigation/audit ตาม grants | unit coverage; ไม่ได้เดินใน business E2E รอบนี้ |
| Field Team | ไม่มี dedicated role/work queue | ไม่ผ่าน Definition of Done |
| Customer Care / Support | ไม่มี dedicated role/case workflow | ไม่ผ่าน Definition of Done |

สิ่งที่แก้:

- UI visibility ใช้ permission grants ชุดเดียวกับ enterprise roles; ไม่ถือว่าการซ่อนปุ่มเป็น security control
- Backend authorization เดิมยังคงอยู่และ API/session backward compatible
- Approval tests ครอบคลุม return, reject, approve, resubmit, wrong owner/scope และ unauthenticated direct API
- Contract maker-checker, signature evidence และ configured status transitions ยังคงบังคับใช้

## 6. Database/API Changes

### Migrations

1. `20260809194500_add_service_order_business_key`
   - nullable unique business key เพื่อ deploy แบบ additive และรักษาข้อมูลเดิม
2. `20260809203000_align_user_role_assignment_user_collation`
   - ซ่อม `UserRoleAssignment.userId` ให้ตรง `User.id` พร้อมคืน FK rule เดิม
3. `20260809210000_normalize_application_collations`
   - normalize 115 application tables เป็น `utf8mb4_unicode_ci`; ไม่แตะ `_prisma_migrations`
4. `20260809211500_align_optional_activity_history_collation`
   - conditional repair สำหรับ legacy `ActivityStatusHistory` ที่มีเฉพาะ deployed environment บางชุด

### API/service behavior

- `POST /api/v1/contracts/:id/service-orders` คืน order เดิมด้วย `reused: true` เมื่อ contract version เดิมถูกส่งซ้ำ
- Eligibility ใช้ configured contract `reportingCategory = ACTIVE` แทน hard-coded status name
- Order creation และ audit event อยู่ใน transaction เดียว; reused order ไม่เขียน audit ซ้ำ
- Presales error responses ยังคง generic และ backward compatible; server log เพิ่ม correlation-safe diagnostic identity

External Test DB ได้ deploy migrations ครบ 32 รายการ และ `prisma migrate status` รายงาน `Database schema is up to date!`

## 7. Role-based E2E Test Results

Test Run ID `1786290207552` ใช้ข้อมูลร่วมกันหนึ่งชุดและทำผ่าน UI/API ตามการใช้งานจริง:

- Prospect: `cmslz2jxt0003h1ko3kxb0hhr`
- Lead: `cmslz2pbm000ah1koth2ooy2l`
- Customer: `cmslz2tdz000uh1koh29nz2q7`
- Opportunity: `cmslz2tfm000zh1konernjben`
- Contract: `CT-2026-0000002` / `cmslz4ur30045h1ko5l3mcady` / `EFFECTIVE`
- Service Order: `SO-2026-0000002` / `cmslz5o3a005wh1kojuuhebmj` / `DRAFT`

Flow ที่ผ่าน:

Prospect create/edit → Lead convert/qualify/activity → Customer/Opportunity → Requirement → Solution Design → Site Survey manual request/result → BOQ → Technical return/resubmit/approve → Commercial approve → Quote version return/reject/revision/approve → Customer accept → Contract → Manager/Legal/Director reviews → Customer/NT verified signatures → Effective → Service Order create + duplicate reuse → Customer Activity assign/complete

ยังไม่ได้อ้างว่าผ่าน: Service Qualification, Provisioning, Installation evidence, Handover, Customer Acceptance ของบริการ, Billing acknowledgement, Incident/SLA และ Renewal-to-new-Opportunity

## 8. Automated Test Results

| Gate | Result |
|---|---|
| ESLint | ผ่าน, 0 errors; 7 existing warnings |
| TypeScript | ผ่าน |
| Vitest full suite | 113 files passed, 5 skipped; 423 tests passed, 10 skipped |
| Real-DB integration | 5 files / 10 tests passed |
| Next production build | ผ่าน |
| Playwright full suite | 3/3 passed |
| Migration status | up to date |
| Collation audit | 0 FK mismatch / 0 non-Unicode application tables |
| `git diff --check` | ผ่าน; มีเฉพาะ line-ending warnings จาก Git บน Windows |

Lint warnings ที่ไม่เกิดจากรอบนี้: React Hook Form compiler compatibility 1 รายการ และ unused variables ใน compressed Prospect service 6 รายการ

Dependency install รายงาน npm audit 8 รายการ (2 moderate, 6 high); ไม่รัน auto-fix เพราะอาจเปลี่ยน major/breaking behavior

## 9. Remaining Issues by Severity

### Critical

1. สร้าง Delivery Orchestration หลัง `ContractServiceOrder.DRAFT` พร้อม data-driven statuses, owner/team, due date, next action, qualification/serviceability/capacity, installation, test/handover และ customer acceptance evidence
2. สร้าง versioned adapters/manual fallback สำหรับ NTSP fulfillment, Billing acknowledgement และ SCOMS Next โดยมี correlation ID, idempotency, retry/reconciliation และ integration log
3. สร้าง Customer Service Case/Incident/Ticket พร้อม SLA clock, assignment, timeline และ audit

### High

1. เพิ่ม dedicated Field Team และ Customer Care roles/permissions/work queues
2. เชื่อม Renewal outcome ไป Opportunity ใหม่สำหรับ upsell/cross-sell พร้อม E2E
3. Persistent notification/outbox สำหรับ next-role inbox และ deep link
4. ขยาย Customer 360 ให้เห็น active service/order/billing/support/renewal records

### Medium

1. Cross-entity global search แทน route-only command palette
2. Automated responsive visual regression และ WCAG scanner coverage
3. Resolve npm audit findings หลัง dependency compatibility review

### Low

1. เพิ่ม Next.js root scroll-behavior data attribute เพื่อลบ dev warning
2. จัดรูปแบบไฟล์ legacy ที่ถูกบีบเป็นบรรทัดยาว โดยแยก task เพื่อไม่ปะปน functional change

## 10. Files Changed

### Portal/UI

- `app/(portal)/layout.tsx`
- `app/(portal)/contracts/[id]/page.tsx`
- `components/app-navigation.ts`
- `components/app-shell.tsx`
- `components/enterprise-command-palette.tsx`
- `components/contract-workflow-controls.tsx`

### Authorization, domain and API

- `lib/authorization/navigation-permissions.ts`
- `lib/authorization/authorization-context.ts`
- `lib/contract/contract-service.ts`
- `lib/contract/prisma-contract-repository.ts`
- `lib/audit/audit-writer.ts`
- `lib/api/safe-error-identity.ts`
- `app/api/v1/presales-api.ts`

### Database/seed

- `prisma/schema.prisma`
- `prisma/seed.ts`
- migrations ทั้ง 4 รายการในหัวข้อ 6

### Tests

- `tests/e2e/enterprise-sales-flow.spec.ts`
- `tests/unit/app-navigation-permission.test.ts`
- `tests/unit/service-order-handoff-contract.test.ts`
- `tests/unit/database-collation-normalization.test.ts`
- `tests/unit/identity-collation-migration.test.ts`
- `tests/unit/optional-activity-history-collation.test.ts`
- `tests/unit/safe-error-identity.test.ts`
- `tests/unit/audit-writer.test.ts`
- `tests/unit/contract-service.test.ts`
- `tests/unit/enterprise-ui-contract.test.ts`
- `tests/unit/mysql8-migration-bootstrap.test.ts`

## 11. Migration / Deployment Steps

1. สำรองฐานข้อมูลและกำหนด maintenance window; collation normalization อาจ lock/rebuild ตาราง
2. รัน `npm ci`
3. รัน `npm run db:generate`
4. รัน `npx prisma migrate deploy`
5. ตั้ง seed credentials ผ่าน environment เท่านั้น; ห้าม hard-code password
6. รัน `npm run lint`, `npm run typecheck`, `npm run test`, real-DB integration, `npm run build` และ Playwright
7. ตรวจ `prisma migrate status` และตรวจ FK collation mismatch หลัง deploy
8. Production rollout ต้อง review migration history drift ของ environment เป้าหมายและมี rollback/restore plan ก่อน normalization

## 12. Screenshots

ไม่มี baseline screenshot ก่อนแก้ใน task/workspace และ Playwright ตั้ง `trace: retain-on-failure` จึงไม่มี final screenshot artifact จากรอบที่ผ่าน หัวข้อนี้จึงยังไม่มีหลักฐาน before/after และไม่ได้สร้างภาพจำลองมาทดแทน

หลักฐานที่มีจริงคือ automated assertions, test output, persisted Test Run ID และ traceable database identifiers ในหัวข้อ 7 การเก็บ visual baseline/after screenshots ควรเพิ่มเป็นงานถัดไปโดยใช้ test environment ที่กำหนด viewport Desktop/Tablet/Mobile และไม่ใช้ production data
