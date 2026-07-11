# NTOP Enterprise Sales

ภาษากลางของ NTOP สำหรับวงจรงานขายลูกค้าองค์กร ตั้งแต่การหาผู้มุ่งหวังจนถึงการส่งมอบคำสั่งภายใน

## Language

**Customer**:
นิติบุคคล หน่วยงาน หรือองค์กรที่ NT ขายหรือให้บริการ โดยมี identity ที่คงอยู่แยกจากความสัมพันธ์ของทีมขายและ external-system identifiers
_Avoid_: Account, Client, Buyer, บัญชี

**Customer Account**:
ความสัมพันธ์เชิงพาณิชย์และขอบเขตการดูแล Customer ของทีมขาย รวม ownership, segmentation และ sales history
_Avoid_: Account, Customer, User Account

**User Account**:
ตัวตนสำหรับบุคคลที่เข้าใช้งาน NTOP พร้อม credentials, roles และ organizational scopes
_Avoid_: Account, Customer Account

**Lead**:
ผู้มุ่งหวังที่ Customer identity ยังไม่ยืนยัน ระหว่างตรวจสอบอาจผูกกับ Customer candidate หรือ Customer เดิมแบบ optional
_Avoid_: Customer, Prospect Customer, Opportunity

**Lead Conversion**:
การยืนยัน Customer identity ของ Lead โดยต้องผูกกับ Customer เดิม หรือสร้าง Customer ใหม่หลัง duplicate review พร้อมเก็บความเชื่อมโยงสำหรับ audit
_Avoid_: Customer creation, Auto-convert

**Opportunity**:
ความพยายามขายเพื่อผลลัพธ์เชิงพาณิชย์หนึ่งเรื่อง โดยมี Customer ที่เป็นคู่สัญญาหรือผู้ตัดสินใจซื้อหลักเพียงหนึ่งราย
_Avoid_: Project, Deal Group, Multi-customer Opportunity

**Beneficiary Customer**:
Customer อื่นที่ได้รับประโยชน์หรือบริการจาก Opportunity แต่ไม่ใช่คู่สัญญาหรือเจ้าของ Opportunity
_Avoid_: Opportunity Owner, Contracting Customer

**Service Site**:
สถานที่ติดตั้งหรือให้บริการภายใต้ Opportunity ซึ่งอาจเป็นของ Contracting Customer หรือ Beneficiary Customer
_Avoid_: Customer, Branch Customer

**Pursuit Group**:
กลุ่มของ Opportunities ที่เกี่ยวข้องกับการจัดซื้อหรือโครงการเดียวกันแต่มีคู่สัญญาหลาย Customer
_Avoid_: Opportunity, Parent Opportunity

**Quote**:
ข้อเสนอเชิงพาณิชย์ที่อยู่ภายใต้ Opportunity เดียวและสืบทอด Contracting Customer จาก Opportunity เสมอ
_Avoid_: Standalone Quote, Customer-level Quote

**Quick Capture Opportunity**:
Opportunity ที่สร้างด้วยข้อมูลขั้นต่ำที่บังคับ เพื่อรองรับงานเร่งด่วนก่อนสร้าง Quote โดยยังคง pipeline, ownership และ audit chain
_Avoid_: Draft Quote without Opportunity, Standalone Quote

**Quote Version**:
Snapshot ที่แก้ไขไม่ได้ของสินค้า ราคา discount margin เงื่อนไข และ validity ภายใต้ Quote หนึ่งชุด โดย Approval ต้องอ้าง Quote Version ที่แน่นอน
_Avoid_: Editable submitted Quote, Quote revision without version

**Superseded Approval**:
ผลอนุมัติที่เคยถูกต้องสำหรับ Quote Version เดิม แต่ไม่สามารถใช้กับ Quote Version ใหม่ที่เปลี่ยนข้อมูลซึ่งมีผลต่อ approval policy
_Avoid_: Rejected Approval, Cancelled Approval

**Opportunity Estimated Value**:
มูลค่าที่ทีมขายประเมินสำหรับ Opportunity ก่อนมีข้อเสนอเชิงพาณิชย์ที่ submit แล้ว
_Avoid_: Forecast Amount, Quote Total

**Forecast Amount**:
มูลค่าที่ใช้คำนวณ forecast โดยมาจาก Opportunity Estimated Value ก่อนมี Quote ที่ submit แล้ว และเปลี่ยนไปใช้ยอดของ Primary Quote Version ที่ submit, approved หรือ accepted ตามลำดับ
_Avoid_: Opportunity Estimated Value, Pipeline Total

**Primary Quote**:
Quote ที่ KAM ระบุเป็นข้อเสนอหลักสำหรับ Opportunity เพื่อเป็น source ของ Forecast Amount เมื่อมีหลายข้อเสนอทางเลือก
_Avoid_: Latest Quote, Sum of Quotes

## AI Assistance

**AI Suggestion**:
คำแนะนำ การวิเคราะห์ หรือ risk signal ที่ AI สร้างพร้อม source, confidence และ provenance โดยไม่เปลี่ยน business record หรือ workflow state
_Avoid_: AI Decision, Automatic Action

**AI Draft**:
เนื้อหาหรือ business record ที่ AI ร่างให้ผู้ใช้ตรวจแก้และยืนยันก่อนจึงจะกลายเป็นข้อมูลทางการ
_Avoid_: Final Record, Auto-created Record

**Human Confirmation**:
การที่ผู้ใช้ซึ่งมีสิทธิ์ตรวจและยอมรับ AI Draft หรือ AI Suggestion เพื่อสร้างหรือเปลี่ยน business record โดยบันทึกผู้ยืนยันและเวลาสำหรับ audit
_Avoid_: AI Approval, Silent Acceptance

**AI Provenance**:
หลักฐานว่า AI output ถูกสร้างจาก model/version, prompt/template version, input sources, timestamp และ confidence ใด โดยไม่เก็บ secret หรือข้อมูลที่เกินความจำเป็น
_Avoid_: Raw Prompt Log, Secret-bearing Trace

**AI Input Scope**:
ชุดข้อมูลขั้นต่ำที่ผู้ใช้มีสิทธิ์และ capability ได้รับอนุญาตให้ส่งให้ AI ตาม data classification โดย credentials และ secrets อยู่นอก scope เสมอ
_Avoid_: Full Customer Dump, Unfiltered Context

**Grounded AI Output**:
AI output ที่อ้างอิง sources ซึ่งผู้ใช้มีสิทธิ์เข้าถึงและแยก facts, inference และ recommendation อย่างชัดเจน
_Avoid_: Unsupported Answer, Uncited Research

**Conflicting Evidence**:
สถานะที่ sources ที่มีสิทธิ์และเกี่ยวข้องให้ข้อมูล fact ไม่ตรงกัน โดย AI ต้องแสดงแต่ละค่า source และวันที่แทนการเลือกค่าเดียวอย่างเงียบ ๆ
_Avoid_: AI-resolved Fact, Latest Value without Authority

**Source Authority**:
ลำดับความน่าเชื่อถือสำหรับ fact: approved NT master/contract, approved internal document, authoritative external source และ general web ตามลำดับ โดยความใหม่ไม่สามารถ override authority โดยอัตโนมัติ
_Avoid_: Search Rank, Most Recent Source

**AI Confidence Band**:
ระดับ Low, Medium หรือ High ที่สะท้อนคุณภาพหลักฐานและผล evaluation ของ capability โดยไม่อ้างเป็น probability เชิงตัวเลขก่อนผ่าน calibration
_Avoid_: Uncalibrated Probability, Model Certainty

**Calibrated AI Prediction**:
ผลทำนายเชิงตัวเลขที่ผ่าน backtesting และ calibration ด้วยข้อมูลที่เป็นตัวแทนของ NT พร้อม evaluation version และช่วงเวลาที่ใช้ได้
_Avoid_: Raw Model Score, Prompted Percentage

**Rule-based Signal**:
ข้อสังเกตที่คำนวณจากกติกา deterministic เช่นไม่มี follow-up 21 วัน ซึ่งต้องแยกจาก AI prediction
_Avoid_: AI Prediction, Model Risk Score

**External Sales Document**:
Proposal, TOR response หรือเอกสารยาวที่ผู้ใช้จัดทำด้วยเครื่องมือภายนอก แล้ว upload เข้า NTOP เพื่อเก็บ version, metadata, access, relation และ audit
_Avoid_: In-system Proposal, AI-authored Final Document

**Document Analysis**:
ผล read-only ที่ AI สรุป ตรวจ หรือเปรียบเทียบ External Sales Document โดยอ้าง page/section และไม่แก้ไฟล์ต้นฉบับ
_Avoid_: Document Edit, Final Approval

**Compliance Finding**:
รายการเชื่อม requirement ใน TOR/Proposal กับ NT capability, evidence และ gap พร้อม source location เพื่อให้ผู้ใช้ตรวจยืนยัน
_Avoid_: Automatic Compliance, Legal Approval
