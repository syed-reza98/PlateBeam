'use client';

import {
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  Receipt,
  Utensils,
  XCircle,
} from 'lucide-react';
import type { KdsStatus } from '@/server/db/types';
import {
  formatMoney,
  type GuestOrder,
  type GuestSessionInfo,
} from './types';

interface OrderTabTrackerProps {
  currency: string;
  session: GuestSessionInfo;
  orders: GuestOrder[];
  onOpenCheckout: () => void;
  onOpenReceipt: () => void;
}

const KDS_STATUS_META: Record<
  KdsStatus,
  { label: string; className: string; icon: typeof Clock }
> = {
  PENDING: {
    label: 'Received',
    className: 'border-zinc-200 bg-[#FAF7F2] text-zinc-600',
    icon: Clock,
  },
  ACCEPTED: {
    label: 'Queued',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Clock,
  },
  PREPARING: {
    label: 'Cooking',
    className: 'border-[#FF5412]/40 bg-[#FF5412]/10 text-[#FF5412]',
    icon: ChefHat,
  },
  READY: {
    label: 'Ready to Serve',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: Utensils,
  },
  SERVED: {
    label: 'Served',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'border-red-200 bg-red-50 text-red-600',
    icon: XCircle,
  },
};

export function OrderTabTracker({
  currency,
  session,
  orders,
  onOpenCheckout,
  onOpenReceipt,
}: OrderTabTrackerProps) {
  const isPaid = session.status === 'PAID' || session.remainingMinor <= 0;

  return (
    <section aria-label="Running table tab and orders" className="space-y-4">
      {/* Running Bill Summary Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Running Table Tab
            </p>
            <h2 className="mt-0.5 font-sans text-[clamp(1.125rem,1rem+0.9vw,1.5rem)] font-extrabold tracking-tight text-zinc-900">
              {orders.length === 0
                ? 'No rounds sent yet'
                : `${orders.length} ${orders.length === 1 ? 'Round' : 'Rounds'} Ordered`}
            </h2>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
              isPaid
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-[#FF5412]/30 bg-[#FF5412]/10 text-[#FF5412]'
            }`}
          >
            {isPaid ? (
              <>
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Settled
              </>
            ) : (
              <>
                <Clock className="size-3.5" aria-hidden="true" />
                {session.status.replace('_', ' ')}
              </>
            )}
          </span>
        </div>

        {orders.length > 0 && (
          <dl className="mt-4 space-y-1.5 border-t border-zinc-100 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Subtotal</dt>
              <dd className="font-mono font-medium tabular-nums text-zinc-900">
                {formatMoney(session.subtotalMinor, currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Taxes</dt>
              <dd className="font-mono font-medium tabular-nums text-zinc-900">
                {formatMoney(session.taxMinor, currency)}
              </dd>
            </div>
            {session.serviceChargeMinor > 0 && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">Service Charge</dt>
                <dd className="font-mono font-medium tabular-nums text-zinc-900">
                  {formatMoney(session.serviceChargeMinor, currency)}
                </dd>
              </div>
            )}
            {session.discountMinor > 0 && (
              <div className="flex justify-between font-medium text-emerald-600">
                <dt>Discounts / Loyalty Voucher</dt>
                <dd className="font-mono tabular-nums">
                  -{formatMoney(session.discountMinor, currency)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold text-zinc-900">
              <dt>Grand Total</dt>
              <dd className="font-mono tabular-nums">
                {formatMoney(session.totalMinor, currency)}
              </dd>
            </div>
            {session.paidMinor > 0 && (
              <div className="flex justify-between text-xs font-medium text-emerald-600">
                <dt>Paid So Far</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoney(session.paidMinor, currency)}
                </dd>
              </div>
            )}
            {!isPaid && session.remainingMinor > 0 && (
              <div className="flex justify-between text-sm font-bold text-[#FF5412]">
                <dt>Balance Due</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoney(session.remainingMinor, currency)}
                </dd>
              </div>
            )}
          </dl>
        )}

        {orders.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!isPaid && session.remainingMinor > 0 && (
              <button
                type="button"
                onClick={onOpenCheckout}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF5412] px-4 py-2.5 text-sm font-bold text-white shadow-beam transition-colors hover:bg-[#FF7033]"
              >
                <CreditCard className="size-4" aria-hidden="true" />
                Split &amp; Pay Bill
              </button>
            )}
            {(isPaid || session.invoiceId) && (
              <button
                type="button"
                onClick={onOpenReceipt}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-[#FAF7F2] px-4 py-2.5 text-sm font-bold text-zinc-900 transition-colors hover:border-[#FF5412]"
              >
                <Receipt className="size-4" aria-hidden="true" />
                Receipt &amp; Review
              </button>
            )}
          </div>
        )}
      </div>

      {/* Round-by-Round Timeline */}
      {orders.map((order, idx) => (
        <article
          key={order.id}
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
            <div>
              <p className="font-mono text-xs font-bold text-zinc-600">
                ROUND {orders.length - idx} · #{order.orderNumber}
                {order.tokenNumber ? ` · Token #${order.tokenNumber}` : ''}
              </p>
              <p className="text-xs text-zinc-500">
                {new Date(order.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-[#FAF7F2] px-2.5 py-0.5 text-[11px] font-bold text-zinc-700">
              {order.status.replace('_', ' ')}
            </span>
          </div>

          <ul className="divide-y divide-zinc-100">
            {order.items.map((item) => {
              const statusMeta = KDS_STATUS_META[item.kdsStatus];
              const StatusIcon = statusMeta.icon;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-900">
                      <span className="font-mono text-xs text-zinc-500">
                        {item.quantity}×{' '}
                      </span>
                      {item.itemNameSnapshot}
                    </p>
                    {item.spiceLevel && (
                      <p className="text-xs text-zinc-500">
                        Spice: {item.spiceLevel}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs italic text-zinc-500">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusMeta.className}`}
                    >
                      <StatusIcon className="size-3" aria-hidden="true" />
                      {statusMeta.label}
                    </span>
                    <span className="font-mono text-xs font-semibold text-zinc-600 tabular-nums">
                      {formatMoney(item.lineTotalMinor, currency)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </section>
  );
}
