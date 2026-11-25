'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  Receipt,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { showToast } from '@/components/ui/ToastRegion';
import { CallWaiterDialog } from './CallWaiterDialog';
import { CartDrawer } from './CartDrawer';
import { ItemModifierDialog } from './ItemModifierDialog';
import { PairingUpsellDialog } from './PairingUpsellDialog';
import { MenuBrowser } from './MenuBrowser';
import { OrderTabTracker } from './OrderTabTracker';
import { ReceiptReviewDialog } from './ReceiptReviewDialog';
import { SpiceQuizDialog } from './SpiceQuizDialog';
import { SplitBillCheckoutDialog } from './SplitBillCheckoutDialog';
import {
  formatMoney,
  type BootstrapPayload,
  type GuestCartItem,
  type GuestLeaderboardEntry,
  type GuestMenuItem,
} from './types';
import { WaitExperienceCard } from './WaitExperienceCard';

interface GuestPortalClientProps {
  qrToken: string;
}

type ActiveTab = 'MENU' | 'TAB';

export function GuestPortalClient({ qrToken }: GuestPortalClientProps) {
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('MENU');
  const [guestNickname, setGuestNickname] = useState('Guest');
  const [guestId, setGuestId] = useState<string | undefined>(undefined);

  // Dialog states
  const [selectedItem, setSelectedItem] = useState<GuestMenuItem | null>(null);
  const [upsellCandidate, setUpsellCandidate] = useState<{
    triggerItem: GuestMenuItem;
    rule: typeof data extends null ? null : (NonNullable<typeof data>)['upsellRules'][number];
    suggestedItem: GuestMenuItem;
  } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        let storedNick = localStorage.getItem('pb_guest_nickname');
        if (!storedNick) {
          storedNick = `Diner-${Math.floor(100 + Math.random() * 900)}`;
          localStorage.setItem('pb_guest_nickname', storedNick);
        }
        setGuestNickname(storedNick);

        const storedGuestId = localStorage.getItem('pb_guest_id');
        if (storedGuestId) setGuestId(storedGuestId);
      } catch {
        // Ignore storage errors
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (guestId) params.set('guestId', guestId);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(
        `/api/v1/public/qr/${encodeURIComponent(qrToken)}/bootstrap${queryStr}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Unable to load table menu (${res.status})`);
      }
      const payload = (await res.json()) as BootstrapPayload;
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [qrToken, guestId]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void fetchBootstrap();
    });
    return () => cancelAnimationFrame(id);
  }, [fetchBootstrap]);

  // Realtime SSE subscription for 86 sync, shared cart, KDS status, & payment updates
  useEffect(() => {
    if (!data?.outlet.id || !data?.session.id) return;
    const url = `/api/v1/realtime/stream?outletId=${encodeURIComponent(
      data.outlet.id,
    )}&sessionId=${encodeURIComponent(data.session.id)}`;

    const es = new EventSource(url);

    es.addEventListener('menu.availability_changed', (event) => {
      try {
        const msg = JSON.parse((event as MessageEvent).data) as {
          menuItemId: string;
          isAvailable: boolean;
          name?: string;
        };
        setData((prev) =>
          prev
            ? {
                ...prev,
                menuItems: prev.menuItems.map((m) =>
                  m.id === msg.menuItemId ? { ...m, isAvailable: msg.isAvailable } : m,
                ),
              }
            : prev,
        );
        if (!msg.isAvailable && msg.name) {
          showToast({
            title: `${msg.name} just sold out`,
            variant: 'warning',
          });
        }
      } catch {
        // Ignore malformed event
      }
    });

    es.addEventListener('cart.updated', (event) => {
      try {
        const msg = JSON.parse((event as MessageEvent).data) as {
          sharedCart: GuestCartItem[];
        };
        if (Array.isArray(msg.sharedCart)) {
          setData((prev) => (prev ? { ...prev, sharedCart: msg.sharedCart } : prev));
        }
      } catch {
        // Ignore
      }
    });

    const refreshEvents = ['order.created', 'kds.item_updated', 'payment.captured', 'session.updated'];
    for (const evtName of refreshEvents) {
      es.addEventListener(evtName, () => {
        void fetchBootstrap();
      });
    }

    return () => {
      es.close();
    };
  }, [data?.outlet.id, data?.session.id, fetchBootstrap]);

  const syncCartToServer = async (nextCart: GuestCartItem[]) => {
    if (!data) return;
    setData((prev) => (prev ? { ...prev, sharedCart: nextCart } : prev));
    try {
      await fetch(`/api/v1/sessions/${data.session.id}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestNickname,
          items: nextCart.map((c) => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
            modifierIds: c.modifierIds,
            spiceLevel: c.spiceLevel,
            notes: c.notes,
          })),
        }),
      });
    } catch {
      // Optimistic state kept; user can retry
    }
  };

  const handleAddToCart = (cartItem: GuestCartItem) => {
    if (!data) return;
    const nextCart = [...data.sharedCart, cartItem];
    void syncCartToServer(nextCart);
    showToast({
      title: `Added ${cartItem.name}`,
      description: 'Synced to shared table cart',
      variant: 'success',
    });

    // Check if an upsell rule applies to this item
    const rule = data.upsellRules.find(
      (r) =>
        r.triggerMenuItemId === cartItem.menuItemId ||
        (r.triggerCategoryId &&
          data.menuItems.find((m) => m.id === cartItem.menuItemId)?.categoryId ===
            r.triggerCategoryId),
    );
    if (rule) {
      const triggerItem = data.menuItems.find((m) => m.id === cartItem.menuItemId);
      const suggestedItem = data.menuItems.find((m) => m.id === rule.suggestedMenuItemId);
      if (triggerItem && suggestedItem && suggestedItem.isAvailable) {
        setTimeout(() => {
          setUpsellCandidate({ triggerItem, rule, suggestedItem });
        }, 400);
      }
    }
  };

  const handleQuickAddUpsell = (item: GuestMenuItem) => {
    handleAddToCart({
      cartItemId: crypto.randomUUID(),
      menuItemId: item.id,
      name: item.name,
      unitPriceMinor: item.basePriceMinor,
      quantity: 1,
      modifierIds: [],
      modifierLabels: [],
      addedByNickname: guestNickname,
    });
  };

  const handleUpdateCartQty = (cartItemId: string, nextQty: number) => {
    if (!data) return;
    const nextCart =
      nextQty <= 0
        ? data.sharedCart.filter((c) => c.cartItemId !== cartItemId)
        : data.sharedCart.map((c) =>
            c.cartItemId === cartItemId ? { ...c, quantity: nextQty } : c,
          );
    void syncCartToServer(nextCart);
  };

  const handlePlaceOrder = async () => {
    if (!data || data.sharedCart.length === 0) return;
    setPlacingOrder(true);
    try {
      const res = await fetch(`/api/v1/sessions/${data.session.id}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'QR',
          guestId,
          idempotencyKey: crypto.randomUUID(),
          items: data.sharedCart.map((c) => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
            modifierIds: c.modifierIds,
            spiceLevel: c.spiceLevel,
            notes: c.notes,
          })),
        }),
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast({
          title: 'Could not place order',
          description: body.error ?? 'Please try again.',
          variant: 'error',
        });
        return;
      }

      setCartOpen(false);
      setActiveTab('TAB');
      showToast({
        title: 'Order sent to kitchen!',
        description: 'Track live prep progress on your Tab.',
        variant: 'success',
      });
      await fetchBootstrap();
    } catch {
      showToast({
        title: 'Network error',
        description: 'Check your connection and try again.',
        variant: 'error',
      });
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleScoreSubmitted = (entry: GuestLeaderboardEntry) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            leaderboard: [entry, ...(prev.leaderboard ?? [])]
              .sort((a, b) => b.score - a.score)
              .slice(0, 10),
          }
        : prev,
    );
  };

  const cartCount = useMemo(
    () => data?.sharedCart.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [data?.sharedCart],
  );

  const cartTotalMinor = useMemo(
    () =>
      data?.sharedCart.reduce(
        (sum, item) => sum + item.unitPriceMinor * item.quantity,
        0,
      ) ?? 0,
    [data?.sharedCart],
  );

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--pb-canvas)] px-4 py-12 text-center">
        <p className="font-display text-2xl">Syncing table channel…</p>
        <p className="mt-2 text-sm text-[var(--pb-muted)]">
          Loading live menu and table session
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-dvh bg-[var(--pb-canvas)] px-4 py-14">
        <div className="mx-auto max-w-md rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-6 text-center">
          <AlertCircle
            className="mx-auto size-10 text-[var(--pb-chili)]"
            aria-hidden="true"
          />
          <h1 className="mt-3 font-display text-2xl">QR Code Unavailable</h1>
          <p className="mt-2 text-sm text-[var(--pb-muted)]">
            {error ?? 'This table QR code could not be verified. Please ask your server for assistance.'}
          </p>
          <button
            type="button"
            onClick={() => void fetchBootstrap()}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-sm bg-[var(--pb-accent)] px-5 text-sm font-semibold text-[var(--pb-accent-ink)]"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--pb-canvas)] pb-28">
      {/* Header */}
      <header className="border-b border-[var(--pb-border)] bg-[var(--pb-surface)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-[var(--pb-accent)] font-display text-lg text-[var(--pb-accent-ink)]">
                {data.outlet.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-xl leading-none tracking-tight">
                  {data.outlet.name}
                </h1>
                <p className="mt-0.5 truncate text-xs text-[var(--pb-muted)]">
                  {data.table
                    ? `Table ${data.table.tableNumber}${
                        data.table.zoneName ? ` · ${data.table.zoneName}` : ''
                      }`
                    : 'Counter / Takeaway'}
                  {' · '}
                  {guestNickname}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto flex max-w-3xl gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('MENU')}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-sm border text-xs font-semibold transition-colors ${
              activeTab === 'MENU'
                ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                : 'border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[var(--pb-ink)]'
            }`}
          >
            <UtensilsCrossed className="size-4" aria-hidden="true" />
            Menu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TAB')}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-sm border text-xs font-semibold transition-colors ${
              activeTab === 'TAB'
                ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                : 'border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[var(--pb-ink)]'
            }`}
          >
            <Receipt className="size-4" aria-hidden="true" />
            Tab &amp; Status
            {data.orders.length > 0 && (
              <span className="rounded-full bg-[var(--pb-surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--pb-ink)]">
                {data.orders.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-5">
        {activeTab === 'MENU' ? (
          <MenuBrowser
            currency={data.outlet.currency}
            categories={data.categories}
            menuItems={data.menuItems}
            onSelectItem={(item) => setSelectedItem(item)}
          />
        ) : (
          <div className="space-y-5">
            <WaitExperienceCard
              outlet={data.outlet}
              session={data.session}
              orders={data.orders}
              loyalty={data.loyalty}
              onOpenSpiceQuiz={() => setQuizOpen(true)}
            />
            <OrderTabTracker
              currency={data.outlet.currency}
              session={data.session}
              orders={data.orders}
              onOpenCheckout={() => setCheckoutOpen(true)}
              onOpenReceipt={() => setReceiptOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Persistent Bottom Action Bar */}
      <div className="pb-safe-bottom-bar fixed inset-x-0 bottom-0 z-30 border-t border-[var(--pb-border)] bg-[var(--pb-surface)]/95 pt-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5">
          <button
            type="button"
            onClick={() => setWaiterOpen(true)}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3.5 text-xs font-semibold text-[var(--pb-ink)] hover:border-[var(--pb-accent)]"
          >
            <BellRing className="size-4 text-[var(--pb-accent)]" aria-hidden="true" />
            Call Waiter
          </button>

          {cartCount > 0 ? (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-between rounded-sm bg-[var(--pb-accent)] px-4 text-sm font-semibold text-[var(--pb-accent-ink)]"
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingBag className="size-4" aria-hidden="true" />
                View Cart ({cartCount})
              </span>
              <span className="font-mono tabular-nums">
                {formatMoney(cartTotalMinor, data.outlet.currency)}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                data.orders.length > 0 && data.session.remainingMinor > 0
                  ? setCheckoutOpen(true)
                  : setCartOpen(true)
              }
              className="inline-flex min-h-[44px] flex-1 items-center justify-between rounded-sm bg-[var(--pb-ink)] px-4 text-sm font-semibold text-[var(--pb-canvas)]"
            >
              <span>
                {data.orders.length > 0 && data.session.remainingMinor > 0
                  ? 'Split & Pay Bill'
                  : 'Table Cart (0)'}
              </span>
              {data.orders.length > 0 && data.session.remainingMinor > 0 && (
                <span className="font-mono tabular-nums">
                  {formatMoney(data.session.remainingMinor, data.outlet.currency)}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Modals & Drawers */}
      <ItemModifierDialog
        key={selectedItem?.id ?? 'none'}
        open={Boolean(selectedItem)}
        item={selectedItem}
        modifiers={data.modifiers}
        currency={data.outlet.currency}
        guestNickname={guestNickname}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCart}
      />

      <PairingUpsellDialog
        open={Boolean(upsellCandidate)}
        onClose={() => setUpsellCandidate(null)}
        triggerItem={upsellCandidate?.triggerItem ?? null}
        rule={upsellCandidate?.rule ?? null}
        suggestedItem={upsellCandidate?.suggestedItem ?? null}
        currency={data.outlet.currency}
        onAcceptUpsell={(item, promoPrice) => {
          handleAddToCart({
            cartItemId: crypto.randomUUID(),
            menuItemId: item.id,
            name: item.name,
            unitPriceMinor: promoPrice ?? item.basePriceMinor,
            quantity: 1,
            modifierIds: [],
            modifierLabels: ['Chef Pairing Deal'],
            addedByNickname: guestNickname,
          });
        }}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={data.sharedCart}
        menuItems={data.menuItems}
        upsellRules={data.upsellRules}
        currency={data.outlet.currency}
        isSubmitting={placingOrder}
        onUpdateQty={handleUpdateCartQty}
        onQuickAddUpsell={handleQuickAddUpsell}
        onPlaceOrder={handlePlaceOrder}
      />

      <CallWaiterDialog
        open={waiterOpen}
        onClose={() => setWaiterOpen(false)}
        sessionId={data.session.id}
        tableId={data.table?.id ?? null}
      />

      <SpiceQuizDialog
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        sessionId={data.session.id}
        playerNickname={guestNickname}
        tableNumber={data.table?.tableNumber ?? null}
        leaderboard={data.leaderboard ?? []}
        onScoreSubmitted={handleScoreSubmitted}
      />

      <SplitBillCheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        session={data.session}
        orders={data.orders}
        currency={data.outlet.currency}
        guestId={guestId}
        onPaymentSuccess={() => void fetchBootstrap()}
      />

      <ReceiptReviewDialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        sessionId={data.session.id}
        invoiceId={data.session.invoiceId}
        guestId={guestId}
        outlet={data.outlet}
      />
    </div>
  );
}
