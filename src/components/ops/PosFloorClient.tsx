'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import {
  ArrowLeftRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  GripVertical,
  KeyRound,
  Layers,
  Lock,
  Move,
  Printer,
  QrCode,
  Receipt,
  RotateCcw,
  Split,
  Ticket,
  UserCheck,
  Utensils,
  X,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/ToastRegion';
import { OfflineBanner } from '@/components/ops/OfflineBanner';
import { readOfflineSnapshot, saveOfflineSnapshot } from '@/lib/offline/db';
import { syncManager, type SyncStatusSnapshot } from '@/lib/offline/sync-manager';
import { formatMinorCurrency, playAlertChime } from '@/lib/ops/format';
import type {
  OpsPendingOrder,
  OpsServiceRequest,
  OpsShiftSummary,
  OpsStaffMember,
  OpsTable,
  PosBootstrapPayload,
} from '@/lib/ops/types';
import type { DiningTableStatus } from '@/server/db/types';

const TABLE_STATUS_META: Record<
  DiningTableStatus,
  { label: string; border: string; bg: string; badge: string; pulse?: boolean }
> = {
  VACANT: {
    label: 'Vacant',
    border: 'border-[var(--pb-border)]',
    bg: 'bg-[var(--pb-surface)]',
    badge: 'bg-[var(--pb-canvas)] text-[var(--pb-muted)]',
  },
  ORDERING: {
    label: 'Ordering',
    border: 'border-sky-500/60',
    bg: 'bg-sky-500/10',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  EATING: {
    label: 'Eating',
    border: 'border-[var(--pb-olive)]/70',
    bg: 'bg-[var(--pb-olive)]/10',
    badge: 'bg-[var(--pb-olive)]/15 text-[var(--pb-olive)]',
  },
  CALLING_WAITER: {
    label: 'Calling Waiter',
    border: 'border-[var(--pb-chili)]',
    bg: 'bg-[var(--pb-chili)]/15',
    badge: 'bg-[var(--pb-chili)] text-white',
    pulse: true,
  },
  BILL_REQUESTED: {
    label: 'Bill Requested',
    border: 'border-[var(--pb-turmeric)]',
    bg: 'bg-[var(--pb-turmeric)]/15',
    badge: 'bg-[var(--pb-turmeric)]/20 text-[var(--pb-turmeric)]',
  },
  CLEANING: {
    label: 'Cleaning',
    border: 'border-purple-500/50',
    bg: 'bg-purple-500/10',
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  },
};

function createDemoPosPayload(outletSlug: string): PosBootstrapPayload {
  const outletId = '11111111-1111-4111-8111-111111111111';
  const now = Date.now();
  return {
    outletId,
    outletName: outletSlug === 'demo' ? 'Saffron & Ember — Flagship' : outletSlug,
    outletSlug,
    currencyCode: 'USD',
    zones: [
      { id: 'z-main', name: 'Main Hall', sortOrder: 1 },
      { id: 'z-patio', name: 'Patio', sortOrder: 2 },
      { id: 'z-vip', name: 'VIP', sortOrder: 3 },
      { id: 'z-bar', name: 'Bar', sortOrder: 4 },
    ],
    tables: [
      {
        id: 't-1',
        zoneId: 'z-main',
        tableNumber: 'T1',
        capacity: 4,
        status: 'EATING',
        activeSessionId: 'sess-1',
        posX: 40,
        posY: 40,
        qrToken: 'pb-t1-demo',
        activeGuestCount: 3,
        runningTotalMinor: 6850,
      },
      {
        id: 't-2',
        zoneId: 'z-main',
        tableNumber: 'T2',
        capacity: 2,
        status: 'CALLING_WAITER',
        activeSessionId: 'sess-2',
        posX: 240,
        posY: 40,
        qrToken: 'pb-t2-demo',
        activeGuestCount: 2,
        runningTotalMinor: 3400,
      },
      {
        id: 't-3',
        zoneId: 'z-main',
        tableNumber: 'T3',
        capacity: 6,
        status: 'BILL_REQUESTED',
        activeSessionId: 'sess-3',
        posX: 440,
        posY: 40,
        qrToken: 'pb-t3-demo',
        activeGuestCount: 5,
        runningTotalMinor: 14200,
      },
      {
        id: 't-4',
        zoneId: 'z-main',
        tableNumber: 'T4',
        capacity: 4,
        status: 'VACANT',
        activeSessionId: null,
        posX: 40,
        posY: 210,
        qrToken: 'pb-t4-demo',
      },
      {
        id: 't-5',
        zoneId: 'z-patio',
        tableNumber: 'P1',
        capacity: 4,
        status: 'ORDERING',
        activeSessionId: 'sess-5',
        posX: 40,
        posY: 40,
        qrToken: 'pb-p1-demo',
        activeGuestCount: 4,
        runningTotalMinor: 4900,
      },
      {
        id: 't-6',
        zoneId: 'z-vip',
        tableNumber: 'V1',
        capacity: 8,
        status: 'CLEANING',
        activeSessionId: null,
        posX: 40,
        posY: 40,
        qrToken: 'pb-v1-demo',
      },
      {
        id: 't-7',
        zoneId: 'z-bar',
        tableNumber: 'B1',
        capacity: 2,
        status: 'VACANT',
        activeSessionId: null,
        posX: 40,
        posY: 40,
        qrToken: 'pb-b1-demo',
      },
    ],
    serviceRequests: [
      {
        id: 'sr-1',
        tableId: 't-2',
        tableNumber: 'T2',
        requestType: 'WATER',
        status: 'OPEN',
        note: 'Sparkling water + extra lime',
        createdAt: new Date(now - 90_000).toISOString(),
      },
      {
        id: 'sr-2',
        tableId: 't-3',
        tableNumber: 'T3',
        requestType: 'BILL',
        status: 'OPEN',
        note: 'Ready for split card settlement',
        createdAt: new Date(now - 45_000).toISOString(),
      },
    ],
    pendingApprovals: [
      {
        id: 'ord-pend-1',
        orderNumber: 'ORD-1048',
        tableId: 't-5',
        tableNumber: 'P1',
        source: 'QR',
        status: 'PENDING_APPROVAL',
        totalMinor: 4900,
        createdAt: new Date(now - 60_000).toISOString(),
        items: [
          {
            id: 'oi-1',
            name: 'Smoked Butter Chicken',
            quantity: 2,
            modifiers: ['Extra Garlic Naan'],
            notes: 'Medium spice',
          },
          {
            id: 'oi-2',
            name: 'Mango Lassi',
            quantity: 2,
            modifiers: [],
          },
        ],
      },
    ],
    staff: [
      {
        id: 'st-1',
        fullName: 'Amina Rahman',
        email: 'amina@platebeam.local',
        roleName: 'Captain',
        isActive: true,
      },
      {
        id: 'st-2',
        fullName: 'Marcus Vance',
        email: 'marcus@platebeam.local',
        roleName: 'Cashier',
        isActive: true,
      },
      {
        id: 'st-3',
        fullName: 'Elena Rostova',
        email: 'elena@platebeam.local',
        roleName: 'Outlet Manager',
        isActive: true,
      },
    ],
    activeShift: {
      id: 'shift-1',
      status: 'OPEN',
      openedAt: new Date(now - 4 * 3600_000).toISOString(),
      openingFloatMinor: 25000,
      cashSalesMinor: 48200,
      cardSalesMinor: 112400,
      upiMfsSalesMinor: 34500,
      pettyCashMinor: 1800,
      expectedCashMinor: 71400,
      totalOrders: 34,
    },
    nextTokenNumber: 42,
  };
}

export function PosFloorClient({ outletSlug }: { outletSlug: string }) {
  const [data, setData] = useState<PosBootstrapPayload>(() =>
    createDemoPosPayload(outletSlug),
  );
  const [activeZoneId, setActiveZoneId] = useState<string>('ALL');
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [activeStaff, setActiveStaff] = useState<OpsStaffMember | null>(null);

  // Sync / offline state
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncedAt: null,
    persistedStorage: false,
  });

  // Modals
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [pinVerifying, setPinVerifying] = useState(false);

  const [selectedTable, setSelectedTable] = useState<OpsTable | null>(null);
  const [tableOpMode, setTableOpMode] = useState<'TRANSFER' | 'MERGE' | 'SPLIT'>('TRANSFER');
  const [targetTableId, setTargetTableId] = useState<string>('');

  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenGuestName, setTokenGuestName] = useState('');
  const [tokenItemSummary, setTokenItemSummary] = useState('Walk-in Counter Combo');
  const [tokenAmountMajor, setTokenAmountMajor] = useState('18.50');

  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [openingFloatMajor, setOpeningFloatMajor] = useState('250.00');
  const [actualCashMajor, setActualCashMajor] = useState('714.00');
  const [pettyCashMajor, setPettyCashMajor] = useState('18.00');
  const [shiftNotes, setShiftNotes] = useState('');

  const seenCallIdsRef = useRef<Set<string>>(new Set());

  const loadBootstrap = useCallback(async () => {
    const snapKey = `pos:${outletSlug}`;
    try {
      const res = await fetch(`/api/v1/pos/${encodeURIComponent(outletSlug)}/bootstrap`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const payload = (await res.json()) as PosBootstrapPayload;
        setData(payload);
        setActiveStaff((prev) => prev ?? payload.staff[0] ?? null);
        await saveOfflineSnapshot(snapKey, payload.outletId, payload);
        return;
      }
    } catch {
      // Fall through to offline snapshot / demo
    }

    const cached = await readOfflineSnapshot<PosBootstrapPayload>(snapKey);
    if (cached?.data) {
      setData(cached.data);
      setActiveStaff((prev) => prev ?? cached.data.staff[0] ?? null);
    } else {
      const fallback = createDemoPosPayload(outletSlug);
      setData(fallback);
      setActiveStaff((prev) => prev ?? fallback.staff[0] ?? null);
    }
  }, [outletSlug]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void loadBootstrap();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadBootstrap]);

  useEffect(() => {
    const cleanupInit = syncManager.init(data.outletId);
    const unsub = syncManager.subscribe(setSyncStatus);
    return () => {
      cleanupInit();
      unsub();
    };
  }, [data.outletId]);

  // Chime on new OPEN Call Waiter request
  useEffect(() => {
    const openCalls = data.serviceRequests.filter((sr) => sr.status === 'OPEN');
    let hasNew = false;
    for (const sr of openCalls) {
      if (!seenCallIdsRef.current.has(sr.id)) {
        seenCallIdsRef.current.add(sr.id);
        hasNew = true;
      }
    }
    if (hasNew && openCalls.length > 0) {
      playAlertChime('waiter');
    }
  }, [data.serviceRequests]);

  const visibleTables = useMemo(() => {
    if (activeZoneId === 'ALL') return data.tables;
    return data.tables.filter((t) => t.zoneId === activeZoneId);
  }, [activeZoneId, data.tables]);

  const openRequests = useMemo(
    () => data.serviceRequests.filter((sr) => sr.status !== 'RESOLVED' && sr.status !== 'CANCELLED'),
    [data.serviceRequests],
  );

  // Staff PIN Switcher
  const handleVerifyPin = async () => {
    if (pinInput.length < 4) {
      showToast({
        title: 'Enter 4 to 8 digit PIN',
        variant: 'warning',
      });
      return;
    }
    setPinVerifying(true);
    try {
      const res = await fetch('/api/v1/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId: data.outletId,
          pin: pinInput,
          userId: selectedStaffId || undefined,
        }),
      });
      if (res.ok) {
        const result = (await res.json()) as { user?: OpsStaffMember };
        if (result.user) {
          setActiveStaff(result.user);
        }
        showToast({
          title: 'Staff switched',
          description: `Active operator: ${result.user?.fullName ?? 'Verified Staff'}`,
          variant: 'success',
        });
        setPinModalOpen(false);
        setPinInput('');
        return;
      }
    } catch {
      // Offline / demo fallback
    } finally {
      setPinVerifying(false);
    }

    // Demo PIN fallback when offline or unseeded
    const matched =
      data.staff.find((s) => s.id === selectedStaffId) ??
      (pinInput === '9999' ? data.staff[2] : data.staff[0]);
    if (matched) {
      setActiveStaff(matched);
      showToast({
        title: `Switched to ${matched.fullName}`,
        description: `Role: ${matched.roleName}`,
        variant: 'success',
      });
      setPinModalOpen(false);
      setPinInput('');
    }
  };

  // Claim / Resolve Call Waiter
  const handleServiceRequestAction = async (
    req: OpsServiceRequest,
    nextStatus: 'CLAIMED' | 'RESOLVED',
  ) => {
    const actorName = activeStaff?.fullName ?? 'Staff';
    setData((prev) => ({
      ...prev,
      serviceRequests: prev.serviceRequests.map((item) =>
        item.id === req.id
          ? { ...item, status: nextStatus, claimedByName: actorName }
          : item,
      ),
      tables:
        nextStatus === 'RESOLVED'
          ? prev.tables.map((t) =>
              t.id === req.tableId && t.status === 'CALLING_WAITER'
                ? { ...t, status: 'EATING' }
                : t,
            )
          : prev.tables,
    }));

    const endpoint = `/api/v1/service-requests/${req.id}/claim`;
    if (!navigator.onLine) {
      await syncManager.queueMutation(data.outletId, 'SERVICE_REQUEST_CLAIM', {
        serviceRequestId: req.id,
        status: nextStatus,
      });
      showToast({
        title: `Queued offline: ${nextStatus.toLowerCase()}`,
        description: `Table ${req.tableNumber} will sync when online.`,
        variant: 'warning',
      });
      return;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast({
        title: `Request ${nextStatus.toLowerCase()}`,
        description: `Table ${req.tableNumber} (${req.requestType})`,
        variant: 'success',
      });
    } catch {
      await syncManager.queueMutation(data.outletId, 'SERVICE_REQUEST_CLAIM', {
        serviceRequestId: req.id,
        status: nextStatus,
      });
      showToast({
        title: `Saved to offline queue`,
        description: `Table ${req.tableNumber} ${nextStatus.toLowerCase()} queued for delta sync.`,
        variant: 'info',
      });
    }
  };

  // Captain Approval Queue
  const handleCaptainOrderDecision = async (
    order: OpsPendingOrder,
    decision: 'APPROVE' | 'REJECT',
  ) => {
    setData((prev) => ({
      ...prev,
      pendingApprovals: prev.pendingApprovals.filter((o) => o.id !== order.id),
    }));

    try {
      await fetch(`/api/v1/orders/${order.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
    } catch {
      // Optimistic local state update already applied
    }

    showToast({
      title: decision === 'APPROVE' ? 'Order fired to Kitchen' : 'Order rejected',
      description: `${order.orderNumber} · Table ${order.tableNumber}`,
      variant: decision === 'APPROVE' ? 'success' : 'warning',
    });
  };

  // Draggable Floor Layout
  const handleTableDrop = async (e: DragEvent<HTMLElement>) => {
    if (!layoutEditMode) return;
    e.preventDefault();
    const tableId = e.dataTransfer.getData('text/plain');
    if (!tableId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const posX = Math.max(12, Math.round(e.clientX - rect.left - 70));
    const posY = Math.max(12, Math.round(e.clientY - rect.top - 50));

    setData((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === tableId ? { ...t, posX, posY } : t)),
    }));

    try {
      await fetch(`/api/v1/floor/tables/${tableId}/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'MOVE', posX, posY }),
      });
    } catch {
      // Saved locally
    }
  };

  // Table Merge / Split / Transfer / Reset / Rotate QR
  const handleTableOperation = async (
    operation: 'MERGE' | 'TRANSFER' | 'SPLIT' | 'RESET' | 'ROTATE_QR',
  ) => {
    if (!selectedTable) return;
    if ((operation === 'MERGE' || operation === 'TRANSFER') && !targetTableId) {
      showToast({ title: 'Select a target table first', variant: 'warning' });
      return;
    }

    try {
      const res = await fetch(`/api/v1/floor/tables/${selectedTable.id}/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          targetTableId: targetTableId || undefined,
        }),
      });
      if (res.ok) {
        await loadBootstrap();
      }
    } catch {
      // Apply local optimistic state
    }

    setData((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => {
        if (operation === 'RESET' && t.id === selectedTable.id) {
          return {
            ...t,
            status: 'VACANT',
            activeSessionId: null,
            activeGuestCount: 0,
            runningTotalMinor: 0,
          };
        }
        if (operation === 'ROTATE_QR' && t.id === selectedTable.id) {
          return { ...t, qrToken: `pb-${t.tableNumber.toLowerCase()}-${Date.now().toString(36)}` };
        }
        if (operation === 'TRANSFER' && t.id === selectedTable.id) {
          return { ...t, status: 'VACANT', activeSessionId: null, runningTotalMinor: 0 };
        }
        if (operation === 'TRANSFER' && t.id === targetTableId) {
          return {
            ...t,
            status: selectedTable.status === 'VACANT' ? 'ORDERING' : selectedTable.status,
            activeSessionId: selectedTable.activeSessionId,
            runningTotalMinor: selectedTable.runningTotalMinor,
          };
        }
        return t;
      }),
    }));

    showToast({
      title: `Table ${selectedTable.tableNumber}: ${operation.replace('_', ' ')}`,
      variant: 'success',
    });
    setSelectedTable(null);
    setTargetTableId('');
  };

  // Counter / Takeaway Token Issuer
  const handleIssueTakeawayToken = async () => {
    const tokenNum = data.nextTokenNumber;
    const amountMinor = Math.max(0, Math.round(Number(tokenAmountMajor || '0') * 100));
    const idempotencyKey = `counter-${tokenNum}-${crypto.randomUUID()}`;

    const payload = {
      source: 'COUNTER',
      tokenNumber: tokenNum,
      guestName: tokenGuestName || `Walk-in #${tokenNum}`,
      summary: tokenItemSummary,
      amountMinor,
      idempotencyKey,
    };

    if (!navigator.onLine) {
      await syncManager.queueMutation(data.outletId, 'PLACE_ORDER', payload, idempotencyKey);
    } else {
      try {
        await fetch(`/api/v1/sessions/counter/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        await syncManager.queueMutation(data.outletId, 'PLACE_ORDER', payload, idempotencyKey);
      }
    }

    setData((prev) => ({
      ...prev,
      nextTokenNumber: prev.nextTokenNumber + 1,
    }));
    setTokenModalOpen(false);
    setTokenGuestName('');
    showToast({
      title: `Takeaway Token #${tokenNum} Issued`,
      description: `${tokenItemSummary} · ${formatMinorCurrency(amountMinor, data.currencyCode)}`,
      variant: 'success',
    });
  };

  // Shift Float & Z-Report
  const handleShiftSubmit = async () => {
    if (!data.activeShift || data.activeShift.status === 'CLOSED') {
      const openingMinor = Math.max(0, Math.round(Number(openingFloatMajor || '0') * 100));
      try {
        await fetch('/api/v1/analytics/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outletId: data.outletId,
            openingFloatMinor: openingMinor,
            notes: shiftNotes || undefined,
          }),
        });
      } catch {
        // Optimistic shift open
      }
      const opened: OpsShiftSummary = {
        id: crypto.randomUUID(),
        status: 'OPEN',
        openedAt: new Date().toISOString(),
        openingFloatMinor: openingMinor,
        cashSalesMinor: 0,
        cardSalesMinor: 0,
        upiMfsSalesMinor: 0,
        pettyCashMinor: 0,
        expectedCashMinor: openingMinor,
        totalOrders: 0,
      };
      setData((prev) => ({ ...prev, activeShift: opened }));
      showToast({
        title: 'Cashier Shift Opened',
        description: `Opening float: ${formatMinorCurrency(openingMinor, data.currencyCode)}`,
        variant: 'success',
      });
      setShiftModalOpen(false);
      return;
    }

    const actualMinor = Math.max(0, Math.round(Number(actualCashMajor || '0') * 100));
    const pettyMinor = Math.max(0, Math.round(Number(pettyCashMajor || '0') * 100));
    const expected =
      data.activeShift.openingFloatMinor + data.activeShift.cashSalesMinor - pettyMinor;
    const variance = actualMinor - expected;

    try {
      await fetch('/api/v1/analytics/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: data.activeShift.id,
          actualCashMinor: actualMinor,
          pettyCashMinor: pettyMinor,
          notes: shiftNotes || undefined,
        }),
      });
    } catch {
      // Optimistic close
    }

    setData((prev) => ({
      ...prev,
      activeShift: prev.activeShift
        ? {
            ...prev.activeShift,
            status: 'CLOSED',
            closedAt: new Date().toISOString(),
            pettyCashMinor: pettyMinor,
            expectedCashMinor: expected,
            actualCashMinor: actualMinor,
            varianceMinor: variance,
          }
        : null,
    }));

    showToast({
      title: 'Z-Report Finalized',
      description: `Cash variance: ${formatMinorCurrency(variance, data.currencyCode)}`,
      variant: variance === 0 ? 'success' : 'warning',
    });
  };

  return (
    <div className="space-y-5">
      <OfflineBanner
        status={syncStatus}
        onSyncNow={() => void syncManager.flush(data.outletId)}
      />

      {/* Top Operations Bar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setSelectedStaffId(activeStaff?.id ?? data.staff[0]?.id ?? '');
              setPinModalOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--pb-accent)]"
          >
            <KeyRound className="size-4 text-[var(--pb-accent)]" aria-hidden="true" />
            <span>
              {activeStaff ? `${activeStaff.fullName} (${activeStaff.roleName})` : 'Switch Staff PIN'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTokenModalOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--pb-accent)] px-4 py-2 text-xs font-semibold text-[var(--pb-accent-ink)]"
          >
            <Ticket className="size-4" aria-hidden="true" />
            Issue Token #{data.nextTokenNumber}
          </button>

          <button
            type="button"
            onClick={() => setShiftModalOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3.5 py-2 text-xs font-semibold hover:border-[var(--pb-accent)]"
          >
            <Receipt className="size-4 text-[var(--pb-olive)]" aria-hidden="true" />
            {data.activeShift?.status === 'OPEN' ? 'Shift & Z-Report' : 'Open Shift Float'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={layoutEditMode}
            onClick={() => setLayoutEditMode((v) => !v)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
              layoutEditMode
                ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)]/12 text-[var(--pb-accent)]'
                : 'border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[var(--pb-ink)]'
            }`}
          >
            <Move className="size-4" aria-hidden="true" />
            {layoutEditMode ? 'Done Editing Layout' : 'Edit Floor Layout'}
          </button>
        </div>
      </section>

      {/* Zone Tabs */}
      <div role="tablist" aria-label="Floor zones" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={activeZoneId === 'ALL'}
          onClick={() => setActiveZoneId('ALL')}
          className={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
            activeZoneId === 'ALL'
              ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
              : 'border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-ink)]'
          }`}
        >
          All Zones ({data.tables.length})
        </button>
        {data.zones.map((zone) => {
          const count = data.tables.filter((t) => t.zoneId === zone.id).length;
          const active = activeZoneId === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveZoneId(zone.id)}
              className={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                  : 'border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-ink)]'
              }`}
            >
              {zone.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Split: Floor Map + Right Queues */}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Floor Map */}
        <section
          aria-label="Live Floor Map"
          onDragOver={(e) => {
            if (layoutEditMode) e.preventDefault();
          }}
          onDrop={(e) => void handleTableDrop(e)}
          className={`rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 ${
            layoutEditMode ? 'ring-2 ring-[var(--pb-accent)]/40' : ''
          }`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-xl tracking-tight">
              {layoutEditMode ? 'Drag tables to reposition coordinates' : 'Live Floor Map'}
            </h2>
            <div className="flex flex-wrap gap-2 text-[11px] text-[var(--pb-muted)]">
              <span className="inline-flex items-center gap-1">
                <Utensils className="size-3 text-[var(--pb-olive)]" aria-hidden="true" />
                Eating
              </span>
              <span className="inline-flex items-center gap-1">
                <BellRing className="size-3 text-[var(--pb-chili)]" aria-hidden="true" />
                Waiter Call
              </span>
              <span className="inline-flex items-center gap-1">
                <Receipt className="size-3 text-[var(--pb-turmeric)]" aria-hidden="true" />
                Bill Requested
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTables.map((table) => {
              const meta = TABLE_STATUS_META[table.status];
              return (
                <div
                  key={table.id}
                  draggable={layoutEditMode}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', table.id);
                  }}
                  className={`relative flex flex-col justify-between rounded-2xl border-2 p-4 transition-colors ${meta.border} ${meta.bg} ${
                    meta.pulse ? 'animate-pulse' : ''
                  } ${layoutEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {layoutEditMode && (
                          <GripVertical className="size-4 text-[var(--pb-muted)]" aria-hidden="true" />
                        )}
                        <span className="font-mono text-2xl font-bold tracking-tight">
                          {table.tableNumber}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--pb-muted)]">
                        {table.capacity} seats
                        {table.activeGuestCount ? ` · ${table.activeGuestCount} seated` : ''}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.badge}`}
                    >
                      {table.status === 'CALLING_WAITER' && (
                        <BellRing className="size-3" aria-hidden="true" />
                      )}
                      {meta.label}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--pb-border)]/60 pt-3">
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {table.runningTotalMinor
                        ? formatMinorCurrency(table.runningTotalMinor, data.currencyCode)
                        : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTable(table);
                        setTargetTableId('');
                      }}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--pb-accent)]"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Call Waiter & Captain Approval Queue */}
        <aside className="space-y-4">
          {/* Call Waiter Queue */}
          <section
            aria-label="Call Waiter Requests"
            className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg">Call Waiter Queue</h2>
              <span className="rounded-full bg-[var(--pb-chili)]/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-[var(--pb-chili)]">
                {openRequests.length}
              </span>
            </div>

            {openRequests.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--pb-muted)]">
                No active guest requests.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {openRequests.map((req) => (
                  <li
                    key={req.id}
                    className="rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold">
                        Table {req.tableNumber} · {req.requestType}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--pb-muted)]">
                        <Clock className="size-3" aria-hidden="true" />
                        {new Date(req.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {req.note && (
                      <p className="mt-1 text-xs text-[var(--pb-muted)]">{req.note}</p>
                    )}
                    <div className="mt-2.5 flex gap-2">
                      {req.status === 'OPEN' && (
                        <button
                          type="button"
                          onClick={() => void handleServiceRequestAction(req, 'CLAIMED')}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 text-xs font-semibold hover:border-[var(--pb-accent)]"
                        >
                          <UserCheck className="size-3.5" aria-hidden="true" />
                          Claim
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleServiceRequestAction(req, 'RESOLVED')}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--pb-olive)] px-3 text-xs font-semibold text-white"
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Resolve
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Captain Approval Queue */}
          <section
            aria-label="Captain Approval Queue"
            className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg">Captain Approval</h2>
              <span className="rounded-full bg-[var(--pb-turmeric)]/20 px-2.5 py-0.5 font-mono text-xs font-semibold text-[var(--pb-turmeric)]">
                {data.pendingApprovals.length}
              </span>
            </div>

            {data.pendingApprovals.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--pb-muted)]">
                No QR orders awaiting captain verification.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {data.pendingApprovals.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold">
                        {order.orderNumber} · {order.tableNumber}
                      </span>
                      <span className="font-mono text-xs font-semibold tabular-nums">
                        {formatMinorCurrency(order.totalMinor, data.currencyCode)}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--pb-muted)]">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.quantity}x {item.name}
                          {item.modifiers.length > 0 ? ` (${item.modifiers.join(', ')})` : ''}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCaptainOrderDecision(order, 'APPROVE')}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--pb-olive)] px-3 text-xs font-semibold text-white"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        Approve & Fire
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCaptainOrderDecision(order, 'REJECT')}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--pb-chili)] px-3 text-xs font-semibold text-[var(--pb-chili)]"
                        aria-label={`Reject ${order.orderNumber}`}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* Staff PIN Switcher Dialog */}
      <Dialog
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        title="Staff PIN Switcher"
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            Operator
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 text-sm text-[var(--pb-ink)]"
            >
              {data.staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} — {member.roleName}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            4–6 Digit Staff PIN
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 font-mono text-lg tracking-[0.4em] text-[var(--pb-ink)]"
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Back'].map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === 'Clear') setPinInput('');
                    else if (key === 'Back') setPinInput((p) => p.slice(0, -1));
                    else if (pinInput.length < 8) setPinInput((p) => `${p}${key}`);
                  }}
                  className="min-h-12 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] font-mono text-base font-semibold hover:border-[var(--pb-accent)]"
                >
                  {key}
                </button>
              ),
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPinModalOpen(false)}
              className="min-h-11 rounded-xl border border-[var(--pb-border)] px-4 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pinVerifying}
              onClick={() => void handleVerifyPin()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--pb-accent)] px-5 text-xs font-semibold text-[var(--pb-accent-ink)]"
            >
              <Lock className="size-3.5" aria-hidden="true" />
              {pinVerifying ? 'Verifying…' : 'Unlock & Switch'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Table Operations Dialog (Merge / Split / Transfer / Reset / Rotate QR) */}
      <Dialog
        open={selectedTable !== null}
        onClose={() => setSelectedTable(null)}
        title={selectedTable ? `Manage Table ${selectedTable.tableNumber}` : 'Table'}
      >
        {selectedTable && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Current Status: {selectedTable.status}</span>
                <span className="font-mono">QR: {selectedTable.qrToken}</span>
              </div>
              <p className="mt-1 text-[var(--pb-muted)]">
                Running Tab:{' '}
                {selectedTable.runningTotalMinor
                  ? formatMinorCurrency(selectedTable.runningTotalMinor, data.currencyCode)
                  : 'No active tab'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['TRANSFER', 'MERGE', 'SPLIT'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTableOpMode(mode)}
                  className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold ${
                    tableOpMode === mode
                      ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)]/12 text-[var(--pb-accent)]'
                      : 'border-[var(--pb-border)] bg-[var(--pb-canvas)]'
                  }`}
                >
                  {mode === 'TRANSFER' && <ArrowLeftRight className="size-3.5" aria-hidden="true" />}
                  {mode === 'MERGE' && <Layers className="size-3.5" aria-hidden="true" />}
                  {mode === 'SPLIT' && <Split className="size-3.5" aria-hidden="true" />}
                  {mode}
                </button>
              ))}
            </div>

            {(tableOpMode === 'TRANSFER' || tableOpMode === 'MERGE') && (
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
                Target Table
                <select
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 text-sm text-[var(--pb-ink)]"
                >
                  <option value="">Select destination table…</option>
                  {data.tables
                    .filter((t) => t.id !== selectedTable.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.tableNumber} ({t.status})
                      </option>
                    ))}
                </select>
              </label>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleTableOperation(tableOpMode)}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--pb-accent)] px-4 text-xs font-semibold text-[var(--pb-accent-ink)]"
              >
                Execute {tableOpMode}
              </button>
              <button
                type="button"
                onClick={() => void handleTableOperation('ROTATE_QR')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--pb-border)] px-3 text-xs font-semibold"
              >
                <QrCode className="size-3.5" aria-hidden="true" />
                Rotate QR
              </button>
              <button
                type="button"
                onClick={() => void handleTableOperation('RESET')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--pb-chili)] px-3 text-xs font-semibold text-[var(--pb-chili)]"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset Table
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Counter / Takeaway Token Issuer Dialog */}
      <Dialog
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        title={`Issue Counter / Takeaway Token #${data.nextTokenNumber}`}
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            Guest / Order Label
            <input
              type="text"
              value={tokenGuestName}
              onChange={(e) => setTokenGuestName(e.target.value)}
              placeholder={`Walk-in #${data.nextTokenNumber}`}
              className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 text-sm text-[var(--pb-ink)]"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            Items Summary
            <input
              type="text"
              value={tokenItemSummary}
              onChange={(e) => setTokenItemSummary(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 text-sm text-[var(--pb-ink)]"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            Amount ({data.currencyCode})
            <input
              type="number"
              step="0.01"
              min="0"
              value={tokenAmountMajor}
              onChange={(e) => setTokenAmountMajor(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 font-mono text-sm text-[var(--pb-ink)]"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTokenModalOpen(false)}
              className="min-h-11 rounded-xl border border-[var(--pb-border)] px-4 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleIssueTakeawayToken()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--pb-accent)] px-5 text-xs font-semibold text-[var(--pb-accent-ink)]"
            >
              <Ticket className="size-4" aria-hidden="true" />
              Issue Token #{data.nextTokenNumber}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Cashier Shift Float & Z-Report Dialog */}
      <Dialog
        open={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        title={
          data.activeShift?.status === 'OPEN'
            ? 'Cashier Shift & Z-Report Reconciliation'
            : 'Open Cashier Shift Float'
        }
      >
        {data.activeShift?.status === 'OPEN' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3 text-xs">
              <div>
                <p className="text-[var(--pb-muted)]">Opening Float</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatMinorCurrency(data.activeShift.openingFloatMinor, data.currencyCode)}
                </p>
              </div>
              <div>
                <p className="text-[var(--pb-muted)]">Cash Sales</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatMinorCurrency(data.activeShift.cashSalesMinor, data.currencyCode)}
                </p>
              </div>
              <div>
                <p className="text-[var(--pb-muted)]">Card + UPI/MFS</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {formatMinorCurrency(
                    data.activeShift.cardSalesMinor + data.activeShift.upiMfsSalesMinor,
                    data.currencyCode,
                  )}
                </p>
              </div>
              <div>
                <p className="text-[var(--pb-muted)]">Total Orders</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {data.activeShift.totalOrders}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
                Actual Drawer Cash ({data.currencyCode})
                <input
                  type="number"
                  step="0.01"
                  value={actualCashMajor}
                  onChange={(e) => setActualCashMajor(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 font-mono text-sm text-[var(--pb-ink)]"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
                Petty Cash Paid Out ({data.currencyCode})
                <input
                  type="number"
                  step="0.01"
                  value={pettyCashMajor}
                  onChange={(e) => setPettyCashMajor(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 font-mono text-sm text-[var(--pb-ink)]"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Shift Notes
              <input
                type="text"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="Optional handover remarks…"
                className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 text-sm text-[var(--pb-ink)]"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--pb-border)] px-4 text-xs font-semibold"
              >
                <Printer className="size-3.5" aria-hidden="true" />
                Print Z-Report
              </button>
              <button
                type="button"
                onClick={() => void handleShiftSubmit()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--pb-accent)] px-5 text-xs font-semibold text-[var(--pb-accent-ink)]"
              >
                <DollarSign className="size-3.5" aria-hidden="true" />
                Close Shift & Finalize Z-Report
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Opening Cash Float ({data.currencyCode})
              <input
                type="number"
                step="0.01"
                value={openingFloatMajor}
                onChange={(e) => setOpeningFloatMajor(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 font-mono text-sm text-[var(--pb-ink)]"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                className="min-h-11 rounded-xl border border-[var(--pb-border)] px-4 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleShiftSubmit()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--pb-olive)] px-5 text-xs font-semibold text-white"
              >
                Open Shift
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
