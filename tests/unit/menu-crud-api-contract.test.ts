import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("menu CRUD API contract", () => {
  it.each([
    ["Activity collection", "app/api/v1/activities/route.ts", ["GET", "POST"]],
    ["Product collection", "app/api/v1/products/route.ts", ["GET", "POST"]],
    ["Product detail", "app/api/v1/products/[id]/route.ts", ["GET", "PATCH", "DELETE"]],
    ["Coverage collection", "app/api/v1/coverage-checks/route.ts", ["GET", "POST"]],
    ["Coverage detail", "app/api/v1/coverage-checks/[id]/route.ts", ["GET", "PATCH", "DELETE"]],
  ])("exposes %s methods", (_label, route, methods) => { const source = read(route); for (const method of methods) expect(source).toContain(`export async function ${method}`); });

  it("uses authenticated scoped actors and domain services", () => {
    for (const route of ["app/api/v1/products/route.ts", "app/api/v1/products/[id]/route.ts", "app/api/v1/coverage-checks/route.ts", "app/api/v1/coverage-checks/[id]/route.ts"]) {
      const source = read(route); expect(source).toContain("catalogActor"); expect(source).toContain("createCatalogRuntime"); expect(source).not.toContain("prisma.");
    }
  });

  it("keeps dashboard and workflow resources command based", () => {
    expect(read("app/api/v1/pipeline/route.ts")).toContain("export async function GET");
    expect(read("app/api/v1/pipeline/route.ts")).not.toMatch(/export async function (POST|PATCH|DELETE)/);
    expect(read("app/api/v1/solution-designs/[id]/transitions/route.ts")).toContain("transitionSolutionDesign");
    expect(read("app/api/v1/boqs/[id]/transitions/route.ts")).toContain("transitionBoq");
  });

  it("adds forward and legacy migrations for versioning and soft delete", () => {
    const schema = read("prisma/schema.prisma"), migration = read("prisma/migrations/20260820213000_add_menu_crud_api_support/migration.sql"), legacy = read("prisma/legacy-mariadb-5.5-menu-crud-api-support.sql");
    for (const source of [schema, migration, legacy]) { expect(source).toContain("PresalesCommandReceipt"); expect(source).toContain("deletedAt"); expect(source).toContain("version"); }
  });
});
