# NTOP Approval Workflow

| Metadata | Value |
|---|---|
| Status | Approved Baseline |
| Version | 1.0 |
| Owner | Pricing and Commercial Governance |
| Reviewers | Finance, Sales Director, Legal, Security, Auditor, Product, QA |
| Last Updated | 2026-08-25 |
| Related Documents | [Requirements](product-requirements.md), [Domain](domain-model.md), [Permissions](roles-and-permissions.md), [Opportunity](opportunity-workflow.md), [API](api-design.md) |
| Assumptions | Policy versioned; maker-checker mandatory for exceptional commercial terms |
| Open Decisions | Named Commercial Committee members; operational reminder/escalation timing; detailed legal trigger catalog |

## Temporary implementation state (2026-08-25)

ตามคำสั่งล่าสุดของเจ้าของงาน ระบบพัก Approval ทั้งระบบไว้ก่อนจนกว่าเงื่อนไขและ operational ownership จะได้รับการยืนยัน การตั้งค่ากลางอยู่ที่ Administration → Approval Control Center โดย `ApprovalSystemConfiguration` และ workflow ทั้ง 7 รายการเริ่มต้นเป็น `DISABLED`: Quotation, Proposal, Solution Technical, Solution Commercial, Site Survey Result, BOQ และ Contract ผู้มีสิทธิ์ยังสร้างหรือแก้ไข Draft ได้ แต่ UI และ server ไม่อนุญาตให้ส่งเข้ากระบวนการอนุมัติหรือบันทึกคำตัดสิน ระบบไม่ auto-approve และไม่เปลี่ยนสถานะให้ดูเหมือนผ่านอนุมัติ

Admin สามารถ Publish policy version, กำหนดผู้อนุมัติตามวงเงิน/role, maker-checker, permission และ Authority Grant ล่วงหน้าได้โดยยังไม่เปิดใช้งาน การเปิดภายหลังต้อง Publish policy ที่มี approver step แล้วตั้ง workflow เป็น `ENFORCED` และตั้ง Global Mode เป็น `ENFORCED` การเปลี่ยน mode ใช้ optimistic version และมี audit evidence ค่า `APPROVAL_EMERGENCY_DISABLED=true` เป็น deployment override สำหรับบังคับปิดทุก workflow โดยไม่แก้ configuration ที่เก็บไว้ การพักนี้ไม่ใช่การยกเลิก baseline FR-007/BR-004

## 1. Policy inputs

Routing พิจารณา quote total, discount, gross margin, product/category, customer segment, opportunity risk, non-standard terms, partner cost, contract duration และ exception type Policy evaluator คืน required steps + execution mode + SLA โดย snapshot policy version และ input values ไว้กับ request (BR-004, FR-007)

Approved OD-003 thresholds are configuration data and must not be hard-coded in application logic:

| Tier | Quote total | Mandatory authority |
|---|---:|---|
| T1 | ≤10M THB | Team Manager + independent maker-checker |
| T2 | >10M and ≤100M THB | Sales Director + Pricing Approver |
| T3 | >100M THB | Commercial Committee/authorized executives |

Discount >10%, gross margin <15%, non-standard legal terms, unconfirmed coverage/cost, conflict of interest or policy override escalate at least one authority level and never reduce approval. No eligible approver causes escalation, never automatic approval.

## 2. States

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> PENDING: submit
  PENDING --> APPROVED: all mandatory steps approve
  PENDING --> REJECTED: reject
  PENDING --> RETURNED: request changes
  PENDING --> CANCELLED: maker cancels before final decision
  PENDING --> EXPIRED: policy/SLA validity expires
  RETURNED --> PENDING: new quote version resubmitted
  REJECTED --> PENDING: authorized resubmission with new version
  APPROVED --> SUPERSEDED: quote/policy-relevant data changes
  APPROVED --> [*]
```

Decision records append-only; request status เป็นผล derivation จาก step decisions ห้าม overwrite history

## 3. Routing and execution

- Sequential เมื่อ step หลังต้องพึ่ง decision ก่อนหน้า; parallel สำหรับ independent Pricing/Legal/Technical checks
- Reject ที่ mandatory step ปิด request; Return ส่งกลับ maker พร้อม required changes
- Resubmit ต้องอ้าง quote version ใหม่หรือพิสูจน์ว่า approved fields ไม่เปลี่ยน
- Policy-relevant change หลัง Approved ทำ approval `SUPERSEDED` และ reroute
- Approver assignment ใช้ role + organization + authority at submission; delegation snapshot ณ เวลา decision
- ไม่มี eligible approver ให้ status pending-escalation และ alert owner; ห้าม auto-approve

## 4. Authority and SoD

- Maker/quote editor ห้าม approve mandatory step ของ quote ตนเอง
- Approver ต้อง active, MFA-valid, within monetary/segment scope และไม่มี conflict flag
- Delegation จำกัดช่วงเวลา/scope/authority และ audited; expired delegation ถูก deny
- Override ใช้เฉพาะ named exceptional role + second approval + reason/evidence; Admin ไม่มี override โดย role alone
- Bulk approval ปิดโดย default; หากเปิดต้อง evaluate แต่ละ request และสร้าง decision ต่อรายการ (SEC-002, COMP-001)

## 5. Notifications and SLA

เมื่อ assign/remind/escalate/decide ส่ง in-app notification ผ่าน queue แบบ idempotent SLA clock ใช้ business calendar ที่อนุมัติ (Open Decision) ระบบเตือนก่อน breach และ escalate ไป role owner; outage ไม่เปลี่ยนผล approval และ replay ได้ (FR-012, INT-003)

## 6. Immutable evidence

เก็บ approval request ID, quote/version hash, policy/version, evaluated inputs, step sequence, assigned/delegated approver, decision, comment, timestamp, actor identity/scope, MFA assurance (ไม่เก็บ secret), correlation ID และ document references Auditor อ่านได้แต่แก้ไม่ได้

## 7. Integration fallback

หาก external approval/finance service ยังไม่มี contract ให้ NTOP เป็น workflow record และส่ง controlled package/manual reference เมื่อ adapter ล่ม request คง `PENDING_EXTERNAL` พร้อม owner/SLA; operator บันทึก external decision reference แล้ว second-person verify และ reconcile (BR-005, INT-001–INT-004)

## 8. Acceptance scenarios

- Maker approve quote ตนเองถูก deny
- Approver เกิน authority/หมด delegation ถูก deny
- Parallel steps complete แล้ว final status deterministic
- Quote change หลัง Approved ทำ status Superseded และสร้าง route ใหม่
- Duplicate decision key ไม่สร้าง decision ซ้ำ
- Queue/email outage ไม่สูญ assignment และ replay notification ได้
- ทุก approved/rejected request reconstruct policy/input/actor evidence ได้
