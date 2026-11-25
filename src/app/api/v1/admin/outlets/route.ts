import { z } from 'zod';
import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';

const createOutletSchema = z.object({
  tenantId: z.string().uuid().optional(),
  name: z.string().min(2).max(200),
  subdomain: z.string().min(2).max(100),
  address: z.string().max(400).optional(),
  timezone: z.string().default('Asia/Dhaka'),
  taxRegNo: z.string().max(64).optional(),
  wifiSsid: z.string().max(128).optional(),
  wifiPasswordEnc: z.string().max(256).optional(),
});

const patchPolicySchema = z.object({
  outletId: z.string().uuid().optional(),
  qrSecurityPolicy: z.object({
    requireGps: z.boolean().optional(),
    maxDistanceMeters: z.number().positive().optional(),
    requireVenueIp: z.boolean().optional(),
    allowedIpCidrs: z.array(z.string()).optional(),
    captainApprovalRequired: z.boolean().optional(),
    payFirstTakeaway: z.boolean().optional(),
    maxUnpaidOrders: z.number().int().positive().optional(),
    serviceRequestCooldownSecs: z.number().int().nonnegative().optional(),
  }),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tenantIdParam = url.searchParams.get('tenantId') ?? undefined;
    const { tenant } = await resolveTenantAndOutlet(undefined, tenantIdParam);
    const { repos } = getContainer();

    const outlets = await repos.tenantOutlet.listOutlets(tenant.id);
    return apiOk({ tenantId: tenant.id, outlets });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, createOutletSchema);
    const { tenant } = await resolveTenantAndOutlet(undefined, body.tenantId);
    const { repos } = getContainer();

    const outlet = await repos.tenantOutlet.createOutlet({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      name: body.name,
      subdomain: body.subdomain,
      address: body.address ?? null,
      timezone: body.timezone,
      taxRegNo: body.taxRegNo ?? null,
      wifiSsid: body.wifiSsid ?? null,
      wifiPasswordEnc: body.wifiPasswordEnc ?? null,
      qrSecurityPolicy: {},
    });

    return apiOk({ outlet }, 201);
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await parseJsonBody(req, patchPolicySchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(body.outletId);
    const { repos } = getContainer();

    const updated = await repos.tenantOutlet.updateOutletPolicy(
      tenant.id,
      outlet.id,
      {
        ...outlet.qrSecurityPolicy,
        ...body.qrSecurityPolicy,
      },
    );

    return apiOk({ outlet: updated });
  } catch (err) {
    return apiError(err);
  }
}
