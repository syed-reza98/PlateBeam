import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  resolveTenantAndOutlet,
} from '@/server/api/http';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const outletParam = url.searchParams.get('outletId') ?? undefined;
    const limitParam = Number(url.searchParams.get('limit') ?? '50');
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

    const { tenant, outlet } = await resolveTenantAndOutlet(outletParam);
    const { repos } = getContainer();

    const logs = await repos.audit.listLogs(tenant.id, outlet.id, limit);
    return apiOk({
      tenantId: tenant.id,
      outletId: outlet.id,
      logs,
    });
  } catch (err) {
    return apiError(err);
  }
}
