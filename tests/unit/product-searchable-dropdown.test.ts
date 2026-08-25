import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { filterProductOptions, findProductOption, productOptionLabel } from "../../lib/presales/product-option-search";

const products = [
  { id: "cloud", code: "NT-CLOUD-01", name: "บริการคลาวด์องค์กร", category: "Cloud" },
  { id: "broadband", code: "NT-BB-1000", name: "Managed Broadband", category: "Internet" },
  { id: "security", code: "NT-SEC-01", name: "Managed Security", category: "Cyber Security" },
];

describe("searchable Product dropdowns", () => {
  it("searches case-insensitively by Product code, name, and category", () => {
    expect(filterProductOptions(products, "nt-bb").map((item) => item.id)).toEqual(["broadband"]);
    expect(filterProductOptions(products, "บริการคลาวด์").map((item) => item.id)).toEqual(["cloud"]);
    expect(filterProductOptions(products, "CYBER").map((item) => item.id)).toEqual(["security"]);
  });

  it("maps a typed code or selected display label back to the stable Product id", () => {
    expect(findProductOption(products, " nt-bb-1000 ")?.id).toBe("broadband");
    expect(findProductOption(products, productOptionLabel(products[0]))?.id).toBe("cloud");
    expect(findProductOption(products, "unknown")).toBeUndefined();
  });

  it("uses a category cascade in Solution Design while preserving Quotation and Proposal search", () => {
    const presales = readFileSync("components/presales-forms.tsx", "utf8");
    const quotation = readFileSync("components/workflow-forms.tsx", "utf8");
    const proposal = readFileSync("components/proposal-forms.tsx", "utf8");
    const control = readFileSync("components/searchable-product-select.tsx", "utf8");
    expect(presales).toContain("product.serviceCategoryCode===category?.code");
    expect(presales).toContain('disabled={!categoryId}');
    expect(presales).not.toContain("<SearchableProductSelect");
    expect(quotation).toContain("<SearchableProductSelect");
    expect(proposal).toContain("filterProductOptions(products,query,50)");
    expect(control).toContain('role="combobox"');
    expect(control).toContain("<datalist");
  });
});
