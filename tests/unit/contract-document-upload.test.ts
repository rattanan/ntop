import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { ContractDocumentService } from "../../lib/contract/contract-document-service";
import { createProspectDocumentStorage, LocalProspectDocumentStorage } from "../../lib/prospect/prospect-document-storage";

function setup() {
  const tx = {
    contractDocumentVersion: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "version-1", ...data })),
    },
    contractDocument: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "document-1", currentVersion: 0 })),
      update: vi.fn(async () => undefined),
    },
    contractCommandReceipt: { create: vi.fn(async () => undefined) },
  };
  const repository = {
    transaction: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    find: vi.fn(async () => ({ id: "contract-1", version: 2 })),
  };
  const audit = { append: vi.fn(async () => ({ id: "audit-1" })) };
  const storage = { put: vi.fn(async () => undefined), read: vi.fn(), remove: vi.fn(async () => undefined), assertClean: vi.fn(async () => undefined) };
  return { service: new ContractDocumentService(repository as never, audit as never, storage), repository, audit, storage };
}

describe("Contract document upload", () => {
  it("accepts an Excel workbook and stores it through the configured private adapter", async () => {
    const { service, storage, audit } = setup();
    const result = await service.upload(
      { id: "user-1", authorization: {} as never },
      "contract-1",
      { category: "CONTRACT", fileName: "handoff.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: new Uint8Array([1, 2, 3]) },
      "corr-1",
      "key-1",
    );
    expect(result).toMatchObject({ id: "version-1", fileName: "handoff.xlsx", malwareScanStatus: "CLEAN" });
    expect(storage.put).toHaveBeenCalledOnce();
    expect(storage.assertClean).toHaveBeenCalledOnce();
    expect(audit.append).toHaveBeenCalledWith(expect.objectContaining({ action: "contract.document.upload" }), expect.anything());
  });

  it("maps validation and storage failures to actionable API errors", () => {
    const api = readFileSync("app/api/v1/workflow-api-response.ts", "utf8");
    expect(api).toContain("if (error instanceof ContractDocumentValidationError) message = error.message");
    expect(api).toContain("error instanceof DocumentStorageConfigurationError || error instanceof DocumentStorageOperationError");
    expect(api).toContain('code = "DOCUMENT_SERVICE_UNAVAILABLE"; message = error.message');
  });

  it("serializes Prisma BigInt file sizes before returning the upload response", () => {
    const route = readFileSync("app/api/v1/contracts/[id]/documents/route.ts", "utf8");
    expect(route).toContain("sizeBytes:data.sizeBytes.toString()");
  });

  it("uses the configured document-storage driver for Contract runtime", () => {
    const runtime = readFileSync("lib/contract/contract-runtime.ts", "utf8");
    expect(runtime).toContain("createProspectDocumentStorage()");
    expect(runtime).not.toContain("new S3ProspectDocumentStorage()");
  });

  it("selects local private storage without a malware-scanner dependency", async () => {
    const previousDriver = process.env.DOCUMENT_STORAGE_DRIVER;
    const previousPath = process.env.DOCUMENT_LOCAL_STORAGE_PATH;
    process.env.DOCUMENT_STORAGE_DRIVER = "local";
    process.env.DOCUMENT_LOCAL_STORAGE_PATH = "/tmp/ntop-contract-document-test";
    try {
      const storage = createProspectDocumentStorage();
      expect(storage).toBeInstanceOf(LocalProspectDocumentStorage);
      await expect(storage.assertClean({ objectKey: "contracts/c1/file.xlsx", contentHash: "hash", fileName: "file.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: 3 })).resolves.toBeUndefined();
    } finally {
      if (previousDriver === undefined) delete process.env.DOCUMENT_STORAGE_DRIVER;
      else process.env.DOCUMENT_STORAGE_DRIVER = previousDriver;
      if (previousPath === undefined) delete process.env.DOCUMENT_LOCAL_STORAGE_PATH;
      else process.env.DOCUMENT_LOCAL_STORAGE_PATH = previousPath;
    }
  });
});
