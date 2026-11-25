import { z } from 'zod';
import { getContainer } from '@/server/container';
import { apiError, apiOk, parseJsonBody } from '@/server/api/http';

const createTenantSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100),
  plan: z.enum(['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE']).default('GROWTH'),
  currencyCode: z.string().min(3).max(8).default('BDT'),
  outletName: z.string().min(2).max(200).default('Main Flagship'),
});

export async function GET() {
  try {
    const { repos } = getContainer();
    const tenants = await repos.tenantOutlet.listTenants();

    const enriched = await Promise.all(
      tenants.map(async (t) => {
        const outlets = await repos.tenantOutlet.listOutlets(t.id);
        let activeTablesCount = 0;
        for (const outlet of outlets) {
          const tables = await repos.floor.listTables(t.id, outlet.id);
          activeTablesCount += tables.filter((tb) => tb.status !== 'VACANT').length;
        }
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          plan: t.subscriptionPlan,
          status: t.status,
          currencyCode: t.currencyCode,
          outletCount: outlets.length,
          activeTablesCount,
          monthlyGmvMinor: 0,
          createdAt: t.createdAt.toISOString(),
        };
      }),
    );

    return apiOk({ tenants: enriched });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, createTenantSchema);
    const { repos } = getContainer();

    const tenant = await repos.tenantOutlet.createTenant({
      id: crypto.randomUUID(),
      name: body.name,
      slug: body.slug,
      subscriptionPlan: body.plan,
      status: 'ACTIVE',
      currencyCode: body.currencyCode,
    });

    const outlet = await repos.tenantOutlet.createOutlet({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      name: body.outletName ?? 'Main Flagship',
      subdomain: body.slug,
      timezone: 'Asia/Dhaka',
      qrSecurityPolicy: {},
    });

    return apiOk(
      {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.subscriptionPlan,
          status: tenant.status,
          currencyCode: tenant.currencyCode,
          outletCount: 1,
          activeTablesCount: 0,
          monthlyGmvMinor: 0,
          createdAt: tenant.createdAt.toISOString(),
        },
        outlet,
      },
      201,
    );
  } catch (err) {
    return apiError(err);
  }
}
