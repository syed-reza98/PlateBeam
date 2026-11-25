import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { toggleItem86 } from '@/server/core';
import {
  menuItemAvailabilitySchema,
  menuItemCreateSchema,
} from '@/lib/schemas';
import { z } from 'zod';

const menuPatchSchema = z.object({
  itemId: z.string().uuid(),
  isAvailable: z.boolean(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const outletParam = url.searchParams.get('outletId') ?? undefined;
    const { tenant, outlet } = await resolveTenantAndOutlet(outletParam);
    const { repos } = getContainer();

    const [categories, items, modifiers, stations, taxSlabs] = await Promise.all([
      repos.menu.listCategories(tenant.id, outlet.id),
      repos.menu.listMenuItems(tenant.id, outlet.id),
      repos.menu.listModifiersByOutlet(tenant.id, outlet.id),
      repos.menu.listStations(tenant.id, outlet.id),
      repos.menu.listTaxSlabs(tenant.id, outlet.id),
    ]);

    return apiOk({
      outletId: outlet.id,
      categories,
      items,
      modifiers,
      stations,
      taxSlabs,
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, menuItemCreateSchema);
    const { tenant } = await resolveTenantAndOutlet(body.outletId);
    const { repos, realtime } = getContainer();

    const item = await repos.menu.upsertMenuItem({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      outletId: body.outletId,
      categoryId: body.categoryId,
      stationId: body.stationId,
      taxSlabId: body.taxSlabId,
      name: body.name,
      description: body.description ?? null,
      basePriceMinor: body.basePriceMinor,
      dietaryType: body.dietaryType,
      allergens: body.allergens,
      spiceLevels: body.spiceLevels,
      prepTimeMins: body.prepTimeMins,
      imageUrl: body.imageUrl ?? null,
      isAvailable: body.isAvailable,
    });

    await realtime.publishToMenu(tenant.id, body.outletId, 'menu.updated', {
      item,
    });

    return apiOk({ item }, 201);
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await parseJsonBody(req, menuPatchSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet();
    const { repos, realtime } = getContainer();

    const item = await toggleItem86(
      { menu: repos.menu, realtime, audit: repos.audit },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        menuItemId: body.itemId,
        isAvailable: body.isAvailable,
      },
    );

    return apiOk({ item });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await parseJsonBody(
      req,
      z.object({ itemId: z.string().uuid() }).merge(menuItemAvailabilitySchema.partial()),
    );
    const { tenant, outlet } = await resolveTenantAndOutlet();
    const { repos, realtime } = getContainer();

    const item = await toggleItem86(
      { menu: repos.menu, realtime, audit: repos.audit },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        menuItemId: body.itemId,
        isAvailable: false,
      },
    );

    return apiOk({ archived: true, item });
  } catch (err) {
    return apiError(err);
  }
}
