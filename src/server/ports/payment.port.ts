import type {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '../db/types';

/**
 * Hexagonal PaymentPort contract.
 * Implemented by SSLCommerz, Stripe, Razorpay, Cash/EDC, and Sandbox adapters.
 */

export interface InitiatePaymentInput {
  tenantId: string;
  outletId: string;
  sessionId: string;
  paymentId: string;
  idempotencyKey: string;
  amountMinor: number;
  tipMinor: number;
  currencyCode: string;
  method: PaymentMethod;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export interface InitiatePaymentResult {
  provider: PaymentProvider;
  gatewayTxnId: string;
  redirectUrl?: string;
  clientSecret?: string;
  qrPayload?: string;
  status: PaymentStatus;
  rawResponse?: Record<string, unknown>;
}

export interface VerifyWebhookInput {
  provider: PaymentProvider;
  headers: Record<string, string | undefined>;
  rawBody: string;
  parsedBody: Record<string, unknown>;
}

export interface VerifiedWebhookEvent {
  valid: boolean;
  provider: PaymentProvider;
  paymentId?: string;
  gatewayTxnId?: string;
  idempotencyKey?: string;
  amountMinor?: number;
  status: PaymentStatus;
  rawPayload: Record<string, unknown>;
}

export interface RefundPaymentInput {
  tenantId: string;
  paymentId: string;
  gatewayTxnId: string;
  amountMinor: number;
  reason?: string;
}

export interface RefundPaymentResult {
  success: boolean;
  refundTxnId?: string;
  rawResponse?: Record<string, unknown>;
}

export interface PaymentPort {
  readonly provider: PaymentProvider;

  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;

  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent>;

  verifyTransaction(input: {
    gatewayTxnId: string;
    amountMinor: number;
    currencyCode: string;
  }): Promise<{ verified: boolean; status: PaymentStatus; raw?: Record<string, unknown> }>;

  refundTransaction(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}
