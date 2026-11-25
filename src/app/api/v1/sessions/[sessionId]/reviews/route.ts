import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { submitPostMealReview } from '@/server/core';
import { NotFoundError } from '@/server/core/errors';
import { createReviewSchema } from '@/lib/schemas';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await parseJsonBody(req, createReviewSchema);
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime } = getContainer();

    const session = await repos.sessionOrder.findSessionById(tenant.id, sessionId);
    if (!session) {
      throw new NotFoundError('Session not found', { sessionId });
    }

    const result = await submitPostMealReview(
      {
        engagement: repos.engagement,
        audit: repos.audit,
        realtime,
      },
      {
        tenantId: tenant.id,
        outletId: session.outletId,
        sessionId,
        guestId: body.guestId ?? null,
        rating: body.rating,
        comment: body.comment ?? null,
        tags: body.tags,
      },
    );

    return apiOk(result, 201);
  } catch (err) {
    return apiError(err);
  }
}
