import type { PaymentMethod } from '../db/types';
import type {
  AuditRepository,
  DiningTableRecord,
  InventoryItemRecord,
  MenuItemRecipeRecord,
  MenuItemRecord,
  OrderItemRecord,
  OrderRecord,
  PaymentRecord,
  ShiftRegisterRecord,
  ShiftRegisterRepository,
  TableSessionRecord,
} from '../ports/repositories.port';
import { ConflictError, NotFoundError } from './errors';
import { writeAuditLog } from './rbac.service';

export interface OwnerKpiSnapshot {
  occupiedTables: number;
  totalTables: number;
  liveOrderCount: number;
  grossSalesMinor: number;
  netSalesMinor: number;
  taxCollectedMinor: number;
  averageOrderValueMinor: number;
  avgTableTurnoverMins: number;
  kdsAvgPrepMins: number;
  paymentMix: Record<PaymentMethod, number>;
}

/**
 * Computes live Owner Command Center KPIs (FR-032).
 */
export function computeOwnerKpis(input: {
  tables: DiningTableRecord[];
  orders: OrderRecord[];
  orderItems: OrderItemRecord[];
  sessions: TableSessionRecord[];
  payments: PaymentRecord[];
}): OwnerKpiSnapshot {
  const totalTables = input.tables.length;
  const occupiedTables = input.tables.filter((t) => t.status !== 'VACANT').length;

  const liveOrderCount = input.orders.filter(
    (o) => o.status === 'PENDING_APPROVAL' || o.status === 'CONFIRMED' || o.status === 'IN_PROGRESS',
  ).length;

  const paidOrOpenSessions = input.sessions.filter((s) => s.status !== 'CANCELLED');
  const grossSalesMinor = paidOrOpenSessions.reduce((sum, s) => sum + s.totalMinor, 0);
  const taxCollectedMinor = paidOrOpenSessions.reduce((sum, s) => sum + s.taxMinor, 0);
  const netSalesMinor = Math.max(0, grossSalesMinor - taxCollectedMinor);

  const averageOrderValueMinor =
    paidOrOpenSessions.length > 0
      ? Math.round(grossSalesMinor / paidOrOpenSessions.length)
      : 0;

  const closedSessions = input.sessions.filter(
    (s) => s.status === 'PAID' && s.closedAt != null,
  );
  const avgTableTurnoverMins =
    closedSessions.length > 0
      ? Math.round(
          closedSessions.reduce(
            (sum, s) =>
              sum + Math.max(1, (s.closedAt!.getTime() - s.openedAt.getTime()) / 60000),
            0,
          ) / closedSessions.length,
        )
      : 0;

  const preparedItems = input.orderItems.filter(
    (i) => i.startedAt != null && i.readyAt != null,
  );
  const kdsAvgPrepMins =
    preparedItems.length > 0
      ? Math.round(
          preparedItems.reduce(
            (sum, i) =>
              sum + Math.max(1, (i.readyAt!.getTime() - i.startedAt!.getTime()) / 60000),
            0,
          ) / preparedItems.length,
        )
      : 0;

  const paymentMix: Record<PaymentMethod, number> = {
    CARD: 0,
    UPI: 0,
    MFS: 0,
    CASH: 0,
    NET_BANKING: 0,
    WALLET: 0,
  };
  for (const p of input.payments) {
    if (p.status === 'CAPTURED') {
      paymentMix[p.method] = (paymentMix[p.method] ?? 0) + p.amountMinor;
    }
  }

  return {
    occupiedTables,
    totalTables,
    liveOrderCount,
    grossSalesMinor,
    netSalesMinor,
    taxCollectedMinor,
    averageOrderValueMinor,
    avgTableTurnoverMins,
    kdsAvgPrepMins,
    paymentMix,
  };
}

export type MenuEngineeringQuadrant = 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';

export interface MenuEngineeringEntry {
  menuItemId: string;
  name: string;
  unitsSold: number;
  revenueMinor: number;
  estimatedFoodCostMinor: number;
  unitMarginMinor: number;
  quadrant: MenuEngineeringQuadrant;
}

/**
 * Menu Engineering Matrix (FR-036):
 * Classifies menu items into Stars, Plowhorses, Puzzles, and Dogs
 * by comparing popularity (units sold) and unit contribution margin against averages.
 */
export function computeMenuEngineeringMatrix(input: {
  menuItems: MenuItemRecord[];
  orderItems: OrderItemRecord[];
  recipes?: MenuItemRecipeRecord[];
  inventoryItems?: InventoryItemRecord[];
}): MenuEngineeringEntry[] {
  const invCostById = new Map(
    (input.inventoryItems ?? []).map((inv) => [inv.id, inv.costPerUnitMinor]),
  );

  const unitCostByMenuId = new Map<string, number>();
  for (const recipe of input.recipes ?? []) {
    const costPerUnit = invCostById.get(recipe.inventoryItemId) ?? 0;
    const addCost = Math.round(Number(recipe.qtyRequired) * costPerUnit);
    unitCostByMenuId.set(
      recipe.menuItemId,
      (unitCostByMenuId.get(recipe.menuItemId) ?? 0) + addCost,
    );
  }

  const salesByMenuId = new Map<string, { units: number; revenueMinor: number }>();
  for (const oi of input.orderItems) {
    if (oi.kdsStatus === 'CANCELLED') continue;
    const prev = salesByMenuId.get(oi.menuItemId) ?? { units: 0, revenueMinor: 0 };
    prev.units += oi.quantity;
    prev.revenueMinor += oi.unitPriceMinor * oi.quantity;
    salesByMenuId.set(oi.menuItemId, prev);
  }

  const rawEntries = input.menuItems.map((mi) => {
    const sales = salesByMenuId.get(mi.id) ?? { units: 0, revenueMinor: 0 };
    const foodCost = unitCostByMenuId.get(mi.id) ?? Math.round(mi.basePriceMinor * 0.3);
    const unitMarginMinor = mi.basePriceMinor - foodCost;
    return {
      menuItemId: mi.id,
      name: mi.name,
      unitsSold: sales.units,
      revenueMinor: sales.revenueMinor,
      estimatedFoodCostMinor: foodCost,
      unitMarginMinor,
    };
  });

  if (rawEntries.length === 0) return [];

  const avgPopularity =
    rawEntries.reduce((acc, e) => acc + e.unitsSold, 0) / rawEntries.length;
  const avgMargin =
    rawEntries.reduce((acc, e) => acc + e.unitMarginMinor, 0) / rawEntries.length;

  return rawEntries.map((entry) => {
    const highPop = entry.unitsSold >= avgPopularity;
    const highMargin = entry.unitMarginMinor >= avgMargin;
    const quadrant: MenuEngineeringQuadrant =
      highPop && highMargin
        ? 'STAR'
        : highPop && !highMargin
          ? 'PLOWHORSE'
          : !highPop && highMargin
            ? 'PUZZLE'
            : 'DOG';
    return { ...entry, quadrant };
  });
}

export interface ShiftZReport {
  shift: ShiftRegisterRecord;
  cashSalesMinor: number;
  cardSalesMinor: number;
  upiSalesMinor: number;
  mfsSalesMinor: number;
  totalSalesMinor: number;
  expectedCashMinor: number;
  actualCashMinor: number;
  varianceMinor: number;
}

/**
 * Closes an open register shift and produces the Z-Report reconciliation (FR-035).
 */
export async function closeShiftWithZReport(
  deps: {
    shift: ShiftRegisterRepository;
    audit: AuditRepository;
  },
  input: {
    tenantId: string;
    outletId: string;
    shiftId: string;
    closedByUserId: string;
    actualCashMinor: number;
    pettyCashMinor: number;
    paymentsInShift: PaymentRecord[];
    notes?: string;
  },
): Promise<ShiftZReport> {
  const openShift = await deps.shift.findOpenShift(input.tenantId, input.outletId);
  if (!openShift || openShift.id !== input.shiftId) {
    throw new NotFoundError('Open shift register not found', { shiftId: input.shiftId });
  }
  if (openShift.status === 'CLOSED') {
    throw new ConflictError('Shift is already closed.');
  }

  let cashSalesMinor = 0;
  let cardSalesMinor = 0;
  let upiSalesMinor = 0;
  let mfsSalesMinor = 0;

  for (const p of input.paymentsInShift) {
    if (p.status !== 'CAPTURED') continue;
    if (p.method === 'CASH') cashSalesMinor += p.amountMinor;
    else if (p.method === 'CARD') cardSalesMinor += p.amountMinor;
    else if (p.method === 'UPI') upiSalesMinor += p.amountMinor;
    else if (p.method === 'MFS') mfsSalesMinor += p.amountMinor;
  }

  const expectedCashMinor =
    openShift.openingFloatMinor + cashSalesMinor - input.pettyCashMinor;
  const varianceMinor = input.actualCashMinor - expectedCashMinor;

  const closedShift = await deps.shift.closeShift(input.tenantId, openShift.id, {
    closedByUserId: input.closedByUserId,
    status: 'CLOSED',
    cashSalesMinor,
    pettyCashMinor: input.pettyCashMinor,
    expectedCashMinor,
    actualCashMinor: input.actualCashMinor,
    varianceMinor,
    notes: input.notes ?? null,
    closedAt: new Date(),
  });

  await writeAuditLog(deps.audit, {
    tenantId: input.tenantId,
    outletId: input.outletId,
    actorUserId: input.closedByUserId,
    action: 'SHIFT_CLOSED',
    entityType: 'shift_registers',
    entityId: closedShift.id,
    afterState: {
      expectedCashMinor,
      actualCashMinor: input.actualCashMinor,
      varianceMinor,
    },
  });

  return {
    shift: closedShift,
    cashSalesMinor,
    cardSalesMinor,
    upiSalesMinor,
    mfsSalesMinor,
    totalSalesMinor: cashSalesMinor + cardSalesMinor + upiSalesMinor + mfsSalesMinor,
    expectedCashMinor,
    actualCashMinor: input.actualCashMinor,
    varianceMinor,
  };
}

/**
 * RFC 4180 CSV export generator for BI & Z-Reports (FR-036).
 */
export function generateCsvReport(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>,
): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  return lines.join('\r\n');
}

export interface HourlyRevenueBucket {
  hour: number;
  hourLabel: string;
  amountMinor: number;
  orderCount: number;
  isCurrentHour: boolean;
}

/**
 * Aggregates orders and captured payments into 24 hourly revenue buckets (00:00–23:00).
 */
export function computeHourlyRevenueBuckets(
  orders: OrderRecord[],
  payments: PaymentRecord[],
  now: Date = new Date(),
): HourlyRevenueBucket[] {
  const currentHour = now.getHours();
  const buckets: HourlyRevenueBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    hourLabel: `${String(hour).padStart(2, '0')}:00`,
    amountMinor: 0,
    orderCount: 0,
    isCurrentHour: hour === currentHour,
  }));

  for (const order of orders) {
    if (order.status === 'CANCELLED') continue;
    const hour = order.createdAt.getHours();
    const bucket = buckets[hour];
    if (bucket) {
      bucket.orderCount += 1;
    }
  }

  for (const payment of payments) {
    if (payment.status !== 'CAPTURED') continue;
    const paidAt = payment.paidAt ?? now;
    const hour = paidAt.getHours();
    const bucket = buckets[hour];
    if (bucket) {
      bucket.amountMinor += payment.amountMinor;
    }
  }

  return buckets;
}
