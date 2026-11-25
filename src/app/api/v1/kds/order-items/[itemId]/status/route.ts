import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { transitionKdsItemStatus } from '@/server/core';
import { ForbiddenError } from '@/server/core/errors';
import { kdsItemStatusPatchSchema } from '@/lib/schemas';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const body = await parseJsonBody(req, kdsItemStatusPatchSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime, auth } = getContainer();

    const claims = await auth.getSessionClaims(req).catch(() => null);
    let managerPinVerified = false;
    if (body.managerPin) {
      const pinClaims = await auth.verifyPosPin({
        tenantId: tenant.id,
        outletId: outlet.id,
        pin: body.managerPin,
      });
      if (!pinClaims) {
        throw new ForbiddenError('Invalid manager PIN for void/cancel');
      }
      managerPinVerified = true;
    }

    const updated = await transitionKdsItemStatus(
      {
        sessionOrder: repos.sessionOrder,
        realtime,
        audit: repos.audit,
      },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        itemId,
        nextStatus: body.status,
        managerPinVerified,
        actorUserId: claims?.userId ?? null,
      },
    );

    return apiOk({ item: updated });
  } catch (err) {
    return apiError(err);
  }
}
