import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { ConflictError, NotFoundError } from '@/server/core/errors';
import { createServiceRequestSchema } from '@/lib/schemas';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await parseJsonBody(req, createServiceRequestSchema);
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime } = getContainer();

    const session = await repos.sessionOrder.findSessionById(tenant.id, sessionId);
    if (!session) {
      throw new NotFoundError('Session not found', { sessionId });
    }

    const outlet = await repos.tenantOutlet.findOutletById(tenant.id, session.outletId);
    const cooldownSecs = outlet?.qrSecurityPolicy?.serviceRequestCooldownSecs ?? 60;
    const since = new Date(Date.now() - cooldownSecs * 1000);

    const recent = await repos.serviceRequest.findRecentRequestForTable(
      tenant.id,
      body.tableId,
      body.requestType,
      since,
    );
    if (recent) {
      throw new ConflictError(
        `Please wait ${cooldownSecs}s before repeating the same request.`,
        { retryAfterSecs: cooldownSecs },
      );
    }

    const request = await repos.serviceRequest.createRequest({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      outletId: session.outletId,
      tableId: body.tableId,
      sessionId,
      requestType: body.requestType,
      status: 'OPEN',
      note: body.note ?? null,
    });

    await repos.floor.updateTableStatus(
      tenant.id,
      body.tableId,
      body.requestType === 'BILL' ? 'BILL_REQUESTED' : 'CALLING_WAITER',
      sessionId,
    );

    await Promise.all([
      realtime.publishToFloor(tenant.id, session.outletId, 'waiter.called', {
        request,
      }),
      realtime.publishToTableSession(tenant.id, sessionId, 'waiter.called', {
        request,
      }),
    ]);

    return apiOk({ request }, 201);
  } catch (err) {
    return apiError(err);
  }
}
