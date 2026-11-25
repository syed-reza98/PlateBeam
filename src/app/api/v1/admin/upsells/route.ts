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

    const upsellRules = await repos.menu.listUpsellRules(tenant.id, outlet.id);
    return apiOk({ outletId: outlet.id, upsellRules });
  } catch (err) {
    return apiError(err);
  }
}
