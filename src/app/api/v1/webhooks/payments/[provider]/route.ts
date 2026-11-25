import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { reconcileWebhookPayment } from '@/server/core';
import { NotFoundError, ValidationError } from '@/server/core/errors';
import type { PaymentProvider } from '@/server/db/types';

function normalizeProvider(raw: string): PaymentProvider {
  const upper = raw.toUpperCase().replace(/-/g, '_');
  if (
    upper === 'SSLCOMMERZ' ||
    upper === 'STRIPE' ||
    upper === 'RAZORPAY' ||
    upper === 'CASH_EDC' ||
    upper === 'SANDBOX'
  ) {
    return upper;
  }
  throw new ValidationError(`Unsupported payment provider: ${raw}`);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider: rawProvider } = await params;
    const provider = normalizeProvider(rawProvider);
    const rawBody = await req.text();

    let parsedBody: Record<string, unknown> = {};
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = new URLSearchParams(rawBody);
      form.forEach((value, key) => {
        parsedBody[key] = value;
      });
    } else if (rawBody.trim().length > 0) {
      try {
        parsedBody = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        parsedBody = { rawBody };
      }
    }

    const headers: Record<string, string | undefined> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const container = getContainer();
    const adapter = container.getPaymentAdapter(provider);
    const verifiedEvent = await adapter.verifyWebhook({
      provider,
      headers,
      rawBody,
      parsedBody,
    });

    let payment = verifiedEvent.gatewayTxnId
      ? await container.repos.billing.findPaymentByGatewayTxnId(
          verifiedEvent.gatewayTxnId,
        )
      : null;

    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      (parsedBody.tenantId as string | undefined) ?? undefined,
    );

    if (!payment && verifiedEvent.idempotencyKey) {
      payment = await container.repos.billing.findPaymentByIdempotencyKey(
        tenant.id,
        verifiedEvent.idempotencyKey,
      );
    }

    const paymentId = payment?.id ?? verifiedEvent.paymentId;
    if (!paymentId) {
      throw new NotFoundError('Payment record not found for webhook');
    }

    const result = await reconcileWebhookPayment(
      {
        billing: container.repos.billing,
        sessionOrder: container.repos.sessionOrder,
        floor: container.repos.floor,
        audit: container.repos.audit,
        realtime: container.realtime,
        menu: container.repos.menu,
      },
      {
        tenantId: payment?.tenantId ?? tenant.id,
        paymentId,
        verifiedEvent,
      },
    );

    return apiOk({
      received: true,
      provider,
      payment: result.payment,
      sessionStatus: result.session.status,
      invoiceId: result.invoice?.id ?? null,
      duplicateFlagged: result.duplicateFlagged,
    });
  } catch (err) {
    return apiError(err);
  }
}
