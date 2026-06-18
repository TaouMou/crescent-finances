// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  buildBackup,
  parseBackup,
  serializeBackup,
  serializeConfigTemplate,
  parseConfigTemplate
} from '../../src/lib/config/backup';
import { emptyConfig, parseConfig } from '../../src/lib/config/schema';
import {
  deriveKey,
  encryptJson,
  decryptJson,
  makeVerifier,
  randomSalt,
  toBase64,
  type EncryptedBlob
} from '../../src/lib/crypto/crypto';
import type { Transaction } from '../../src/lib/types';
import exampleConfig from '../../public/example.config.json';

const sampleTx: Transaction = {
  id: 't1',
  fingerprint: 'abc',
  date: '2026-01-03',
  amount: 245000,
  label: 'VIREMENT SALAIRE',
  normalizedLabel: 'virement salaire',
  accountId: 'acc-checking',
  categoryId: null,
  entity: null,
  tagIds: [],
  importedAt: '2026-01-04T00:00:00.000Z',
  source: 'sample.csv'
};

describe('plaintext config template', () => {
  it('round-trips the example config through serialize/parse', () => {
    const cfg = parseConfig(exampleConfig);
    const json = serializeConfigTemplate(cfg);
    expect(parseConfigTemplate(json)).toEqual(cfg);
  });

  it('rejects malformed template JSON', () => {
    expect(() => parseConfigTemplate('{ not valid')).toThrow();
  });
});

describe('encrypted full backup', () => {
  it('round-trips config + encrypted transactions and restores on another device', async () => {
    const salt = randomSalt();
    const iterations = 210_000;
    const key = await deriveKey('my passphrase', salt, iterations);
    const verifier = await makeVerifier(key);

    const blob = await encryptJson(key, sampleTx);
    const backup = buildBackup({
      config: emptyConfig(),
      kdf: { saltB64: toBase64(salt), iterations },
      verifier,
      transactions: [{ fingerprint: sampleTx.fingerprint, iv: blob.iv, ct: blob.ct }]
    });

    // Serialize → wire → parse, simulating moving the file to a new device.
    const restored = parseBackup(serializeBackup(backup));
    expect(restored.format).toBe('crescent-backup');
    expect(restored.transactions).toHaveLength(1);
    expect(restored.transactions[0].fingerprint).toBe(sampleTx.fingerprint);

    // Re-derive from the restored salt and decrypt.
    const key2 = await deriveKey('my passphrase', randomSalt(), iterations); // wrong salt
    const { iv, ct } = restored.transactions[0];
    await expect(decryptJson(key2, { iv, ct })).rejects.toBeTruthy();

    const { fromBase64 } = await import('../../src/lib/crypto/crypto');
    const goodKey = await deriveKey('my passphrase', fromBase64(restored.kdf.saltB64), restored.kdf.iterations);
    const tx = await decryptJson<Transaction>(goodKey, { iv, ct });
    expect(tx).toEqual(sampleTx);
  });

  it('rejects a non-backup object', () => {
    expect(() => parseBackup({ format: 'something-else' })).toThrow();
  });
});
