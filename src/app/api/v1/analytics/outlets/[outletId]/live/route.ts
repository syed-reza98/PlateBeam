import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { computeOwnerKpis } from '@/server/core';
import type {
  OrderItemRecord,
  OrderRecord,
  PaymentRecord,
  TableSessionRecord,
} from '@/server/ports/repositories.port';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ outletId: string }> },
) {
  try {
    const { outletId: rawOutletId } = await params;
    const { tenant, outlet } = await resolveTenantAndOutlet(rawOutletId);
    const { repos } = getContainer();

    const [
      tables,
      categories,
      stations,
      menuItems,
      taxSlabs,
      upsellRules,
      inventory,
      users,
      roles,
      auditLogs,
    ] = await Promise.all([
      repos.floor.listTables(tenant.id, outlet.id),
      repos.menu.listCategories(tenant.id, outlet.id),
      repos.menu.listStations(tenant.id, outlet.id),
      repos.menu.listMenuItems(tenant.id, outlet.id),
      repos.menu.listTaxSlabs(tenant.id, outlet.id),
      repos.menu.listUpsellRules(tenant.id, outlet.id),
      repos.inventory.listInventoryItems(tenant.id, outlet.id),
      repos.rbac.listUsersByOutlet(tenant.id, outlet.id),
      repos.rbac.listRoles(tenant.id),
      repos.audit.listLogs(tenant.id, outlet.id, 50),
    ]);

    const activeSessions: TableSessionRecord[] = [];
    const activeOrders: OrderRecord[] = [];
    const activeOrderItems: OrderItemRecord[] = [];
    const activePayments: PaymentRecord[] = [];

    for (const table of tables) {
      if (!table.activeSessionId) continue;
      const [session, orders, items, payments] = await Promise.all([
        repos.sessionOrder.findSessionById(tenant.id, table.activeSessionId),
        repos.sessionOrder.listOrdersBySession(tenant.id, table.activeSessionId),
        repos.sessionOrder.listOrderItemsBySession(tenant.id, table.activeSessionId),
        repos.billing.listPaymentsBySession(tenant.id, table.activeSessionId),
      ]);
      if (session) activeSessions.push(session);
      activeOrders.push(...orders);
      activeOrderItems.push(...items);
      activePayments.push(...payments);
    }

    const kpis = computeOwnerKpis({
      tables,
      orders: activeOrders,
      orderItems: activeOrderItems,
      sessions: activeSessions,
      payments: activePayments,
    });

    const catById = new Map(categories.map((c) => [c.id, c]));
    const stationById = new Map(stations.map((s) => [s.id, s]));
    const roleById = new Map(roles.map((r) => [r.id, r]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const itemById = new Map(menuItems.map((m) => [m.id, m]));

    const overrideLists = await Promise.all(
      users.map((u) => repos.rbac.listUserOverrides(tenant.id, u.id)),
    );
    const overrides = overrideLists.flat();

    const unitsSoldMap = new Map<string, number>();
    for (const item of activeOrderItems) {
      if (item.kdsStatus === 'CANCELLED') continue;
      unitsSoldMap.set(
        item.menuItemId,
        (unitsSoldMap.get(item.menuItemId) ?? 0) + item.quantity,
      );
    }

    const totalPaid = activePayments
      .filter((p) => p.status === 'CAPTURED')
      .reduce((acc, p) => acc + p.amountMinor, 0);

    return apiOk({
      outletId: outlet.id,
      outletName: outlet.name,
      currencyCode: tenant.currencyCode,
      kpis: {
        occupiedTables: kpis.occupiedTables,
        totalTables: kpis.totalTables,
        liveOrdersCount: kpis.liveOrderCount,
        netSalesMinor: kpis.netSalesMinor,
        aovMinor: kpis.averageOrderValueMinor,
        avgTurnoverMinutes: kpis.avgTableTurnoverMins,
        kdsSlaOnTimePct: Math.max(0, Math.min(100, Math.round(100 - kpis.kdsAvgPrepMins))),
        paymentMix: Object.entries(kpis.paymentMix).map(([method, amountMinor]) => ({
          method,
          amountMinor,
          pct: totalPaid > 0 ? Math.round((amountMinor / totalPaid) * 100) : 0,
        })),
      },
      menuItems: menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        categoryName: catById.get(m.categoryId)?.name ?? 'Menu',
        stationName: stationById.get(m.stationId)?.name ?? 'Kitchen',
        basePriceMinor: m.basePriceMinor,
        costMinor: Math.round(m.basePriceMinor * 0.35),
        dietaryType: m.dietaryType,
        isAvailable: m.isAvailable,
        unitsSold30d: unitsSoldMap.get(m.id) ?? 0,
      })),
      inventory: inventory.map((inv) => ({
        id: inv.id,
        name: inv.name,
        sku: inv.sku,
        unit: inv.unit,
        currentStock: Number(inv.currentQty),
        reorderLevel: Number(inv.reorderLevel),
        linkedMenuItems: [],
      })),
      staff: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        roleName: roleById.get(u.roleId)?.name ?? 'STAFF',
        isActive: u.isActive,
        outletId: u.outletId,
      })),
      overrides: overrides.map((ov) => ({
        id: ov.id,
        userId: ov.userId,
        permissionKey: ov.permissionKey,
        effect: ov.effect,
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        actorName: log.actorUserId
          ? userById.get(log.actorUserId)?.fullName ?? 'System'
          : 'System',
        action: log.action,
        targetType: log.entityType,
        targetId: log.entityId,
        details: JSON.stringify(log.afterState ?? log.beforeState ?? {}),
        createdAt: log.createdAt.toISOString(),
      })),
      taxSlabs: taxSlabs.map((ts) => ({
        id: ts.id,
        name: ts.name,
        isInclusive: ts.isInclusive,
        components: ts.components,
        isActive: true,
      })),
      upsellRules: upsellRules.map((ur) => ({
        id: ur.id,
        triggerItemName: ur.triggerItemId
          ? itemById.get(ur.triggerItemId)?.name ?? 'Any Item'
          : catById.get(ur.triggerCategoryId ?? '')?.name ?? 'Category',
        suggestedItemName: itemById.get(ur.suggestedItemId)?.name ?? 'Suggested Item',
        pitchText: ur.promoPriceMinor
          ? `Special pairing price ${ur.promoPriceMinor}`
          : 'Recommended by Chef',
        isActive: true,
      })),
      qrSecurityPolicy: outlet.qrSecurityPolicy,
    });
  } catch (err) {
    return apiError(err);
  }
}
