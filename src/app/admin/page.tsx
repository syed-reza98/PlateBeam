import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SuperAdminClient } from '@/components/ops/SuperAdminClient';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const metadata = {
  title: 'Platform Super-Admin',
};

export default function SuperAdminPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-[var(--pb-canvas)] text-[var(--pb-ink)]">
      <header className="border-b border-[var(--pb-border)] bg-[var(--pb-surface)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to PlateBeam home"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] hover:border-[var(--pb-accent)]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <div>
              <p className="font-serif text-xl leading-none">Platform Super-Admin</p>
              <p className="mt-0.5 text-xs text-[var(--pb-muted)]">
                Multi-Tenant Provisioning, Subscriptions & SaaS Governance
              </p>
            </div>
          </div>

          <nav aria-label="Super-admin navigation" className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center rounded-xl border border-[var(--pb-border)] px-3 py-2 text-xs font-semibold hover:border-[var(--pb-accent)]"
            >
              Owner Dashboard
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 pb-safe-bottom-bar">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-8 text-sm text-[var(--pb-muted)]">
              Loading multi-tenant registry…
            </div>
          }
        >
          <SuperAdminClient />
        </Suspense>
      </main>
    </div>
  );
}
