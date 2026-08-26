import { prisma } from "@/lib/prisma";

export type DistrictOption = { code: string; provinceCode: string; name: string };

export async function loadDistrictOptions(provinceCode: string): Promise<DistrictOption[]> {
  if (!/^\d{2}$/.test(provinceCode)) return [];

  return prisma.districtReference.findMany({
    where: { provinceCode, active: true, province: { active: true } },
    select: { code: true, provinceCode: true, name: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    take: 100,
  });
}
