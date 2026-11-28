import { revalidateTag } from 'next/cache';
import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { toggleItem86 } from '@/server/core';
import { menuItemAvailabilitySchema } from '@/lib/schemas';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const body = await parseJsonBody(req, menuItemAvailabilitySchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime } = getContainer();

    const item = await toggleItem86(
      { menu: repos.menu, realtime, audit: repos.audit },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        menuItemId: itemId,
        isAvailable: body.isAvailable,
      },
    );

    revalidateTag('menu-catalog', 'max');
    revalidateTag('analytics-live', 'max');

    return apiOk({ item });
  } catch (err) {
    return apiError(err);
  }
}
