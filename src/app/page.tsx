import Link from 'next/link';
import {
  ArrowUpRight,
  ChefHat,
  Columns2,
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
    subtitle: 'Warm Cream mobile dining',
    description: 'Signed QR entry, modifier sheet, shared cart, cook countdown, 3-mode split checkout.',
    icon: QrCode,
    badge: 'Guest',
  },
  {
    href: '/pos/zaika-bistro',
    code: 'CH-02',
    title: 'FOH Floor & POS',
    subtitle: 'Floor dispatch',
    description: 'Live table inspector, captain approval queue, assisted POS, waiter alerts, shift Z-report.',
    icon: UtensilsCrossed,
    badge: 'FOH',
  },
  {
    href: '/kds/zaika-bistro',
    code: 'CH-03',
    title: 'Kitchen Display',
    subtitle: '3-station expo',
    description: 'Tandoor, Curry & Drinks columns, SLA timers, bump shortcuts (1–9, Space, R), thermal KOT.',
    icon: ChefHat,
    badge: 'KDS',
  },
  {
    href: '/dashboard',
    code: 'CH-04',
    title: 'Owner Command',
    subtitle: 'Ops telemetry',
    description: 'Hourly revenue, payment mix, menu engineering, 86 & +Add Dish, BOM inventory, RBAC.',
    icon: LayoutDashboard,
    badge: 'BI',
  },
  {
    href: '/admin',
    code: 'CH-05',
    title: 'Platform Admin',
    subtitle: 'Tenant tower',
    description: 'Multi-tenant provisioning, status control, and subscription governance.',
    icon: ShieldCheck,
    badge: 'SaaS',
  },
  {
    href: '/demo',
    code: 'CH-06',
    title: 'Live Split-View Simulator',
    subtitle: 'Ops + 395px Guest QR',
    description: 'Side-by-side OS shell pairing live FOH/KDS operations with a docked mobile QR simulator.',
    icon: Columns2,
    badge: 'Demo',
  },
] as const;

export default function HomePage() {
  return (
    <div className="grid-bg relative min-h-dvh text-[var(--pb-ink)]">
      <header className="pb-safe-top sticky top-0 z-40 border-b border-[var(--pb-border)] bg-[color-mix(in_srgb,var(--pb-surface)_90%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#FF5412] font-mono text-sm font-black tracking-tight text-white shadow-beam">
              PB
            </span>
            <div>
              <p className="text-lg font-extrabold leading-none tracking-tight">
                PlateBeam <span className="text-[#FF5412]">OS</span>
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--pb-muted)]">
                Live Restaurant Operating System
              </p>
            </div>
          </div>

          <nav aria-label="Quick actions" className="flex items-center gap-2">
            <Link
              href="/demo"
              className="hidden min-h-[44px] items-center rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] px-3.5 text-xs font-semibold transition-colors hover:border-[#FF5412] sm:inline-flex"
            >
              Split Demo
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] px-4 text-xs font-semibold transition-colors hover:border-[#FF5412]"
            >
              Staff Sign In
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <section className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FF5412]/30 bg-[#FF5412]/10 px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FF5412]">
            <span className="size-2 rounded-full bg-[#FF5412] animate-ping" aria-hidden="true" />
            Live · Multi-Surface Realtime Sync
          </div>

          <h1 className="text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
            Every table, station, and check —{' '}
            <span className="text-[#FF5412]">synchronized live.</span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-[var(--pb-muted)] sm:text-lg">
            Obsidian command for FOH POS, 3-station Kitchen Display, and Owner BI, paired with a
            Warm Cream zero-app Guest QR dining portal.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/t/${GUEST_QR}`}
              className="shadow-beam inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#FF5412] px-6 text-sm font-bold text-white transition-colors hover:bg-[#FF7033]"
            >
              Open Guest QR Portal
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[48px] items-center rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] px-5 text-sm font-semibold transition-colors hover:border-[#FF5412] hover:bg-[var(--pb-surface-raised)]"
            >
              Staff Clearance Console
            </Link>
            <Link
              href="/demo"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] px-5 text-sm font-semibold transition-colors hover:border-[#FF5412] hover:bg-[var(--pb-surface-raised)]"
            >
              <Columns2 className="size-4 text-[#FF5412]" aria-hidden="true" />
              Live Split View
            </Link>
          </div>
        </section>

        <section aria-label="Surface channels" className="mt-12 space-y-4">
          <div className="flex items-end justify-between gap-3 border-b border-[var(--pb-border)] pb-3">
            <h2 className="text-2xl font-extrabold tracking-tight">Operational Channels</h2>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--pb-muted)]">
              Select a surface
            </p>
          </div>

          <ul className="grid gap-3 md:grid-cols-2">
            {CHANNELS.map((channel) => {
              const Icon = channel.icon;
              return (
                <li key={channel.href}>
                  <Link href={channel.href} className="channel-strip group rounded-2xl">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#FF5412]">
                        {channel.code}
                      </span>
                      <span className="rounded-full border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--pb-muted)]">
                        {channel.badge}
                      </span>
                    </div>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span className="text-lg font-bold tracking-tight transition-colors group-hover:text-[#FF5412]">
                          {channel.title}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--pb-muted)]">
                          {channel.subtitle}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--pb-muted)]">
                        {channel.description}
                      </span>
                    </span>
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[#FF5412] transition-colors group-hover:border-[#FF5412]/50 group-hover:bg-[#FF5412]/10">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="pb-safe-bottom mt-8 border-t border-[var(--pb-border)] py-5 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--pb-muted)]">
        PlateBeam OS · Zaika Bistro Demo · Next.js 16 App Router
      </footer>
    </div>
  );
}
