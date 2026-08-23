import ExcelJS from "exceljs";
import JSZip from "jszip";

import type { ProspectDocumentStorage } from "./prospect-document-storage";
import type { ProspectEnrichmentContextRecord } from "./prospect-repository";

export const MAX_ENRICHMENT_CONTEXT_CHARACTERS = 125_000;
const MAX_DOCUMENT_READ_BYTES = 20_000_000;
const MAX_DOCUMENT_TEXT_CHARACTERS = 24_000;

export type ProspectEnrichmentSourceReference = {
  type: "Prospect" | "ProspectContact" | "Activity" | "SalesDocument";
  id: string;
};

type DocumentContext = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  createdAt: string;
  extractionStatus: "EXTRACTED" | "EMPTY" | "UNSUPPORTED" | "UNAVAILABLE" | "SKIPPED_LIMIT";
  content?: string;
};

function cleanText(value: unknown, maximum: number) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  return text ? text.slice(0, maximum) : null;
}

function iso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textFromXml(value: string) {
  return decodeXmlEntities(
    value
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<a:br\b[^>]*\/>/g, "\n")
      .replace(/<\/(?:w:p|a:p|row)>/g, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractZipXml(bytes: Uint8Array, paths: RegExp) {
  const archive = await JSZip.loadAsync(bytes);
  const names = Object.keys(archive.files)
    .filter((name) => paths.test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const text: string[] = [];
  for (const name of names) {
    const file = archive.file(name);
    if (!file) continue;
    text.push(textFromXml(await file.async("string")));
  }
  return text.filter(Boolean).join("\n\n");
}

async function extractSpreadsheetText(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
  const lines: string[] = [];
  for (const worksheet of workbook.worksheets.slice(0, 10)) {
    lines.push(`[Sheet: ${worksheet.name}]`);
    const finalRow = Math.min(worksheet.rowCount, 250);
    for (let rowNumber = 1; rowNumber <= finalRow; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const values: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const value = cleanText(cell.text, 500);
        if (value) values.push(value);
      });
      if (values.length) lines.push(values.join(" | "));
    }
  }
  return lines.join("\n");
}

export async function extractProspectDocumentText(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  if (mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractZipXml(bytes, /^word\/(?:document|header\d+|footer\d+)\.xml$/);
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return extractZipXml(bytes, /^ppt\/slides\/slide\d+\.xml$/);
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return extractSpreadsheetText(bytes);
  }
  return null;
}

async function documentContexts(
  documents: ProspectEnrichmentContextRecord["documents"],
  storage: ProspectDocumentStorage | null,
) {
  let remainingBytes = MAX_DOCUMENT_READ_BYTES;
  let remainingCharacters = MAX_DOCUMENT_TEXT_CHARACTERS;
  const result: DocumentContext[] = [];
  for (const document of documents) {
    const metadata = {
      id: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      category: document.category,
      createdAt: document.createdAt.toISOString(),
    };
    if (!storage) {
      result.push({ ...metadata, extractionStatus: "UNAVAILABLE" });
      continue;
    }
    if (document.sizeBytes > remainingBytes || remainingCharacters <= 0) {
      result.push({ ...metadata, extractionStatus: "SKIPPED_LIMIT" });
      continue;
    }
    remainingBytes -= document.sizeBytes;
    try {
      const extracted = await extractProspectDocumentText(
        document.mimeType,
        await storage.read(document.objectKey),
      );
      if (extracted === null) {
        result.push({ ...metadata, extractionStatus: "UNSUPPORTED" });
        continue;
      }
      const content = cleanText(extracted, remainingCharacters);
      if (!content) {
        result.push({ ...metadata, extractionStatus: "EMPTY" });
        continue;
      }
      remainingCharacters -= content.length;
      result.push({ ...metadata, extractionStatus: "EXTRACTED", content });
    } catch {
      result.push({ ...metadata, extractionStatus: "UNAVAILABLE" });
    }
  }
  return result;
}

export async function buildProspectEnrichmentContext(
  prospect: ProspectEnrichmentContextRecord,
  storage: ProspectDocumentStorage | null,
) {
  const contacts = prospect.contacts.map((contact) => ({
    id: contact.id,
    name: cleanText(contact.name, 255),
    position: cleanText(contact.position, 191),
    department: cleanText(contact.department, 191),
    preferredContactChannel: contact.preferredContactChannel,
    isPrimary: contact.isPrimary,
    contactChannelAvailability: {
      phone: Boolean(contact.phone),
      mobile: Boolean(contact.mobile),
      email: Boolean(contact.email),
      line: Boolean(contact.lineId),
    },
  }));
  let remainingActivityCharacters = 20_000;
  const activities = prospect.activities.map((activity) => {
    const take = (value: unknown, maximum = 1_500) => {
      const result = cleanText(value, Math.min(maximum, remainingActivityCharacters));
      remainingActivityCharacters -= result?.length ?? 0;
      return result;
    };
    return {
      id: activity.id,
      subject: take(activity.subject, 500),
      type: activity.type,
      statusCode: activity.statusCode,
      description: take(activity.description),
      notes: take(activity.notes),
      previousAiSummary: take(activity.aiSummary),
      actionItems: take(activity.actionItems),
      outcome: take(activity.outcome),
      completionOutcome: take(activity.completionOutcome),
      customerFeedback: take(activity.customerFeedback),
      nextAction: take(activity.nextAction),
      activityAt: iso(activity.activityAt ?? activity.createdAt),
      dueAt: iso(activity.dueAt),
      completedAt: iso(activity.completedAt),
      nextFollowUpAt: iso(activity.nextFollowUpAt),
    };
  });
  const documents = await documentContexts(prospect.documents, storage);
  const input = {
    prospect: {
      id: prospect.id,
      prospectCode: prospect.prospectCode,
      companyName: cleanText(prospect.companyName, 255),
      companyNameEnglish: cleanText(prospect.companyNameEnglish, 255),
      customerType: prospect.customerType,
      organizationType: prospect.organizationType,
      industry: prospect.industry,
      subIndustry: prospect.subIndustry,
      companySize: prospect.companySize,
      numberOfEmployees: prospect.numberOfEmployees,
      estimatedAnnualRevenue: prospect.estimatedAnnualRevenue?.toString() ?? null,
      website: prospect.website,
      companyDescription: cleanText(prospect.companyDescription, 4_000),
      province: prospect.province,
      region: prospect.region,
      currentProviders: {
        telecom: cleanText(prospect.currentTelecomProvider, 1_000),
        internet: cleanText(prospect.currentInternetProvider, 1_000),
        cloud: cleanText(prospect.currentCloudProvider, 1_000),
        security: cleanText(prospect.currentSecurityProvider, 1_000),
      },
      existingSolutions: cleanText(prospect.existingSolutions, 2_000),
      currentContractEndDate: iso(prospect.currentContractEndDate),
      numberOfBranches: prospect.numberOfBranches,
      businessPainPoints: cleanText(prospect.businessPainPoints, 4_000),
      expectedBudget: prospect.expectedBudget?.toString() ?? null,
      expectedPurchasePeriod: prospect.expectedPurchasePeriod,
      estimatedOpportunityValue: prospect.estimatedOpportunityValue?.toString() ?? null,
      currency: prospect.currency,
      procurementMethod: prospect.procurementMethod,
      projectType: prospect.projectType,
      source: prospect.source,
      sourceName: prospect.sourceName,
      referralName: prospect.referralName,
      lastContactAt: iso(prospect.lastContactAt),
      nextFollowUpAt: iso(prospect.nextFollowUpAt),
      followUpStatus: prospect.followUpStatus,
      contactAttemptCount: prospect.contactAttemptCount,
      status: prospect.status,
      calculatedScore: prospect.calculatedScore,
      heatLevel: prospect.heatLevel,
      recommendedProducts: cleanText(prospect.recommendedProducts, 2_000),
      notes: cleanText(prospect.notes, 4_000),
    },
    contacts,
    activities,
    documents,
  };
  const serialized = JSON.stringify(input);
  if (serialized.length > MAX_ENRICHMENT_CONTEXT_CHARACTERS) {
    input.prospect.notes = null;
    input.prospect.companyDescription = cleanText(input.prospect.companyDescription, 1_000);
  }
  return {
    input,
    sourceReferences: [
      { type: "Prospect" as const, id: prospect.id },
      ...contacts.map((contact) => ({ type: "ProspectContact" as const, id: contact.id })),
      ...activities.map((activity) => ({ type: "Activity" as const, id: activity.id })),
      ...documents.map((document) => ({ type: "SalesDocument" as const, id: document.id })),
    ] satisfies ProspectEnrichmentSourceReference[],
  };
}
