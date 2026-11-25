import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { generateCsvReport } from '@/server/core';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ outletId: string }> },
) {
  try {
    const { outletId: rawOutletId } = await params;
    const { tenant, outlet } = await resolveTenantAndOutlet(rawOutletId);
    const { repos } = getContainer();

    const [menuItems, categories, stations, inventory] = await Promise.all([
      repos.menu.listMenuItems(tenant.id, outlet.id),
      repos.menu.listCategories(tenant.id, outlet.id),
      repos.menu.listStations(tenant.id, outlet.id),
      repos.inventory.listInventoryItems(tenant.id, outlet.id),
    ]);

    const catById = new Map(categories.map((c) => [c.id, c.name]));
    const stationById = new Map(stations.map((s) => [s.id, s.name]));

    const url = new URL(req.url);
    const format = url.searchParams.get('format')?.toLowerCase() ?? 'json';

    if (format === 'csv') {
      const csv = generateCsvReport(
        ['Item ID', 'Name', 'Category', 'Station', 'Dietary', 'Price (Minor)', 'Available'],
        menuItems.map((m) => [
          m.id,
          m.name,
          catById.get(m.categoryId) ?? '',
          stationById.get(m.stationId) ?? '',
          m.dietaryType,
          m.basePriceMinor,
          m.isAvailable,
        ]),
      );

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="platebeam-${outlet.subdomain}-report.csv"`,
        },
      });
    }

    return apiOk({
      outletId: outlet.id,
      outletName: outlet.name,
      currencyCode: tenant.currencyCode,
      generatedAt: new Date().toISOString(),
      menuCatalogCount: menuItems.length,
      inventorySkuCount: inventory.length,
      menuItems: menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        category: catById.get(m.categoryId) ?? '',
        station: stationById.get(m.stationId) ?? '',
        basePriceMinor: m.basePriceMinor,
        isAvailable: m.isAvailable,
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}
