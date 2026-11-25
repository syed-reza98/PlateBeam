import type { KdsStatus, ModifierSnapshot, OrderSource, OrderStatus } from '../db/types';
import type { KotPrintItem, PrintPort } from '../ports/print.port';
import type { RealtimePort } from '../ports/realtime.port';
import type {
  AuditRepository,
  FloorRepository,
  InventoryRepository,
  KitchenStationRecord,
  MenuItemRecord,
  MenuRepository,
  OrderItemRecord,
  OrderRecord,
  SessionOrderRepository,
  TenantOutletRepository,
} from '../ports/repositories.port';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from './errors';
import { buildKotEscPosBuffer, escPosBufferToBase64 } from './escpos.service';
import { writeAuditLog } from './rbac.service';

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  modifierIds?: string[];
  spiceLevel?: string;
  notes?: string;
}

const VALID_KDS_TRANSITIONS: Record<KdsStatus, KdsStatus[]> = {
  PENDING: ['ACCEPTED', 'PREPARING', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'READY', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'PREPARING', 'CANCELLED'],
  SERVED: ['READY'], // allows recall
  CANCELLED: [],
};

/**
 * Validates KDS state transitions (FR-015):
 * `PENDING -> ACCEPTED -> PREPARING -> READY -> SERVED`
 * Cancelling an item once it has reached `PREPARING` (or `READY`) requires manager PIN verification.
 */
export function validateKdsTransition(
  currentStatus: KdsStatus,
  nextStatus: KdsStatus,
  managerPinVerified = false,
): void {
  if (currentStatus === nextStatus) return;

  const allowed = VALID_KDS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new ConflictError(
      `Invalid KDS transition from ${currentStatus} to ${nextStatus}`,
      { currentStatus, nextStatus },
    );
  }

  if (
    nextStatus === 'CANCELLED' &&
    (currentStatus === 'PREPARING' || currentStatus === 'READY') &&
    !managerPinVerified
  ) {
    throw new ForbiddenError(
      'Manager PIN is required to cancel an item once cooking has started.',
      { code: 'MANAGER_PIN_REQUIRED', currentStatus },
    );
  }
}

export type SlaSeverity = 'ON_TIME' | 'WARNING' | 'OVERDUE';

/**
 * Computes KDS ticket elapsed timer and SLA escalation severity (FR-014):
 * Green (ON_TIME <= 75%), Amber (WARNING > 75%), Pulsing Red (OVERDUE > 100%).
 */
export function getTicketSlaSeverity(
  createdAt: Date,
  prepTimeMins: number,
  now: Date = new Date(),
): {
  elapsedSecs: number;
  targetSecs: number;
  ratio: number;
  severity: SlaSeverity;
} {
  const elapsedSecs = Math.max(
    0,
    Math.floor((now.getTime() - createdAt.getTime()) / 1000),
  );
  const targetSecs = Math.max(60, prepTimeMins * 60);
  const ratio = elapsedSecs / targetSecs;
  const severity: SlaSeverity =
    ratio > 1 ? 'OVERDUE' : ratio > 0.75 ? 'WARNING' : 'ON_TIME';
  return { elapsedSecs, targetSecs, ratio, severity };
}

function generateOrderNumber(roundNumber: number): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  return `PB-${ts}-R${roundNumber}`;
}

async function fireStationKots(
  deps: { print?: PrintPort },
  input: {
    tenantId: string;
    outletId: string;
    order: OrderRecord;
    items: OrderItemRecord[];
    stationsById: Map<string, KitchenStationRecord>;
    tableNumber?: string | null;
    tokenNumber?: number | null;
  },
): Promise<void> {
  if (!deps.print) return;

  const byStation = new Map<string, OrderItemRecord[]>();
  for (const item of input.items) {
    const arr = byStation.get(item.stationId) ?? [];
    arr.push(item);
    byStation.set(item.stationId, arr);
  }

  for (const [stationId, stationItems] of byStation.entries()) {
    const station = input.stationsById.get(stationId);
    const paperWidthMm: 58 | 80 =
      station?.printerConfig?.paperWidthMm === 58 ? 58 : 80;

    const kotItems: KotPrintItem[] = stationItems.map((si) => ({
      name: si.itemNameSnapshot,
      quantity: si.quantity,
      modifiers: si.modifiersSnapshot.map((m) => m.optionName),
      spiceLevel: si.spiceLevel,
      notes: si.notes,
    }));

    const escPosBuffer = buildKotEscPosBuffer({
      paperWidthMm,
      headerTitle: 'KITCHEN ORDER TICKET',
      stationName: station?.name,
      orderNumber: input.order.orderNumber,
      roundNumber: input.order.roundNumber,
      tableNumber: input.tableNumber,
      tokenNumber: input.tokenNumber,
      items: kotItems,
      createdAt: input.order.createdAt,
    });

    await deps.print.enqueuePrintJob({
      tenantId: input.tenantId,
      outletId: input.outletId,
      stationId,
      jobType: 'KOT',
      paperWidthMm,
      headerTitle: station?.name ?? 'Kitchen',
      tableNumber: input.tableNumber ?? null,
      tokenNumber: input.tokenNumber ?? null,
      orderNumber: input.order.orderNumber,
      roundNumber: input.order.roundNumber,
      items: kotItems,
      escPosBase64: escPosBufferToBase64(escPosBuffer),
    });
  }
}

/**
 * Places a new order round under a running table_session (FR-010, FR-012, FR-013, FR-034):
 * - Validates item availability (rejects 86'd items)
 * - Performs atomic BOM stock check & auto-deduction; auto-86s any dish whose ingredient hits zero
 * - Splits items by station_id & routes to KDS / Captain Approval
 * - Updates session running totals
 * - Fires ESC/POS KOT print jobs per station
 */
export async function placeOrder(
  deps: {
    tenantOutlet: TenantOutletRepository;
    floor: FloorRepository;
    menu: MenuRepository;
    sessionOrder: SessionOrderRepository;
    inventory: InventoryRepository;
    realtime: RealtimePort;
    print?: PrintPort;
  },
  input: {
    tenantId: string;
    outletId: string;
    sessionId: string;
    source: OrderSource;
    guestId?: string | null;
    actorUserId?: string | null;
    autoApprove?: boolean;
    items: OrderItemInput[];
  },
): Promise<{
  order: OrderRecord;
  items: OrderItemRecord[];
  auto86MenuItemIds: string[];
}> {
  if (input.items.length === 0) {
    throw new ValidationError('Order must contain at least one item.');
  }

  const [outlet, session, menuItems, modifiers, taxSlabs, stations, existingOrders] =
    await Promise.all([
      deps.tenantOutlet.findOutletById(input.tenantId, input.outletId),
      deps.sessionOrder.findSessionById(input.tenantId, input.sessionId),
      deps.menu.listMenuItems(input.tenantId, input.outletId, false),
      deps.menu.listModifiersByOutlet(input.tenantId, input.outletId),
      deps.menu.listTaxSlabs(input.tenantId, input.outletId),
      deps.menu.listStations(input.tenantId, input.outletId),
      deps.sessionOrder.listOrdersBySession(input.tenantId, input.sessionId),
    ]);

  if (!outlet) throw new NotFoundError('Outlet not found', { outletId: input.outletId });
  if (!session) throw new NotFoundError('Table session not found', { sessionId: input.sessionId });
  if (session.status === 'PAID' || session.status === 'CANCELLED') {
    throw new ConflictError('Cannot add orders to a closed session.');
  }

  const menuItemById = new Map<string, MenuItemRecord>(menuItems.map((m) => [m.id, m]));
  const modifierById = new Map(modifiers.map((m) => [m.id, m]));
  const taxSlabById = new Map(taxSlabs.map((t) => [t.id, t]));
  const stationsById = new Map(stations.map((s) => [s.id, s]));

  // Validate items & compute minor-unit line pricing
  const preparedItems: Array<{
    menuItem: MenuItemRecord;
    quantity: number;
    unitPriceMinor: number;
    taxMinor: number;
    modifiersSnapshot: ModifierSnapshot[];
    spiceLevel: string | null;
    notes: string | null;
  }> = [];

  for (const reqItem of input.items) {
    const menuItem = menuItemById.get(reqItem.menuItemId);
    if (!menuItem) {
      throw new NotFoundError('Menu item not found', { menuItemId: reqItem.menuItemId });
    }
    if (!menuItem.isAvailable) {
      throw new ConflictError(`${menuItem.name} is currently out of stock (86'd).`, {
        menuItemId: menuItem.id,
      });
    }

    const modSnapshots: ModifierSnapshot[] = [];
    let modDeltaMinor = 0;
    for (const modId of reqItem.modifierIds ?? []) {
      const mod = modifierById.get(modId);
      if (mod && mod.menuItemId === menuItem.id) {
        modSnapshots.push({
          modifierId: mod.id,
          groupName: mod.groupName,
          optionName: mod.optionName,
          priceDeltaMinor: mod.priceDeltaMinor,
        });
        modDeltaMinor += mod.priceDeltaMinor;
      }
    }

    const unitPriceMinor = menuItem.basePriceMinor + modDeltaMinor;
    const lineGrossMinor = unitPriceMinor * reqItem.quantity;
    const slab = taxSlabById.get(menuItem.taxSlabId);
    let lineTaxMinor = 0;
    if (slab && slab.rateBps > 0) {
      lineTaxMinor = slab.isInclusive
        ? Math.round((lineGrossMinor * slab.rateBps) / (10000 + slab.rateBps))
        : Math.round((lineGrossMinor * slab.rateBps) / 10000);
    }

    preparedItems.push({
      menuItem,
      quantity: reqItem.quantity,
      unitPriceMinor,
      taxMinor: lineTaxMinor,
      modifiersSnapshot: modSnapshots,
      spiceLevel: reqItem.spiceLevel ?? null,
      notes: reqItem.notes ?? null,
    });
  }

  // Atomic BOM stock check & auto-deduction (FR-034)
  const orderedMenuItemIds = Array.from(new Set(preparedItems.map((p) => p.menuItem.id)));
  const recipes = await deps.inventory.listRecipesForMenuItems(
    input.tenantId,
    orderedMenuItemIds,
  );

  const deductionsByInvId = new Map<string, number>();
  for (const p of preparedItems) {
    const itemRecipes = recipes.filter((r) => r.menuItemId === p.menuItem.id);
    for (const r of itemRecipes) {
      const qty = Number(r.qtyRequired) * p.quantity;
      deductionsByInvId.set(
        r.inventoryItemId,
        (deductionsByInvId.get(r.inventoryItemId) ?? 0) + qty,
      );
    }
  }

  const auto86MenuItemIds: string[] = [];
  if (deductionsByInvId.size > 0) {
    const invItems = await deps.inventory.listInventoryItems(
      input.tenantId,
      input.outletId,
    );
    const invById = new Map(invItems.map((i) => [i.id, i]));

    for (const [invId, needed] of deductionsByInvId.entries()) {
      const inv = invById.get(invId);
      if (inv && Number(inv.currentQty) < needed) {
        throw new ConflictError(
          `Insufficient stock for ingredient: ${inv.name}`,
          { inventoryItemId: invId, available: Number(inv.currentQty), needed },
        );
      }
    }

    const { depletedItemIds } = await deps.inventory.deductStock(
      input.tenantId,
      input.outletId,
      Array.from(deductionsByInvId.entries()).map(([inventoryItemId, qtyToDeduct]) => ({
        inventoryItemId,
        qtyToDeduct,
      })),
    );

    if (depletedItemIds.length > 0) {
      const depletedSet = new Set(depletedItemIds);
      const affectedMenuIds = new Set(
        recipes
          .filter((r) => depletedSet.has(r.inventoryItemId))
          .map((r) => r.menuItemId),
      );

      for (const menuId of affectedMenuIds) {
        await deps.menu.setItemAvailability(input.tenantId, menuId, false);
        auto86MenuItemIds.push(menuId);
        await deps.realtime.publishToMenu(
          input.tenantId,
          input.outletId,
          'menu.updated',
          { menuItemId: menuId, isAvailable: false, auto86: true },
        );
      }
    }
  }

  const requiresCaptainApproval =
    input.source === 'QR' &&
    Boolean(outlet.qrSecurityPolicy?.captainApprovalRequired) &&
    !input.autoApprove;

  const orderStatus: OrderStatus = requiresCaptainApproval
    ? 'PENDING_APPROVAL'
    : 'CONFIRMED';

  const roundNumber = existingOrders.length + 1;
  const orderNumber = generateOrderNumber(roundNumber);

  const { order, items } = await deps.sessionOrder.createOrderWithItems({
    order: {
      tenantId: input.tenantId,
      outletId: input.outletId,
      sessionId: input.sessionId,
      orderNumber,
      roundNumber,
      source: input.source,
      status: orderStatus,
      placedByGuestId: input.guestId ?? null,
      approvedByUserId:
        orderStatus === 'CONFIRMED' ? (input.actorUserId ?? null) : null,
    },
    items: preparedItems.map((p) => ({
      tenantId: input.tenantId,
      orderId: '00000000-0000-0000-0000-000000000000', // replaced by repo
      menuItemId: p.menuItem.id,
      stationId: p.menuItem.stationId,
      itemNameSnapshot: p.menuItem.name,
      quantity: p.quantity,
      unitPriceMinor: p.unitPriceMinor,
      modifiersSnapshot: p.modifiersSnapshot,
      spiceLevel: p.spiceLevel,
      notes: p.notes,
      taxMinor: p.taxMinor,
      kdsStatus: 'PENDING',
    })),
  });

  // Recalculate running session totals
  const allSessionItems = await deps.sessionOrder.listOrderItemsBySession(
    input.tenantId,
    input.sessionId,
  );
  let subtotalMinor = 0;
  let taxMinor = 0;
  for (const si of allSessionItems) {
    if (si.kdsStatus === 'CANCELLED') continue;
    subtotalMinor += si.unitPriceMinor * si.quantity;
    taxMinor += si.taxMinor;
  }

  const totalMinor = Math.max(
    0,
    subtotalMinor +
      taxMinor +
      session.serviceChargeMinor -
      session.discountMinor +
      session.tipMinor,
  );

  await deps.sessionOrder.updateSessionTotals(input.tenantId, input.sessionId, {
    subtotalMinor,
    taxMinor,
    discountMinor: session.discountMinor,
    serviceChargeMinor: session.serviceChargeMinor,
    tipMinor: session.tipMinor,
    totalMinor,
    status: session.status,
    closedAt: session.closedAt,
  });

  const table = session.tableId
    ? await deps.floor.findTableById(input.tenantId, session.tableId)
    : null;

  if (table && table.status === 'VACANT') {
    await deps.floor.updateTableStatus(
      input.tenantId,
      table.id,
      'ORDERING',
      session.id,
    );
  }

  await deps.realtime.publishToFloor(
    input.tenantId,
    input.outletId,
    'order.created',
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      sessionId: session.id,
      tableId: session.tableId,
      status: order.status,
    },
  );

  await deps.realtime.publishToTableSession(
    input.tenantId,
    session.id,
    'order.created',
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      roundNumber: order.roundNumber,
    },
  );

  if (order.status === 'CONFIRMED') {
    const stationIds = Array.from(new Set(items.map((i) => i.stationId)));
    for (const stationId of stationIds) {
      await deps.realtime.publishToStation(
        input.tenantId,
        input.outletId,
        stationId,
        'order.created',
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          tableId: session.tableId,
          tokenNumber: session.tokenNumber,
        },
      );
    }

    await fireStationKots(deps, {
      tenantId: input.tenantId,
      outletId: input.outletId,
      order,
      items,
      stationsById,
      tableNumber: table?.tableNumber ?? null,
      tokenNumber: session.tokenNumber,
    });
  }

  return { order, items, auto86MenuItemIds };
}

/**
 * Captain Approval: transitions a `PENDING_APPROVAL` order to `CONFIRMED` and dispatches to KDS.
 */
export async function approveOrder(
  deps: {
    floor: FloorRepository;
    menu: MenuRepository;
    sessionOrder: SessionOrderRepository;
    realtime: RealtimePort;
    print?: PrintPort;
  },
  input: {
    tenantId: string;
    outletId: string;
    sessionId: string;
    orderId: string;
    approvedByUserId: string;
  },
): Promise<OrderRecord> {
  const [session, orders, allItems, stations] = await Promise.all([
    deps.sessionOrder.findSessionById(input.tenantId, input.sessionId),
    deps.sessionOrder.listOrdersBySession(input.tenantId, input.sessionId),
    deps.sessionOrder.listOrderItemsBySession(input.tenantId, input.sessionId),
    deps.menu.listStations(input.tenantId, input.outletId),
  ]);

  if (!session) throw new NotFoundError('Table session not found');
  const order = orders.find((o) => o.id === input.orderId);
  if (!order) throw new NotFoundError('Order not found', { orderId: input.orderId });
  if (order.status !== 'PENDING_APPROVAL') {
    throw new ConflictError('Order is not awaiting captain approval.');
  }

  const updated = await deps.sessionOrder.updateOrderStatus(
    input.tenantId,
    input.orderId,
    'CONFIRMED',
    input.approvedByUserId,
  );

  const orderItemsForOrder = allItems.filter((i) => i.orderId === order.id);
  const stationsById = new Map(stations.map((s) => [s.id, s]));
  const table = session.tableId
    ? await deps.floor.findTableById(input.tenantId, session.tableId)
    : null;

  await deps.realtime.publishToFloor(
    input.tenantId,
    input.outletId,
    'order.approved',
    { orderId: updated.id, sessionId: session.id },
  );

  const stationIds = Array.from(new Set(orderItemsForOrder.map((i) => i.stationId)));
  for (const stationId of stationIds) {
    await deps.realtime.publishToStation(
      input.tenantId,
      input.outletId,
      stationId,
      'order.approved',
      { orderId: updated.id, orderNumber: updated.orderNumber },
    );
  }

  await fireStationKots(deps, {
    tenantId: input.tenantId,
    outletId: input.outletId,
    order: updated,
    items: orderItemsForOrder,
    stationsById,
    tableNumber: table?.tableNumber ?? null,
    tokenNumber: session.tokenNumber,
  });

  return updated;
}

/**
 * Transitions a KDS item through the kitchen lifecycle (FR-015).
 */
export async function transitionKdsItemStatus(
  deps: {
    sessionOrder: SessionOrderRepository;
    realtime: RealtimePort;
    audit: AuditRepository;
  },
  input: {
    tenantId: string;
    outletId: string;
    itemId: string;
    nextStatus: KdsStatus;
    managerPinVerified?: boolean;
    actorUserId?: string | null;
  },
): Promise<OrderItemRecord> {
  const queue = await deps.sessionOrder.listKdsQueue(input.tenantId, input.outletId);
  const target = queue.find((q) => q.id === input.itemId);
  if (!target) {
    throw new NotFoundError('Order item not found in KDS queue', { itemId: input.itemId });
  }

  validateKdsTransition(
    target.kdsStatus,
    input.nextStatus,
    input.managerPinVerified,
  );

  const now = new Date();
  const timestamps: Partial<Pick<OrderItemRecord, 'startedAt' | 'readyAt' | 'servedAt'>> = {};
  if (input.nextStatus === 'PREPARING' && !target.startedAt) {
    timestamps.startedAt = now;
  } else if (input.nextStatus === 'READY') {
    timestamps.readyAt = now;
  } else if (input.nextStatus === 'SERVED') {
    timestamps.servedAt = now;
  }

  const updated = await deps.sessionOrder.updateOrderItemKdsStatus(
    input.tenantId,
    input.itemId,
    input.nextStatus,
    timestamps,
  );

  if (input.nextStatus === 'CANCELLED') {
    await writeAuditLog(deps.audit, {
      tenantId: input.tenantId,
      outletId: input.outletId,
      actorUserId: input.actorUserId ?? null,
      action: 'ORDER_ITEM_VOIDED',
      entityType: 'order_items',
      entityId: input.itemId,
      beforeState: { kdsStatus: target.kdsStatus },
      afterState: { kdsStatus: 'CANCELLED' },
    });
  }

  await deps.realtime.publishToStation(
    input.tenantId,
    input.outletId,
    target.stationId,
    'kds.updated',
    { itemId: updated.id, kdsStatus: updated.kdsStatus, orderId: updated.orderId },
  );

  await deps.realtime.publishToFloor(
    input.tenantId,
    input.outletId,
    'kds.updated',
    { itemId: updated.id, kdsStatus: updated.kdsStatus, orderId: updated.orderId },
  );

  return updated;
}

/**
 * Recalls the most recently bumped KDS ticket/item back to active prep (FR-015).
 */
export async function recallLastBumpedTicket(
  deps: {
    sessionOrder: SessionOrderRepository;
    realtime: RealtimePort;
  },
  input: {
    tenantId: string;
    outletId: string;
    orderId?: string;
    stationId?: string;
  },
): Promise<OrderItemRecord[]> {
  const queue = await deps.sessionOrder.listKdsQueue(
    input.tenantId,
    input.outletId,
    input.stationId,
  );

  const candidates = queue
    .filter((item) => {
      if (input.orderId && item.orderId !== input.orderId) return false;
      return item.kdsStatus === 'READY' || item.kdsStatus === 'SERVED';
    })
    .sort((a, b) => {
      const aTime = (a.servedAt ?? a.readyAt ?? a.createdAt).getTime();
      const bTime = (b.servedAt ?? b.readyAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

  if (candidates.length === 0) {
    throw new NotFoundError('No recently bumped tickets available to recall.');
  }

  const targetOrderId = candidates[0]!.orderId;
  const toRecall = candidates.filter((c) => c.orderId === targetOrderId);
  const recalled: OrderItemRecord[] = [];

  for (const item of toRecall) {
    const restoredStatus: KdsStatus =
      item.kdsStatus === 'SERVED' ? 'READY' : 'PREPARING';
    const updated = await deps.sessionOrder.updateOrderItemKdsStatus(
      input.tenantId,
      item.id,
      restoredStatus,
    );
    recalled.push(updated);

    await deps.realtime.publishToStation(
      input.tenantId,
      input.outletId,
      item.stationId,
      'kds.updated',
      { itemId: updated.id, kdsStatus: updated.kdsStatus, recalled: true },
    );
  }

  return recalled;
}
