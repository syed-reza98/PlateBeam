import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { inventoryAdjustSchema } from '@/lib/schemas';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const outletParam = url.searchParams.get('outletId') ?? undefined;
    const { tenant, outlet } = await resolveTenantAndOutlet(outletParam);
    const { repos } = getContainer();

    const [items, menuItems] = await Promise.all([
      repos.inventory.listInventoryItems(tenant.id, outlet.id),
      repos.menu.listMenuItems(tenant.id, outlet.id),
    ]);

    const recipes = await repos.inventory.listRecipesForMenuItems(
      tenant.id,
      menuItems.map((m) => m.id),
    );

    return apiOk({
      outletId: outlet.id,
      items,
      recipes,
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, inventoryAdjustSchema);
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos } = getContainer();

    const updated = await repos.inventory.restockItem(
      tenant.id,
      body.inventoryItemId,
      body.deltaQty,
    );

    return apiOk({ item: updated });
  } catch (err) {
    return apiError(err);
  }
}

export const PATCH = POST;
