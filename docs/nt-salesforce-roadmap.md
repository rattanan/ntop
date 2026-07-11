# NT Enterprise Sales Force Platform Roadmap

## 1. Product Vision

NT Enterprise Sales Force Platform เป็นศูนย์กลางการขายลูกค้าองค์กรของ NT ตั้งแต่การหาและคัดกรองลูกค้า ไปจนถึงการส่งมอบและรักษารายได้หลังการขาย โดยลดการคีย์ข้อมูลซ้ำและทำให้ทุกฝ่ายทำงานบนข้อมูลลูกค้า โซลูชัน ราคา และคำสั่งซื้อชุดเดียวกัน

เป้าหมายคือเปลี่ยนการขายจากระบบบันทึกข้อมูลแยกส่วนเป็น workflow ที่ควบคุมได้:

`Lead → Account → Opportunity → Coverage/Solution → Quote/Approval → Order → Implementation → After Sale → Renewal`

ระบบรองรับวงจร N2N คือ หา, ได้, ใช้บริการ, และออก พร้อมข้อมูลสำหรับตัดสินใจของฝ่ายขาย ผู้บริหาร และหน่วยงานส่งมอบ

## 2. Core Modules

### Customer Segmentation and Ownership

- กลุ่มภาครัฐ: G1 นโยบายดิจิทัล, G2 Strategic KAM, G3 สาขาทั่วประเทศ, G4 ส่วนกลางทั่วไป, G5 องค์กรปกครองส่วนท้องถิ่น
- กลุ่มเอกชน: B1 องค์กรขนาดใหญ่, B2 ผู้ให้บริการ/โครงข่าย, B3 ธุรกิจต่างจังหวัด, B4 SME/กลางใน กทม./ปริมณฑล
- กำหนดเจ้าภาพบัญชี, sales flow F1-F8, วิธีเข้าถึง Direct/Partner/Displace และ vendor assessment

### Lead, Account, and Opportunity

- รับ Lead จาก import, website, event, partner, referral และลูกค้าเดิม
- จัดการ Account 360, group company, branch, contact, decision maker, procurement, technical contact และ relationship map
- จัดการ Opportunity ตาม stage: Qualification, Need Analysis, Solution Design, Proposal, Negotiation, Closed Won และ Closed Lost
- บันทึก meeting, activity, next action, document checklist และ warning งานที่ขาด

### Sales Pipeline Forecasting

Sales Pipeline Forecasting เป็น **core feature ของ Phase 1** ไม่ใช่ความสามารถในอนาคต

- Forecast มูลค่า weighted pipeline จากมูลค่า opportunity, probability และ expected close date
- มุมมอง forecast รายเดือน/ไตรมาสตาม sales owner, segment, flow และ stage
- แสดง pipeline coverage, win rate, conversion, aging, close-date risk และ risk opportunity
- รองรับ forecast สำหรับ CEO, Sales Director, Team Manager และ salesperson

### Solution, Feasibility, and Pricing

- Product catalog สำหรับ Internet, MPLS, SD-WAN, Cloud, IDC, SIP, Mobile, IoT, Security และ AI Service
- Solution design แยกบริการ NT, SI/turnkey, partner work, ต้นทุน, margin, risk และ technical assumptions
- Coverage/feasibility check ก่อนออกแบบ solution และเสนอราคา: Fiber, OLT, distance, capacity, available port, partner availability และ expected install date
- Pricing approval พร้อมราคาอ้างอิง, prior price, feasibility, NT work share, risk และคู่แข่ง

### Commercial Delivery Lifecycle

- Quotation, discount, margin, approval, contract, NDA, TOR และ PO
- Order handoff ไป OM/CRM/Billing โดยใช้ข้อมูลชุดเดียวกันและ external reference tracking
- Implementation tracking: survey, approve, provision, install, testing และ acceptance
- After sale: service instance, SLA, trouble ticket, usage, billing/payment summary, renewal, upsell และ churn risk

## 3. MVP Scope

MVP เป็น internal sales control tower ที่ให้ฝ่ายขายดำเนินงานได้จนถึง internal order และ manual handoff:

- Segmentation G1-G5/B1-B4, ownership และ flow F1-F8
- Lead, Account 360, contact/relationship, activity และ Opportunity
- Forecast dashboard ราย owner/stage/expected close period พร้อม weighted pipeline และ risk flags
- Vendor gate: Direct, Partner, Displace และ Budget-Locked/Long-Game
- Coverage request, feasibility result และ confirmed cost ก่อน quote submission
- Product catalog, solution/cost, quotation และ draft pricing approval
- Internal order และ handoff task สำหรับ OM, CRM และ Billing; ไม่ส่งข้อมูลไปยังระบบภายนอกอัตโนมัติใน MVP

## 4. Roadmap

### Phase 1 — Sales Control Tower and Forecasting

- Customer segmentation, ownership, F1-F8 flow profile และ vendor assessment
- Lead management, Account 360, contacts/relationship map, activities และ meeting summary
- Opportunity management, stage checklist, next action และ document completeness
- **Sales Pipeline Forecasting:** weighted pipeline, forecast, win rate, conversion, aging, close-date risk และ dashboards
- Initial product catalog และ internal analytics dashboard

### Phase 2 — Presale Governance and Commercial Workflow

- Solution design, coverage/feasibility workflow และ confirmed-cost control
- Pricing approval by amount: up to 10M, 50M, 100M, 300M and above 300M THB
- Quotation, discount/margin control, approval routing, contract/NDA/TOR/PO repository
- Internal order creation and manual handoff to OM/CRM/Billing

### Phase 3 — Delivery, After-Sale, and Live Integration

- NTSP, OM, CRM, Billing, GIS/Network Inventory and document/e-signature integrations
- Single Order Management and Single Billing implementation
- Implementation milestone tracking, workforce coordination and acceptance
- Service/SLA/trouble-ticket synchronization, renewal, upsell, churn risk and Customer 360 external feeds

## 5. Key Entities

| Area | Key entities |
| --- | --- |
| Customer | Customer, Segment, Flow Profile, Group Company, Branch, Contact, Relationship |
| Sales | Lead, Lead Source, Lead Score, Opportunity, Stage Checklist, Vendor Assessment, Activity, Meeting |
| Forecast | Forecast Snapshot, Forecast Period, Pipeline Metric, Risk Signal |
| Presale | Product, Bundle, Solution Design, Solution Item, Coverage Check, Site, Feasibility Result, Cost Estimate |
| Commercial | Quote, Quote Item, Discount, Margin, Approval Request, Approval Decision, Contract, NDA, TOR, PO |
| Delivery | Internal Order, Handoff Task, External Reference, Implementation Project, Milestone, Acceptance |
| After Sale | Service Instance, SLA, Trouble Ticket, Usage Summary, Billing Summary, Renewal, Upsell Opportunity, Churn Risk |

## 6. User Roles

| Role | Primary responsibilities |
| --- | --- |
| Executive / CEO | Revenue, forecast, top customer and strategic-risk dashboard |
| Sales Director | Sales ranking, pipeline, conversion, lost reason and policy oversight |
| Team Manager | Coaching, activity, meeting, call, proposal and forecast review |
| KAM / Salesperson | Lead, account, opportunity, activity, quote and renewal ownership |
| Solution Architect | Solution design, feasibility assumptions and technical risk |
| Coverage / Network Engineer | Coverage, capacity, partner availability and install-date confirmation |
| Pricing / Approver | Cost, margin, pricing approval and policy exception review |
| Project / Provisioning | Order handoff, implementation milestone and acceptance tracking |
| Customer Success / After Sale | SLA, ticket, service health, renewal and churn prevention |
| System Admin / Auditor | Master data, role access, configuration and audit trail |

## 7. Integration Points

- **NTSP and OM:** order handoff, provisioning status and external order references
- **CRM:** customer and service context where a source-of-truth boundary is defined
- **Billing:** single billing reference, invoice and payment summary
- **GIS / Network Inventory:** Fiber, OLT, distance, capacity, available port and feasibility
- **Trouble Ticket / Workforce:** incident, SLA, field work and resolution status
- **SAP:** commercial, procurement and financial references
- **DWH / BI:** executive reporting and historical forecasting
- **Document Management / e-Signature:** contract, NDA, TOR, PO and signed documents
- **Email / LINE OA:** customer communication, notifications and activity capture
- **AI Knowledge Base:** sales preparation, meeting summarization, next best action and knowledge retrieval

Until API contracts are available, integrations operate through manual handoff tasks and external reference fields. No live API integration should be claimed without an approved interface specification, authentication method and operational owner.

## 8. Risks

- Missing or unstable NTSP/OM/GIS/Billing APIs can delay automation; use adapter boundaries and manual handoff until contracts are approved.
- Incorrect customer segment or account ownership can create duplicate pursuits; enforce one owner and auditable reassignment.
- Stale coverage/capacity data can cause incorrect pricing or negative margin; require confirmed feasibility and cost before quote submission.
- Pricing approval bypass can create commercial risk; require reason, authority and immutable audit trail.
- Customer, government and network data require role-based access, least privilege, audit logging and document controls.
- Legacy MariaDB 5.5 cannot use standard Prisma Migrate; apply tested versioned SQL scripts and maintain schema-change governance.
- Low adoption can reintroduce parallel spreadsheets and duplicate keying; make forecast, order handoff and operational reporting depend on NTOP records.
