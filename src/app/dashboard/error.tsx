'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid-bg flex min-h-dvh items-center justify-center bg-[#09090B] p-6 text-[#F4F4F5]">
      <div className="w-full max-w-md rounded-3xl border border-[#262630] bg-[#111115] p-6 text-center shadow-2xl">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#EF4444]/15 text-[#EF4444]">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">
          Owner Command Unavailable
        </h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">
          {error.message || 'An unexpected error occurred while loading live outlet telemetry.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#FF5412] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#FF7033]"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Retry Dashboard
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-xl border border-[#262630] bg-[#18181F] px-4 text-xs font-semibold text-[#F4F4F5] hover:border-[#FF5412]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
