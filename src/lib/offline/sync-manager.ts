import {
  enqueueOfflineMutation,
  getOrCreateClientId,
  listPendingMutations,
  markMutationAttemptFailed,
  removeMutations,
  requestPersistentStorage,
  type OfflineMutationKind,
  type OfflineMutationRecord,
} from './db';

export interface SyncDeltaResult {
  syncedCount: number;
  remainingCount: number;
  failedKeys: string[];
  persistedStorage: boolean;
}

export interface SyncStatusSnapshot {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  persistedStorage: boolean;
}

type SyncListener = (status: SyncStatusSnapshot) => void;

class OfflineSyncManager {
  private listeners = new Set<SyncListener>();
  private isSyncing = false;
  private lastSyncedAt: string | null = null;
  private persistedStorage = false;
  private activeOutletId: string | null = null;
  private initialized = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  init(outletId: string): () => void {
    this.activeOutletId = outletId;
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    if (!this.initialized) {
      this.initialized = true;
      void requestPersistentStorage().then((persisted) => {
        this.persistedStorage = persisted;
        void this.notify();
      });
    }

    const handleOnline = () => {
      void this.notify();
      if (this.activeOutletId) {
        void this.flush(this.activeOutletId);
      }
    };

    const handleOffline = () => {
      void this.notify();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void this.notify();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
    };
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    void this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getStatus(): Promise<SyncStatusSnapshot> {
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    let pendingCount = 0;
    if (typeof window !== 'undefined') {
      try {
        const pending = await listPendingMutations(this.activeOutletId ?? undefined);
        pendingCount = pending.length;
      } catch {
        pendingCount = 0;
      }
    }
    return {
      isOnline,
      pendingCount,
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      persistedStorage: this.persistedStorage,
    };
  }

  private async notify(): Promise<void> {
    const status = await this.getStatus();
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  async queueMutation(
    outletId: string,
    kind: OfflineMutationKind,
    payload: Record<string, unknown>,
    idempotencyKey = `offline-${crypto.randomUUID()}`,
  ): Promise<OfflineMutationRecord> {
    const record = await enqueueOfflineMutation({
      outletId,
      kind,
      payload,
      idempotencyKey,
    });
    await this.notify();
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void this.flush(outletId);
    }
    return record;
  }

  async flush(outletId: string): Promise<SyncDeltaResult> {
    if (this.isSyncing) {
      const remaining = await listPendingMutations(outletId);
      return {
        syncedCount: 0,
        remainingCount: remaining.length,
        failedKeys: [],
        persistedStorage: this.persistedStorage,
      };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const remaining = await listPendingMutations(outletId);
      return {
        syncedCount: 0,
        remainingCount: remaining.length,
        failedKeys: [],
        persistedStorage: this.persistedStorage,
      };
    }

    const pending = await listPendingMutations(outletId);
    if (pending.length === 0) {
      return {
        syncedCount: 0,
        remainingCount: 0,
        failedKeys: [],
        persistedStorage: this.persistedStorage,
      };
    }

    this.isSyncing = true;
    await this.notify();

    try {
      const clientId = await getOrCreateClientId();
      const batch = pending.slice(0, 100);

      const res = await fetch('/api/v1/sync/delta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId,
          clientId,
          mutations: batch.map((m) => ({
            idempotencyKey: m.idempotencyKey,
            kind: m.kind,
            payload: m.payload,
            queuedAt: m.queuedAt,
          })),
        }),
      });

      if (!res.ok) {
        const msg = `Sync failed with HTTP ${res.status}`;
        await Promise.all(
          batch.map((m) => markMutationAttemptFailed(m.idempotencyKey, msg)),
        );
        this.scheduleRetry(outletId, batch[0]?.attempts ?? 1);
        const remaining = await listPendingMutations(outletId);
        return {
          syncedCount: 0,
          remainingCount: remaining.length,
          failedKeys: batch.map((b) => b.idempotencyKey),
          persistedStorage: this.persistedStorage,
        };
      }

      const body = (await res.json().catch(() => ({}))) as {
        acceptedKeys?: string[];
        rejected?: Array<{ idempotencyKey: string; error?: string }>;
      };

      const rejectedMap = new Map(
        (body.rejected ?? []).map((r) => [r.idempotencyKey, r.error ?? 'Rejected']),
      );
      const acceptedKeys =
        body.acceptedKeys ??
        batch
          .map((b) => b.idempotencyKey)
          .filter((key) => !rejectedMap.has(key));

      await removeMutations(acceptedKeys);

      for (const [key, err] of rejectedMap.entries()) {
        await markMutationAttemptFailed(key, err);
      }

      this.lastSyncedAt = new Date().toISOString();
      const remaining = await listPendingMutations(outletId);
      if (remaining.length > 0 && rejectedMap.size === 0) {
        void this.flush(outletId);
      }

      return {
        syncedCount: acceptedKeys.length,
        remainingCount: remaining.length,
        failedKeys: Array.from(rejectedMap.keys()),
        persistedStorage: this.persistedStorage,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      for (const m of pending.slice(0, 100)) {
        await markMutationAttemptFailed(m.idempotencyKey, msg);
      }
      this.scheduleRetry(outletId, pending[0]?.attempts ?? 1);
      const remaining = await listPendingMutations(outletId);
      return {
        syncedCount: 0,
        remainingCount: remaining.length,
        failedKeys: [],
        persistedStorage: this.persistedStorage,
      };
    } finally {
      this.isSyncing = false;
      await this.notify();
    }
  }

  private scheduleRetry(outletId: string, attempts: number): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delayMs = Math.min(30_000, 1500 * 2 ** Math.min(attempts, 4));
    this.retryTimer = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        void this.flush(outletId);
      }
    }, delayMs);
  }
}

export const syncManager = new OfflineSyncManager();
