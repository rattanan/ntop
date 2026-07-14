import { describe, expect, it, vi } from "vitest";

import { ProspectDocumentService } from "../../lib/prospect/prospect-document-service";

function setup() {
  const documents = new Map<string, Record<string, unknown>>();
  const receipts = new Set<string>();
  const tx = {
    salesDocument: { upsert: vi.fn(async ({ where, create }: { where: { objectKeyHash: string }; create: Record<string, unknown> }) => { const existing = documents.get(where.objectKeyHash); if (existing) return existing; const value = { id: "doc-1", ...create }; documents.set(where.objectKeyHash, value); return value; }) },
  };
  const repository = {
    transaction: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    findAccessible: vi.fn(async () => ({ id: "prospect-1", version: 4 })),
    findReceipt: vi.fn(async (_actor: string, key: string) => receipts.has(key) ? { id: "receipt-1" } : null),
    saveReceipt: vi.fn(async ({ key }: { key: string }) => { receipts.add(key); }),
    findDocumentByObjectKeyHash: vi.fn(async (hash: string) => documents.get(hash) ?? null),
  };
  const audit = { append: vi.fn(async () => ({ id: "audit-1" })) };
  const storage = { put: vi.fn(async () => undefined), assertClean: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) };
  const service = new ProspectDocumentService(repository as never, audit as never, storage);
  const actor = { id: "user-1", authorization: {}, permissions: new Set(["prospect.update"]) } as never;
  return { service, repository, audit, storage, actor };
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
});
