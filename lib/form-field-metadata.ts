export type FormFieldMetadata = {
  description: string;
  example: string;
  unit?: string;
};

const metadata: Record<string, FormFieldMetadata> = {
  companyName: { description: "ชื่อบริษัทหรือหน่วยงานตามเอกสารทางการ", example: "บริษัท เอ็นที จำกัด (มหาชน)" },
  name: { description: "ชื่อของรายการที่กำลังสร้างหรือแก้ไข", example: "โครงการเชื่อมโยงเครือข่ายสำนักงานใหญ่" },
  taxId: { description: "เลขประจำตัวผู้เสียภาษีของนิติบุคคล 13 หลัก", example: "0105559999999" },
  type: { description: "ประเภท Customer เพื่อแยกหน่วยงานภาครัฐและภาคธุรกิจ", example: "B2G - ภาครัฐ" },
  customerType: { description: "ประเภท Customer เพื่อแยกหน่วยงานภาครัฐและภาคธุรกิจ", example: "B2B - ภาคเอกชน" },
  segment: { description: "กลุ่มลูกค้าตามโครงสร้างการขาย ใช้กำหนดอุตสาหกรรมย่อยที่เลือกได้", example: "B1 - องค์กรธุรกิจขนาดใหญ่" },
  organizationType: { description: "Segment ของบริษัทหรือหน่วยงานตามโครงสร้างการขาย", example: "G2 - รัฐวิสาหกิจ" },
  subIndustry: { description: "อุตสาหกรรมย่อยที่สอดคล้องกับ Segment ที่เลือก", example: "B1-BANK - ธนาคารและบริการทางการเงิน" },
  companySize: { description: "ขนาดของบริษัทจากจำนวนบุคลากรและขอบเขตการดำเนินงาน", example: "MEDIUM - กลาง" },
  numberOfEmployees: { description: "จำนวนพนักงานโดยประมาณของบริษัทหรือหน่วยงาน", example: "350", unit: "คน" },
  numberOfBranches: { description: "จำนวนสาขาหรือสถานที่ดำเนินงานทั้งหมด", example: "12", unit: "สาขา" },
  estimatedAnnualRevenue: { description: "รายได้ต่อปีโดยประมาณ ใช้ประกอบการประเมินศักยภาพ", example: "120000000", unit: "บาท" },
  expectedBudget: { description: "งบประมาณที่คาดว่าลูกค้าเตรียมไว้สำหรับโครงการ", example: "2500000", unit: "บาท" },
  estimatedOpportunityValue: { description: "มูลค่าโอกาสขายโดยประมาณก่อนจัดทำข้อเสนอ", example: "4200000", unit: "บาท" },
  estimatedValue: { description: "มูลค่ารวมโดยประมาณของโอกาสขาย", example: "4200000", unit: "บาท" },
  listPrice: { description: "ราคาอ้างอิงของสินค้าหรือบริการต่อหน่วย", example: "15000.00", unit: "บาท" },
  floorPrice: { description: "ราคาขายสุทธิต่อหน่วยต่ำสุดที่อนุญาต", example: "12000.00", unit: "บาท" },
  unitPrice: { description: "ราคาขายต่อหนึ่งหน่วย", example: "15000.00", unit: "บาท" },
  standardCost: { description: "ต้นทุนมาตรฐานต่อหน่วย", example: "9000.00", unit: "บาท" },
  maximumAmount: { description: "วงเงินสูงสุดที่ผู้อนุมัติมีอำนาจอนุมัติ", example: "5000000.00", unit: "บาท" },
  quantity: { description: "จำนวนสินค้าหรือบริการที่ต้องการ", example: "2", unit: "หน่วย" },
  circuitCount: { description: "จำนวนวงจรสื่อสารที่ต้องตรวจสอบพื้นที่ให้บริการ", example: "3", unit: "วงจร" },
  durationMonths: { description: "ระยะเวลาของสัญญาหรือบริการ", example: "24", unit: "เดือน" },
  probability: { description: "โอกาสที่การขายจะสำเร็จ ค่าตั้งแต่ 0 ถึง 100", example: "70", unit: "%" },
  confidence: { description: "ระดับความมั่นใจของการประเมิน ค่าตั้งแต่ 0 ถึง 100", example: "80", unit: "%" },
  discountPct: { description: "ส่วนลดคิดเป็นร้อยละของราคาก่อนส่วนลด", example: "10", unit: "%" },
  score: { description: "คะแนนที่ใช้จัดลำดับความสำคัญ ค่าตั้งแต่ 0 ถึง 100", example: "75", unit: "คะแนน" },
  priority: { description: "ลำดับความสำคัญ ค่าน้อยจะถูกพิจารณาก่อน", example: "100", unit: "ลำดับ" },
  displayOrder: { description: "ลำดับที่ใช้จัดเรียงรายการบนหน้าจอ", example: "10", unit: "ลำดับ" },
  threshold: { description: "ค่าขีดแบ่งที่ทำให้กฎนี้เริ่มทำงาน", example: "30", unit: "คะแนน" },
  requestTimeoutMs: { description: "เวลาสูงสุดที่รอคำตอบจาก AI provider", example: "30000", unit: "ms" },
  currentContractEndDate: { description: "วันที่คาดว่าจะปิดการขายและเปลี่ยนเป็นโอกาสที่ดำเนินการสำเร็จ", example: "31/12/2569" },
  expectedCloseAt: { description: "วันที่คาดว่าจะปิดการขาย", example: "31/12/2569" },
  contactName: { description: "ชื่อบุคคลหลักที่สามารถติดต่อเรื่องนี้ได้", example: "สมชาย ใจดี" },
  email: { description: "อีเมลสำหรับติดต่อและรับข้อมูล", example: "somchai@example.com" },
  phone: { description: "หมายเลขโทรศัพท์สำหรับติดต่อ", example: "02-123-4567" },
  mobile: { description: "หมายเลขโทรศัพท์มือถือสำหรับติดต่อ", example: "081-234-5678" },
  ownerId: { description: "ผู้รับผิดชอบหลักของรายการและการติดตามงาน", example: "รัตนันท์ นันทิยกุล" },
  status: { description: "สถานะปัจจุบันของรายการใน workflow", example: "QUALIFIED - ผ่านการคัดกรอง" },
  notes: { description: "ข้อมูลเพิ่มเติมที่ช่วยให้ผู้รับผิดชอบทำงานต่อได้", example: "ลูกค้าต้องการนำเสนอภายในไตรมาส 4" },
};

function normalizedName(name: string) {
  return name.replace(/\[\d+\]/g, "").split(".").at(-1) ?? name;
}

export function getFormFieldMetadata(name: string, label = "ข้อมูล") {
  const key = normalizedName(name);
  return metadata[key] ?? {
    description: `ใช้ระบุ${label.trim()}ให้ถูกต้องเพื่อประกอบการบันทึกและดำเนินงานในระบบ`,
    example: `กรอกหรือเลือก${label.trim()}ตามข้อมูลจริง`,
  };
}

export function getNumericFieldUnit(name: string) {
  return getFormFieldMetadata(name).unit;
}
