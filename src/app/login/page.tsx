import { Suspense } from 'react';
import { LoginClient } from '@/components/auth/LoginClient';

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ?? '/dashboard';
  return <LoginClient from={from} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center p-4">
          Loading PlateBeam Portal...
        </div>
      }
    >
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
