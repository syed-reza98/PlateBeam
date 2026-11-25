import { z } from 'zod';
import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { approveOrder } from '@/server/core';
import { NotFoundError } from '@/server/core/errors';

const approveBodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  approvedByUserId: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    const body = await parseJsonBody(req, approveBodySchema).catch(() => ({
      sessionId: undefined,
      approvedByUserId: undefined,
    }));
    const { tenant, outlet } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime, print, auth } = getContainer();
    const claims = await auth.getSessionClaims(req).catch(() => null);

    let sessionId = body.sessionId;
    if (!sessionId) {
      const tables = await repos.floor.listTables(tenant.id, outlet.id);
      for (const t of tables) {
        if (!t.activeSessionId) continue;
        const orders = await repos.sessionOrder.listOrdersBySession(
          tenant.id,
          t.activeSessionId,
        );
        if (orders.some((o) => o.id === orderId)) {
          sessionId = t.activeSessionId;
          break;
        }
      }
    }

    if (!sessionId) {
      throw new NotFoundError('Order or active session not found', { orderId });
    }

    const order = await approveOrder(
      {
        floor: repos.floor,
        menu: repos.menu,
        sessionOrder: repos.sessionOrder,
        realtime,
        print,
      },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        sessionId,
        orderId,
        approvedByUserId: body.approvedByUserId ?? claims?.userId ?? 'staff',
      },
    );

    return apiOk({ order });
  } catch (err) {
    return apiError(err);
  }
}
