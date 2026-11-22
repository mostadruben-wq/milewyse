import type { AppState } from './types';

/**
 * Persistente lokale Speicherung.
 * Primär IndexedDB; falls nicht verfügbar (z. B. privater Modus) localStorage,
 * zuletzt In-Memory. Der Modus wird in der App angezeigt, damit klar ist, ob Daten dauerhaft sind.
 */

const DB_NAME = 't4-syncro-companion';
const STORE = 'kv';
const FILES = 'files';
const KEY = 'state';
const LS_KEY = 't4sc-state';

export type StorageMode = 'indexeddb' | 'localstorage' | 'memory';

let mode: StorageMode = 'memory';
let dbPromise: Promise<IDBDatabase> | null = null;
let memory: AppState | null = null;
const memFiles = new Map<string, Blob>();

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
          if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB blockiert'));
      } catch (e) {
        reject(e);
      }
    });
  }
  return dbPromise;
}

function idbGet(db: IDBDatabase): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, value: AppState): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadState(): Promise<unknown> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const db = await openDB();
      const s = await idbGet(db);
      mode = 'indexeddb';
      // Browser um dauerhaften Speicher bitten (verhindert automatisches Löschen, wo unterstützt)
      try {
        await navigator.storage?.persist?.();
      } catch {
        /* optional */
      }
      return s;
    }
  } catch {
    /* weiter mit Fallback */
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    mode = 'localstorage';
    return raw ? JSON.parse(raw) : null;
  } catch {
    mode = 'memory';
    return memory;
  }
}

export async function saveState(state: AppState): Promise<void> {
  if (mode === 'indexeddb') {
    try {
      await idbPut(await openDB(), state);
      return;
    } catch {
      mode = 'localstorage';
    }
  }
  if (mode === 'localstorage') {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      return;
    } catch {
      mode = 'memory';
    }
  }
  memory = state;
}

export async function clearState(): Promise<void> {
  memory = null;
  await clearFiles();
  try {
    if (mode === 'indexeddb') {
      const db = await openDB();
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
  } catch {
    /* ignorieren */
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignorieren */
  }
}

export const storageMode = () => mode;

/* ---------- Dateispeicher (Dokumente, Seitenbilder) ---------- */

function filesTx<T>(mode: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(FILES, mode);
        const req = fn(tx.objectStore(FILES));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Speichern abgebrochen (Speicher voll?)'));
      })
  );
}

export async function putFile(id: string, blob: Blob): Promise<void> {
  if (mode !== 'indexeddb') {
    memFiles.set(id, blob);
    return;
  }
  await filesTx('readwrite', (st) => st.put(blob, id));
}

export async function getFile(id: string): Promise<Blob | null> {
  if (mode !== 'indexeddb') return memFiles.get(id) ?? null;
  return ((await filesTx<Blob>('readonly', (st) => st.get(id))) as Blob | undefined) ?? null;
}

export async function deleteFiles(ids: string[]): Promise<void> {
  ids.forEach((id) => memFiles.delete(id));
  if (mode !== 'indexeddb' || !ids.length) return;
  await filesTx('readwrite', (st) => {
    ids.forEach((id) => st.delete(id));
  });
}

export async function clearFiles(): Promise<void> {
  memFiles.clear();
  if (mode !== 'indexeddb') return;
  try {
    await filesTx('readwrite', (st) => st.clear());
  } catch {
    /* ignorieren */
  }
}

/** Belegter Speicher (Schätzung des Browsers). */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}
