import { describe, expect, it, vi } from "vitest";

import { ProspectDocumentService } from "../../lib/prospect/prospect-document-service";

function setup() {
  const documents = new Map<string, Record<string, unknown>>();
  const receipts = new Set<string>();
  const tx = {
    salesDocument: {
      upsert: vi.fn(async ({ where, create }: { where: { objectKeyHash: string }; create: Record<string, unknown> }) => { const existing = documents.get(where.objectKeyHash); if (existing) return existing; const value = { id: "doc-1", ...create }; documents.set(where.objectKeyHash, value); return value; }),
      findFirst: vi.fn(async () => ({ id: "doc-1", objectKey: "prospects/prospect-1/hash/profile.pdf", fileName: "profile.pdf", mimeType: "application/pdf", sizeBytes: 3, contentHash: "hash" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const repository = {
    transaction: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    findAccessible: vi.fn(async () => ({ id: "prospect-1", version: 4 })),
    findReceipt: vi.fn(async (_actor: string, key: string) => receipts.has(key) ? { id: "receipt-1" } : null),
    saveReceipt: vi.fn(async ({ key }: { key: string }) => { receipts.add(key); }),
    findDocumentByObjectKeyHash: vi.fn(async (hash: string) => documents.get(hash) ?? null),
  };
  const audit = { append: vi.fn(async () => ({ id: "audit-1" })) };
  const storage = { put: vi.fn(async () => undefined), read: vi.fn(async () => new Uint8Array([1, 2, 3])), assertClean: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
  const service = new ProspectDocumentService(repository as never, audit as never, storage);
  const actor = { id: "user-1", authorization: {}, permissions: new Set(["prospect.view", "prospect.update"]) } as never;
  return { service, repository, audit, storage, actor, tx };
}

describe("ProspectDocumentService", () => {
  it("stores only after scope, private upload and malware scan, then audits in transaction", async () => {
    const { service, repository, audit, storage, actor } = setup();
    const result = await service.upload(actor, "prospect-1", { fileName: "profile.pdf", mimeType: "application/pdf", category: "Company profile", bytes: new Uint8Array([1, 2, 3]) }, "corr-1", "key-1");
    expect(result).toMatchObject({ id: "doc-1", prospectId: "prospect-1", uploadedById: "user-1" });
    expect(repository.findAccessible).toHaveBeenCalled();
    expect(storage.put).toHaveBeenCalledOnce();
    expect(storage.assertClean).toHaveBeenCalledOnce();
    expect(repository.saveReceipt).toHaveBeenCalledOnce();
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "prospect.document.upload", outcome: "SUCCESS" }), expect.objectContaining({ transaction: expect.anything() }));
  });

  it("removes the quarantined object when malware validation fails", async () => {
    const { service, storage, actor } = setup(); storage.assertClean.mockRejectedValueOnce(new Error("unsafe"));
    await expect(service.upload(actor, "prospect-1", { fileName: "profile.pdf", mimeType: "application/pdf", category: "Profile", bytes: new Uint8Array([1]) }, "corr-1", "key-2")).rejects.toThrow("unsafe");
    expect(storage.remove).toHaveBeenCalledOnce();
  });

  it("rejects inaccessible prospects before uploading bytes", async () => {
    const { service, repository, storage, actor } = setup(); repository.findAccessible.mockResolvedValueOnce(null as never);
    await expect(service.upload(actor, "hidden", { fileName: "profile.pdf", mimeType: "application/pdf", category: "Profile", bytes: new Uint8Array([1]) }, "corr-1", "key-3")).rejects.toThrow();
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("downloads a scoped private object and audits document access", async () => {
    const { service, storage, audit, actor } = setup();
    const result = await service.download(actor, "prospect-1", "doc-1", "corr-download");
    expect(result).toEqual({ bytes: new Uint8Array([1, 2, 3]), fileName: "profile.pdf", mimeType: "application/pdf" });
    expect(storage.read).toHaveBeenCalledWith("prospects/prospect-1/hash/profile.pdf");
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "prospect.document.download", targetId: "doc-1" }), expect.objectContaining({ transaction: expect.anything() }));
  });

  it("soft-deletes metadata and audits while retaining the private object for governed recovery", async () => {
    const { service, storage, audit, actor, tx } = setup();
    await expect(service.remove(actor, "prospect-1", "doc-1", "corr-delete", "key-delete")).resolves.toEqual({ id: "doc-1", deleted: true });
    expect(tx.salesDocument.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), deletedById: "user-1" }) }));
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "prospect.document.delete", targetId: "doc-1" }), expect.objectContaining({ transaction: tx }));
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("rejects document download without Prospect view permission", async () => {
    const { service, repository } = setup();
    const unauthorized = { id: "user-1", authorization: {}, permissions: new Set(["prospect.update"]) } as never;
    await expect(service.download(unauthorized, "prospect-1", "doc-1", "corr-denied")).rejects.toThrow();
    expect(repository.transaction).not.toHaveBeenCalled();
  });
});
