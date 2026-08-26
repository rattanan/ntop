# NTOP Opportunity Workflow

| Metadata | Value |
|---|---|
| Status | Approved Baseline |
| Version | 1.2 |
| Owner | Sales Director / Sales Operations |
| Reviewers | KAM, Team Manager, Presales, Coverage, Pricing, Order Operations, Audit, QA |
| Last Updated | 2026-08-26 |
| Related Documents | [Requirements](product-requirements.md), [Domain](domain-model.md), [Permissions](roles-and-permissions.md), [Approval](approval-workflow.md), [Forecast](sales-forecast-design.md) |
| Assumptions | Canonical stages ใช้ชื่อด้านล่าง; transition enforce server-side และเลือก target stage ได้อิสระ |
| Open Decisions | Stage probability defaults; stale-day thresholds by segment; mandatory document checklist |

## 1. Entry prerequisites

Opportunity สร้างจาก qualified Lead หรือโดย KAM/Manager ที่มีสิทธิ์ ต้องมี Customer, owner, organization unit, name, flow, initial estimated value/currency, expected close date และ source Lead conversion ต้อง idempotent และ resolve duplicate candidates ก่อน (FR-002, FR-004)

## 2. State model

Canonical stages คือ `QUALIFY`, `DISCOVER`, `SOLUTION`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`, `CANCELLED` และ `EXPIRED` หน้า Workflow แสดงลำดับการขายมาตรฐานเพื่อให้เข้าใจบริบท แต่ผู้ใช้ที่มีสิทธิ์ Transition สามารถเลือก target stage อื่นใดก็ได้ ไม่จำกัดว่าต้องเดินหน้า ย้อนกลับ ปิด หรือ reopen ตามลำดับเดิม

`CANCELLED` เป็นสถานะ administrative แยกจาก `LOST` และใช้เมื่อ duplicate/invalid/created-in-error พร้อม reason และ cancelled reason; `LOST` ต้องมี reason, lost reason และ lost category เพื่อรักษาคุณภาพข้อมูลรายงาน

## 3. Unrestricted stage selection

- UI แสดง canonical stage อื่นทุกค่า ยกเว้น stage ปัจจุบัน โดยไม่ query `OpportunityTransitionPolicyVersion`
- Server ไม่ตรวจ from/to route, active/effective policy, stage-gate fields หรือ required permission ราย route
- Server derive command เพื่อใช้ใน history: target `WON/LOST/CANCELLED/EXPIRED` เป็น `WON/LOST/CANCEL/EXPIRE`; จากสถานะปลายทางกลับ active เป็น `REOPEN`; active stage ที่ลำดับสูงขึ้น/ต่ำลงเป็น `FORWARD/RETURN`
- ทุก transition ต้องมี reason; `LOST` ต้องมี lost reason/category และ `CANCELLED` ต้องมี cancelled reason
- ห้ามแก้ stage field โดยตรงจาก profile update; ต้องใช้ Transition command เพื่อรักษา optimistic version, idempotency, history และ audit (FR-004, COMP-001)

## 4. Gates and dependencies

- Coverage และ Solution data ยังคงเป็นข้อมูลประกอบงานขาย แต่ไม่ block การเปลี่ยน Opportunity stage
- Quote version ต้องอ้าง solution/coverage versions; change หลัง submit สร้าง quote version ใหม่
- Proposal/Negotiation ไม่เท่ากับ approval; commercial gate ใช้ [approval-workflow.md](approval-workflow.md)
- Quote submission, approval และ Internal Order ยังคงใช้ gate ของ module เจ้าของข้อมูลเอง การปลด route ของ Opportunity ไม่ bypass commercial controls (FR-005–FR-008)

## 5. Ownership, dates and exceptions

- Reassignment เก็บ effective history, reason และ target manager scope; open tasks reassigned/explicitly retained
- Expected close date เปลี่ยนหลัง Proposal ต้องมี reason; repeated slippage สร้าง risk signal
- Opportunity ไม่มี next action หรือ stage aging เกิน threshold ถูก mark stale และ escalated ไม่ auto-close
- Lost reason immutable หลัง reporting snapshot; correction ทำ audited amendment
- Reopen สร้าง forecast history ใหม่ แต่ snapshot เดิมไม่เปลี่ยน (DATA-004)

## 6. Required audit

ทุก transition เก็บ from/to, derived command, aggregate version, actor/role/scope, timestamp, reason, correlation ID และ before/after key fields โดย `policyVersionId` ใช้ค่า `UNRESTRICTED_STAGE_SELECTION_V1` และ evidence snapshot ระบุ unrestricted mode Event publish หลัง commit ผ่าน outbox

## 7. Acceptance scenarios

- ผู้มีสิทธิ์เปลี่ยนจาก QUALIFY ไป PROPOSAL หรือย้อนจาก NEGOTIATION ไป DISCOVER ได้โดยตรง
- การไม่มี Requirements, Coverage, Solution หรือ Quote ไม่ block Opportunity transition
- Stale version transition คืน 409 และไม่ append history
- Unauthorized cross-team transition ไม่เปิดเผย record
- Transition ที่ไม่มี reason หรือขาด lost/cancelled detail ถูก deny
- Lost/Won/Cancelled/Expired สามารถเปลี่ยนไป stage อื่นได้และเก็บ snapshot/history เดิม
- Duplicate retry ด้วย idempotency key สร้าง transition ครั้งเดียว
