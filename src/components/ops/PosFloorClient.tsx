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
  ChefHat,
  Clock,
  DollarSign,
  GripVertical,
  KeyRound,
  Layers,
  Lock,
  Minus,
  Move,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RotateCcw,
  Split,
  Ticket,
  Trash2,
  UserCheck,
  Utensils,
  Wine,
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
  { label: string; border: string; bg: string; badge: string; glow: string; pulse?: boolean }
> = {
  VACANT: {
    label: 'Vacant',
    border: 'border-white/10',
    bg: 'bg-[#18181F]/60',
    badge: 'bg-[#09090B] text-[#A1A1AA] border border-white/10',
    glow: '',
  },
  ORDERING: {
    label: 'Ordering',
    border: 'border-[#0EA5E9]/70',
    bg: 'bg-[#0EA5E9]/10',
    badge: 'bg-[#0EA5E9]/20 text-[#38BDF8] border border-[#0EA5E9]/30',
    glow: 'shadow-[0_0_18px_-4px_rgba(14,165,233,0.3)]',
  },
  EATING: {
    label: 'Eating',
    border: 'border-[#10B981]/70',
    bg: 'bg-[#10B981]/10',
    badge: 'bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30',
    glow: 'shadow-[0_0_18px_-4px_rgba(16,185,129,0.28)]',
  },
  CALLING_WAITER: {
    label: 'Calling Waiter',
    border: 'border-[#EF4444] ring-2 ring-[#EF4444]/40',
    bg: 'bg-[#EF4444]/15',
    badge: 'bg-[#EF4444] text-white font-bold animate-pulse',
    glow: 'shadow-[0_0_24px_0px_rgba(239,68,68,0.38)]',
    pulse: true,
  },
  BILL_REQUESTED: {
    label: 'Bill Requested',
    border: 'border-[#F59E0B]/80',
    bg: 'bg-[#F59E0B]/10',
    badge: 'bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/40',
    glow: 'shadow-[0_0_18px_-4px_rgba(245,158,11,0.3)]',
  },
  CLEANING: {
    label: 'Cleaning / Turn',
    border: 'border-zinc-500/50',
    bg: 'bg-zinc-800/35',
    badge: 'bg-zinc-700/40 text-zinc-300 border border-zinc-600/40',
    glow: '',
  },
};

function getTableStatusMeta(status: string) {
  if (status in TABLE_STATUS_META) {
    return TABLE_STATUS_META[status as DiningTableStatus];
  }
  switch (status) {
    case 'AVAILABLE':
      return TABLE_STATUS_META.VACANT;
    case 'OCCUPIED':
      return TABLE_STATUS_META.EATING;
    case 'RESERVED':
      return TABLE_STATUS_META.ORDERING;
    default:
      return TABLE_STATUS_META.VACANT;
  }
}

const WAITER_QUICK_MENU = [
  { id: 'wm-1', name: 'Smoked Butter Chicken', priceMinor: 58000, station: 'Curry' },
  { id: 'wm-2', name: 'Charcoal Tandoori Lamb Chops', priceMinor: 89000, station: 'Tandoor' },
  { id: 'wm-3', name: 'Garlic Butter Naan', priceMinor: 14000, station: 'Tandoor' },
  { id: 'wm-4', name: 'Kacchi Biryani Platter', priceMinor: 75000, station: 'Curry' },
  { id: 'wm-5', name: 'Mango Lassi', priceMinor: 22000, station: 'Drinks' },
  { id: 'wm-6', name: 'Saffron Old Fashioned (Zero-Proof)', priceMinor: 38000, station: 'Drinks' },
];

function createDemoPosPayload(outletSlug: string): PosBootstrapPayload {
  const outletId = '11111111-1111-4111-8111-111111111111';
  const now = Date.now();
  return {
    outletId,
    outletName: outletSlug === 'demo' || outletSlug === 'zaika-bistro' ? 'Zaika — Gulshan, Dhaka' : outletSlug,
    outletSlug,
    currencyCode: 'BDT',
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
        runningTotalMinor: 385000,
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
        runningTotalMinor: 240000,
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
        runningTotalMinor: 620000,
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
        tableNumber: 'T5',
        capacity: 4,
        status: 'ORDERING',
        activeSessionId: 'sess-5',
        posX: 40,
        posY: 40,
        qrToken: 'pb-t5-demo',
        activeGuestCount: 2,
        runningTotalMinor: 195000,
      },
      {
        id: 't-6',
        zoneId: 'z-vip',
        tableNumber: 'T6',
        capacity: 8,
        status: 'CLEANING',
        activeSessionId: null,
        posX: 40,
        posY: 40,
        qrToken: 'pb-t6-demo',
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
        tableNumber: 'T5',
        source: 'QR',
        status: 'PENDING_APPROVAL',
        totalMinor: 195000,
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
      openingFloatMinor: 500000,
      cashSalesMinor: 1450000,
      cardSalesMinor: 2150000,
      upiMfsSalesMinor: 1250000,
      pettyCashMinor: 40000,
      expectedCashMinor: 1910000,
      totalOrders: 46,
    },
    nextTokenNumber: 42,
  };
}

function normalizePosPayload(
  raw: Partial<PosBootstrapPayload> & { currency?: string; pendingOrders?: OpsPendingOrder[] },
  outletSlug: string,
): PosBootstrapPayload {
  const fallback = createDemoPosPayload(outletSlug);
  return {
    outletId: raw.outletId ?? fallback.outletId,
    outletName: raw.outletName ?? fallback.outletName,
    outletSlug: raw.outletSlug ?? outletSlug,
    currencyCode: raw.currencyCode ?? raw.currency ?? 'BDT',
    zones: Array.isArray(raw.zones) ? raw.zones : fallback.zones,
    tables: Array.isArray(raw.tables) ? raw.tables : fallback.tables,
    pendingApprovals: Array.isArray(raw.pendingApprovals)
      ? raw.pendingApprovals
      : Array.isArray(raw.pendingOrders)
        ? raw.pendingOrders
        : [],
    serviceRequests: Array.isArray(raw.serviceRequests) ? raw.serviceRequests : [],
    staff: Array.isArray(raw.staff) ? raw.staff : fallback.staff,
    activeShift: raw.activeShift !== undefined ? raw.activeShift : fallback.activeShift,
    nextTokenNumber: typeof raw.nextTokenNumber === 'number' ? raw.nextTokenNumber : 42,
  };
}

export function PosFloorClient({ outletSlug }: { outletSlug: string }) {
  const [data, setData] = useState<PosBootstrapPayload>(() =>
    createDemoPosPayload(outletSlug),
  );
  const [activeZoneId, setActiveZoneId] = useState<string>('ALL');
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [activeStaff, setActiveStaff] = useState<OpsStaffMember | null>(null);
  const [inspectedTableId, setInspectedTableId] = useState<string>('t-2');

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

  const [tableOpsOpen, setTableOpsOpen] = useState(false);
  const [tableOpMode, setTableOpMode] = useState<'TRANSFER' | 'MERGE' | 'SPLIT'>('TRANSFER');
  const [targetTableId, setTargetTableId] = useState<string>('');

  const [billPreviewTable, setBillPreviewTable] = useState<OpsTable | null>(null);

  const [waiterOrderOpen, setWaiterOrderOpen] = useState(false);
  const [waiterTableId, setWaiterTableId] = useState<string>('t-1');
  const [waiterCart, setWaiterCart] = useState<Record<string, number>>({ 'wm-1': 1 });
  const [waiterOrderNote, setWaiterOrderNote] = useState('');

  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenGuestName, setTokenGuestName] = useState('');
  const [tokenItemSummary, setTokenItemSummary] = useState('Walk-in Counter Combo');
  const [tokenAmountMajor, setTokenAmountMajor] = useState('450');

  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [openingFloatMajor, setOpeningFloatMajor] = useState('5000');
  const [actualCashMajor, setActualCashMajor] = useState('19100');
  const [pettyCashMajor, setPettyCashMajor] = useState('400');
  const [shiftNotes, setShiftNotes] = useState('');

  const seenCallIdsRef = useRef<Set<string>>(new Set());

  const loadBootstrap = useCallback(async () => {
    const snapKey = `pos:${outletSlug}`;
    try {
      const res = await fetch(`/api/v1/pos/${encodeURIComponent(outletSlug)}/bootstrap`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const raw = (await res.json()) as Partial<PosBootstrapPayload> & {
          currency?: string;
          pendingOrders?: OpsPendingOrder[];
        };
        const payload = normalizePosPayload(raw, outletSlug);
        setData(payload);
        setActiveStaff((prev) => prev ?? payload.staff[0] ?? null);
        setInspectedTableId((prev) =>
          payload.tables.some((t) => t.id === prev)
            ? prev
            : (payload.tables.find((t) => t.status !== 'VACANT' && t.status !== ('AVAILABLE' as string))?.id ??
              payload.tables[0]?.id ??
              ''),
        );
        await saveOfflineSnapshot(snapKey, payload.outletId, payload);
        return;
      }
    } catch {
      // Fall through to offline snapshot / demo
    }

    const cached = await readOfflineSnapshot<PosBootstrapPayload>(snapKey);
    if (cached?.data) {
      const normalized = normalizePosPayload(cached.data, outletSlug);
      setData(normalized);
      setActiveStaff((prev) => prev ?? normalized.staff[0] ?? null);
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
    const poll = setInterval(() => {
      if (active && typeof navigator !== 'undefined' && navigator.onLine) {
        void loadBootstrap();
      }
    }, 8000);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(poll);
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

  const inspectedTable = useMemo(
    () => data.tables.find((t) => t.id === inspectedTableId) ?? data.tables[0] ?? null,
    [data.tables, inspectedTableId],
  );

  const inspectedTableRequests = useMemo(
    () =>
      inspectedTable
        ? openRequests.filter((sr) => sr.tableId === inspectedTable.id)
        : [],
    [inspectedTable, openRequests],
  );

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
        title: 'Saved to offline queue',
        description: `Table ${req.tableNumber} ${nextStatus.toLowerCase()} queued for delta sync.`,
        variant: 'info',
      });
    }
  };

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

  const handleTableOperation = async (
    table: OpsTable,
    operation: 'MERGE' | 'TRANSFER' | 'SPLIT' | 'RESET' | 'ROTATE_QR',
  ) => {
    if ((operation === 'MERGE' || operation === 'TRANSFER') && !targetTableId) {
      showToast({ title: 'Select a target table first', variant: 'warning' });
      return;
    }

    try {
      const res = await fetch(`/api/v1/floor/tables/${table.id}/operations`, {
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
        if (operation === 'RESET' && t.id === table.id) {
          return {
            ...t,
            status: 'VACANT',
            activeSessionId: null,
            activeGuestCount: 0,
            runningTotalMinor: 0,
          };
        }
        if (operation === 'ROTATE_QR' && t.id === table.id) {
          return { ...t, qrToken: `pb-${t.tableNumber.toLowerCase()}-${Date.now().toString(36)}` };
        }
        if (operation === 'TRANSFER' && t.id === table.id) {
          return { ...t, status: 'VACANT', activeSessionId: null, runningTotalMinor: 0 };
        }
        if (operation === 'TRANSFER' && t.id === targetTableId) {
          return {
            ...t,
            status: table.status === 'VACANT' ? 'ORDERING' : table.status,
            activeSessionId: table.activeSessionId,
            runningTotalMinor: table.runningTotalMinor,
          };
        }
        return t;
      }),
    }));

    showToast({
      title: `Table ${table.tableNumber}: ${operation.replace('_', ' ')}`,
      variant: 'success',
    });
    setTableOpsOpen(false);
    setTargetTableId('');
  };

  const handleFireWaiterOrder = async () => {
    const selectedEntries = Object.entries(waiterCart).filter(([, qty]) => qty > 0);
    if (selectedEntries.length === 0) {
      showToast({ title: 'Add at least one dish to fire', variant: 'warning' });
      return;
    }

    const table = data.tables.find((t) => t.id === waiterTableId) ?? data.tables[0];
    const itemsPayload = selectedEntries.map(([itemId, qty]) => {
      const menu = WAITER_QUICK_MENU.find((m) => m.id === itemId)!;
      return {
        menuItemId: menu.id,
        name: menu.name,
        quantity: qty,
        priceMinor: menu.priceMinor,
        notes: waiterOrderNote || undefined,
      };
    });
    const orderTotalMinor = itemsPayload.reduce(
      (sum, item) => sum + item.priceMinor * item.quantity,
      0,
    );
    const idempotencyKey = `waiter-${table?.tableNumber ?? 'cnt'}-${crypto.randomUUID()}`;
    const sessionTarget = table?.activeSessionId ?? 'counter';

    const payload = {
      source: 'WAITER' as const,
      idempotencyKey,
      items: itemsPayload.map((i) => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        modifierIds: [],
        notes: i.notes,
      })),
    };

    if (!navigator.onLine) {
      await syncManager.queueMutation(data.outletId, 'PLACE_ORDER', payload, idempotencyKey);
    } else {
      try {
        await fetch(`/api/v1/sessions/${encodeURIComponent(sessionTarget)}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        await syncManager.queueMutation(data.outletId, 'PLACE_ORDER', payload, idempotencyKey);
      }
    }

    if (table) {
      setData((prev) => ({
        ...prev,
        tables: prev.tables.map((t) =>
          t.id === table.id
            ? {
                ...t,
                status: t.status === 'VACANT' ? 'ORDERING' : t.status,
                activeSessionId: t.activeSessionId ?? `sess-${t.tableNumber.toLowerCase()}`,
                runningTotalMinor: (t.runningTotalMinor ?? 0) + orderTotalMinor,
              }
            : t,
        ),
      }));
      setInspectedTableId(table.id);
    }

    setWaiterOrderOpen(false);
    setWaiterOrderNote('');
    showToast({
      title: `Waiter KOT Fired to KDS`,
      description: `${table ? `Table ${table.tableNumber}` : 'Counter'} · ${formatMinorCurrency(orderTotalMinor, 'BDT')}`,
      variant: 'success',
    });
  };

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
        await fetch('/api/v1/sessions/counter/orders', {
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
      description: `${tokenItemSummary} · ${formatMinorCurrency(amountMinor, 'BDT')}`,
      variant: 'success',
    });
  };

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
        description: `Opening float: ${formatMinorCurrency(openingMinor, 'BDT')}`,
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
      description: `Cash variance: ${formatMinorCurrency(variance, 'BDT')}`,
      variant: variance === 0 ? 'success' : 'warning',
    });
  };

  const waiterCartTotalMinor = useMemo(
    () =>
      Object.entries(waiterCart).reduce((sum, [id, qty]) => {
        const item = WAITER_QUICK_MENU.find((m) => m.id === id);
        return sum + (item ? item.priceMinor * qty : 0);
      }, 0),
    [waiterCart],
  );

  return (
    <div className="space-y-5">
      <OfflineBanner
        status={syncStatus}
        onSyncNow={() => void syncManager.flush(data.outletId)}
      />

      {/* Top Operations Command Bar */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-[#111115] p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setSelectedStaffId(activeStaff?.id ?? data.staff[0]?.id ?? '');
              setPinModalOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#18181F] px-3.5 py-2 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
          >
            <KeyRound className="size-4 text-[#FF5412]" aria-hidden="true" />
            <span>
              {activeStaff ? `${activeStaff.fullName} (${activeStaff.roleName})` : 'Switch Staff PIN'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setWaiterTableId(inspectedTable?.id ?? data.tables[0]?.id ?? 't-1');
              setWaiterOrderOpen(true);
            }}
            className="shadow-beam inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF5412] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#FF7033]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Waiter POS Order
          </button>

          <button
            type="button"
            onClick={() => setTokenModalOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#FF5412]/40 bg-[#FF5412]/15 px-3.5 py-2 text-xs font-semibold text-[#FFA06D] transition-colors hover:bg-[#FF5412]/25"
          >
            <Ticket className="size-4" aria-hidden="true" />
            Issue Token #{data.nextTokenNumber}
          </button>

          <button
            type="button"
            onClick={() => setShiftModalOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#18181F] px-3.5 py-2 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
          >
            <Receipt className="size-4 text-[#10B981]" aria-hidden="true" />
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
                ? 'border-[#FF5412] bg-[#FF5412]/15 text-[#FFA06D]'
                : 'border-white/10 bg-[#18181F] text-[#F4F4F5] hover:border-white/25'
            }`}
          >
            <Move className="size-4" aria-hidden="true" />
            {layoutEditMode ? 'Done Editing Layout' : 'Edit Floor Layout'}
          </button>
        </div>
      </section>

      {/* Zone Filter Pills */}
      <div role="tablist" aria-label="Floor zones" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={activeZoneId === 'ALL'}
          onClick={() => setActiveZoneId('ALL')}
          className={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
            activeZoneId === 'ALL'
              ? 'shadow-beam border-[#FF5412] bg-[#FF5412] text-white'
              : 'border-white/10 bg-[#111115] text-[#F4F4F5] hover:border-white/25'
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
                  ? 'shadow-beam border-[#FF5412] bg-[#FF5412] text-white'
                  : 'border-white/10 bg-[#111115] text-[#F4F4F5] hover:border-white/25'
              }`}
            >
              {zone.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Split: Floor Map + Right Inspector & Queues */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Floor Map */}
        <section
          aria-label="Live Floor Map"
          onDragOver={(e) => {
            if (layoutEditMode) e.preventDefault();
          }}
          onDrop={(e) => void handleTableDrop(e)}
          className={`grid-bg rounded-3xl border border-white/10 bg-[#111115] p-4 sm:p-5 ${
            layoutEditMode ? 'ring-2 ring-[#FF5412]/50' : ''
          }`}
        >
          {/* Kitchen Pass & Bar Counter Spatial Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#18181F] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ChefHat className="size-4 text-[#FF5412]" aria-hidden="true" />
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#F4F4F5]">
                Kitchen Pass &amp; Bar Counter
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#A1A1AA]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#09090B] px-2.5 py-1">
                <span className="size-1.5 rounded-full bg-[#FF5412]" aria-hidden="true" />
                Tandoor Pass
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#09090B] px-2.5 py-1">
                <span className="size-1.5 rounded-full bg-[#F59E0B]" aria-hidden="true" />
                Curry Line
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#09090B] px-2.5 py-1">
                <Wine className="size-3 text-[#0EA5E9]" aria-hidden="true" />
                Bar &amp; Drinks
              </span>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold tracking-tight text-[#F4F4F5]">
              {layoutEditMode ? 'Drag tables to reposition coordinates' : 'Live Floor Map'}
            </h2>
            <div className="flex flex-wrap gap-3 text-[11px] text-[#A1A1AA]">
              <span className="inline-flex items-center gap-1">
                <Utensils className="size-3 text-[#10B981]" aria-hidden="true" />
                Eating
              </span>
              <span className="inline-flex items-center gap-1">
                <BellRing className="size-3 text-[#EF4444]" aria-hidden="true" />
                Waiter Call
              </span>
              <span className="inline-flex items-center gap-1">
                <Receipt className="size-3 text-[#F59E0B]" aria-hidden="true" />
                Bill Requested
              </span>
            </div>
          </div>

          <div className="ops-column-contain grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTables.map((table) => {
              const meta = getTableStatusMeta(table.status);
              const isInspected = inspectedTable?.id === table.id;
              return (
                <div
                  key={table.id}
                  role="button"
                  tabIndex={0}
                  draggable={layoutEditMode}
                  onClick={() => setInspectedTableId(table.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setInspectedTableId(table.id);
                    }
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', table.id);
                  }}
                  className={`relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${meta.border} ${meta.bg} ${meta.glow} ${
                    isInspected ? 'ring-2 ring-[#FF5412] ring-offset-2 ring-offset-[#09090B]' : ''
                  } ${meta.pulse ? 'animate-pulse' : ''} ${layoutEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {layoutEditMode && (
                          <GripVertical className="size-4 text-[#A1A1AA]" aria-hidden="true" />
                        )}
                        <span className="font-mono text-2xl font-bold tracking-tight text-[#F4F4F5]">
                          {table.tableNumber}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#A1A1AA]">
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

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                    <span className="font-mono text-sm font-semibold tabular-nums text-[#F4F4F5]">
                      {table.runningTotalMinor
                        ? formatMinorCurrency(table.runningTotalMinor, 'BDT')
                        : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedTableId(table.id);
                        setTargetTableId('');
                        setTableOpsOpen(true);
                      }}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-[#18181F] px-3 py-1.5 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Persistent Table Inspector + Queues */}
        <aside className="space-y-4">
          {/* Persistent Selected Table Inspector */}
          <section
            aria-label="Selected Table Inspector"
            className="rounded-3xl border border-white/10 bg-[#111115] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#A1A1AA]">
                Table Inspector
              </h2>
              {inspectedTable && (
                <span className="rounded-full border border-[#FF5412]/40 bg-[#FF5412]/15 px-2.5 py-0.5 font-mono text-xs font-bold text-[#FFA06D]">
                  {inspectedTable.tableNumber}
                </span>
              )}
            </div>

            {!inspectedTable ? (
              <p className="mt-3 text-xs text-[#A1A1AA]">
                Select any table on the floor map to inspect its tab, QR token, and actions.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-[#18181F] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#F4F4F5]">
                      {getTableStatusMeta(inspectedTable.status).label}
                    </span>
                    <span className="font-mono text-base font-bold tabular-nums text-[#F4F4F5]">
                      {inspectedTable.runningTotalMinor
                        ? formatMinorCurrency(inspectedTable.runningTotalMinor, 'BDT')
                        : '৳0'}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[#A1A1AA]">
                    QR: {inspectedTable.qrToken}
                  </p>
                </div>

                {inspectedTableRequests.length > 0 && (
                  <div className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-3">
                    <p className="text-xs font-bold text-[#FCA5A5]">
                      Active Help: {inspectedTableRequests[0].requestType}
                    </p>
                    {inspectedTableRequests[0].note && (
                      <p className="mt-0.5 text-xs text-[#F4F4F5]/80">
                        {inspectedTableRequests[0].note}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      {inspectedTableRequests[0].status === 'OPEN' && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleServiceRequestAction(inspectedTableRequests[0], 'CLAIMED')
                          }
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-white/15 bg-[#18181F] px-2.5 text-xs font-semibold text-[#F4F4F5]"
                        >
                          <UserCheck className="size-3.5" aria-hidden="true" />
                          Claim Help
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void handleServiceRequestAction(inspectedTableRequests[0], 'RESOLVED')
                        }
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-[#10B981] px-2.5 text-xs font-semibold text-white"
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Resolve Help
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleTableOperation(inspectedTable, 'ROTATE_QR')}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
                  >
                    <QrCode className="size-3.5 text-[#FF5412]" aria-hidden="true" />
                    Rotate QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillPreviewTable(inspectedTable)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
                  >
                    <Printer className="size-3.5 text-[#F59E0B]" aria-hidden="true" />
                    Print Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetTableId('');
                      setTableOpsOpen(true);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
                  >
                    <ArrowLeftRight className="size-3.5 text-[#0EA5E9]" aria-hidden="true" />
                    Move / Split
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleTableOperation(inspectedTable, 'RESET')}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 text-xs font-semibold text-[#FCA5A5] transition-colors hover:bg-[#EF4444]/20"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Clear Table
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Call Waiter Queue */}
          <section
            aria-label="Call Waiter Requests"
            className="rounded-3xl border border-white/10 bg-[#111115] p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#F4F4F5]">Call Waiter Queue</h2>
              <span className="rounded-full bg-[#EF4444]/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#FCA5A5]">
                {openRequests.length}
              </span>
            </div>

            {openRequests.length === 0 ? (
              <p className="mt-3 text-xs text-[#A1A1AA]">
                No active guest requests.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {openRequests.map((req) => (
                  <li
                    key={req.id}
                    className="rounded-2xl border border-white/10 bg-[#18181F] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-[#F4F4F5]">
                        Table {req.tableNumber} · {req.requestType}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#A1A1AA]">
                        <Clock className="size-3" aria-hidden="true" />
                        {new Date(req.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {req.note && (
                      <p className="mt-1 text-xs text-[#A1A1AA]">{req.note}</p>
                    )}
                    <div className="mt-2.5 flex gap-2">
                      {req.status === 'OPEN' && (
                        <button
                          type="button"
                          onClick={() => void handleServiceRequestAction(req, 'CLAIMED')}
                          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#111115] px-3 text-xs font-semibold text-[#F4F4F5] hover:border-[#FF5412]"
                        >
                          <UserCheck className="size-3.5" aria-hidden="true" />
                          Claim
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleServiceRequestAction(req, 'RESOLVED')}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#10B981] px-3 text-xs font-semibold text-white"
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
            className="rounded-3xl border border-white/10 bg-[#111115] p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#F4F4F5]">Captain Approval</h2>
              <span className="rounded-full bg-[#F59E0B]/20 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#FBBF24]">
                {data.pendingApprovals.length}
              </span>
            </div>

            {data.pendingApprovals.length === 0 ? (
              <p className="mt-3 text-xs text-[#A1A1AA]">
                No QR orders awaiting captain verification.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {data.pendingApprovals.map((order) => (
                  <li
                    key={order.id}
                    className="rounded-2xl border border-white/10 bg-[#18181F] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#F4F4F5]">
                        {order.orderNumber} · {order.tableNumber}
                      </span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-[#FFA06D]">
                        {formatMinorCurrency(order.totalMinor, 'BDT')}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-[#A1A1AA]">
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
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-[#10B981] px-3 text-xs font-semibold text-white"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        Approve &amp; Fire
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCaptainOrderDecision(order, 'REJECT')}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#EF4444]/60 px-3 text-xs font-semibold text-[#FCA5A5]"
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

      {/* Waiter POS Order Dialog */}
      <Dialog
        open={waiterOrderOpen}
        onClose={() => setWaiterOrderOpen(false)}
        title="Waiter Assisted POS Order"
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Target Table
            <select
              value={waiterTableId}
              onChange={(e) => setWaiterTableId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2.5 text-sm text-[#F4F4F5]"
            >
              {data.tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tableNumber} — {getTableStatusMeta(t.status).label}
                </option>
              ))}
            </select>
          </label>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {WAITER_QUICK_MENU.map((item) => {
              const qty = waiterCart[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#18181F] px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#F4F4F5]">{item.name}</p>
                    <p className="font-mono text-xs text-[#A1A1AA]">
                      {formatMinorCurrency(item.priceMinor, 'BDT')} · {item.station}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name}`}
                      onClick={() =>
                        setWaiterCart((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1),
                        }))
                      }
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-[#09090B] text-[#F4F4F5]"
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center font-mono text-sm font-bold text-[#F4F4F5]">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name}`}
                      onClick={() =>
                        setWaiterCart((prev) => ({
                          ...prev,
                          [item.id]: (prev[item.id] ?? 0) + 1,
                        }))
                      }
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#FF5412]/50 bg-[#FF5412]/15 text-[#FFA06D]"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Kitchen Note (Optional)
            <input
              type="text"
              value={waiterOrderNote}
              onChange={(e) => setWaiterOrderNote(e.target.value)}
              placeholder="e.g. No peanuts, serve starters first…"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
            />
          </label>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#A1A1AA]">Order Total</p>
              <p className="font-mono text-lg font-bold tabular-nums text-[#F4F4F5]">
                {formatMinorCurrency(waiterCartTotalMinor, 'BDT')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWaiterOrderOpen(false)}
                className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-semibold text-[#F4F4F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleFireWaiterOrder()}
                className="shadow-beam inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF5412] px-5 text-xs font-semibold text-white hover:bg-[#FF7033]"
              >
                <ChefHat className="size-4" aria-hidden="true" />
                Fire Order to KDS
              </button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Thermal Bill Preview Modal */}
      <Dialog
        open={billPreviewTable !== null}
        onClose={() => setBillPreviewTable(null)}
        title={billPreviewTable ? `Thermal Bill — Table ${billPreviewTable.tableNumber}` : 'Thermal Bill'}
      >
        {billPreviewTable && (() => {
          const subtotalMinor = billPreviewTable.runningTotalMinor ?? 0;
          const vatMinor = Math.round(subtotalMinor * 0.05);
          const scMinor = Math.round(subtotalMinor * 0.1);
          const grandTotalMinor = subtotalMinor + vatMinor + scMinor;
          return (
            <div className="space-y-4">
              <div className="thermal-receipt mx-auto max-w-xs p-5 font-mono text-xs leading-relaxed">
                <p className="text-center text-sm font-bold uppercase tracking-wider">
                  {data.outletName}
                </p>
                <p className="text-center text-[11px] opacity-75">
                  VAT Reg #PB-BD-2026 · 80mm ESC/POS
                </p>
                <div className="my-3 border-t border-dashed border-zinc-400" />
                <div className="flex justify-between">
                  <span>TABLE: {billPreviewTable.tableNumber}</span>
                  <span>GUESTS: {billPreviewTable.activeGuestCount ?? 1}</span>
                </div>
                <div className="flex justify-between text-[11px] opacity-80">
                  <span>TIME: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>CCY: BDT</span>
                </div>
                <div className="my-3 border-t border-dashed border-zinc-400" />
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Running Table Tab</span>
                    <span>{formatMinorCurrency(subtotalMinor, 'BDT')}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>VAT (5%)</span>
                    <span>{formatMinorCurrency(vatMinor, 'BDT')}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Service Charge (10%)</span>
                    <span>{formatMinorCurrency(scMinor, 'BDT')}</span>
                  </div>
                </div>
                <div className="my-3 border-t border-dashed border-zinc-400" />
                <div className="flex justify-between text-sm font-bold">
                  <span>TOTAL DUE</span>
                  <span>{formatMinorCurrency(grandTotalMinor, 'BDT')}</span>
                </div>
                <p className="mt-4 text-center text-[10px] opacity-75">
                  Thank you for dining with PlateBeam OS
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBillPreviewTable(null)}
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
                  Print Bill
                </button>
              </div>
            </div>
          );
        })()}
      </Dialog>

      {/* Staff PIN Switcher Dialog */}
      <Dialog
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        title="Staff PIN Switcher"
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Operator
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
            >
              {data.staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} — {member.roleName}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            4–6 Digit Staff PIN
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 font-mono text-lg tracking-[0.4em] text-[#F4F4F5]"
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
                  className="min-h-12 rounded-xl border border-white/10 bg-[#18181F] font-mono text-base font-semibold text-[#F4F4F5] hover:border-[#FF5412]"
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
              className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-semibold text-[#F4F4F5]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pinVerifying}
              onClick={() => void handleVerifyPin()}
              className="shadow-beam inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF5412] px-5 text-xs font-semibold text-white hover:bg-[#FF7033]"
            >
              <Lock className="size-3.5" aria-hidden="true" />
              {pinVerifying ? 'Verifying…' : 'Unlock & Switch'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Table Operations Dialog (Merge / Split / Transfer / Reset / Rotate QR) */}
      <Dialog
        open={tableOpsOpen && inspectedTable !== null}
        onClose={() => setTableOpsOpen(false)}
        title={inspectedTable ? `Manage Table ${inspectedTable.tableNumber}` : 'Table'}
      >
        {inspectedTable && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#09090B] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#F4F4F5]">
                  Current Status: {inspectedTable.status}
                </span>
                <span className="font-mono text-[#A1A1AA]">QR: {inspectedTable.qrToken}</span>
              </div>
              <p className="mt-1 text-[#A1A1AA]">
                Running Tab:{' '}
                {inspectedTable.runningTotalMinor
                  ? formatMinorCurrency(inspectedTable.runningTotalMinor, 'BDT')
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
                      ? 'border-[#FF5412] bg-[#FF5412]/15 text-[#FFA06D]'
                      : 'border-white/10 bg-[#18181F] text-[#F4F4F5]'
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                Target Table
                <select
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
                >
                  <option value="">Select destination table…</option>
                  {data.tables
                    .filter((t) => t.id !== inspectedTable.id)
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
                onClick={() => void handleTableOperation(inspectedTable, tableOpMode)}
                className="shadow-beam inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF5412] px-4 text-xs font-semibold text-white hover:bg-[#FF7033]"
              >
                Execute {tableOpMode}
              </button>
              <button
                type="button"
                onClick={() => void handleTableOperation(inspectedTable, 'ROTATE_QR')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5]"
              >
                <QrCode className="size-3.5" aria-hidden="true" />
                Rotate QR
              </button>
              <button
                type="button"
                onClick={() => void handleTableOperation(inspectedTable, 'RESET')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#EF4444]/60 px-3 text-xs font-semibold text-[#FCA5A5]"
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
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Guest / Order Label
            <input
              type="text"
              value={tokenGuestName}
              onChange={(e) => setTokenGuestName(e.target.value)}
              placeholder={`Walk-in #${data.nextTokenNumber}`}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Items Summary
            <input
              type="text"
              value={tokenItemSummary}
              onChange={(e) => setTokenItemSummary(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Amount (BDT ৳)
            <input
              type="number"
              step="1"
              min="0"
              value={tokenAmountMajor}
              onChange={(e) => setTokenAmountMajor(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 font-mono text-sm text-[#F4F4F5]"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTokenModalOpen(false)}
              className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-semibold text-[#F4F4F5]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleIssueTakeawayToken()}
              className="shadow-beam inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF5412] px-5 text-xs font-semibold text-white hover:bg-[#FF7033]"
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
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-[#09090B] p-3 text-xs">
              <div>
                <p className="text-[#A1A1AA]">Opening Float</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#F4F4F5]">
                  {formatMinorCurrency(data.activeShift.openingFloatMinor, 'BDT')}
                </p>
              </div>
              <div>
                <p className="text-[#A1A1AA]">Cash Sales</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#F4F4F5]">
                  {formatMinorCurrency(data.activeShift.cashSalesMinor, 'BDT')}
                </p>
              </div>
              <div>
                <p className="text-[#A1A1AA]">Card + MFS (bKash/Nagad)</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#F4F4F5]">
                  {formatMinorCurrency(
                    data.activeShift.cardSalesMinor + data.activeShift.upiMfsSalesMinor,
                    'BDT',
                  )}
                </p>
              </div>
              <div>
                <p className="text-[#A1A1AA]">Total Orders</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#F4F4F5]">
                  {data.activeShift.totalOrders}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                Actual Drawer Cash (BDT)
                <input
                  type="number"
                  step="1"
                  value={actualCashMajor}
                  onChange={(e) => setActualCashMajor(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 font-mono text-sm text-[#F4F4F5]"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                Petty Cash Paid Out (BDT)
                <input
                  type="number"
                  step="1"
                  value={pettyCashMajor}
                  onChange={(e) => setPettyCashMajor(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 font-mono text-sm text-[#F4F4F5]"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Shift Notes
              <input
                type="text"
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="Optional handover remarks…"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 px-4 text-xs font-semibold text-[#F4F4F5]"
              >
                <Printer className="size-3.5" aria-hidden="true" />
                Print Z-Report
              </button>
              <button
                type="button"
                onClick={() => void handleShiftSubmit()}
                className="shadow-beam inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#FF5412] px-5 text-xs font-semibold text-white hover:bg-[#FF7033]"
              >
                <DollarSign className="size-3.5" aria-hidden="true" />
                Close Shift &amp; Finalize Z-Report
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Opening Cash Float (BDT)
              <input
                type="number"
                step="1"
                value={openingFloatMajor}
                onChange={(e) => setOpeningFloatMajor(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#09090B] px-3 py-2 font-mono text-sm text-[#F4F4F5]"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                className="min-h-11 rounded-xl border border-white/10 px-4 text-xs font-semibold text-[#F4F4F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleShiftSubmit()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#10B981] px-5 text-xs font-semibold text-white"
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
