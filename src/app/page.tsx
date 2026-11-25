import Link from 'next/link';
import { ChefHat, LayoutDashboard, QrCode, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const SURFACES = [
  {
    href: '/t/demo',
    title: 'Guest QR Portal',
    description:
      'Zero-app mobile dining with shared table cart, live cook countdown, Spice Quiz, and 2-tap split bill.',
    badge: 'Mobile PWA',
    icon: QrCode,
  },
  {
    href: '/pos/demo',
    title: 'FOH Floor & POS',
    description:
      'Color-coded live floor map, 4/6-digit staff PIN switcher, takeaway tokens, and offline IndexedDB queue.',
    badge: 'Front of House',
    icon: UtensilsCrossed,
  },
  {
    href: '/kds/demo',
    title: 'Obsidian Kitchen Display',
    description:
      'High-contrast dark station tickets, tabular SLA timers, bump-bar shortcuts, and recall.',
    badge: 'KDS Console',
    icon: ChefHat,
  },
  {
    href: '/dashboard',
    title: 'Owner Command Center',
    description:
      'Live table occupancy, Menu Engineering matrix, BOM recipe stock, and 3-layer RBAC audit trail.',
    badge: 'Owner BI',
    icon: LayoutDashboard,
  },
  {
    href: '/admin',
    title: 'Platform Super-Admin',
    description:
      'Multi-tenant provisioning, outlet configuration, tax slabs, and global compliance controls.',
    badge: 'Super-Admin',
    icon: ShieldCheck,
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-[var(--pb-border)] bg-[var(--pb-surface)]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[var(--pb-accent)] text-[var(--pb-accent-ink)] font-serif text-xl">
              P
            </span>
            <div>
              <p className="font-serif text-xl leading-none tracking-tight">PlateBeam</p>
              <p className="text-xs text-[var(--pb-muted)]">Warm Editorial Bistro + Obsidian Kitchen</p>
            </div>
          </div>
          <nav aria-label="Primary actions" className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-[var(--pb-border)] px-4 py-2 text-xs font-semibold hover:border-[var(--pb-accent)]"
            >
              Staff Sign In
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <section className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--pb-accent)]">
            Multi-Surface Restaurant OS
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
            Every table, station, and ledger in one synchronized rhythm.
          </h1>
          <p className="mt-4 text-base text-[var(--pb-muted)] sm:text-lg">
            Select a surface below to launch the Guest QR dining portal, Front-of-House POS,
            Obsidian Kitchen Display, or Owner Command Center.
          </p>
        </section>

        <section
          aria-label="Application surfaces"
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SURFACES.map((surface) => {
            const Icon = surface.icon;
            return (
              <Link
                key={surface.href}
                href={surface.href}
                className="group flex flex-col justify-between rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-6 transition-colors hover:border-[var(--pb-accent)] focus-visible:outline-2 focus-visible:outline-[var(--pb-accent)]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--pb-canvas)] text-[var(--pb-accent)] border border-[var(--pb-border)]">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-full border border-[var(--pb-border)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--pb-muted)]">
                      {surface.badge}
                    </span>
                  </div>
                  <h2 className="mt-4 font-serif text-2xl tracking-tight group-hover:text-[var(--pb-accent)]">
                    {surface.title}
                  </h2>
                  <p className="mt-2 text-sm text-[var(--pb-muted)]">{surface.description}</p>
                </div>
                <p className="mt-5 font-mono text-xs font-medium text-[var(--pb-accent)]">
                  {surface.href} →
                </p>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
