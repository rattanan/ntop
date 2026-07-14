import { createHmac, randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import type { Prisma } from "@prisma/client";

import type { AuditWriter } from "../audit/audit-writer";

type Tx = Prisma.TransactionClient;
type Repository = { transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> };
type LoginContext = { ipAddress?: string | null; userAgent?: string | null; correlationId?: string };

export class LoginService {
  constructor(private readonly repository: Repository, private readonly audit: AuditWriter<Tx>, private readonly hashingSecret: string) {
    if (hashingSecret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  }

  private fingerprint(value: string) { return createHmac("sha256", this.hashingSecret).update(value).digest("hex"); }

  async authenticate(emailInput: string, password: string, context: LoginContext = {}) {
    const email = emailInput.trim().toLowerCase();
    const correlationId = context.correlationId ?? randomUUID();
    return this.repository.transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, role: true, active: true, passwordHash: true } });
      const validPassword = user ? await compare(password, user.passwordHash) : false;
      const outcome = !user || !validPassword ? "INVALID_CREDENTIALS" : user.active ? "SUCCESS" : "DISABLED";
      const identifierHash = this.fingerprint(email);
      await tx.loginEvent.create({ data: { userId: user?.id ?? null, identifierHash, outcome, ipAddressHash: context.ipAddress ? this.fingerprint(context.ipAddress) : null, userAgentHash: context.userAgent ? this.fingerprint(context.userAgent) : null, correlationId } });
      await this.audit.append({ actorId: user?.id ?? "anonymous", action: "identity.login", targetType: "User", targetId: user?.id ?? identifierHash, outcome: outcome === "SUCCESS" ? "SUCCESS" : "DENIED", correlationId, reason: outcome }, { transaction: tx });
      if (outcome !== "SUCCESS" || !user) return null;
      return { id: user.id, email: user.email, name: user.name, role: user.role };
    });
  }
}
