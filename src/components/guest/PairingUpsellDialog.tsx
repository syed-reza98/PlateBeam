'use client';

import { Sparkles, Plus } from 'lucide-react';
import Image from 'next/image';
import { Dialog } from '@/components/ui/Dialog';
import { formatMoney, type GuestMenuItem, type GuestUpsellRule } from './types';

interface PairingUpsellDialogProps {
  open: boolean;
  onClose: () => void;
  triggerItem: GuestMenuItem | null;
  rule: GuestUpsellRule | null;
  suggestedItem: GuestMenuItem | null;
  currency: string;
  onAcceptUpsell: (item: GuestMenuItem, promoPriceMinor?: number) => void;
}

export function PairingUpsellDialog({
  open,
  onClose,
  triggerItem,
  rule,
  suggestedItem,
  currency,
  onAcceptUpsell,
}: PairingUpsellDialogProps) {
  if (!triggerItem || !suggestedItem) return null;

  const originalPrice = suggestedItem.basePriceMinor;
  const promoPrice = rule?.discountMinor ?? originalPrice;
  const savings = Math.max(0, originalPrice - promoPrice);

  return (
    <Dialog open={open} onClose={onClose} title="Chef's Recommended Pairing">
      <div className="space-y-5 py-2">
        {/* Banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--pb-accent)]/30 bg-[var(--pb-accent)]/10 p-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--pb-accent)] text-[var(--pb-accent-ink)] shadow-md">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-base font-bold tracking-tight text-[var(--pb-ink)]">
              {rule?.promoLabel ?? 'Perfect Taste Pairing'}
            </p>
            <p className="text-xs text-[var(--pb-muted)]">
              Pairs exceptionally with your <span className="font-semibold text-[var(--pb-ink)]">{triggerItem.name}</span>
            </p>
          </div>
        </div>

        {/* Suggested Item Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] p-4 transition-all">
          {suggestedItem.imageUrl ? (
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)]">
              <Image
                src={suggestedItem.imageUrl}
                alt={suggestedItem.name}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-[var(--pb-surface)] border border-[var(--pb-border)] text-3xl font-serif">
              🍛
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--pb-olive)]" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
                {suggestedItem.dietaryType}
              </p>
            </div>
            <h4 className="mt-1 font-serif text-lg font-bold leading-tight text-[var(--pb-ink)] truncate">
              {suggestedItem.name}
            </h4>
            <p className="mt-0.5 line-clamp-1 text-xs text-[var(--pb-muted)]">
              {suggestedItem.description ?? 'Chef handcrafted accompaniment'}
            </p>

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-base font-bold text-[var(--pb-accent)]">
                {formatMoney(promoPrice, currency)}
              </span>
              {savings > 0 && (
                <>
                  <span className="font-mono text-xs text-[var(--pb-muted)] line-through">
                    {formatMoney(originalPrice, currency)}
                  </span>
                  <span className="rounded-full bg-[var(--pb-olive)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--pb-olive)]">
                    Save {formatMoney(savings, currency)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] py-3 text-xs font-semibold text-[var(--pb-muted)] hover:text-[var(--pb-ink)] hover:border-[var(--pb-accent)] active:scale-98 transition-all"
          >
            No thanks, just {triggerItem.name}
          </button>
          <button
            type="button"
            onClick={() => {
              onAcceptUpsell(suggestedItem, promoPrice);
              onClose();
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--pb-accent)] py-3 text-xs font-bold text-[var(--pb-accent-ink)] hover:opacity-95 active:scale-98 shadow-md glow-accent transition-all"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Pairing ({formatMoney(promoPrice, currency)})
          </button>
        </div>
      </div>
    </Dialog>
  );
}
