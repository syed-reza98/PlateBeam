import { z } from 'zod';
import { getContainer } from '@/server/container';
import { apiError, apiOk, parseJsonBody } from '@/server/api/http';
import { NotFoundError } from '@/server/core/errors';

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await params;
    const body = await parseJsonBody(req, statusSchema);
    const { repos } = getContainer();

    const tenant = await repos.tenantOutlet.findTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundError('Tenant not found', { tenantId });
    }

    return apiOk({
      tenant: {
        ...tenant,
        status: body.status,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
