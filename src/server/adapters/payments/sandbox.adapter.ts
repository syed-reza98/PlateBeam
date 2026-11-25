import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentPort,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifiedWebhookEvent,
  VerifyWebhookInput,
} from '../../ports/payment.port';

/**
 * Interactive Sandbox Payment Simulator.
 * Used automatically when live gateway env vars are unset or PAYMENT_PROVIDER=SANDBOX.
 */
export class SandboxPaymentAdapter implements PaymentPort {
  readonly provider = 'SANDBOX' as const;

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const gatewayTxnId = `sbx_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const separator = input.successUrl.includes('?') ? '&' : '?';
    const redirectUrl = `${input.successUrl}${separator}sandbox=1&paymentId=${encodeURIComponent(input.paymentId)}&gatewayTxnId=${encodeURIComponent(gatewayTxnId)}&amountMinor=${input.amountMinor + input.tipMinor}`;

    return {
      provider: 'SANDBOX',
      gatewayTxnId,
      redirectUrl,
      status: 'PENDING',
      rawResponse: {
        simulated: true,
        paymentId: input.paymentId,
        idempotencyKey: input.idempotencyKey,
      },
    };
  }

  async verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifiedWebhookEvent> {
    const body = input.parsedBody;
    const outcome = String(body.status ?? 'CAPTURED').toUpperCase();
    const status =
      outcome === 'FAILED'
        ? 'FAILED'
        : outcome === 'AUTHORIZED'
          ? 'AUTHORIZED'
          : 'CAPTURED';

    return {
      valid: true,
      provider: 'SANDBOX',
      paymentId: typeof body.paymentId === 'string' ? body.paymentId : undefined,
      gatewayTxnId:
        typeof body.gatewayTxnId === 'string' ? body.gatewayTxnId : undefined,
      idempotencyKey:
        typeof body.idempotencyKey === 'string'
          ? body.idempotencyKey
          : undefined,
      amountMinor:
        typeof body.amountMinor === 'number' ? body.amountMinor : undefined,
      status,
      rawPayload: body,
    };
  }

  async verifyTransaction(input: {
    gatewayTxnId: string;
    amountMinor: number;
    currencyCode: string;
  }) {
    const valid = input.gatewayTxnId.startsWith('sbx_');
    return {
      verified: valid,
      status: valid ? ('CAPTURED' as const) : ('FAILED' as const),
      raw: { simulated: true, gatewayTxnId: input.gatewayTxnId },
    };
  }

  async refundTransaction(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    return {
      success: true,
      refundTxnId: `sbx_ref_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      rawResponse: {
        simulated: true,
        paymentId: input.paymentId,
        amountMinor: input.amountMinor,
      },
    };
  }
}
