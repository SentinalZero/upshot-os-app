/**
 * AES-GCM encryption/decryption utilities for token storage.
 * Uses TOKEN_ENCRYPTION_KEY from Supabase Edge Function secrets.
 * Never expose this module or its outputs to the browser.
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const TAG_LENGTH = 128; // 128-bit auth tag (default)

/**
 * Derive a CryptoKey from the hex-encoded TOKEN_ENCRYPTION_KEY secret.
 */
async function getKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!keyHex) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  }

  // Expect a 256-bit (32-byte) key encoded as 64 hex characters
  const keyBytes = hexToBytes(keyHex);
  if (keyBytes.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)");
  }

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string using AES-GCM.
 * Returns a base64-encoded string containing: IV (12 bytes) + ciphertext + auth tag.
 * A unique random IV is generated for every call.
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoded
  );

  // Concatenate IV + ciphertext (which includes the auth tag appended by WebCrypto)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bytesToBase64(combined);
}

/**
 * Decrypt a base64-encoded encrypted value (IV + ciphertext + auth tag).
 * Returns the original plaintext string.
 */
export async function decryptToken(encryptedBase64: string): Promise<string> {
  const key = await getKey();
  const combined = base64ToBytes(encryptedBase64);

  if (combined.length < IV_LENGTH + 16) {
    throw new Error("Encrypted value is too short to contain IV and auth tag");
  }

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
