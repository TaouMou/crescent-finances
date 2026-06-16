/**
 * Thin repositories over the Dexie tables. These never touch crypto directly —
 * callers pass already-encrypted blobs in and get encrypted blobs out, keeping
 * key handling confined to the worker.
 */

import type { EncryptedBlob } from '$lib/crypto/crypto';
import type { AppConfig, Transaction } from '$lib/types';
import { db, type CrescentDB, type StoredTransaction } from './db';

export const META_KEYS = {
  saltB64: 'kdf.saltB64',
  iterations: 'kdf.iterations',
  verifier: 'kdf.verifier',
  schemaVersion: 'schemaVersion'
} as const;

export interface VaultMaterial {
  saltB64: string;
  iterations: number;
  verifier: EncryptedBlob;
}

export class VaultRepo {
  constructor(private database: CrescentDB = db) {}

  async isInitialized(): Promise<boolean> {
    const salt = await this.database.meta.get(META_KEYS.saltB64);
    return salt !== undefined;
  }

  async getMaterial(): Promise<VaultMaterial | null> {
    const [salt, iterations, verifier] = await Promise.all([
      this.database.meta.get(META_KEYS.saltB64),
      this.database.meta.get(META_KEYS.iterations),
      this.database.meta.get(META_KEYS.verifier)
    ]);
    if (!salt || !iterations || !verifier) return null;
    return {
      saltB64: salt.value as string,
      iterations: iterations.value as number,
      verifier: verifier.value as EncryptedBlob
    };
  }

  async saveMaterial(material: VaultMaterial): Promise<void> {
    await this.database.meta.bulkPut([
      { key: META_KEYS.saltB64, value: material.saltB64 },
      { key: META_KEYS.iterations, value: material.iterations },
      { key: META_KEYS.verifier, value: material.verifier }
    ]);
  }

  /** Wipe everything — used by "forget passphrase / start over". */
  async reset(): Promise<void> {
    await Promise.all([
      this.database.meta.clear(),
      this.database.transactions.clear(),
      this.database.config.clear()
    ]);
  }
}

/** Derive the YYYY-MM bucket from an ISO date. */
export function dateBucketOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export class TransactionRepo {
  constructor(private database: CrescentDB = db) {}

  async count(): Promise<number> {
    return this.database.transactions.count();
  }

  async existingFingerprints(fingerprints: string[]): Promise<Set<string>> {
    const found = await this.database.transactions
      .where('fingerprint')
      .anyOf(fingerprints)
      .toArray();
    return new Set(found.map((r) => r.fingerprint));
  }

  /** Insert encrypted rows, skipping any whose fingerprint already exists. */
  async addEncrypted(
    rows: Array<{ tx: Pick<Transaction, 'id' | 'fingerprint' | 'date'>; blob: EncryptedBlob }>
  ): Promise<{ added: number; skipped: number }> {
    const fps = rows.map((r) => r.tx.fingerprint);
    const existing = await this.existingFingerprints(fps);
    const fresh: StoredTransaction[] = [];
    const seen = new Set<string>();
    for (const { tx, blob } of rows) {
      if (existing.has(tx.fingerprint) || seen.has(tx.fingerprint)) continue;
      seen.add(tx.fingerprint);
      fresh.push({ id: tx.id, fingerprint: tx.fingerprint, dateBucket: dateBucketOf(tx.date), blob });
    }
    if (fresh.length) await this.database.transactions.bulkAdd(fresh);
    return { added: fresh.length, skipped: rows.length - fresh.length };
  }

  /** All encrypted blobs (caller decrypts in the worker). */
  async allEncrypted(): Promise<StoredTransaction[]> {
    return this.database.transactions.orderBy('dateBucket').toArray();
  }

  /** Overwrite the encrypted blob for existing rows (same id/fingerprint). */
  async bulkUpdateBlobs(rows: StoredTransaction[]): Promise<void> {
    await this.database.transactions.bulkPut(rows);
  }

  async clear(): Promise<void> {
    await this.database.transactions.clear();
  }
}

export class ConfigRepo {
  constructor(private database: CrescentDB = db) {}

  async get(): Promise<AppConfig | null> {
    const rec = await this.database.config.get('current');
    return rec?.config ?? null;
  }

  async save(config: AppConfig): Promise<void> {
    await this.database.config.put({ id: 'current', config });
  }
}

export const vaultRepo = new VaultRepo();
export const transactionRepo = new TransactionRepo();
export const configRepo = new ConfigRepo();
