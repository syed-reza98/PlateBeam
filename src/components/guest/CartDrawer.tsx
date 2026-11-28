'use client';

import { Dialog } from '@/components/ui/Dialog';
import { GUEST_DIALOG_CLASS } from './GuestPortalClient';
import { CartPanel } from './CartPanel';
import type { GuestCartItem, GuestMenuItem, GuestUpsellRule } from './types';

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
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Shared Table Cart"
      closedby="any"
      className={GUEST_DIALOG_CLASS}
    >
      <CartPanel
        cart={cart}
        menuItems={menuItems}
        upsellRules={upsellRules}
        currency={currency}
        isSubmitting={isSubmitting}
        onUpdateQty={onUpdateQty}
        onQuickAddUpsell={onQuickAddUpsell}
        onPlaceOrder={onPlaceOrder}
      />
    </Dialog>
  );
}
