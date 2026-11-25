import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  resolveTenantAndOutlet,
} from '@/server/api/http';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ outletSlug: string }> },
) {
  try {
    const { outletSlug } = await params;
    const { tenant, outlet } = await resolveTenantAndOutlet(outletSlug);
    const { repos } = getContainer();

    const [zones, tables, serviceRequests, users, roles, menuItems, shifts] =
      await Promise.all([
        repos.floor.listZones(tenant.id, outlet.id),
        repos.floor.listTables(tenant.id, outlet.id),
        repos.serviceRequest.listOpenRequests(tenant.id, outlet.id),
        repos.rbac.listUsersByOutlet(tenant.id, outlet.id),
        repos.rbac.listRoles(tenant.id),
        repos.menu.listMenuItems(tenant.id, outlet.id),
        repos.shift.listShifts(tenant.id, outlet.id),
      ]);

    const roleById = new Map(roles.map((r) => [r.id, r]));
    const tableById = new Map(tables.map((t) => [t.id, t]));
    const userById = new Map(users.map((u) => [u.id, u]));

    const pendingOrders: Array<{
      id: string;
      orderNumber: string;
      tableId: string | null;
      tableNumber: string;
      source: string;
      status: string;
      totalMinor: number;
      createdAt: string;
      items: Array<{
        id: string;
        name: string;
        quantity: number;
        modifiers: string[];
        notes: string | null;
      }>;
    }> = [];

    const tableTotals = new Map<string, number>();

    for (const table of tables) {
      if (!table.activeSessionId) continue;
      const [session, orders, items] = await Promise.all([
        repos.sessionOrder.findSessionById(tenant.id, table.activeSessionId),
        repos.sessionOrder.listOrdersBySession(tenant.id, table.activeSessionId),
        repos.sessionOrder.listOrderItemsBySession(tenant.id, table.activeSessionId),
      ]);
      if (session) {
        tableTotals.set(table.id, session.totalMinor);
      }
      for (const order of orders) {
        if (order.status === 'PENDING_APPROVAL') {
          const orderItems = items.filter((i) => i.orderId === order.id);
          pendingOrders.push({
            id: order.id,
            orderNumber: order.orderNumber,
            tableId: table.id,
            tableNumber: table.tableNumber,
            source: order.source,
            status: order.status,
            totalMinor: orderItems.reduce(
              (acc, i) => acc + i.unitPriceMinor * i.quantity + i.taxMinor,
              0,
            ),
            createdAt: order.createdAt.toISOString(),
            items: orderItems.map((i) => ({
              id: i.id,
              name: i.itemNameSnapshot,
              quantity: i.quantity,
              modifiers: (i.modifiersSnapshot ?? []).map((m) => m.optionName),
              notes: i.notes,
            })),
          });
        }
      }
    }

    return apiOk({
      outletId: outlet.id,
      outletName: outlet.name,
      currency: tenant.currencyCode,
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        sortOrder: z.displayOrder,
      })),
      tables: tables.map((t) => ({
        id: t.id,
        zoneId: t.zoneId,
        tableNumber: t.tableNumber,
        capacity: t.capacity,
        status: t.status,
        activeSessionId: t.activeSessionId,
        posX: t.posX,
        posY: t.posY,
        qrToken: t.qrToken,
        runningTotalMinor: tableTotals.get(t.id) ?? 0,
      })),
      serviceRequests: serviceRequests.map((sr) => ({
        id: sr.id,
        tableId: sr.tableId,
        tableNumber: tableById.get(sr.tableId)?.tableNumber ?? 'Table',
        requestType: sr.requestType,
        status: sr.status,
        note: sr.note,
        createdAt: sr.createdAt.toISOString(),
        claimedByName: sr.assignedUserId
          ? userById.get(sr.assignedUserId)?.fullName ?? null
          : null,
      })),
      pendingOrders,
      staff: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        roleName: roleById.get(u.roleId)?.name ?? 'STAFF',
        isActive: u.isActive,
        outletId: u.outletId,
      })),
      menuItems: menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        basePriceMinor: m.basePriceMinor,
        isAvailable: m.isAvailable,
      })),
      activeShift: shifts.find((s) => s.status === 'OPEN') ?? null,
    });
  } catch (err) {
    return apiError(err);
  }
}
