import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type OfflineMutationKind =
  | 'PLACE_ORDER'
  | 'KDS_STATUS'
  | 'SERVICE_REQUEST_CLAIM';

export interface OfflineMutationRecord {
  idempotencyKey: string;
  outletId: string;
  kind: OfflineMutationKind;
  payload: Record<string, unknown>;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

export interface OfflineSnapshotRecord<T = unknown> {
  key: string;
  outletId: string;
  updatedAt: string;
  data: T;
}

interface PlateBeamOfflineDB extends DBSchema {
  mutations: {
    key: string;
    value: OfflineMutationRecord;
    indexes: {
      'by-outlet': string;
      'by-queuedAt': string;
    };
  };
  snapshots: {
    key: string;
    value: OfflineSnapshotRecord;
    indexes: {
      'by-outlet': string;
    };
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
}

const DB_NAME = 'platebeam-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PlateBeamOfflineDB>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<PlateBeamOfflineDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in browser contexts.'));
  }

  if (!dbPromise) {
    dbPromise = openDB<PlateBeamOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('mutations')) {
          const store = db.createObjectStore('mutations', {
            keyPath: 'idempotencyKey',
          });
          store.createIndex('by-outlet', 'outletId');
          store.createIndex('by-queuedAt', 'queuedAt');
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapStore = db.createObjectStore('snapshots', {
            keyPath: 'key',
          });
          snapStore.createIndex('by-outlet', 'outletId');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Request persistent storage so the browser does not evict queued POS/KDS mutations
 * under storage pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    const already = await navigator.storage.persisted();
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getOrCreateClientId(): Promise<string> {
  if (typeof window === 'undefined') return 'ssr-client';
  try {
    const db = await getOfflineDb();
    const existing = await db.get('meta', 'clientId');
    if (existing?.value) return existing.value;
    const generated = `pb-${crypto.randomUUID()}`;
    await db.put('meta', { key: 'clientId', value: generated });
    return generated;
  } catch {
    return `pb-ephemeral-${Date.now()}`;
  }
}

export async function enqueueOfflineMutation(
  input: Omit<OfflineMutationRecord, 'attempts' | 'queuedAt'> & { queuedAt?: string },
): Promise<OfflineMutationRecord> {
  const db = await getOfflineDb();
  const record: OfflineMutationRecord = {
    idempotencyKey: input.idempotencyKey,
    outletId: input.outletId,
    kind: input.kind,
    payload: input.payload,
    queuedAt: input.queuedAt ?? new Date().toISOString(),
    attempts: 0,
  };
  await db.put('mutations', record);
  return record;
}

export async function listPendingMutations(
  outletId?: string,
): Promise<OfflineMutationRecord[]> {
  const db = await getOfflineDb();
  const all = outletId
    ? await db.getAllFromIndex('mutations', 'by-outlet', outletId)
    : await db.getAll('mutations');
  return all.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function removeMutations(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await getOfflineDb();
  const tx = db.transaction('mutations', 'readwrite');
  await Promise.all(keys.map((key) => tx.store.delete(key)));
  await tx.done;
}

export async function markMutationAttemptFailed(
  idempotencyKey: string,
  errorMessage: string,
): Promise<void> {
  const db = await getOfflineDb();
  const existing = await db.get('mutations', idempotencyKey);
  if (!existing) return;
  existing.attempts += 1;
  existing.lastError = errorMessage;
  await db.put('mutations', existing);
}

export async function saveOfflineSnapshot<T>(
  key: string,
  outletId: string,
  data: T,
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await getOfflineDb();
    await db.put('snapshots', {
      key,
      outletId,
      updatedAt: new Date().toISOString(),
      data,
    });
  } catch {
    // Best-effort cache write
  }
}

export async function readOfflineSnapshot<T>(
  key: string,
): Promise<OfflineSnapshotRecord<T> | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await getOfflineDb();
    const record = await db.get('snapshots', key);
    return (record as OfflineSnapshotRecord<T> | undefined) ?? null;
  } catch {
    return null;
  }
}
