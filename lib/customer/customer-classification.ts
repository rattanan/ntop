import { prisma } from "@/lib/prisma";

import type { CustomerClassificationOption } from "./customer-classification-options";

export { COMPANY_SIZE_OPTIONS, normalizeSubIndustryCode } from "./customer-classification-options";
export type { CustomerClassificationOption } from "./customer-classification-options";

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
