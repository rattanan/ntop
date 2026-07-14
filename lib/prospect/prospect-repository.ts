import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuthorizationContext } from "../authorization/authorization-context";
import { buildProspectScopeWhere } from "./prospect-authorization";
import { formatProspectCode, normalizeProspectText, normalizeWebsiteDomain } from "./prospect-rules";
import type { ProspectCommand } from "./prospect-validation";

export type ProspectTransaction = Prisma.TransactionClient;
export class PrismaProspectRepository {
  constructor(private readonly client: PrismaClient) {}
  transaction<T>(work: (tx: ProspectTransaction) => Promise<T>) { return this.client.$transaction(work); }
  findAccessible(id: string, context: AuthorizationContext, permissions: ReadonlySet<string>, tx: ProspectTransaction) { return tx.prospect.findFirst({ where: { id, ...buildProspectScopeWhere(context, permissions) }, include: { contacts: { where: { deletedAt: null }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } }); }
  findReceipt(actorId: string, key: string, command: string, tx: ProspectTransaction) { return tx.prospectCommandReceipt.findUnique({ where: { actorId_idempotencyKey_command: { actorId, idempotencyKey: key, command } } }); }
  findDocumentByObjectKeyHash(objectKeyHash: string) { return this.client.salesDocument.findUnique({ where: { objectKeyHash } }); }
  async duplicates(input: ProspectCommand, tx: ProspectTransaction) {
    const normalized = normalizeProspectText(input.companyName), english = input.companyNameEnglish ? normalizeProspectText(input.companyNameEnglish) : null, domain = normalizeWebsiteDomain(input.website), contact = input.contact;
    return tx.prospect.findMany({ where: { deletedAt: null, OR: [{ normalizedCompanyName: normalized }, ...(english ? [{ normalizedCompanyEnglish: english }] : []), ...(input.taxId ? [{ taxId: input.taxId }] : []), ...(domain ? [{ websiteDomain: domain }] : []), ...(contact?.email ? [{ contacts: { some: { email: contact.email, deletedAt: null } } }] : []), ...(contact?.phone ? [{ contacts: { some: { phone: contact.phone, deletedAt: null } } }] : []), ...(contact?.mobile ? [{ contacts: { some: { mobile: contact.mobile, deletedAt: null } } }] : [])] }, select: { id: true, prospectCode: true, companyName: true }, take: 20 });
  }
  async create(input: ProspectCommand, actorId: string, tx: ProspectTransaction) {
    const sequence = await tx.prospectNumberSequence.upsert({ where: { id: "prospect" }, create: { id: "prospect", nextValue: 1 }, update: { nextValue: { increment: 1 } } });
    const { contact, duplicateOverrideReason, ...data } = input; void duplicateOverrideReason;
    return tx.prospect.create({ data: { ...data, companyNameEnglish: data.companyNameEnglish || null, taxId: data.taxId || null, website: data.website || null, normalizedCompanyName: normalizeProspectText(data.companyName), normalizedCompanyEnglish: data.companyNameEnglish ? normalizeProspectText(data.companyNameEnglish) : null, websiteDomain: normalizeWebsiteDomain(data.website), industryId: data.industryId || null, salesTerritoryId: data.salesTerritoryId || null, responsibleBusinessUnitId: data.responsibleBusinessUnitId || null, campaignId: data.campaignId || null, backupOwnerId: data.backupOwnerId || null, salesTeamId: data.salesTeamId || null, salesManagerId: data.salesManagerId || null, estimatedAnnualRevenue: data.estimatedAnnualRevenue || null, expectedBudget: data.expectedBudget || null, estimatedOpportunityValue: data.estimatedOpportunityValue || null, latitude: data.latitude || null, longitude: data.longitude || null, ownerId: actorId, createdById: actorId, updatedById: actorId, prospectCode: formatProspectCode(sequence.nextValue), contacts: contact ? { create: { ...contact, createdById: actorId, updatedById: actorId } } : undefined } });
  }
  async saveReceipt(input: { actorId: string; key: string; command: string; prospectId: string; version: number; resultLeadId?: string }, tx: ProspectTransaction) { await tx.prospectCommandReceipt.create({ data: { actorId: input.actorId, idempotencyKey: input.key, command: input.command, prospectId: input.prospectId, resultVersion: input.version, resultLeadId: input.resultLeadId } }); }
}
