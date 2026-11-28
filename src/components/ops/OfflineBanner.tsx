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
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#A1A1AA]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#111115] px-2.5 py-1 font-mono text-[11px] text-[#F4F4F5]">
          <Wifi className="size-3.5 text-[#10B981]" aria-hidden="true" />
          <span>{variant === 'kds' ? 'KDS Link Live' : 'POS Link Live'}</span>
        </span>
        {status.persistedStorage && (
          <span
            title="Persistent IndexedDB storage granted"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#111115] px-2.5 py-1 font-mono text-[11px] text-[#A1A1AA]"
          >
            <ShieldCheck className="size-3 text-[#10B981]" aria-hidden="true" />
            Offline Ready
          </span>
        )}
      </div>
    );
  }

  const isOffline = !status.isOnline;
  const containerClass = isOffline
    ? 'border-[#EF4444]/50 bg-[#EF4444]/10 text-[#F4F4F5]'
    : 'border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F4F4F5]';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${containerClass}`}
    >
      <div className="flex items-center gap-3">
        <CloudOff
          className={`size-4 shrink-0 ${isOffline ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold text-[#F4F4F5]">
            {isOffline
              ? 'Offline Mode — Operations Queued in IndexedDB'
              : `Reconnecting — ${status.pendingCount} queued mutation${status.pendingCount === 1 ? '' : 's'} pending`}
          </p>
          <p className="font-mono text-xs text-[#A1A1AA]">
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
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#18181F] px-3.5 py-2 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412] disabled:opacity-50"
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
