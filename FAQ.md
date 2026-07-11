# NTOP Frequently Asked Questions

เอกสารนี้อธิบายกติกาการใช้งาน NTOP สำหรับผู้ใช้ฝ่ายขาย ผู้จัดการ Presales, Coverage, Pricing และ Order Operations โดยใช้ภาษาที่สอดคล้องกับ [คำศัพท์กลาง](CONTEXT.md)

## Customer และ Customer Account

### Customer ต่างจาก Customer Account อย่างไร?

**Customer** คือนิติบุคคล หน่วยงาน หรือองค์กรที่ NT ขายหรือให้บริการ ส่วน **Customer Account** คือความสัมพันธ์เชิงพาณิชย์และขอบเขตที่ทีมขายดูแล Customer นั้น เช่น owner, segment และประวัติการขาย คำว่า Account เดี่ยว ๆ ไม่ควรใช้ เพราะอาจสับสนกับ User Account

### ทำไม Customer ต้องมีรหัสภายในของ NTOP?

รหัสภายในช่วยให้ Customer identity คงเดิมแม้ชื่อ เลขอ้างอิง หรือข้อมูลจากระบบภายนอกเปลี่ยน External ID จะถูกเก็บแยกตาม source system และไม่ใช้แทน NTOP Customer ID

### พบ Customer ซ้ำควรทำอย่างไร?

ระบบต้องเสนอ duplicate candidates จาก identifier และข้อมูลที่ normalize แล้ว แต่ห้ามรวม Customer อัตโนมัติ Data Steward ต้องตรวจสอบและอนุมัติ merge พร้อมเหตุผล ระบบเก็บ aliases, history และ audit หลัง merge

### ใครตัดสินกรณี Customer ซ้ำข้ามหน่วยงานขาย?

ให้ escalate ไปยัง Customer Data Owner Ownership ของฝ่ายขายไม่ใช่ตัวตัดสินว่า Customer identity ใดถูกต้อง

## Lead และ Lead Conversion

### Lead คือ Customer แล้วหรือยัง?

ยังไม่จำเป็น Lead คือผู้มุ่งหวังที่ Customer identity ยังไม่ยืนยัน จึงอาจยังไม่ผูก Customer หรือผูกกับ Customer candidate ระหว่างตรวจสอบ

### สร้าง Lead แล้วระบบสร้าง Customer อัตโนมัติหรือไม่?

ไม่สร้างอัตโนมัติ การสร้าง Lead เพียงอย่างเดียวไม่เพียงพอที่จะยืนยัน Customer identity

### Convert Lead ต้องทำอย่างไร?

ผู้ใช้ต้องเลือกอย่างใดอย่างหนึ่ง:

- ผูก Lead กับ Customer เดิมที่ตรวจสอบแล้ว หรือ
- สร้าง Customer ใหม่หลังผ่าน duplicate review

ระบบต้องเก็บความเชื่อมโยงระหว่าง Lead, Customer และ Opportunity เพื่อ audit และป้องกันการ convert ซ้ำ

## Opportunity และโครงการหลาย Customer

### Opportunity หนึ่งรายการมี Customer ได้กี่ราย?

มี Contracting Customer หรือผู้ตัดสินใจซื้อหลักได้หนึ่งราย เพื่อให้ ownership, forecast, Quote และ Approval ชัดเจน

### ถ้าโครงการให้บริการหลายบริษัทหรือหลายสาขาทำอย่างไร?

- Customer อื่นที่ได้รับบริการให้เชื่อมเป็น **Beneficiary Customer**
- สถานที่ติดตั้งหรือให้บริการให้บันทึกเป็น **Service Site**
- หากมีคู่สัญญาหลาย Customer ให้แยกหลาย Opportunities แล้วรวมด้วย **Pursuit Group**

### ทำไมไม่ให้ Opportunity เดียวมี Customer เจ้าของหลายราย?

เพราะจะทำให้ sales ownership, forecast attribution, Quote, Approval และ Internal Order กำกวม และอาจนับ pipeline ซ้ำ

### เปลี่ยน Contracting Customer หลังสร้าง Opportunity ได้หรือไม่?

ต้องใช้ governed correction พร้อมตรวจผลกระทบต่อ Quote Versions, Approvals, forecast และ audit ห้ามแก้โดยไม่ตรวจ downstream records

## Quote และ Quote Version

### สร้าง Quote โดยไม่สร้าง Opportunity ได้หรือไม่?

ไม่ได้ Quote ทุกใบต้องอยู่ภายใต้ Opportunity เดียว และสืบทอด Contracting Customer จาก Opportunity

### งานเร่งด่วนที่ต้องออก Quote ทันทีทำอย่างไร?

ให้สร้าง **Quick Capture Opportunity** ด้วยข้อมูลขั้นต่ำที่บังคับก่อน แล้วจึงสร้าง Quote วิธีนี้รักษา pipeline, ownership, forecast และ audit chain

### เลือก Customer ของ Quote แยกจาก Opportunity ได้หรือไม่?

ไม่ได้ Customer ของ Quote ต้องสืบทอดจาก Opportunity เพื่อป้องกันการอ้างคนละ Customer

### Quote ต่างจาก Quote Version อย่างไร?

Quote คือ identity และ commercial thread ของข้อเสนอหนึ่งชุด ส่วน Quote Version คือ snapshot ของสินค้า ราคา discount margin เงื่อนไข และ validity ณ เวลาหนึ่ง

### แก้ Quote Version ที่ submit แล้วได้หรือไม่?

ไม่ได้ Version ที่ submit แล้วเป็น immutable evidence หากต้องเปลี่ยนข้อมูล commercial ให้สร้าง Quote Version ใหม่

### Approval เดิมใช้กับ Quote Version ใหม่ได้หรือไม่?

ใช้ได้เฉพาะเมื่อ policy ระบุว่าการเปลี่ยนแปลงไม่มีผลต่อ approval inputs หากราคา discount margin เงื่อนไข coverage/cost หรือข้อมูลที่มีผลต่อ policy เปลี่ยน Approval เดิมต้องเป็น **Superseded** และประเมิน route ใหม่

### Internal Order อ้าง Quote หรือ Quote Version?

ต้องอ้าง accepted/approved Quote Version ที่แน่นอน เพื่อให้ทราบว่าคำสั่งส่งมอบอิงสินค้า ราคา และเงื่อนไขชุดใด

## Coverage, Solution และ Commercial Approval

### Opportunity Estimated Value กับ Forecast Amount ต่างกันอย่างไร?

Opportunity Estimated Value คือมูลค่าที่ทีมขายประเมินก่อนมีข้อเสนอที่ submit แล้ว ส่วน Forecast Amount คือมูลค่าที่ใช้ใน forecast โดยมีลำดับ source ดังนี้:

- ก่อนมี Quote ที่ submit: Opportunity Estimated Value
- มี Quote ที่ submit: latest submitted version ของ Primary Quote
- มี Quote ที่ approved/accepted: approved/accepted version ตามลำดับ

Snapshot เก็บทั้งสองค่าและ source/version เพื่ออธิบายย้อนหลังได้

### ถ้ามีหลาย Quotes ใน Opportunity จะนำมารวมกันหรือไม่?

ไม่รวม เพราะ Quotes อาจเป็นทางเลือก KAM ต้องเลือก Primary Quote เพียงหนึ่งรายการสำหรับ Forecast Amount การเปลี่ยน Primary Quote ต้องถูก audit และมีผลต่อ snapshot ถัดไป ไม่แก้ snapshot เดิม

### เมื่อใดจึงส่ง Quote เพื่ออนุมัติได้?

Opportunity ต้องผ่าน required stage gates และมี Coverage/Solution/cost evidence ตาม product/site policy ข้อมูลที่ยังไม่ยืนยันต้องถูก block หรือเข้า exception route ที่ได้รับอนุมัติ ห้ามแสดงเป็น standard approval

### Approval แบ่งระดับอย่างไร?

- T1: Quote ไม่เกิน 10M THB — Team Manager และ independent maker-checker
- T2: มากกว่า 10M ถึง 100M THB — Sales Director และ Pricing Approver
- T3: มากกว่า 100M THB — Commercial Committee หรือ authorized executives

### กรณีใดต้อง escalate เพิ่ม?

Discount มากกว่า 10%, gross margin ต่ำกว่า 15%, non-standard legal terms, unconfirmed coverage/cost, conflict of interest หรือ policy override ต้อง escalate อย่างน้อยหนึ่งระดับและห้ามลดระดับอนุมัติ

### ผู้สร้าง Quote อนุมัติ Quote ของตนเองได้หรือไม่?

ไม่ได้เมื่อ maker-checker บังคับ ผู้สร้างหรือผู้แก้ Quote ห้าม approve mandatory step ของตนเอง Admin ก็ไม่มี commercial approval โดยอัตโนมัติ

### ถ้าไม่มี approver ที่มีอำนาจทำอย่างไร?

ระบบต้อง escalate และแจ้ง owner ห้าม auto-approve Delegation ต้องมี scope, amount และ effective period และห้ามเกิน authority ของ delegator

## Order Handoff และระบบภายนอก

### NTOP เชื่อม OM, CRM, Billing หรือ Coverage/GIS แบบ live แล้วหรือยัง?

ยังไม่เชื่อม live ใน year-one baseline ระบบใช้ adapter-ready architecture และ manual handoff ที่ควบคุมได้ ห้ามแสดงสถานะว่า synchronized หรือ integrated หากไม่มีการเชื่อมจริง

### Manual handoff ต้องมีอะไร?

ต้องมี versioned package, checksum, scoped fields, maker-checker, external reference, acknowledgement และ reconciliation เพื่อป้องกันส่งซ้ำหรือข้อมูลไม่ตรงกัน

### ถ้ากดยืนยัน handoff ซ้ำจะเกิด Order ซ้ำหรือไม่?

ไม่ควรเกิด ระบบต้องใช้ idempotency key และ external reference เพื่อตรวจ duplicate หาก payload ขัดกันต้อง reject และ audit

## สิทธิ์และ Audit

### การเห็นข้อมูลขึ้นกับ Role อย่างเดียวหรือไม่?

ไม่ใช่ สิทธิ์พิจารณาจาก role, organization scope, ownership, workflow assignment และ data classification ร่วมกัน ระบบใช้ deny-by-default

### ทำไมบางรายการจึงแสดงเหมือนไม่พบข้อมูล?

เพื่อไม่เปิดเผยว่ามี record อยู่นอก scope ของผู้ใช้ การเปิด URL หรือเดา ID ของข้อมูลข้ามหน่วยงานต้องไม่เปิดเผย existence

### การกระทำใดถูก audit?

อย่างน้อย login/admin grants, ownership/merge, sensitive export/document access, workflow transitions, Quote submission/version, Approval/delegation/override, retention/legal hold และ Order handoff/replay

### Audit เก็บ password หรือ token หรือไม่?

ไม่เก็บ Password, token, secret, MFA seed และ document body ต้องไม่ปรากฏใน audit หรือ operational logs

## Data Retention

### ระบบเก็บข้อมูลนานเท่าใด?

- Commercial records, Quote, Approval, Order และ commercial audit: 7 ปี
- Sales Activity และ Meeting records: 3 ปี
- Security/session/technical access logs: 1 ปี

Legal hold มีสิทธิ์ระงับการลบ ขณะที่ credentials/secrets ใช้ lifecycle การ revoke/rotate ไม่ใช้ระยะเก็บแบบ business records

### ผู้ใช้ลบข้อมูลโดยตรงได้หรือไม่?

ไม่ได้ การลบหรือ anonymize ต้องผ่าน governed workflow, permission, dry-run/dependency check และ audit ห้ามใช้ direct SQL เป็นกระบวนการธุรกิจ

## Performance และ Availability

### ระบบออกแบบรองรับข้อมูลเท่าใด?

Baseline ต้องทดสอบอย่างน้อย 2.5M synthetic Customer records และรองรับ 100 concurrent users พร้อม capacity headroom 30%

### เป้าหมายความพร้อมใช้งานและการกู้คืนคืออะไร?

Availability 99.9% ต่อเดือนโดยไม่รวม approved maintenance, RPO ไม่เกิน 15 นาที และ RTO ไม่เกิน 4 ชั่วโมง พร้อม quarterly restore exercise และ failover/DR rehearsal ก่อน production

### ถ้า Search หรือระบบภายนอกล่มยังทำงานได้หรือไม่?

Exact governed lookup ควรยังทำงานได้เมื่อ full-text search degraded งานภายนอกใช้ manual handoff และ queued work ต้อง recover/replay แบบไม่สร้างผลซ้ำ ระบบต้องแสดง degraded/delayed status ตามจริง

## AI Assistance

### AI สามารถเปลี่ยนข้อมูลหรือสถานะงานเองได้หรือไม่?

ไม่ได้ หลักการของ NTOP คือ **AI proposes, human decides** AI แนะนำ วิเคราะห์ สรุป หรือสร้าง Draft ได้ แต่ผู้ใช้ที่มีสิทธิ์ต้องตรวจและยืนยันก่อนข้อมูลจะเป็นทางการ

### AI ช่วยทำอะไรได้บ้าง?

- ก่อนเข้าพบ: Customer research, product recommendation, Opportunity Finder และ Territory Planning
- หลังประชุม: Visit Report, MOM, Activity, Opportunity Draft และ Next Action
- Proposal/TOR: วิเคราะห์ สรุป หรือตรวจเอกสารที่ผู้ใช้ upload ตามสิทธิ์ และให้ Pricing Recommendation; NTOP ไม่สร้างหรือแก้เอกสารยาว
- Forecast/Pipeline: probability recommendation, deal risk, revenue forecast, aging และ bottleneck analysis
- Order/Provisioning: document/order validation และ delay-risk explanation
- Customer Success/Renewal: usage/ticket/churn signals, renewal reminder และ package recommendation

แต่ละ capability ต้องผ่าน data-access, source, confidence, human-confirmation และ audit controls ก่อนใช้งานจริง

### AI capabilities จะเปิดพร้อมกันทั้งหมดหรือไม่?

ไม่เปิดพร้อมกัน:

- **Release 1:** Meeting/Visit Summary Draft, Next Action, Grounded Customer Research และ rule-based Deal/Pipeline Risk explanation
- **Release 2:** Opportunity Finder/Territory Planning, Opportunity Draft, read-only Document/TOR Analysis และ Pricing Recommendation
- **Release 3:** calibrated Forecast probability, Revenue Forecast และ Provisioning/Customer Success/Renewal prediction

Capability จะเปิดได้เมื่อผ่าน data allowlist, security, evaluation, human-confirmation, provenance, monitoring และ rollback gate ของตนเอง ไม่ใช่เพียงเพราะ AI endpoint พร้อม

### AI สร้าง Proposal 40 หน้าใน NTOP ได้หรือไม่?

ไม่ได้ NTOP ไม่ใช่ document authoring system ผู้ใช้จัดทำ Proposal, TOR response และเอกสารยาวด้วยเครื่องมือภายนอก แล้ว upload กลับเข้า NTOP เพื่อเก็บ version, metadata, access control, relation และ audit

### เอกสาร Proposal/TOR ที่ upload ต้องเก็บอะไรบ้าง?

อย่างน้อย file version, document type, owner, Customer/Opportunity/Quote relation, classification, upload timestamp, malware-scan status และ access/download audit เอกสาร final ต้องไม่ถูก AI แก้ไขในระบบ

### AI อ่านและวิเคราะห์ Proposal/TOR ที่ upload ได้หรือไม่?

ได้แบบ read-only เมื่อเอกสารผ่าน malware scan, classification และผู้ใช้มีสิทธิ์ AI สามารถสรุป ตรวจ completeness เปรียบเทียบกับ Quote/Coverage/Solution และสร้าง compliance matrix โดย cite page/section

### AI แก้ไฟล์ Proposal/TOR ต้นฉบับได้หรือไม่?

ไม่ได้ Document Analysis และ Compliance Findings เก็บแยกจากไฟล์ต้นฉบับ AI ห้ามแก้ document version หรือถือผลวิเคราะห์เป็น legal/commercial approval ผู้ใช้ต้องตรวจและยืนยันก่อนนำ finding ไปใช้

### AI ทำอะไรเองไม่ได้?

AI ห้ามเปลี่ยน Opportunity stage, submit Quote, approve/override pricing, create Internal Order, merge Customer, ส่งข้อมูลออกนอกระบบ หรือ bypass deterministic validation/policy

### AI Generate Opportunity สร้าง Opportunity จริงทันทีหรือไม่?

ไม่สร้างทันที AI สร้าง **AI Draft** พร้อมค่าที่แนะนำ เช่น stage, revenue, probability และ close date ผู้ใช้ต้องตรวจ Customer identity, ownership และ required fields แล้วกดยืนยัน

### AI Pricing Recommendation เป็นราคาที่อนุมัติแล้วหรือไม่?

ไม่ใช่ เป็นคำแนะนำพร้อมเหตุผล/confidence เท่านั้น Quote ยังต้องผ่าน approval policy และ maker-checker ตามปกติ

### ตรวจสอบได้หรือไม่ว่า AI ใช้ข้อมูลและ model ใด?

ได้ AI output ต้องมี **AI Provenance** เช่น model/version, prompt/template version, input sources, timestamp และ confidence พร้อมผู้ยืนยันเมื่อ Draft ถูกนำไปใช้ ห้ามเก็บ API key, token หรือ secret ใน provenance, prompt log หรือ audit

### ตั้งค่า AI provider อย่างไร?

ผู้ดูแลระบบกำหนดผ่าน `OPENAI_API_URL`, `OPENAI_API_KEY` และ `OPENAI_MODEL` โดย key ต้องอยู่ใน secret manager หรือ environment ที่ไม่ commit ลง source control หาก AI provider ใช้งานไม่ได้ core workflow ต้องยังทำงานได้โดยไม่บังคับใช้ AI

### ระบบส่งข้อมูลอะไรให้ AI ได้บ้าง?

ส่งได้เฉพาะข้อมูลขั้นต่ำที่ผู้ใช้มีสิทธิ์และ capability ได้รับอนุมัติ Public/Internal data ใช้ได้ตามงาน ส่วน Customer Confidential และ Commercial Sensitive ใช้เฉพาะ use case ที่อนุมัติและต้อง mask เมื่อไม่จำเป็นต้องใช้ค่าจริง

### ข้อมูลอะไรห้ามส่งให้ AI?

Password, API key, token, MFA secret, private key และ credentials ทุกชนิดห้ามส่งโดยไม่มีข้อยกเว้น แม้ AI endpoint จะอยู่ใน private network

### AI อ่านเอกสารที่ผู้ใช้ไม่มีสิทธิ์ได้หรือไม่?

ไม่ได้ Document/RAG retrieval ต้องใช้ ACL เดียวกับผู้ใช้ หากผู้ใช้เปิด source document ไม่ได้ AI ก็ห้ามใช้เอกสารนั้นเป็น context หรือเปิดเผยเนื้อหาผ่านคำตอบ

### ข้อมูล NT ถูกนำไป train model หรือไม่?

ห้ามนำไป train model เว้นแต่มี contract, data owner, Security และ Data Governance approval ชัดเจน การเก็บ prompt/output ต้องเป็นไปตาม data classification และ retention policy

### ถ้า AI พบข้อมูลจากหลายแหล่งไม่ตรงกันจะทำอย่างไร?

AI ต้องแสดง **Conflicting Evidence** โดยระบุแต่ละค่า source และวันที่ ห้ามเลือกค่าเดียวแบบเงียบ ๆ ลำดับ Source Authority คือ approved NT master/contract, approved internal document, authoritative external source และ general web ความใหม่อย่างเดียวไม่สามารถ override source ที่มี authority สูงกว่า

### AI แก้ Customer master จากข้อมูลอินเทอร์เน็ตได้หรือไม่?

ไม่ได้ AI ทำได้เพียงเสนอ conflict/correction ให้ Data Steward ตรวจและยืนยัน การเปลี่ยน master data ต้องผ่าน governed workflow และ audit

### ถ้า AI หาแหล่งข้อมูลที่เชื่อถือไม่ได้จะตอบอย่างไร?

ต้องตอบว่า “ข้อมูลไม่เพียงพอ” พร้อมระบุสิ่งที่ขาด แทนการเดาหรือสร้าง fact ที่ไม่มี source Recommendation ต้องแยกจาก fact และระบุ inference/confidence

### ทำไม AI Forecast อาจแสดง Low/Medium/High แทนตัวเลขเปอร์เซ็นต์?

ตัวเลขเช่น 84% ดูแม่นยำและอาจทำให้เข้าใจผิด จึงแสดงเป็น AI Confidence Band จนกว่า capability จะผ่าน backtesting และ calibration ด้วยข้อมูลที่เป็นตัวแทนของ NT Numeric probability เปิดได้เมื่อมี calibration report และ evaluation version ที่อนุมัติแล้ว

### AI เปลี่ยน Opportunity Probability ทางการได้หรือไม่?

ไม่ได้ AI probability เป็น recommendation แยกต่างหาก Probability ทางการต้องได้รับการยืนยันจาก KAM/Manager พร้อม audit

### “ไม่มี Follow-up 21 วัน” เป็น AI prediction หรือไม่?

ไม่ใช่ เป็น Rule-based Signal ที่คำนวณจากกติกา deterministic ระบบต้อง label ให้ชัดและไม่อ้างว่าเป็น model prediction AI อาจช่วยอธิบายผลกระทบหรือแนะนำ Next Action ได้

## Pilot และการขอความช่วยเหลือ

### Pilot เริ่มอย่างไร?

เริ่มหนึ่ง representative enterprise-sales division, 75 named users, pilot 4 สัปดาห์และ hypercare 2 สัปดาห์ โดยใช้ controlled production-shaped data หลังผ่าน data/security readiness

### เมื่อใดต้อง rollback Pilot?

เมื่อเกิด unauthorized access, data corruption, approval bypass, sustained critical outage หรือ workflow completion ต่ำกว่า 60% การ rollback ต้องหยุด mutation ที่เสี่ยงและรักษา evidence ไม่ใช่ลบข้อมูลย้อนหลัง

### หาก FAQ ไม่ครอบคลุมควรทำอย่างไร?

แจ้ง Product Owner พร้อม scenario, role, record type และผลลัพธ์ที่คาดหวัง คำตอบใหม่ที่เป็น domain rule ต้องอัปเดต [CONTEXT.md](CONTEXT.md), workflow/ADR ที่เกี่ยวข้อง และ FAQ นี้ให้สอดคล้องกัน
