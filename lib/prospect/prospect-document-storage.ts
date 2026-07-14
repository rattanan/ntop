import { createHash, createHmac } from "node:crypto";

export type StoredDocument = {
  objectKey: string;
  contentHash: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export interface ProspectDocumentStorage {
  put(document: StoredDocument, bytes: Uint8Array): Promise<void>;
  remove(objectKey: string): Promise<void>;
  assertClean(document: StoredDocument): Promise<void>;
}

export class DocumentStorageConfigurationError extends Error {
  constructor() {
    super("ยังไม่ได้ตั้งค่า Private document storage หรือ Malware scanner กรุณาติดต่อผู้ดูแลระบบ");
    this.name = "DocumentStorageConfigurationError";
  }
}

export class DocumentStorageOperationError extends Error {
  constructor(message = "ไม่สามารถจัดเก็บเอกสารได้ กรุณาลองใหม่อีกครั้ง") {
    super(message);
    this.name = "DocumentStorageOperationError";
  }
}

export class UnsafeDocumentError extends Error {
  constructor() {
    super("เอกสารไม่ผ่านการตรวจสอบความปลอดภัยและไม่ได้ถูกบันทึก");
    this.name = "UnsafeDocumentError";
  }
}

type StorageConfiguration = {
  endpoint: URL;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  scannerEndpoint: URL;
  scannerToken?: string;
};

function loadConfiguration(): StorageConfiguration {
  const endpoint = process.env.DOCUMENT_STORAGE_ENDPOINT;
  const bucket = process.env.DOCUMENT_STORAGE_BUCKET;
  const accessKeyId = process.env.DOCUMENT_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.DOCUMENT_STORAGE_SECRET_ACCESS_KEY;
  const scannerEndpoint = process.env.DOCUMENT_MALWARE_SCANNER_ENDPOINT;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !scannerEndpoint) {
    throw new DocumentStorageConfigurationError();
  }
  return {
    endpoint: new URL(endpoint),
    bucket,
    region: process.env.DOCUMENT_STORAGE_REGION || "us-east-1",
    accessKeyId,
    secretAccessKey,
    scannerEndpoint: new URL(scannerEndpoint),
    scannerToken: process.env.DOCUMENT_MALWARE_SCANNER_TOKEN,
  };
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function encodedPath(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function signedRequest(config: StorageConfiguration, method: "PUT" | "DELETE", objectKey: string, payloadHash: string) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const basePath = config.endpoint.pathname.replace(/\/$/, "");
  const canonicalUri = `${basePath}/${encodeURIComponent(config.bucket)}/${encodedPath(objectKey)}` || "/";
  const host = config.endpoint.host;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, date);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const url = new URL(canonicalUri, config.endpoint.origin);
  return {
    url,
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  };
}

export class S3ProspectDocumentStorage implements ProspectDocumentStorage {
  async put(document: StoredDocument, bytes: Uint8Array) {
    const config = loadConfiguration();
    const request = signedRequest(config, "PUT", document.objectKey, document.contentHash);
    const response = await fetch(request.url, {
      method: "PUT",
      headers: { ...request.headers, "content-type": document.mimeType },
      body: Buffer.from(bytes),
    });
    if (!response.ok) throw new DocumentStorageOperationError();
  }

  async remove(objectKey: string) {
    const config = loadConfiguration();
    const emptyHash = sha256("");
    const request = signedRequest(config, "DELETE", objectKey, emptyHash);
    await fetch(request.url, { method: "DELETE", headers: request.headers }).catch(() => undefined);
  }

  async assertClean(document: StoredDocument) {
    const config = loadConfiguration();
    const response = await fetch(config.scannerEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.scannerToken ? { authorization: `Bearer ${config.scannerToken}` } : {}),
      },
      body: JSON.stringify({
        bucket: config.bucket,
        objectKey: document.objectKey,
        contentHash: document.contentHash,
        sizeBytes: document.sizeBytes,
        mimeType: document.mimeType,
      }),
    });
    if (!response.ok) throw new DocumentStorageOperationError("ระบบตรวจสอบเอกสารไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง");
    const result = (await response.json()) as { status?: string };
    if (result.status !== "CLEAN") throw new UnsafeDocumentError();
  }
}
