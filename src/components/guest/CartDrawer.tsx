'use client';

import { useMemo } from 'react';
import { Minus, Plus, ShoppingBag, Sparkles, Trash2, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { GUEST_DIALOG_CLASS } from './GuestPortalClient';
import {
  formatMoney,
  type GuestCartItem,
  type GuestMenuItem,
  type GuestUpsellRule,
} from './types';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: GuestCartItem[];
  menuItems: GuestMenuItem[];
  upsellRules: GuestUpsellRule[];
  currency: string;
  isSubmitting: boolean;
  onUpdateQty: (cartItemId: string, nextQty: number) => void;
  onQuickAddUpsell: (item: GuestMenuItem) => void;
  onPlaceOrder: () => void;
}

export function CartDrawer({
  open,
  onClose,
  cart,
  menuItems,
  upsellRules,
  currency,
  isSubmitting,
  onUpdateQty,
  onQuickAddUpsell,
  onPlaceOrder,
}: CartDrawerProps) {
  const cartSubtotalMinor = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0),
    [cart],
  );

  const upsellSuggestions = useMemo(() => {
    if (cart.length === 0) return [];
    const cartItemIds = new Set(cart.map((c) => c.menuItemId));
    const cartCategoryIds = new Set(
      cart
        .map((c) => menuItems.find((m) => m.id === c.menuItemId)?.categoryId)
        .filter((id): id is string => Boolean(id)),
    );

    const matched: Array<{ rule: GuestUpsellRule; item: GuestMenuItem }> = [];
    const seen = new Set<string>();

    for (const rule of upsellRules) {
      if (cartItemIds.has(rule.suggestedMenuItemId) || seen.has(rule.suggestedMenuItemId)) {
        continue;
      }
      const triggerMatch =
        (rule.triggerMenuItemId && cartItemIds.has(rule.triggerMenuItemId)) ||
        (rule.triggerCategoryId && cartCategoryIds.has(rule.triggerCategoryId)) ||
        (!rule.triggerMenuItemId && !rule.triggerCategoryId);

      if (!triggerMatch) continue;
      const suggested = menuItems.find(
        (m) => m.id === rule.suggestedMenuItemId && m.isAvailable,
      );
      if (suggested) {
        seen.add(suggested.id);
        matched.push({ rule, item: suggested });
      }
    }

    return matched.slice(0, 3);
  }, [cart, menuItems, upsellRules]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Shared Table Cart"
      closedby="any"
      className={GUEST_DIALOG_CLASS}
    >
      {cart.length === 0 ? (
        <div className="py-8 text-center">
          <ShoppingBag
            className="mx-auto size-10 text-zinc-400"
            aria-hidden="true"
          />
          <p className="mt-3 font-sans text-lg font-bold text-zinc-900">Your table cart is empty</p>
          <p className="mt-1 text-sm text-zinc-500">
            Add dishes from the menu. Everyone at your table sees updates in real time.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-[#FAF7F2] px-3.5 py-2.5 text-xs font-medium text-zinc-600">
            <Users className="size-4 shrink-0 text-[#FF5412]" aria-hidden="true" />
            <span>Live shared cart synced with everyone at this table.</span>
          </div>

          <ul className="divide-y divide-zinc-100">
            {cart.map((item) => (
              <li key={item.cartItemId} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-zinc-900">{item.name}</p>
                  {item.modifierLabels.length > 0 && (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.modifierLabels.join(' · ')}
                    </p>
                  )}
                  {item.spiceLevel && (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Spice: {item.spiceLevel}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-0.5 text-xs italic text-zinc-500">
                      Note: {item.notes}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] font-semibold text-[#FF5412]">
                    Added by {item.addedByNickname}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="font-mono text-sm font-bold tabular-nums text-zinc-900">
                    {formatMoney(item.unitPriceMinor * item.quantity, currency)}
                  </span>
                  <div className="inline-flex items-center rounded-xl border border-zinc-200 bg-[#FAF7F2]">
                    <button
                      type="button"
                      aria-label={
                        item.quantity === 1
                          ? `Remove ${item.name}`
                          : `Decrease quantity of ${item.name}`
                      }
                      onClick={() => onUpdateQty(item.cartItemId, item.quantity - 1)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-900"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="size-4 text-red-500" aria-hidden="true" />
                      ) : (
                        <Minus className="size-4" aria-hidden="true" />
                      )}
                    </button>
                    <span className="min-w-[1.75rem] text-center font-mono text-xs font-bold tabular-nums text-zinc-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.name}`}
                      onClick={() => onUpdateQty(item.cartItemId, item.quantity + 1)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-900"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Upsell Pairings (FR-008) */}
          {upsellSuggestions.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-zinc-200 bg-[#FAF7F2] p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF5412]">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Chef&apos;s Pairings
              </p>
              <div className="space-y-2">
                {upsellSuggestions.map(({ rule, item }) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-zinc-900">{rule.promoLabel}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {item.name} · {formatMoney(item.basePriceMinor, currency)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickAddUpsell(item)}
                      className="min-h-[44px] shrink-0 rounded-xl border border-[#FF5412] px-3 text-xs font-bold text-[#FF5412] transition-colors hover:bg-[#FF5412] hover:text-white"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtotal + Place Order */}
          <div className="space-y-3 border-t border-zinc-200 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-500">Round Subtotal</span>
              <span className="font-mono text-base font-bold tabular-nums text-zinc-900">
                {formatMoney(cartSubtotalMinor, currency)}
              </span>
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onPlaceOrder}
              className="min-h-[44px] w-full rounded-xl bg-[#FF5412] px-5 py-3 text-sm font-bold text-white shadow-beam transition-colors hover:bg-[#FF7033] disabled:opacity-60"
            >
              {isSubmitting ? 'Sending to Kitchen...' : 'Send Order to Kitchen'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
