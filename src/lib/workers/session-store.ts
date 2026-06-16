/**
 * Optional session persistence for "keep me unlocked on this device".
 *
 * We store the *non-extractable* AES CryptoKey object in its own small
 * IndexedDB database. IndexedDB structured-clones CryptoKey objects while
 * preserving non-extractability, so the raw key bytes are never exposed to JS —
 * a meaningfully safer "remember me" than persisting a passphrase or key bytes.
 *
 * This module is worker-only (uses the worker's `indexedDB`). A timestamp rides
 * alongside the key so the vault store can enforce idle expiry even across full
 * app restarts (when no in-app timer was running).
 */

const DB_NAME = 'crescent-session';
const STORE = 'vault';
const RECORD_KEY = 'current';

interface SessionRecord {
  key: CryptoKey;
  ts: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putSession(key: CryptoKey, ts: number = Date.now()): Promise<void> {
  const db = await openDB();
  try {
    await run(db, 'readwrite', (s) => s.put({ key, ts } satisfies SessionRecord, RECORD_KEY));
  } finally {
    db.close();
  }
}

export async function getSession(): Promise<SessionRecord | null> {
  const db = await openDB();
  try {
    const rec = await run<SessionRecord | undefined>(db, 'readonly', (s) => s.get(RECORD_KEY));
    return rec ?? null;
  } finally {
    db.close();
  }
}

export async function clearSession(): Promise<void> {
  const db = await openDB();
  try {
    await run(db, 'readwrite', (s) => s.delete(RECORD_KEY));
  } finally {
    db.close();
  }
}
