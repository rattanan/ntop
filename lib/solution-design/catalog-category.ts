export type ServiceCategoryIdentity = { code: string; name: string };
export type CatalogItemCategory = { category: string; serviceCategoryCode: string | null };

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function catalogItemBelongsToCategory(
  product: CatalogItemCategory,
  category: ServiceCategoryIdentity,
) {
  if (product.serviceCategoryCode) {
    return normalized(product.serviceCategoryCode) === normalized(category.code);
  }

  const legacyCategory = normalized(product.category);
  return legacyCategory === normalized(category.code) || legacyCategory === normalized(category.name);
}
