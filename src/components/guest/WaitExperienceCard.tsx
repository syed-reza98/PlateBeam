'use client';

import { useEffect, useState } from 'react';
import { Award, Check, Copy, Gamepad2, Timer, Wifi } from 'lucide-react';
import { showToast } from '@/components/ui/ToastRegion';
import type {
  GuestLoyaltyProfile,
  GuestOrder,
  GuestOutletInfo,
  GuestSessionInfo,
} from './types';

interface WaitExperienceCardProps {
  outlet: GuestOutletInfo;
  session: GuestSessionInfo;
  orders: GuestOrder[];
  loyalty?: GuestLoyaltyProfile | null;
  onOpenSpiceQuiz: () => void;
}

export function WaitExperienceCard({
  outlet,
  session,
  orders,
  loyalty,
  onOpenSpiceQuiz,
}: WaitExperienceCardProps) {
  const [copiedWifi, setCopiedWifi] = useState(false);

  const activeCookingItems = orders.flatMap((o) =>
    o.items.filter((i) =>
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

  return (
    <section aria-label="Wait experience and table perks" className="grid gap-3 sm:grid-cols-2">
      {/* Live Cook Countdown (FR-017) */}
      {activeCookingItems.length > 0 && (
        <div className="rounded-2xl border border-[var(--pb-accent)]/40 bg-[var(--pb-surface)] p-4 sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--pb-accent)]">
                <Timer className="size-3.5" aria-hidden="true" />
                Kitchen Countdown
              </p>
              <p className="mt-1 text-sm text-[var(--pb-muted)]">
                {activeCookingItems.length}{' '}
                {activeCookingItems.length === 1 ? 'dish' : 'dishes'} actively in preparation
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-bold tabular-nums text-[var(--pb-ink)]">
                {formattedCountdown}
              </p>
              <p className="text-[11px] text-[var(--pb-muted)]">Est. arrival</p>
            </div>
          </div>
        </div>
      )}

      {/* One-Tap Guest Wi-Fi Card (FR-018) */}
      {outlet.wifiSsid && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              <Wifi className="size-3.5 text-[var(--pb-olive)]" aria-hidden="true" />
              Guest Wi-Fi
            </p>
            <p className="mt-1 truncate font-medium">{outlet.wifiSsid}</p>
            {outlet.wifiPassword && (
              <p className="font-mono text-xs text-[var(--pb-muted)]">
                Pass: {outlet.wifiPassword}
              </p>
            )}
          </div>
          {outlet.wifiPassword && (
            <button
              type="button"
              onClick={handleCopyWifi}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3 text-xs font-semibold hover:border-[var(--pb-accent)]"
            >
              {copiedWifi ? (
                <>
                  <Check className="size-4 text-[var(--pb-olive)]" aria-hidden="true" />
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
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--pb-turmeric)]">
            <Gamepad2 className="size-3.5" aria-hidden="true" />
            Table Mini-Game
          </p>
          <p className="mt-1 font-medium">Spice Quiz Trivia</p>
          <p className="text-xs text-[var(--pb-muted)]">
            Top today&apos;s leaderboard for a 5% perk
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSpiceQuiz}
          className="min-h-[44px] shrink-0 rounded-xl bg-[var(--pb-ink)] px-3.5 text-xs font-semibold text-[var(--pb-canvas)]"
        >
          Play
        </button>
      </div>

      {/* Loyalty Wallet (FR-019) */}
      {loyalty && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--pb-turmeric)]/15 text-[var(--pb-turmeric)]">
              <Award className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
                Loyalty Wallet · {loyalty.tier} Tier
              </p>
              <p className="font-mono text-base font-bold tabular-nums">
                {loyalty.pointsBalance.toLocaleString()} pts
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[var(--pb-border)] px-3 py-1 text-xs font-medium text-[var(--pb-muted)]">
            Auto-earned on checkout
          </span>
        </div>
      )}
    </section>
  );
}
