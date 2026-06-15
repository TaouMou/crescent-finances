/**
 * Typed request/response protocol shared between the main thread and the single
 * crypto/import worker. Every request carries a `reqId`; the worker echoes it on
 * the matching response so the client can resolve the right promise.
 */

import type { EncryptedBlob } from '$lib/crypto/crypto';

export interface SetupReq {
  type: 'setup';
  passphrase: string;
  iterations?: number;
}
export interface SetupRes {
  saltB64: string;
  iterations: number;
  verifier: EncryptedBlob;
}

export interface UnlockReq {
  type: 'unlock';
  passphrase: string;
  saltB64: string;
  iterations: number;
  verifier: EncryptedBlob;
}
export interface UnlockRes {
  ok: boolean;
}

export interface LockReq {
  type: 'lock';
}

export interface EncryptReq {
  type: 'encrypt';
  value: unknown;
}
export interface DecryptReq {
  type: 'decrypt';
  blob: EncryptedBlob;
}

export interface EncryptManyReq {
  type: 'encryptMany';
  values: unknown[];
}
export interface DecryptManyReq {
  type: 'decryptMany';
  blobs: EncryptedBlob[];
}

export type WorkerRequestBody =
  | SetupReq
  | UnlockReq
  | LockReq
  | EncryptReq
  | DecryptReq
  | EncryptManyReq
  | DecryptManyReq;

export type WorkerRequest = WorkerRequestBody & { reqId: number };

export type WorkerResponse =
  | { reqId: number; ok: true; result: unknown }
  | { reqId: number; ok: false; error: string };

/** Maps a request `type` to its result shape, for typed client calls. */
export interface ResultMap {
  setup: SetupRes;
  unlock: UnlockRes;
  lock: void;
  encrypt: EncryptedBlob;
  decrypt: unknown;
  encryptMany: EncryptedBlob[];
  decryptMany: unknown[];
}
