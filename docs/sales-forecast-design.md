# NTOP Sales Forecast Design

| Metadata | Value |
|---|---|
| Status | Draft for Review |
| Version | 0.1 |
| Owner | Sales Director / Sales Analytics |
| Reviewers | Finance, Team Managers, Data Governance, Architecture, QA |
| Last Updated | 2026-07-11 |
| Related Documents | [Requirements](product-requirements.md), [Domain](domain-model.md), [Opportunity Workflow](opportunity-workflow.md), [Database](database-design.md), [Testing](testing-strategy.md) |
| Assumptions | THB reporting currency initially; Asia/Bangkok business timezone; snapshots immutable |
| Open Decisions | Stage probability defaults; forecast category authority; fiscal calendar; FX source; risk thresholds; target/quota source |

## 1. Definitions

- **Pipeline value:** sum current opportunity estimated value ใน selected open scope
- **Weighted pipeline:** `Σ(amount × probability / 100)` คำนวณต่อ item แล้วรวมด้วย decimal arithmetic
- **Commit:** owner/manager ยืนยันว่าคาดปิดใน period และผ่าน minimum stage/data gates
- **Best Case:** มีโอกาสปิดใน period แต่ยังไม่ถึง Commit confidence
- **Pipeline:** open opportunity ที่อยู่ใน period แต่ยังไม่ classified สูงกว่า
- **Omitted:** excluded พร้อม reason; Won/Lost/Canceled แสดงแยก
- **Snapshot:** immutable copy ของ source facts, formula version, scope และ cutoff time (BR-003, DATA-004)

## 2. Source fields

Opportunity ID/version, owner/team/org, customer/segment/flow, stage, forecast category, amount/currency, probability, expected close date, created/stage-entered dates, next action/due date, quote/approval/coverage status, risk flags, won/lost/cancel reason และ data-quality status

ค่าที่ถูกแก้หลัง snapshot ไม่เปลี่ยน snapshot เดิม; correction แสดงใน snapshot ถัดไปพร้อม change history

## 3. Periods and rollups

- Operational timezone `Asia/Bangkok`; database timestamps UTC
- Calendar month/quarter เป็น default จน fiscal calendar ได้รับอนุมัติ
- Rollup: KAM → Team → Organization Unit → Enterprise; hierarchy ใช้ effective date ณ cutoff
- Drill-down ต้องใช้ permission scope เดียวกับ Customer/Opportunity API
- Currency conversion deferred จน FX source/policy approved; v1 THB-only หรือแสดงแยก currency ห้ามรวมแบบไม่มี FX (Open Decision)

## 4. Snapshot process

1. Scheduled worker lock snapshot key `(period, scope, cutoff, formulaVersion)` แบบ idempotent
2. Read consistent source cutoff และ materialize item facts
3. Compute measures/quality flags แล้ว reconcile source/item totals
4. Commit snapshot header/items atomicallyหรือ staged publish
5. Publish `ForecastSnapshotCreated`; dashboard เปลี่ยน pointer หลัง complete เท่านั้น

Daily snapshot สำหรับ operational trend และ month-end locked snapshot เป็น draft default; final schedule เป็น Open Decision

## 5. Risk signals

| Signal | Draft rule | Requirement |
|---|---|---|
| Stale stage | days in stage เกิน approved threshold | FR-009 |
| Close-date risk | close date ใกล้/เลยกำหนดแต่ gate/next action ไม่พร้อม | FR-009 |
| Slippage | close date เลื่อนไป period ถัดไปจาก snapshot ก่อน | FR-009 |
| No next action | open opportunity ไม่มี future next action | FR-003 |
| Low data quality | missing mandatory forecast fields | DATA-004 |
| Approval risk | expected close ใกล้แต่ quote/approval pending | FR-007, FR-009 |
| Coverage risk | solution stage ขึ้นไปแต่ required coverage ไม่ confirmed | FR-005 |

Threshold ต่อ segment/stage ต้อง configuration-versioned ไม่ hard-code

## 6. Measures

Pipeline, weighted pipeline, Commit/Best Case/Pipeline totals, won revenue, win rate, conversion, average deal size, stage aging, slippage rate, overdue next-action rate, forecast variance และ pipeline coverage (`eligible pipeline / target`) Target/quota ยังเป็น Open Decision; เมื่อไม่มี source ให้แสดง N/A ไม่ใช่ zero

Win rate denominator และ cancellation treatment ต้องได้รับ Sales/Finance sign-off; baseline draft: `Won / (Won + Lost)` โดย exclude Cancelled

## 7. Formula examples

| Opportunity | Amount THB | Probability | Category | Weighted |
|---|---:|---:|---|---:|
| A | 1,000,000.00 | 80 | Commit | 800,000.00 |
| B | 500,000.00 | 40 | Best Case | 200,000.00 |
| C | 250,000.00 | 0 | Pipeline | 0.00 |

Expected weighted total = THB 1,000,000.00; rounding half-up to 2 display decimals หลัง item calculation โดยเก็บ precision ตาม database design

## 8. Dashboard and data quality

Filters: snapshot/period, org/team/owner, segment, flow, stage, category, risk Customer-level drill-down permission checked server-side Quality panel แสดง completeness, snapshot freshness, stale search/index warnings, omitted/unclassified counts และ reconciliation status ห้ามนำ forecast draft ไปแสดงเป็น locked actual โดยไม่มี label

## 9. Acceptance

- Same snapshot query ให้ผลเดิมแม้ source opportunity เปลี่ยน
- Rollup sum ตรง item-level ภายใน decimal tolerance
- Cross-scope drill-down ถูก deny
- Slippage/aging/timezone boundary ผ่าน approved test vectors
- Snapshot retry ไม่สร้าง duplicate
- Incomplete/FX-unknown data แสดง quality warning ไม่ silently aggregate

