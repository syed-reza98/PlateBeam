import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { submitMiniGameScore } from '@/server/core';
import { NotFoundError } from '@/server/core/errors';
import { miniGameSubmitSchema } from '@/lib/schemas';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await parseJsonBody(req, miniGameSubmitSchema);
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime } = getContainer();

    const session = await repos.sessionOrder.findSessionById(tenant.id, sessionId);
    if (!session) {
      throw new NotFoundError('Session not found', { sessionId });
    }

    const result = await submitMiniGameScore(
      {
        engagement: repos.engagement,
        realtime,
      },
      {
        tenantId: tenant.id,
        outletId: session.outletId,
        sessionId,
        gameType: body.gameType ?? 'SPICE_QUIZ',
        playerNickname: body.playerNickname,
        score: body.score,
      },
    );

    return apiOk(result, 201);
  } catch (err) {
    return apiError(err);
  }
}
