import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Service Category administration and Solution Design UX contract", () => {
  it("uses Service Category as the Product create source of truth", () => {
    const page = read("app/(portal)/products/new/page.tsx");
    const form = read("components/forms.tsx");
    const action = read("app/actions.ts");
    expect(page).toContain("serviceCategoryConfig.findMany");
    expect(form).toContain('name="serviceCategoryCode"');
    expect(form).not.toContain('name="category"');
    expect(action).toContain("serviceCategoryCode:category.code");
    expect(action).toContain("requiresSiteSurvey:category.requiresSiteSurvey");
  });

  it("keeps public Product and Solution paths compatible while the additive migration rolls out", () => {
    const productPage = read("app/(portal)/products/new/page.tsx");
    const solutionPage = read("app/(portal)/solution-designs/[id]/page.tsx");
    const action = read("app/actions.ts");
    const solutionService = read("lib/solution-design/solution-design-service.ts");

    expect(productPage).not.toContain("serviceCategoryConfig.findMany({where:{active:true,deletedAt:null}");
    expect(solutionPage).not.toContain("serviceCategoryConfig.findMany({ where: { active: true, deletedAt: null }");
    expect(action).not.toContain("serviceCategoryConfig.findFirst({where:{code:p.data.serviceCategoryCode,active:true,deletedAt:null}");
    expect(productPage).toContain("select:{code:true,name:true,requiresSiteSurvey:true,requiresBoq:true}");
    expect(solutionPage).toContain("select: { id: true, code: true, name: true, requiresSiteSurvey: true }");
    expect(action).toContain("select:{code:true,name:true,requiresSiteSurvey:true,requiresBoq:true,requiresPhysicalInstallation:true}");
    expect(solutionService).toContain("select:{id:true,code:true,requiresSiteSurvey:true,requiresBoq:true,requiresPhysicalInstallation:true}");
    expect(solutionService).toContain("select:{code:true}");
  });

  it("keeps Service Category CRUD permissioned, versioned, soft-deleted and audited", () => {
    const service = read("lib/presales/service-category-service.ts");
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260825150000_add_service_category_admin/migration.sql");
    expect(service).toContain("PERMISSIONS.productCatalogManage");
    expect(service).toContain('action: "service-category.create"');
    expect(service).toContain('action: "service-category.update"');
    expect(service).toContain('action: "service-category.delete"');
    expect(service).toContain("version: { increment: 1 }");
    expect(service).toContain("deletedAt: new Date()");
    expect(schema).toMatch(/model ServiceCategoryConfig \{[\s\S]*version\s+Int\s+@default\(1\)/);
    expect(migration).toContain("navigation.admin.service-categories.view");
    expect(migration).toContain("navigation.quotes.view");
    expect(migration).not.toMatch(/DROP|TRUNCATE/i);
  });

  it("filters Catalog Item by selected Service Category in UI and server", () => {
    const form = read("components/presales-forms.tsx");
    const service = read("lib/solution-design/solution-design-service.ts");
    expect(form).toContain("product.serviceCategoryCode===category?.code");
    expect(form).toContain("เลือก Service category ก่อน");
    expect(service).toContain("serviceCategoryCode:category.code");
  });

  it("shows one described Solution panel at a time and can create an idempotent BOQ draft", () => {
    const tabs = read("components/solution-design-tabs.tsx");
    const page = read("app/(portal)/solution-designs/[id]/page.tsx");
    const route = read("app/api/v1/boqs/route.ts");
    const service = read("lib/solution-design/solution-design-service.ts");
    for (const label of ["Services", "Sites", "Components", "Surveys", "BOQ", "Traceability", "Versions"]) expect(tabs).toContain(`label: "${label}"`);
    expect(tabs).toContain('role="tab"');
    expect(tabs).toContain('role="tabpanel"');
    expect(tabs).toContain("hidden={active !== tab.key}");
    expect(page).toContain("<CreateBoqDraftForm");
    expect(route).toContain("presalesIdempotencyKey");
    expect(service).toContain('command:"boq.create-from-solution"');
    expect(service).toContain('action:"boq.create-from-solution"');
  });
});
