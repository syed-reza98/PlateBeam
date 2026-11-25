import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentPort,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifiedWebhookEvent,
  VerifyWebhookInput,
} from '../../ports/payment.port';

function getStripeConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required for StripePaymentAdapter');
  }
  return {
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  };
}

function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | undefined,
  secret: string,
): boolean {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k?.trim(), v?.trim()];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Stripe PaymentIntents REST adapter (zero extra SDK dependency).
 */
export class StripePaymentAdapter implements PaymentPort {
  readonly provider = 'STRIPE' as const;

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const { secretKey } = getStripeConfig();
    const totalMinor = input.amountMinor + input.tipMinor;

    const form = new URLSearchParams({
      amount: String(totalMinor),
      currency: (input.currencyCode || 'usd').toLowerCase(),
      'metadata[tenantId]': input.tenantId,
      'metadata[sessionId]': input.sessionId,
      'metadata[paymentId]': input.paymentId,
      'metadata[idempotencyKey]': input.idempotencyKey,
      'automatic_payment_methods[enabled]': 'true',
    });

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: form.toString(),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || !data.id) {
      throw new Error(
        `Stripe PaymentIntent failed (${res.status}): ${JSON.stringify(data)}`,
      );
    }

    return {
      provider: 'STRIPE',
      gatewayTxnId: String(data.id),
      clientSecret:
        typeof data.client_secret === 'string' ? data.client_secret : undefined,
      status: 'PENDING',
      rawResponse: data,
    };
  }

  async verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifiedWebhookEvent> {
    const { webhookSecret } = getStripeConfig();
    const sigHeader =
      input.headers['stripe-signature'] ?? input.headers['Stripe-Signature'];
    const valid = webhookSecret
      ? verifyStripeSignature(input.rawBody, sigHeader, webhookSecret)
      : false;

    const eventType = String(input.parsedBody.type ?? '');
    const obj = (
      (input.parsedBody.data as Record<string, unknown> | undefined)?.object ??
      {}
    ) as Record<string, unknown>;
    const meta = (obj.metadata ?? {}) as Record<string, unknown>;

    const status =
      eventType === 'payment_intent.succeeded'
        ? 'CAPTURED'
        : eventType === 'payment_intent.payment_failed'
          ? 'FAILED'
          : 'PENDING';

    return {
      valid,
      provider: 'STRIPE',
      paymentId: typeof meta.paymentId === 'string' ? meta.paymentId : undefined,
      gatewayTxnId: typeof obj.id === 'string' ? obj.id : undefined,
      idempotencyKey:
        typeof meta.idempotencyKey === 'string'
          ? meta.idempotencyKey
          : undefined,
      amountMinor:
        typeof obj.amount_received === 'number'
          ? obj.amount_received
          : typeof obj.amount === 'number'
            ? obj.amount
            : undefined,
      status,
      rawPayload: input.parsedBody,
    };
  }

  async verifyTransaction(input: {
    gatewayTxnId: string;
    amountMinor: number;
    currencyCode: string;
  }) {
    const { secretKey } = getStripeConfig();
    const res = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(input.gatewayTxnId)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );
    const data = (await res.json()) as Record<string, unknown>;
    const verified = res.ok && data.status === 'succeeded';
    return {
      verified,
      status: verified ? ('CAPTURED' as const) : ('PENDING' as const),
      raw: data,
    };
  }

  async refundTransaction(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    const { secretKey } = getStripeConfig();
    const form = new URLSearchParams({
      payment_intent: input.gatewayTxnId,
      amount: String(input.amountMinor),
    });
    if (input.reason) {
      form.set('metadata[reason]', input.reason);
    }

    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = (await res.json()) as Record<string, unknown>;

    return {
      success: res.ok && data.status === 'succeeded',
      refundTxnId: typeof data.id === 'string' ? data.id : undefined,
      rawResponse: data,
    };
  }
}
