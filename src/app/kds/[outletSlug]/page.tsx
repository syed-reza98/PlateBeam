import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { KdsConsoleClient } from '@/components/ops/KdsConsoleClient';

export const metadata = {
  title: 'Kitchen Display (KDS)',
};

async function KdsOutletContent({
  params,
}: {
  params: Promise<{ outletSlug: string }>;
}) {
  const { outletSlug } = await params;

  return (
    <div className="kds-surface flex min-h-dvh flex-col">
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-[#3DE0C5] to-[#F0A202]" aria-hidden="true" />
      <header className="border-b border-[#243552] bg-[#101a2c]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to PlateBeam home"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-sm border border-[#243552] bg-[#070d18] text-[#E8F0FF] hover:border-[#3DE0C5]"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
            <div>
              <p className="font-display text-2xl leading-none tracking-wide text-[#E8F0FF]">
                Kitchen Display
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8fa0b8]">
                {outletSlug} · bump 1–9 · space · R recall
              </p>
            </div>
          </div>

          <nav aria-label="KDS navigation" className="flex items-center gap-2">
            <Link
              href={`/pos/${outletSlug}`}
              className="inline-flex min-h-12 items-center rounded-sm border border-[#243552] bg-[#070d18] px-4 text-xs font-semibold text-[#E8F0FF] hover:border-[#3DE0C5]"
            >
              FOH POS
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
        <div className="kds-surface flex min-h-dvh items-center justify-center font-mono text-sm text-[#8fa0b8]">
          Loading station tickets…
        </div>
      }
    >
      <KdsOutletContent params={params} />
    </Suspense>
  );
}
