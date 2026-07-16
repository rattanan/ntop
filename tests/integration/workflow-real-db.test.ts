import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { AppendOnlyAuditWriter, AuditWriteError, type AuditWriter } from "../../lib/audit/audit-writer";
import { HashChainedAuditStore } from "../../lib/audit/hash-chained-audit-store";
import { PrismaAuditLedgerRepository } from "../../lib/audit/prisma-audit-ledger-repository";
import { ApprovalService } from "../../lib/commercial/approval-service";
import { PrismaApprovalRepository } from "../../lib/commercial/prisma-approval-repository";
import { PrismaQuoteRepository } from "../../lib/commercial/prisma-quote-repository";
import { QuoteService } from "../../lib/commercial/quote-service";
import { CustomerService } from "../../lib/customer/customer-service";
import { PrismaCustomerRepository } from "../../lib/customer/prisma-customer-repository";
import { calculateForecast } from "../../lib/forecast/forecast-calculator";
import { PrismaForecastRepository } from "../../lib/forecast/prisma-forecast-repository";
import { OpportunityService } from "../../lib/opportunity/opportunity-service";
import { PrismaOpportunityRepository } from "../../lib/opportunity/prisma-opportunity-repository";
import { LeadService } from "../../lib/lead/lead-service";
import { PrismaLeadRepository } from "../../lib/lead/prisma-lead-repository";
import { prisma } from "../../lib/prisma";

type Tx = Prisma.TransactionClient;
const run = process.env.RUN_DB_INTEGRATION === "1" ? describe : describe.skip;
const ROLLBACK = new Error("EXPECTED_E2E_ROLLBACK");

function bindTransaction<T extends { transaction: (work: (tx: Tx) => Promise<unknown>) => Promise<unknown> }>(repository: T, tx: Tx): T {
  repository.transaction = ((work: (transaction: Tx) => Promise<unknown>) => work(tx)) as T["transaction"];
  return repository;
}

function auditWriter(): AuditWriter<Tx> {
  return new AppendOnlyAuditWriter<Tx>({ store: new HashChainedAuditStore({ repository: new PrismaAuditLedgerRepository(), maxAttempts: 3 }) });
}

const enterprise = (actorId: string) => ({ actorId, assignments: [{ role: "ADMIN" as const, scope: "ENTERPRISE" as const, organizationUnitId: null }] });

run("MariaDB 5.5 workflow repository integration", () => {
  afterAll(async () => prisma.$disconnect());

  it("rolls back aggregate changes when required audit persistence fails", async () => {
    const marker = `audit-${randomUUID()}`;
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const failedAudit: AuditWriter<Tx> = { append: async () => { throw new AuditWriteError(); } };
    await expect(prisma.$transaction(async (tx) => {
      const service = new CustomerService(bindTransaction(new PrismaCustomerRepository(prisma), tx), failedAudit);
      await service.create({ ...admin, authorization: enterprise(admin.id) }, { name: marker, taxId: String(Date.now()).slice(-13).padStart(13, "0"), type: "B2B", segment: "INTEGRATION", province: "Bangkok", status: "PROSPECT", ownerId: admin.id, organizationUnitId: null }, marker, marker);
    })).rejects.toBeInstanceOf(AuditWriteError);
    expect(await prisma.customer.count({ where: { name: marker } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { correlationId: marker } })).toBe(0);
  }, 60_000);

  it("runs Customer → Opportunity → Pipeline → Quote Version → Approval atomically, idempotently, then rolls everything back", async () => {
    const tag = randomUUID();
    const correlation = `e2e-${tag}`;
    const ids: { customerId?: string; opportunityId?: string; quoteVersionId?: string; requestId?: string } = {};
    await expect(prisma.$transaction(async (tx) => {
      const maker = await tx.user.create({ data: { email: `maker-${tag}@integration.invalid`, name: "Integration Maker", passwordHash: "not-a-login-credential", role: "ADMIN" } });
      const approver = await tx.user.create({ data: { email: `approver-${tag}@integration.invalid`, name: "Integration Approver", passwordHash: "not-a-login-credential", role: "SALES" } });
      await tx.userRoleAssignment.create({ data: { userId: approver.id, roleCode: "TEAM_MANAGER", scopeCode: "ENTERPRISE", effectiveFrom: new Date("2026-01-01T00:00:00Z") } });
      const makerActor = { ...maker, authorization: enterprise(maker.id) };
      const approverActor = { ...approver, authorization: { actorId: approver.id, assignments: [{ role: "TEAM_MANAGER" as const, scope: "ENTERPRISE" as const, organizationUnitId: null }] } };
      const audit = auditWriter();

      const customers = new CustomerService(bindTransaction(new PrismaCustomerRepository(prisma), tx), audit);
      const customerInput = { name: `E2E Customer ${tag}`, taxId: tag.replace(/\D/g, "").slice(0, 13).padEnd(13, "7"), type: "B2B" as const, segment: "ENTERPRISE", province: "Bangkok", status: "PROSPECT" as const, ownerId: maker.id, organizationUnitId: null };
      const customer = await customers.create(makerActor, customerInput, correlation, `customer-${tag}`);
      const sameCustomer = await customers.create(makerActor, customerInput, correlation, `customer-${tag}`);
      expect(sameCustomer.id).toBe(customer.id); ids.customerId = customer.id;

      const opportunities = new OpportunityService(bindTransaction(new PrismaOpportunityRepository(prisma), tx), audit);
      const opportunityInput = { name: `E2E Opportunity ${tag}`, customerId: customer.id, flow: "DIRECT", estimatedValue: "1000.0000", currency: "THB", probability: 60, forecastCategory: "PIPELINE" as const, expectedCloseAt: new Date("2026-09-15T00:00:00Z"), organizationUnitId: null, ownerId: maker.id, nextAction: "Prepare solution", requirements: "Integration requirements", qualificationResult: "Qualified", stakeholderSummary: "Sponsor confirmed", assessment: { incumbentVendor: null, competitors: null, approach: "DIRECT" as const, confidence: 80, rationale: "Integration path" } };
      const opportunity = await opportunities.create(makerActor, opportunityInput, correlation, `opportunity-${tag}`);
      const sameOpportunity = await opportunities.create(makerActor, opportunityInput, correlation, `opportunity-${tag}`);
      expect(sameOpportunity.id).toBe(opportunity.id); ids.opportunityId = opportunity.id;

      await tx.coverageCheck.create({ data: { opportunityId: opportunity.id, siteAddress: "Integration site", status: "CONFIRMED", confirmedCost: "100.0000" } });
      await tx.solutionDesign.create({ data: { opportunityId: opportunity.id, ntWorkValue: "100.0000", partnerCost: "100.0000", estimatedCost: "200.0000", estimatedPrice: "1000.0000", marginPct: "80.0000" } });
      const product = await tx.product.create({ data: { code: `E2E-${tag}`, name: "Integration Product", category: "INTEGRATION", listPrice: "1000.0000", standardCost: "200.0000", costConfirmedAt: new Date("2026-07-14T00:00:00Z") } });

      const forecasts = bindTransaction(new PrismaForecastRepository(prisma), tx);
      const facts = await forecasts.listFacts({ context: makerActor.authorization, periodStart: new Date("2026-09-01T00:00:00Z"), periodEnd: new Date("2026-10-01T00:00:00Z"), cutoffAt: new Date("2026-12-01T00:00:00Z") }, tx);
      const pipeline = calculateForecast(facts.filter((fact) => fact.opportunityId === opportunity.id));
      expect(pipeline.pipelineAmount.toFixed(4)).toBe("1000.0000"); expect(pipeline.weightedAmount.toFixed(4)).toBe("600.0000");

      const quotes = new QuoteService(bindTransaction(new PrismaQuoteRepository(prisma), tx), audit, undefined, () => new Date("2026-07-14T00:00:00Z"));
      const draft = { opportunityId: opportunity.id, currency: "THB", items: [{ productId: product.id, quantity: "1.0000" }] };
      const version = await quotes.createVersion(makerActor, draft, correlation, `quote-${tag}`);
      const sameVersion = await quotes.createVersion(makerActor, draft, correlation, `quote-${tag}`);
      expect(sameVersion.id).toBe(version.id); ids.quoteVersionId = version.id;
      const submitted = await quotes.submit(makerActor, version.id, correlation, `submit-${tag}`);
      const sameSubmission = await quotes.submit(makerActor, version.id, correlation, `submit-${tag}`);
      expect(sameSubmission.requestId).toBe(submitted.requestId); ids.requestId = submitted.requestId;

      const request = await tx.approvalRequest.findUniqueOrThrow({ where: { id: submitted.requestId }, include: { steps: true } });
      const approvals = new ApprovalService(bindTransaction(new PrismaApprovalRepository(prisma), tx), audit, () => new Date());
      const decisionInput = { requestId: request.id, stepId: request.steps[0].id, action: "APPROVE" as const, reason: "Integration approval", expectedVersion: request.version };
      const decision = await approvals.decide(approverActor, decisionInput, correlation, `approval-${tag}`);
      const sameDecision = await approvals.decide(approverActor, decisionInput, correlation, `approval-${tag}`);
      expect(sameDecision.decisionId).toBe(decision.decisionId);
      expect((await tx.approvalRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("APPROVED");
      expect(await tx.auditEvent.count({ where: { correlationId: correlation } })).toBeGreaterThanOrEqual(5);
      throw ROLLBACK;
    }, { maxWait: 10_000, timeout: 60_000 })).rejects.toBe(ROLLBACK);

    expect(await prisma.customer.count({ where: { id: ids.customerId } })).toBe(0);
    expect(await prisma.opportunity.count({ where: { id: ids.opportunityId } })).toBe(0);
    expect(await prisma.quoteVersion.count({ where: { id: ids.quoteVersionId } })).toBe(0);
    expect(await prisma.approvalRequest.count({ where: { id: ids.requestId } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { correlationId: correlation } })).toBe(0);
    expect(await prisma.commercialCommandReceipt.count({ where: { idempotencyKey: { contains: tag } } })).toBe(0);
  }, 90_000);

  it("updates and converts a Lead into Customer atomically and idempotently, then rolls everything back", async () => {
    const tag = randomUUID();
    const correlation = `lead-e2e-${tag}`;
    const ids: { leadId?: string; customerId?: string; contactId?: string; opportunityId?: string } = {};
    await expect(prisma.$transaction(async (tx) => {
      const admin = await tx.user.findFirstOrThrow({ where: { role: "ADMIN" } });
      const currentActor = { ...admin, authorization: enterprise(admin.id) };
      const leads = new LeadService(
        bindTransaction(new PrismaLeadRepository(prisma), tx),
        bindTransaction(new PrismaCustomerRepository(prisma), tx),
        auditWriter(),
      );
      const lead = await leads.create(currentActor, {
        company: `Lead E2E ${tag}`,
        contactName: "Lead Contact",
        contactEmail: `lead-${tag}@integration.invalid`,
        source: "REFERRAL",
        status: "QUALIFIED",
        score: 85,
        recommendedProducts: "Integration Network Service",
      }, correlation, `lead-create-${tag}`);
      ids.leadId = lead.id;
      const sameLead = await leads.create(currentActor, {
        company: `Lead E2E ${tag}`,
        contactName: "Lead Contact",
        contactEmail: `lead-${tag}@integration.invalid`,
        source: "REFERRAL",
        status: "QUALIFIED",
        score: 85,
        recommendedProducts: "Integration Network Service",
      }, correlation, `lead-create-${tag}`);
      expect(sameLead.id).toBe(lead.id);
      const conversionInput = {
        expectedVersion: lead.version,
        conversionMode: "CREATE" as const,
        taxId: String(Date.now()).slice(-13).padStart(13, "7"),
        type: "B2B" as const,
        segment: "B1",
        province: "Bangkok",
        opportunityName: `Lead Opportunity ${tag}`,
        opportunityFlow: "DIRECT",
        estimatedValue: "100000.0000",
        expectedCloseAt: new Date("2026-12-15T00:00:00Z"),
        probability: 40,
        productInterest: "Integration Network Service",
      };
      const converted = await leads.convert(currentActor, lead.id, conversionInput, correlation, `lead-convert-${tag}`);
      ids.customerId = converted.customerId;
      ids.contactId = converted.contactId;
      ids.opportunityId = converted.opportunityId;
      const sameConversion = await leads.convert(currentActor, lead.id, conversionInput, correlation, `lead-convert-${tag}`);
      expect(sameConversion.customerId).toBe(converted.customerId);
      expect((await tx.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("CONVERTED");
      expect(await tx.auditEvent.count({ where: { correlationId: correlation } })).toBe(3);
      throw ROLLBACK;
    }, { maxWait: 10_000, timeout: 60_000 })).rejects.toBe(ROLLBACK);
    expect(await prisma.lead.count({ where: { id: ids.leadId } })).toBe(0);
    expect(await prisma.customer.count({ where: { id: ids.customerId } })).toBe(0);
    expect(await prisma.contact.count({ where: { id: ids.contactId } })).toBe(0);
    expect(await prisma.opportunity.count({ where: { id: ids.opportunityId } })).toBe(0);
    expect(await prisma.leadCommandReceipt.count({ where: { leadId: ids.leadId } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { correlationId: correlation } })).toBe(0);
  }, 90_000);

  it("applies an owner assignment rule with SLA and histories in the Lead transaction", async () => {
    const tag = randomUUID();
    const correlation = `lead-rule-e2e-${tag}`;
    const ids: { leadId?: string } = {};
    await expect(prisma.$transaction(async tx => {
      const admin = await tx.user.findFirstOrThrow({ where: { role: "ADMIN" } });
      const target = await tx.user.create({ data: { email: `rule-target-${tag}@integration.invalid`, name: "Rule Target", passwordHash: "not-a-login-credential", role: "SALES" } });
      await tx.leadAssignmentRule.create({ data: { name: `Integration rule ${tag}`, priority: -1, active: true, strategy: "OWNER", criteria: { source: "GOVERNMENT_TENDER" }, targetOwnerId: target.id } });
      const service = new LeadService(bindTransaction(new PrismaLeadRepository(prisma), tx), bindTransaction(new PrismaCustomerRepository(prisma), tx), auditWriter());
      const lead = await service.create({ ...admin, authorization: enterprise(admin.id) }, { company: `Rule Lead ${tag}`, contactName: "Rule Contact", contactEmail: `rule-${tag}@integration.invalid`, source: "GOVERNMENT_TENDER", status: "NEW", score: 80, recommendedProducts: "Configured product" }, correlation, `lead-rule-${tag}`);
      ids.leadId = lead.id;
      const stored = await tx.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(stored.ownerId).toBe(target.id);
      expect(stored.status).toBe("ASSIGNED");
      expect(stored.assignedAt).not.toBeNull();
      expect(stored.firstContactDueAt?.getTime()).toBe((stored.assignedAt?.getTime() ?? 0) + 4 * 3_600_000);
      expect(await tx.leadAssignmentHistory.count({ where: { leadId: lead.id, toOwnerId: target.id } })).toBe(1);
      expect(await tx.leadStatusHistory.count({ where: { leadId: lead.id, fromStatus: "NEW", toStatus: "ASSIGNED", correlationId: correlation } })).toBe(1);
      throw ROLLBACK;
    }, { maxWait: 10_000, timeout: 60_000 })).rejects.toBe(ROLLBACK);
    expect(await prisma.lead.count({ where: { id: ids.leadId } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { correlationId: correlation } })).toBe(0);
  }, 90_000);

  it("creates multiple Customer contacts with one primary, audit and idempotency, then rolls everything back", async () => {
    const tag = randomUUID();
    const correlation = `contact-e2e-${tag}`;
    const ids: { customerId?: string; firstContactId?: string; secondContactId?: string } = {};
    await expect(prisma.$transaction(async (tx) => {
      const admin = await tx.user.findFirstOrThrow({ where: { role: "ADMIN" } });
      const currentActor = { ...admin, authorization: enterprise(admin.id) };
      const customers = new CustomerService(bindTransaction(new PrismaCustomerRepository(prisma), tx), auditWriter());
      const customer = await customers.create(currentActor, { name: `Contact E2E ${tag}`, taxId: String(Date.now()).slice(-13).padStart(13, "6"), type: "B2B", segment: "B1", province: "Bangkok", status: "PROSPECT", ownerId: admin.id, organizationUnitId: null }, correlation, `customer-${tag}`);
      ids.customerId = customer.id;
      const first = await customers.createContact(currentActor, customer.id, customer.version, { name: "Commercial Contact", email: `commercial-${tag}@integration.invalid`, relationship: "Decision Maker", purpose: "Commercial", isPrimary: true }, correlation, `contact-first-${tag}`);
      ids.firstContactId = first.id;
      const second = await customers.createContact(currentActor, customer.id, first.customerVersion, { name: "Technical Contact", phone: "021234567", relationship: "Technical Influencer", purpose: "Technical", isPrimary: true }, correlation, `contact-second-${tag}`);
      ids.secondContactId = second.id;
      const sameSecond = await customers.createContact(currentActor, customer.id, first.customerVersion, { name: "Technical Contact" }, correlation, `contact-second-${tag}`);
      expect(sameSecond.id).toBe(second.id);
      const contacts = await tx.contact.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "asc" } });
      expect(contacts).toHaveLength(2);
      expect(contacts.find((contact) => contact.id === first.id)?.isPrimary).toBe(false);
      expect(contacts.find((contact) => contact.id === second.id)?.isPrimary).toBe(true);
      expect(await tx.auditEvent.count({ where: { correlationId: correlation } })).toBe(3);
      throw ROLLBACK;
    }, { maxWait: 10_000, timeout: 60_000 })).rejects.toBe(ROLLBACK);
    expect(await prisma.customer.count({ where: { id: ids.customerId } })).toBe(0);
    expect(await prisma.contact.count({ where: { id: { in: [ids.firstContactId ?? "", ids.secondContactId ?? ""] } } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { correlationId: correlation } })).toBe(0);
  }, 90_000);
});
