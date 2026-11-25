'use client';

import { CloudOff, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';
import type { SyncStatusSnapshot } from '@/lib/offline/sync-manager';

interface OfflineBannerProps {
  status: SyncStatusSnapshot;
  onSyncNow: () => void;
  variant?: 'default' | 'kds';
}

export function OfflineBanner({
  status,
  onSyncNow,
  variant = 'default',
}: OfflineBannerProps) {
  const showBanner = !status.isOnline || status.pendingCount > 0 || status.isSyncing;
  if (!showBanner) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--pb-muted)]">
        <Wifi className="size-3.5 text-[var(--pb-olive)]" aria-hidden="true" />
        <span>Live</span>
        {status.persistedStorage && (
          <span
            title="Persistent IndexedDB storage granted"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--pb-border)] px-2 py-0.5 text-[11px]"
          >
            <ShieldCheck className="size-3 text-[var(--pb-olive)]" aria-hidden="true" />
            Offline Ready
          </span>
        )}
      </div>
    );
  }

  const isOffline = !status.isOnline;
  const containerClass =
    variant === 'kds'
      ? isOffline
        ? 'border-[#E04F44] bg-[#2B1716] text-[#F4F6F8]'
        : 'border-[#E5A93C] bg-[#282114] text-[#F4F6F8]'
      : isOffline
        ? 'border-[var(--pb-chili)] bg-[var(--pb-chili)]/10 text-[var(--pb-ink)]'
        : 'border-[var(--pb-turmeric)] bg-[var(--pb-turmeric)]/12 text-[var(--pb-ink)]';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${containerClass}`}
    >
      <div className="flex items-center gap-2.5">
        <CloudOff
          className={`size-4 shrink-0 ${isOffline ? 'text-[var(--pb-chili)]' : 'text-[var(--pb-turmeric)]'}`}
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold">
            {isOffline
              ? 'Offline Mode — Operations Queued in IndexedDB'
              : `Reconnecting — ${status.pendingCount} queued mutation${status.pendingCount === 1 ? '' : 's'} pending`}
          </p>
          <p className="text-xs opacity-80">
            {status.pendingCount} queued action{status.pendingCount === 1 ? '' : 's'}
            {status.lastSyncedAt
              ? ` · Last synced ${new Date(status.lastSyncedAt).toLocaleTimeString()}`
              : ''}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={isOffline || status.isSyncing}
        onClick={onSyncNow}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--pb-ink)] disabled:opacity-50"
      >
        <RefreshCw
          className={`size-3.5 ${status.isSyncing ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {status.isSyncing ? 'Syncing…' : 'Sync Delta Now'}
      </button>
    </div>
  );
}
