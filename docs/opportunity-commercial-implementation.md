# Opportunity → Pipeline → Quotation → Approval Implementation

## Scope

Milestone นี้เพิ่ม governed workflow แบบ additive ต่อจาก Customer Foundation โดยให้ REST `/api/v1` และ UI adapters เรียก application services ชุดเดียวกัน ข้อมูลและหน้า legacy ยังคงอ่านได้ MySQL 8 forward migration ยังไม่ถูก deploy แต่ MariaDB 5.5 compatibility migration ถูก apply กับ development database แล้วเมื่อ 2026-07-14

## Acceptance criteria

- Opportunity stage เปลี่ยนผ่าน configured transition command เท่านั้น; missing gate, unauthorized scope และ stale version ถูกปฏิเสธ โดย history, receipt และ hash-chained audit อยู่ transaction เดียวกัน
- Pipeline ใช้ authorization scope เดียวกับ Opportunity, จำกัดผล drill-down 200 รายการ และคำนวณ amount/weighted amount ด้วย Decimal
- Forecast snapshot มี idempotent snapshot key, source version, amount source, scope/formula/timezone/quality snapshots และ item facts ที่ immutable
- Quote ใหม่ต้องอ้าง Opportunity; Customer สืบทอดจาก Opportunity; calculation ใช้ Decimal 19,4; submitted version แก้ไม่ได้ และการแก้ approved quote สร้าง version ใหม่พร้อม supersede approval เดิม
- Quote submit ตรวจ policy-configured Coverage/Solution/confirmed-cost gates ฝั่ง server และสร้าง approval route จาก immutable policy/input snapshot โดยไม่มี auto-approve path
- Approval approve/reject/return/delegate/escalate ตรวจ scope, maker-checker, effective authority และ stale version ฝั่ง server; decision เก็บ policy input, authority, actor, reason, timestamp และ hash chain
- Legacy Quote/QuoteItem/Approval และ API/UI read path เดิมไม่ถูกลบ; forward migration backfill governed version โดยไม่ drop table/column
- Opportunity create/update ไม่รับ stage จาก payload และใช้ application service, optimistic version, idempotency, scoped Customer access และ audit transaction เดียวกัน
- REST `/api/v1` ครบ Opportunity CRUD, forecast summary/quality, snapshot list/retrieval และ mutation เดิมทั้งหมด โดย query ถูก bounded และ scoped ฝั่ง server
- Admin `/admin/workflow` สร้าง transition/approval policy version, authority grant, role assignment และ confirmed product cost ผ่าน privileged audited service เท่านั้น
- Real-DB integration ต้องยืนยัน rollback เมื่อ audit ล้มเหลว, receipt idempotency และ Critical E2E ทั้งเส้นทางโดย rollback fixture ทุก record หลังจบ
- Portal navigation อยู่ใน sidebar ที่ย่อ/ขยายได้ มีเมนูย่อยและ mobile drawer; top header จำกัดเป็น Home, Help, notification และ account control โดย notification ใช้ข้อมูลจริงตาม actor เท่านั้น
- Help Center รองรับค้นหา, audience filter, article detail และ related articles โดยปรับโครงสร้างจาก `nt-ai-mediation` ให้เป็นเนื้อหา NTOP
- Quotation editor แยก Header/Detail, รองรับสินค้าได้ 1-100 รายการ, ราคาขายและส่วนลดรายบรรทัด, แสดง list/floor price และปฏิเสธยอดสุทธิต่อหน่วยที่ต่ำกว่า floor price ฝั่ง server

## Migration policy

ไฟล์ `20260713220000_add_opportunity_pipeline_quote_approval/migration.sql` เป็น MySQL 8 expand/backfill migration และยังไม่ถูก deploy ส่วน development MariaDB 5.5 ใช้:

- `prisma/legacy-mariadb-5.5-opportunity-commercial.sql`
- `prisma/legacy-mariadb-5.5-deal-risk-pipeline-dependency.sql`

ทั้งสองไฟล์ใช้ `LONGTEXT` สำหรับ JSON, hash-backed exact unique keys และ migration markers `20260713220000_add_opportunity_pipeline_quote_approval` กับ `20260714083500_add_deal_risk_pipeline_dependency`

Product floor price ใช้ MySQL 8 forward migration `20260714100000_add_product_floor_price/migration.sql` ซึ่งยังไม่ deploy และ MariaDB 5.5 compatibility migration `prisma/legacy-mariadb-5.5-product-floor-price.sql` ที่ apply ใน development database แล้ว ฟิลด์เป็น nullable เพื่อรักษาข้อมูลเดิมและไม่สมมติราคาขั้นต่ำแทนเจ้าของข้อมูล

## Development database configuration

- Transition policy: 21 active version-1 routes มี effective date จริง
- Approval policy: `COMMERCIAL_DEFAULT` version 1 active พร้อม effective date
- Authority: TEAM_MANAGER, SALES_DIRECTOR, PRICING_APPROVER และ COMMERCIAL_COMMITTEE ถูกเก็บเป็น grants แบบ version-compatible data
- Existing legacy ADMIN ถูก map เป็น active `ADMIN / ENTERPRISE` assignment โดยไม่เปลี่ยน legacy role
- Product `1111` ยังไม่มี confirmed cost เพราะไม่มี Coverage/Solution/แหล่งต้นทุนยืนยัน การใส่ค่าจาก list price จะเป็นข้อมูลสมมติ จึงต้องกรอกผ่าน Workflow Admin เมื่อได้รับต้นทุนจริง

## Verification

รัน real database suite ด้วย `RUN_DB_INTEGRATION=1 npm run test:db`. Suite ใช้ outer transaction rollback และตรวจว่า Customer, Opportunity, Quote Version, Approval, audit event และ idempotency receipt ของ fixture ไม่เหลือหลังทดสอบ

## Deferred production gates

MySQL 8 rehearsal/deploy, 2.5M-customer/100-user performance, fiscal calendar/FX source, confirmed production product costs, production approver user assignment และ full UAT ยังอยู่หลัง development ตามแผนที่ล็อกไว้
