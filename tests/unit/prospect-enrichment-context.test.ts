import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

import {
  buildProspectEnrichmentContext,
  extractProspectDocumentText,
  MAX_ENRICHMENT_CONTEXT_CHARACTERS,
} from "../../lib/prospect/prospect-enrichment-context";
import {
  parseProspectEnrichmentOutput,
  ProspectEnrichmentService,
} from "../../lib/prospect/prospect-enrichment-service";
import { PERMISSIONS } from "../../lib/authorization/permission-policy";

const now = new Date("2026-08-23T01:00:00.000Z");

function tinyPdf(text: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${text.length + 36} >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function prospectRecord() {
  return {
    id: "prospect-1",
    prospectCode: "PR-1",
    companyName: "Example Co",
    companyNameEnglish: null,
    customerType: null,
    organizationType: null,
    subIndustry: null,
    companySize: null,
    numberOfEmployees: 100,
    estimatedAnnualRevenue: null,
    website: "https://example.test",
    companyDescription: "Enterprise network prospect",
    province: "Bangkok",
    region: "Central",
    currentTelecomProvider: null,
    currentInternetProvider: null,
    currentCloudProvider: null,
    currentSecurityProvider: null,
    existingSolutions: null,
    currentContractEndDate: null,
    numberOfBranches: 4,
    businessPainPoints: "Needs resilient connectivity",
    expectedBudget: null,
    expectedPurchasePeriod: null,
    estimatedOpportunityValue: null,
    currency: "THB",
    procurementMethod: null,
    projectType: null,
    source: "OTHER",
    sourceName: null,
    referralName: null,
    lastContactAt: null,
    nextFollowUpAt: null,
    followUpStatus: null,
    contactAttemptCount: 1,
    status: "NEW",
    calculatedScore: 10,
    heatLevel: "COLD",
    recommendedProducts: null,
    notes: null,
    industry: { code: "FIN", name: "Finance" },
    contacts: [{
      id: "contact-1",
      name: "Contact One",
      position: "CIO",
      department: "IT",
      phone: "02-secret",
      mobile: "08-secret",
      email: "private@example.test",
      lineId: "private-line",
      preferredContactChannel: "EMAIL",
      isPrimary: true,
    }],
    activities: [{
      id: "activity-1",
      subject: "Discovery call",
      type: "CALL",
      statusCode: "OPEN",
      description: "Discussed backup circuit",
      notes: "Customer needs two independent routes",
      aiSummary: null,
      actionItems: null,
      outcome: "Interested",
      completionOutcome: null,
      customerFeedback: "Send topology",
      nextAction: "Prepare design",
      activityAt: now,
      dueAt: null,
      completedAt: null,
      nextFollowUpAt: null,
      createdAt: now,
    }],
    documents: [{
      id: "document-1",
      objectKey: "prospects/prospect-1/hash/requirements.txt",
      fileName: "requirements.txt",
      mimeType: "text/plain",
      sizeBytes: 35,
      category: "REQUIREMENT",
      createdAt: now,
    }],
  };
}

describe("Prospect enrichment context", () => {
  it("combines scoped prospect, contact, activity, and uploaded-document evidence", async () => {
    const storage = {
      read: vi.fn(async () => new TextEncoder().encode("Require redundant links in 9 months")),
      put: vi.fn(),
      remove: vi.fn(),
      assertClean: vi.fn(),
    };
    const result = await buildProspectEnrichmentContext(prospectRecord() as never, storage);
    const serialized = JSON.stringify(result.input);

    expect(result.input.contacts[0]).toMatchObject({
      name: "Contact One",
      position: "CIO",
      contactChannelAvailability: { phone: true, mobile: true, email: true, line: true },
    });
    expect(serialized).not.toContain("02-secret");
    expect(serialized).not.toContain("private@example.test");
    expect(result.input.activities[0]).toMatchObject({ subject: "Discovery call", outcome: "Interested" });
    expect(result.input.documents[0]).toMatchObject({
      id: "document-1",
      extractionStatus: "EXTRACTED",
      content: "Require redundant links in 9 months",
    });
    expect(result.sourceReferences).toEqual([
      { type: "Prospect", id: "prospect-1" },
      { type: "ProspectContact", id: "contact-1" },
      { type: "Activity", id: "activity-1" },
      { type: "SalesDocument", id: "document-1" },
    ]);
    expect(serialized.length).toBeLessThan(MAX_ENRICHMENT_CONTEXT_CHARACTERS);
  });

  it("extracts DOCX text while ignoring embedded markup", async () => {
    const archive = new JSZip();
    archive.file("word/document.xml", "<w:document><w:p><w:r><w:t>Business &amp; technical needs</w:t></w:r></w:p></w:document>");
    const bytes = await archive.generateAsync({ type: "uint8array" });

    await expect(extractProspectDocumentText(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes,
    )).resolves.toBe("Business & technical needs");
  });

  it("extracts text from an uploaded PDF", async () => {
    await expect(extractProspectDocumentText(
      "application/pdf",
      tinyPdf("Prospect requirement"),
    )).resolves.toContain("Prospect requirement");
  });

  it("keeps worst-case related context within the provider character budget", async () => {
    const base = prospectRecord();
    const huge = "x".repeat(10_000);
    const record = {
      ...base,
      companyDescription: huge,
      businessPainPoints: huge,
      notes: huge,
      contacts: Array.from({ length: 20 }, (_, index) => ({
        ...base.contacts[0],
        id: `contact-${index}`,
        name: huge,
        position: huge,
        department: huge,
      })),
      activities: Array.from({ length: 50 }, (_, index) => ({
        ...base.activities[0],
        id: `activity-${index}`,
        subject: huge,
        description: huge,
        notes: huge,
        actionItems: huge,
        outcome: huge,
        completionOutcome: huge,
        customerFeedback: huge,
        nextAction: huge,
      })),
      documents: Array.from({ length: 10 }, (_, index) => ({
        ...base.documents[0],
        id: `document-${index}`,
        objectKey: `prospects/prospect-1/hash/document-${index}.txt`,
        fileName: `${huge.slice(0, 250)}-${index}.txt`,
        sizeBytes: 5_000,
      })),
    };
    const storage = {
      read: vi.fn(async () => new TextEncoder().encode(huge)),
      put: vi.fn(),
      remove: vi.fn(),
      assertClean: vi.fn(),
    };

    const result = await buildProspectEnrichmentContext(record as never, storage);

    expect(JSON.stringify(result.input).length).toBeLessThanOrEqual(MAX_ENRICHMENT_CONTEXT_CHARACTERS);
  });
});

describe("Prospect enrichment provider output", () => {
  it("accepts fenced JSON and normalizes bounded scores and list fields", () => {
    const parsed = parseProspectEnrichmentOutput(`\`\`\`json
      {"companySummary":"Summary","businessClassification":"Enterprise","estimatedCompanySize":"Large","potentialBusinessNeeds":"Connectivity","recommendedProducts":["SD-WAN"],"opportunityScore":"105%","riskScore":-5,"confidenceScore":"72.4","suggestedDiscoveryQuestions":"When?","suggestedNextAction":"Call","suggestedContactStrategy":"Email","missingInformation":null}
    \`\`\``);

    expect(parsed).toMatchObject({
      potentialBusinessNeeds: ["Connectivity"],
      opportunityScore: 100,
      riskScore: 0,
      confidenceScore: 72,
      suggestedDiscoveryQuestions: ["When?"],
      missingInformation: [],
    });
  });
});

describe("ProspectEnrichmentService", () => {
  it("authorizes the scoped context and records READY provenance before human confirmation", async () => {
    const transaction = { prospect: { update: vi.fn(async () => ({ version: 1 })) } };
    const repository = {
      transaction: vi.fn(async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction)),
      findEnrichmentContext: vi.fn(async () => prospectRecord()),
    };
    const output = {
      companySummary: "สรุป",
      businessClassification: "Enterprise",
      estimatedCompanySize: "100 employees",
      potentialBusinessNeeds: ["Resilient connectivity"],
      recommendedProducts: ["SD-WAN"],
      opportunityScore: 80,
      riskScore: 20,
      confidenceScore: 75,
      suggestedDiscoveryQuestions: ["When is the contract due?"],
      suggestedNextAction: "Schedule workshop",
      suggestedContactStrategy: "Contact primary CIO",
      missingInformation: [],
    };
    const provider = { enrich: vi.fn(async () => ({ data: output, providerVersionId: "provider-v1", model: "model-1" })) };
    const audit = { append: vi.fn(async () => undefined) };
    const storage = {
      read: vi.fn(async () => new TextEncoder().encode("Document requirement")),
      put: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      assertClean: vi.fn(async () => undefined),
    };
    const actor = {
      id: "user-1",
      permissions: new Set([PERMISSIONS.prospectUpdate]),
      authorization: { actorId: "user-1", organizationUnitIds: [], subordinateUserIds: [] },
    };

    await expect(new ProspectEnrichmentService(
      repository as never,
      audit as never,
      provider,
      storage,
    ).enrich(actor as never, "prospect-1", "corr-1")).resolves.toEqual(output);

    expect(repository.findEnrichmentContext).toHaveBeenCalledWith(
      "prospect-1",
      actor.authorization,
      actor.permissions,
      transaction,
    );
    expect(provider.enrich).toHaveBeenCalledWith(expect.objectContaining({
      contacts: expect.arrayContaining([expect.objectContaining({ id: "contact-1" })]),
      activities: expect.arrayContaining([expect.objectContaining({ id: "activity-1" })]),
      documents: expect.arrayContaining([expect.objectContaining({ id: "document-1", extractionStatus: "EXTRACTED" })]),
    }));
    expect(transaction.prospect.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ enrichmentStatus: "PROCESSING" }),
    }));
    expect(transaction.prospect.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        enrichmentStatus: "READY",
        enrichmentData: expect.objectContaining({
          provenance: expect.objectContaining({ promptTemplateVersion: "prospect-enrichment.v2" }),
        }),
      }),
    }));
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "prospect.enrichment.generate",
        outcome: "SUCCESS",
        data: expect.objectContaining({
          inputSourceReferences: expect.arrayContaining([
            { type: "SalesDocument", id: "document-1" },
          ]),
        }),
      }),
      { transaction },
    );
  });
});
