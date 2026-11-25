'use client';

import { useMemo } from 'react';
import { Minus, Plus, ShoppingBag, Sparkles, Trash2, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
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
    <Dialog open={open} onClose={onClose} title="Shared Table Cart" closedby="any">
      {cart.length === 0 ? (
        <div className="py-8 text-center">
          <ShoppingBag
            className="mx-auto size-10 text-[var(--pb-muted)]"
            aria-hidden="true"
          />
          <p className="mt-3 font-display text-xl">Your table cart is empty</p>
          <p className="mt-1 text-sm text-[var(--pb-muted)]">
            Add dishes from the menu. Everyone at your table sees updates in real time.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 py-2 text-xs text-[var(--pb-muted)]">
            <Users className="size-4 shrink-0 text-[var(--pb-accent)]" aria-hidden="true" />
            <span>Live shared cart synced with everyone at this table.</span>
          </div>

          <ul className="divide-y divide-[var(--pb-border)]">
            {cart.map((item) => (
              <li key={item.cartItemId} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{item.name}</p>
                  {item.modifierLabels.length > 0 && (
                    <p className="mt-0.5 text-xs text-[var(--pb-muted)]">
                      {item.modifierLabels.join(' · ')}
                    </p>
                  )}
                  {item.spiceLevel && (
                    <p className="mt-0.5 text-xs text-[var(--pb-muted)]">
                      Spice: {item.spiceLevel}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-0.5 text-xs italic text-[var(--pb-muted)]">
                      Note: {item.notes}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-[var(--pb-accent)]">
                    Added by {item.addedByNickname}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {formatMoney(item.unitPriceMinor * item.quantity, currency)}
                  </span>
                  <div className="inline-flex items-center rounded-lg border border-[var(--pb-border)] bg-[var(--pb-canvas)]">
                    <button
                      type="button"
                      aria-label={
                        item.quantity === 1
                          ? `Remove ${item.name}`
                          : `Decrease quantity of ${item.name}`
                      }
                      onClick={() => onUpdateQty(item.cartItemId, item.quantity - 1)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--pb-ink)]"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="size-4 text-[var(--pb-chili)]" aria-hidden="true" />
                      ) : (
                        <Minus className="size-4" aria-hidden="true" />
                      )}
                    </button>
                    <span className="min-w-[1.75rem] text-center font-mono text-xs font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.name}`}
                      onClick={() => onUpdateQty(item.cartItemId, item.quantity + 1)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--pb-ink)]"
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
            <div className="space-y-2 rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--pb-accent)]">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Chef&apos;s Pairings
              </p>
              <div className="space-y-2">
                {upsellSuggestions.map(({ rule, item }) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{rule.promoLabel}</p>
                      <p className="truncate text-[11px] text-[var(--pb-muted)]">
                        {item.name} · {formatMoney(item.basePriceMinor, currency)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickAddUpsell(item)}
                      className="min-h-[44px] shrink-0 rounded-lg border border-[var(--pb-accent)] px-3 text-xs font-semibold text-[var(--pb-accent)] hover:bg-[var(--pb-accent)] hover:text-[var(--pb-accent-ink)]"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtotal + Place Order */}
          <div className="space-y-3 border-t border-[var(--pb-border)] pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--pb-muted)]">Round Subtotal</span>
              <span className="font-mono text-base font-bold tabular-nums">
                {formatMoney(cartSubtotalMinor, currency)}
              </span>
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onPlaceOrder}
              className="min-h-[44px] w-full rounded-sm bg-[var(--pb-accent)] px-5 py-3 text-sm font-semibold text-[var(--pb-accent-ink)] transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {isSubmitting ? 'Sending to Kitchen...' : 'Send Order to Kitchen'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
