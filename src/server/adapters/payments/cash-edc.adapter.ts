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
 * Synchronous Cash & External EDC Card Terminal Payment Adapter.
 * Settles immediately at the FOH POS terminal without a remote redirect.
 */
export class CashEdcPaymentAdapter implements PaymentPort {
  readonly provider = 'CASH_EDC' as const;

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const prefix = input.method === 'CASH' ? 'cash' : 'edc';
    const gatewayTxnId = `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return {
      provider: 'CASH_EDC',
      gatewayTxnId,
      status: 'CAPTURED',
      rawResponse: {
        method: input.method,
        capturedAt: new Date().toISOString(),
        amountMinor: input.amountMinor,
        tipMinor: input.tipMinor,
      },
    };
  }

  async verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifiedWebhookEvent> {
    return {
      valid: true,
      provider: 'CASH_EDC',
      paymentId:
        typeof input.parsedBody.paymentId === 'string'
          ? input.parsedBody.paymentId
          : undefined,
      gatewayTxnId:
        typeof input.parsedBody.gatewayTxnId === 'string'
          ? input.parsedBody.gatewayTxnId
          : undefined,
      status: 'CAPTURED',
      rawPayload: input.parsedBody,
    };
  }

  async verifyTransaction(input: {
    gatewayTxnId: string;
    amountMinor: number;
    currencyCode: string;
  }) {
    const valid =
      input.gatewayTxnId.startsWith('cash_') ||
      input.gatewayTxnId.startsWith('edc_');
    return {
      verified: valid,
      status: valid ? ('CAPTURED' as const) : ('FAILED' as const),
      raw: { gatewayTxnId: input.gatewayTxnId },
    };
  }

  async refundTransaction(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    return {
      success: true,
      refundTxnId: `pos_ref_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      rawResponse: {
        paymentId: input.paymentId,
        amountMinor: input.amountMinor,
        reason: input.reason,
      },
    };
  }
}
