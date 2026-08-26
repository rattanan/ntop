import { prisma } from "@/lib/prisma";
import { ProspectValidationError } from "@/lib/prospect/prospect-service";

export async function assertProspectClassification(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return;
  const value = input as Record<string, unknown>;
  const segment = typeof value.organizationType === "string" ? value.organizationType.trim() : "";
  const subIndustry = typeof value.subIndustry === "string" ? value.subIndustry.trim() : "";
  const province = typeof value.province === "string" ? value.province.trim() : "";
  if (province && !await prisma.provinceReference.findFirst({ where: { name: province, active: true }, select: { code: true } })) throw new ProspectValidationError({ province: ["กรุณาเลือกจังหวัดจากรายการ"] });
  if (!segment) {
    if (subIndustry) throw new ProspectValidationError({ subIndustry: ["กรุณาเลือก Segment ก่อนเลือกอุตสาหกรรมย่อย"] });
    return;
  }
  const reference = await prisma.customerSegment.findFirst({
    where: { code: segment, active: true, ...(subIndustry ? { subIndustries: { some: { code: subIndustry, active: true } } } : {}) },
    select: { code: true },
  });
  if (!reference) throw new ProspectValidationError({ organizationType: ["Segment หรืออุตสาหกรรมย่อยไม่สัมพันธ์กับข้อมูลอ้างอิงที่เปิดใช้งาน"] });
}
