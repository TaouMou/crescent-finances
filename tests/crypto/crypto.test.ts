// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  KDF_ITERATIONS,
  deriveKey,
  encryptJson,
  decryptJson,
  encryptBytes,
  decryptBytes,
  makeVerifier,
  verifyKey,
  randomSalt,
  toBase64,
  fromBase64
} from '../../src/lib/crypto/crypto';

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 128, 64]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe('deriveKey', () => {
  it('rejects iteration counts below the 210k floor', async () => {
    await expect(deriveKey('pw', randomSalt(), 100_000)).rejects.toThrow(/210000|>=/);
  });

  it('accepts the default iteration count', async () => {
    const key = await deriveKey('pw', randomSalt());
    expect(key).toBeDefined();
    expect(KDF_ITERATIONS).toBeGreaterThanOrEqual(210_000);
  });
});

describe('AES-GCM round-trip', () => {
  it('encrypts and decrypts JSON with the same key', async () => {
    const salt = randomSalt();
    const key = await deriveKey('correct horse battery staple', salt);
    const payload = { id: 'x', amount: -1299, label: 'café', tags: ['a', 'b'] };
    const blob = await encryptJson(key, payload);
    expect(blob.iv).toBeTypeOf('string');
    expect(blob.ct).toBeTypeOf('string');
    const back = await decryptJson<typeof payload>(key, blob);
    expect(back).toEqual(payload);
  });

  it('uses a fresh IV per call (ciphertext differs)', async () => {
    const key = await deriveKey('pw', randomSalt());
    const a = await encryptBytes(key, new Uint8Array([1, 2, 3]));
    const b = await encryptBytes(key, new Uint8Array([1, 2, 3]));
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ct).not.toEqual(b.ct);
    expect(await decryptBytes(key, a)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('fails to decrypt with the wrong passphrase', async () => {
    const salt = randomSalt();
    const right = await deriveKey('right', salt);
    const wrong = await deriveKey('wrong', salt);
    const blob = await encryptJson(right, { secret: 42 });
    await expect(decryptJson(wrong, blob)).rejects.toBeTruthy();
  });

  it('fails to decrypt with a different salt', async () => {
    const right = await deriveKey('pw', randomSalt());
    const other = await deriveKey('pw', randomSalt());
    const blob = await encryptJson(right, { secret: 42 });
    await expect(decryptJson(other, blob)).rejects.toBeTruthy();
  });
});

describe('verifier', () => {
  it('verifies the correct key and rejects the wrong one', async () => {
    const salt = randomSalt();
    const key = await deriveKey('pw', salt);
    const verifier = await makeVerifier(key);
    expect(await verifyKey(key, verifier)).toBe(true);

    const other = await deriveKey('different', salt);
    expect(await verifyKey(other, verifier)).toBe(false);
  });
});
