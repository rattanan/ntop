import type { Prisma } from "@prisma/client";
import { normalizeProspectText } from "./prospect-rules";

const BANK_COMPANY_ALIASES = [
  "ธกส",
  "ธกศ",
  "ธอส",
  "kbank",
  "ktb",
  "scb",
  "bbl",
  "bay",
  "gsb",
  "ghb",
  "ttb",
  "cimb",
  "uob",
  "kkp",
] as const;

function companyAliases(query: string) {
  return /(?:ธนาคาร|การเงิน|bank)/iu.test(query) ? BANK_COMPANY_ALIASES : [];
}

export function buildProspectSearchWhere(
  value: string | null | undefined,
): Prisma.ProspectWhereInput {
  const query = value?.trim();
  if (!query) return {};

  const normalizedQuery = normalizeProspectText(query);
  const aliases = companyAliases(query);
  return {
    OR: [
      { prospectCode: { contains: query } },
      { companyName: { contains: query } },
      { companyNameEnglish: { contains: query } },
      ...(normalizedQuery
        ? [
            { normalizedCompanyName: { contains: normalizedQuery } },
            { normalizedCompanyEnglish: { contains: normalizedQuery } },
          ]
        : []),
      ...aliases.flatMap((alias) => [
        { normalizedCompanyName: { contains: alias } },
        { normalizedCompanyEnglish: { contains: alias } },
      ]),
      { taxId: { contains: query } },
      { customerType: { contains: query } },
      { organizationType: { contains: query } },
      { subIndustry: { contains: query } },
      { companyDescription: { contains: query } },
      { industry: { is: { name: { contains: query } } } },
      {
        contacts: {
          some: {
            OR: [
              { email: { contains: query } },
              { phone: { contains: query } },
              { mobile: { contains: query } },
            ],
            deletedAt: null,
          },
        },
      },
    ],
  };
}
