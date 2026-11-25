import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { calculateSplitBill } from '@/server/core';
import { NotFoundError } from '@/server/core/errors';
import { splitBillCalculateSchema } from '@/lib/schemas';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await parseJsonBody(req, splitBillCalculateSchema);
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos } = getContainer();

    const session = await repos.sessionOrder.findSessionById(tenant.id, sessionId);
    if (!session) {
      throw new NotFoundError('Session not found', { sessionId });
    }

    const [items, payments] = await Promise.all([
      repos.sessionOrder.listOrderItemsBySession(tenant.id, sessionId),
      repos.billing.listPaymentsBySession(tenant.id, sessionId),
    ]);

    const paidMinor = payments
      .filter((p) => p.status === 'CAPTURED')
      .reduce((acc, p) => acc + p.amountMinor, 0);
    const remainingMinor = Math.max(0, session.totalMinor - paidMinor);

    const split = calculateSplitBill({
      mode: body.mode,
      billTotalMinor: remainingMinor,
      tipMinor: body.tipMinor ?? 0,
      splitCount: body.splitCount,
      orderItems: items,
      itemSelections: body.itemSelections?.map((s) => ({
        payerLabel: s.payerLabel,
        orderItemId: s.orderItemId,
        shareRatio: s.shareRatio ?? 1,
      })),
      customAmountsMinor: body.customAmountsMinor,
    });

    return apiOk({
      mode: split.mode,
      subtotalMinor: session.subtotalMinor,
      taxMinor: session.taxMinor,
      serviceChargeMinor: session.serviceChargeMinor,
      tipMinor: body.tipMinor ?? 0,
      grandTotalMinor: split.grandTotalMinor,
      remainingMinor,
      shares: split.splits.map((s) => ({
        label: s.payerLabel,
        amountMinor: s.amountMinor,
        tipMinor: s.tipMinor,
        totalWithTipMinor: s.totalMinor,
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}
