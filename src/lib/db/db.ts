/**
 * Dexie/IndexedDB schema. Financial rows are stored ENCRYPTED — only
 * non-sensitive index keys (fingerprint for dedup, dateBucket for
 * range/virtualization) are kept in clear. The encrypted payload lives in
 * `blob`. Configuration is financial-data-free, so it is stored as plaintext.
 */

import Dexie, { type Table } from 'dexie';
import type { EncryptedBlob } from '$lib/crypto/crypto';
import type { AppConfig } from '$lib/types';

/** A stored, at-rest transaction: clear index keys + encrypted body. */
export interface StoredTransaction {
  id: string;
  /** sha256 dedup key; unique. */
  fingerprint: string;
  /** YYYY-MM bucket for cheap range queries without decrypting. */
  dateBucket: string;
  blob: EncryptedBlob;
}

/** Key/value store for vault material and small singletons. */
export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface ConfigRecord {
  /** Always 'current'. */
  id: string;
  config: AppConfig;
}

export class CrescentDB extends Dexie {
  meta!: Table<MetaRecord, string>;
  transactions!: Table<StoredTransaction, string>;
  config!: Table<ConfigRecord, string>;

  constructor(name = 'crescent') {
    super(name);
    this.version(1).stores({
      meta: 'key',
      transactions: 'id, &fingerprint, dateBucket',
      config: 'id'
    });
  }
}

export const db = new CrescentDB();
