import { createHash } from "node:crypto";
import { z } from "zod";

import type { AuditWriter } from "../audit/audit-writer";
import { PERMISSIONS } from "../authorization/permission-policy";
import { ProspectAccessError, requireProspectPermission } from "./prospect-authorization";
import type { ProspectTransaction, PrismaProspectRepository } from "./prospect-repository";
import type { ProspectActor } from "./prospect-service";
import type { ProspectDocumentStorage, StoredDocument } from "./prospect-document-storage";

export const MAX_PROSPECT_DOCUMENT_BYTES = 10_000_000;
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "image/jpeg",
  "image/png",
]);
const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv", txt: "text/plain", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
};

const metadataSchema = z.strictObject({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(191),
  category: z.string().trim().min(2).max(100),
});

export class ProspectDocumentValidationError extends Error {
  readonly issues: Record<string, string[]>;
  constructor(issues: Record<string, string[]>) {
    super("ข้อมูลเอกสารไม่ถูกต้อง");
    this.name = "ProspectDocumentValidationError";
    this.issues = issues;
  }
}

function safeFileName(fileName: string) {
  return fileName.replace(/[\\/\u0000-\u001f]/g, "_");
}

function normalizedMimeType(fileName: string, mimeType: string) {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return mimeByExtension[extension] ?? mimeType;
}

export class ProspectDocumentService {
  constructor(
    private repository: PrismaProspectRepository,
    private audit: AuditWriter<ProspectTransaction>,
    private storage: ProspectDocumentStorage,
  ) {}

  async upload(actor: ProspectActor, prospectId: string, input: { fileName: string; mimeType: string; category: string; bytes: Uint8Array }, correlationId: string, idempotencyKey: string) {
    requireProspectPermission(actor.permissions, PERMISSIONS.prospectUpdate);
    const parsed = metadataSchema.safeParse({ fileName: input.fileName, mimeType: normalizedMimeType(input.fileName, input.mimeType), category: input.category });
    if (!parsed.success) throw new ProspectDocumentValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    if (!allowedMimeTypes.has(parsed.data.mimeType)) {
      throw new ProspectDocumentValidationError({ file: ["รองรับ PDF, Office, CSV, TXT, JPG และ PNG เท่านั้น"] });
    }
    if (!input.bytes.length || input.bytes.length > MAX_PROSPECT_DOCUMENT_BYTES) {
      throw new ProspectDocumentValidationError({ file: ["ไฟล์ต้องมีขนาดไม่เกิน 10 MB"] });
    }

    const access = await this.repository.transaction(async (tx) => {
      const prospect = await this.repository.findAccessible(prospectId, actor.authorization, actor.permissions, tx);
      if (!prospect) throw new ProspectAccessError();
      const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "prospect.document.upload", tx);
      return { version: prospect.version, replay: Boolean(receipt) };
    });

    const contentHash = createHash("sha256").update(input.bytes).digest("hex");
    const objectKey = `prospects/${prospectId}/${contentHash}/${safeFileName(parsed.data.fileName)}`;
    const objectKeyHash = createHash("sha256").update(objectKey).digest("hex");
    if (access.replay) {
      const existing = await this.repository.findDocumentByObjectKeyHash(objectKeyHash);
      if (existing) return existing;
    }

    const stored: StoredDocument = { objectKey, contentHash, fileName: safeFileName(parsed.data.fileName), mimeType: parsed.data.mimeType, sizeBytes: input.bytes.length };
    await this.storage.put(stored, input.bytes);
    try {
      await this.storage.assertClean(stored);
      return await this.repository.transaction(async (tx) => {
        const prospect = await this.repository.findAccessible(prospectId, actor.authorization, actor.permissions, tx);
        if (!prospect) throw new ProspectAccessError();
        const document = await tx.salesDocument.upsert({
          where: { objectKeyHash },
          update: {},
          create: { prospectId, objectKey, objectKeyHash, contentHash, fileName: stored.fileName, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, category: parsed.data.category, uploadedById: actor.id },
        });
        const receipt = await this.repository.findReceipt(actor.id, idempotencyKey, "prospect.document.upload", tx);
        if (!receipt) await this.repository.saveReceipt({ actorId: actor.id, key: idempotencyKey, command: "prospect.document.upload", prospectId, version: prospect.version }, tx);
        await this.audit.append({ actorId: actor.id, action: "prospect.document.upload", targetType: "SalesDocument", targetId: document.id, outcome: "SUCCESS", correlationId, data: { prospectId, contentHash, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, category: parsed.data.category } }, { transaction: tx });
        return document;
      });
    } catch (error) {
      await this.storage.remove(objectKey);
      throw error;
    }
  }
}
