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
    const { tenant, outlet } = await resolveTenantAndOutlet(outletParam);
    const { repos } = getContainer();

    const taxSlabs = await repos.menu.listTaxSlabs(tenant.id, outlet.id);
    return apiOk({ outletId: outlet.id, taxSlabs });
  } catch (err) {
    return apiError(err);
  }
}
