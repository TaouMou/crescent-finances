// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CryptoCore } from '../../src/lib/workers/crypto-core';
import type { EncryptedBlob } from '../../src/lib/crypto/crypto';

async function setup(passphrase = 'correct horse') {
  const core = new CryptoCore();
  const res = (await core.handle({ type: 'setup', passphrase })) as {
    saltB64: string;
    iterations: number;
    verifier: EncryptedBlob;
  };
  return { core, res };
}

describe('CryptoCore protocol', () => {
  it('setup leaves the vault unlocked and returns material', async () => {
    const { core, res } = await setup();
    expect(core.unlocked).toBe(true);
    expect(res.saltB64).toBeTypeOf('string');
    expect(res.iterations).toBeGreaterThanOrEqual(210_000);
    expect(res.verifier.iv).toBeTypeOf('string');
  });

  it('encrypt then decrypt round-trips a value', async () => {
    const { core } = await setup();
    const blob = (await core.handle({ type: 'encrypt', value: { a: 1 } })) as EncryptedBlob;
    const back = await core.handle({ type: 'decrypt', blob });
    expect(back).toEqual({ a: 1 });
  });

  it('encryptMany / decryptMany round-trip a batch', async () => {
    const { core } = await setup();
    const values = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const blobs = (await core.handle({ type: 'encryptMany', values })) as EncryptedBlob[];
    expect(blobs).toHaveLength(3);
    const back = await core.handle({ type: 'decryptMany', blobs });
    expect(back).toEqual(values);
  });

  it('unlock succeeds with the right passphrase', async () => {
    const { res } = await setup('s3cret-passphrase');
    const fresh = new CryptoCore();
    const out = (await fresh.handle({
      type: 'unlock',
      passphrase: 's3cret-passphrase',
      saltB64: res.saltB64,
      iterations: res.iterations,
      verifier: res.verifier
    })) as { ok: boolean };
    expect(out.ok).toBe(true);
    expect(fresh.unlocked).toBe(true);
  });

  it('unlock fails cleanly with the wrong passphrase', async () => {
    const { res } = await setup('s3cret-passphrase');
    const fresh = new CryptoCore();
    const out = (await fresh.handle({
      type: 'unlock',
      passphrase: 'WRONG',
      saltB64: res.saltB64,
      iterations: res.iterations,
      verifier: res.verifier
    })) as { ok: boolean };
    expect(out.ok).toBe(false);
    expect(fresh.unlocked).toBe(false);
  });

  it('lock clears the key and blocks further crypto', async () => {
    const { core } = await setup();
    await core.handle({ type: 'lock' });
    expect(core.unlocked).toBe(false);
    await expect(core.handle({ type: 'encrypt', value: 1 })).rejects.toThrow(/locked/);
  });
});
