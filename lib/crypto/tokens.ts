// Token encryption (Phase 10.5) — AES-256-GCM round-trip for OAuth tokens at
// rest. The DB stores ONLY ciphertext (MailboxConnection.accessTokenEnc /
// refreshTokenEnc); the plaintext access/refresh tokens never touch a column
// or a log.
//
// Key: TOKEN_ENCRYPTION_KEY, a 32-byte (256-bit) key as 64 hex chars
// (`openssl rand -hex 32`). Wrong length / absent key throws CLEARLY — a
// silent fallback would weaken every stored token.
//
// Wire format: base64( iv | authTag | ciphertext )
//   iv      = 12 bytes (GCM standard nonce)
//   authTag = 16 bytes (GCM auth tag — tamper detection)
//   ciphertext = the rest
// Any tampering (flipped byte, truncation, wrong key) makes decrypt() throw on
// the GCM tag check — never returns garbage plaintext.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM nonce
const TAG_LEN = 16; // GCM auth tag

/**
 * Resolve and validate the 32-byte key from TOKEN_ENCRYPTION_KEY (hex).
 * Throws a clear error if the env var is missing or the wrong length — callers
 * (encrypt/decrypt) surface this loudly rather than encrypt with a weak key.
 */
export function tokenKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set — generate one with `openssl rand -hex 32`",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex.trim())) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes) — `openssl rand -hex 32`",
    );
  }
  return Buffer.from(hex.trim(), "hex");
}

/** Whether a usable encryption key is configured (no throw) — UI/no-op gates. */
export function isTokenCryptoConfigured(): boolean {
  try {
    tokenKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt a UTF-8 plaintext → base64(iv|tag|ciphertext). */
export function encryptToken(plaintext: string): string {
  const key = tokenKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypt base64(iv|tag|ciphertext) → UTF-8 plaintext. Throws on a bad key,
 * malformed/truncated input, or any tampering (the GCM tag check fails).
 */
export function decryptToken(encoded: string): string {
  const key = tokenKey();
  const raw = Buffer.from(encoded, "base64");
  if (raw.length < IV_LEN + TAG_LEN) {
    throw new Error("ciphertext too short — corrupt or not an encrypted token");
  }
  const iv = raw.subarray(0, IV_LEN);
  const authTag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
