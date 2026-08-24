export type ProductSearchOption = {
  id: string;
  code: string;
  name: string;
  category?: string;
};

export function normalizeProductSearch(value: string) {
  return value.trim().toLocaleLowerCase("th-TH").replace(/\s+/g, " ");
}

export function productOptionLabel(option: ProductSearchOption) {
  return `${option.code} — ${option.name}`;
}

export function findProductOption(options: ProductSearchOption[], value: string) {
  const query = normalizeProductSearch(value);
  if (!query) return undefined;
  return options.find((option) => [option.id, option.code, option.name, productOptionLabel(option)]
    .some((candidate) => normalizeProductSearch(candidate) === query));
}

export function filterProductOptions<T extends ProductSearchOption>(options: T[], value: string, limit = 50) {
  const query = normalizeProductSearch(value);
  const matches = query
    ? options.filter((option) => normalizeProductSearch([option.code, option.name, option.category].filter(Boolean).join(" ")).includes(query))
    : options;
  return matches.slice(0, Math.max(0, limit));
}
