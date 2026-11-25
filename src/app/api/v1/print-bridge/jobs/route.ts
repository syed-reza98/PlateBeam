import { z } from 'zod';
import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';

const ackSchema = z.object({
  tenantId: z.string().uuid().optional(),
  jobId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const outletParam = url.searchParams.get('outletId') ?? undefined;
    const stationId = url.searchParams.get('stationId') ?? undefined;
    const { tenant, outlet } = await resolveTenantAndOutlet(outletParam);

    const jobs = await getContainer().print.listPendingJobs({
      tenantId: tenant.id,
      outletId: outlet.id,
      stationId,
    });

    return apiOk({
      tenantId: tenant.id,
      outletId: outlet.id,
      jobs,
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, ackSchema);
    const { tenant } = await resolveTenantAndOutlet(undefined, body.tenantId);
    await getContainer().print.acknowledgeJob({
      tenantId: tenant.id,
      jobId: body.jobId,
    });
    return apiOk({ acknowledged: true, jobId: body.jobId });
  } catch (err) {
    return apiError(err);
  }
}
