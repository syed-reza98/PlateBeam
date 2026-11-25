import { getContainer } from '@/server/container';
import { apiError, apiOk } from '@/server/api/http';

export async function GET() {
  try {
    const container = getContainer();
    let dbConnected = false;
    let tenantCount = 0;
    try {
      const tenants = await container.repos.tenantOutlet.listTenants();
      tenantCount = tenants.length;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    return apiOk({
      status: dbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      dbDialect: container.dbDialect,
      dbConnected,
      tenantCount,
      adapters: {
        auth: container.auth.constructor.name,
        realtime: container.realtime.constructor.name,
        storage: container.storage.constructor.name,
        print: container.print.constructor.name,
        defaultPaymentProvider: container.defaultPaymentProvider,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
