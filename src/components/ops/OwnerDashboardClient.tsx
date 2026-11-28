'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Lock,
  MessageSquareWarning,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { showToast } from '@/components/ui/ToastRegion';
import { downloadCsv, formatMinorCurrency } from '@/lib/ops/format';
import type {
  DashboardAuditLog,
  DashboardBootstrapPayload,
  DashboardInventoryItem,
  DashboardMenuItem,
  DashboardTaxSlab,
  DashboardUpsellRule,
} from '@/lib/ops/types';
import type { DietaryType } from '@/server/db/types';

type DashboardTab =
  | 'OVERVIEW'
  | 'MENU_86'
  | 'INVENTORY'
  | 'RBAC_AUDIT'
  | 'SECURITY_TAX';

interface HourlyRevenueBucket {
  hourLabel: string;
  amountMinor: number;
  orderCount: number;
  isCurrentHour: boolean;
}

interface GuestReviewItem {
  id: string;
  tableNumber: string;
  rating: number;
  comment: string;
  createdAt: string;
  needsRecovery: boolean;
  resolved?: boolean;
}

interface ActiveShiftSummary {
  id: string;
  status: string;
  openingFloatMinor: number;
  cashSalesMinor: number;
  digitalSalesMinor: number;
  expectedDrawerMinor: number;
  totalOrders: number;
  openedAt?: string;
}

interface ExtendedDashboardPayload extends DashboardBootstrapPayload {
  hourlyRevenue?: HourlyRevenueBucket[];
  recentReviews?: GuestReviewItem[];
  activeShift?: ActiveShiftSummary | null;
}

interface OutletOption {
  id: string;
  name: string;
  subdomain?: string;
}

interface MenuMetaOption {
  id: string;
  name: string;
}

const PERMISSION_KEYS = [
  'orders.approve',
  'orders.void',
  'menu.toggle_86',
  'billing.refund',
  'shifts.close_zreport',
  'qr.rotate',
] as const;

const DEFAULT_OUTLET_ID = '22222222-2222-4222-8222-222222222222';
const DEFAULT_CATEGORY_ID = '33333333-3333-4333-8333-333333333301';
const DEFAULT_STATION_ID = '44444444-4444-4444-8444-444444444401';
const DEFAULT_TAX_SLAB_ID = '55555555-5555-4555-8555-555555555501';

const PAYMENT_COLORS = ['bg-[#FF5412]', 'bg-[#0EA5E9]', 'bg-[#10B981]', 'bg-[#F59E0B]'];

function createDemoDashboardPayload(): ExtendedDashboardPayload {
  const now = Date.now();
  return {
    outletId: DEFAULT_OUTLET_ID,
    outletName: 'Zaika — Gulshan, Dhaka',
    currencyCode: 'BDT',
    kpis: {
      occupiedTables: 6,
      totalTables: 6,
      liveOrdersCount: 46,
      netSalesMinor: 4850000,
      aovMinor: 105435,
      avgTurnoverMinutes: 38,
      kdsSlaOnTimePct: 96,
      paymentMix: [
        { method: 'bKash / Nagad (MFS)', amountMinor: 2425000, pct: 50 },
        { method: 'CARD / POS', amountMinor: 1697500, pct: 35 },
        { method: 'CASH', amountMinor: 727500, pct: 15 },
      ],
    },
    hourlyRevenue: [
      { hourLabel: '12 PM', amountMinor: 420000, orderCount: 5, isCurrentHour: false },
      { hourLabel: '1 PM', amountMinor: 780000, orderCount: 8, isCurrentHour: false },
      { hourLabel: '2 PM', amountMinor: 610000, orderCount: 6, isCurrentHour: false },
      { hourLabel: '6 PM', amountMinor: 540000, orderCount: 5, isCurrentHour: false },
      { hourLabel: '7 PM', amountMinor: 960000, orderCount: 9, isCurrentHour: false },
      { hourLabel: '8 PM', amountMinor: 1540000, orderCount: 13, isCurrentHour: true },
    ],
    recentReviews: [
      {
        id: 'rev-1',
        tableNumber: 'T2',
        rating: 2,
        comment: 'Garlic Naan arrived lukewarm after 22 mins wait during peak rush.',
        createdAt: new Date(now - 14 * 60_000).toISOString(),
        needsRecovery: true,
        resolved: false,
      },
      {
        id: 'rev-2',
        tableNumber: 'T4',
        rating: 5,
        comment: 'Charcoal Tandoori Lamb Chops were phenomenal and QR split-pay was instant.',
        createdAt: new Date(now - 38 * 60_000).toISOString(),
        needsRecovery: false,
        resolved: true,
      },
      {
        id: 'rev-3',
        tableNumber: 'T1',
        rating: 3,
        comment: 'bKash confirmation took a moment, food itself was great.',
        createdAt: new Date(now - 62 * 60_000).toISOString(),
        needsRecovery: true,
        resolved: false,
      },
    ],
    activeShift: {
      id: 'shift-demo-1',
      status: 'OPEN',
      openingFloatMinor: 500000,
      cashSalesMinor: 727500,
      digitalSalesMinor: 4122500,
      expectedDrawerMinor: 1227500,
      totalOrders: 46,
      openedAt: new Date(now - 6 * 3600_000).toISOString(),
    },
    menuItems: [
      {
        id: 'm-1',
        name: 'Charcoal Tandoori Lamb Chops',
        categoryName: 'Tandoor',
        stationName: 'Tandoor',
        basePriceMinor: 125000,
        costMinor: 42000,
        dietaryType: 'NON_VEG',
        isAvailable: true,
        unitsSold30d: 310,
      },
      {
        id: 'm-2',
        name: 'Smoked Butter Chicken',
        categoryName: 'Mains',
        stationName: 'Curry',
        basePriceMinor: 85000,
        costMinor: 28000,
        dietaryType: 'NON_VEG',
        isAvailable: true,
        unitsSold30d: 520,
      },
      {
        id: 'm-3',
        name: 'Truffle Paneer Tikka',
        categoryName: 'Tandoor',
        stationName: 'Tandoor',
        basePriceMinor: 68000,
        costMinor: 21000,
        dietaryType: 'VEG',
        isAvailable: true,
        unitsSold30d: 140,
      },
      {
        id: 'm-4',
        name: 'Garlic Butter Naan',
        categoryName: 'Breads',
        stationName: 'Tandoor',
        basePriceMinor: 14000,
        costMinor: 3500,
        dietaryType: 'VEG',
        isAvailable: true,
        unitsSold30d: 890,
      },
      {
        id: 'm-5',
        name: 'Artisan Saffron Kulfi',
        categoryName: 'Desserts',
        stationName: 'Cold',
        basePriceMinor: 32000,
        costMinor: 11000,
        dietaryType: 'VEG',
        isAvailable: false,
        unitsSold30d: 75,
      },
    ],
    inventory: [
      {
        id: 'inv-1',
        name: 'Lamb Rack Chops',
        sku: 'ING-LMB-01',
        unit: 'kg',
        currentStock: 3.2,
        reorderLevel: 5,
        linkedMenuItems: ['Charcoal Tandoori Lamb Chops'],
      },
      {
        id: 'inv-2',
        name: 'Organic Tomato Puree',
        sku: 'ING-TOM-04',
        unit: 'L',
        currentStock: 18.5,
        reorderLevel: 8,
        linkedMenuItems: ['Smoked Butter Chicken'],
      },
      {
        id: 'inv-3',
        name: 'Kashmiri Saffron Strands',
        sku: 'ING-SAF-02',
        unit: 'g',
        currentStock: 12,
        reorderLevel: 20,
        linkedMenuItems: ['Artisan Saffron Kulfi', 'Saffron Old Fashioned'],
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
    overrides: [
      {
        id: 'ov-1',
        userId: 'st-1',
        permissionKey: 'menu.toggle_86',
        effect: 'GRANT',
      },
      {
        id: 'ov-2',
        userId: 'st-2',
        permissionKey: 'billing.refund',
        effect: 'DENY',
      },
    ],
    auditLogs: [
      {
        id: 'aud-1',
        actorName: 'Elena Rostova',
        action: 'MENU_ITEM_86',
        targetType: 'menu_items',
        targetId: 'm-5',
        details: 'Marked Artisan Saffron Kulfi unavailable (86)',
        createdAt: new Date(now - 20 * 60_000).toISOString(),
      },
      {
        id: 'aud-2',
        actorName: 'Amina Rahman',
        action: 'QR_ROTATE',
        targetType: 'dining_tables',
        targetId: 'T3',
        details: 'Rotated HMAC QR token after table reset',
        createdAt: new Date(now - 55 * 60_000).toISOString(),
      },
    ],
    taxSlabs: [
      {
        id: 'tax-1',
        name: 'Standard Dine-In VAT (5%)',
        isInclusive: false,
        components: [
          { name: 'VAT', rateBps: 500 },
        ],
        isActive: true,
      },
      {
        id: 'tax-2',
        name: 'Bar & Spirits VAT (15%)',
        isInclusive: true,
        components: [{ name: 'VAT', rateBps: 1500 }],
        isActive: true,
      },
    ],
    upsellRules: [
      {
        id: 'up-1',
        triggerItemName: 'Smoked Butter Chicken',
        suggestedItemName: 'Garlic Butter Naan',
        pitchText: 'Pair with freshly blistered Garlic Butter Naan',
        isActive: true,
      },
    ],
    qrSecurityPolicy: {
      requireGps: true,
      maxDistanceMeters: 100,
      requireVenueIp: false,
      captainApprovalRequired: true,
      payFirstTakeaway: true,
      maxUnpaidOrders: 3,
      serviceRequestCooldownSecs: 45,
    },
  };
}

export function OwnerDashboardClient() {
  const [data, setData] = useState<ExtendedDashboardPayload>(() =>
    createDemoDashboardPayload(),
  );
  const [tab, setTab] = useState<DashboardTab>('OVERVIEW');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('st-1');

  // Outlet switcher state
  const [outlets, setOutlets] = useState<OutletOption[]>([
    { id: DEFAULT_OUTLET_ID, name: 'Zaika — Gulshan, Dhaka', subdomain: 'zaika-bistro' },
  ]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('default');

  // Add Menu Item dialog state
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [menuCategories, setMenuCategories] = useState<MenuMetaOption[]>([
    { id: DEFAULT_CATEGORY_ID, name: 'Mains' },
  ]);
  const [menuStations, setMenuStations] = useState<MenuMetaOption[]>([
    { id: DEFAULT_STATION_ID, name: 'Curry' },
  ]);
  const [menuTaxSlabs, setMenuTaxSlabs] = useState<MenuMetaOption[]>([
    { id: DEFAULT_TAX_SLAB_ID, name: 'Standard Dine-In VAT (5%)' },
  ]);
  const [newDishName, setNewDishName] = useState('');
  const [newDishDescription, setNewDishDescription] = useState('');
  const [newDishPriceMajor, setNewDishPriceMajor] = useState('450');
  const [newDishDietary, setNewDishDietary] = useState<DietaryType>('NON_VEG');
  const [newDishCategoryId, setNewDishCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [newDishStationId, setNewDishStationId] = useState(DEFAULT_STATION_ID);
  const [newDishTaxSlabId, setNewDishTaxSlabId] = useState(DEFAULT_TAX_SLAB_ID);
  const [newDishPrepMins, setNewDishPrepMins] = useState('14');
  const [submittingDish, setSubmittingDish] = useState(false);
  const [restockingAll, setRestockingAll] = useState(false);

  const loadOutlets = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/outlets', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { outlets?: OutletOption[] };
        if (json.outlets && json.outlets.length > 0) {
          setOutlets(json.outlets);
        }
      }
    } catch {
      // Demo fallback retained
    }
  }, []);

  const loadMenuMeta = useCallback(async (outletParam: string) => {
    try {
      const query = outletParam === 'default' ? '' : `?outletId=${encodeURIComponent(outletParam)}`;
      const res = await fetch(`/api/v1/admin/menu${query}`, { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as {
          categories?: MenuMetaOption[];
          stations?: MenuMetaOption[];
          taxSlabs?: MenuMetaOption[];
        };
        if (json.categories && json.categories.length > 0) {
          setMenuCategories(json.categories);
          setNewDishCategoryId(json.categories[0]!.id);
        }
        if (json.stations && json.stations.length > 0) {
          setMenuStations(json.stations);
          setNewDishStationId(json.stations[0]!.id);
        }
        if (json.taxSlabs && json.taxSlabs.length > 0) {
          setMenuTaxSlabs(json.taxSlabs);
          setNewDishTaxSlabId(json.taxSlabs[0]!.id);
        }
      }
    } catch {
      // Demo fallback retained
    }
  }, []);

  const loadLive = useCallback(
    async (outletParam = selectedOutletId) => {
      try {
        const res = await fetch(
          `/api/v1/analytics/outlets/${encodeURIComponent(outletParam)}/live`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const payload = (await res.json()) as ExtendedDashboardPayload;
          const fallback = createDemoDashboardPayload();
          setData({
            ...payload,
            currencyCode: 'BDT',
            hourlyRevenue:
              payload.hourlyRevenue && payload.hourlyRevenue.length > 0
                ? payload.hourlyRevenue
                : fallback.hourlyRevenue,
            recentReviews:
              payload.recentReviews && payload.recentReviews.length > 0
                ? payload.recentReviews
                : fallback.recentReviews,
            activeShift: payload.activeShift ?? fallback.activeShift,
          });
          if (payload.staff[0]) setSelectedStaffId(payload.staff[0].id);
        }
      } catch {
        // Demo fallback already loaded
      }
    },
    [selectedOutletId],
  );

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        void loadOutlets();
        void loadLive('default');
        void loadMenuMeta('default');
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadLive, loadMenuMeta, loadOutlets]);

  const handleOutletChange = async (nextOutletId: string) => {
    setSelectedOutletId(nextOutletId);
    await Promise.all([loadLive(nextOutletId), loadMenuMeta(nextOutletId)]);
    const label = outlets.find((o) => o.id === nextOutletId)?.name ?? 'Selected Outlet';
    showToast({ title: `Switched to ${label}`, variant: 'info' });
  };

  const lowStockCount = useMemo(
    () => data.inventory.filter((i) => i.currentStock <= i.reorderLevel).length,
    [data.inventory],
  );

  const hourlyBuckets = useMemo(
    () => data.hourlyRevenue ?? createDemoDashboardPayload().hourlyRevenue ?? [],
    [data.hourlyRevenue],
  );

  const maxHourlyMinor = useMemo(
    () => Math.max(1, ...hourlyBuckets.map((b) => b.amountMinor)),
    [hourlyBuckets],
  );

  const reviews = useMemo(
    () => data.recentReviews ?? createDemoDashboardPayload().recentReviews ?? [],
    [data.recentReviews],
  );

  const recoveryPendingCount = useMemo(
    () => reviews.filter((r) => r.needsRecovery && !r.resolved).length,
    [reviews],
  );

  // Menu Engineering Matrix: Stars, Plowhorses, Puzzles, Dogs
  const engineeringQuadrants = useMemo(() => {
    const items = data.menuItems;
    if (items.length === 0) {
      return { stars: [], plowhorses: [], puzzles: [], dogs: [] };
    }
    const sortedVol = [...items].sort((a, b) => a.unitsSold30d - b.unitsSold30d);
    const medianVol = sortedVol[Math.floor(sortedVol.length / 2)]!.unitsSold30d;
    const sortedMargin = [...items].sort(
      (a, b) => a.basePriceMinor - a.costMinor - (b.basePriceMinor - b.costMinor),
    );
    const medianMargin =
      sortedMargin[Math.floor(sortedMargin.length / 2)]!.basePriceMinor -
      sortedMargin[Math.floor(sortedMargin.length / 2)]!.costMinor;

    const stars: DashboardMenuItem[] = [];
    const plowhorses: DashboardMenuItem[] = [];
    const puzzles: DashboardMenuItem[] = [];
    const dogs: DashboardMenuItem[] = [];

    for (const item of items) {
      const margin = item.basePriceMinor - item.costMinor;
      const highPop = item.unitsSold30d >= medianVol;
      const highProfit = margin >= medianMargin;
      if (highPop && highProfit) stars.push(item);
      else if (highPop && !highProfit) plowhorses.push(item);
      else if (!highPop && highProfit) puzzles.push(item);
      else dogs.push(item);
    }
    return { stars, plowhorses, puzzles, dogs };
  }, [data.menuItems]);

  const handleToggle86 = async (item: DashboardMenuItem) => {
    const nextAvailable = !item.isAvailable;
    setData((prev) => ({
      ...prev,
      menuItems: prev.menuItems.map((m) =>
        m.id === item.id ? { ...m, isAvailable: nextAvailable } : m,
      ),
    }));
    try {
      await fetch(`/api/v1/admin/menu-items/${item.id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: nextAvailable }),
      });
    } catch {
      // Optimistic update retained
    }
    showToast({
      title: nextAvailable ? `${item.name} back on menu` : `${item.name} 86'd`,
      variant: nextAvailable ? 'success' : 'warning',
    });
  };

  const handleAddMenuItem = async () => {
    const trimmedName = newDishName.trim();
    const priceMajor = Number(newDishPriceMajor);
    if (!trimmedName || !Number.isFinite(priceMajor) || priceMajor <= 0) {
      showToast({
        title: 'Dish name and positive price (BDT ৳) are required',
        variant: 'warning',
      });
      return;
    }

    const basePriceMinor = Math.round(priceMajor * 100);
    const categoryName =
      menuCategories.find((c) => c.id === newDishCategoryId)?.name ?? 'Mains';
    const stationName =
      menuStations.find((s) => s.id === newDishStationId)?.name ?? 'Curry';

    setSubmittingDish(true);
    let createdId = crypto.randomUUID();
    try {
      const res = await fetch('/api/v1/admin/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId: data.outletId,
          categoryId: newDishCategoryId,
          stationId: newDishStationId,
          taxSlabId: newDishTaxSlabId,
          name: trimmedName,
          description: newDishDescription.trim() || undefined,
          basePriceMinor,
          dietaryType: newDishDietary,
          prepTimeMins: Math.max(1, Number(newDishPrepMins) || 12),
          isAvailable: true,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { item?: { id: string } };
        if (json.item?.id) createdId = json.item.id;
      }
    } catch {
      // Optimistic update retained
    } finally {
      setSubmittingDish(false);
    }

    const newItem: DashboardMenuItem = {
      id: createdId,
      name: trimmedName,
      categoryName,
      stationName,
      basePriceMinor,
      costMinor: Math.round(basePriceMinor * 0.35),
      dietaryType: newDishDietary,
      isAvailable: true,
      unitsSold30d: 0,
    };

    setData((prev) => ({
      ...prev,
      menuItems: [newItem, ...prev.menuItems],
    }));
    setAddMenuOpen(false);
    setNewDishName('');
    setNewDishDescription('');
    showToast({
      title: `Added ${trimmedName} to menu`,
      description: `${formatMinorCurrency(basePriceMinor, 'BDT')} · ${stationName}`,
      variant: 'success',
    });
  };

  const handleInventoryAdjust = async (inv: DashboardInventoryItem, delta: number) => {
    const nextStock = Math.max(0, Number((inv.currentStock + delta).toFixed(2)));
    setData((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) =>
        i.id === inv.id ? { ...i, currentStock: nextStock } : i,
      ),
    }));
    try {
      await fetch('/api/v1/admin/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId: inv.id,
          deltaQty: delta,
          reason: 'Owner manual stock adjustment',
        }),
      });
    } catch {
      // Optimistic update retained
    }
    showToast({
      title: `Stock updated: ${inv.name}`,
      description: `New balance: ${nextStock} ${inv.unit}`,
      variant: 'success',
    });
  };

  const handleRestockAll = async () => {
    setRestockingAll(true);
    const targetQty = 25;
    setData((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) => ({
        ...i,
        currentStock: Math.max(i.currentStock, Math.max(targetQty, i.reorderLevel * 2)),
      })),
    }));
    try {
      await fetch('/api/v1/admin/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'RESTOCK_ALL',
          outletId: data.outletId,
          targetQty,
        }),
      });
    } catch {
      // Optimistic update retained
    } finally {
      setRestockingAll(false);
    }
    showToast({
      title: 'All low-stock ingredients restocked',
      description: 'BOM inventory levels replenished to par.',
      variant: 'success',
    });
  };

  const handleResolveReview = (reviewId: string) => {
    setData((prev) => ({
      ...prev,
      recentReviews: (prev.recentReviews ?? []).map((r) =>
        r.id === reviewId ? { ...r, resolved: true } : r,
      ),
    }));
    showToast({
      title: 'Service recovery logged',
      description: 'Marked guest review as resolved by manager.',
      variant: 'success',
    });
  };

  const handleSetOverride = async (
    permissionKey: string,
    effect: 'GRANT' | 'DENY',
  ) => {
    setData((prev) => {
      const filtered = prev.overrides.filter(
        (o) => !(o.userId === selectedStaffId && o.permissionKey === permissionKey),
      );
      return {
        ...prev,
        overrides: [
          ...filtered,
          {
            id: crypto.randomUUID(),
            userId: selectedStaffId,
            permissionKey,
            effect,
          },
        ],
      };
    });

    try {
      await fetch('/api/v1/admin/rbac/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedStaffId,
          permissionKey,
          effect,
        }),
      });
    } catch {
      // Optimistic update retained
    }

    showToast({
      title: 'RBAC Override Saved',
      description: `${permissionKey}: ${effect}`,
      variant: 'success',
    });
  };

  const handleSaveSecurityPolicy = async () => {
    try {
      await fetch(`/api/v1/admin/outlets/${data.outletId}/policy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.qrSecurityPolicy),
      });
    } catch {
      // Optimistic update retained
    }
    showToast({
      title: 'QR Security & Geofence Policy Saved',
      variant: 'success',
    });
  };

  const handleExportCsv = () => {
    downloadCsv(
      `platebeam-menu-engineering-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Item', 'Category', 'Price (BDT)', 'Cost (BDT)', 'Unit Margin (BDT)', '30d Units', 'Available'],
      data.menuItems.map((m) => [
        m.name,
        m.categoryName,
        (m.basePriceMinor / 100).toFixed(2),
        (m.costMinor / 100).toFixed(2),
        ((m.basePriceMinor - m.costMinor) / 100).toFixed(2),
        m.unitsSold30d,
        m.isAvailable ? 'YES' : '86',
      ]),
    );
    showToast({ title: 'Exported CSV report', variant: 'success' });
  };

  const handleExportZReport = () => {
    const shift = data.activeShift;
    if (!shift) return;
    downloadCsv(
      `platebeam-z-report-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Outlet', 'Shift ID', 'Status', 'Opening Float (BDT)', 'Cash Sales (BDT)', 'Digital Sales (BDT)', 'Expected Drawer (BDT)', 'Total Orders'],
      [
        [
          data.outletName,
          shift.id,
          shift.status,
          (shift.openingFloatMinor / 100).toFixed(2),
          (shift.cashSalesMinor / 100).toFixed(2),
          (shift.digitalSalesMinor / 100).toFixed(2),
          (shift.expectedDrawerMinor / 100).toFixed(2),
          shift.totalOrders,
        ],
      ],
    );
    showToast({ title: 'Exported Shift Z-Report CSV', variant: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Outlet Switcher & Live Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#262630] bg-[#111115] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[#FF5412]/15 text-[#FF5412]">
            <Store className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Active Outlet
            </p>
            <p className="text-sm font-bold text-[#F4F4F5]">{data.outletName}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#A1A1AA]">
            <span>Outlet:</span>
            <select
              aria-label="Switch active outlet"
              value={selectedOutletId}
              onChange={(e) => void handleOutletChange(e.target.value)}
              className="min-h-11 rounded-xl border border-[#262630] bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] focus:border-[#FF5412]"
            >
              <option value="default">{data.outletName}</option>
              {outlets
                .filter((o) => o.id !== data.outletId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadLive(selectedOutletId)}
            aria-label="Refresh live telemetry"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#262630] bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
          >
            <RefreshCw className="size-3.5 text-[#FF5412]" aria-hidden="true" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Live KPI Cards */}
      <section aria-label="Live Outlet KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#262630] bg-[#111115] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Occupied Tables
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#F4F4F5]">
            {data.kpis.occupiedTables}/{data.kpis.totalTables}
          </p>
          <p className="mt-1 text-xs text-[#A1A1AA]">
            Avg turnover {data.kpis.avgTurnoverMinutes} mins
          </p>
        </div>

        <div className="rounded-2xl border border-[#262630] bg-[#111115] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Net Sales Today
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#FF5412]">
            {formatMinorCurrency(data.kpis.netSalesMinor, 'BDT')}
          </p>
          <p className="mt-1 text-xs text-[#A1A1AA]">
            {data.kpis.liveOrdersCount} live orders · AOV{' '}
            {formatMinorCurrency(data.kpis.aovMinor, 'BDT')}
          </p>
        </div>

        <div className="rounded-2xl border border-[#262630] bg-[#111115] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            KDS Prep SLA
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#10B981]">
            {data.kpis.kdsSlaOnTimePct}%
          </p>
          <p className="mt-1 text-xs text-[#A1A1AA]">
            On-time ticket bump rate
          </p>
        </div>

        <div className="rounded-2xl border border-[#262630] bg-[#111115] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Payment Mix
          </p>
          {/* Stacked Payment Mix Bar */}
          <div
            className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-[#18181F]"
            role="img"
            aria-label="Payment method distribution stacked bar"
          >
            {data.kpis.paymentMix.map((pm, idx) => (
              <div
                key={pm.method}
                style={{ width: `${Math.max(pm.pct, 4)}%` }}
                className={`${PAYMENT_COLORS[idx % PAYMENT_COLORS.length]} transition-all`}
                title={`${pm.method}: ${pm.pct}%`}
              />
            ))}
          </div>
          <div className="mt-2.5 space-y-1 text-xs">
            {data.kpis.paymentMix.map((pm, idx) => (
              <div
                key={pm.method}
                className="flex items-center justify-between font-mono tabular-nums text-[#F4F4F5]"
              >
                <span className="flex items-center gap-1.5 truncate pr-2 text-[#A1A1AA]">
                  <span
                    className={`size-2 shrink-0 rounded-full ${PAYMENT_COLORS[idx % PAYMENT_COLORS.length]}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{pm.method}</span>
                </span>
                <span>{pm.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Navigation Tabs & CSV Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Owner dashboard sections" className="flex flex-wrap gap-2">
          {(
            [
              { id: 'OVERVIEW', label: 'Overview & BI', icon: TrendingUp },
              { id: 'MENU_86', label: 'Menu & 86 Toggle', icon: UtensilsCrossed },
              {
                id: 'INVENTORY',
                label: `BOM Inventory${lowStockCount > 0 ? ` (${lowStockCount} Low)` : ''}`,
                icon: Package,
              },
              { id: 'RBAC_AUDIT', label: '3-Layer RBAC & Audit', icon: Shield },
              { id: 'SECURITY_TAX', label: 'QR Security, Tax & Upsells', icon: Lock },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[#FF5412] bg-[#FF5412] text-white shadow-beam'
                    : 'border-[#262630] bg-[#111115] text-[#F4F4F5] hover:border-[#FF5412]/60'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#262630] bg-[#111115] px-4 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
        >
          <Download className="size-3.5 text-[#FF5412]" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {/* Tab 1: Overview & BI */}
      {tab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Hourly Revenue + Shift Register Row */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Hourly Service Revenue Bar Chart */}
            <section
              aria-label="Hourly Service Revenue"
              className="rounded-3xl border border-[#262630] bg-[#111115] p-5 lg:col-span-7"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-[#FF5412]" aria-hidden="true" />
                  <h2 className="text-base font-bold tracking-tight text-[#F4F4F5]">
                    Hourly Service Revenue
                  </h2>
                </div>
                <span className="rounded-full border border-[#262630] bg-[#18181F] px-2.5 py-1 font-mono text-[11px] text-[#A1A1AA]">
                  Today · BDT ৳
                </span>
              </div>

              <div className="mt-6 flex h-48 items-end gap-3">
                {hourlyBuckets.map((bucket) => {
                  const pct = Math.max(10, Math.round((bucket.amountMinor / maxHourlyMinor) * 100));
                  return (
                    <div
                      key={bucket.hourLabel}
                      className="group flex flex-1 flex-col items-center gap-2"
                    >
                      <span className="font-mono text-[10px] tabular-nums text-[#A1A1AA] group-hover:text-[#F4F4F5]">
                        {formatMinorCurrency(bucket.amountMinor, 'BDT')}
                      </span>
                      <div className="flex h-32 w-full items-end rounded-xl bg-[#18181F] p-1">
                        <div
                          style={{ height: `${pct}%` }}
                          className={`w-full rounded-lg transition-all ${
                            bucket.isCurrentHour
                              ? 'bg-[#FF5412] shadow-beam'
                              : 'bg-[#262630] group-hover:bg-[#FF7033]'
                          }`}
                          title={`${bucket.hourLabel}: ${formatMinorCurrency(bucket.amountMinor, 'BDT')} (${bucket.orderCount} orders)`}
                        />
                      </div>
                      <div className="text-center">
                        <p
                          className={`font-mono text-[11px] font-semibold ${
                            bucket.isCurrentHour ? 'text-[#FF5412]' : 'text-[#A1A1AA]'
                          }`}
                        >
                          {bucket.hourLabel}
                        </p>
                        <p className="font-mono text-[10px] text-[#A1A1AA]">
                          {bucket.orderCount} ord
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Shift Register & Z-Report Card */}
            <section
              aria-label="Shift Register and Z-Report"
              className="flex flex-col justify-between rounded-3xl border border-[#262630] bg-[#111115] p-5 lg:col-span-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-4 text-[#FF5412]" aria-hidden="true" />
                    <h2 className="text-base font-bold tracking-tight text-[#F4F4F5]">
                      Shift Register &amp; Z-Report
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#10B981]">
                    <span className="size-1.5 rounded-full bg-[#10B981]" aria-hidden="true" />
                    {data.activeShift?.status ?? 'OPEN'}
                  </span>
                </div>

                {data.activeShift ? (
                  <dl className="mt-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between rounded-xl border border-[#262630] bg-[#18181F] px-3.5 py-2.5">
                      <dt className="text-[#A1A1AA]">Opening Float</dt>
                      <dd className="font-mono font-semibold tabular-nums text-[#F4F4F5]">
                        {formatMinorCurrency(data.activeShift.openingFloatMinor, 'BDT')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-[#262630] bg-[#18181F] px-3.5 py-2.5">
                      <dt className="text-[#A1A1AA]">Cash Sales</dt>
                      <dd className="font-mono font-semibold tabular-nums text-[#10B981]">
                        +{formatMinorCurrency(data.activeShift.cashSalesMinor, 'BDT')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-[#262630] bg-[#18181F] px-3.5 py-2.5">
                      <dt className="text-[#A1A1AA]">Digital (bKash / Card)</dt>
                      <dd className="font-mono font-semibold tabular-nums text-[#0EA5E9]">
                        {formatMinorCurrency(data.activeShift.digitalSalesMinor, 'BDT')}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-[#FF5412]/40 bg-[#FF5412]/10 px-3.5 py-2.5">
                      <dt className="font-semibold text-[#F4F4F5]">Expected Cash Drawer</dt>
                      <dd className="font-mono text-sm font-bold tabular-nums text-[#FF5412]">
                        {formatMinorCurrency(data.activeShift.expectedDrawerMinor, 'BDT')}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-4 text-xs text-[#A1A1AA]">No active shift open.</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 pt-2">
                <span className="font-mono text-[11px] text-[#A1A1AA]">
                  {data.activeShift?.totalOrders ?? 0} settled orders
                </span>
                <button
                  type="button"
                  onClick={handleExportZReport}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#262630] bg-[#18181F] px-3.5 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
                >
                  <Download className="size-3.5 text-[#FF5412]" aria-hidden="true" />
                  Export Z-Report
                </button>
              </div>
            </section>
          </div>

          {/* Guest Reviews & Service Recovery Queue */}
          <section
            aria-label="Guest Reviews and Service Recovery Queue"
            className="rounded-3xl border border-[#262630] bg-[#111115] p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="size-4 text-[#FF5412]" aria-hidden="true" />
                <h2 className="text-base font-bold tracking-tight text-[#F4F4F5]">
                  Guest Reviews &amp; Service Recovery Queue
                </h2>
              </div>
              {recoveryPendingCount > 0 ? (
                <span className="rounded-full bg-[#EF4444]/15 px-3 py-1 font-mono text-xs font-semibold text-[#EF4444]">
                  {recoveryPendingCount} Needs Recovery
                </span>
              ) : (
                <span className="rounded-full bg-[#10B981]/15 px-3 py-1 font-mono text-xs font-semibold text-[#10B981]">
                  All Caught Up
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {reviews.map((rev) => {
                const flagged = rev.needsRecovery && !rev.resolved;
                return (
                  <div
                    key={rev.id}
                    className={`flex flex-col justify-between rounded-2xl border p-4 ${
                      flagged
                        ? 'border-[#EF4444]/50 bg-[#EF4444]/5'
                        : 'border-[#262630] bg-[#18181F]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#F4F4F5]">
                          Table {rev.tableNumber}
                        </span>
                        <span className="flex items-center gap-0.5 font-mono text-xs font-bold text-[#F59E0B]">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`size-3.5 ${
                                i < rev.rating
                                  ? 'fill-[#F59E0B] text-[#F59E0B]'
                                  : 'text-[#262630]'
                              }`}
                              aria-hidden="true"
                            />
                          ))}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#A1A1AA]">
                        “{rev.comment}”
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 pt-2">
                      <span className="font-mono text-[10px] text-[#A1A1AA]">
                        {new Date(rev.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {flagged ? (
                        <button
                          type="button"
                          onClick={() => handleResolveReview(rev.id)}
                          className="min-h-9 rounded-lg bg-[#EF4444] px-3 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          Resolve / Comp
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          {rev.needsRecovery ? 'Resolved' : 'Positive'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Menu Engineering Matrix */}
          <section aria-label="Menu Engineering Matrix" className="grid gap-4 md:grid-cols-2">
            {(
              [
                {
                  title: 'Stars',
                  subtitle: 'High Popularity · High Profit',
                  items: engineeringQuadrants.stars,
                  tone: 'border-[#F59E0B]/40 bg-[#111115]',
                  hint: 'Promote prominently on QR hero & automated upsell triggers.',
                  icon: Star,
                  iconClass: 'text-[#F59E0B] fill-[#F59E0B]',
                },
                {
                  title: 'Plowhorses',
                  subtitle: 'High Popularity · Lower Profit',
                  items: engineeringQuadrants.plowhorses,
                  tone: 'border-[#10B981]/40 bg-[#111115]',
                  hint: 'Test portioning or pair with high-margin signature sides.',
                  icon: TrendingUp,
                  iconClass: 'text-[#10B981]',
                },
                {
                  title: 'Puzzles',
                  subtitle: 'Lower Popularity · High Profit',
                  items: engineeringQuadrants.puzzles,
                  tone: 'border-[#0EA5E9]/40 bg-[#111115]',
                  hint: 'Feature in Captain recommendations & Spice Quiz rewards.',
                  icon: Sparkles,
                  iconClass: 'text-[#0EA5E9]',
                },
                {
                  title: 'Dogs',
                  subtitle: 'Lower Popularity · Lower Profit',
                  items: engineeringQuadrants.dogs,
                  tone: 'border-[#EF4444]/40 bg-[#111115]',
                  hint: 'Consider seasonal rotation, ingredient repurposing, or re-costing.',
                  icon: AlertTriangle,
                  iconClass: 'text-[#EF4444]',
                },
              ] as const
            ).map((quadrant) => {
              const QuadIcon = quadrant.icon;
              return (
                <div
                  key={quadrant.title}
                  className={`rounded-2xl border p-5 transition-all ${quadrant.tone}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-[#F4F4F5]">
                        {quadrant.title}
                      </h2>
                      <p className="text-[11px] font-medium text-[#A1A1AA]">
                        {quadrant.subtitle}
                      </p>
                    </div>
                    <QuadIcon className={`size-5 ${quadrant.iconClass}`} aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#A1A1AA]">
                    {quadrant.hint}
                  </p>
                  <ul className="mt-3.5 space-y-2">
                    {quadrant.items.length === 0 ? (
                      <li className="rounded-xl border border-dashed border-[#262630] p-3 text-center text-xs text-[#A1A1AA]">
                        No dishes currently in this quadrant.
                      </li>
                    ) : (
                      quadrant.items.map((dish) => (
                        <li
                          key={dish.id}
                          className="flex items-center justify-between rounded-xl border border-[#262630] bg-[#18181F] px-3.5 py-2.5 text-xs"
                        >
                          <span className="font-semibold text-[#F4F4F5]">{dish.name}</span>
                          <span className="font-mono tabular-nums text-[#A1A1AA]">
                            {dish.unitsSold30d} sold ·{' '}
                            <span className="font-semibold text-[#FF5412]">
                              {formatMinorCurrency(
                                dish.basePriceMinor - dish.costMinor,
                                'BDT',
                              )}
                            </span>{' '}
                            margin
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {/* Tab 2: Menu & 86 Toggle */}
      {tab === 'MENU_86' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#262630] bg-[#111115] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-[#F4F4F5]">
                Live Menu &amp; 86 Availability ({data.menuItems.length} Dishes)
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Changes sync immediately to Guest QR &amp; FOH POS.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddMenuOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF5412] px-4 text-xs font-semibold text-white shadow-beam transition-colors hover:bg-[#FF7033]"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Menu Item
            </button>
          </div>

          <ResponsiveTable<DashboardMenuItem>
            caption="Menu items and real-time 86 availability toggle"
            getRowKey={(row) => row.id}
            rows={data.menuItems}
            columns={[
              {
                key: 'name',
                header: 'Dish',
                isRowHeader: true,
                render: (row) => (
                  <div>
                    <p className="font-semibold text-[#F4F4F5]">{row.name}</p>
                    <p className="text-xs text-[#A1A1AA]">
                      {row.categoryName} · {row.stationName}
                    </p>
                  </div>
                ),
              },
              {
                key: 'dietary',
                header: 'Dietary',
                render: (row) => (
                  <span className="rounded-full border border-[#262630] bg-[#18181F] px-2.5 py-0.5 text-[11px] font-medium text-[#F4F4F5]">
                    {row.dietaryType}
                  </span>
                ),
              },
              {
                key: 'price',
                header: 'Price',
                align: 'right',
                render: (row) => (
                  <span className="font-mono font-semibold text-[#F4F4F5]">
                    {formatMinorCurrency(row.basePriceMinor, 'BDT')}
                  </span>
                ),
              },
              {
                key: 'sold',
                header: '30d Sold',
                align: 'right',
                render: (row) => (
                  <span className="font-mono text-[#A1A1AA]">{row.unitsSold30d}</span>
                ),
              },
              {
                key: 'toggle',
                header: 'Availability (86)',
                align: 'right',
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => void handleToggle86(row)}
                    className={`min-h-11 rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                      row.isAvailable
                        ? 'bg-[#10B981]/15 text-[#10B981] hover:bg-[#10B981]/25'
                        : 'bg-[#EF4444] text-white hover:opacity-90'
                    }`}
                  >
                    {row.isAvailable ? 'Available' : "86'd (Out)"}
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Tab 3: BOM Inventory & Low-Stock Alerts */}
      {tab === 'INVENTORY' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#262630] bg-[#111115] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-[#F4F4F5]">
                BOM Ingredient Stock ({lowStockCount} Below Reorder Level)
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Auto-deducted on KDS fire; restock low items in one click.
              </p>
            </div>
            <button
              type="button"
              disabled={restockingAll}
              onClick={() => void handleRestockAll()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF5412] px-4 text-xs font-semibold text-white shadow-beam transition-colors hover:bg-[#FF7033] disabled:opacity-60"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {restockingAll ? 'Restocking…' : 'Restock All'}
            </button>
          </div>

          <ResponsiveTable<DashboardInventoryItem>
            caption="Recipe BOM inventory and low-stock alerts"
            getRowKey={(row) => row.id}
            rows={data.inventory}
            columns={[
              {
                key: 'name',
                header: 'Ingredient',
                isRowHeader: true,
                render: (row) => (
                  <div>
                    <p className="font-semibold text-[#F4F4F5]">{row.name}</p>
                    <p className="font-mono text-xs text-[#A1A1AA]">{row.sku}</p>
                  </div>
                ),
              },
              {
                key: 'linked',
                header: 'Linked Dishes',
                render: (row) => (
                  <span className="text-xs text-[#A1A1AA]">
                    {row.linkedMenuItems.length > 0
                      ? row.linkedMenuItems.join(', ')
                      : 'BOM Recipe Linked'}
                  </span>
                ),
              },
              {
                key: 'stock',
                header: 'On Hand',
                align: 'right',
                render: (row) => {
                  const isLow = row.currentStock <= row.reorderLevel;
                  const par = Math.max(1, row.reorderLevel * 2);
                  const pct = Math.min(100, Math.round((row.currentStock / par) * 100));
                  return (
                    <div className="ml-auto flex w-36 flex-col items-end gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-bold ${
                          isLow ? 'text-[#EF4444]' : 'text-[#10B981]'
                        }`}
                      >
                        {isLow && <AlertTriangle className="size-3.5" aria-hidden="true" />}
                        {row.currentStock} {row.unit}
                      </span>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#18181F]">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all ${
                            isLow
                              ? 'bg-[#EF4444]'
                              : pct < 65
                                ? 'bg-[#F59E0B]'
                                : 'bg-[#10B981]'
                          }`}
                        />
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'reorder',
                header: 'Reorder At',
                align: 'right',
                render: (row) => (
                  <span className="font-mono text-xs text-[#A1A1AA]">
                    {row.reorderLevel} {row.unit}
                  </span>
                ),
              },
              {
                key: 'adjust',
                header: 'Adjust Stock',
                align: 'right',
                render: (row) => (
                  <div className="inline-flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleInventoryAdjust(row, -1)}
                      className="min-h-11 min-w-11 rounded-xl border border-[#262630] bg-[#18181F] px-2.5 font-mono text-xs font-bold text-[#F4F4F5] hover:border-[#FF5412]"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleInventoryAdjust(row, 5)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-[#FF5412] px-3 font-mono text-xs font-bold text-white hover:bg-[#FF7033]"
                    >
                      <Plus className="size-3" aria-hidden="true" />5
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Tab 4: 3-Layer RBAC Matrix & Audit Logs */}
      {tab === 'RBAC_AUDIT' && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[#262630] bg-[#111115] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-[#F4F4F5]">
                  3-Layer RBAC Overrides
                </h2>
                <p className="text-xs text-[#A1A1AA]">
                  Effective = (Role Defaults + Explicit GRANT) − Explicit DENY (DENY always wins)
                </p>
              </div>
              <label className="text-xs font-semibold text-[#A1A1AA]">
                Staff Member:{' '}
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="ml-2 min-h-11 rounded-xl border border-[#262630] bg-[#18181F] px-3 py-1.5 text-xs text-[#F4F4F5]"
                >
                  {data.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.roleName})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {PERMISSION_KEYS.map((perm) => {
                const current = data.overrides.find(
                  (o) => o.userId === selectedStaffId && o.permissionKey === perm,
                );
                return (
                  <div
                    key={perm}
                    className="flex items-center justify-between rounded-2xl border border-[#262630] bg-[#18181F] p-3.5"
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold text-[#F4F4F5]">{perm}</p>
                      <p className="text-[11px] text-[#A1A1AA]">
                        Override: {current ? current.effect : 'Role Default'}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleSetOverride(perm, 'GRANT')}
                        className={`min-h-11 rounded-xl px-2.5 text-[11px] font-bold transition-colors ${
                          current?.effect === 'GRANT'
                            ? 'bg-[#10B981] text-white'
                            : 'border border-[#262630] bg-[#111115] text-[#F4F4F5] hover:border-[#10B981]'
                        }`}
                      >
                        GRANT
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSetOverride(perm, 'DENY')}
                        className={`min-h-11 rounded-xl px-2.5 text-[11px] font-bold transition-colors ${
                          current?.effect === 'DENY'
                            ? 'bg-[#EF4444] text-white'
                            : 'border border-[#262630] bg-[#111115] text-[#F4F4F5] hover:border-[#EF4444]'
                        }`}
                      >
                        DENY
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <ResponsiveTable<DashboardAuditLog>
            caption="Immutable compliance and staff audit logs"
            getRowKey={(row) => row.id}
            rows={data.auditLogs}
            columns={[
              {
                key: 'actor',
                header: 'Actor',
                isRowHeader: true,
                render: (row) => <span className="font-semibold text-[#F4F4F5]">{row.actorName}</span>,
              },
              {
                key: 'action',
                header: 'Action',
                render: (row) => (
                  <span className="rounded-full border border-[#262630] bg-[#18181F] px-2.5 py-0.5 font-mono text-xs text-[#FF5412]">
                    {row.action}
                  </span>
                ),
              },
              {
                key: 'details',
                header: 'Details',
                render: (row) => <span className="text-xs text-[#A1A1AA]">{row.details}</span>,
              },
              {
                key: 'time',
                header: 'Timestamp',
                align: 'right',
                render: (row) => (
                  <span className="font-mono text-xs text-[#A1A1AA]">
                    {new Date(row.createdAt).toLocaleTimeString()}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Tab 5: QR Security / Geofence, Tax Slabs & Upsell Rules */}
      {tab === 'SECURITY_TAX' && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[#262630] bg-[#111115] p-5">
            <h2 className="text-lg font-bold tracking-tight text-[#F4F4F5]">
              QR Security &amp; Geofence Policy
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#262630] bg-[#18181F] p-3.5 text-xs font-semibold text-[#F4F4F5]">
                <span>Require GPS Geofence</span>
                <input
                  type="checkbox"
                  checked={Boolean(data.qrSecurityPolicy.requireGps)}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      qrSecurityPolicy: { ...p.qrSecurityPolicy, requireGps: e.target.checked },
                    }))
                  }
                  className="size-5 accent-[#FF5412]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#262630] bg-[#18181F] p-3.5 text-xs font-semibold text-[#F4F4F5]">
                <span>Captain Approval Required</span>
                <input
                  type="checkbox"
                  checked={Boolean(data.qrSecurityPolicy.captainApprovalRequired)}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      qrSecurityPolicy: {
                        ...p.qrSecurityPolicy,
                        captainApprovalRequired: e.target.checked,
                      },
                    }))
                  }
                  className="size-5 accent-[#FF5412]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#262630] bg-[#18181F] p-3.5 text-xs font-semibold text-[#F4F4F5]">
                <span>Pay-First Takeaway</span>
                <input
                  type="checkbox"
                  checked={Boolean(data.qrSecurityPolicy.payFirstTakeaway)}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      qrSecurityPolicy: {
                        ...p.qrSecurityPolicy,
                        payFirstTakeaway: e.target.checked,
                      },
                    }))
                  }
                  className="size-5 accent-[#FF5412]"
                />
              </label>

              <label className="block rounded-2xl border border-[#262630] bg-[#18181F] p-3.5 text-xs font-semibold text-[#A1A1AA]">
                Max Geofence Radius (meters)
                <input
                  type="number"
                  value={data.qrSecurityPolicy.maxDistanceMeters ?? 100}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      qrSecurityPolicy: {
                        ...p.qrSecurityPolicy,
                        maxDistanceMeters: Number(e.target.value),
                      },
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 font-mono text-[#F4F4F5]"
                />
              </label>

              <label className="block rounded-2xl border border-[#262630] bg-[#18181F] p-3.5 text-xs font-semibold text-[#A1A1AA]">
                Max Unpaid QR Orders
                <input
                  type="number"
                  value={data.qrSecurityPolicy.maxUnpaidOrders ?? 3}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      qrSecurityPolicy: {
                        ...p.qrSecurityPolicy,
                        maxUnpaidOrders: Number(e.target.value),
                      },
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 font-mono text-[#F4F4F5]"
                />
              </label>

              <label className="block rounded-2xl border border-[#262630] bg-[#18181F] p-3.5 text-xs font-semibold text-[#A1A1AA]">
                Call Waiter Cooldown (secs)
                <input
                  type="number"
                  value={data.qrSecurityPolicy.serviceRequestCooldownSecs ?? 45}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      qrSecurityPolicy: {
                        ...p.qrSecurityPolicy,
                        serviceRequestCooldownSecs: Number(e.target.value),
                      },
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 font-mono text-[#F4F4F5]"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveSecurityPolicy()}
                className="min-h-11 rounded-xl bg-[#FF5412] px-5 text-xs font-semibold text-white shadow-beam transition-colors hover:bg-[#FF7033]"
              >
                Save Security Policy
              </button>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <ResponsiveTable<DashboardTaxSlab>
              caption="Outlet Tax Slabs"
              getRowKey={(row) => row.id}
              rows={data.taxSlabs}
              columns={[
                {
                  key: 'name',
                  header: 'Tax Slab',
                  isRowHeader: true,
                  render: (r) => <span className="font-semibold text-[#F4F4F5]">{r.name}</span>,
                },
                {
                  key: 'mode',
                  header: 'Mode',
                  render: (r) => (
                    <span className="text-xs text-[#A1A1AA]">
                      {r.isInclusive ? 'Inclusive' : 'Exclusive'}
                    </span>
                  ),
                },
                {
                  key: 'rates',
                  header: 'Components',
                  render: (r) => (
                    <span className="font-mono text-xs text-[#F4F4F5]">
                      {r.components
                        .map((c) => `${c.name} ${(c.rateBps / 100).toFixed(2)}%`)
                        .join(' + ')}
                    </span>
                  ),
                },
              ]}
            />

            <ResponsiveTable<DashboardUpsellRule>
              caption="Upsell Pairing Rules"
              getRowKey={(row) => row.id}
              rows={data.upsellRules}
              columns={[
                {
                  key: 'trigger',
                  header: 'Trigger Dish',
                  isRowHeader: true,
                  render: (r) => (
                    <span className="font-semibold text-[#F4F4F5]">{r.triggerItemName}</span>
                  ),
                },
                {
                  key: 'suggested',
                  header: 'Suggested Pairing',
                  render: (r) => (
                    <span className="text-xs text-[#FF5412]">{r.suggestedItemName}</span>
                  ),
                },
                {
                  key: 'pitch',
                  header: 'Pitch',
                  render: (r) => <span className="text-xs text-[#A1A1AA]">{r.pitchText}</span>,
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* + Add Menu Item Dialog */}
      <Dialog
        open={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        title="Add New Menu Item"
      >
        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Dish Name
            <input
              type="text"
              value={newDishName}
              onChange={(e) => setNewDishName(e.target.value)}
              placeholder="e.g. Dhaka Kacchi Biryani"
              className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Price (BDT ৳)
              <input
                type="number"
                min="1"
                step="1"
                value={newDishPriceMajor}
                onChange={(e) => setNewDishPriceMajor(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 font-mono text-sm text-[#F4F4F5]"
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Dietary Type
              <select
                value={newDishDietary}
                onChange={(e) => setNewDishDietary(e.target.value as DietaryType)}
                className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
              >
                <option value="NON_VEG">NON_VEG</option>
                <option value="VEG">VEG</option>
                <option value="VEGAN">VEGAN</option>
                <option value="GLUTEN_FREE">GLUTEN_FREE</option>
                <option value="EGG">EGG</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Category
              <select
                value={newDishCategoryId}
                onChange={(e) => setNewDishCategoryId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 text-xs text-[#F4F4F5]"
              >
                {menuCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              KDS Station
              <select
                value={newDishStationId}
                onChange={(e) => setNewDishStationId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 text-xs text-[#F4F4F5]"
              >
                {menuStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
              Prep (mins)
              <input
                type="number"
                min="1"
                max="180"
                value={newDishPrepMins}
                onChange={(e) => setNewDishPrepMins(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 font-mono text-xs text-[#F4F4F5]"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Tax Slab
            <select
              value={newDishTaxSlabId}
              onChange={(e) => setNewDishTaxSlabId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 text-xs text-[#F4F4F5]"
            >
              {menuTaxSlabs.map((ts) => (
                <option key={ts.id} value={ts.id}>
                  {ts.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
            Description (optional)
            <input
              type="text"
              value={newDishDescription}
              onChange={(e) => setNewDishDescription(e.target.value)}
              placeholder="Slow-cooked basmati with aromatic saffron and tender mutton."
              className="mt-1.5 w-full rounded-xl border border-[#262630] bg-[#09090B] px-3 py-2 text-sm text-[#F4F4F5]"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddMenuOpen(false)}
              className="min-h-11 rounded-xl border border-[#262630] bg-[#18181F] px-4 text-xs font-semibold text-[#F4F4F5]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submittingDish}
              onClick={() => void handleAddMenuItem()}
              className="min-h-11 rounded-xl bg-[#FF5412] px-5 text-xs font-semibold text-white shadow-beam hover:bg-[#FF7033] disabled:opacity-60"
            >
              {submittingDish ? 'Saving…' : 'Create Menu Item'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
