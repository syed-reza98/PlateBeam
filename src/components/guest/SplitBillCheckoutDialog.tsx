'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Divide, ListChecks, Wallet } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/ToastRegion';
import type { PaymentMethod, PaymentProvider } from '@/server/db/types';
import {
  formatMoney,
  type GuestOrder,
  type GuestSessionInfo,
  type SplitBillBreakdown,
} from './types';

interface SplitBillCheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  session: GuestSessionInfo;
  orders: GuestOrder[];
  currency: string;
  guestId?: string;
  onPaymentSuccess: () => void;
}

type SplitMode = 'EQUAL' | 'BY_ITEM' | 'CUSTOM';

const TIP_PRESETS = [0, 5, 10, 15];

const PAYMENT_OPTIONS: Array<{
  id: string;
  label: string;
  provider: PaymentProvider;
  method: PaymentMethod;
}> = [
  { id: 'SANDBOX_CARD', label: 'Instant Card / Demo Pay', provider: 'SANDBOX', method: 'CARD' },
  { id: 'SANDBOX_UPI', label: 'UPI Intent / QR', provider: 'SANDBOX', method: 'UPI' },
  { id: 'SSLCOMMERZ_MFS', label: 'bKash / Nagad (MFS)', provider: 'SSLCOMMERZ', method: 'MFS' },
  { id: 'STRIPE_CARD', label: 'Stripe Card / Apple Pay', provider: 'STRIPE', method: 'CARD' },
  { id: 'CASH_EDC', label: 'Pay at Counter / Cash', provider: 'CASH_EDC', method: 'CASH' },
];

export function SplitBillCheckoutDialog({
  open,
  onClose,
  session,
  orders,
  currency,
  guestId,
  onPaymentSuccess,
}: SplitBillCheckoutDialogProps) {
  const [mode, setMode] = useState<SplitMode>('EQUAL');
  const [splitCount, setSplitCount] = useState(1);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [customAmountInput, setCustomAmountInput] = useState('');
  const [tipPct, setTipPct] = useState(10);
  const [paymentOptionId, setPaymentOptionId] = useState('SANDBOX_CARD');
  const [breakdown, setBreakdown] = useState<SplitBillBreakdown | null>(null);
  const [selectedShareIndex, setSelectedShareIndex] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [paying, setPaying] = useState(false);

  const allOrderItems = useMemo(
    () => orders.flatMap((o) => o.items.filter((i) => i.kdsStatus !== 'CANCELLED')),
    [orders],
  );

  const tipMinor = useMemo(
    () => Math.round((session.subtotalMinor * tipPct) / 100),
    [session.subtotalMinor, tipPct],
  );

  const customAmountMinor = useMemo(() => {
    const parsed = Number.parseFloat(customAmountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return session.remainingMinor;
    return Math.min(session.remainingMinor, Math.round(parsed * 100));
  }, [customAmountInput, session.remainingMinor]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const calculate = async () => {
      setCalculating(true);
      try {
        const body =
          mode === 'EQUAL'
            ? { mode, splitCount, tipMinor }
            : mode === 'BY_ITEM'
              ? {
                  mode,
                  tipMinor,
                  itemSelections: selectedItemIds.map((orderItemId) => ({
                    payerLabel: 'Your Share',
                    orderItemId,
                    shareRatio: 1,
                  })),
                }
              : {
                  mode,
                  tipMinor,
                  customAmountsMinor: [customAmountMinor],
                };

        const res = await fetch(`/api/v1/sessions/${session.id}/split-bill/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as SplitBillBreakdown;
          setBreakdown(data);
          setSelectedShareIndex(0);
        }
      } catch {
        // Fallback to local calculation if API unavailable
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };

    void calculate();
    return () => {
      cancelled = true;
    };
  }, [open, mode, splitCount, selectedItemIds, customAmountMinor, tipMinor, session.id]);

  const activeShare = breakdown?.shares[selectedShareIndex];
  const payableAmountMinor =
    activeShare?.amountMinor ??
    (mode === 'CUSTOM'
      ? customAmountMinor
      : Math.ceil(session.remainingMinor / Math.max(1, splitCount)));

  const payableTipMinor = activeShare?.tipMinor ?? tipMinor;

  const handleToggleOrderItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handlePay = async () => {
    const option =
      PAYMENT_OPTIONS.find((p) => p.id === paymentOptionId) ?? PAYMENT_OPTIONS[0];
    if (payableAmountMinor <= 0) {
      showToast({
        title: 'Select an amount to pay',
        variant: 'warning',
      });
      return;
    }

    setPaying(true);
    try {
      const res = await fetch(`/api/v1/sessions/${session.id}/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: option.provider,
          method: option.method,
          amountMinor: payableAmountMinor,
          tipMinor: payableTipMinor,
          splitGroupId:
            mode === 'EQUAL' && splitCount > 1
              ? `split-${selectedShareIndex + 1}-of-${splitCount}`
              : undefined,
          guestId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectUrl?: string | null;
        status?: string;
      };

      if (!res.ok) {
        showToast({
          title: 'Payment failed',
          description: data.error ?? 'Please try another payment method.',
          variant: 'error',
        });
        return;
      }

      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      showToast({
        title: 'Payment recorded',
        description: `${formatMoney(payableAmountMinor + payableTipMinor, currency)} settled.`,
        variant: 'success',
      });
      onPaymentSuccess();
      onClose();
    } catch {
      showToast({
        title: 'Payment error',
        description: 'Could not reach payment gateway.',
        variant: 'error',
      });
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Split & Pay Bill" closedby="any">
      <div className="space-y-5">
        {/* Mode Selector */}
        <div role="tablist" aria-label="Split bill mode" className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'EQUAL', label: 'Split Equal', icon: Divide },
              { id: 'BY_ITEM', label: 'By Item', icon: ListChecks },
              { id: 'CUSTOM', label: 'Custom', icon: Wallet },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(tab.id)}
                className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                    : 'border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[var(--pb-ink)]'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Mode Controls */}
        {mode === 'EQUAL' && (
          <div className="space-y-3 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
                Number of Diners
              </span>
              <div className="inline-flex items-center gap-2">
                {[1, 2, 3, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={splitCount === n}
                    onClick={() => setSplitCount(n)}
                    className={`min-h-[44px] min-w-[44px] rounded-lg border font-mono text-xs font-bold ${
                      splitCount === n
                        ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                        : 'border-[var(--pb-border)] bg-[var(--pb-surface)]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {breakdown && breakdown.shares.length > 1 && (
              <div className="space-y-1.5 border-t border-[var(--pb-border)] pt-2.5">
                <p className="text-xs text-[var(--pb-muted)]">
                  Select which share to pay now:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {breakdown.shares.map((share, idx) => (
                    <button
                      key={`${share.label}-${idx}`}
                      type="button"
                      aria-pressed={selectedShareIndex === idx}
                      onClick={() => setSelectedShareIndex(idx)}
                      className={`min-h-[44px] rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                        selectedShareIndex === idx
                          ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)]/12 font-semibold'
                          : 'border-[var(--pb-border)] bg-[var(--pb-surface)]'
                      }`}
                    >
                      <span className="block">{share.label}</span>
                      <span className="font-mono tabular-nums">
                        {formatMoney(share.amountMinor, currency)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'BY_ITEM' && (
          <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Select Dishes to Pay For
            </p>
            {allOrderItems.map((item) => {
              const checked = selectedItemIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleOrderItem(item.id)}
                      className="size-4 accent-[var(--pb-accent)]"
                    />
                    <span>
                      {item.quantity}× {item.itemNameSnapshot}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(item.lineTotalMinor, currency)}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {mode === 'CUSTOM' && (
          <div className="space-y-1.5">
            <label
              htmlFor="custom-pay-amount"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]"
            >
              Custom Amount (Remaining:{' '}
              {formatMoney(session.remainingMinor, currency)})
            </label>
            <input
              id="custom-pay-amount"
              type="number"
              min="1"
              step="0.01"
              value={customAmountInput}
              onChange={(e) => setCustomAmountInput(e.target.value)}
              placeholder={(session.remainingMinor / 100).toFixed(2)}
              className="min-h-[44px] w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3.5 font-mono text-sm"
            />
          </div>
        )}

        {/* Tipping (FR-027) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Add Staff Tip (Pre-tax)
            </span>
            <span className="font-mono font-semibold tabular-nums">
              {formatMoney(tipMinor, currency)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {TIP_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                aria-pressed={tipPct === pct}
                onClick={() => setTipPct(pct)}
                className={`min-h-[44px] rounded-xl border font-mono text-xs font-semibold ${
                  tipPct === pct
                    ? 'border-[var(--pb-olive)] bg-[var(--pb-olive)] text-white'
                    : 'border-[var(--pb-border)] bg-[var(--pb-canvas)]'
                }`}
              >
                {pct === 0 ? 'No Tip' : `${pct}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            Payment Method
          </p>
          <div className="space-y-1.5">
            {PAYMENT_OPTIONS.map((opt) => {
              const active = paymentOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPaymentOptionId(opt.id)}
                  className={`flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3.5 text-left text-xs font-medium ${
                    active
                      ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)]/10 font-semibold'
                      : 'border-[var(--pb-border)] bg-[var(--pb-canvas)]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {active && (
                    <CheckCircle2
                      className="size-4 text-[var(--pb-accent)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pay CTA */}
        <button
          type="button"
          disabled={paying || calculating}
          onClick={handlePay}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--pb-accent)] px-5 py-3 text-sm font-semibold text-[var(--pb-accent-ink)] disabled:opacity-60"
        >
          <CreditCard className="size-4" aria-hidden="true" />
          {paying
            ? 'Processing Payment...'
            : `Pay ${formatMoney(payableAmountMinor + payableTipMinor, currency)}`}
        </button>
      </div>
    </Dialog>
  );
}
