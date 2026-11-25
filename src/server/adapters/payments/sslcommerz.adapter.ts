import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentPort,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifiedWebhookEvent,
  VerifyWebhookInput,
} from '../../ports/payment.port';

function getSslCommerzConfig() {
  const storeId = process.env.SSLCOMMERZ_STORE_ID;
  const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWD;
  if (!storeId || !storePasswd) {
    throw new Error(
      'SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWD are required',
    );
  }
  const isSandbox = process.env.SSLCOMMERZ_SANDBOX !== 'false';
  const baseUrl = isSandbox
    ? 'https://sandbox.sslcommerz.com'
    : 'https://securepay.sslcommerz.com';
  return { storeId, storePasswd, baseUrl };
}

/**
 * SSLCommerz v4 Session Init + IPN / Validation API adapter.
 */
export class SslCommerzPaymentAdapter implements PaymentPort {
  readonly provider = 'SSLCOMMERZ' as const;

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentResult> {
    const cfg = getSslCommerzConfig();
    const totalAmount = ((input.amountMinor + input.tipMinor) / 100).toFixed(2);
    const tranId = input.paymentId;

    const form = new URLSearchParams({
      store_id: cfg.storeId,
      store_passwd: cfg.storePasswd,
      total_amount: totalAmount,
      currency: input.currencyCode || 'BDT',
      tran_id: tranId,
      success_url: input.successUrl,
      fail_url: input.failUrl,
      cancel_url: input.cancelUrl,
      ipn_url: input.ipnUrl,
      cus_name: input.customerName ?? 'Guest',
      cus_email: input.customerEmail ?? 'guest@platebeam.local',
      cus_phone: input.customerPhone ?? '01700000000',
      cus_add1: 'Dine-In',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      shipping_method: 'NO',
      product_name: `Table Session ${input.sessionId.slice(0, 8)}`,
      product_category: 'Restaurant',
      product_profile: 'general',
      value_a: input.tenantId,
      value_b: input.sessionId,
      value_c: input.idempotencyKey,
    });

    const res = await fetch(`${cfg.baseUrl}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      throw new Error(
        `SSLCommerz session init failed: ${String(data.failedreason ?? res.status)}`,
      );
    }

    return {
      provider: 'SSLCOMMERZ',
      gatewayTxnId: String(data.sessionkey ?? tranId),
      redirectUrl: String(data.GatewayPageURL),
      status: 'PENDING',
      rawResponse: data,
    };
  }

  async verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifiedWebhookEvent> {
    const body = input.parsedBody;
    const valId = typeof body.val_id === 'string' ? body.val_id : undefined;
    const tranId = typeof body.tran_id === 'string' ? body.tran_id : undefined;
    const rawStatus = String(body.status ?? '').toUpperCase();

    if (!valId) {
      return {
        valid: false,
        provider: 'SSLCOMMERZ',
        paymentId: tranId,
        status: rawStatus === 'FAILED' ? 'FAILED' : 'PENDING',
        rawPayload: body,
      };
    }

    const cfg = getSslCommerzConfig();
    const qs = new URLSearchParams({
      val_id: valId,
      store_id: cfg.storeId,
      store_passwd: cfg.storePasswd,
      format: 'json',
    });

    const res = await fetch(
      `${cfg.baseUrl}/validator/api/validationserverAPI.php?${qs.toString()}`,
    );
    const validation = (await res.json()) as Record<string, unknown>;
    const vStatus = String(validation.status ?? '').toUpperCase();
    const valid = vStatus === 'VALID' || vStatus === 'VALIDATED';
    const amountMinor = validation.amount
      ? Math.round(Number(validation.amount) * 100)
      : undefined;

    return {
      valid,
      provider: 'SSLCOMMERZ',
      paymentId: tranId,
      gatewayTxnId: String(validation.bank_tran_id ?? valId),
      idempotencyKey:
        typeof validation.value_c === 'string' ? validation.value_c : undefined,
      amountMinor,
      status: valid ? 'CAPTURED' : 'FAILED',
      rawPayload: validation,
    };
  }

  async verifyTransaction(input: {
    gatewayTxnId: string;
    amountMinor: number;
    currencyCode: string;
  }) {
    const cfg = getSslCommerzConfig();
    const qs = new URLSearchParams({
      val_id: input.gatewayTxnId,
      store_id: cfg.storeId,
      store_passwd: cfg.storePasswd,
      format: 'json',
    });
    const res = await fetch(
      `${cfg.baseUrl}/validator/api/validationserverAPI.php?${qs.toString()}`,
    );
    const data = (await res.json()) as Record<string, unknown>;
    const vStatus = String(data.status ?? '').toUpperCase();
    const verified = vStatus === 'VALID' || vStatus === 'VALIDATED';
    return {
      verified,
      status: verified ? ('CAPTURED' as const) : ('FAILED' as const),
      raw: data,
    };
  }

  async refundTransaction(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> {
    const cfg = getSslCommerzConfig();
    const qs = new URLSearchParams({
      bank_tran_id: input.gatewayTxnId,
      refund_amount: (input.amountMinor / 100).toFixed(2),
      refund_remarks: input.reason ?? 'PlateBeam refund',
      store_id: cfg.storeId,
      store_passwd: cfg.storePasswd,
      format: 'json',
    });

    const res = await fetch(
      `${cfg.baseUrl}/validator/api/merchantTransIDvalidationAPI.php?${qs.toString()}`,
    );
    const data = (await res.json()) as Record<string, unknown>;
    const success = String(data.status ?? '').toLowerCase() === 'success';

    return {
      success,
      refundTxnId:
        typeof data.refund_ref_id === 'string' ? data.refund_ref_id : undefined,
      rawResponse: data,
    };
  }
}
