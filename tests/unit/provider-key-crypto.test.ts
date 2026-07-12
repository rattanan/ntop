import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decodeProviderMasterKey,
  decryptProviderKey,
  encryptProviderKey,
  ProviderKeyCryptoError,
} from "../../lib/ai/provider-key-crypto";

describe("AI provider key authenticated encryption", () => {
  it("round-trips with AES-256-GCM without returning plaintext", () => {
    const masterKey = randomBytes(32);
    const plaintext = "test-provider-key-value";
    const encrypted = encryptProviderKey(plaintext, masterKey);

    expect(encrypted.nonce).toHaveLength(12);
    expect(encrypted.authTag).toHaveLength(16);
    expect(Buffer.from(encrypted.ciphertext).toString("utf8")).not.toContain(
      plaintext,
    );
    expect(decryptProviderKey(encrypted, masterKey)).toBe(plaintext);
  });

  it("uses a fresh nonce for every encryption", () => {
    const masterKey = randomBytes(32);

    const first = encryptProviderKey("same-value", masterKey);
    const second = encryptProviderKey("same-value", masterKey);

    expect(Buffer.from(first.nonce).equals(second.nonce)).toBe(false);
    expect(Buffer.from(first.ciphertext).equals(second.ciphertext)).toBe(false);
  });

  it("fails closed for a wrong master key", () => {
    const encrypted = encryptProviderKey("secret", randomBytes(32));

    expect(() => decryptProviderKey(encrypted, randomBytes(32))).toThrow(
      ProviderKeyCryptoError,
    );
  });

  it("fails closed when ciphertext or authentication metadata is changed", () => {
    const masterKey = randomBytes(32);
    const encrypted = encryptProviderKey("secret", masterKey);
    const tamperedCiphertext = Uint8Array.from(encrypted.ciphertext);
    tamperedCiphertext[0] ^= 1;

    expect(() =>
      decryptProviderKey(
        { ...encrypted, ciphertext: tamperedCiphertext },
        masterKey,
      ),
    ).toThrow(ProviderKeyCryptoError);
    expect(() =>
      decryptProviderKey(
        { ...encrypted, authTag: new Uint8Array(16) },
        masterKey,
      ),
    ).toThrow(ProviderKeyCryptoError);
  });

  it("accepts only a base64-encoded 32-byte master key", () => {
    const masterKey = randomBytes(32);

    expect(decodeProviderMasterKey(masterKey.toString("base64"))).toEqual(
      masterKey,
    );
    expect(() => decodeProviderMasterKey("too-short")).toThrow(
      ProviderKeyCryptoError,
    );
  });
});
