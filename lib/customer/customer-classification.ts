import { prisma } from "@/lib/prisma";

export type CustomerClassificationOption = {
  code: string;
  name: string;
  subIndustries: Array<{ code: string; name: string }>;
};

export const COMPANY_SIZE_OPTIONS = [
  { code: "SMALL", name: "เล็ก" },
  { code: "MEDIUM", name: "กลาง" },
  { code: "LARGE", name: "ใหญ่" },
] as const;

export async function loadCustomerClassifications(): Promise<CustomerClassificationOption[]> {
  return prisma.customerSegment.findMany({
    where: { active: true },
    select: {
      code: true,
      name: true,
      subIndustries: {
        where: { active: true },
        select: { code: true, name: true },
        orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      },
    },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });
}
