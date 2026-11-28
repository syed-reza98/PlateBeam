import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { formatKotPreviewLines } from '@/server/core';
import { NotFoundError } from '@/server/core/errors';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ outletSlug: string; orderId: string }> },
) {
  try {
    const { outletSlug, orderId } = await params;
    const { tenant, outlet } = await resolveTenantAndOutlet(outletSlug);
    const { repos } = getContainer();

    const [queue, stations, tables] = await Promise.all([
      repos.sessionOrder.listKdsQueue(tenant.id, outlet.id),
      repos.menu.listStations(tenant.id, outlet.id),
      repos.floor.listTables(tenant.id, outlet.id),
    ]);

    const orderRows = queue.filter((row) => row.orderId === orderId);
    if (orderRows.length === 0) {
      throw new NotFoundError('KDS ticket not found', { orderId });
    }

    const first = orderRows[0]!;
    const stationById = new Map(stations.map((s) => [s.id, s]));
    const tableById = new Map(tables.map((t) => [t.id, t]));
    const tableNumber = first.tableId ? tableById.get(first.tableId)?.tableNumber ?? null : null;

    const stationNames = Array.from(
      new Set(orderRows.map((r) => stationById.get(r.stationId)?.name ?? 'Kitchen')),
    );
    const stationName = stationNames.length === 1 ? stationNames[0] : 'MULTI-STATION';

    const items = orderRows.map((row) => ({
      name: row.itemNameSnapshot,
      quantity: row.quantity,
      modifiers: (row.modifiersSnapshot ?? []).map((m) => m.optionName),
      spiceLevel: row.spiceLevel,
      notes: row.notes,
    }));

    const lines = formatKotPreviewLines({
      paperWidthMm: 80,
      headerTitle: outlet.name,
      stationName,
      orderNumber: first.orderNumber,
      tableNumber,
      tokenNumber: first.tokenNumber,
      items,
      createdAt: first.createdAt,
    });

    return apiOk({
      orderId,
      orderNumber: first.orderNumber,
      stationName,
      tableNumber,
      tokenNumber: first.tokenNumber,
      paperWidthMm: 80,
      lines,
      text: lines.join('\n'),
    });
  } catch (err) {
    return apiError(err);
  }
}
