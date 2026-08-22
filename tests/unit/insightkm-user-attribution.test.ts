import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("InsightKM personal-key attribution", () => {
  const auth = read("lib/auth.ts");

  it("resolves a Bearer key to its active NTOP user", () => {
    expect(auth).toContain("apiKeyPrefix(supplied)");
    expect(auth).toContain("where: { apiKeyPrefix: prefix }");
    expect(auth).toContain("verifyUserApiKey(supplied, user.apiKeyHash)");
    expect(auth).toContain("user?.active");
  });

  it("uses the resolved actor for owner and maker fields", () => {
    expect(read("lib/prospect/prospect-repository.ts")).toContain(
      "ownerId: actorId",
    );
    expect(read("lib/lead/lead-service.ts")).toContain("ownerId: actor.id");
    expect(read("app/api/v1/opportunities/route.ts")).toContain(
      "body.ownerId ?? actorId",
    );
    expect(read("lib/commercial/prisma-quote-repository.ts")).toContain(
      "makerId: input.actorId",
    );
  });
});
