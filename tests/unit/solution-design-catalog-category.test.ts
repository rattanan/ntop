import { describe, expect, it } from "vitest";

import { catalogItemBelongsToCategory } from "../../lib/solution-design/catalog-category";

const category = { code: "BROADBAND", name: "Broadband" };

describe("Solution Design Catalog category matching", () => {
  it("matches a Catalog item by its configured Service Category code", () => {
    expect(catalogItemBelongsToCategory({ category: "Legacy label", serviceCategoryCode: "BROADBAND" }, category)).toBe(true);
    expect(catalogItemBelongsToCategory({ category: "Broadband", serviceCategoryCode: "DATACOM" }, category)).toBe(false);
  });

  it("supports only exact legacy category code or name matches when the configured code is missing", () => {
    expect(catalogItemBelongsToCategory({ category: " broadband ", serviceCategoryCode: null }, category)).toBe(true);
    expect(catalogItemBelongsToCategory({ category: "BROADBAND", serviceCategoryCode: null }, category)).toBe(true);
    expect(catalogItemBelongsToCategory({ category: "Broadband Internet", serviceCategoryCode: null }, category)).toBe(false);
  });
});
