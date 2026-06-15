/**
 * Two export/import paths:
 *
 *  (a) Encrypted full backup — the config plus every transaction, with the
 *      transactions left encrypted. The envelope carries the KDF salt/iterations
 *      and a verifier so it is self-contained: restore on any device with just
 *      the passphrase. The config itself is financial-data-free, so it travels
 *      in clear inside the envelope.
 *
 *  (b) Plaintext config template — just the config, hand-editable, no secrets.
 *
 * These functions are pure (data in, data out); the actual encryption/decryption
 * of transactions is done by the worker before/after calling here.
 */

import { z } from 'zod';
import type { EncryptedBlob } from '$lib/crypto/crypto';
import type { AppConfig } from '$lib/types';
import { configSchema, parseConfig } from './schema';

export const BACKUP_FORMAT = 'crescent-backup';

const encryptedBlobSchema = z.object({ iv: z.string(), ct: z.string() });

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  createdAt: z.string(),
  kdf: z.object({ saltB64: z.string(), iterations: z.number().int().positive() }),
  verifier: encryptedBlobSchema,
  config: configSchema,
  transactions: z.array(encryptedBlobSchema)
});

export type Backup = z.infer<typeof backupSchema>;

export interface BackupParts {
  config: AppConfig;
  kdf: { saltB64: string; iterations: number };
  verifier: EncryptedBlob;
  /** Already-encrypted transaction blobs. */
  transactions: EncryptedBlob[];
}

/** Assemble an encrypted backup envelope from its parts. */
export function buildBackup(parts: BackupParts, now: string = new Date().toISOString()): Backup {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: parts.config.schemaVersion,
    createdAt: now,
    kdf: parts.kdf,
    verifier: parts.verifier,
    config: parts.config as Backup['config'],
    transactions: parts.transactions
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

/** Parse + validate a backup file. Throws ZodError on malformed input. */
export function parseBackup(input: unknown): Backup {
  return backupSchema.parse(typeof input === 'string' ? JSON.parse(input) : input);
}

/** Export the config alone as a plaintext, hand-editable template. */
export function serializeConfigTemplate(config: AppConfig): string {
  return JSON.stringify(config, null, 2);
}

/** Import a plaintext config template. Throws ZodError on invalid input. */
export function parseConfigTemplate(input: unknown): AppConfig {
  return parseConfig(typeof input === 'string' ? JSON.parse(input) : input);
}
