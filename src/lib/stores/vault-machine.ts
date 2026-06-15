/**
 * Pure state machine for the vault. No Svelte, no async — just (state, event) ->
 * state, so the lifecycle is exhaustively unit-testable. The store in vault.ts
 * drives the side effects (worker, repos) and feeds the results back as events.
 */

export type VaultStatus =
  | 'loading' // checking whether a vault exists
  | 'uninitialized' // no vault yet — first run, must set a passphrase
  | 'locked' // vault exists, awaiting passphrase
  | 'unlocking' // verifying a passphrase
  | 'unlocked'; // key held in worker, app usable

export type VaultEvent =
  | { type: 'checked'; exists: boolean }
  | { type: 'setupDone' }
  | { type: 'unlockStart' }
  | { type: 'unlockOk' }
  | { type: 'unlockFail' }
  | { type: 'lock' }
  | { type: 'reset' };

export function vaultTransition(state: VaultStatus, event: VaultEvent): VaultStatus {
  switch (event.type) {
    case 'checked':
      return state === 'loading' ? (event.exists ? 'locked' : 'uninitialized') : state;
    case 'setupDone':
      return state === 'uninitialized' ? 'unlocked' : state;
    case 'unlockStart':
      return state === 'locked' ? 'unlocking' : state;
    case 'unlockOk':
      return state === 'unlocking' ? 'unlocked' : state;
    case 'unlockFail':
      return state === 'unlocking' ? 'locked' : state;
    case 'lock':
      return state === 'unlocked' ? 'locked' : state;
    case 'reset':
      return 'uninitialized';
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
