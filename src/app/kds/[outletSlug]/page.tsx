import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutDashboard, Monitor } from 'lucide-react';
import { KdsConsoleClient } from '@/components/ops/KdsConsoleClient';

export const metadata = {
  title: 'Kitchen Display (KDS) — PlateBeam OS',
};

async function KdsOutletContent({
  params,
}: {
  params: Promise<{ outletSlug: string }>;
}) {
  const { outletSlug } = await params;

  return (
    <div className="flex min-h-dvh flex-col bg-[#09090B] text-[#F4F4F5]">
      <div
        className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#FF5412] to-transparent"
        aria-hidden="true"
      />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#111115]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to PlateBeam home"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-white/10 bg-[#18181F] text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block size-2 rounded-full bg-[#FF5412]"
                  aria-hidden="true"
                />
                <p className="text-lg font-bold tracking-tight text-[#F4F4F5] sm:text-xl">
                  Kitchen Display (KDS)
                </p>
              </div>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#A1A1AA]">
                {outletSlug} · Bump 1–9 · Space · R Recall
              </p>
            </div>
          </div>

          <nav aria-label="KDS navigation" className="flex items-center gap-2">
            <Link
              href={`/pos/${outletSlug}`}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-white/10 bg-[#18181F] px-4 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
            >
              <Monitor className="size-3.5 text-[#FF5412]" aria-hidden="true" />
              FOH POS
            </Link>
            <Link
              href="/dashboard"
              className="hidden min-h-12 items-center gap-1.5 rounded-xl border border-white/10 bg-[#18181F] px-4 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412] sm:inline-flex"
            >
              <LayoutDashboard className="size-3.5 text-[#A1A1AA]" aria-hidden="true" />
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="pb-safe-bottom-bar mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
        <KdsConsoleClient outletSlug={outletSlug} />
      </main>
    </div>
  );
}

export default function KdsPage({
  params,
}: {
  params: Promise<{ outletSlug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#09090B] font-mono text-sm text-[#A1A1AA]">
          Loading station tickets…
        </div>
      }
    >
      <KdsOutletContent params={params} />
    </Suspense>
  );
}
