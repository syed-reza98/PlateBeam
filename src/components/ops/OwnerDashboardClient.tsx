'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Lock,
  Package,
  Plus,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';
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

type DashboardTab =
  | 'OVERVIEW'
  | 'MENU_86'
  | 'INVENTORY'
  | 'RBAC_AUDIT'
  | 'SECURITY_TAX';

const PERMISSION_KEYS = [
  'orders.approve',
  'orders.void',
  'menu.toggle_86',
  'billing.refund',
  'shifts.close_zreport',
  'qr.rotate',
] as const;

function createDemoDashboardPayload(): DashboardBootstrapPayload {
  const now = Date.now();
  return {
    outletId: '11111111-1111-4111-8111-111111111111',
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
        name: 'Standard Dine-In GST (5%)',
        isInclusive: false,
        components: [
          { name: 'CGST', rateBps: 250 },
          { name: 'SGST', rateBps: 250 },
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
  const [data, setData] = useState<DashboardBootstrapPayload>(() =>
    createDemoDashboardPayload(),
  );
  const [tab, setTab] = useState<DashboardTab>('OVERVIEW');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('st-1');

  const loadLive = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/analytics/outlets/default/live', {
        cache: 'no-store',
      });
      if (res.ok) {
        const payload = (await res.json()) as DashboardBootstrapPayload;
        setData(payload);
        if (payload.staff[0]) setSelectedStaffId(payload.staff[0].id);
      }
    } catch {
      // Demo fallback already loaded
    }
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) void loadLive();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadLive]);

  const lowStockCount = useMemo(
    () => data.inventory.filter((i) => i.currentStock <= i.reorderLevel).length,
    [data.inventory],
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
      title: `RBAC Override Saved`,
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
      ['Item', 'Category', 'Price', 'Cost', 'Unit Margin', '30d Units', 'Available'],
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

  return (
    <div className="space-y-6">
      {/* Live KPI Cards */}
      <section aria-label="Live Outlet KPIs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            Occupied Tables
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
            {data.kpis.occupiedTables}/{data.kpis.totalTables}
          </p>
          <p className="mt-1 text-xs text-[var(--pb-muted)]">
            Avg turnover {data.kpis.avgTurnoverMinutes} mins
          </p>
        </div>

        <div className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            Net Sales Today
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[var(--pb-accent)]">
            {formatMinorCurrency(data.kpis.netSalesMinor, data.currencyCode)}
          </p>
          <p className="mt-1 text-xs text-[var(--pb-muted)]">
            {data.kpis.liveOrdersCount} live orders · AOV{' '}
            {formatMinorCurrency(data.kpis.aovMinor, data.currencyCode)}
          </p>
        </div>

        <div className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            KDS Prep SLA
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[var(--pb-olive)]">
            {data.kpis.kdsSlaOnTimePct}%
          </p>
          <p className="mt-1 text-xs text-[var(--pb-muted)]">
            On-time ticket bump rate
          </p>
        </div>

        <div className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            Payment Mix
          </p>
          <div className="mt-2 space-y-1 text-xs">
            {data.kpis.paymentMix.map((pm) => (
              <div key={pm.method} className="flex items-center justify-between font-mono tabular-nums">
                <span>{pm.method}</span>
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
              { id: 'OVERVIEW', label: 'Menu Engineering', icon: TrendingUp },
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
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold ${
                  active
                    ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                    : 'border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-ink)]'
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
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] px-4 text-xs font-semibold hover:border-[var(--pb-accent)]"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {/* Tab 1: Menu Engineering Matrix */}
      {tab === 'OVERVIEW' && (
        <section aria-label="Menu Engineering Matrix" className="grid gap-4 md:grid-cols-2">
          {(
            [
              {
                title: 'Stars',
                subtitle: 'High Popularity · High Profit',
                items: engineeringQuadrants.stars,
                tone: 'border-amber-500/60 bg-amber-500/10 shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]',
                hint: 'Promote prominently on QR hero & automated upsell triggers.',
                icon: Star,
                iconClass: 'text-amber-500 fill-amber-500',
              },
              {
                title: 'Plowhorses',
                subtitle: 'High Popularity · Lower Profit',
                items: engineeringQuadrants.plowhorses,
                tone: 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)]',
                hint: 'Test portioning or pair with high-margin signature sides.',
                icon: TrendingUp,
                iconClass: 'text-emerald-500',
              },
              {
                title: 'Puzzles',
                subtitle: 'Lower Popularity · High Profit',
                items: engineeringQuadrants.puzzles,
                tone: 'border-sky-500/50 bg-sky-500/10 shadow-[0_0_20px_-5px_rgba(14,165,233,0.15)]',
                hint: 'Feature in Captain recommendations & Spice Quiz rewards.',
                icon: Sparkles,
                iconClass: 'text-sky-500',
              },
              {
                title: 'Dogs',
                subtitle: 'Lower Popularity · Lower Profit',
                items: engineeringQuadrants.dogs,
                tone: 'border-rose-500/50 bg-rose-500/10 shadow-[0_0_20px_-5px_rgba(244,63,94,0.15)]',
                hint: 'Consider seasonal rotation, ingredient repurposing, or re-costing.',
                icon: AlertTriangle,
                iconClass: 'text-rose-500',
              },
            ] as const
          ).map((quadrant) => {
            const QuadIcon = quadrant.icon;
            return (
              <div key={quadrant.title} className={`rounded-sm border p-4.5 transition-all ${quadrant.tone}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[var(--pb-ink)]">{quadrant.title}</h2>
                    <p className="text-[11px] font-medium text-[var(--pb-muted)]">{quadrant.subtitle}</p>
                  </div>
                  <QuadIcon className={`size-5 ${quadrant.iconClass}`} aria-hidden="true" />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--pb-muted)]">{quadrant.hint}</p>
                <ul className="mt-3.5 space-y-2">
                  {quadrant.items.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-[var(--pb-border)] p-3 text-center text-xs text-[var(--pb-muted)]">
                      No dishes currently in this quadrant.
                    </li>
                  ) : (
                    quadrant.items.map((dish) => (
                      <li
                        key={dish.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3.5 py-2.5 text-xs shadow-xs"
                      >
                        <span className="font-semibold text-[var(--pb-ink)]">{dish.name}</span>
                        <span className="font-mono tabular-nums text-[var(--pb-muted)]">
                          {dish.unitsSold30d} sold ·{' '}
                          <span className="font-semibold text-[var(--pb-accent)]">
                            {formatMinorCurrency(
                              dish.basePriceMinor - dish.costMinor,
                              data.currencyCode,
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
      )}

      {/* Tab 2: Menu & 86 Toggle */}
      {tab === 'MENU_86' && (
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
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-[var(--pb-muted)]">
                    {row.categoryName} · {row.stationName}
                  </p>
                </div>
              ),
            },
            {
              key: 'dietary',
              header: 'Dietary',
              render: (row) => (
                <span className="rounded-full border border-[var(--pb-border)] px-2 py-0.5 text-[11px] font-medium">
                  {row.dietaryType}
                </span>
              ),
            },
            {
              key: 'price',
              header: 'Price',
              align: 'right',
              render: (row) => formatMinorCurrency(row.basePriceMinor, data.currencyCode),
            },
            {
              key: 'sold',
              header: '30d Sold',
              align: 'right',
              render: (row) => row.unitsSold30d,
            },
            {
              key: 'toggle',
              header: 'Availability (86)',
              align: 'right',
              render: (row) => (
                <button
                  type="button"
                  onClick={() => void handleToggle86(row)}
                  className={`min-h-11 rounded-xl px-3.5 text-xs font-semibold ${
                    row.isAvailable
                      ? 'bg-[var(--pb-olive)]/15 text-[var(--pb-olive)]'
                      : 'bg-[var(--pb-chili)] text-white'
                  }`}
                >
                  {row.isAvailable ? 'Available' : "86'd (Out)"}
                </button>
              ),
            },
          ]}
        />
      )}

      {/* Tab 3: BOM Inventory & Low-Stock Alerts */}
      {tab === 'INVENTORY' && (
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
                  <p className="font-semibold">{row.name}</p>
                  <p className="font-mono text-xs text-[var(--pb-muted)]">{row.sku}</p>
                </div>
              ),
            },
            {
              key: 'linked',
              header: 'Linked Dishes',
              render: (row) => row.linkedMenuItems.join(', '),
            },
            {
              key: 'stock',
              header: 'On Hand',
              align: 'right',
              render: (row) => {
                const isLow = row.currentStock <= row.reorderLevel;
                return (
                  <span
                    className={`inline-flex items-center gap-1 font-mono font-bold ${
                      isLow ? 'text-[var(--pb-chili)]' : 'text-[var(--pb-olive)]'
                    }`}
                  >
                    {isLow && <AlertTriangle className="size-3.5" aria-hidden="true" />}
                    {row.currentStock} {row.unit}
                  </span>
                );
              },
            },
            {
              key: 'reorder',
              header: 'Reorder At',
              align: 'right',
              render: (row) => `${row.reorderLevel} ${row.unit}`,
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
                    className="min-h-11 min-w-11 rounded-lg border border-[var(--pb-border)] px-2.5 font-mono text-xs font-bold"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleInventoryAdjust(row, 5)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[var(--pb-accent)] px-3 font-mono text-xs font-bold text-[var(--pb-accent-ink)]"
                  >
                    <Plus className="size-3" aria-hidden="true" />5
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Tab 4: 3-Layer RBAC Matrix & Audit Logs */}
      {tab === 'RBAC_AUDIT' && (
        <div className="space-y-6">
          <section className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">3-Layer RBAC Overrides</h2>
                <p className="text-xs text-[var(--pb-muted)]">
                  Effective = (Role Defaults + Explicit GRANT) − Explicit DENY (DENY always wins)
                </p>
              </div>
              <label className="text-xs font-semibold">
                Staff Member:{' '}
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="ml-2 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-1.5 text-xs"
                >
                  {data.staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.roleName})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PERMISSION_KEYS.map((perm) => {
                const current = data.overrides.find(
                  (o) => o.userId === selectedStaffId && o.permissionKey === perm,
                );
                return (
                  <div
                    key={perm}
                    className="flex items-center justify-between rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3"
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold">{perm}</p>
                      <p className="text-[11px] text-[var(--pb-muted)]">
                        Override: {current ? current.effect : 'Role Default'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void handleSetOverride(perm, 'GRANT')}
                        className={`min-h-11 rounded-lg px-2.5 text-[11px] font-bold ${
                          current?.effect === 'GRANT'
                            ? 'bg-[var(--pb-olive)] text-white'
                            : 'border border-[var(--pb-border)]'
                        }`}
                      >
                        GRANT
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSetOverride(perm, 'DENY')}
                        className={`min-h-11 rounded-lg px-2.5 text-[11px] font-bold ${
                          current?.effect === 'DENY'
                            ? 'bg-[var(--pb-chili)] text-white'
                            : 'border border-[var(--pb-border)]'
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
                render: (row) => row.actorName,
              },
              {
                key: 'action',
                header: 'Action',
                render: (row) => <span className="font-mono text-xs">{row.action}</span>,
              },
              {
                key: 'details',
                header: 'Details',
                render: (row) => row.details,
              },
              {
                key: 'time',
                header: 'Timestamp',
                align: 'right',
                render: (row) => new Date(row.createdAt).toLocaleTimeString(),
              },
            ]}
          />
        </div>
      )}

      {/* Tab 5: QR Security / Geofence, Tax Slabs & Upsell Rules */}
      {tab === 'SECURITY_TAX' && (
        <div className="space-y-6">
          <section className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-5">
            <h2 className="font-display text-xl">QR Security & Geofence Policy</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3 text-xs font-semibold">
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
                  className="size-5 accent-[var(--pb-accent)]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3 text-xs font-semibold">
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
                  className="size-5 accent-[var(--pb-accent)]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3 text-xs font-semibold">
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
                  className="size-5 accent-[var(--pb-accent)]"
                />
              </label>

              <label className="block rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3 text-xs font-semibold">
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
                  className="mt-1.5 w-full rounded-lg border border-[var(--pb-border)] bg-[var(--pb-surface)] px-2.5 py-1.5 font-mono"
                />
              </label>

              <label className="block rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3 text-xs font-semibold">
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
                  className="mt-1.5 w-full rounded-lg border border-[var(--pb-border)] bg-[var(--pb-surface)] px-2.5 py-1.5 font-mono"
                />
              </label>

              <label className="block rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3 text-xs font-semibold">
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
                  className="mt-1.5 w-full rounded-lg border border-[var(--pb-border)] bg-[var(--pb-surface)] px-2.5 py-1.5 font-mono"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveSecurityPolicy()}
                className="min-h-11 rounded-xl bg-[var(--pb-accent)] px-5 text-xs font-semibold text-[var(--pb-accent-ink)]"
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
                { key: 'name', header: 'Tax Slab', isRowHeader: true, render: (r) => r.name },
                {
                  key: 'mode',
                  header: 'Mode',
                  render: (r) => (r.isInclusive ? 'Inclusive' : 'Exclusive'),
                },
                {
                  key: 'rates',
                  header: 'Components',
                  render: (r) =>
                    r.components.map((c) => `${c.name} ${(c.rateBps / 100).toFixed(2)}%`).join(' + '),
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
                  render: (r) => r.triggerItemName,
                },
                { key: 'suggested', header: 'Suggested Pairing', render: (r) => r.suggestedItemName },
                { key: 'pitch', header: 'Pitch', render: (r) => r.pitchText },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
