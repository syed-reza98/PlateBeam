import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { placeOrder } from '@/server/core';
import { NotFoundError } from '@/server/core/errors';
import { placeOrderSchema } from '@/lib/schemas';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos } = getContainer();

    const session = await repos.sessionOrder.findSessionById(tenant.id, sessionId);
    if (!session) {
      throw new NotFoundError('Session not found', { sessionId });
    }

    const [orders, items] = await Promise.all([
      repos.sessionOrder.listOrdersBySession(tenant.id, sessionId),
      repos.sessionOrder.listOrderItemsBySession(tenant.id, sessionId),
    ]);

    return apiOk({ session, orders, items });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await parseJsonBody(req, placeOrderSchema);
    const { repos, realtime, print, auth } = getContainer();
    const { tenant, outlet } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );

    const claims = await auth.getSessionClaims(req).catch(() => null);
    let targetSessionId = sessionId;

    // Support `/api/v1/sessions/counter/orders` for Pay-First Counter Takeaway
    if (sessionId === 'counter') {
      const counterSession = await repos.sessionOrder.createSession({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        outletId: outlet.id,
        tableId: null,
        sessionType: 'TAKEAWAY',
        status: 'OPEN',
        subtotalMinor: 0,
        taxMinor: 0,
        discountMinor: 0,
        serviceChargeMinor: 0,
        tipMinor: 0,
        totalMinor: 0,
      });
      targetSessionId = counterSession.id;
    } else {
      const existing = await repos.sessionOrder.findSessionById(tenant.id, sessionId);
      if (!existing) {
        throw new NotFoundError('Table session not found', { sessionId });
      }
    }

    const result = await placeOrder(
      {
        tenantOutlet: repos.tenantOutlet,
        floor: repos.floor,
        menu: repos.menu,
        sessionOrder: repos.sessionOrder,
        inventory: repos.inventory,
        realtime,
        print,
      },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        sessionId: targetSessionId,
        source: body.source ?? 'QR',
        guestId: body.guestId ?? null,
        actorUserId: claims?.userId ?? null,
        autoApprove: (body.source ?? 'QR') !== 'QR',
        items: body.items.map((i) => ({
          ...i,
          modifierIds: i.modifierIds ?? [],
        })),
      },
    );

    const updatedSession = await repos.sessionOrder.findSessionById(
      tenant.id,
      targetSessionId,
    );

    return apiOk(
      {
        sessionId: targetSessionId,
        order: result.order,
        items: result.items,
        session: updatedSession,
        auto86MenuItemIds: result.auto86MenuItemIds,
      },
      201,
    );
  } catch (err) {
    return apiError(err);
  }
}
