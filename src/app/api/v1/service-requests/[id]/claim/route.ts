import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { claimServiceRequestSchema } from '@/lib/schemas';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await parseJsonBody(req, claimServiceRequestSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, auth, realtime } = getContainer();

    const claims = await auth.getSessionClaims(req).catch(() => null);
    const resolvedAt = body.status === 'RESOLVED' ? new Date() : null;

    const updated = await repos.serviceRequest.updateRequestStatus(
      tenant.id,
      id,
      body.status,
      claims?.userId ?? null,
      resolvedAt,
    );

    await realtime.publishToFloor(tenant.id, outlet.id, 'waiter.claimed', {
      request: updated,
    });
    if (updated.sessionId) {
      await realtime.publishToTableSession(tenant.id, updated.sessionId, 'waiter.claimed', {
        request: updated,
      });
    }

    return apiOk({ request: updated });
  } catch (err) {
    return apiError(err);
  }
}
