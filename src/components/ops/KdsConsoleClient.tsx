'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  RotateCcw,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/ToastRegion';
import { OfflineBanner } from '@/components/ops/OfflineBanner';
import { readOfflineSnapshot, saveOfflineSnapshot } from '@/lib/offline/db';
import { syncManager, type SyncStatusSnapshot } from '@/lib/offline/sync-manager';
import { formatElapsedMmSs, playAlertChime } from '@/lib/ops/format';
import type { KdsTicket, KdsTicketItem } from '@/lib/ops/types';
import type { KdsStatus } from '@/server/db/types';

const NEXT_KDS_STATUS: Record<KdsStatus, KdsStatus | null> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
  SERVED: null,
  CANCELLED: null,
};

function createDemoKdsTickets(): { outletId: string; tickets: KdsTicket[] } {
  const now = Date.now();
  return {
    outletId: '11111111-1111-4111-8111-111111111111',
    tickets: [
      {
        orderId: 'ord-kds-1',
        orderNumber: 'KOT-204',
        tableNumber: 'T2',
        tokenNumber: null,
        source: 'QR',
        createdAt: new Date(now - 13 * 60_000).toISOString(),
        slaMinutes: 12,
        items: [
          {
            id: 'ki-1',
            orderId: 'ord-kds-1',
            menuItemId: 'm-1',
            name: 'Charcoal Tandoori Lamb Chops',
            quantity: 2,
            stationId: 'st-tandoor',
            stationName: 'Tandoor',
            status: 'PREPARING',
            modifiers: ['Well Done', 'Mint Chutney'],
            spiceLevel: 'Hot',
            allergens: ['Dairy'],
            notes: 'Guest has peanut allergy — keep prep clean',
            companionStations: ['Bar'],
          },
          {
            id: 'ki-2',
            orderId: 'ord-kds-1',
            menuItemId: 'm-2',
            name: 'Garlic Butter Naan',
            quantity: 3,
            stationId: 'st-tandoor',
            stationName: 'Tandoor',
            status: 'ACCEPTED',
            modifiers: ['Extra Char'],
            allergens: ['Gluten', 'Dairy'],
            companionStations: ['Curry'],
          },
        ],
      },
      {
        orderId: 'ord-kds-2',
        orderNumber: 'KOT-205',
        tableNumber: 'P1',
        tokenNumber: null,
        source: 'QR',
        createdAt: new Date(now - 9.5 * 60_000).toISOString(),
        slaMinutes: 12,
        items: [
          {
            id: 'ki-3',
            orderId: 'ord-kds-2',
            menuItemId: 'm-3',
            name: 'Smoked Butter Chicken',
            quantity: 2,
            stationId: 'st-curry',
            stationName: 'Curry',
            status: 'PREPARING',
            modifiers: ['Medium Spice'],
            allergens: ['Dairy', 'Cashew'],
            companionStations: ['Tandoor', 'Drinks'],
          },
          {
            id: 'ki-4',
            orderId: 'ord-kds-2',
            menuItemId: 'm-4',
            name: 'Mango Lassi',
            quantity: 2,
            stationId: 'st-drinks',
            stationName: 'Drinks',
            status: 'READY',
            modifiers: [],
            allergens: ['Dairy'],
            companionStations: ['Curry'],
          },
        ],
      },
      {
        orderId: 'ord-kds-3',
        orderNumber: 'KOT-206',
        tableNumber: null,
        tokenNumber: 41,
        source: 'COUNTER',
        createdAt: new Date(now - 2.5 * 60_000).toISOString(),
        slaMinutes: 10,
        items: [
          {
            id: 'ki-5',
            orderId: 'ord-kds-3',
            menuItemId: 'm-5',
            name: 'Saffron Old Fashioned',
            quantity: 1,
            stationId: 'st-bar',
            stationName: 'Bar',
            status: 'PENDING',
            modifiers: ['Large Ice'],
            allergens: [],
            companionStations: [],
          },
        ],
      },
    ],
  };
}

export function KdsConsoleClient({ outletSlug }: { outletSlug: string }) {
  const [outletId, setOutletId] = useState('11111111-1111-4111-8111-111111111111');
  const [tickets, setTickets] = useState<KdsTicket[]>(() => createDemoKdsTickets().tickets);
  const [bumpedHistory, setBumpedHistory] = useState<KdsTicket[]>([]);
  const [activeStation, setActiveStation] = useState<string>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncedAt: null,
    persistedStorage: false,
  });

  // Manager PIN modal for cancelling PREPARING items
  const [cancelTarget, setCancelTarget] = useState<KdsTicketItem | null>(null);
  const [managerPin, setManagerPin] = useState('');

  const seenOrderIdsRef = useRef<Set<string>>(new Set());

  // 1-second timer tick for tabular-nums SLA timers
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadKdsTickets = useCallback(async () => {
    const snapKey = `kds:${outletSlug}`;
    try {
      const res = await fetch(`/api/v1/kds/${encodeURIComponent(outletSlug)}/tickets`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const payload = (await res.json()) as {
          outletId: string;
          tickets: KdsTicket[];
        };
        setOutletId(payload.outletId);
        setTickets(payload.tickets);
        await saveOfflineSnapshot(snapKey, payload.outletId, payload);
        return;
      }
    } catch {
      // Offline fallback
    }

    const cached = await readOfflineSnapshot<{
      outletId: string;
      tickets: KdsTicket[];
    }>(snapKey);
    if (cached?.data) {
      setOutletId(cached.data.outletId);
      setTickets(cached.data.tickets);
    }
  }, [outletSlug]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void loadKdsTickets();
    }, 0);
    const poll = setInterval(() => {
      if (active && typeof navigator !== 'undefined' && navigator.onLine) {
        void loadKdsTickets();
      }
    }, 5000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [loadKdsTickets]);

  useEffect(() => {
    const cleanupInit = syncManager.init(outletId);
    const unsub = syncManager.subscribe(setSyncStatus);
    return () => {
      cleanupInit();
      unsub();
    };
  }, [outletId]);

  // Web Audio chime on new KOT
  useEffect(() => {
    let hasNew = false;
    for (const t of tickets) {
      if (!seenOrderIdsRef.current.has(t.orderId)) {
        seenOrderIdsRef.current.add(t.orderId);
        hasNew = true;
      }
    }
    if (hasNew && soundEnabled && tickets.length > 0) {
      playAlertChime('kot');
    }
  }, [soundEnabled, tickets]);

  const stations = useMemo(() => {
    const set = new Set<string>();
    for (const t of tickets) {
      for (const item of t.items) {
        set.add(item.stationName);
      }
    }
    return ['ALL', ...Array.from(set)];
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    return tickets
      .map((ticket) => {
        const items =
          activeStation === 'ALL'
            ? ticket.items
            : ticket.items.filter((i) => i.stationName === activeStation);
        return { ...ticket, items };
      })
      .filter(
        (t) =>
          t.items.length > 0 &&
          t.items.some((i) => i.status !== 'SERVED' && i.status !== 'CANCELLED'),
      );
  }, [activeStation, tickets]);

  const patchItemStatus = useCallback(
    async (item: KdsTicketItem, nextStatus: KdsStatus, pin?: string) => {
      setTickets((prev) =>
        prev.map((ticket) => ({
          ...ticket,
          items: ticket.items.map((i) =>
            i.id === item.id ? { ...i, status: nextStatus } : i,
          ),
        })),
      );

      if (!navigator.onLine) {
        await syncManager.queueMutation(outletId, 'KDS_STATUS', {
          itemId: item.id,
          status: nextStatus,
          managerPin: pin,
        });
        showToast({
          title: `Offline KDS update queued`,
          description: `${item.name} -> ${nextStatus}`,
          variant: 'warning',
        });
        return;
      }

      try {
        const res = await fetch(`/api/v1/kds/order-items/${item.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus, managerPin: pin }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        await syncManager.queueMutation(outletId, 'KDS_STATUS', {
          itemId: item.id,
          status: nextStatus,
          managerPin: pin,
        });
      }
    },
    [outletId],
  );

  const handleBumpTicket = useCallback(
    async (ticket: KdsTicket) => {
      const activeItems = ticket.items.filter(
        (i) => i.status !== 'SERVED' && i.status !== 'CANCELLED',
      );
      if (activeItems.length === 0) return;

      // Advance all active items on this ticket by one stage, or mark SERVED if READY
      for (const item of activeItems) {
        const next = NEXT_KDS_STATUS[item.status] ?? 'SERVED';
        await patchItemStatus(item, next);
      }

      const allWillBeServed = activeItems.every(
        (i) => (NEXT_KDS_STATUS[i.status] ?? 'SERVED') === 'SERVED',
      );
      if (allWillBeServed) {
        setBumpedHistory((prev) => [ticket, ...prev.slice(0, 9)]);
      }

      showToast({
        title: `Bumped ${ticket.orderNumber}`,
        description: ticket.tableNumber
          ? `Table ${ticket.tableNumber}`
          : `Token #${ticket.tokenNumber}`,
        variant: 'success',
      });
    },
    [patchItemStatus],
  );

  const handleRecallLast = useCallback(async () => {
    const last = bumpedHistory[0];
    if (!last) {
      showToast({ title: 'No bumped tickets to recall', variant: 'info' });
      return;
    }

    setBumpedHistory((prev) => prev.slice(1));
    setTickets((prev) =>
      prev.map((t) =>
        t.orderId === last.orderId
          ? {
              ...t,
              items: t.items.map((i) =>
                i.status === 'SERVED' ? { ...i, status: 'READY' } : i,
              ),
            }
          : t,
      ),
    );

    try {
      await fetch(`/api/v1/kds/tickets/${last.orderId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: last.orderId }),
      });
    } catch {
      // Optimistic recall applied
    }

    showToast({
      title: `Recalled ${last.orderNumber}`,
      variant: 'info',
    });
  }, [bumpedHistory]);

  // Keyboard Bump-Bar Shortcuts: 1-9, Space, R
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        void handleRecallLast();
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (visibleTickets[0]) {
          void handleBumpTicket(visibleTickets[0]);
        }
        return;
      }

      const num = Number(e.key);
      if (Number.isInteger(num) && num >= 1 && num <= 9) {
        const ticket = visibleTickets[num - 1];
        if (ticket) {
          e.preventDefault();
          void handleBumpTicket(ticket);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBumpTicket, handleRecallLast, visibleTickets]);

  return (
    <div className="space-y-5">
      <OfflineBanner
        status={syncStatus}
        onSyncNow={() => void syncManager.flush(outletId)}
        variant="kds"
      />

      {/* Station Tabs & Bump Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Kitchen stations" className="flex flex-wrap gap-2">
          {stations.map((station) => {
            const active = activeStation === station;
            return (
              <button
                key={station}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveStation(station)}
                className={`min-h-12 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-[#3DE0C5] bg-[#3DE0C5] text-[#070d18]'
                    : 'border-[#243552] bg-[#101a2c] text-[#E8F0FF] hover:border-[#3DE0C5]'
                }`}
              >
                {station === 'ALL' ? `All Stations (${visibleTickets.length})` : station}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            aria-pressed={soundEnabled}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#243552] bg-[#101a2c] px-4 text-xs font-semibold text-[#E8F0FF]"
          >
            {soundEnabled ? (
              <Volume2 className="size-4 text-[#3DCE7F]" aria-hidden="true" />
            ) : (
              <VolumeX className="size-4 text-[#9AA4B2]" aria-hidden="true" />
            )}
            {soundEnabled ? 'Chime On' : 'Muted'}
          </button>

          <button
            type="button"
            onClick={() => void handleRecallLast()}
            disabled={bumpedHistory.length === 0}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#243552] bg-[#101a2c] px-4 text-xs font-semibold text-[#E8F0FF] disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Recall (R)
          </button>
        </div>
      </div>

      {/* KDS Ticket Grid */}
      {visibleTickets.length === 0 ? (
        <div className="rounded-2xl border border-[#243552] bg-[#101a2c] p-12 text-center">
          <ChefHat className="mx-auto size-10 text-[#3DCE7F]" aria-hidden="true" />
          <p className="mt-3 font-display text-2xl text-[#E8F0FF]">All Clear — Kitchen Caught Up</p>
          <p className="mt-1 text-sm text-[#9AA4B2]">
            New KOT tickets from QR, Waiter, or Counter POS will chime and appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTickets.map((ticket, index) => {
            const elapsedMins =
              (nowMs - new Date(ticket.createdAt).getTime()) / 60_000;
            const slaRatio = elapsedMins / Math.max(1, ticket.slaMinutes);
            const slaState =
              slaRatio >= 1 ? 'OVERDUE' : slaRatio >= 0.75 ? 'WARNING' : 'ON_TIME';

            const borderColor =
              slaState === 'OVERDUE'
                ? 'border-[#D64545] kds-overdue-pulse'
                : slaState === 'WARNING'
                  ? 'border-[#F0A202]'
                  : 'border-[#3DCE7F]';

            const slaBadgeClass =
              slaState === 'OVERDUE'
                ? 'bg-[#D64545] text-white'
                : slaState === 'WARNING'
                  ? 'bg-[#F0A202] text-[#070d18]'
                  : 'bg-[#3DCE7F] text-white';

            return (
              <article
                key={ticket.orderId}
                aria-label={`Ticket ${ticket.orderNumber}`}
                className={`flex flex-col justify-between rounded-2xl border-2 bg-[#101a2c] p-4 ${borderColor}`}
              >
                <div>
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-[#243552] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#070d18] font-mono text-xs font-bold text-[#9AA4B2]">
                          {index + 1}
                        </span>
                        <span className="font-mono text-3xl font-bold tracking-tight text-[#E8F0FF]">
                          {ticket.tableNumber
                            ? ticket.tableNumber
                            : `#${ticket.tokenNumber}`}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-[#9AA4B2]">
                        {ticket.orderNumber} · {ticket.source}
                      </p>
                    </div>

                    <div className="text-end">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm font-bold tabular-nums shadow-sm ${slaBadgeClass}`}
                      >
                        {slaState === 'OVERDUE' ? (
                          <Flame className="size-4 text-[#F0A202]" aria-hidden="true" />
                        ) : (
                          <Clock className="size-4" aria-hidden="true" />
                        )}
                        {formatElapsedMmSs(ticket.createdAt, nowMs)}
                      </div>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#9AA4B2]">
                        {slaState === 'OVERDUE'
                          ? 'OVERDUE'
                          : slaState === 'WARNING'
                            ? 'NEAR SLA'
                            : 'ON TIME'}
                      </p>
                    </div>
                  </div>

                  {/* Visual SLA Countdown Bar */}
                  <div className="mt-3 relative h-1.5 w-full overflow-hidden rounded-full bg-[#070d18]">
                    <div
                      className={`h-full transition-all duration-500 ${
                        slaState === 'OVERDUE'
                          ? 'bg-[#D64545]'
                          : slaState === 'WARNING'
                            ? 'bg-[#F0A202]'
                            : 'bg-[#3DCE7F]'
                      }`}
                      style={{ width: `${Math.min(100, Math.round(slaRatio * 100))}%` }}
                    />
                  </div>

                  {/* Ticket Items */}
                  <ul className="mt-3 space-y-2.5">
                    {ticket.items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-xl border border-[#243552] bg-[#070d18] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-base font-semibold text-[#E8F0FF]">
                              <span className="font-mono text-[#3DE0C5]">{item.quantity}×</span>{' '}
                              {item.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                              <span className="inline-flex items-center rounded-md bg-[#243552]/70 px-2 py-0.5 font-semibold text-[#E8F0FF]">
                                {item.stationName}
                              </span>
                              <span className="text-[#9AA4B2]">·</span>
                              <span className="text-[#9AA4B2]">{item.status}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {NEXT_KDS_STATUS[item.status] && (
                              <button
                                type="button"
                                onClick={() =>
                                  void patchItemStatus(
                                    item,
                                    NEXT_KDS_STATUS[item.status]!,
                                  )
                                }
                                className="min-h-12 min-w-12 rounded-lg bg-[#3DCE7F] px-3 text-xs font-bold text-white"
                              >
                                {NEXT_KDS_STATUS[item.status]}
                              </button>
                            )}
                            {item.status !== 'SERVED' && item.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                aria-label={`Cancel ${item.name}`}
                                onClick={() => {
                                  if (item.status === 'PREPARING') {
                                    setCancelTarget(item);
                                    setManagerPin('');
                                  } else {
                                    void patchItemStatus(item, 'CANCELLED');
                                  }
                                }}
                                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-[#D64545]/60 text-[#D64545]"
                              >
                                <XCircle className="size-5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>

                        {item.modifiers.length > 0 && (
                          <p className="mt-1.5 text-xs font-medium text-[#F0A202]">
                            Mods: {item.modifiers.join(' · ')}
                            {item.spiceLevel ? ` · Spice: ${item.spiceLevel}` : ''}
                          </p>
                        )}

                        {item.allergens.length > 0 && (
                          <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#D64545]/20 px-2 py-0.5 text-xs font-bold text-[#FF8A80]">
                            <AlertTriangle className="size-3.5" aria-hidden="true" />
                            ALLERGY: {item.allergens.join(', ')}
                          </p>
                        )}

                        {item.notes && (
                          <p className="mt-1.5 text-xs italic text-[#E8F0FF]/90">
                            “{item.notes}”
                          </p>
                        )}

                        {item.companionStations.length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#243552] bg-[#101a2c]/80 px-2 py-1 text-[11px] font-mono text-[#9AA4B2]">
                            <span className="font-semibold text-[#F0A202]">Companion:</span>
                            <span>{item.companionStations.join(', ')}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => void handleBumpTicket(ticket)}
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3DE0C5] px-4 text-sm font-bold text-[#070d18]"
                >
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                  Bump Ticket ({index < 9 ? `Key ${index + 1}` : 'Click'})
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* Manager PIN Cancellation Dialog */}
      <Dialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Manager PIN Required to Cancel Preparing Item"
      >
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--pb-muted)]">
              <strong>{cancelTarget.name}</strong> is already in <strong>PREPARING</strong>{' '}
              state. Enter Manager PIN to authorize cancellation.
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Manager PIN
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
                className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 font-mono text-lg tracking-[0.4em]"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="min-h-11 rounded-xl border border-[var(--pb-border)] px-4 text-xs font-semibold"
              >
                Keep Cooking
              </button>
              <button
                type="button"
                onClick={() => {
                  if (managerPin.length < 4) {
                    showToast({ title: 'Enter at least 4 digits', variant: 'warning' });
                    return;
                  }
                  void patchItemStatus(cancelTarget, 'CANCELLED', managerPin);
                  setCancelTarget(null);
                  setManagerPin('');
                }}
                className="min-h-11 rounded-xl bg-[var(--pb-chili)] px-4 text-xs font-semibold text-white"
              >
                Authorize Cancel
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
