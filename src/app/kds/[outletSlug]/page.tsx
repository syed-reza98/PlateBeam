import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { KdsConsoleClient } from '@/components/ops/KdsConsoleClient';

export const metadata = {
  title: 'Obsidian Kitchen Display (KDS)',
};

async function KdsOutletContent({
  params,
}: {
  params: Promise<{ outletSlug: string }>;
}) {
  const { outletSlug } = await params;

  return (
    <div className="kds-surface min-h-dvh flex flex-col">
      <header className="border-b border-[#2E343D] bg-[#1B1E23]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to PlateBeam home"
              className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[#2E343D] bg-[#111315] text-[#F4F6F8] hover:border-[#F07346]"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </Link>
            <div>
              <p className="font-serif text-xl leading-none text-[#F4F6F8]">
                Obsidian Kitchen Display
              </p>
              <p className="mt-0.5 font-mono text-xs text-[#9AA4B2]">
                Outlet: {outletSlug} · Bump keys: 1–9, Space, R (Recall)
              </p>
            </div>
          </div>

          <nav aria-label="KDS navigation" className="flex items-center gap-2">
            <Link
              href={`/pos/${outletSlug}`}
              className="inline-flex min-h-12 items-center rounded-xl border border-[#2E343D] bg-[#111315] px-4 text-xs font-semibold text-[#F4F6F8] hover:border-[#F07346]"
            >
              FOH POS
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 pb-safe-bottom-bar">
        <KdsConsoleClient outletSlug={outletSlug} />
      </main>
    </div>
  );
}

export default function KdsOutletPage({
  params,
}: {
  params: Promise<{ outletSlug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="kds-surface min-h-dvh flex items-center justify-center p-8 text-sm text-[#9AA4B2]">
          Loading Obsidian Kitchen Display…
        </div>
      }
    >
      <KdsOutletContent params={params} />
    </Suspense>
  );
}
