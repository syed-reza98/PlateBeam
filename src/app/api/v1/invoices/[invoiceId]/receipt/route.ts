import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { generateStatutoryReceiptHtml } from '@/server/core';
import { NotFoundError } from '@/server/core/errors';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const { invoiceId } = await params;
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos } = getContainer();

    const invoice = await repos.billing.findInvoiceById(tenant.id, invoiceId);
    if (!invoice) {
      throw new NotFoundError('Invoice not found', { invoiceId });
    }

    const [outlet, session, items, payments, table] = await Promise.all([
      repos.tenantOutlet.findOutletById(tenant.id, invoice.outletId),
      repos.sessionOrder.findSessionById(tenant.id, invoice.sessionId),
      repos.sessionOrder.listOrderItemsBySession(tenant.id, invoice.sessionId),
      repos.billing.listPaymentsBySession(tenant.id, invoice.sessionId),
      Promise.resolve(null as { tableNumber?: string } | null),
    ]);

    if (!outlet || !session) {
      throw new NotFoundError('Outlet or session not found for invoice');
    }

    let tableNumber: string | null = table?.tableNumber ?? null;
    if (session.tableId) {
      const t = await repos.floor.findTableById(tenant.id, session.tableId);
      tableNumber = t?.tableNumber ?? null;
    }

    const html = generateStatutoryReceiptHtml({
      outlet,
      invoice,
      session,
      items,
      payments,
      currencyCode: tenant.currencyCode,
    });

    const url = new URL(req.url);
    if (url.searchParams.get('format') === 'html') {
      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return apiOk({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt.toISOString(),
      outletName: outlet.name,
      vatNumber: outlet.taxRegNo,
      tableNumber,
      subtotalMinor: session.subtotalMinor,
      taxMinor: session.taxMinor,
      serviceChargeMinor: session.serviceChargeMinor,
      discountMinor: session.discountMinor,
      tipMinor: session.tipMinor,
      totalMinor: session.totalMinor,
      taxBreakdown: invoice.taxBreakdown,
      items: items
        .filter((i) => i.kdsStatus !== 'CANCELLED')
        .map((i) => ({
          name: i.itemNameSnapshot,
          quantity: i.quantity,
          unitPriceMinor: i.unitPriceMinor,
          lineTotalMinor: i.unitPriceMinor * i.quantity + i.taxMinor,
        })),
      payments: payments.map((p) => ({
        method: p.method,
        provider: p.provider,
        amountMinor: p.amountMinor,
        status: p.status,
      })),
      html,
    });
  } catch (err) {
    return apiError(err);
  }
}
