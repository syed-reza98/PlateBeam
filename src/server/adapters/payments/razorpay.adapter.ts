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

function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required for RazorpayPaymentAdapter',
    );
  }
  return {
    keyId,
    keySecret,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? keySecret,
    authHeader: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
  };
}

/**
 * Razorpay Orders & Webhooks REST adapter.
 */
export class RazorpayPaymentAdapter implements PaymentPort {
  readonly provider = 'RAZORPAY' as const;

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const cfg = getRazorpayConfig();
    const totalMinor = input.amountMinor + input.tipMinor;

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: cfg.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: totalMinor,
        currency: input.currencyCode || 'INR',
        receipt: input.paymentId.slice(0, 40),
        notes: {
          tenantId: input.tenantId,
          sessionId: input.sessionId,
          paymentId: input.paymentId,
          idempotencyKey: input.idempotencyKey,
        },
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || !data.id) {
      throw new Error(
        `Razorpay order creation failed (${res.status}): ${JSON.stringify(data)}`,
      );
    }

    return {
      provider: 'RAZORPAY',
      gatewayTxnId: String(data.id),
      status: 'PENDING',
      rawResponse: data,
    };
  }

  async verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifiedWebhookEvent> {
    const cfg = getRazorpayConfig();
    const sig =
      input.headers['x-razorpay-signature'] ??
      input.headers['X-Razorpay-Signature'];

    let valid = false;
    if (sig) {
      const expected = createHmac('sha256', cfg.webhookSecret)
        .update(input.rawBody)
        .digest('hex');
      try {
        valid = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch {
        valid = false;
      }
    }

    const eventName = String(input.parsedBody.event ?? '');
    const entity = (
      (
        (input.parsedBody.payload as Record<string, unknown> | undefined)
          ?.payment as Record<string, unknown> | undefined
      )?.entity ?? {}
    ) as Record<string, unknown>;
    const notes = (entity.notes ?? {}) as Record<string, unknown>;

    const status =
      eventName === 'payment.captured'
        ? 'CAPTURED'
        : eventName === 'payment.failed'
          ? 'FAILED'
          : 'PENDING';

    return {
      valid,
      provider: 'RAZORPAY',
      paymentId: typeof notes.paymentId === 'string' ? notes.paymentId : undefined,
      gatewayTxnId:
        typeof entity.order_id === 'string'
          ? entity.order_id
          : typeof entity.id === 'string'
            ? entity.id
            : undefined,
      idempotencyKey:
        typeof notes.idempotencyKey === 'string'
          ? notes.idempotencyKey
          : undefined,
      amountMinor:
        typeof entity.amount === 'number' ? entity.amount : undefined,
      status,
      rawPayload: input.parsedBody,
    };
  }

  async verifyTransaction(input: {
    gatewayTxnId: string;
    amountMinor: number;
    currencyCode: string;
  }) {
    const cfg = getRazorpayConfig();
    const res = await fetch(
      `https://api.razorpay.com/v1/orders/${encodeURIComponent(input.gatewayTxnId)}`,
      { headers: { Authorization: cfg.authHeader } },
    );
    const data = (await res.json()) as Record<string, unknown>;
    const verified = res.ok && data.status === 'paid';
    return {
      verified,
      status: verified ? ('CAPTURED' as const) : ('PENDING' as const),
      raw: data,
    };
  }

  async refundTransaction(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    const cfg = getRazorpayConfig();
    const res = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.gatewayTxnId)}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: cfg.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amountMinor,
          notes: input.reason ? { reason: input.reason } : undefined,
        }),
      },
    );
    const data = (await res.json()) as Record<string, unknown>;
    return {
      success: res.ok && Boolean(data.id),
      refundTxnId: typeof data.id === 'string' ? data.id : undefined,
      rawResponse: data,
    };
  }
}
