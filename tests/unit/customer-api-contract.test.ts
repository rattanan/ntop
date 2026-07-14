import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");
const collectionRoute = read("app/api/v1/customers/route.ts");
const resourceRoute = read("app/api/v1/customers/[id]/route.ts");
const relationshipRoute = read(
  "app/api/v1/customers/[id]/relationships/route.ts",
);
const mergeRoute = read("app/api/v1/customers/[id]/merge/route.ts");
const apiResponse = read("app/api/v1/customers/api-response.ts");

describe("Customer REST v1 contract", () => {
  it("requires correlation, idempotency and optimistic version inputs", () => {
    expect(collectionRoute).toContain('"idempotency-key"');
    expect(resourceRoute).toContain('"if-match"');
    expect(apiResponse).toContain("VERSION_CONFLICT");
    expect(collectionRoute).toContain("correlationId(request)");
  });

  it("routes all Customer mutations through the application service", () => {
    for (const route of [
      collectionRoute,
      resourceRoute,
      relationshipRoute,
      mergeRoute,
    ]) {
      expect(route).toContain("createCustomerRuntime()");
    }
    expect(collectionRoute).not.toContain("prisma.customer.create");
    expect(resourceRoute).not.toContain("prisma.customer.update");
  });

  it("keeps hierarchy and merge as explicit idempotent commands", () => {
    expect(relationshipRoute).toContain(".addRelationship(");
    expect(relationshipRoute).toContain('"idempotency-key"');
    expect(mergeRoute).toContain(".merge(");
    expect(mergeRoute).toContain('"idempotency-key"');
  });
});
