import type {
  PaymentMethod,
  PaymentProvider,
  TaxBreakdownItem,
} from '../db/types';
import type {
  InitiatePaymentResult,
  PaymentPort,
  VerifiedWebhookEvent,
} from '../ports/payment.port';
import type { RealtimePort } from '../ports/realtime.port';
import type {
  AuditRepository,
  BillingRepository,
  FloorRepository,
  InvoiceRecord,
  MenuItemRecord,
  OrderItemRecord,
  OutletRecord,
  PaymentRecord,
  SessionOrderRepository,
  TableSessionRecord,
  TaxSlabRecord,
} from '../ports/repositories.port';
import { ConflictError, NotFoundError, ValidationError } from './errors';
import { formatMinorCurrency } from './escpos.service';
import { writeAuditLog } from './rbac.service';

export interface BillCalculationLine {
  orderItemId?: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  taxSlab: Pick<TaxSlabRecord, 'id' | 'name' | 'rateBps' | 'components' | 'isInclusive'>;
}

export interface CalculatedBillSummary {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  serviceChargeMinor: number;
  tipMinor: number;
  totalMinor: number;
  taxBreakdown: TaxBreakdownItem[];
}

/**
 * Distributes an integer `totalMinor` across `weights` using the largest-remainder
 * (Hamilton) method so that `sum(result) === totalMinor` with zero rounding drift.
 */
export function distributeMinorByWeights(
  totalMinor: number,
  weights: readonly number[],
): number[] {
  if (weights.length === 0) return [];
  const totalWeight = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
  if (totalWeight <= 0) {
    return distributeMinorEqually(totalMinor, weights.length);
  }

  const shares = weights.map((w, idx) => {
    const exact = (totalMinor * Math.max(0, w)) / totalWeight;
    const floor = Math.floor(exact);
    return { idx, floor, rem: exact - floor };
  });

  const allocated = shares.reduce((acc, s) => acc + s.floor, 0);
  let remainder = totalMinor - allocated;

  const byRemainder = [...shares].sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < byRemainder.length && remainder > 0; i++) {
    byRemainder[i]!.floor += 1;
    remainder -= 1;
  }

  const result = new Array<number>(weights.length);
  for (const s of shares) {
    result[s.idx] = s.floor;
  }
  return result;
}

/**
 * Distributes `totalMinor` equally across `count` parts using largest-remainder
 * so that `sum(result) === totalMinor` always holds.
 */
export function distributeMinorEqually(totalMinor: number, count: number): number[] {
  if (count <= 0) throw new ValidationError('Split count must be at least 1.');
  const base = Math.floor(totalMinor / count);
  const rem = totalMinor % count;
  return Array.from({ length: count }, (_, idx) => (idx < rem ? base + 1 : base));
}

/**
 * Exact integer minor-unit tax slab calculation (FR-025):
 * Supports inclusive & exclusive CGST+SGST or VAT + optional service charge.
 */
export function calculateSessionBill(input: {
  lines: BillCalculationLine[];
  discountMinor?: number;
  serviceChargeRateBps?: number;
  tipMinor?: number;
}): CalculatedBillSummary {
  const discountMinor = Math.max(0, Math.round(input.discountMinor ?? 0));
  const tipMinor = Math.max(0, Math.round(input.tipMinor ?? 0));

  let grossLinesMinor = 0;
  for (const line of input.lines) {
    grossLinesMinor += line.unitPriceMinor * line.quantity;
  }

  // Apply discount proportionally across lines before tax
  const lineTotals = input.lines.map((l) => l.unitPriceMinor * l.quantity);
  const effectiveDiscount = Math.min(discountMinor, grossLinesMinor);
  const lineDiscounts =
    effectiveDiscount > 0
      ? distributeMinorByWeights(effectiveDiscount, lineTotals)
      : lineTotals.map(() => 0);

  let subtotalMinor = 0;
  let totalTaxMinor = 0;
  const breakdownMap = new Map<string, TaxBreakdownItem>();

  input.lines.forEach((line, idx) => {
    const netLineGross = Math.max(0, lineTotals[idx]! - lineDiscounts[idx]!);
    const slab = line.taxSlab;

    let lineNetMinor = netLineGross;
    let lineTaxMinor = 0;

    if (slab.rateBps > 0) {
      if (slab.isInclusive) {
        lineTaxMinor = Math.round(
          (netLineGross * slab.rateBps) / (10000 + slab.rateBps),
        );
        lineNetMinor = netLineGross - lineTaxMinor;
      } else {
        lineTaxMinor = Math.round((netLineGross * slab.rateBps) / 10000);
      }
    }

    subtotalMinor += lineNetMinor;
    totalTaxMinor += lineTaxMinor;

    const components =
      slab.components && slab.components.length > 0
        ? slab.components
        : [{ name: slab.name, rateBps: slab.rateBps }];

    const componentTaxes = distributeMinorByWeights(
      lineTaxMinor,
      components.map((c) => c.rateBps),
    );

    components.forEach((comp, cIdx) => {
      const key = `${comp.name}:${comp.rateBps}`;
      const existing = breakdownMap.get(key);
      const compTax = componentTaxes[cIdx] ?? 0;
      if (existing) {
        existing.taxableMinor += lineNetMinor;
        existing.taxMinor += compTax;
      } else {
        breakdownMap.set(key, {
          name: comp.name,
          rateBps: comp.rateBps,
          taxableMinor: lineNetMinor,
          taxMinor: compTax,
        });
      }
    });
  });

  const serviceChargeRateBps = Math.max(0, input.serviceChargeRateBps ?? 0);
  const serviceChargeMinor =
    serviceChargeRateBps > 0
      ? Math.round((subtotalMinor * serviceChargeRateBps) / 10000)
      : 0;

  const totalMinor = subtotalMinor + totalTaxMinor + serviceChargeMinor + tipMinor;

  return {
    subtotalMinor,
    discountMinor: effectiveDiscount,
    taxMinor: totalTaxMinor,
    serviceChargeMinor,
    tipMinor,
    totalMinor,
    taxBreakdown: Array.from(breakdownMap.values()),
  };
}

/**
 * Calculates pre-tax tip in minor units (FR-027).
 */
export function calculatePreTaxTipMinor(
  preTaxSubtotalMinor: number,
  tipPercent: number,
): number {
  if (tipPercent <= 0) return 0;
  return Math.round((preTaxSubtotalMinor * tipPercent) / 100);
}

export interface SplitShare {
  payerLabel: string;
  amountMinor: number;
  tipMinor: number;
  totalMinor: number;
}

export interface SplitBillResult {
  mode: 'EQUAL' | 'BY_ITEM' | 'CUSTOM';
  grandTotalMinor: number;
  splits: SplitShare[];
  remainingMinor: number;
}

/**
 * Dynamic Split-Bill Engine (FR-026):
 * - EQUAL: largest-remainder minor-unit distribution so `sum(splits) === grandTotalMinor`
 * - BY_ITEM: claimed dishes + shared dish fractions (`shareRatio`), proportional tax/service/tip
 * - CUSTOM: arbitrary payer amounts validated against total
 */
export function calculateSplitBill(input: {
  mode: 'EQUAL' | 'BY_ITEM' | 'CUSTOM';
  billTotalMinor: number;
  tipMinor?: number;
  splitCount?: number;
  orderItems?: Array<Pick<OrderItemRecord, 'id' | 'quantity' | 'unitPriceMinor' | 'taxMinor'>>;
  itemSelections?: Array<{
    payerLabel: string;
    orderItemId: string;
    shareRatio: number;
  }>;
  customAmountsMinor?: number[];
}): SplitBillResult {
  const tipMinor = Math.max(0, Math.round(input.tipMinor ?? 0));
  const billWithoutExtraTip = Math.max(0, input.billTotalMinor);
  const grandTotalMinor = billWithoutExtraTip + tipMinor;

  if (input.mode === 'EQUAL') {
    const count = input.splitCount ?? 2;
    const baseShares = distributeMinorEqually(billWithoutExtraTip, count);
    const tipShares = distributeMinorEqually(tipMinor, count);
    const splits: SplitShare[] = baseShares.map((amt, idx) => ({
      payerLabel: `Guest ${idx + 1}`,
      amountMinor: amt,
      tipMinor: tipShares[idx] ?? 0,
      totalMinor: amt + (tipShares[idx] ?? 0),
    }));
    return {
      mode: 'EQUAL',
      grandTotalMinor,
      splits,
      remainingMinor: 0,
    };
  }

  if (input.mode === 'BY_ITEM') {
    const selections = input.itemSelections ?? [];
    if (selections.length === 0) {
      throw new ValidationError('BY_ITEM split requires at least one item selection.');
    }
    const itemsById = new Map((input.orderItems ?? []).map((i) => [i.id, i]));
    const payerWeights = new Map<string, number>();

    for (const sel of selections) {
      const item = itemsById.get(sel.orderItemId);
      if (!item) {
        throw new NotFoundError('Order item not found for split', {
          orderItemId: sel.orderItemId,
        });
      }
      const itemTotal = item.unitPriceMinor * item.quantity + item.taxMinor;
      const weight = itemTotal * sel.shareRatio;
      payerWeights.set(
        sel.payerLabel,
        (payerWeights.get(sel.payerLabel) ?? 0) + weight,
      );
    }

    const labels = Array.from(payerWeights.keys());
    const weights = labels.map((l) => payerWeights.get(l) ?? 0);
    const allocatedBill = distributeMinorByWeights(billWithoutExtraTip, weights);
    const allocatedTips = distributeMinorByWeights(tipMinor, weights);

    const splits: SplitShare[] = labels.map((payerLabel, idx) => ({
      payerLabel,
      amountMinor: allocatedBill[idx] ?? 0,
      tipMinor: allocatedTips[idx] ?? 0,
      totalMinor: (allocatedBill[idx] ?? 0) + (allocatedTips[idx] ?? 0),
    }));

    return {
      mode: 'BY_ITEM',
      grandTotalMinor,
      splits,
      remainingMinor: 0,
    };
  }

  // CUSTOM
  const custom = input.customAmountsMinor ?? [];
  if (custom.length === 0) {
    throw new ValidationError('CUSTOM split requires at least one amount.');
  }
  const sumCustom = custom.reduce((acc, a) => acc + a, 0);
  if (sumCustom > grandTotalMinor) {
    throw new ValidationError('Custom split amounts exceed the bill total.');
  }

  const tipShares = distributeMinorByWeights(tipMinor, custom);
  const splits: SplitShare[] = custom.map((totalAmt, idx) => {
    const t = Math.min(totalAmt, tipShares[idx] ?? 0);
    return {
      payerLabel: `Payer ${idx + 1}`,
      amountMinor: totalAmt - t,
      tipMinor: t,
      totalMinor: totalAmt,
    };
  });

  return {
    mode: 'CUSTOM',
    grandTotalMinor,
    splits,
    remainingMinor: Math.max(0, grandTotalMinor - sumCustom),
  };
}

/**
 * Idempotent payment initiation (FR-029).
 * Returns existing payment record if `idempotencyKey` was already processed.
 */
export async function initiateIdempotentPayment(
  deps: {
    billing: BillingRepository;
    sessionOrder: SessionOrderRepository;
    paymentPort: PaymentPort;
  },
  input: {
    tenantId: string;
    outletId: string;
    sessionId: string;
    provider: PaymentProvider;
    method: PaymentMethod;
    amountMinor: number;
    tipMinor: number;
    currencyCode: string;
    idempotencyKey: string;
    splitGroupId?: string;
    guestId?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    successUrl: string;
    failUrl: string;
    cancelUrl: string;
    ipnUrl: string;
  },
): Promise<{
  payment: PaymentRecord;
  gatewayResult: InitiatePaymentResult | null;
  idempotentReplay: boolean;
}> {
  const existing = await deps.billing.findPaymentByIdempotencyKey(
    input.tenantId,
    input.idempotencyKey,
  );
  if (existing) {
    return { payment: existing, gatewayResult: null, idempotentReplay: true };
  }

  const session = await deps.sessionOrder.findSessionById(
    input.tenantId,
    input.sessionId,
  );
  if (!session) {
    throw new NotFoundError('Table session not found', { sessionId: input.sessionId });
  }
  if (session.status === 'PAID' || session.status === 'CANCELLED') {
    throw new ConflictError('Session is already closed.');
  }

  const payment = await deps.billing.createPayment({
    tenantId: input.tenantId,
    outletId: input.outletId,
    sessionId: input.sessionId,
    guestId: input.guestId ?? null,
    splitGroupId: input.splitGroupId ?? null,
    idempotencyKey: input.idempotencyKey,
    provider: input.provider,
    method: input.method,
    amountMinor: input.amountMinor,
    tipMinor: input.tipMinor,
    status: 'PENDING',
  });

  const gatewayResult = await deps.paymentPort.initiatePayment({
    tenantId: input.tenantId,
    outletId: input.outletId,
    sessionId: input.sessionId,
    paymentId: payment.id,
    idempotencyKey: input.idempotencyKey,
    amountMinor: input.amountMinor,
    tipMinor: input.tipMinor,
    currencyCode: input.currencyCode,
    method: input.method,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    successUrl: input.successUrl,
    failUrl: input.failUrl,
    cancelUrl: input.cancelUrl,
    ipnUrl: input.ipnUrl,
  });

  const updated = await deps.billing.updatePaymentStatus(
    input.tenantId,
    payment.id,
    gatewayResult.status,
    {
      gatewayTxnId: gatewayResult.gatewayTxnId,
      paidAt: gatewayResult.status === 'CAPTURED' ? new Date() : null,
    },
  );

  return { payment: updated, gatewayResult, idempotentReplay: false };
}

/**
 * Atomically reconciles a verified payment webhook, flags duplicate charges,
 * settles the session when cumulative captured payments >= totalMinor,
 * releases the table, and issues a sequential statutory invoice (FR-026, FR-029, FR-030).
 */
export async function reconcileWebhookPayment(
  deps: {
    billing: BillingRepository;
    sessionOrder: SessionOrderRepository;
    floor: FloorRepository;
    audit: AuditRepository;
    realtime: RealtimePort;
    menu?: { listTaxSlabs(tenantId: string, outletId: string): Promise<TaxSlabRecord[]>; listMenuItems(tenantId: string, outletId: string): Promise<MenuItemRecord[]> };
  },
  input: {
    tenantId: string;
    paymentId: string;
    verifiedEvent: VerifiedWebhookEvent;
    taxBreakdown?: TaxBreakdownItem[];
  },
): Promise<{
  payment: PaymentRecord;
  session: TableSessionRecord;
  invoice: InvoiceRecord | null;
  duplicateFlagged: boolean;
}> {
  if (!input.verifiedEvent.valid) {
    throw new ValidationError('Invalid payment webhook signature.');
  }

  const sessionPayments = await deps.billing.listPaymentsBySession(
    input.tenantId,
    '', // fallback if needed; we look up via paymentId below
  ).catch(() => [] as PaymentRecord[]);
  void sessionPayments;

  // Locate payment via gatewayTxnId or idempotencyKey
  let payment: PaymentRecord | null = null;
  if (input.verifiedEvent.idempotencyKey) {
    payment = await deps.billing.findPaymentByIdempotencyKey(
      input.tenantId,
      input.verifiedEvent.idempotencyKey,
    );
  }
  if (!payment && input.verifiedEvent.gatewayTxnId) {
    payment = await deps.billing.findPaymentByGatewayTxnId(
      input.verifiedEvent.gatewayTxnId,
    );
  }
  if (!payment) {
    throw new NotFoundError('Payment record not found for webhook', {
      paymentId: input.paymentId,
    });
  }

  const session = await deps.sessionOrder.findSessionById(
    input.tenantId,
    payment.sessionId,
  );
  if (!session) {
    throw new NotFoundError('Table session not found', { sessionId: payment.sessionId });
  }

  // Duplicate charge reconciliation check (FR-029)
  const existingPayments = await deps.billing.listPaymentsBySession(
    input.tenantId,
    session.id,
  );
  const alreadyCapturedTotal = existingPayments
    .filter((p) => p.status === 'CAPTURED' && p.id !== payment!.id)
    .reduce((acc, p) => acc + p.amountMinor, 0);

  const isDuplicateOvercharge =
    input.verifiedEvent.status === 'CAPTURED' &&
    (session.status === 'PAID' || alreadyCapturedTotal >= session.totalMinor);

  if (isDuplicateOvercharge) {
    const flagged = await deps.billing.updatePaymentStatus(
      input.tenantId,
      payment.id,
      'DUPLICATE_FLAGGED',
      {
        gatewayTxnId: input.verifiedEvent.gatewayTxnId ?? payment.gatewayTxnId,
        rawWebhook: input.verifiedEvent.rawPayload,
      },
    );

    await writeAuditLog(deps.audit, {
      tenantId: input.tenantId,
      outletId: session.outletId,
      action: 'PAYMENT_DUPLICATE_FLAGGED',
      entityType: 'payments',
      entityId: payment.id,
      afterState: {
        sessionId: session.id,
        amountMinor: payment.amountMinor,
        gatewayTxnId: input.verifiedEvent.gatewayTxnId,
      },
    });

    return {
      payment: flagged,
      session,
      invoice: null,
      duplicateFlagged: true,
    };
  }

  const updatedPayment = await deps.billing.updatePaymentStatus(
    input.tenantId,
    payment.id,
    input.verifiedEvent.status,
    {
      gatewayTxnId: input.verifiedEvent.gatewayTxnId ?? payment.gatewayTxnId,
      rawWebhook: input.verifiedEvent.rawPayload,
      paidAt: input.verifiedEvent.status === 'CAPTURED' ? new Date() : payment.paidAt,
    },
  );

  const newCapturedTotal =
    alreadyCapturedTotal +
    (updatedPayment.status === 'CAPTURED' ? updatedPayment.amountMinor : 0);

  let updatedSession = session;
  let invoice: InvoiceRecord | null = null;

  if (newCapturedTotal >= session.totalMinor && session.totalMinor > 0) {
    const invoiceNumber = await deps.billing.nextInvoiceNumber(
      input.tenantId,
      session.outletId,
    );
    invoice = await deps.billing.createInvoice({
      tenantId: input.tenantId,
      outletId: session.outletId,
      sessionId: session.id,
      invoiceNumber,
      taxBreakdown: input.taxBreakdown ?? [],
      totalMinor: session.totalMinor,
    });

    await deps.billing.updatePaymentStatus(
      input.tenantId,
      updatedPayment.id,
      updatedPayment.status,
      { invoiceId: invoice.id },
    );

    updatedSession = await deps.sessionOrder.updateSessionStatus(
      input.tenantId,
      session.id,
      'PAID',
      new Date(),
    );

    if (session.tableId) {
      await deps.floor.updateTableStatus(
        input.tenantId,
        session.tableId,
        'VACANT',
        null,
      );
      await deps.realtime.publishToFloor(
        input.tenantId,
        session.outletId,
        'table.updated',
        { tableId: session.tableId, status: 'VACANT' },
      );
    }

    await deps.realtime.publishToTableSession(
      input.tenantId,
      session.id,
      'payment.settled',
      {
        sessionId: session.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    );
  } else if (newCapturedTotal > 0 && session.status === 'OPEN') {
    updatedSession = await deps.sessionOrder.updateSessionStatus(
      input.tenantId,
      session.id,
      'PARTIALLY_PAID',
    );
  }

  return {
    payment: updatedPayment,
    session: updatedSession,
    invoice,
    duplicateFlagged: false,
  };
}

/**
 * Generates a print-ready statutory HTML receipt (FR-030).
 */
export function generateStatutoryReceiptHtml(input: {
  outlet: Pick<OutletRecord, 'name' | 'address' | 'taxRegNo'>;
  invoice: InvoiceRecord;
  session: TableSessionRecord;
  items: OrderItemRecord[];
  payments: PaymentRecord[];
  currencyCode: string;
}): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const itemRows = input.items
    .filter((i) => i.kdsStatus !== 'CANCELLED')
    .map(
      (item) => `
      <tr>
        <td>${esc(item.itemNameSnapshot)} &times; ${item.quantity}</td>
        <td style="text-align:right">${esc(formatMinorCurrency(item.unitPriceMinor * item.quantity, input.currencyCode))}</td>
      </tr>`,
    )
    .join('');

  const taxRows = input.invoice.taxBreakdown
    .map(
      (t) => `
      <tr>
        <td>${esc(t.name)} (${(t.rateBps / 100).toFixed(2)}%)</td>
        <td style="text-align:right">${esc(formatMinorCurrency(t.taxMinor, input.currencyCode))}</td>
      </tr>`,
    )
    .join('');

  const paymentSummary = input.payments
    .filter((p) => p.status === 'CAPTURED')
    .map((p) => `${p.method} (${formatMinorCurrency(p.amountMinor, input.currencyCode)})`)
    .join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(input.invoice.invoiceNumber)}</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-width: 380px; margin: 24px auto; color: #171311; font-size: 13px; }
    h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
    .meta { text-align: center; font-size: 12px; color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    td { padding: 4px 0; }
    .hr { border-top: 1px dashed #999; margin: 8px 0; }
    .total { font-weight: 700; font-size: 15px; }
  </style>
</head>
<body>
  <h1>${esc(input.outlet.name)}</h1>
  <div class="meta">
    ${input.outlet.address ? `<div>${esc(input.outlet.address)}</div>` : ''}
    ${input.outlet.taxRegNo ? `<div>Tax Reg / GSTIN: ${esc(input.outlet.taxRegNo)}</div>` : ''}
    <div>Invoice: <strong>${esc(input.invoice.invoiceNumber)}</strong></div>
    <div>Issued: ${esc(input.invoice.issuedAt.toISOString())}</div>
  </div>
  <div class="hr"></div>
  <table>${itemRows}</table>
  <div class="hr"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">${esc(formatMinorCurrency(input.session.subtotalMinor, input.currencyCode))}</td></tr>
    ${taxRows}
    ${input.session.serviceChargeMinor > 0 ? `<tr><td>Service Charge</td><td style="text-align:right">${esc(formatMinorCurrency(input.session.serviceChargeMinor, input.currencyCode))}</td></tr>` : ''}
    ${input.session.tipMinor > 0 ? `<tr><td>Tip</td><td style="text-align:right">${esc(formatMinorCurrency(input.session.tipMinor, input.currencyCode))}</td></tr>` : ''}
    <tr class="total"><td>TOTAL</td><td style="text-align:right">${esc(formatMinorCurrency(input.invoice.totalMinor, input.currencyCode))}</td></tr>
  </table>
  <div class="hr"></div>
  <div class="meta">Paid via: ${esc(paymentSummary || 'Settled')}</div>
</body>
</html>`;
}
