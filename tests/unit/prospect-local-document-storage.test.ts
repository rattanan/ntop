import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { DocumentStorageOperationError, LocalProspectDocumentStorage } from "../../lib/prospect/prospect-document-storage";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LocalProspectDocumentStorage", () => {
  it("writes private files atomically and removes them", async () => {
    const root = await mkdtemp(join(tmpdir(), "ntop-documents-")); roots.push(root);
    const storage = new LocalProspectDocumentStorage(root);
    const objectKey = "prospects/prospect-1/hash/profile.pdf";
    const document = { objectKey, contentHash: "hash", fileName: "profile.pdf", mimeType: "application/pdf", sizeBytes: 3 };
    await storage.put(document, new Uint8Array([1, 2, 3]));
    const target = join(root, objectKey);
    expect([...await readFile(target)]).toEqual([1, 2, 3]);
    expect((await stat(root)).mode & 0o777).toBe(0o700);
    expect((await stat(target)).mode & 0o777).toBe(0o600);
    await expect(storage.assertClean(document)).resolves.toBeUndefined();
    await storage.remove(objectKey);
    await expect(stat(target)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects paths outside the configured private root", async () => {
    const root = await mkdtemp(join(tmpdir(), "ntop-documents-")); roots.push(root);
    const storage = new LocalProspectDocumentStorage(root);
    const document = { objectKey: "../escape.pdf", contentHash: "hash", fileName: "escape.pdf", mimeType: "application/pdf", sizeBytes: 1 };
    await expect(storage.put(document, new Uint8Array([1]))).rejects.toBeInstanceOf(DocumentStorageOperationError);
    await expect(storage.remove(document.objectKey)).rejects.toBeInstanceOf(DocumentStorageOperationError);
  });
});
