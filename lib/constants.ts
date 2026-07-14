export const SEGMENTS = ["G1", "G2", "G3", "G4", "G5", "B1", "B2", "B3", "B4"];
export const FLOWS = ["F1 นโยบาย / MOU", "F2 Strategic KAM", "F3 สาขาทั่วประเทศ", "F4 ส่วนกลางมาตรฐาน", "F5 รวมซื้อท้องถิ่น", "F6 ผู้ให้บริการ / ขายส่ง", "F7 ธุรกิจต่างจังหวัด", "F8 SME / ดิจิทัล"];
export const STAGES = [
  ["QUALIFY", "คัดกรอง"], ["DISCOVER", "ค้นหาความต้องการ"], ["SOLUTION", "ออกแบบโซลูชัน"],
  ["PROPOSAL", "ยื่นข้อเสนอ"], ["NEGOTIATION", "เจรจา"], ["WON", "ชนะ"], ["LOST", "ไม่ชนะ"], ["CANCELLED", "ยกเลิก"], ["EXPIRED", "หมดอายุ"],
] as const;
export const APPROACHES = [["DIRECT", "Direct"], ["PARTNER", "Partner"], ["DISPLACE", "Displace"]] as const;
export const ROLE_LABELS = { ADMIN: "ผู้ดูแลระบบ", SALES: "ฝ่ายขาย", VIEWER: "ผู้ดูข้อมูล" } as const;
export const LEAD_SOURCES = [["IMPORT", "นำเข้า"], ["WEBSITE", "เว็บไซต์ / API"], ["EVENT", "กิจกรรม"], ["PARTNER", "พันธมิตร"], ["REFERRAL", "ผู้แนะนำ"], ["EXISTING_CUSTOMER", "ลูกค้าเดิมแนะนำ"], ["MARKETING_CAMPAIGN", "แคมเปญการตลาด"], ["API", "API"], ["GOVERNMENT_TENDER", "ประกวดราคาภาครัฐ"]] as const;
export const LEAD_STATUSES = [["NEW", "ใหม่"], ["ASSIGNED", "มอบหมายแล้ว"], ["CONTACTED", "ติดต่อแล้ว"], ["NURTURING", "กำลังติดตาม"], ["QUALIFIED", "ผ่านการคัดกรอง"], ["DISQUALIFIED", "ไม่ผ่าน"], ["INVALID", "ข้อมูลไม่ถูกต้อง"], ["DUPLICATE", "ข้อมูลซ้ำ"], ["NOT_INTERESTED", "ไม่สนใจ"], ["NO_BUDGET", "ไม่มีงบประมาณ"], ["CONVERTED", "แปลงแล้ว"], ["ARCHIVED", "เก็บถาวร"]] as const;
export const ACTIVITY_TYPES = [["CALL", "โทรศัพท์"], ["EMAIL", "อีเมล"], ["MEETING", "ประชุม"], ["SITE_VISIT", "เยี่ยมพื้นที่"], ["ONLINE_MEETING", "ประชุมออนไลน์"], ["NOTE", "บันทึก"], ["FOLLOW_UP", "ติดตาม"], ["TASK", "งาน"], ["DOCUMENT_REQUEST", "ขอเอกสาร"]] as const;
