import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { recallLastBumpedTicket } from '@/server/core';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const { tenant, outlet } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime } = getContainer();

    const recalledItems = await recallLastBumpedTicket(
      {
        sessionOrder: repos.sessionOrder,
        realtime,
      },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        orderId,
      },
    );

    return apiOk({ orderId, recalledItems });
  } catch (err) {
    return apiError(err);
  }
}
