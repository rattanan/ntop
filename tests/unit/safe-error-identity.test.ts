import { describe, expect, it } from "vitest";

import { safeErrorIdentity } from "../../lib/api/safe-error-identity";

describe("safe internal error identity", () => {
  it("keeps diagnostic types and codes without exposing messages", () => {
    const databaseError = Object.assign(new Error("SQL and customer details"), { code: "P2034" });
    const error = new Error("Required audit event could not be recorded.", { cause: databaseError });
    error.name = "AuditWriteError";

    const identity = safeErrorIdentity(error);

    expect(identity).toEqual({
      name: "AuditWriteError",
      cause: { name: "Error", code: "P2034" },
    });
    expect(JSON.stringify(identity)).not.toContain("customer details");
  });
});
