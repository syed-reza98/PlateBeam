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
    className: 'border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[var(--pb-muted)]',
    icon: Clock,
  },
  ACCEPTED: {
    label: 'Queued',
    className: 'border-[var(--pb-turmeric)]/50 bg-[var(--pb-turmeric)]/12 text-[var(--pb-turmeric)]',
    icon: Clock,
  },
  PREPARING: {
    label: 'Cooking',
    className: 'border-[var(--pb-accent)]/50 bg-[var(--pb-accent)]/12 text-[var(--pb-accent)]',
    icon: ChefHat,
  },
  READY: {
    label: 'Ready to Serve',
    className: 'border-[var(--pb-olive)]/50 bg-[var(--pb-olive)]/12 text-[var(--pb-olive)]',
    icon: Utensils,
  },
  SERVED: {
    label: 'Served',
    className: 'border-[var(--pb-olive)] bg-[var(--pb-olive)]/15 text-[var(--pb-olive)]',
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'border-[var(--pb-chili)]/50 bg-[var(--pb-chili)]/12 text-[var(--pb-chili)]',
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
      <div className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Running Table Tab
            </p>
            <h2 className="mt-0.5 font-serif text-2xl tracking-tight">
              {orders.length === 0
                ? 'No rounds sent yet'
                : `${orders.length} ${orders.length === 1 ? 'Round' : 'Rounds'} Ordered`}
            </h2>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              isPaid
                ? 'border-[var(--pb-olive)] bg-[var(--pb-olive)]/12 text-[var(--pb-olive)]'
                : 'border-[var(--pb-accent)]/50 bg-[var(--pb-accent)]/10 text-[var(--pb-accent)]'
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
          <dl className="mt-4 space-y-1.5 border-t border-[var(--pb-border)] pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--pb-muted)]">Subtotal</dt>
              <dd className="font-mono tabular-nums">
                {formatMoney(session.subtotalMinor, currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--pb-muted)]">Taxes</dt>
              <dd className="font-mono tabular-nums">
                {formatMoney(session.taxMinor, currency)}
              </dd>
            </div>
            {session.serviceChargeMinor > 0 && (
              <div className="flex justify-between">
                <dt className="text-[var(--pb-muted)]">Service Charge</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoney(session.serviceChargeMinor, currency)}
                </dd>
              </div>
            )}
            {session.discountMinor > 0 && (
              <div className="flex justify-between text-[var(--pb-olive)]">
                <dt>Discounts</dt>
                <dd className="font-mono tabular-nums">
                  -{formatMoney(session.discountMinor, currency)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--pb-border)] pt-2 text-base font-bold">
              <dt>Grand Total</dt>
              <dd className="font-mono tabular-nums">
                {formatMoney(session.totalMinor, currency)}
              </dd>
            </div>
            {session.paidMinor > 0 && (
              <div className="flex justify-between text-xs text-[var(--pb-olive)]">
                <dt>Paid So Far</dt>
                <dd className="font-mono tabular-nums">
                  {formatMoney(session.paidMinor, currency)}
                </dd>
              </div>
            )}
            {!isPaid && session.remainingMinor > 0 && (
              <div className="flex justify-between text-sm font-semibold text-[var(--pb-accent)]">
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
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--pb-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--pb-accent-ink)]"
              >
                <CreditCard className="size-4" aria-hidden="true" />
                Split &amp; Pay Bill
              </button>
            )}
            {(isPaid || session.invoiceId) && (
              <button
                type="button"
                onClick={onOpenReceipt}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-4 py-2.5 text-sm font-semibold text-[var(--pb-ink)] hover:border-[var(--pb-accent)]"
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
          className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--pb-border)] pb-2.5">
            <div>
              <p className="font-mono text-xs font-semibold text-[var(--pb-muted)]">
                ROUND {orders.length - idx} · #{order.orderNumber}
                {order.tokenNumber ? ` · Token #${order.tokenNumber}` : ''}
              </p>
              <p className="text-xs text-[var(--pb-muted)]">
                {new Date(order.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <span className="rounded-full border border-[var(--pb-border)] px-2.5 py-0.5 text-[11px] font-semibold">
              {order.status.replace('_', ' ')}
            </span>
          </div>

          <ul className="divide-y divide-[var(--pb-border)]">
            {order.items.map((item) => {
              const statusMeta = KDS_STATUS_META[item.kdsStatus];
              const StatusIcon = statusMeta.icon;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="font-mono text-xs text-[var(--pb-muted)]">
                        {item.quantity}×{' '}
                      </span>
                      {item.itemNameSnapshot}
                    </p>
                    {item.spiceLevel && (
                      <p className="text-xs text-[var(--pb-muted)]">
                        Spice: {item.spiceLevel}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs italic text-[var(--pb-muted)]">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}
                    >
                      <StatusIcon className="size-3" aria-hidden="true" />
                      {statusMeta.label}
                    </span>
                    <span className="font-mono text-xs text-[var(--pb-muted)] tabular-nums">
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
