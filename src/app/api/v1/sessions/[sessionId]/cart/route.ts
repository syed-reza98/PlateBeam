import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { NotFoundError } from '@/server/core/errors';
import { sharedCartSyncSchema } from '@/lib/schemas';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await parseJsonBody(req, sharedCartSyncSchema);
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime } = getContainer();

    const session = await repos.sessionOrder.findSessionById(tenant.id, sessionId);
    if (!session) {
      throw new NotFoundError('Table session not found', { sessionId });
    }

    const [menuItems, modifiers] = await Promise.all([
      repos.menu.listMenuItems(tenant.id, session.outletId),
      repos.menu.listModifiersByOutlet(tenant.id, session.outletId),
    ]);
    const itemById = new Map(menuItems.map((m) => [m.id, m]));
    const modById = new Map(modifiers.map((m) => [m.id, m]));

    const cartItems = body.items.map((item) => {
      const menu = itemById.get(item.menuItemId);
      const modifierIds = item.modifierIds ?? [];
      const mods = modifierIds
        .map((id) => modById.get(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m));
      const modDelta = mods.reduce((sum, m) => sum + m.priceDeltaMinor, 0);
      return {
        cartItemId: `${item.menuItemId}:${modifierIds.join(',')}:${item.spiceLevel ?? ''}`,
        menuItemId: item.menuItemId,
        name: menu?.name ?? 'Menu Item',
        unitPriceMinor: (menu?.basePriceMinor ?? 0) + modDelta,
        quantity: item.quantity,
        modifierIds,
        modifierLabels: mods.map((m) => m.optionName),
        spiceLevel: item.spiceLevel,
        notes: item.notes,
        addedByNickname: body.guestNickname,
      };
    });

    await realtime.publishToTableSession(tenant.id, sessionId, 'cart.synced', {
      sessionId,
      guestNickname: body.guestNickname,
      items: cartItems,
    });

    return apiOk({ sessionId, items: cartItems });
  } catch (err) {
    return apiError(err);
  }
}
