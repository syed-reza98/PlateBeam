import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutDashboard, MonitorPlay } from 'lucide-react';
import { SuperAdminClient } from '@/components/ops/SuperAdminClient';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const metadata = {
  title: 'Platform Super-Admin — PlateBeam OS',
};

export default function SuperAdminPage() {
  return (
    <div className="grid-bg flex min-h-dvh flex-col bg-[#09090B] text-[#F4F4F5]">
      <header className="sticky top-0 z-30 border-b border-[#262630] bg-[#111115]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to PlateBeam home"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#262630] bg-[#18181F] text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#FF5412]" aria-hidden="true" />
                <p className="text-lg font-extrabold tracking-tight text-[#F4F4F5] sm:text-xl">
                  Platform Admin
                </p>
              </div>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#A1A1AA]">
                Tenants · Subscriptions · Governance
              </p>
            </div>
          </div>

          <nav aria-label="Super-admin navigation" className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#262630] bg-[#18181F] px-3 py-2 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
            >
              <LayoutDashboard className="size-3.5 text-[#FF5412]" aria-hidden="true" />
              <span>Owner Dashboard</span>
            </Link>
            <Link
              href="/demo"
              className="hidden sm:inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#262630] bg-[#18181F] px-3 py-2 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
            >
              <MonitorPlay className="size-3.5 text-[#FF5412]" aria-hidden="true" />
              <span>Live Demo</span>
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="pb-safe-bottom-bar mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-[#262630] bg-[#111115] p-8 text-sm text-[#A1A1AA]">
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
