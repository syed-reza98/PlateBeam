import { z } from 'zod';
import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';

const policyUpdateSchema = z.object({
  requireGps: z.boolean().optional(),
  maxDistanceMeters: z.number().positive().optional(),
  requireVenueIp: z.boolean().optional(),
  allowedIpCidrs: z.array(z.string()).optional(),
  captainApprovalRequired: z.boolean().optional(),
  payFirstTakeaway: z.boolean().optional(),
  maxUnpaidOrders: z.number().int().positive().optional(),
  serviceRequestCooldownSecs: z.number().int().nonnegative().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ outletId: string }> },
) {
  try {
    const { outletId } = await params;
    const body = await parseJsonBody(req, policyUpdateSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(outletId);
    const { repos } = getContainer();

    const updated = await repos.tenantOutlet.updateOutletPolicy(
      tenant.id,
      outlet.id,
      {
        ...outlet.qrSecurityPolicy,
        ...body,
      },
    );

    return apiOk({ outlet: updated, qrSecurityPolicy: updated.qrSecurityPolicy });
  } catch (err) {
    return apiError(err);
  }
}
