'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChefHat,
  Crown,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface LoginClientProps {
  from: string;
}

interface DemoStaff {
  name: string;
  role: string;
  email: string;
  pin: string;
  target: string;
  icon: typeof Crown;
}

const DEMO_STAFF_MEMBERS: DemoStaff[] = [
  {
    name: 'Aarav Rahman',
    role: 'Owner / Partner',
    email: 'owner@zaikabistro.com',
    pin: '1234',
    target: '/dashboard',
    icon: Crown,
  },
  {
    name: 'Nadia Karim',
    role: 'Captain / Floor Lead',
    email: 'captain@zaikabistro.com',
    pin: '2222',
    target: '/pos/zaika-bistro',
    icon: UtensilsCrossed,
  },
  {
    name: 'Tariq Hasan',
    role: 'Cashier / Billing',
    email: 'cashier@zaikabistro.com',
    pin: '3333',
    target: '/pos/zaika-bistro',
    icon: Store,
  },
  {
    name: 'Chef Kabir',
    role: 'Head Chef (KDS)',
    email: 'chef@zaikabistro.com',
    pin: '4444',
    target: '/kds/zaika-bistro',
    icon: ChefHat,
  },
];

const GUEST_QR =
  'eyJ0IjoiMTExMTExMTEtMTExMS00MTExLTgxMTEtMTExMTExMTExMTExIiwibyI6IjIyMjIyMjIyLTIyMjItNDIyMi04MjIyLTIyMjIyMjIyMjIyMiIsInRibCI6IjY2NjY2NjY2LTY2NjYtNDY2Ni04NjY2LTY2NjY2NjY2NjYwMSIsIm4iOiJ6YWlrYTAxIiwiaWF0IjoxNzk1NjMyMDAwfQ.9_no91QOTl60pCNPzfmloMFIzjebyk0Wz8mItpBqPYI';

export function LoginClient({ from }: LoginClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pin' | 'email'>('pin');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePinLogin(pinToUse?: string, targetOverride?: string) {
    const finalPin = pinToUse ?? pin;
    if (finalPin.length < 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: finalPin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid staff PIN');
      }

      const destination = from && from !== '/login' ? from : targetOverride || '/dashboard';
      router.push(destination);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantSlug: 'zaika-bistro' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sign-in failed');
      }
      const destination = from && from !== '/login' ? from : '/dashboard';
      router.push(destination);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  function handleKeypadPress(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError(null);
    if (next.length === 4) {
      void handlePinLogin(next);
    }
  }

  function handleKeypadClear() {
    setPin('');
    setError(null);
  }

  return (
    <div className="grid-bg flex min-h-dvh flex-col justify-between p-4 sm:p-8">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex size-10 items-center justify-center rounded-xl bg-[#FF5412] font-mono text-sm font-black text-white shadow-beam"
          >
            PB
          </Link>
          <div>
            <Link href="/" className="text-xl font-extrabold tracking-tight">
              PlateBeam <span className="text-[#FF5412]">OS</span>
            </Link>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--pb-muted)]">
              Staff Clearance · Zaika Bistro Demo
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto my-auto w-full max-w-md py-6">
        <div className="rounded-3xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-6 shadow-2xl sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-2xl border border-[#FF5412]/35 bg-[#FF5412]/10 text-[#FF5412]">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Staff Access</h1>
            <p className="mt-1 text-xs text-[var(--pb-muted)]">
              {from && from !== '/login'
                ? `Clearance required for ${from}`
                : '4-digit POS PIN or owner credentials'}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pin');
                setError(null);
              }}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl transition-colors ${
                activeTab === 'pin'
                  ? 'bg-[#FF5412] text-white shadow-sm'
                  : 'text-[var(--pb-muted)] hover:text-[var(--pb-ink)]'
              }`}
            >
              <KeyRound className="size-4" aria-hidden="true" />
              Staff PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('email');
                setError(null);
              }}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl transition-colors ${
                activeTab === 'email'
                  ? 'bg-[#FF5412] text-white shadow-sm'
                  : 'text-[var(--pb-muted)] hover:text-[var(--pb-ink)]'
              }`}
            >
              <Mail className="size-4" aria-hidden="true" />
              Owner
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-3 text-center text-xs font-medium text-[#EF4444]"
            >
              {error}
            </div>
          )}

          {activeTab === 'pin' && (
            <div>
              <div className="mb-6 flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`flex size-12 items-center justify-center rounded-2xl border-2 font-mono text-2xl font-bold transition-colors sm:h-14 sm:w-12 ${
                      pin.length > idx
                        ? 'border-[#FF5412] bg-[#FF5412]/15 text-[var(--pb-ink)]'
                        : 'border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[var(--pb-muted)]/40'
                    }`}
                  >
                    {pin.length > idx ? '●' : '—'}
                  </div>
                ))}
              </div>

              <div className="mx-auto mb-6 grid max-w-xs grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={loading}
                    onClick={() => handleKeypadPress(digit)}
                    className="min-h-[52px] rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] font-mono text-lg font-bold transition-colors hover:border-[#FF5412]/60 active:scale-95"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={loading || pin.length === 0}
                  onClick={handleKeypadClear}
                  className="min-h-[52px] rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] text-xs font-semibold text-[var(--pb-muted)] transition-colors hover:text-[var(--pb-ink)] disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleKeypadPress('0')}
                  className="min-h-[52px] rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] font-mono text-lg font-bold transition-colors hover:border-[#FF5412]/60 active:scale-95"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={loading || pin.length < 4}
                  onClick={() => void handlePinLogin()}
                  aria-label="Submit PIN"
                  className="shadow-beam inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#FF5412] text-white transition-colors hover:bg-[#FF7033] disabled:opacity-40"
                >
                  {loading ? '…' : <ArrowRight className="size-5" aria-hidden="true" />}
                </button>
              </div>

              <div className="border-t border-[var(--pb-border)] pt-5">
                <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--pb-muted)]">
                  One-tap demo clearances
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {DEMO_STAFF_MEMBERS.map((staff) => {
                    const Icon = staff.icon;
                    return (
                      <button
                        key={staff.email}
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setPin(staff.pin);
                          void handlePinLogin(staff.pin, staff.target);
                        }}
                        className="flex min-h-[52px] items-start gap-2.5 rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-3 text-left transition-colors hover:border-[#FF5412] hover:bg-[var(--pb-surface-raised)]"
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-[#FF5412]" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold">{staff.name}</span>
                          <span className="block truncate text-[10px] text-[var(--pb-muted)]">
                            {staff.role}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10px] font-semibold text-[#FF5412]">
                            PIN {staff.pin}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--pb-muted)]" htmlFor="login-email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-[var(--pb-muted)]" aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@zaikabistro.com"
                    className="min-h-[44px] w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] py-2.5 pl-10 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-[#FF5412]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--pb-muted)]" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-[var(--pb-muted)]" aria-hidden="true" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="min-h-[44px] w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] py-2.5 pl-10 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-[#FF5412]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="shadow-beam inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF5412] text-sm font-bold text-white transition-colors hover:bg-[#FF7033] disabled:opacity-50"
              >
                {loading ? 'Authenticating…' : 'Sign In as Owner'}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('owner@zaikabistro.com');
                  setPassword('ZaikaOwner#2026');
                }}
                className="min-h-[44px] w-full rounded-xl border border-dashed border-[var(--pb-border)] py-2 text-xs font-medium text-[var(--pb-muted)] transition-colors hover:border-[#FF5412] hover:text-[#FF5412]"
              >
                Fill demo owner credentials
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 border-t border-[var(--pb-border)] pt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--pb-muted)]">
        <span>PlateBeam OS</span>
        <div className="flex flex-wrap gap-4">
          <Link href={`/t/${GUEST_QR}`} className="hover:text-[#FF5412]">
            Guest
          </Link>
          <Link href="/pos/zaika-bistro" className="hover:text-[#FF5412]">
            POS
          </Link>
          <Link href="/kds/zaika-bistro" className="hover:text-[#FF5412]">
            KDS
          </Link>
          <Link href="/dashboard" className="hover:text-[#FF5412]">
            Owner
          </Link>
          <Link href="/demo" className="hover:text-[#FF5412]">
            Demo
          </Link>
        </div>
      </footer>
    </div>
  );
}
