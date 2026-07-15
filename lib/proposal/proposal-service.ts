import type { AuthorizationContext } from "../authorization/authorization-context";
import {
  assertPermission,
  PERMISSIONS,
  PermissionDeniedError,
  type Permission,
  type PermissionPolicy,
  permissionPolicy,
} from "../authorization/permission-policy";
import type { AuditWriter } from "../audit/audit-writer";
import type { AuditJsonValue } from "../audit/redact-audit-data";
import {
  defaultProposalSections,
  type ProposalCreateInput,
  type ProposalEditInput,
  type ProposalSectionInput,
} from "./contracts";

export type ProposalActor = {
  id: string;
  role: "ADMIN" | "SALES" | "VIEWER";
  authorization: AuthorizationContext;
};

export type ProposalRecord = {
  id: string;
  proposalNo: string;
  opportunityId: string;
  customerId: string;
  ownerId: string;
  version: number;
  statusCode: string;
  terminal: boolean;
  name: string;
  description: string | null;
  expireDate: Date | null;
  tags: string[];
  templateVersionId: string | null;
  latestVersionId: string;
  sections: ProposalSectionInput[];
};

type ProposalStatusRecord = {
  code: string;
  terminal: boolean;
  allowedTransitions: string[];
};

export interface ProposalRepository<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
  findReceipt(actorId: string, key: string, command: string, transaction: TTransaction): Promise<{ proposalId: string; resultVersion: number } | null>;
  saveReceipt(input: { actorId: string; idempotencyKey: string; command: string; proposalId: string; resultVersion: number }, transaction: TTransaction): Promise<void>;
  findOpportunity(input: { id: string; context: AuthorizationContext }, transaction: TTransaction): Promise<{ id: string; customerId: string } | null>;
  findInitialStatus(transaction: TTransaction): Promise<ProposalStatusRecord | null>;
  findStatus(code: string, transaction: TTransaction): Promise<ProposalStatusRecord | null>;
  findTransition(fromStatusCode: string, toStatusCode: string, transaction: TTransaction): Promise<{ requiredPermission: string | null; makerChecker: boolean } | null>;
  actorHasPermission(actor: ProposalActor, permissionCode: string, transaction: TTransaction): Promise<boolean>;
  findTemplate(templateId: string, transaction: TTransaction): Promise<{ versionId: string; sections: ProposalSectionInput[] } | null>;
  nextProposalNumber(now: Date, transaction: TTransaction): Promise<string>;
  create(input: { actorId: string; proposalNo: string; opportunityId: string; customerId: string; statusCode: string; draft: ProposalCreateInput; templateVersionId: string | null; sections: ProposalSectionInput[] }, transaction: TTransaction): Promise<ProposalRecord>;
  find(input: { id: string; actorId: string; context: AuthorizationContext }, transaction: TTransaction): Promise<ProposalRecord | null>;
  findVersion(input: { proposalId: string; versionNumber: number; actorId: string; context: AuthorizationContext }, transaction: TTransaction): Promise<ProposalRecord | null>;
  createVersion(input: { proposal: ProposalRecord; expectedVersion: number; actorId: string; name: string; description: string | null; expireDate: Date | null; tags: string[]; statusCode: string; templateVersionId: string | null; restoredFromVersionId?: string; sections: ProposalSectionInput[]; ai?: { providerConfigurationVersionId: string; providerModel: string; promptTemplateVersion: string; inputSourceReferences: Array<{ type: string; id: string }> } }, transaction: TTransaction): Promise<ProposalRecord | null>;
  softDelete(input: { proposal: ProposalRecord; actorId: string; deletedAt: Date }, transaction: TTransaction): Promise<void>;
}

export class ProposalAccessError extends Error {
  constructor() { super("Proposal is not available."); this.name = "ProposalAccessError"; }
}
export class ProposalConfigurationError extends Error {
  constructor() { super("Proposal workflow configuration is unavailable."); this.name = "ProposalConfigurationError"; }
}
export class ProposalVersionConflictError extends Error {
  constructor() { super("Proposal version is stale."); this.name = "ProposalVersionConflictError"; }
}
export class ProposalTransitionError extends Error {
  constructor() { super("Proposal status transition is not allowed."); this.name = "ProposalTransitionError"; }
}
export class ProposalTerminalError extends Error {
  constructor() { super("Terminal Proposal cannot be changed."); this.name = "ProposalTerminalError"; }
}

export class ProposalService<TTransaction> {
  constructor(
    private readonly repository: ProposalRepository<TTransaction>,
    private readonly auditWriter: AuditWriter<TTransaction>,
    private readonly permissions: PermissionPolicy = permissionPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(actor: ProposalActor, draft: ProposalCreateInput, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.proposalManage, this.permissions);
    return this.repository.transaction(async (transaction) => {
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "proposal.create", transaction);
      if (receipt) {
        const existing = await this.repository.find({ id: receipt.proposalId, actorId: actor.id, context: actor.authorization }, transaction);
        if (!existing) throw new ProposalAccessError();
        return existing;
      }
      const [opportunity, initialStatus] = await Promise.all([
        this.repository.findOpportunity({ id: draft.opportunityId, context: actor.authorization }, transaction),
        this.repository.findInitialStatus(transaction),
      ]);
      if (!opportunity) throw new ProposalAccessError();
      if (!initialStatus) throw new ProposalConfigurationError();
      const template = draft.templateId ? await this.repository.findTemplate(draft.templateId, transaction) : null;
      if (draft.templateId && !template) throw new ProposalAccessError();
      const sections = draft.sections ?? template?.sections ?? defaultProposalSections();
      const proposalNo = await this.repository.nextProposalNumber(this.now(), transaction);
      const created = await this.repository.create({ actorId: actor.id, proposalNo, opportunityId: opportunity.id, customerId: opportunity.customerId, statusCode: initialStatus.code, draft, templateVersionId: template?.versionId ?? null, sections }, transaction);
      await this.auditWriter.append({ actorId: actor.id, action: "proposal.create", targetType: "Proposal", targetId: created.id, targetVersion: "1", outcome: "SUCCESS", correlationId, data: { opportunityId: opportunity.id, customerId: opportunity.customerId } }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "proposal.create", proposalId: created.id, resultVersion: 1 }, transaction);
      return created;
    });
  }

  async edit(actor: ProposalActor, proposalId: string, draft: ProposalEditInput, correlationId: string, idempotencyKey: string) {
    return this.createContentVersion(actor, proposalId, { ...draft, description: draft.description ?? null, expireDate: draft.expireDate ? new Date(draft.expireDate) : null }, "proposal.edit", correlationId, idempotencyKey);
  }

  async restore(actor: ProposalActor, proposalId: string, input: { expectedVersion: number; sourceVersionNumber: number }, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.proposalManage, this.permissions);
    return this.repository.transaction(async (transaction) => {
      const replay = await this.replay(actor, proposalId, idempotencyKey, "proposal.restore", transaction);
      if (replay) return replay;
      const [current, source] = await Promise.all([
        this.repository.find({ id: proposalId, actorId: actor.id, context: actor.authorization }, transaction),
        this.repository.findVersion({ proposalId, versionNumber: input.sourceVersionNumber, actorId: actor.id, context: actor.authorization }, transaction),
      ]);
      if (!current || !source) throw new ProposalAccessError();
      this.assertMutable(current, input.expectedVersion);
      const created = await this.repository.createVersion({ proposal: current, expectedVersion: input.expectedVersion, actorId: actor.id, name: source.name, description: source.description, expireDate: source.expireDate, tags: source.tags, statusCode: current.statusCode, templateVersionId: source.templateVersionId, restoredFromVersionId: source.latestVersionId, sections: source.sections }, transaction);
      if (!created) throw new ProposalVersionConflictError();
      await this.record(actor.id, "proposal.restore", created, correlationId, { sourceVersionNumber: input.sourceVersionNumber }, idempotencyKey, transaction);
      return created;
    });
  }

  async transition(actor: ProposalActor, proposalId: string, input: { expectedVersion: number; toStatusCode: string; comment: string }, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.proposalManage, this.permissions);
    return this.repository.transaction(async (transaction) => {
      const replay = await this.replay(actor, proposalId, idempotencyKey, "proposal.transition", transaction);
      if (replay) return replay;
      const proposal = await this.repository.find({ id: proposalId, actorId: actor.id, context: actor.authorization }, transaction);
      if (!proposal) throw new ProposalAccessError();
      this.assertMutable(proposal, input.expectedVersion);
      const [from, to, transition] = await Promise.all([this.repository.findStatus(proposal.statusCode, transaction), this.repository.findStatus(input.toStatusCode, transaction), this.repository.findTransition(proposal.statusCode, input.toStatusCode, transaction)]);
      if (!from || !to) throw new ProposalConfigurationError();
      if (!transition || !from.allowedTransitions.includes(to.code)) throw new ProposalTransitionError();
      if (transition.makerChecker && proposal.ownerId === actor.id) throw new ProposalTransitionError();
      if (transition.requiredPermission) {
        const permission = Object.values(PERMISSIONS).find((value): value is Permission => value === transition.requiredPermission);
        if (!permission) throw new ProposalConfigurationError();
        const allowedByLegacyRole = this.permissions.allows(actor, permission);
        if (!allowedByLegacyRole && !(await this.repository.actorHasPermission(actor, permission, transaction))) throw new PermissionDeniedError(permission);
      }
      const created = await this.repository.createVersion({ proposal, expectedVersion: input.expectedVersion, actorId: actor.id, name: proposal.name, description: proposal.description, expireDate: proposal.expireDate, tags: proposal.tags, statusCode: to.code, templateVersionId: proposal.templateVersionId, sections: proposal.sections }, transaction);
      if (!created) throw new ProposalVersionConflictError();
      await this.record(actor.id, "proposal.transition", created, correlationId, { fromStatusCode: from.code, toStatusCode: to.code, comment: input.comment }, idempotencyKey, transaction);
      return created;
    });
  }

  async createAiVersion(actor: ProposalActor, proposalId: string, input: { expectedVersion: number; sections: ProposalSectionInput[]; providerConfigurationVersionId: string; providerModel: string; promptTemplateVersion: string; inputSourceReferences: Array<{ type: string; id: string }> }, correlationId: string, idempotencyKey: string) {
    return this.createContentVersion(actor, proposalId, { expectedVersion: input.expectedVersion, sections: input.sections, ai: input }, "proposal.ai-generate", correlationId, idempotencyKey);
  }

  async softDelete(actor: ProposalActor, proposalId: string, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.proposalManage, this.permissions);
    return this.repository.transaction(async (transaction) => {
      const replay = await this.replay(actor, proposalId, idempotencyKey, "proposal.soft-delete", transaction);
      if (replay) return replay;
      const proposal = await this.repository.find({ id: proposalId, actorId: actor.id, context: actor.authorization }, transaction);
      if (!proposal) throw new ProposalAccessError();
      await this.repository.softDelete({ proposal, actorId: actor.id, deletedAt: this.now() }, transaction);
      await this.auditWriter.append({ actorId: actor.id, action: "proposal.soft-delete", targetType: "Proposal", targetId: proposal.id, targetVersion: String(proposal.version), outcome: "SUCCESS", correlationId }, { transaction });
      await this.repository.saveReceipt({ actorId: actor.id, idempotencyKey, command: "proposal.soft-delete", proposalId, resultVersion: proposal.version }, transaction);
      return proposal;
    });
  }

  private async createContentVersion(actor: ProposalActor, proposalId: string, input: { expectedVersion: number; name?: string; description?: string | null; expireDate?: Date | null; tags?: string[]; sections: ProposalSectionInput[]; ai?: { providerConfigurationVersionId: string; providerModel: string; promptTemplateVersion: string; inputSourceReferences: Array<{ type: string; id: string }> } }, command: string, correlationId: string, idempotencyKey: string) {
    assertPermission(actor, PERMISSIONS.proposalManage, this.permissions);
    return this.repository.transaction(async (transaction) => {
      const replay = await this.replay(actor, proposalId, idempotencyKey, command, transaction);
      if (replay) return replay;
      const proposal = await this.repository.find({ id: proposalId, actorId: actor.id, context: actor.authorization }, transaction);
      if (!proposal) throw new ProposalAccessError();
      this.assertMutable(proposal, input.expectedVersion);
      const created = await this.repository.createVersion({ proposal, expectedVersion: input.expectedVersion, actorId: actor.id, name: input.name ?? proposal.name, description: input.description === undefined ? proposal.description : input.description, expireDate: input.expireDate === undefined ? proposal.expireDate : input.expireDate, tags: input.tags ?? proposal.tags, statusCode: proposal.statusCode, templateVersionId: proposal.templateVersionId, sections: input.sections, ai: input.ai }, transaction);
      if (!created) throw new ProposalVersionConflictError();
      await this.record(actor.id, command, created, correlationId, input.ai ? { providerModel: input.ai.providerModel } : {}, idempotencyKey, transaction);
      return created;
    });
  }

  private assertMutable(proposal: ProposalRecord, expectedVersion: number) {
    if (proposal.version !== expectedVersion) throw new ProposalVersionConflictError();
    if (proposal.terminal) throw new ProposalTerminalError();
  }

  private async replay(actor: ProposalActor, proposalId: string, key: string, command: string, transaction: TTransaction) {
    const receipt = await this.repository.findReceipt(actor.id, key, command, transaction);
    if (!receipt) return null;
    if (receipt.proposalId !== proposalId) throw new ProposalAccessError();
    const proposal = await this.repository.find({ id: proposalId, actorId: actor.id, context: actor.authorization }, transaction);
    if (!proposal) throw new ProposalAccessError();
    return proposal;
  }

  private async record(actorId: string, command: string, proposal: ProposalRecord, correlationId: string, data: AuditJsonValue, idempotencyKey: string, transaction: TTransaction) {
    await this.auditWriter.append({ actorId, action: command, targetType: "Proposal", targetId: proposal.id, targetVersion: String(proposal.version), outcome: "SUCCESS", correlationId, data }, { transaction });
    await this.repository.saveReceipt({ actorId, idempotencyKey, command, proposalId: proposal.id, resultVersion: proposal.version }, transaction);
  }
}
