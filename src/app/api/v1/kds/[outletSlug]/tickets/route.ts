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

    const [queue, stations, menuItems, tables] = await Promise.all([
      repos.sessionOrder.listKdsQueue(tenant.id, outlet.id),
      repos.menu.listStations(tenant.id, outlet.id),
      repos.menu.listMenuItems(tenant.id, outlet.id),
      repos.floor.listTables(tenant.id, outlet.id),
    ]);

    const stationById = new Map(stations.map((s) => [s.id, s]));
    const menuById = new Map(menuItems.map((m) => [m.id, m]));
    const tableById = new Map(tables.map((t) => [t.id, t]));

    const grouped = new Map<
      string,
      {
        orderId: string;
        orderNumber: string;
        tableNumber: string | null;
        tokenNumber: number | null;
        source: 'QR' | 'WAITER' | 'COUNTER';
        createdAt: string;
        slaMinutes: number;
        items: Array<{
          id: string;
          orderId: string;
          menuItemId: string;
          name: string;
          quantity: number;
          stationId: string;
          stationName: string;
          status: string;
          modifiers: string[];
          spiceLevel: string | null;
          allergens: string[];
          notes: string | null;
          companionStations: string[];
        }>;
      }
    >();

    for (const row of queue) {
      const station = stationById.get(row.stationId);
      const menu = menuById.get(row.menuItemId);
      const table = row.tableId ? tableById.get(row.tableId) : null;

      let ticket = grouped.get(row.orderId);
      if (!ticket) {
        ticket = {
          orderId: row.orderId,
          orderNumber: row.orderNumber,
          tableNumber: table?.tableNumber ?? null,
          tokenNumber: row.tokenNumber,
          source: row.tokenNumber ? 'COUNTER' : 'QR',
          createdAt: row.createdAt.toISOString(),
          slaMinutes: station?.slaTargetMins ?? 15,
          items: [],
        };
        grouped.set(row.orderId, ticket);
      }

      ticket.items.push({
        id: row.id,
        orderId: row.orderId,
        menuItemId: row.menuItemId,
        name: row.itemNameSnapshot,
        quantity: row.quantity,
        stationId: row.stationId,
        stationName: station?.name ?? 'Kitchen',
        status: row.kdsStatus,
        modifiers: (row.modifiersSnapshot ?? []).map((m) => m.optionName),
        spiceLevel: row.spiceLevel,
        allergens: menu?.allergens ?? [],
        notes: row.notes,
        companionStations: [],
      });
    }

    const tickets = Array.from(grouped.values()).map((t) => {
      const stationNames = Array.from(new Set(t.items.map((i) => i.stationName)));
      return {
        ...t,
        items: t.items.map((i) => ({
          ...i,
          companionStations: stationNames.filter((s) => s !== i.stationName),
        })),
      };
    });

    return apiOk({
      outletId: outlet.id,
      outletName: outlet.name,
      tickets,
    });
  } catch (err) {
    return apiError(err);
  }
}
