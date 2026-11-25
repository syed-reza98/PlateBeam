import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  getBaseUrl,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { initiateIdempotentPayment } from '@/server/core';
import { NotFoundError } from '@/server/core/errors';
import { initiatePaymentSchema } from '@/lib/schemas';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await parseJsonBody(req, initiatePaymentSchema);
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const container = getContainer();

    const session = await container.repos.sessionOrder.findSessionById(
      tenant.id,
      sessionId,
    );
    if (!session) {
      throw new NotFoundError('Session not found', { sessionId });
    }

    const baseUrl = getBaseUrl(req);
    const providerSlug = body.provider.toLowerCase();
    const paymentPort = container.getPaymentAdapter(body.provider);

    const result = await initiateIdempotentPayment(
      {
        billing: container.repos.billing,
        sessionOrder: container.repos.sessionOrder,
        paymentPort,
      },
      {
        tenantId: tenant.id,
        outletId: session.outletId,
        sessionId,
        provider: body.provider,
        method: body.method,
        amountMinor: body.amountMinor,
        tipMinor: body.tipMinor ?? 0,
        currencyCode: tenant.currencyCode,
        idempotencyKey: body.idempotencyKey,
        splitGroupId: body.splitGroupId,
        guestId: body.guestId,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        successUrl: `${baseUrl}/api/v1/webhooks/payments/${providerSlug}?status=success`,
        failUrl: `${baseUrl}/api/v1/webhooks/payments/${providerSlug}?status=fail`,
        cancelUrl: `${baseUrl}/api/v1/webhooks/payments/${providerSlug}?status=cancel`,
        ipnUrl: `${baseUrl}/api/v1/webhooks/payments/${providerSlug}`,
      },
    );

    return apiOk(result, result.idempotentReplay ? 200 : 201);
  } catch (err) {
    return apiError(err);
  }
}
