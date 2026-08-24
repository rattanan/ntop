# Help Center Content Update — 2026-08-24

## Scope

ปรับ Help Center ให้ตรงกับ route, application service, authorization และ workflow ใน repository ปัจจุบัน รวม AI Page Assistant ที่เพิ่มในวันเดียวกัน โดยไม่เปลี่ยน business workflow, API หรือ database schema

## Acceptance criteria

- ครอบคลุม Prospect → Lead → Customer/Opportunity → Presales → Proposal/Quotation/Approval → Contract/Service Order
- มีคู่มือ Activity/Notification, AI Page Assistant, AI Assistance และ Administration
- ระบุ server authorization, optimistic version, maker-checker, immutable version, Decimal, timezone และ audit ในบริบทที่ผู้ใช้ต้องรู้
- ระบุว่า NTSP และ Service Order ปัจจุบันเป็น manual handoff และไม่ใช่ Integration Success จนมี acknowledgement จริง
- AI Draft/Suggestion อธิบาย Human Confirmation, provenance, manual fallback และ feedback ที่ไม่ใช่ training consent
- Search ค้นจากหัวข้อ เนื้อหา และ FAQ พร้อม audience filter เดิม; AI Page Assistant ยังจัดอันดับ Help ที่เกี่ยวข้องแบบ deterministic
- Related article ทุก slug อ้างบทความที่มีอยู่จริง
- ไม่ลบ route หรือเปลี่ยนพฤติกรรม business workflow/API เดิม

## Source of truth reviewed

- `docs/product-requirements.md`, `docs/system-architecture.md` และ `docs/ai-page-assistant-implementation.md`
- เอกสาร implementation ของ Prospect, Lead, Customer, Opportunity/Commercial, Solution Design, Proposal, Contract, Identity และ Organization
- Portal routes, navigation, forms และ server-side permission services ปัจจุบัน

## Verification

- Unit contract ตรวจรายการบทความ วันที่อัปเดต ความละเอียดขั้นต่ำ การค้นจากเนื้อหา/FAQ, deterministic Help ranking และ related slug integrity
- Repository gate: `npm run lint`, `npm run typecheck`, `npm test`
