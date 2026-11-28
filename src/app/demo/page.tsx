import Link from 'next/link';
import { ArrowLeft, MonitorPlay } from 'lucide-react';
import { DemoSplitClient } from '@/components/ops/DemoSplitClient';

export const metadata = {
  title: 'Live Split-View Demo — PlateBeam OS',
};

export default function DemoPage() {
  return (
    <div className="grid-bg flex min-h-dvh flex-col bg-[#09090B] text-[#F4F4F5]">
      <header className="sticky top-0 z-30 border-b border-[#262630] bg-[#111115]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
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
                <MonitorPlay className="size-4 text-[#FF5412]" aria-hidden="true" />
                <p className="text-lg font-extrabold tracking-tight text-[#F4F4F5] sm:text-xl">
                  PlateBeam OS · Live Split Demo
                </p>
              </div>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#A1A1AA]">
                Ops Command (FOH POS / KDS / BI) + Docked 395px Guest QR
              </p>
            </div>
          </div>

          <nav aria-label="Demo quick links" className="hidden sm:flex items-center gap-2">
            <Link
              href="/pos/zaika-bistro"
              className="inline-flex min-h-11 items-center rounded-xl border border-[#262630] bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] hover:border-[#FF5412]"
            >
              POS
            </Link>
            <Link
              href="/kds/zaika-bistro"
              className="inline-flex min-h-11 items-center rounded-xl border border-[#262630] bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] hover:border-[#FF5412]"
            >
              KDS
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center rounded-xl border border-[#262630] bg-[#18181F] px-3 text-xs font-semibold text-[#F4F4F5] hover:border-[#FF5412]"
            >
              Owner BI
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6">
        <DemoSplitClient />
      </main>
    </div>
  );
}
