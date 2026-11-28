'use client';

import { useEffect, useState } from 'react';
import { Award, Check, Copy, Gamepad2, Gift, Timer, Wifi } from 'lucide-react';
import { showToast } from '@/components/ui/ToastRegion';
import {
  formatMoney,
  type GuestLoyaltyProfile,
  type GuestOrder,
  type GuestOutletInfo,
  type GuestSessionInfo,
} from './types';

interface WaitExperienceCardProps {
  outlet: GuestOutletInfo;
  session: GuestSessionInfo;
  orders: GuestOrder[];
  loyalty?: GuestLoyaltyProfile | null;
  onOpenSpiceQuiz: () => void;
  onLoyaltyRedeemed?: () => void;
}

const LOYALTY_REDEEM_THRESHOLD = 200;

export function WaitExperienceCard({
  outlet,
  session,
  orders,
  loyalty,
  onOpenSpiceQuiz,
  onLoyaltyRedeemed,
}: WaitExperienceCardProps) {
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const activeCookingItems = orders.flatMap((o) =>
    o.items.filter(
      (i) =>
        i.kdsStatus === 'PENDING' ||
        i.kdsStatus === 'ACCEPTED' ||
        i.kdsStatus === 'PREPARING',
    ),
  );

  const initialSeconds = Math.max(
    60,
    (session.estimatedWaitMins ?? 12) * 60,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (activeCookingItems.length === 0) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCookingItems.length]);

  const secondsLeft = Math.max(0, initialSeconds - elapsedSeconds);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedCountdown = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const handleCopyWifi = async () => {
    if (!outlet.wifiPassword) return;
    try {
      await navigator.clipboard.writeText(outlet.wifiPassword);
      setCopiedWifi(true);
      showToast({
        title: 'Wi-Fi password copied',
        description: `Network: ${outlet.wifiSsid ?? outlet.name}`,
        variant: 'success',
      });
      setTimeout(() => setCopiedWifi(false), 2500);
    } catch {
      showToast({
        title: 'Copy failed',
        description: `Password: ${outlet.wifiPassword}`,
        variant: 'warning',
      });
    }
  };

  const handleRedeemLoyalty = async () => {
    if (!loyalty || loyalty.pointsBalance < LOYALTY_REDEEM_THRESHOLD || redeeming) return;
    setRedeeming(true);
    try {
      const res = await fetch(`/api/v1/sessions/${session.id}/loyalty/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: loyalty.guestId,
          points: LOYALTY_REDEEM_THRESHOLD,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        discountMinor?: number;
      };
      if (!res.ok) {
        showToast({
          title: 'Could not redeem voucher',
          description: body.error ?? 'Please try again at checkout.',
          variant: 'warning',
        });
        return;
      }

      showToast({
        title: 'Loyalty voucher applied!',
        description: body.discountMinor
          ? `${formatMoney(body.discountMinor, outlet.currency)} discount added to your table tab.`
          : '200 pts redeemed toward your table bill.',
        variant: 'success',
      });
      onLoyaltyRedeemed?.();
    } catch {
      showToast({
        title: 'Network error',
        description: 'Unable to redeem loyalty points right now.',
        variant: 'error',
      });
    } finally {
      setRedeeming(false);
    }
  };

  const canRedeem = Boolean(loyalty && loyalty.pointsBalance >= LOYALTY_REDEEM_THRESHOLD);

  return (
    <section aria-label="Wait experience and table perks" className="grid gap-3 sm:grid-cols-2">
      {/* Live Cook Countdown (FR-017) */}
      {activeCookingItems.length > 0 && (
        <div className="rounded-2xl border border-[#FF5412]/30 bg-white p-4 shadow-sm sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF5412]">
                <Timer className="size-3.5" aria-hidden="true" />
                Kitchen Countdown
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {activeCookingItems.length}{' '}
                {activeCookingItems.length === 1 ? 'dish' : 'dishes'} actively in preparation
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[clamp(1.375rem,1.1rem+1.5vw,1.875rem)] font-bold tabular-nums text-zinc-900">
                {formattedCountdown}
              </p>
              <p className="text-[11px] font-medium text-zinc-500">Est. arrival</p>
            </div>
          </div>
        </div>
      )}

      {/* One-Tap Guest Wi-Fi Card (FR-018) */}
      {outlet.wifiSsid && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
              <Wifi className="size-3.5 text-emerald-500" aria-hidden="true" />
              Guest Wi-Fi
            </p>
            <p className="mt-1 truncate font-semibold text-zinc-900">{outlet.wifiSsid}</p>
            {outlet.wifiPassword && (
              <p className="font-mono text-xs text-zinc-500">
                Pass: {outlet.wifiPassword}
              </p>
            )}
          </div>
          {outlet.wifiPassword && (
            <button
              type="button"
              onClick={handleCopyWifi}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 bg-[#FAF7F2] px-3.5 text-xs font-bold text-zinc-900 transition-colors hover:border-[#FF5412]"
            >
              {copiedWifi ? (
                <>
                  <Check className="size-4 text-emerald-600" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden="true" />
                  Copy
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Spice Quiz Mini-Game (FR-020) */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600">
            <Gamepad2 className="size-3.5" aria-hidden="true" />
            Table Mini-Game
          </p>
          <p className="mt-1 font-semibold text-zinc-900">Spice Quiz Trivia</p>
          <p className="text-xs text-zinc-500">
            Top today&apos;s leaderboard for a 5% perk
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSpiceQuiz}
          className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white transition-colors hover:bg-zinc-800"
        >
          Play
        </button>
      </div>

      {/* Loyalty Wallet & Voucher Redeem (FR-019) */}
      {loyalty && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <Award className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Loyalty Wallet · {loyalty.tier} Tier
              </p>
              <p className="font-mono text-base font-bold tabular-nums text-zinc-900">
                {loyalty.pointsBalance.toLocaleString()} pts
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!canRedeem || redeeming}
            onClick={handleRedeemLoyalty}
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
              canRedeem
                ? 'bg-[#FF5412] text-white shadow-sm hover:bg-[#FF7033]'
                : 'border border-zinc-200 bg-[#FAF7F2] text-zinc-400 cursor-not-allowed'
            }`}
          >
            <Gift className="size-4" aria-hidden="true" />
            {redeeming
              ? 'Redeeming...'
              : canRedeem
                ? `Redeem ${LOYALTY_REDEEM_THRESHOLD} pts Voucher`
                : `Need ${LOYALTY_REDEEM_THRESHOLD} pts`}
          </button>
        </div>
      )}
    </section>
  );
}
