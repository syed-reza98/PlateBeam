import { Suspense } from 'react';
import { GuestPortalClient } from '@/components/guest/GuestPortalClient';

function GuestPortalSkeleton() {
  return (
    <div className="min-h-dvh bg-[var(--pb-canvas)] px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5 animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="h-8 w-44 rounded-lg bg-[var(--pb-border)]" />
          <div className="h-10 w-24 rounded-full bg-[var(--pb-border)]" />
        </div>
        <div className="h-44 w-full rounded-2xl bg-[var(--pb-border)]" />
        <div className="flex gap-2 overflow-hidden">
          <div className="h-11 w-24 rounded-full bg-[var(--pb-border)]" />
          <div className="h-11 w-24 rounded-full bg-[var(--pb-border)]" />
          <div className="h-11 w-24 rounded-full bg-[var(--pb-border)]" />
        </div>
        <div className="space-y-3">
          <div className="h-28 w-full rounded-2xl bg-[var(--pb-border)]" />
          <div className="h-28 w-full rounded-2xl bg-[var(--pb-border)]" />
          <div className="h-28 w-full rounded-2xl bg-[var(--pb-border)]" />
        </div>
      </div>
    </div>
  );
}

async function GuestPortalLoader({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  return <GuestPortalClient qrToken={decodeURIComponent(qrToken)} />;
}

export default function GuestTablePage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  return (
    <Suspense fallback={<GuestPortalSkeleton />}>
      <GuestPortalLoader params={params} />
    </Suspense>
  );
}
