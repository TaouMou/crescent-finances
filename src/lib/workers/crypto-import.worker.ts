/**
 * The single Web Worker that owns all PBKDF2/AES-GCM work (and, from M2, CSV
 * parsing). It is a thin shell: it wires `onmessage`/`postMessage` to the
 * environment-agnostic CryptoCore, which does the actual work and holds the key.
 */

/// <reference lib="webworker" />

import { CryptoCore } from './crypto-core';
import type { WorkerRequest, WorkerResponse } from './protocol';

const core = new CryptoCore();

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { reqId, ...body } = event.data;
  try {
    const result = await core.handle(body);
    const res: WorkerResponse = { reqId, ok: true, result };
    self.postMessage(res);
  } catch (err) {
    const res: WorkerResponse = {
      reqId,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
    self.postMessage(res);
  }
};

export {};
