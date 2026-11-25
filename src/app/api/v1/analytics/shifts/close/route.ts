import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { closeShiftWithZReport } from '@/server/core';
import { closeShiftSchema } from '@/lib/schemas';

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, closeShiftSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet();
    const { repos, auth } = getContainer();
    const claims = await auth.getSessionClaims(req).catch(() => null);
    const users = await repos.rbac.listUsersByOutlet(tenant.id, outlet.id);
    const actorUserId = claims?.userId ?? users[0]?.id ?? crypto.randomUUID();

    const zReport = await closeShiftWithZReport(
      { shift: repos.shift, audit: repos.audit },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        shiftId: body.shiftId,
        closedByUserId: actorUserId,
        actualCashMinor: body.actualCashMinor,
        pettyCashMinor: body.pettyCashMinor ?? 0,
        paymentsInShift: [],
        notes: body.notes,
      },
    );

    return apiOk({ zReport });
  } catch (err) {
    return apiError(err);
  }
}
