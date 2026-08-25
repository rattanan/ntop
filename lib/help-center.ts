export type HelpAudience = "SALES" | "PRESALES" | "APPROVER" | "ADMIN" | "ALL";
export type HelpArticle = { slug: string; title: string; summary: string; audience: HelpAudience[]; category: string; tags: string[]; updatedAt: string; readingMinutes: number; sections: Array<{ title: string; body: string[] }>; faqs: Array<{ question: string; answer: string }>; relatedSlugs?: string[] };

export const helpAudienceLabels: Record<HelpAudience, string> = { ALL: "ทุกบทบาท", SALES: "ทีมขาย", PRESALES: "Presales / Coverage", APPROVER: "ผู้อนุมัติ", ADMIN: "ผู้ดูแลระบบ" };
const UPDATED_AT = "2026-08-24";

export const helpArticles: HelpArticle[] = [
  {
    slug: "ai-page-assistant", title: "ใช้ AI Assistant ช่วยอ่านและสรุปหน้าปัจจุบัน", summary: "วิธีใช้บอลลูน AI เพื่อสรุปข้อมูลที่มองเห็น ถามข้อมูลในหน้า และค้นคำแนะนำจาก Help Center อย่างปลอดภัย", audience: ["ALL"], category: "AI Assistance", tags: ["AI Assistant", "สรุปข้อมูล", "Help Center", "Read Only", "Visible Context"], updatedAt: UPDATED_AT, readingMinutes: 5,
    sections: [
      { title: "เริ่มต้นสนทนา", body: ["กดบอลลูน AI มุมขวาล่าง แล้วเลือกคำถามแนะนำหรือพิมพ์คำถามเกี่ยวกับหน้าปัจจุบัน กด Enter เพื่อส่งและ Shift+Enter เพื่อขึ้นบรรทัดใหม่", "Assistant อ่านเฉพาะข้อความใน #main-content ที่ผู้ใช้มองเห็นภายใต้ session และ authorization เดิม ไม่ค้น business table หรือเปิด URL เพิ่ม"] },
      { title: "ตรวจคำตอบและแหล่งอ้างอิง", body: ["หากหลักฐานไม่พอ Assistant ต้องบอกว่าไม่พบข้อมูลแทนการเดา สำหรับคำถามวิธีใช้ ระบบเลือกบทความ Help ที่เกี่ยวข้องสูงสุดสามรายการและแสดงลิงก์อ่านเพิ่มเติม", "ตรวจคำตอบกับ record ต้นทางเสมอ โดยเฉพาะราคา Margin, Approval และ workflow state เพราะคำตอบ AI ไม่ใช่ decision evidence"] },
      { title: "ขอบเขต Read-only และข้อมูลลับ", body: ["Assistant ไม่มี business mutation จึงสร้าง แก้ไข อนุมัติ หรือเปลี่ยนสถานะไม่ได้ การดำเนินงานจริงต้องใช้ command ของ module ตาม permission", "ห้ามพิมพ์ password, API key, token หรือ credential หากตรวจพบ secret-like input ระบบจะปฏิเสธก่อนเรียก provider และไม่เก็บคำถาม เนื้อหาหน้า หรือคำตอบดิบใน audit"] },
      { title: "เมื่อ Assistant ไม่พร้อม", body: ["หาก session หมดอายุให้ login ใหม่ หาก provider หรือ feature flag ไม่พร้อม ระบบแจ้ง sanitized error โดยไม่เปิดเผย secret", "AI outage ไม่ block งานหลัก ผู้ใช้ยังเปิด Help Center และทำ workflow แบบ manual ได้ กด Escape เพื่อปิดและคืน focus ไปที่บอลลูน"] },
    ],
    faqs: [{ question: "AI เห็นข้อมูลทั้งระบบหรือไม่", answer: "ไม่เห็น รับเฉพาะข้อความที่แสดงในหน้าปัจจุบันแบบจำกัดขนาดภายใต้ authorization ของหน้านั้น" }, { question: "สั่ง AI ให้อนุมัติหรือแก้สถานะได้ไหม", answer: "ไม่ได้ Assistant เป็น read-only และไม่มี business mutation endpoint" }],
    relatedSlugs: ["ai-assistance-and-safety", "notifications-and-tasks", "workflow-administration"],
  },
  {
    slug: "prospect-to-lead", title: "จัดการ Prospect ตั้งแต่รับข้อมูลจนสร้าง Lead", summary: "ค้นหา สร้าง มอบหมาย ติดตาม อัปโหลดเอกสาร ใช้ AI Insight และเปลี่ยน Prospect ที่ผ่านการคัดกรองเป็น Lead", audience: ["SALES", "ADMIN"], category: "Prospect & Lead", tags: ["Prospect", "Duplicate", "Contact", "Import", "AI Insight", "Convert"], updatedAt: UPDATED_AT, readingMinutes: 9,
    sections: [
      { title: "ค้นหาก่อนสร้าง", body: ["เปิด งานขาย > Prospect เพื่อค้นหาและกรองตามสถานะ แหล่งที่มา Owner หรือ Overdue หน้า Dashboard แสดง Conversion และ Hot Prospect ภายใน scope", "ตรวจรายการซ้ำจากชื่อไทย/อังกฤษ เลขผู้เสียภาษี เว็บไซต์ อีเมล และโทรศัพท์ก่อนสร้าง"] },
      { title: "Contact, Activity และเอกสาร", body: ["หน้ารายละเอียดจัดการ Contact และ Primary Contact ได้ ใช้ Timeline บันทึก Call, Email, Meeting หรือ Follow-up เพื่ออัปเดต Last Contact/Next Follow-up", "Import รองรับ CSV/XLSX แบบ Preview เอกสารอยู่ private storage; S3 ต้องผ่าน malware scan ส่วน local development ไม่มีการสแกนและไม่ใช่ production certification"] },
      { title: "Assignment และสถานะ", body: ["ผู้มีสิทธิ์เลือก Owner ในหน่วยงานได้ เดิน NEW, ASSIGNED, CONTACTED, INTERESTED, QUALIFYING ไป QUALIFIED ตาม workflow", "CONVERTED เปลี่ยนจาก conversion command เท่านั้น หาก version stale ให้รีเฟรชก่อนทำใหม่"] },
      { title: "AI Insight และสร้าง Lead", body: ["Request AI Insight ใช้เฉพาะ Prospect, Contact, Activity และเอกสารที่ได้รับอนุญาตแบบจำกัดจำนวน Draft ไม่แก้ข้อมูลจนกดยืนยัน", "เมื่อ QUALIFIED ให้ตรวจ transfer summary และ Qualification Note แล้วสร้าง Lead ระบบเชื่อม Contact, Activity และ document metadata โดยไม่คัดลอกไฟล์และไม่สร้างซ้ำ"] },
    ],
    faqs: [{ question: "ทำไมไม่เห็นปุ่มสร้าง Lead", answer: "ต้องเป็น QUALIFIED และบัญชีมี permission/scope ที่ถูกต้อง ทุกคำสั่งตรวจฝั่ง server" }, { question: "AI Insight แก้ข้อมูลอัตโนมัติไหม", answer: "ไม่แก้จนผู้ใช้ตรวจและกดยืนยันใช้ AI Insight" }],
    relatedSlugs: ["lead-qualification-and-conversion", "notifications-and-tasks", "ai-assistance-and-safety"],
  },
  {
    slug: "lead-qualification-and-conversion", title: "คัดกรอง Lead และ Convert เป็น Customer กับ Opportunity", summary: "จัดการ Assignment, SLA, Qualification, Duplicate Review และ Conversion โดยรักษาประวัติการทำงาน", audience: ["SALES", "ADMIN"], category: "Prospect & Lead", tags: ["Lead", "Qualification", "Round Robin", "SLA", "Customer", "Opportunity"], updatedAt: UPDATED_AT, readingMinutes: 8,
    sections: [
      { title: "Lead และรายการงาน", body: ["Lead คือผู้มุ่งหวังที่ Customer identity ยังไม่ยืนยัน อาจมาจาก Prospect, Campaign, Import หรือการสร้างโดยตรง", "รายการรองรับ search, filters, Overdue, Saved View, Import Preview และ permission-aware Export"] },
      { title: "Assignment และ SLA", body: ["Lead ใหม่อาจใช้ Owner หรือ Round Robin rule ผู้จัดการ Reassign ได้เฉพาะผู้ใช้ active ใน scope และมี Assignment History", "บันทึก Activity เพื่ออัปเดต Last Contact, Next Follow-up และ First-contact SLA โดยเวลาแสดงตาม Asia/Bangkok"] },
      { title: "Qualification และสถานะปิด", body: ["Qualification ใช้ completeness และคะแนนกติกาที่อธิบายได้ Manager Override ต้องมีเหตุผลและ Audit", "INVALID, DUPLICATE, NOT_INTERESTED หรือ NO_BUDGET ควรใช้ตามเหตุการณ์ ส่วน CONVERTED สงวนให้ Convert command"] },
      { title: "Convert", body: ["เลือก Customer เดิมใน scope หรือสร้างใหม่หลัง Duplicate Review หาก override รายการซ้ำต้องระบุเหตุผล", "Customer, Contact, Opportunity, Lead, receipt และ audit อยู่ transaction เดียว และ idempotency ป้องกันผลซ้ำ"] },
    ],
    faqs: [{ question: "Prospect Convert กับ Lead Convert ต่างกันอย่างไร", answer: "Prospect Convert สร้าง Lead ส่วน Lead Convert ยืนยัน Customer identity และสร้าง Opportunity" }, { question: "ทำไมเลือก Customer บางรายไม่ได้", answer: "ระบบยอมรับเฉพาะ Customer ใน authorization scope แม้ผู้ใช้ทราบ ID" }],
    relatedSlugs: ["prospect-to-lead", "customer-to-opportunity", "notifications-and-tasks"],
  },
  {
    slug: "customer-to-opportunity", title: "ดูแล Customer 360 และเริ่ม Opportunity", summary: "สร้าง Customer อย่างไม่ซ้ำ ดู Contacts, Hierarchy, Governance และ Sales History ก่อนเปิดโอกาสขาย", audience: ["SALES", "ADMIN"], category: "Customer & Opportunity", tags: ["Customer 360", "Contact", "Hierarchy", "Duplicate", "Merge", "Opportunity"], updatedAt: UPDATED_AT, readingMinutes: 8,
    sections: [
      { title: "ค้นหาและสร้าง Customer", body: ["ค้นหาด้วยชื่อขึ้นต้น เลขนิติบุคคล หรือจังหวัดก่อนสร้าง รายการใช้ cursor และ scope ไม่โหลดทั้งหมด", "กรอก Type, Segment, Tax ID, ที่อยู่ จังหวัด และ Owner; external identifier ไม่แทน internal ID"] },
      { title: "แท็บ Customer 360", body: ["Overview แสดงข้อมูลหลัก, Contacts จัดการ Primary, Hierarchy & Duplicate แสดง governance และ Sales & Activity รวม record ที่เกี่ยวข้อง", "Contact mutation ตรวจ scope และ Customer version ฝั่ง serverพร้อม audit"] },
      { title: "Hierarchy และ Merge", body: ["Parent/Child ปฏิเสธ self-link และ cycle ส่วน Merge เปลี่ยน source เป็น alias พร้อม immutable history ไม่ใช่การลบ", "ตรวจ Tax ID, Contact, Owner, hierarchy และงานขายก่อน Merge เพราะ module อื่นไม่ถูกย้ายแบบเงียบ ๆ"] },
      { title: "สร้าง Opportunity", body: ["เลือก Customer ใน scope แล้วกรอก Flow, Estimated Value, Probability, Forecast Category, Expected Close และ Next Action", "Opportunity เริ่ม QUALIFY การเดินหน้า ส่งกลับ Lost/Won, Cancel, Expire หรือ Reopen ต้องใช้ Transition พร้อมเหตุผลและ gate"] },
    ],
    faqs: [{ question: "Merge แล้ว source หายไหม", answer: "ไม่หาย Source เป็น alias พร้อมประวัติ Merge" }, { question: "แก้ Stage จากหน้าแก้ไขได้ไหม", answer: "ไม่ได้ ต้องใช้ Transition เพื่อให้ตรวจ policy, required fields, version และ audit" }],
    relatedSlugs: ["lead-qualification-and-conversion", "opportunity-transition-policy", "sales-pipeline-and-forecast", "presales-solution-survey-boq"],
  },
  {
    slug: "opportunity-transition-policy", title: "Transition Policy ของ Opportunity: 5 ขั้นหลักและ 26 เส้นทาง", summary: "สรุปลำดับ Stage, เงื่อนไข Required Fields, สิทธิ์พิเศษ และกติกาฝั่ง server สำหรับการเดินหน้า ย้อนกลับ ปิด และเปิด Opportunity ใหม่", audience: ["SALES", "APPROVER", "ADMIN"], category: "Customer & Opportunity", tags: ["Transition Policy", "Opportunity Stage", "5 ขั้น", "26 เส้นทาง", "Required Fields", "WON", "LOST", "CANCELLED", "EXPIRED", "Reopen"], updatedAt: "2026-08-25", readingMinutes: 9,
    sections: [
      { title: "ภาพรวม: 5 ขั้นทำงานหลัก 4 สถานะปลายทาง", body: ["Opportunity เริ่มที่ QUALIFY และเดินตาม 5 ขั้นทำงานหลัก: 1) QUALIFY คัดกรองโอกาส 2) DISCOVER เก็บความต้องการ 3) SOLUTION ยืนยันแนวทางและความพร้อมทางเทคนิค 4) PROPOSAL เตรียมข้อเสนอและ Quote 5) NEGOTIATION เจรจาเงื่อนไข ก่อนปิดเป็น WON", "สถานะปลายทางมี 4 แบบ: WON ชนะงาน, LOST แพ้/ไม่เดินหน้าต่อ, CANCELLED ยกเลิกเพราะข้อมูลซ้ำ ไม่ถูกต้อง หรือสร้างผิด และ EXPIRED หมดอายุตามนโยบาย", "Active configuration บนฐานข้อมูล NTOP development ที่ตรวจเมื่อ 25 สิงหาคม 2026 มี 26 เส้นทาง: เดินหน้า 4, ปิดชนะ 1, ย้อนขั้น 4, ปิดแพ้ 5, ยกเลิก 5, หมดอายุ 5 และเปิดใหม่ 2 เส้นทาง ทั้งหมดเป็น configuration แบบ versioned จึงต้องยึด policy ที่ Active และอยู่ในช่วง Effective Date ณ เวลาทำรายการ"] },
      { title: "เงื่อนไขเดินหน้าแต่ละขั้น", body: ["1) QUALIFY → DISCOVER ใช้คำสั่ง FORWARD: ต้องมี Next Action เท่านั้น ส่วน Qualification Result เป็นข้อมูลเสริมและไม่ block Transition", "2) DISCOVER → SOLUTION ใช้คำสั่ง FORWARD: ต้องมี Requirements, Stakeholder Summary และ Expected Close Date", "3) SOLUTION → PROPOSAL ใช้คำสั่ง FORWARD: ต้องยืนยัน Coverage และ Solution Complete", "4) PROPOSAL → NEGOTIATION ใช้คำสั่ง FORWARD: ต้องมี Quote Submitted และ Quote Approved", "5) NEGOTIATION → WON ใช้คำสั่ง WON: ต้องมี Quote Approved, ลูกค้ายอมรับ Quote และเหตุผล พร้อมสิทธิ์เฉพาะ opportunity.transition.won; baseline ให้สิทธิ์นี้กับ Sales Director"] },
      { title: "เส้นทางย้อนขั้นและปิด Opportunity", body: ["RETURN มี 4 เส้นทางและต้องระบุเหตุผล: DISCOVER → QUALIFY, SOLUTION → DISCOVER, PROPOSAL → SOLUTION และ NEGOTIATION → PROPOSAL", "LOST มี 5 เส้นทางจาก QUALIFY, DISCOVER, SOLUTION, PROPOSAL หรือ NEGOTIATION ไป LOST โดยต้องมีเหตุผล, Lost Reason และ Lost Category", "CANCEL มี 5 เส้นทางจากทุกขั้นทำงานหลักไป CANCELLED โดยต้องมีเหตุผลและ Cancelled Reason ใช้เมื่อรายการซ้ำ ไม่ถูกต้อง หรือสร้างผิด ไม่ใช้แทน LOST", "EXPIRE มี 5 เส้นทางจากทุกขั้นทำงานหลักไป EXPIRED และต้องระบุเหตุผล"] },
      { title: "เส้นทางเปิดใหม่และสิทธิ์พิเศษ", body: ["LOST → QUALIFY ใช้คำสั่ง REOPEN ต้องมีเหตุผลและ Expected Close Date พร้อมสิทธิ์ opportunity.transition.reopen; baseline ให้ Team Manager และ Sales Director", "WON → NEGOTIATION ใช้คำสั่ง REOPEN สำหรับกรณีแก้ไขพิเศษ ต้องมีเหตุผลและสิทธิ์ opportunity.transition.reopen-won; baseline ให้ Sales Director", "การมีชื่อ role อย่างเดียวไม่พอ ระบบยังตรวจ Organization scope, ownership/assignment, workflow responsibility และ permission grant ที่มีผลจริง"] },
      { title: "สิ่งที่ระบบตรวจทุกครั้ง", body: ["ระบบตรวจ permission opportunity.transition, การเข้าถึง Opportunity ใน scope, เส้นทาง From/To/Command ที่ตรงกับ policy version ซึ่ง Active และ Effective, required permission เพิ่มเติม และ Required Fields ของเส้นทางนั้น", "Expected Version ต้องตรงกับข้อมูลล่าสุด ถ้ามีคนแก้รายการก่อน ระบบปฏิเสธแบบ stale version ให้รีเฟรชแล้วตรวจข้อมูลอีกครั้ง Idempotency Key ป้องกันการกดซ้ำหรือ retry แล้วเกิดผลซ้ำ", "เมื่อผ่าน ระบบเปลี่ยน Stage, เก็บ Stage History พร้อม policy version/evidence snapshot, เขียน Audit ที่มี actor, reason, correlation และบันทึก receipt ใน transaction เดียวกัน การเห็นปุ่มใน UI ไม่ใช่หลักฐานว่ามีสิทธิ์ และห้ามแก้ Stage โดยตรงจากหน้า Edit"] },
      { title: "เมื่อ Transition ไม่ผ่าน", body: ["ตรวจข้อความ Missing Fields แล้วกลับไปเติมข้อมูลต้นทาง เช่น Next Action, Requirements, Coverage/Solution, Quote Approval หรือเหตุผลตามเส้นทาง จากนั้นรีเฟรชหน้าเพื่อใช้ Version ล่าสุด", "หากไม่เห็นตัวเลือก Transition แปลว่าไม่มี route ที่ Active/Effective จาก Stage ปัจจุบัน หรือบัญชีไม่มี permission/scope ที่เกี่ยวข้อง ผู้ดูแลตรวจ policy version และ permission grant ได้ที่ Administration > Workflow", "ผู้ดูแลควรสร้าง policy version ใหม่พร้อม Effective Date แทนการแก้กติกาในโค้ดหรือย้อนข้อมูลเดิม เพราะประวัติ Transition ต้องอ้าง policy version ที่ใช้ตัดสินใจได้"] },
    ],
    faqs: [{ question: "สรุปแล้ว Transition Policy มีกี่ขั้น?", answer: "มี 5 ขั้นทำงานหลักจาก QUALIFY ถึง NEGOTIATION ก่อนปิด WON และมี 4 สถานะปลายทาง เมื่อรวมทางเดินหน้า ย้อน ปิด และเปิดใหม่ baseline มี 26 เส้นทาง" }, { question: "ทำไมกรอกข้อมูลครบแล้วยัง Transition ไม่ได้?", answer: "ยังอาจติด permission/scope, policy ไม่ Active หรืออยู่นอก Effective Date, required permission เฉพาะ หรือ Expected Version เก่า ให้รีเฟรชและให้ผู้ดูแลตรวจ policy/grant" }, { question: "Admin แก้ Stage ให้ผู้ใช้โดยตรงได้ไหม?", answer: "ไม่ได้ Stage ต้องเปลี่ยนผ่าน Transition command ที่ตรวจ policy และสร้าง history/audit Admin จัดการกติกาด้วย policy version ใหม่ได้ แต่ไม่ได้สิทธิ์ commercial transition โดยอัตโนมัติ" }],
    relatedSlugs: ["customer-to-opportunity", "sales-pipeline-and-forecast", "quotation-and-approval", "workflow-administration"],
  },
  {
    slug: "notifications-and-tasks", title: "จัดการ Activity, Meeting และ Notification ประจำวัน", summary: "บันทึกงาน เชื่อมบริบทธุรกิจ มอบหมาย เปลี่ยนสถานะ และไม่พลาด Follow-up หรือ Approval", audience: ["ALL"], category: "การทำงานประจำวัน", tags: ["Activity", "Meeting", "Task", "Notification", "Overdue", "AI Summary"], updatedAt: UPDATED_AT, readingMinutes: 6,
    sections: [
      { title: "บันทึก Activity", body: ["เปิด งานขาย > กิจกรรม หรือ Quick Create เลือก Call, Email, Meeting, Site Visit, Follow-up หรือ Task พร้อม due date และ Owner", "เชื่อม Prospect, Lead, Customer หรือ Opportunity เพื่อให้ปรากฏใน timeline ของ record"] },
      { title: "Assignment และ Completion", body: ["ผู้มี activity.assign มอบหมายใน scope ได้ Owner ปัจจุบันที่มี activity.complete จึงเปลี่ยน In Progress/Completed ได้", "Reason, Outcome, actor และเวลาอยู่ใน Status History พร้อม optimistic version"] },
      { title: "Upcoming, Overdue และกระดิ่ง", body: ["หน้ารายการแสดง due date ตาม Asia/Bangkok และป้าย Upcoming/Overdue สำหรับงานไม่ terminal", "กระดิ่งแสดง Activity ของ Owner และ Quote ของ Maker ที่รอหรือถูกส่งกลับ ไม่แสดงข้อมูลข้าม scope"] },
      { title: "Meeting Draft", body: ["Meeting Draft ใช้ typed/pasted text ไม่ใช่ audio/transcription ผู้ใช้ตรวจ Summary, Requirements, Decisions, Action Items, Risks และ Next Action ก่อนยืนยัน", "AI outage ไม่ block การบันทึก Activity หรือ Meeting Note แบบ manual"] },
    ],
    faqs: [{ question: "ทำไมเปลี่ยนสถานะ Activity ไม่ได้", answer: "ต้องเป็น Owner ปัจจุบันและมี activity.complete" }, { question: "ทำไมไม่เห็น Notification ของคนอื่น", answer: "จำกัดตาม Owner/Maker เพื่อป้องกันข้อมูลข้าม scope" }],
    relatedSlugs: ["prospect-to-lead", "lead-qualification-and-conversion", "ai-assistance-and-safety"],
  },
  {
    slug: "sales-pipeline-and-forecast", title: "อ่าน Opportunity, Sales Pipeline และ Forecast", summary: "ทำความเข้าใจ Stage, Forecast Amount, Weighted Amount, Data Quality, Risk และ immutable snapshot", audience: ["SALES", "APPROVER", "ADMIN"], category: "Pipeline & Forecast", tags: ["Opportunity", "Pipeline", "Forecast", "Probability", "Snapshot", "Deal Risk"], updatedAt: UPDATED_AT, readingMinutes: 8,
    sections: [
      { title: "Stage และ Transition", body: ["Stage หลักคือ QUALIFY, DISCOVER, SOLUTION, PROPOSAL, NEGOTIATION และปลายทาง WON/LOST/CANCELLED/EXPIRED", "Lost ต้องมี Category/Reason และ Probability Override ต้องมีเหตุผล ระบบตรวจ scope, gate และ expected version"] },
      { title: "Forecast Amount", body: ["ก่อนมี governed Quote ใช้ Opportunity Estimated Value จากนั้นใช้ Primary Quote Version ตามสถานะที่กำหนด ไม่รวม Quote ทางเลือกทั้งหมด", "Weighted Amount = Forecast Amount × Probability และคำนวณด้วย Decimal ฝั่ง server"] },
      { title: "Filters และ Quality", body: ["ใช้ Fiscal Period, Owner, Organization, Stage และ Forecast Category เพื่อ drill down ภายในผลลัพธ์ bounded", "Quality ชี้ Expected Close, Next Action หรือ freshness ที่ขาด ให้แก้ record ต้นทางแทนการปรับรายงาน"] },
      { title: "Snapshot และ Risk", body: ["Snapshot เก็บ cutoff, scope, formula/source version และ item facts แบบ immutable พร้อม idempotent key", "Deal Risk trigger มาจาก deterministic rule; AI อธิบายได้แต่ไม่เป็น trigger authority"] },
    ],
    faqs: [{ question: "ทำไม Pipeline Amount ไม่เท่า Estimated Value", answer: "เมื่อ Primary Quote เข้าเกณฑ์ Forecast จะใช้ยอด Quote" }, { question: "ปิด AI แล้วยังเห็น Risk ไหม", answer: "เห็น deterministic signal ได้ AI เป็นชั้นอธิบายเท่านั้น" }],
    relatedSlugs: ["customer-to-opportunity", "opportunity-transition-policy", "notifications-and-tasks", "quotation-and-approval"],
  },
  {
    slug: "presales-solution-survey-boq", title: "ทำ Presales ตั้งแต่ Coverage ถึง Solution Design, Site Survey และ BOQ", summary: "ลำดับงานเทคนิค หลักฐาน Requirement การสำรวจแบบ Manual และการทบทวน BOQ", audience: ["SALES", "PRESALES", "APPROVER"], category: "Presales", tags: ["Coverage", "Solution Design", "Site Survey", "BOQ", "Requirement Mapping", "NTSP"], updatedAt: UPDATED_AT, readingMinutes: 10,
    sections: [
      { title: "Coverage และ Solution", body: ["Solution Design อ้าง Opportunity ใน scope เพิ่ม Service, Site/GPS/Contact, Component, Network, Risk และ Requirement Mapping", "Service Category configuration กำหนด Survey, BOQ และ physical installation gate"] },
      { title: "Solution Workflow", body: ["เดิน DRAFT ไป Requirements Review และเส้นทาง Survey/Solution ตาม gate พร้อมเหตุผล", "Technical กับ Commercial Review แยกกันและตรวจ permission, scope, maker-checker"] },
      { title: "Site Survey แบบ Manual", body: ["Submit สร้าง normalized NTSP request snapshot จากนั้น Coordinator เลือก Team, Engineer, Priority และวันสำรวจ", "Reviewer Approve/Return/Reject ผลได้ ปัจจุบันไม่มี Production NTSP API และไม่ถือ Integration Success จนมี acknowledgement"] },
      { title: "BOQ", body: ["ระบุ Section, Quantity, Unit, Wastage, Cost, Selling Price, Discount, Charge Type และ Contract Months ด้วย Decimal", "ส่ง Technical Review ก่อน Commercial Review การ Revision รักษา version เดิมและ Survey ไม่ approve BOQ อัตโนมัติ"] },
    ],
    faqs: [{ question: "ส่ง Survey แล้วไป NTSP หรือยัง", answer: "ยัง ปัจจุบันเป็น Manual mode" }, { question: "ใครเห็น Unit Cost", answer: "เฉพาะผู้มี cost-view permission" }],
    relatedSlugs: ["customer-to-opportunity", "proposal-and-ai-draft", "quotation-and-approval"],
  },
  {
    slug: "proposal-and-ai-draft", title: "สร้าง Proposal แบบ Versioned และใช้ AI Draft อย่างปลอดภัย", summary: "สร้างจาก Opportunity แก้เป็น immutable version Review ตามลำดับ และใช้ AI เป็นร่าง", audience: ["SALES", "PRESALES", "APPROVER"], category: "Proposal & Quotation", tags: ["Proposal", "Template", "Version", "AI Draft", "Manager Review", "Print"], updatedAt: UPDATED_AT, readingMinutes: 7,
    sections: [
      { title: "สร้างจาก Opportunity", body: ["เลือก Opportunity ใน scope ระบบสืบทอด Customer/Owner และคัดลอก active Template sections เข้า Version แรก", "การแก้ Template ภายหลังไม่เปลี่ยน Proposal เดิม"] },
      { title: "Version และ Restore", body: ["ทุกการแก้สร้าง immutable version ใหม่และมี Version Compare", "Restore สร้าง version ใหม่จาก source พร้อมที่มา; terminal Proposal แก้ไม่ได้"] },
      { title: "AI Generator", body: ["AI ใช้ Opportunity, Customer, Meeting Notes, Template และ Product ที่เลือกภายใน scope แล้วสร้าง editable Draft ภาษาไทย โดยคงชื่อเฉพาะ รหัสและตัวเลขตามต้นฉบับ", "ต้องตรวจข้อเท็จจริง ราคา ขอบเขตและเงื่อนไข; provider outage ยังแก้ manual ได้"] },
      { title: "Review และ Quotation", body: ["Workflow เป็น Manager review แล้ว Director approval พร้อม maker-checker", "Print เป็น browser view ไม่ใช่ PDF/Word delivery หรือ signature เมื่อพร้อมจึงสร้าง Quotation ที่ผูก Opportunity เดียวกัน"] },
    ],
    faqs: [{ question: "AI Draft ถือว่าอนุมัติไหม", answer: "ไม่ ยังต้องผ่าน review workflow" }, { question: "Print คือเอกสารส่งลูกค้าอัตโนมัติไหม", answer: "ไม่ เป็น authenticated browser print view" }],
    relatedSlugs: ["presales-solution-survey-boq", "quotation-and-approval", "ai-assistance-and-safety"],
  },
  {
    slug: "quotation-and-approval", title: "สร้าง Quotation, ส่ง Approval และบันทึกลูกค้ายอมรับ", summary: "กรอกหลาย Product ตรวจ Floor Price/Commercial Gate จัดการ Revision และ Authority", audience: ["SALES", "PRESALES", "APPROVER"], category: "Proposal & Quotation", tags: ["Quotation", "Quote Version", "Floor Price", "Discount", "Approval", "Maker Checker"], updatedAt: UPDATED_AT, readingMinutes: 10,
    sections: [
      { title: "Draft Version", body: ["Quote อยู่ใต้ Opportunity และสืบทอด Customer; Proposal link ต้องตรง Opportunity", "เพิ่ม Product 1–100 รายการ ระบุ Quantity, Unit Price, Discount ระบบคำนวณ Total/Cost/Margin ด้วย Decimal"] },
      { title: "Floor Price และ Gate", body: ["ราคาสุทธิต่อหน่วยต้องไม่ต่ำกว่า confirmed Floor Price และอาจต้องมี confirmed cost, Coverage หรือ Solution", "UI เป็นคำเตือนเบื้องต้น กติกาจริงตรวจฝั่ง server"] },
      { title: "Approval", body: ["Submit สร้าง request ที่อ้าง Quote Version/policy snapshot ผู้อนุมัติเลือก Approve, Reject, Return, Delegate หรือ Escalate พร้อมเหตุผล", "ตรวจ policy role, Organization, Segment, Maximum Amount, Effective Period และ maker-checker"] },
      { title: "Revision ถึง Accepted", body: ["Return/Reject ต้องสร้าง Revision และ Submit ใหม่ โดยเก็บ evidence เดิม", "APPROVED เปลี่ยนเป็น SENT แล้ว ACCEPTED เมื่อลูกค้ายอมรับ เฉพาะ ACCEPTED Version จึงสร้าง Contract"] },
    ],
    faqs: [{ question: "ทำไมยังไม่กำหนด Floor Price", answer: "Product ยังไม่มีราคา/ต้นทุนที่ยืนยัน ผู้ดูแลต้องบันทึกข้อมูลจริง" }, { question: "Maker อนุมัติเองได้ไหม", answer: "ไม่ได้เมื่อ policy กำหนด maker-checker" }],
    relatedSlugs: ["proposal-and-ai-draft", "sales-pipeline-and-forecast", "contract-to-service-order", "workflow-administration"],
  },
  {
    slug: "contract-to-service-order", title: "สร้าง Contract จาก Accepted Quote และส่งต่อ Service Order", summary: "ควบคุม Contract Version, Review, เอกสาร ลายเซ็น และ manual handoff", audience: ["SALES", "APPROVER", "ADMIN"], category: "Contract", tags: ["Contract", "Accepted Quote", "Signature", "malware scan", "Renewal", "Service Order"], updatedAt: UPDATED_AT, readingMinutes: 9,
    sections: [
      { title: "สร้าง Contract", body: ["สร้างได้จาก ACCEPTED Quote Version ใน scope ระบบคัดลอก Customer, Opportunity, Proposal, Quote และรายการ server-side", "TCV, MRR และ One-time ใช้ Decimal จาก immutable Contract Version"] },
      { title: "Lifecycle", body: ["ครอบคลุม Internal/Legal/Customer Review, Approval, Signature Pending, Effective, Service Order และ Completed พร้อม Revision/Cancelled/Expired", "ทุก transition ตรวจ edge, permission, maker-checker, scope และ version"] },
      { title: "Document และ Signature", body: ["เอกสารอยู่ private storage และใช้เฉพาะ version ที่ malware scan CLEAN เป็นหลักฐาน", "ต้องบันทึก Customer/NT Signer อ้าง current version และ document ก่อน Effective"] },
      { title: "Renewal และ Service Order", body: ["หน้า Contract แสดง Amendment, Renewal/Reminder, PO และ execution evidence", "Service Order เป็น DRAFT manual handoff ไม่ใช่ NTSP Integration Success จนมี acknowledgement"] },
    ],
    faqs: [{ question: "อัปโหลดสัญญาแล้ว Effective ไหม", answer: "ยัง ต้องบันทึก signature evidence ที่อ้าง CLEAN document/current version" }, { question: "Service Order ไป NTSP แล้วหรือยัง", answer: "ยัง เป็น manual handoff จนมี acknowledgement" }],
    relatedSlugs: ["quotation-and-approval", "workflow-administration"],
  },
  {
    slug: "ai-assistance-and-safety", title: "ใช้ AI Assistance โดยยังควบคุมข้อมูลและการตัดสินใจ", summary: "Human Confirmation, Provenance, Draft, Deal Risk และ Manual Fallback", audience: ["ALL"], category: "AI Assistance", tags: ["AI", "Human Confirmation", "Provenance", "Deal Risk", "Fallback", "training consent"], updatedAt: UPDATED_AT, readingMinutes: 8,
    sections: [
      { title: "AI ไม่ใช่ผู้อนุมัติ", body: ["AI Suggestion/Draft ไม่เปลี่ยน record เอง ผู้มี permission ต้องตรวจ แก้ และยืนยัน", "AI ข้าม authorization, approval, maker-checker, floor price หรือ gate ไม่ได้"] },
      { title: "Data Boundary", body: ["ส่งเฉพาะข้อมูลขั้นต่ำใน scope ห้ามใส่ password, API key, token หรือ secret", "เก็บ provider/model, template, source, เวลา และ provenance ที่จำเป็น ไม่เก็บ raw prompt/full response โดย default"] },
      { title: "Capabilities", body: ["Prospect Insight, Meeting Draft, Proposal Draft และ Deal Risk Explanation ล้วนต้องแยก draft/rule จากข้อมูลทางการ", "Confirmed Next Action สร้าง Activity หลังตรวจ Owner, context และ due date พร้อม idempotency"] },
      { title: "Fallback และ Feedback", body: ["Timeout, quota หรือ schema error ต้อง sanitized และไม่ block core workflow", "Helpful, Incorrect, Unsafe ใช้ quality monitoring และไม่ใช่ training consent"] },
    ],
    faqs: [{ question: "ยืนยัน AI Draft เท่ากับอนุมัติไหม", answer: "ไม่ งานยังผ่าน workflow ปกติ" }, { question: "Helpful คือ consent ให้ train ไหม", answer: "ไม่ Feedback ไม่ใช่ training consent" }],
    relatedSlugs: ["ai-page-assistant", "prospect-to-lead", "notifications-and-tasks", "proposal-and-ai-draft"],
  },
  {
    slug: "workflow-administration", title: "ดูแล Users, Organization, Workflow, Authority และ Audit", summary: "คู่มือบัญชี บทบาท หน่วยงาน ผู้อนุมัติ Policy, Product Cost, AI Settings และ Risk Rules", audience: ["ADMIN"], category: "Administration", tags: ["Users", "Roles", "Organization", "Workflow", "Authority", "Audit", "Round Robin"], updatedAt: UPDATED_AT, readingMinutes: 12,
    sections: [
      { title: "Users & Roles", body: ["ดูบัญชี สถานะ assignments, Organization และ InsightKM จาก Users & Roles แล้วใช้หน้า edit จัดการ role/API key", "Admin เปลี่ยน role ปิดบัญชี หรือ self-grant ของตัวเองไม่ได้ บัญชี Disabled ใช้ session ต่อไม่ได้"] },
      { title: "Organization & Approvers", body: ["Unit code ต้อง unique, parent active และห้าม cycle การปิดต้องไม่มี active child/assignment/Lead rule", "Approver ต้องมี scoped role และ Authority ตรง Role, Segment, Maximum Amount และ Effective Period"] },
      { title: "Workflow และ Assignment", body: ["Transition/Approval Policy เปลี่ยนด้วย version ใหม่และ effective dates; cost/floor price ต้องยืนยันจากข้อมูลจริง", "Lead Assignment ใช้ priority กับ Owner/Round Robin ห้าม hard-code role, status หรือ approval level"] },
      { title: "Audit, Deleted Records และ AI", body: ["Deleted Records กู้เฉพาะ soft delete ไม่ย้อน Merge/immutable version; Audit แสดง Actor, Action, Target, Outcome, Correlation ID", "AI Settings เก็บ credential เข้ารหัสและ Test Connection แบบ sanitize; Risk Rules เป็น deterministic versioned configuration"] },
    ],
    faqs: [{ question: "ซ่อนปุ่มพอสำหรับ security ไหม", answer: "ไม่ ทุก mutation ตรวจ authorization ฝั่ง serverและมี audit" }, { question: "ทำไม Approver ใหม่ยังอนุมัติไม่ได้", answer: "ตรวจ assignment, scope, policy role, segment, amount, dates และ maker-checker" }],
    relatedSlugs: ["opportunity-transition-policy", "quotation-and-approval", "contract-to-service-order", "ai-assistance-and-safety"],
  },
];

function articleSearchText(article: HelpArticle) {
  return [article.slug, article.title, article.summary, article.category, ...article.tags, ...article.sections.flatMap((section) => [section.title, ...section.body]), ...article.faqs.flatMap((faq) => [faq.question, faq.answer])].join(" ").toLocaleLowerCase("th-TH");
}

export function getHelpArticle(slug: string) { return helpArticles.find((article) => article.slug === slug); }
export function getRelatedHelpArticles(article: HelpArticle) { return (article.relatedSlugs ?? []).flatMap((slug) => { const item = getHelpArticle(slug); return item ? [item] : []; }); }
export function searchHelpArticles(query: string, audience: string) {
  const normalized = query.trim().toLocaleLowerCase("th-TH");
  return helpArticles.filter((article) => (!audience || article.audience.includes(audience as HelpAudience) || article.audience.includes("ALL")) && (!normalized || articleSearchText(article).includes(normalized)));
}

function helpSearchTokens(value: string) {
  return [...new Set(value.toLocaleLowerCase("th-TH").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2).flatMap((token) => token.endsWith("s") && token.length > 4 ? [token, token.slice(0, -1)] : [token]))];
}

export function getRelevantHelpArticles(query: string, limit = 3) {
  const tokens = helpSearchTokens(query);
  const normalizedQuery = query.toLocaleLowerCase("th-TH");
  const routeArticle = [
    [/\/prospects(?:\/|\s|$)/, "prospect-to-lead"],
    [/\/leads(?:\/|\s|$)/, "lead-qualification-and-conversion"],
    [/\/(?:customers|opportunities)(?:\/|\s|$)/, "customer-to-opportunity"],
    [/\/activities(?:\/|\s|$)/, "notifications-and-tasks"],
    [/\/pipeline(?:\/|\s|$)/, "sales-pipeline-and-forecast"],
    [/\/(?:coverage|solution-designs|site-surveys|boqs)(?:\/|\s|$)/, "presales-solution-survey-boq"],
    [/\/proposals(?:\/|\s|$)/, "proposal-and-ai-draft"],
    [/\/(?:quotes|approvals)(?:\/|\s|$)/, "quotation-and-approval"],
    [/\/contracts(?:\/|\s|$)/, "contract-to-service-order"],
    [/\/admin(?:\/|\s|$)/, "workflow-administration"],
  ].find(([pattern]) => (pattern as RegExp).test(normalizedQuery))?.[1] as string | undefined;
  const ranked = helpArticles.map((article, index) => {
    const title = article.title.toLocaleLowerCase("th-TH");
    const searchable = articleSearchText(article);
    const score = (article.slug === routeArticle ? 10 : 0) + tokens.reduce((total, token) => total + (title.includes(token) ? 4 : searchable.includes(token) ? 1 : 0), 0);
    return { article, index, score };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
  const matches = ranked.filter((item) => item.score > 0).map((item) => item.article);
  const assistantGuide = getHelpArticle("ai-page-assistant");
  const selected = assistantGuide ? [assistantGuide, ...matches.filter((article) => article.slug !== assistantGuide.slug)] : matches;
  return selected.slice(0, Math.max(0, limit));
}
