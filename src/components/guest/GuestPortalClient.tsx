'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  BellRing,
  Clock3,
  CreditCard,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';
import { showToast } from '@/components/ui/ToastRegion';
import { CartPanel } from './CartPanel';
import { HelpPanel } from './HelpPanel';
import { ItemModifierDialog } from './ItemModifierDialog';
import { MenuBrowser } from './MenuBrowser';
import { OrderTabTracker } from './OrderTabTracker';
import { PairingUpsellDialog } from './PairingUpsellDialog';
import { ReceiptReviewDialog } from './ReceiptReviewDialog';
import { SpiceQuizDialog } from './SpiceQuizDialog';
import { SplitBillCheckoutDialog } from './SplitBillCheckoutDialog';
import {
  type BootstrapPayload,
  type GuestCartItem,
  type GuestLeaderboardEntry,
  type GuestMenuItem,
} from './types';
import { WaitExperienceCard } from './WaitExperienceCard';

interface GuestPortalClientProps {
  qrToken: string;
}

type ActiveTab = 'MENU' | 'CART' | 'WAIT' | 'HELP' | 'BILL';

const GUEST_TABS: Array<{
  id: ActiveTab;
  label: string;
  icon: typeof UtensilsCrossed;
}> = [
  { id: 'MENU', label: 'Menu', icon: UtensilsCrossed },
  { id: 'CART', label: 'Cart', icon: ShoppingBag },
  { id: 'WAIT', label: 'Wait', icon: Clock3 },
  { id: 'HELP', label: 'Help', icon: BellRing },
  { id: 'BILL', label: 'Bill', icon: CreditCard },
];

export const GUEST_THEME_VARS =
  '[--pb-canvas:#FAF7F2] [--pb-surface:#FFFFFF] [--pb-surface-raised:#F4F1EA] [--pb-border:#E4E4E7] [--pb-border-subtle:#F4F4F5] [--pb-ink:#18181B] [--pb-muted:#71717A] [--pb-accent:#FF5412] [--pb-accent-hover:#FF7033] [--pb-accent-ink:#FFFFFF] [--pb-olive:#10B981] [--pb-turmeric:#F59E0B] [--pb-gold:#F59E0B] [--pb-chili:#EF4444]';

export const GUEST_DIALOG_CLASS =
  `${GUEST_THEME_VARS} rounded-3xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl`;

export function GuestPortalClient({ qrToken }: GuestPortalClientProps) {
  const router = useRouter();
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQrRotated, setIsQrRotated] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('MENU');
  const [guestNickname, setGuestNickname] = useState('Guest');
  const [guestId, setGuestId] = useState<string | undefined>(undefined);
  const [freshTokenInput, setFreshTokenInput] = useState('');
  const [showTokenPrompt, setShowTokenPrompt] = useState(false);

  // Dialog states
  const [selectedItem, setSelectedItem] = useState<GuestMenuItem | null>(null);
  const [upsellCandidate, setUpsellCandidate] = useState<{
    triggerItem: GuestMenuItem;
    rule: typeof data extends null ? null : NonNullable<typeof data>['upsellRules'][number];
    suggestedItem: GuestMenuItem;
  } | null>(null);
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
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        const rotated =
          res.status === 401 ||
          body.code === 'QR_ROTATED' ||
          body.code === 'QR_SIGNATURE_INVALID' ||
          Boolean(body.error && /rotated/i.test(body.error));
        setIsQrRotated(rotated);
        throw new Error(body.error ?? `Unable to load table menu (${res.status})`);
      }
      const payload = (await res.json()) as BootstrapPayload;
      setData(payload);
      setError(null);
      setIsQrRotated(false);
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

      setActiveTab('WAIT');
      showToast({
        title: 'Order beamed to kitchen!',
        description: 'Track live prep progress on Wait.',
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

  const handleNavigateFreshQr = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = freshTokenInput.trim();
    if (!cleaned) return;
    const token = cleaned.includes('/t/') ? cleaned.split('/t/').pop() ?? cleaned : cleaned;
    router.push(`/t/${encodeURIComponent(token)}`);
  };

  const cartCount = useMemo(
    () => data?.sharedCart.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [data?.sharedCart],
  );

  if (loading) {
    return (
      <div className={`${GUEST_THEME_VARS} min-h-dvh bg-[#FAF7F2] px-4 py-16 text-center text-zinc-900`}>
        <div className="mx-auto max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#FF5412]/10 text-[#FF5412]">
            <UtensilsCrossed className="size-6 animate-pulse" aria-hidden="true" />
          </div>
          <p className="mt-4 font-sans text-[clamp(1.25rem,1rem+1.2vw,1.625rem)] font-bold tracking-tight text-zinc-900">
            Syncing table channel…
          </p>
          <p className="mt-1.5 text-sm text-zinc-500">
            Loading live menu and table session
          </p>
        </div>
      </div>
    );
  }

  if (isQrRotated) {
    return (
      <main className={`${GUEST_THEME_VARS} flex min-h-dvh items-center justify-center bg-[#FAF7F2] px-4 py-12 text-zinc-900`}>
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-lg sm:p-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#FF5412]/12 text-[#FF5412]">
            <ShieldAlert className="size-7" aria-hidden="true" />
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-700 border border-amber-200">
            Session Locked · QR Rotated
          </span>
          <h1 className="mt-3 font-sans text-[clamp(1.375rem,1.1rem+1.5vw,1.875rem)] font-extrabold tracking-tight text-zinc-900">
            QR Session Rotated
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {error ??
              'This table QR code has been rotated for your security. Please scan the fresh QR code on your table stand to start a new session.'}
          </p>

          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={() => setShowTokenPrompt((v) => !v)}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF5412] px-5 py-3 text-sm font-bold text-white shadow-beam transition-colors hover:bg-[#FF7033]"
            >
              <QrCode className="size-4" aria-hidden="true" />
              Scan Fresh Table QR
            </button>

            <button
              type="button"
              onClick={() => void fetchBootstrap()}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-[#FAF7F2] px-5 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:border-[#FF5412]"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Retry Current Code
            </button>
          </div>

          {showTokenPrompt && (
            <form onSubmit={handleNavigateFreshQr} className="mt-4 space-y-2.5 border-t border-zinc-200 pt-4 text-left">
              <label htmlFor="fresh-qr-token" className="block text-xs font-semibold text-zinc-700">
                Point your phone camera at the table tent, or enter the new table code:
              </label>
              <div className="flex gap-2">
                <input
                  id="fresh-qr-token"
                  type="text"
                  value={freshTokenInput}
                  onChange={(e) => setFreshTokenInput(e.target.value)}
                  placeholder="Paste QR token or 'demo'"
                  className="min-h-[44px] flex-1 rounded-xl border border-zinc-300 bg-[#FAF7F2] px-3.5 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-[#FF5412]"
                />
                <button
                  type="submit"
                  className="min-h-[44px] shrink-0 rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-800"
                >
                  Open
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className={`${GUEST_THEME_VARS} flex min-h-dvh items-center justify-center bg-[#FAF7F2] px-4 py-12 text-zinc-900`}>
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-lg sm:p-8">
          <AlertCircle
            className="mx-auto size-10 text-red-500"
            aria-hidden="true"
          />
          <h1 className="mt-3 font-sans text-[clamp(1.375rem,1.1rem+1.5vw,1.875rem)] font-extrabold tracking-tight text-zinc-900">
            QR Code Unavailable
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {error ?? 'This table QR code could not be verified. Please ask your server for assistance.'}
          </p>
          <button
            type="button"
            onClick={() => void fetchBootstrap()}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#FF5412] px-6 text-sm font-bold text-white shadow-beam transition-colors hover:bg-[#FF7033]"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className={`${GUEST_THEME_VARS} min-h-dvh bg-[#FAF7F2] pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] text-zinc-900`}>
      {/* Guest phone header — Dock cream chrome */}
      <header className="sticky top-0 z-20 border-b border-zinc-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate font-sans text-base font-black tracking-tight text-zinc-900">
                {data.outlet.name}
                <span className="text-[#FF5412]">.</span>
              </h1>
              {data.table && (
                <span className="shrink-0 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white">
                  TABLE {data.table.tableNumber}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-500">
              {guestNickname}
              {data.table?.zoneName ? ` · ${data.table.zoneName}` : ''}
              {' · '}
              Signed QR Session
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('HELP')}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl border border-[#FFC7A5] bg-[#FFF4ED] px-2.5 py-1.5 text-[11px] font-extrabold text-[#E53E06] transition-colors hover:bg-[#FFE5D3]"
          >
            <BellRing className="size-3.5" aria-hidden="true" />
            Call
          </button>
        </div>
      </header>

      <main
        className="mx-auto max-w-3xl space-y-5 px-4 py-4"
        style={{
          scrollPaddingBottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {activeTab === 'MENU' && (
          <MenuBrowser
            currency={data.outlet.currency}
            categories={data.categories}
            menuItems={data.menuItems}
            onSelectItem={(item) => setSelectedItem(item)}
          />
        )}

        {activeTab === 'CART' && (
          <CartPanel
            cart={data.sharedCart}
            menuItems={data.menuItems}
            upsellRules={data.upsellRules}
            currency={data.outlet.currency}
            isSubmitting={placingOrder}
            onUpdateQty={handleUpdateCartQty}
            onQuickAddUpsell={handleQuickAddUpsell}
            onPlaceOrder={handlePlaceOrder}
            onBrowseMenu={() => setActiveTab('MENU')}
          />
        )}

        {activeTab === 'WAIT' && (
          <div className="space-y-5">
            <WaitExperienceCard
              outlet={data.outlet}
              session={data.session}
              orders={data.orders}
              loyalty={data.loyalty}
              onOpenSpiceQuiz={() => setQuizOpen(true)}
              onLoyaltyRedeemed={() => void fetchBootstrap()}
            />
            <OrderTabTracker
              currency={data.outlet.currency}
              session={data.session}
              orders={data.orders}
              onOpenCheckout={() => {
                setActiveTab('BILL');
                setCheckoutOpen(true);
              }}
              onOpenReceipt={() => setReceiptOpen(true)}
            />
          </div>
        )}

        {activeTab === 'HELP' && (
          <HelpPanel sessionId={data.session.id} tableId={data.table?.id ?? null} />
        )}

        {activeTab === 'BILL' && (
          <OrderTabTracker
            currency={data.outlet.currency}
            session={data.session}
            orders={data.orders}
            onOpenCheckout={() => setCheckoutOpen(true)}
            onOpenReceipt={() => setReceiptOpen(true)}
          />
        )}
      </main>

      {/* Dock 5-tab bottom navigation */}
      <nav
        aria-label="Guest dining navigation"
        className="pb-safe-bottom-bar fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-1.5 pt-1.5 backdrop-blur-md shadow-[0_-8px_24px_-12px_rgba(24,24,27,0.12)]"
      >
        <div
          role="tablist"
          className="mx-auto grid max-w-3xl grid-cols-5 gap-1"
        >
          {GUEST_TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            const showCartBadge = tab.id === 'CART' && cartCount > 0;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors ${
                  selected
                    ? 'bg-[#FFF4ED] text-[#E53E06]'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{tab.label}</span>
                {showCartBadge && (
                  <span className="absolute top-1 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5412] px-1 text-[9px] font-black text-white">
                    {cartCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <ItemModifierDialog
        key={selectedItem?.id ?? 'none'}
        open={Boolean(selectedItem)}
        item={selectedItem}
        modifiers={data.modifiers}
        currency={data.outlet.currency}
        guestNickname={guestNickname}
        onClose={() => setSelectedItem(null)}
        onAddToCart={(item) => {
          handleAddToCart(item);
          setActiveTab('CART');
        }}
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
          setActiveTab('CART');
        }}
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
