import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ADDITIONAL_AUTHENTICATED_DATA = Buffer.from(
  "ntop:ai-provider-api-key:v1",
  "utf8",
);

export type EncryptedProviderKey = {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  authTag: Uint8Array;
};

export class ProviderKeyCryptoError extends Error {
  constructor() {
    super("AI provider key encryption operation failed.");
    this.name = "ProviderKeyCryptoError";
  }
}

function assertMasterKey(masterKey: Uint8Array) {
  if (masterKey.byteLength !== KEY_BYTES) {
    throw new ProviderKeyCryptoError();
  }
}

export function decodeProviderMasterKey(encodedMasterKey: string): Uint8Array {
  try {
    const key = Buffer.from(encodedMasterKey, "base64");
    assertMasterKey(key);
    return key;
  } catch {
    throw new ProviderKeyCryptoError();
  }
}

export function encryptProviderKey(
  plaintext: string,
  masterKey: Uint8Array,
): EncryptedProviderKey {
  try {
    assertMasterKey(masterKey);
    if (!plaintext) {
      throw new ProviderKeyCryptoError();
    }

    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, masterKey, nonce, {
      authTagLength: AUTH_TAG_BYTES,
    });
    cipher.setAAD(ADDITIONAL_AUTHENTICATED_DATA);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    return {
      ciphertext,
      nonce,
      authTag: cipher.getAuthTag(),
    };
  } catch {
    throw new ProviderKeyCryptoError();
  }
}

export function decryptProviderKey(
  encrypted: EncryptedProviderKey,
  masterKey: Uint8Array,
): string {
  try {
    assertMasterKey(masterKey);
    if (
      encrypted.nonce.byteLength !== NONCE_BYTES ||
      encrypted.authTag.byteLength !== AUTH_TAG_BYTES ||
      encrypted.ciphertext.byteLength === 0
    ) {
      throw new ProviderKeyCryptoError();
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      masterKey,
      encrypted.nonce,
      { authTagLength: AUTH_TAG_BYTES },
    );
    decipher.setAAD(ADDITIONAL_AUTHENTICATED_DATA);
    decipher.setAuthTag(encrypted.authTag);

    return Buffer.concat([
      decipher.update(encrypted.ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ProviderKeyCryptoError();
  }
}
