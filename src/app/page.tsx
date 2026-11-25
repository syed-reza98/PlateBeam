import Link from 'next/link';
import {
  ArrowUpRight,
  ChefHat,
  LayoutDashboard,
  QrCode,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const GUEST_QR =
  'eyJ0IjoiMTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTExIiwibyI6IjIyMjIyMjIyLTIyMjItNDIyMi04MjIyLTIyMjIyMjIyMjIyMiIsInRibCI6IjY2NjY2NjY2LTY2NjYtNDY2Ni04NjY2LTY2NjY2NjY2NjYwMSIsIm4iOiJ6YWlrYTAxIiwiaWF0IjoxNzk1NjMyMDAwfQ.9_no91QOTl60pCNPzfmloMFIzjebyk0Wz8mItpBqPYI';

const CHANNELS = [
  {
    href: `/t/${GUEST_QR}`,
    code: 'CH-01',
    title: 'Guest QR Portal',
    subtitle: 'Zero-app table channel',
    description: 'Signed QR entry, shared cart, cook countdown, split checkout.',
    icon: QrCode,
  },
  {
    href: '/pos/zaika-bistro',
    code: 'CH-02',
    title: 'FOH Floor & POS',
    subtitle: 'Floor dispatch',
    description: 'Live table status, captain approval, waiter alerts, shifts.',
    icon: UtensilsCrossed,
  },
  {
    href: '/kds/zaika-bistro',
    code: 'CH-03',
    title: 'Kitchen Display',
    subtitle: 'Station expo',
    description: 'Station tickets, SLA timers, bump-bar shortcuts, recall.',
    icon: ChefHat,
  },
  {
    href: '/dashboard',
    code: 'CH-04',
    title: 'Owner Command',
    subtitle: 'Ops telemetry',
    description: 'Occupancy, sales, menu engineering, 86, inventory, RBAC.',
    icon: LayoutDashboard,
  },
  {
    href: '/admin',
    code: 'CH-05',
    title: 'Platform Admin',
    subtitle: 'Tenant tower',
    description: 'Multi-tenant provisioning, status, and subscription control.',
    icon: ShieldCheck,
  },
] as const;

export default function HomePage() {
  return (
    <div className="tower-field relative min-h-dvh text-[var(--pb-ink)]">
      <div className="led-rail" aria-hidden="true" />

      <header className="pb-safe-top sticky top-0 z-40 border-b border-[var(--pb-border)] bg-[color-mix(in_srgb,var(--pb-canvas)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="led-pulse inline-flex size-10 items-center justify-center rounded-sm border border-[var(--pb-accent)] bg-[var(--pb-surface)] font-display text-2xl font-semibold tracking-wide text-[var(--pb-accent)]">
              PB
            </span>
            <div>
              <p className="font-display text-3xl leading-none tracking-[0.04em]">
                PlateBeam
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--pb-muted)]">
                Venue Dispatch OS
              </p>
            </div>
          </div>
          <nav aria-label="Quick actions" className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 text-xs font-semibold uppercase tracking-wider hover:border-[var(--pb-accent)]"
            >
              Staff Sign In
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <section className="tower-scan relative max-w-3xl space-y-6">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--pb-accent)]">
            Live · Multi-surface sync
          </p>
          <h1 className="font-display text-5xl leading-[0.92] tracking-[0.02em] sm:text-7xl">
            PlateBeam
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-[var(--pb-muted)] sm:text-lg">
            Your waiter cannot be at every table at once — the tower can. One
            synchronized web OS for guests, floor, kitchen, and ownership.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/t/${GUEST_QR}`}
              className="glow-accent inline-flex min-h-[48px] items-center gap-2 rounded-sm bg-[var(--pb-accent)] px-5 font-display text-xl tracking-wide text-[var(--pb-accent-ink)]"
            >
              Open Guest Channel
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[48px] items-center rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] px-5 text-sm font-semibold"
            >
              Staff Console
            </Link>
          </div>
        </section>

        <div className="led-rail my-10 opacity-60" aria-hidden="true" />

        <section aria-label="Surface channels" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-3xl tracking-wide">Channels</h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--pb-muted)]">
              Select a surface
            </p>
          </div>

          <ul className="space-y-2">
            {CHANNELS.map((channel) => {
              const Icon = channel.icon;
              return (
                <li key={channel.href}>
                  <Link href={channel.href} className="channel-strip group rounded-sm">
                    <span className="font-mono text-[11px] tracking-[0.16em] text-[var(--pb-accent)]">
                      {channel.code}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-display text-2xl tracking-wide group-hover:text-[var(--pb-accent)]">
                          {channel.title}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--pb-muted)]">
                          {channel.subtitle}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-[var(--pb-muted)]">
                        {channel.description}
                      </span>
                    </span>
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm border border-[var(--pb-border)] text-[var(--pb-accent)]">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="pb-safe-bottom border-t border-[var(--pb-border)] py-5 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--pb-muted)]">
        PlateBeam Dispatch · Zaika Bistro demo · Next.js App Router
      </footer>
    </div>
  );
}
