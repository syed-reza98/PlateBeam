'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock,
  Columns3,
  Flame,
  LayoutGrid,
  Plus,
  Printer,
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

const STATION_COLUMNS = [
  {
    key: 'Tandoor',
    label: 'Tandoor',
    dotClass: 'bg-[#FF5412]',
    badgeClass: 'border-[#FF5412]/40 bg-[#FF5412]/15 text-[#FFA06D]',
    match: (name: string) => name.toLowerCase().includes('tandoor'),
  },
  {
    key: 'Curry',
    label: 'Curry',
    dotClass: 'bg-[#F59E0B]',
    badgeClass: 'border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#FBBF24]',
    match: (name: string) => name.toLowerCase().includes('curry'),
  },
  {
    key: 'Drinks',
    label: 'Drinks & Bar',
    dotClass: 'bg-[#0EA5E9]',
    badgeClass: 'border-[#0EA5E9]/40 bg-[#0EA5E9]/15 text-[#38BDF8]',
    match: (name: string) =>
      name.toLowerCase().includes('drink') || name.toLowerCase().includes('bar'),
  },
] as const;

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
            companionStations: ['Drinks'],
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
            stationName: 'Drinks',
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
  const [viewMode, setViewMode] = useState<'BOARD' | 'GRID'>('BOARD');
  const [activeStation, setActiveStation] = useState<string>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rushCounter, setRushCounter] = useState(207);

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

  // Thermal KOT Preview modal
  const [kotPreviewTicket, setKotPreviewTicket] = useState<KdsTicket | null>(null);
  const [kotPreviewLines, setKotPreviewLines] = useState<string[] | null>(null);

  const seenOrderIdsRef = useRef<Set<string>>(new Set());

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

  const activeTickets = useMemo(
    () =>
      tickets.filter((t) =>
        t.items.some((i) => i.status !== 'SERVED' && i.status !== 'CANCELLED'),
      ),
    [tickets],
  );

  const visibleGridTickets = useMemo(() => {
    return activeTickets
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
  }, [activeStation, activeTickets]);

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
          title: 'Offline KDS update queued',
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

  const handleSimulateRushKot = () => {
    const num = rushCounter;
    setRushCounter((c) => c + 1);
    const orderId = `ord-rush-${num}-${Date.now()}`;
    const newTicket: KdsTicket = {
      orderId,
      orderNumber: `KOT-${num}`,
      tableNumber: `T${(num % 6) + 1}`,
      tokenNumber: null,
      source: 'WAITER',
      createdAt: new Date().toISOString(),
      slaMinutes: 12,
      items: [
        {
          id: `${orderId}-1`,
          orderId,
          menuItemId: 'm-1',
          name: 'Seekh Kebab Platter',
          quantity: 2,
          stationId: 'st-tandoor',
          stationName: 'Tandoor',
          status: 'PENDING',
          modifiers: ['Extra Mint Chutney'],
          spiceLevel: 'Medium',
          allergens: [],
          companionStations: ['Curry'],
        },
        {
          id: `${orderId}-2`,
          orderId,
          menuItemId: 'm-3',
          name: 'Kacchi Biryani',
          quantity: 2,
          stationId: 'st-curry',
          stationName: 'Curry',
          status: 'PENDING',
          modifiers: ['With Borhani'],
          allergens: ['Dairy'],
          companionStations: ['Tandoor', 'Drinks'],
        },
        {
          id: `${orderId}-3`,
          orderId,
          menuItemId: 'm-4',
          name: 'Rose Falooda',
          quantity: 2,
          stationId: 'st-drinks',
          stationName: 'Drinks',
          status: 'PENDING',
          modifiers: ['Less Ice'],
          allergens: ['Dairy'],
          companionStations: ['Curry'],
        },
      ],
    };

    setTickets((prev) => [newTicket, ...prev]);
    if (soundEnabled) playAlertChime('kot');
    showToast({
      title: `Rush Ticket ${newTicket.orderNumber} Fired`,
      description: `Table ${newTicket.tableNumber} · Tandoor, Curry & Drinks`,
      variant: 'info',
    });
  };

  const openKotPreview = async (ticket: KdsTicket) => {
    setKotPreviewTicket(ticket);
    setKotPreviewLines(null);
    try {
      const res = await fetch(
        `/api/v1/kds/${encodeURIComponent(outletSlug)}/tickets/${encodeURIComponent(ticket.orderId)}/kot-preview`,
      );
      if (res.ok) {
        const data = (await res.json()) as { lines?: string[] };
        if (Array.isArray(data.lines) && data.lines.length > 0) {
          setKotPreviewLines(data.lines);
        }
      }
    } catch {
      // Local fallback rendered automatically below
    }
  };

  // Keyboard Bump-Bar Shortcuts: 1-9, Space, R
  useEffect(() => {
    const shortcutList = viewMode === 'BOARD' ? activeTickets : visibleGridTickets;
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
        if (shortcutList[0]) {
          void handleBumpTicket(shortcutList[0]);
        }
        return;
      }

      const num = Number(e.key);
      if (Number.isInteger(num) && num >= 1 && num <= 9) {
        const ticket = shortcutList[num - 1];
        if (ticket) {
          e.preventDefault();
          void handleBumpTicket(ticket);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTickets, handleBumpTicket, handleRecallLast, viewMode, visibleGridTickets]);

  const renderTicketCard = (ticket: KdsTicket, index: number) => {
    const elapsedMins = (nowMs - new Date(ticket.createdAt).getTime()) / 60_000;
    const slaRatio = elapsedMins / Math.max(1, ticket.slaMinutes);
    const slaState =
      slaRatio >= 1 ? 'OVERDUE' : slaRatio >= 0.65 ? 'WARNING' : 'ON_TIME';

    const borderColor =
      slaState === 'OVERDUE'
        ? 'border-[#EF4444]'
        : slaState === 'WARNING'
          ? 'border-[#F59E0B]'
          : 'border-[#10B981]/70';

    const slaBadgeClass =
      slaState === 'OVERDUE'
        ? 'bg-[#EF4444] text-white'
        : slaState === 'WARNING'
          ? 'bg-[#F59E0B] text-[#09090B]'
          : 'bg-[#10B981] text-white';

    return (
      <article
        key={ticket.orderId}
        aria-label={`Ticket ${ticket.orderNumber}`}
        className={`flex flex-col justify-between rounded-2xl border-2 bg-[#111115] p-4 ${borderColor}`}
      >
        <div>
          {/* Ticket Header */}
          <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[#18181F] font-mono text-xs font-bold text-[#A1A1AA]">
                  {index + 1}
                </span>
                <span className="font-mono text-2xl font-bold tracking-tight text-[#F4F4F5]">
                  {ticket.tableNumber ? ticket.tableNumber : `#${ticket.tokenNumber}`}
                </span>
                <button
                  type="button"
                  onClick={() => void openKotPreview(ticket)}
                  aria-label={`Thermal KOT preview for ${ticket.orderNumber}`}
                  title="Thermal KOT Preview"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-[#18181F] text-[#A1A1AA] transition-colors hover:border-[#FF5412] hover:text-[#F4F4F5]"
                >
                  <Printer className="size-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1 font-mono text-xs text-[#A1A1AA]">
                {ticket.orderNumber} · {ticket.source}
              </p>
            </div>

            <div className="text-end">
              <div
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm font-bold tabular-nums shadow-sm ${slaBadgeClass}`}
              >
                {slaState === 'OVERDUE' ? (
                  <Flame className="size-4" aria-hidden="true" />
                ) : (
                  <Clock className="size-4" aria-hidden="true" />
                )}
                {formatElapsedMmSs(ticket.createdAt, nowMs)}
              </div>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA]">
                {slaState === 'OVERDUE'
                  ? 'OVERDUE'
                  : slaState === 'WARNING'
                    ? 'NEAR SLA'
                    : 'ON TIME'}
              </p>
            </div>
          </div>

          {/* Visual SLA Countdown Bar */}
          <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#18181F]">
            <div
              className={`h-full transition-all duration-500 ${
                slaState === 'OVERDUE'
                  ? 'bg-[#EF4444]'
                  : slaState === 'WARNING'
                    ? 'bg-[#F59E0B]'
                    : 'bg-[#10B981]'
              }`}
              style={{ width: `${Math.min(100, Math.round(slaRatio * 100))}%` }}
            />
          </div>

          {/* Ticket Items */}
          <ul className="mt-3 space-y-2.5">
            {ticket.items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/10 bg-[#18181F] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#F4F4F5]">
                      <span className="font-mono text-[#FF5412]">{item.quantity}×</span>{' '}
                      {item.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                      <span className="inline-flex items-center rounded-md bg-[#09090B] px-2 py-0.5 font-semibold text-[#F4F4F5]">
                        {item.stationName}
                      </span>
                      <span className="text-[#A1A1AA]">·</span>
                      <span className="text-[#A1A1AA]">{item.status}</span>
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
                        className="min-h-11 min-w-11 rounded-xl bg-[#10B981] px-2.5 text-xs font-bold text-white"
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
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#EF4444]/60 text-[#EF4444]"
                      >
                        <XCircle className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {item.modifiers.length > 0 && (
                  <p className="mt-1.5 text-xs font-medium text-[#FBBF24]">
                    Mods: {item.modifiers.join(' · ')}
                    {item.spiceLevel ? ` · Spice: ${item.spiceLevel}` : ''}
                  </p>
                )}

                {item.allergens.length > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#EF4444]/20 px-2 py-0.5 text-xs font-bold text-[#FCA5A5]">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    ALLERGY: {item.allergens.join(', ')}
                  </p>
                )}

                {item.notes && (
                  <p className="mt-1.5 text-xs italic text-[#F4F4F5]/90">
                    “{item.notes}”
                  </p>
                )}

                {item.companionStations.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#09090B]/70 px-2 py-1 font-mono text-[11px] text-[#A1A1AA]">
                    <span className="font-semibold text-[#FBBF24]">Companion:</span>
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
          className="shadow-beam mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FF5412] px-4 text-sm font-bold text-white transition-colors hover:bg-[#FF7033]"
        >
          <CheckCircle2 className="size-5" aria-hidden="true" />
          Bump Ticket ({index < 9 ? `Key ${index + 1}` : 'Click'})
        </button>
      </article>
    );
  };

  return (
    <div className="space-y-5">
      <OfflineBanner
        status={syncStatus}
        onSyncNow={() => void syncManager.flush(outletId)}
        variant="kds"
      />

      {/* Station Mode & Bump Controls */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-[#111115] p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div
            role="group"
            aria-label="KDS view mode"
            className="inline-flex rounded-xl border border-white/10 bg-[#09090B] p-1"
          >
            <button
              type="button"
              onClick={() => setViewMode('BOARD')}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                viewMode === 'BOARD'
                  ? 'bg-[#FF5412] text-white'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              <Columns3 className="size-4" aria-hidden="true" />
              3-Column Station Board
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                viewMode === 'GRID'
                  ? 'bg-[#FF5412] text-white'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              <LayoutGrid className="size-4" aria-hidden="true" />
              All-Tickets Grid
            </button>
          </div>

          {viewMode === 'GRID' && (
            <div role="tablist" aria-label="Kitchen stations" className="flex flex-wrap gap-1.5">
              {stations.map((station) => {
                const active = activeStation === station;
                return (
                  <button
                    key={station}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveStation(station)}
                    className={`min-h-11 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#FF5412] bg-[#FF5412]/15 text-[#FFA06D]'
                        : 'border-white/10 bg-[#18181F] text-[#F4F4F5] hover:border-white/25'
                    }`}
                  >
                    {station === 'ALL' ? `All (${visibleGridTickets.length})` : station}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSimulateRushKot}
            className="shadow-beam inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#FF5412] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#FF7033]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Simulate Rush KOT
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((v) => !v)}
            aria-pressed={soundEnabled}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#18181F] px-3.5 text-xs font-semibold text-[#F4F4F5]"
          >
            {soundEnabled ? (
              <Volume2 className="size-4 text-[#10B981]" aria-hidden="true" />
            ) : (
              <VolumeX className="size-4 text-[#A1A1AA]" aria-hidden="true" />
            )}
            {soundEnabled ? 'Chime On' : 'Muted'}
          </button>

          <button
            type="button"
            onClick={() => void handleRecallLast()}
            disabled={bumpedHistory.length === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#18181F] px-3.5 text-xs font-semibold text-[#F4F4F5] disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Recall (R)
          </button>
        </div>
      </section>

      {/* Tickets View */}
      {activeTickets.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#111115] p-12 text-center">
          <ChefHat className="mx-auto size-10 text-[#10B981]" aria-hidden="true" />
          <p className="mt-3 text-xl font-bold text-[#F4F4F5]">All Clear — Kitchen Caught Up</p>
          <p className="mt-1 text-sm text-[#A1A1AA]">
            New KOT tickets from QR, Waiter, or Counter POS will chime and appear here.
          </p>
        </div>
      ) : viewMode === 'BOARD' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {STATION_COLUMNS.map((col) => {
            const stationTickets = activeTickets
              .map((ticket) => ({
                ...ticket,
                items: ticket.items.filter(
                  (i) =>
                    col.match(i.stationName) &&
                    i.status !== 'SERVED' &&
                    i.status !== 'CANCELLED',
                ),
              }))
              .filter((t) => t.items.length > 0);

            return (
              <section
                key={col.key}
                aria-label={`${col.label} Station Column`}
                className="ops-column-contain flex flex-col gap-3 rounded-3xl border border-white/10 bg-[#111115]/70 p-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${col.dotClass}`} aria-hidden="true" />
                    <h2 className="text-base font-bold text-[#F4F4F5]">{col.label}</h2>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${col.badgeClass}`}
                  >
                    {stationTickets.length} active
                  </span>
                </div>

                {stationTickets.length === 0 ? (
                  <p className="py-8 text-center font-mono text-xs text-[#A1A1AA]">
                    No active {col.label} tickets
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stationTickets.map((ticket) => {
                      const globalIdx = activeTickets.findIndex(
                        (t) => t.orderId === ticket.orderId,
                      );
                      return renderTicketCard(ticket, globalIdx >= 0 ? globalIdx : 0);
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="ops-column-contain grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleGridTickets.map((ticket, index) => renderTicketCard(ticket, index))}
        </div>
      )}

      {/* Thermal KOT Preview Modal */}
      <Dialog
        open={kotPreviewTicket !== null}
        onClose={() => setKotPreviewTicket(null)}
        title={kotPreviewTicket ? `Thermal KOT — ${kotPreviewTicket.orderNumber}` : 'Thermal KOT'}
      >
        {kotPreviewTicket && (
          <div className="space-y-4">
            <div className="thermal-receipt mx-auto max-w-xs p-5 font-mono text-xs leading-relaxed">
              {kotPreviewLines ? (
                <pre className="whitespace-pre-wrap font-mono text-xs">{kotPreviewLines.join('\n')}</pre>
              ) : (
                <>
                  <p className="text-center text-sm font-bold uppercase tracking-wider">
                    KITCHEN ORDER TICKET
                  </p>
                  <p className="text-center text-[11px] opacity-75">
                    {kotPreviewTicket.orderNumber} · {kotPreviewTicket.source}
                  </p>
                  <div className="my-3 border-t border-dashed border-zinc-400" />
                  <div className="flex justify-between font-bold">
                    <span>
                      {kotPreviewTicket.tableNumber
                        ? `TABLE: ${kotPreviewTicket.tableNumber}`
                        : `TOKEN: #${kotPreviewTicket.tokenNumber}`}
                    </span>
                    <span>
                      {new Date(kotPreviewTicket.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="my-3 border-t border-dashed border-zinc-400" />
                  <ul className="space-y-2">
                    {kotPreviewTicket.items.map((item) => (
                      <li key={item.id}>
                        <div className="flex justify-between font-bold">
                          <span>
                            {item.quantity}x {item.name}
                          </span>
                          <span>[{item.stationName}]</span>
                        </div>
                        {item.modifiers.length > 0 && (
                          <p className="pl-3 text-[11px]">+ {item.modifiers.join(', ')}</p>
                        )}
                        {item.allergens.length > 0 && (
                          <p className="pl-3 text-[11px] font-bold">
                            ! ALLERGY: {item.allergens.join(', ')}
                          </p>
                        )}
                        {item.notes && <p className="pl-3 text-[11px]">* {item.notes}</p>}
                      </li>
                    ))}
                  </ul>
                  <div className="my-3 border-t border-dashed border-zinc-400" />
                  <p className="text-center text-[10px] opacity-75">
                    80mm ESC/POS · PlateBeam KDS
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setKotPreviewTicket(null)}
                className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-semibold text-[#F4F4F5]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="shadow-beam inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF5412] px-5 text-xs font-semibold text-white hover:bg-[#FF7033]"
              >
                <Printer className="size-4" aria-hidden="true" />
                Print KOT
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Manager PIN Cancellation Dialog */}
      <Dialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Manager PIN Required to Cancel Preparing Item"
      >
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[#A1A1AA]">
              <strong className="text-[#F4F4F5]">{cancelTarget.name}</strong> is already in{' '}
              <strong className="text-[#F4F4F5]">PREPARING</strong> state. Enter Manager PIN to
              authorize cancellation.
            </p>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Manager PIN
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 font-mono text-lg tracking-[0.4em] text-[#F4F4F5]"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-semibold text-[#F4F4F5]"
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
                className="min-h-11 rounded-xl bg-[#EF4444] px-4 text-xs font-semibold text-white"
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
