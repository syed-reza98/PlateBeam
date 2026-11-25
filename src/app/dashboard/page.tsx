import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { OwnerDashboardClient } from '@/components/ops/OwnerDashboardClient';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const metadata = {
  title: 'Owner Command Center',
};

export default function DashboardPage() {
  return (
    <div className="tower-field flex min-h-dvh flex-col text-[var(--pb-ink)]">
      <div className="led-rail" aria-hidden="true" />
      <header className="border-b border-[var(--pb-border)] bg-[color-mix(in_srgb,var(--pb-surface)_92%,transparent)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to PlateBeam home"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)] hover:border-[var(--pb-accent)]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <div>
              <p className="font-display text-2xl leading-none tracking-wide">Owner Command</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--pb-muted)]">
                Live BI · 86 · BOM · RBAC · QR
              </p>
            </div>
          </div>

          <nav aria-label="Dashboard navigation" className="flex items-center gap-2">
            <Link
              href="/pos/zaika-bistro"
              className="inline-flex min-h-11 items-center rounded-sm border border-[var(--pb-border)] px-3 py-2 text-xs font-semibold hover:border-[var(--pb-accent)]"
            >
              FOH POS
            </Link>
            <Link
              href="/admin"
              className="hidden sm:inline-flex min-h-11 items-center rounded-sm border border-[var(--pb-border)] px-3 py-2 text-xs font-semibold hover:border-[var(--pb-accent)]"
            >
              Super-Admin
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="pb-safe-bottom-bar mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Suspense
          fallback={
            <div className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-8 text-sm text-[var(--pb-muted)]">
              Loading owner analytics…
            </div>
          }
        >
          <OwnerDashboardClient />
        </Suspense>
      </main>
    </div>
  );
}
