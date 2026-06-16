/**
 * Pure cryptographic primitives built on the Web Crypto API. No Svelte, no
 * Dexie, no worker plumbing — just functions, so they unit-test in isolation.
 *
 * Scheme: a passphrase is stretched with PBKDF2-SHA256 (≥210k iterations,
 * random 16-byte salt) into an AES-GCM-256 key. Payloads are encrypted with a
 * fresh random 12-byte IV per call. Ciphertext + IV travel together as an
 * EncryptedBlob with both fields base64-encoded so they survive JSON and
 * IndexedDB equally well.
 */

export const KDF_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

/** Sentinel encrypted at vault setup; decrypting it proves the passphrase. */
export const VAULT_VERIFIER_TOKEN = 'crescent-vault-verifier-v1';

export interface EncryptedBlob {
  /** base64-encoded 12-byte initialization vector. */
  iv: string;
  /** base64-encoded AES-GCM ciphertext (includes the auth tag). */
  ct: string;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto (crypto.subtle) is not available in this environment');
  }
  return c.subtle;
}

// TS's DOM lib types Web Crypto byte inputs as BufferSource over a plain
// ArrayBuffer; our Uint8Arrays are ArrayBufferLike. They are compatible at
// runtime, so narrow with a single tiny cast helper.
function buf(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function randomSalt(): Uint8Array {
  return randomBytes(SALT_BYTES);
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  // Chunk to avoid call-stack limits on very large inputs.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Derive an AES-GCM-256 key from a passphrase + salt via PBKDF2-SHA256.
 * The returned key is non-extractable.
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = KDF_ITERATIONS
): Promise<CryptoKey> {
  if (iterations < KDF_ITERATIONS) {
    throw new Error(`PBKDF2 iterations must be >= ${KDF_ITERATIONS}`);
  }
  const baseKey = await subtle().importKey(
    'raw',
    buf(encoder.encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<EncryptedBlob> {
  const iv = randomBytes(IV_BYTES);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(data));
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

export async function decryptBytes(key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
  const plain = await subtle().decrypt(
    { name: 'AES-GCM', iv: buf(fromBase64(blob.iv)) },
    key,
    buf(fromBase64(blob.ct))
  );
  return new Uint8Array(plain);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  return encryptBytes(key, encoder.encode(JSON.stringify(value)));
}

export async function decryptJson<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const bytes = await decryptBytes(key, blob);
  return JSON.parse(decoder.decode(bytes)) as T;
}

/**
 * Verify a derived key against a stored verifier blob. Returns true if the key
 * decrypts it to the expected token, false on any AES-GCM tag failure.
 */
export async function verifyKey(key: CryptoKey, verifier: EncryptedBlob): Promise<boolean> {
  try {
    const token = await decryptJson<string>(key, verifier);
    return token === VAULT_VERIFIER_TOKEN;
  } catch {
    return false;
  }
}

export async function makeVerifier(key: CryptoKey): Promise<EncryptedBlob> {
  return encryptJson(key, VAULT_VERIFIER_TOKEN);
}

/** Hex-encoded SHA-256 of a UTF-8 string. Used for transaction fingerprints. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await subtle().digest('SHA-256', buf(encoder.encode(text)));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}
