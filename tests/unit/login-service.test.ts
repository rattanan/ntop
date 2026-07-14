import { hash } from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { LoginService } from "../../lib/identity/login-service";

const secret = "test-secret-that-is-at-least-32-characters-long";

function setup(user: unknown) {
  const tx = { user: { findUnique: vi.fn().mockResolvedValue(user) }, loginEvent: { create: vi.fn() } };
  const repository = { transaction: vi.fn(async (work: (value: unknown) => Promise<unknown>) => work(tx)) };
  const audit = { append: vi.fn() };
  return { tx, audit, service: new LoginService(repository as never, audit as never, secret) };
}

describe("LoginService", () => {
  it("records a successful login and never persists the raw identifier", async () => {
    const passwordHash = await hash("correct-password", 4);
    const { service, tx, audit } = setup({ id: "u1", email: "user@example.com", name: "User", role: "SALES", active: true, passwordHash });
    const result = await service.authenticate("User@Example.com", "correct-password", { ipAddress: "10.0.0.1", userAgent: "browser", correlationId: "c1" });
    expect(result?.id).toBe("u1");
    const data = tx.loginEvent.create.mock.calls[0][0].data;
    expect(data.outcome).toBe("SUCCESS");
    expect(data.identifierHash).toHaveLength(64);
    expect(JSON.stringify(data)).not.toContain("user@example.com");
    expect(JSON.stringify(data)).not.toContain("10.0.0.1");
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "identity.login", outcome: "SUCCESS" }), { transaction: tx });
  });

  it("uses the same caller result for unknown, wrong-password and disabled accounts", async () => {
    const unknown = setup(null);
    await expect(unknown.service.authenticate("missing@example.com", "bad", { correlationId: "c2" })).resolves.toBeNull();
    expect(unknown.tx.loginEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ outcome: "INVALID_CREDENTIALS", userId: null }) });

    const passwordHash = await hash("correct-password", 4);
    const disabled = setup({ id: "u2", email: "off@example.com", name: "Off", role: "VIEWER", active: false, passwordHash });
    await expect(disabled.service.authenticate("off@example.com", "correct-password", { correlationId: "c3" })).resolves.toBeNull();
    expect(disabled.tx.loginEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ outcome: "DISABLED" }) });
  });
});
