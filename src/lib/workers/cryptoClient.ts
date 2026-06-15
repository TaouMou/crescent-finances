/**
 * Main-thread client for the crypto/import worker. Wraps the postMessage
 * protocol in promises keyed by an incrementing reqId, and lazily spins the
 * worker up on first use. One shared instance is exported as `cryptoWorker`.
 */

import type {
  ResultMap,
  WorkerRequest,
  WorkerRequestBody,
  WorkerResponse
} from './protocol';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class CryptoClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./crypto-import.worker.ts', import.meta.url), {
        type: 'module'
      });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const res = event.data;
        const entry = this.pending.get(res.reqId);
        if (!entry) return;
        this.pending.delete(res.reqId);
        if (res.ok) entry.resolve(res.result);
        else entry.reject(new Error(res.error));
      };
      this.worker.onerror = (event) => {
        // A worker-level error fails every outstanding request.
        const err = new Error(event.message || 'worker error');
        for (const [, entry] of this.pending) entry.reject(err);
        this.pending.clear();
      };
    }
    return this.worker;
  }

  private send<T extends WorkerRequestBody>(body: T): Promise<ResultMap[T['type']]> {
    const worker = this.ensureWorker();
    const reqId = this.nextId++;
    const req: WorkerRequest = { ...body, reqId };
    return new Promise<ResultMap[T['type']]>((resolve, reject) => {
      this.pending.set(reqId, {
        resolve: resolve as (v: unknown) => void,
        reject
      });
      worker.postMessage(req);
    });
  }

  setup(passphrase: string, iterations?: number) {
    return this.send({ type: 'setup', passphrase, iterations });
  }

  unlock(args: { passphrase: string; saltB64: string; iterations: number; verifier: ResultMap['setup']['verifier'] }) {
    return this.send({ type: 'unlock', ...args });
  }

  lock() {
    return this.send({ type: 'lock' });
  }

  encrypt(value: unknown) {
    return this.send({ type: 'encrypt', value });
  }

  decrypt<T>(blob: ResultMap['encrypt']): Promise<T> {
    return this.send({ type: 'decrypt', blob }) as Promise<T>;
  }

  encryptMany(values: unknown[]) {
    return this.send({ type: 'encryptMany', values });
  }

  decryptMany<T>(blobs: ResultMap['encrypt'][]): Promise<T[]> {
    return this.send({ type: 'decryptMany', blobs }) as Promise<T[]>;
  }

  /** Tear the worker down (e.g. on full reset). */
  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

export const cryptoWorker = new CryptoClient();
