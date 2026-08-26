import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { AuditWriter } from "../audit/audit-writer";
import type { AuthorizationContext } from "../authorization/authorization-context";
import type { ProspectDocumentStorage, StoredDocument } from "../prospect/prospect-document-storage";
import type { PrismaContractRepository } from "./prisma-contract-repository";
import { ContractAccessError } from "./contract-service";

const metadata = z.strictObject({ category: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,59}$/), fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(191) });
const allowed = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "image/png", "application/zip", "application/x-zip-compressed"]);
export const MAX_CONTRACT_DOCUMENT_BYTES = 25_000_000;
type DocumentActor = { id: string; authorization: AuthorizationContext };

export class ContractDocumentValidationError extends Error { constructor(message: string) { super(message); this.name = "ContractDocumentValidationError"; } }

export class ContractDocumentService {
  constructor(private repository: PrismaContractRepository, private audit: AuditWriter<Prisma.TransactionClient>, private storage: ProspectDocumentStorage) {}

  async upload(actor: DocumentActor, contractId: string, input: { category: string; fileName: string; mimeType: string; bytes: Uint8Array }, correlationId: string, idempotencyKey: string) {
    const parsed = metadata.safeParse({ category: input.category, fileName: input.fileName, mimeType: input.mimeType });
    if (!parsed.success || !allowed.has(input.mimeType) || !input.bytes.length || input.bytes.length > MAX_CONTRACT_DOCUMENT_BYTES) throw new ContractDocumentValidationError("Contract document must be a supported PDF, Office, image or ZIP file up to 25 MB.");
    const safe = input.fileName.replace(/[\\/\u0000-\u001f]/g, "_");
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    const objectKey = `contracts/${contractId}/${input.category}/${sha256}/${safe}`;
    const objectKeyHash = createHash("sha256").update(objectKey).digest("hex");
    const replay = await this.repository.transaction(async (tx) => {
      const contract = await this.repository.find(contractId, actor.authorization, tx);
      if (!contract) throw new ContractAccessError();
      const existing = await tx.contractDocumentVersion.findUnique({ where: { objectKeyHash } });
      if (!existing?.deletedAt) return existing;
      const restored = await tx.contractDocumentVersion.update({ where: { id: existing.id }, data: { deletedAt: null, deletedById: null } });
      await tx.contractCommandReceipt.create({ data: { actorId: actor.id, idempotencyKey, command: "contract.document.upload", contractId, resultVersion: contract.version } });
      await this.audit.append({ actorId: actor.id, action: "contract.document.restore", targetType: "ContractDocumentVersion", targetId: existing.id, targetVersion: String(existing.versionNumber), outcome: "SUCCESS", correlationId, data: { contractId, sha256 } }, { transaction: tx });
      return restored;
    });
    if (replay) return replay;
    const stored: StoredDocument = { objectKey, contentHash: sha256, fileName: safe, mimeType: input.mimeType, sizeBytes: input.bytes.length };
    await this.storage.put(stored, input.bytes);
    try {
      await this.storage.assertClean(stored);
      return await this.repository.transaction(async (tx) => {
        const contract = await this.repository.find(contractId, actor.authorization, tx);
        if (!contract) throw new ContractAccessError();
        const document = await tx.contractDocument.findFirst({ where: { contractId, category: input.category } }) ?? await tx.contractDocument.create({ data: { contractId, category: input.category } });
        const versionNumber = document.currentVersion + 1;
        const version = await tx.contractDocumentVersion.create({ data: { documentId: document.id, versionNumber, fileName: safe, mimeType: input.mimeType, sizeBytes: input.bytes.length, objectKey, objectKeyHash, sha256, malwareScanStatus: "CLEAN", uploadedById: actor.id } });
        await tx.contractDocument.update({ where: { id: document.id }, data: { currentVersion: versionNumber } });
        await tx.contractCommandReceipt.create({ data: { actorId: actor.id, idempotencyKey, command: "contract.document.upload", contractId, resultVersion: contract.version } });
        await this.audit.append({ actorId: actor.id, action: "contract.document.upload", targetType: "ContractDocumentVersion", targetId: version.id, targetVersion: String(versionNumber), outcome: "SUCCESS", correlationId, data: { contractId, category: input.category, sha256, mimeType: input.mimeType, sizeBytes: input.bytes.length } }, { transaction: tx });
        return version;
      });
    } catch (error) { await this.storage.remove(objectKey); throw error; }
  }

  async download(actor: DocumentActor, contractId: string, documentId: string, correlationId: string) {
    const document = await this.repository.transaction(async (tx) => {
      if (!await this.repository.find(contractId, actor.authorization, tx)) throw new ContractAccessError();
      const scoped = await tx.contractDocumentVersion.findFirst({ where: { id: documentId, deletedAt: null, document: { contractId } }, select: { id: true, objectKey: true, fileName: true, mimeType: true, sizeBytes: true, sha256: true } });
      if (!scoped) throw new ContractAccessError();
      return scoped;
    });
    const bytes = await this.storage.read(document.objectKey);
    await this.repository.transaction((tx) => this.audit.append({ actorId: actor.id, action: "contract.document.download", targetType: "ContractDocumentVersion", targetId: document.id, outcome: "SUCCESS", correlationId, data: { contractId, sha256: document.sha256, sizeBytes: document.sizeBytes.toString() } }, { transaction: tx }));
    return { bytes, fileName: document.fileName, mimeType: document.mimeType };
  }

  async remove(actor: DocumentActor, contractId: string, documentId: string, correlationId: string, idempotencyKey: string) {
    const command = `contract.document.delete.${documentId}`;
    return this.repository.transaction(async (tx) => {
      const contract = await this.repository.find(contractId, actor.authorization, tx);
      if (!contract) throw new ContractAccessError();
      const receipt = await tx.contractCommandReceipt.findUnique({ where: { actorId_idempotencyKey_command: { actorId: actor.id, idempotencyKey, command } } });
      if (receipt) return { id: documentId, deleted: true };
      const document = await tx.contractDocumentVersion.findFirst({ where: { id: documentId, deletedAt: null, document: { contractId } }, select: { id: true, sha256: true, sizeBytes: true } });
      if (!document) throw new ContractAccessError();
      const deleted = await tx.contractDocumentVersion.updateMany({ where: { id: documentId, deletedAt: null }, data: { deletedAt: new Date(), deletedById: actor.id } });
      if (deleted.count !== 1) throw new ContractAccessError();
      await tx.contractCommandReceipt.create({ data: { actorId: actor.id, idempotencyKey, command, contractId, resultVersion: contract.version } });
      await this.audit.append({ actorId: actor.id, action: "contract.document.delete", targetType: "ContractDocumentVersion", targetId: documentId, outcome: "SUCCESS", correlationId, data: { contractId, sha256: document.sha256, sizeBytes: document.sizeBytes.toString() } }, { transaction: tx });
      return { id: documentId, deleted: true };
    });
  }
}
