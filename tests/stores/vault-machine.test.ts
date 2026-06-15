import { describe, it, expect } from 'vitest';
import { vaultTransition, type VaultStatus } from '../../src/lib/stores/vault-machine';

describe('vault state machine', () => {
  it('boot with no vault → uninitialized', () => {
    expect(vaultTransition('loading', { type: 'checked', exists: false })).toBe('uninitialized');
  });

  it('boot with an existing vault → locked', () => {
    expect(vaultTransition('loading', { type: 'checked', exists: true })).toBe('locked');
  });

  it('first-run setup → unlocked', () => {
    expect(vaultTransition('uninitialized', { type: 'setupDone' })).toBe('unlocked');
  });

  it('unlock flow: locked → unlocking → unlocked', () => {
    const unlocking = vaultTransition('locked', { type: 'unlockStart' });
    expect(unlocking).toBe('unlocking');
    expect(vaultTransition(unlocking, { type: 'unlockOk' })).toBe('unlocked');
  });

  it('wrong passphrase: unlocking → locked', () => {
    expect(vaultTransition('unlocking', { type: 'unlockFail' })).toBe('locked');
  });

  it('lock only from unlocked', () => {
    expect(vaultTransition('unlocked', { type: 'lock' })).toBe('locked');
    // No-op from other states.
    expect(vaultTransition('locked', { type: 'lock' })).toBe('locked');
  });

  it('reset always returns to uninitialized', () => {
    const states: VaultStatus[] = ['loading', 'uninitialized', 'locked', 'unlocking', 'unlocked'];
    for (const s of states) {
      expect(vaultTransition(s, { type: 'reset' })).toBe('uninitialized');
    }
  });

  it('ignores out-of-order events', () => {
    // Can't unlock from unlocked, can't setup from locked.
    expect(vaultTransition('unlocked', { type: 'unlockStart' })).toBe('unlocked');
    expect(vaultTransition('locked', { type: 'setupDone' })).toBe('locked');
  });
});
