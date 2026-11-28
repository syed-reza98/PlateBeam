import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChefHat, LayoutDashboard } from 'lucide-react';
import { PosFloorClient } from '@/components/ops/PosFloorClient';

export const metadata = {
  title: 'FOH Floor & POS — PlateBeam OS',
};

async function PosOutletContent({
  params,
}: {
  params: Promise<{ outletSlug: string }>;
}) {
  const { outletSlug } = await params;

  return (
    <div className="grid-bg flex min-h-dvh flex-col bg-[#09090B] text-[#F4F4F5]">
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
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-[#18181F] text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block size-2 rounded-full bg-[#FF5412]"
                  aria-hidden="true"
                />
                <p className="text-lg font-bold tracking-tight text-[#F4F4F5] sm:text-xl">
                  Front-of-House POS
                </p>
              </div>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#A1A1AA]">
                Outlet · {outletSlug} · BDT (৳)
              </p>
            </div>
          </div>

          <nav aria-label="Operations navigation" className="flex items-center gap-2">
            <Link
              href={`/kds/${outletSlug}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-[#18181F] px-3.5 py-2 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412]"
            >
              <ChefHat className="size-3.5 text-[#FF5412]" aria-hidden="true" />
              Open KDS
            </Link>
            <Link
              href="/dashboard"
              className="hidden min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-[#18181F] px-3.5 py-2 text-xs font-semibold text-[#F4F4F5] transition-colors hover:border-[#FF5412] sm:inline-flex"
            >
              <LayoutDashboard className="size-3.5 text-[#A1A1AA]" aria-hidden="true" />
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="pb-safe-bottom-bar mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
        <PosFloorClient outletSlug={outletSlug} />
      </main>
    </div>
  );
}

export default function PosOutletPage({
  params,
}: {
  params: Promise<{ outletSlug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#09090B] p-8 font-mono text-sm text-[#A1A1AA]">
          Loading floor map &amp; POS state…
        </div>
      }
    >
      <PosOutletContent params={params} />
    </Suspense>
  );
}
