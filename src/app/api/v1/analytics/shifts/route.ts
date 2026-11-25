import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { ConflictError } from '@/server/core/errors';
import { openShiftSchema } from '@/lib/schemas';

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, openShiftSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(body.outletId);
    const { repos, auth } = getContainer();
    const claims = await auth.getSessionClaims(req).catch(() => null);
    const users = await repos.rbac.listUsersByOutlet(tenant.id, outlet.id);
    const actorUserId = claims?.userId ?? users[0]?.id ?? crypto.randomUUID();

    const existing = await repos.shift.findOpenShift(tenant.id, outlet.id);
    if (existing) {
      throw new ConflictError('An open shift register already exists', {
        shiftId: existing.id,
      });
    }

    const shift = await repos.shift.openShift({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      outletId: outlet.id,
      openedByUserId: actorUserId,
      status: 'OPEN',
      openingFloatMinor: body.openingFloatMinor,
      notes: body.notes ?? null,
    });

    return apiOk({ shift }, 201);
  } catch (err) {
    return apiError(err);
  }
}
