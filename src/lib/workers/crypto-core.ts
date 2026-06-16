/**
 * Environment-agnostic core of the crypto worker. Holds the derived AES-GCM key
 * in memory and answers protocol requests. The key NEVER leaves this module — it
 * is created here, used here, and dropped on lock; the main thread only ever
 * sees opaque encrypted blobs and a boolean unlock result.
 *
 * Kept free of `self`/`postMessage` so it can be exercised directly in tests.
 */

import {
  KDF_ITERATIONS,
  decryptJson,
  deriveKey,
  encryptJson,
  fromBase64,
  makeVerifier,
  randomSalt,
  toBase64,
  verifyKey
} from '$lib/crypto/crypto';
import { clearSession, getSession, putSession } from './session-store';
import type { CryptoRequestBody } from './protocol';

export class CryptoCore {
  private key: CryptoKey | null = null;

  get unlocked(): boolean {
    return this.key !== null;
  }

  lock(): void {
    this.key = null;
  }

  private requireKey(): CryptoKey {
    if (!this.key) throw new Error('vault is locked');
    return this.key;
  }

  /** Dispatch a protocol request to its handler and return the result payload. */
  async handle(req: CryptoRequestBody): Promise<unknown> {
    switch (req.type) {
      case 'setup': {
        const iterations = req.iterations ?? KDF_ITERATIONS;
        const salt = randomSalt();
        this.key = await deriveKey(req.passphrase, salt, iterations);
        const verifier = await makeVerifier(this.key);
        return { saltB64: toBase64(salt), iterations, verifier };
      }
      case 'unlock': {
        const key = await deriveKey(req.passphrase, fromBase64(req.saltB64), req.iterations);
        const ok = await verifyKey(key, req.verifier);
        this.key = ok ? key : null;
        return { ok };
      }
      case 'lock': {
        this.lock();
        return undefined;
      }
      case 'remember': {
        if (!this.key) return { ok: false };
        await putSession(this.key);
        return { ok: true };
      }
      case 'resume': {
        const rec = await getSession();
        if (rec && Date.now() - rec.ts <= req.maxAgeMs) {
          this.key = rec.key;
          await putSession(rec.key); // refresh timestamp on resume
          return { resumed: true };
        }
        await clearSession();
        return { resumed: false };
      }
      case 'forget': {
        await clearSession();
        return undefined;
      }
      case 'touch': {
        const rec = await getSession();
        if (rec) await putSession(rec.key);
        return undefined;
      }
      case 'encrypt':
        return encryptJson(this.requireKey(), req.value);
      case 'decrypt':
        return decryptJson(this.requireKey(), req.blob);
      case 'encryptMany': {
        const key = this.requireKey();
        return Promise.all(req.values.map((v) => encryptJson(key, v)));
      }
      case 'decryptMany': {
        const key = this.requireKey();
        return Promise.all(req.blobs.map((b) => decryptJson(key, b)));
      }
      default: {
        const _exhaustive: never = req;
        throw new Error(`unknown request: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
