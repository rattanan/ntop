import { describe, expect, it } from "vitest";
import { apiKeyPrefix, generateUserApiKey, hashUserApiKey, verifyUserApiKey } from "../../lib/identity/user-api-key";

describe("user API keys", () => {
  it("generates parseable high-entropy keys and verifies only the original value", () => {
    const credential = generateUserApiKey();
    expect(apiKeyPrefix(credential.apiKey)).toBe(credential.prefix);
    expect(credential.hash).toBe(hashUserApiKey(credential.apiKey));
    expect(verifyUserApiKey(credential.apiKey, credential.hash)).toBe(true);
    expect(verifyUserApiKey(`${credential.apiKey}x`, credential.hash)).toBe(false);
  });

  it("rejects malformed prefixes", () => {
    expect(apiKeyPrefix("not-an-ntop-key")).toBeNull();
  });
});
