import Link from 'next/link';
import {
  ChefHat,
  LayoutDashboard,
  QrCode,
  ShieldCheck,
  UtensilsCrossed,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const SURFACES = [
  {
    href: '/t/demo',
    title: 'Guest QR Portal',
    subtitle: 'Zero-App Mobile Dining',
    description:
      'HMAC-secured QR table entry, live kitchen cook countdown, multiplayer table trivia, and zero-drift 2-tap split bills.',
    badge: 'Guest PWA',
    icon: QrCode,
    color: 'from-orange-500/20 to-amber-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
    highlight: 'Step 01, 02, 05, 08',
  },
  {
    href: '/pos/zaika-bistro',
    title: 'FOH Floor & POS',
    subtitle: 'Tableside Orchestration',
    description:
      'Real-time color-coded table occupancy, captain order approval, waiter request chimes, and driverless ESC/POS printing.',
    badge: 'Staff Tablet',
    icon: UtensilsCrossed,
    color: 'from-blue-500/20 to-cyan-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    highlight: 'Step 04 & 07',
  },
  {
    href: '/kds/zaika-bistro',
    title: 'Obsidian Kitchen (KDS)',
    subtitle: 'Multi-Station Expo Console',
    description:
      'Station ticket splitting (Tandoor, Curry, Bar), SLA elapsed timer escalation, bump bar keyboard shortcuts, and 1-tap recall.',
    badge: 'Kitchen Display',
    icon: ChefHat,
    color: 'from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    highlight: 'Step 04 (Kitchen)',
  },
  {
    href: '/dashboard',
    title: 'Owner Command Center',
    subtitle: 'Executive Business Intelligence',
    description:
      'Live occupancy telemetry, BCG menu engineering matrix (Stars, Plowhorses, Puzzles, Dogs), BOM recipes, and instant 86 switch.',
    badge: 'Owner BI',
    icon: LayoutDashboard,
    color: 'from-purple-500/20 to-indigo-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    highlight: 'Step 10 (Overview)',
  },
  {
    href: '/admin',
    title: 'Platform Super-Admin',
    subtitle: 'Multi-Tenant Governance',
    description:
      'Multi-tenant database isolation (Postgres RLS), subscription lifecycle, statutory tax slabs, and global restaurant provisioning.',
    badge: 'SaaS Platform',
    icon: ShieldCheck,
    color: 'from-rose-500/20 to-pink-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    highlight: 'Multi-Tenant',
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[var(--pb-canvas)] text-[var(--pb-ink)] selection:bg-[var(--pb-accent)] selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-[var(--pb-border)] bg-[var(--pb-surface)]/85 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--pb-accent)] text-[var(--pb-accent-ink)] font-serif text-2xl font-bold shadow-md shadow-orange-500/20">
              P
            </span>
            <div>
              <p className="font-serif text-2xl leading-none tracking-tight font-bold">
                PlateBeam
              </p>
              <p className="text-[11px] font-medium tracking-wide text-[var(--pb-muted)]">
                Multi-Surface Restaurant Operating System
              </p>
            </div>
          </div>

          <nav aria-label="Quick Actions" className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] px-4 py-2 text-xs font-semibold hover:border-[var(--pb-accent)] hover:text-[var(--pb-accent)] active:scale-98 transition-all"
            >
              <span>Staff Sign In</span>
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="relative max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--pb-accent)]/30 bg-[var(--pb-accent)]/10 px-3.5 py-1 text-xs font-bold text-[var(--pb-accent)]">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Zaika Bistro & Bar Concept Architecture</span>
          </div>

          <h1 className="font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl font-bold text-[var(--pb-ink)]">
            Every table, station, and ledger in{' '}
            <span className="italic text-[var(--pb-accent)] underline decoration-[var(--pb-accent)]/30 decoration-wavy">
              synchronized rhythm.
            </span>
          </h1>

          <p className="text-base text-[var(--pb-muted)] sm:text-xl font-normal leading-relaxed pt-2">
            <em>&ldquo;Your waiter can&rsquo;t be at every table at once, but your website can.&rdquo;</em>{' '}
            Experience the complete 10-step dining lifecycle across mobile guests, captain POS,
            station-routed KDS, and owner analytics.
          </p>
        </div>

        {/* Live Metrics Ticker Banner */}
        <section aria-label="Demo Telemetry" className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Table Occupancy
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--pb-ink)]">
              6 / 6 <span className="text-xs font-sans text-[var(--pb-olive)] font-semibold">(100%)</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Live Orders
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--pb-ink)]">
              46 <span className="text-xs font-sans text-[var(--pb-accent)] font-semibold">Active</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Daily Gross GMV
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--pb-ink)]">
              ৳ 48,500
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
              Kitchen SLA Rate
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--pb-olive)]">
              94.2% <span className="text-xs font-sans text-[var(--pb-muted)]">On-Time</span>
            </p>
          </div>
        </section>

        {/* Surface Grid Cards */}
        <section
          aria-label="Application Surfaces"
          className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SURFACES.map((surface) => {
            const Icon = surface.icon;
            return (
              <Link
                key={surface.href}
                href={surface.href}
                className="group relative flex flex-col justify-between rounded-3xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-7 transition-all duration-300 hover:border-[var(--pb-accent)] hover:shadow-xl hover:shadow-[var(--pb-accent)]/5 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-[var(--pb-accent)]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex size-12 items-center justify-center rounded-2xl border bg-gradient-to-br ${surface.color} transition-transform group-hover:scale-105`}
                    >
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="rounded-full border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] px-3 py-1 text-[11px] font-bold text-[var(--pb-muted)]">
                      {surface.badge}
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--pb-accent)]">
                      {surface.subtitle}
                    </p>
                    <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[var(--pb-ink)] group-hover:text-[var(--pb-accent)] transition-colors">
                      {surface.title}
                    </h2>
                    <p className="mt-2.5 text-sm leading-relaxed text-[var(--pb-muted)]">
                      {surface.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-[var(--pb-border-subtle)] pt-4">
                  <span className="font-mono text-xs font-semibold text-[var(--pb-muted)]">
                    {surface.highlight}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[var(--pb-accent)] group-hover:translate-x-1 transition-transform">
                    Launch Surface <ArrowUpRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--pb-border)] bg-[var(--pb-surface)] py-6 text-center text-xs text-[var(--pb-muted)]">
        <p>PlateBeam OS · Designed for Zaika Bistro & Bar · Next.js 16 App Router & Modern Web Standards</p>
      </footer>
    </div>
  );
}
