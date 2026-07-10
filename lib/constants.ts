export const SEGMENTS = ["G1", "G2", "G3", "G4", "G5", "B1", "B2", "B3", "B4"];
export const FLOWS = ["F1 นโยบาย / MOU", "F2 Strategic KAM", "F3 สาขาทั่วประเทศ", "F4 ส่วนกลางมาตรฐาน", "F5 รวมซื้อท้องถิ่น", "F6 ผู้ให้บริการ / ขายส่ง", "F7 ธุรกิจต่างจังหวัด", "F8 SME / ดิจิทัล"];
export const STAGES = [
  ["QUALIFY", "คัดกรอง"], ["DISCOVER", "ค้นหาความต้องการ"], ["SOLUTION", "ออกแบบโซลูชัน"],
  ["PROPOSAL", "ยื่นข้อเสนอ"], ["NEGOTIATION", "เจรจา"], ["WON", "ชนะ"], ["LOST", "ไม่ชนะ"],
] as const;
export const APPROACHES = [["DIRECT", "Direct"], ["PARTNER", "Partner"], ["DISPLACE", "Displace"]] as const;
export const ROLE_LABELS = { ADMIN: "ผู้ดูแลระบบ", SALES: "ฝ่ายขาย", VIEWER: "ผู้ดูข้อมูล" } as const;
