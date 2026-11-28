'use client';

import { Sparkles, Plus } from 'lucide-react';
import Image from 'next/image';
import { Dialog } from '@/components/ui/Dialog';
import { GUEST_DIALOG_CLASS } from './GuestPortalClient';
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Chef's Recommended Pairing"
      closedby="any"
      className={GUEST_DIALOG_CLASS}
    >
      <div className="space-y-5 py-1">
        {/* Banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-[#FF5412]/25 bg-[#FF5412]/8 p-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5412] text-white shadow-sm">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-sans text-sm font-bold tracking-tight text-zinc-900">
              {rule?.promoLabel ?? 'Perfect Taste Pairing'}
            </p>
            <p className="text-xs text-zinc-500">
              Pairs exceptionally with your <span className="font-semibold text-zinc-900">{triggerItem.name}</span>
            </p>
          </div>
        </div>

        {/* Suggested Item Card */}
        <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-[#FAF7F2] p-4">
          {suggestedItem.imageUrl ? (
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <Image
                src={suggestedItem.imageUrl}
                alt={suggestedItem.name}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-3xl">
              🍛
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                {suggestedItem.dietaryType}
              </p>
            </div>
            <h4 className="mt-1 truncate font-sans text-base font-bold leading-tight text-zinc-900">
              {suggestedItem.name}
            </h4>
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
              {suggestedItem.description ?? 'Chef handcrafted accompaniment'}
            </p>

            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-base font-bold text-[#FF5412]">
                {formatMoney(promoPrice, currency)}
              </span>
              {savings > 0 && (
                <>
                  <span className="font-mono text-xs text-zinc-400 line-through">
                    {formatMoney(originalPrice, currency)}
                  </span>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Save {formatMoney(savings, currency)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-xl border border-zinc-200 bg-[#FAF7F2] px-3 py-2.5 text-xs font-bold text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900"
          >
            No thanks, just {triggerItem.name}
          </button>
          <button
            type="button"
            onClick={() => {
              onAcceptUpsell(suggestedItem, promoPrice);
              onClose();
            }}
            className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#FF5412] px-3 py-2.5 text-xs font-bold text-white shadow-beam transition-colors hover:bg-[#FF7033]"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Pairing ({formatMoney(promoPrice, currency)})
          </button>
        </div>
      </div>
    </Dialog>
  );
}
