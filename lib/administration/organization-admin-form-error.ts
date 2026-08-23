import { ZodError } from "zod";

const fieldMessages: Record<string, string> = {
  code:
    "รหัสหน่วยงานต้องมี 2–100 ตัวอักษร เริ่มด้วยตัวอักษรหรือตัวเลข และใช้ได้เฉพาะตัวอักษร (รวมภาษาไทยและอังกฤษ) ตัวเลข จุด (.), ขีดกลาง (-) หรือขีดล่าง (_)",
  name: "ชื่อหน่วยงานต้องมี 2–255 ตัวอักษร",
  parentId: "หน่วยงานแม่ไม่ถูกต้อง กรุณาเลือกใหม่อีกครั้ง",
  organizationUnitId: "กรุณาเลือกหน่วยงาน",
  userId: "กรุณาเลือกผู้ใช้งาน",
  roleCode: "กรุณาเลือกบทบาทตาม Approval Policy",
  maximumAmount: "วงเงินอนุมัติต้องเป็นตัวเลขตั้งแต่ 0 และมีทศนิยมได้ไม่เกิน 4 ตำแหน่ง",
  customerSegment: "Customer segment ต้องมีความยาวไม่เกิน 100 ตัวอักษร",
  effectiveFrom: "วันเริ่มมีผลไม่ถูกต้อง",
  effectiveTo: "วันสิ้นสุดไม่ถูกต้อง",
  assignmentId: "ไม่พบผู้อนุมัติ Quotation ที่เลือก",
  reason: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร",
};

export function organizationAdminValidationMessage(error: unknown): string | null {
  if (!(error instanceof ZodError)) return null;

  const field = error.issues[0]?.path[0];
  if (typeof field === "string" && fieldMessages[field]) {
    return fieldMessages[field];
  }

  return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
}
