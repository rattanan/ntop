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

export function normalizeSubIndustryCode(
  segmentCode: string | null | undefined,
  value: string | null | undefined,
  classifications: CustomerClassificationOption[],
): string | undefined {
  const normalizedValue = value?.trim();
  if (!segmentCode || !normalizedValue) return undefined;
  const segment = classifications.find((item) => item.code === segmentCode);
  const subIndustry = segment?.subIndustries.find((item) =>
    item.code === normalizedValue ||
    item.name === normalizedValue ||
    `${item.code} — ${item.name}` === normalizedValue ||
    `${item.code} - ${item.name}` === normalizedValue
  );
  return subIndustry?.code;
}

export function omitBlankLegacySubIndustry<T extends { subIndustry?: string }>(
  values: T,
  preserveLegacyValue: boolean,
): T {
  if (!preserveLegacyValue || values.subIndustry) return values;
  const normalized = { ...values };
  delete normalized.subIndustry;
  return normalized;
}
