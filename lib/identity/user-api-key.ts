import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_PATTERN = /^ntop_([a-f0-9]{12})_([A-Za-z0-9_-]{32,})$/;

export function generateUserApiKey() {
  const prefix = randomBytes(6).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const apiKey = `ntop_${prefix}_${secret}`;
  return { apiKey, prefix, hash: hashUserApiKey(apiKey) };
}

export function apiKeyPrefix(apiKey: string) {
  return KEY_PATTERN.exec(apiKey)?.[1] ?? null;
}

export function hashUserApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

export function verifyUserApiKey(apiKey: string, expectedHash: string) {
  const actual = Buffer.from(hashUserApiKey(apiKey), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
