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
    <div className="tower-field flex min-h-dvh flex-col justify-between p-4 sm:p-8">
      <div className="led-rail" aria-hidden="true" />

      <header className="mx-auto flex w-full max-w-4xl items-center justify-between pb-6">
        <div>
          <Link href="/" className="font-display text-3xl tracking-[0.04em] text-[var(--pb-accent)]">
            PlateBeam
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--pb-muted)]">
            Staff Clearance · Zaika Bistro Demo
          </p>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto my-auto w-full max-w-md py-8">
        <div className="rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface)] p-6 sm:p-8">
          <div className="mb-6 text-center">
            <div className="led-pulse mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-sm border border-[var(--pb-accent)] bg-[var(--pb-canvas)] text-[var(--pb-accent)]">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </div>
            <h1 className="font-display text-3xl tracking-wide">Staff Access</h1>
            <p className="mt-1 text-xs text-[var(--pb-muted)]">
              {from && from !== '/login'
                ? `Clearance required for ${from}`
                : '4-digit POS PIN or owner credentials'}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-1 rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pin');
                setError(null);
              }}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-sm transition-colors ${
                activeTab === 'pin'
                  ? 'bg-[var(--pb-surface)] text-[var(--pb-ink)]'
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
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-sm transition-colors ${
                activeTab === 'email'
                  ? 'bg-[var(--pb-surface)] text-[var(--pb-ink)]'
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
              className="mb-5 rounded-sm border border-[var(--pb-chili)]/30 bg-[var(--pb-chili)]/10 p-3 text-center text-xs text-[var(--pb-chili)]"
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
                    className={`flex size-12 items-center justify-center rounded-sm border-2 font-mono text-2xl font-bold sm:h-14 sm:w-12 ${
                      pin.length > idx
                        ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)]/10 text-[var(--pb-ink)]'
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
                    className="min-h-[48px] rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] font-mono text-lg font-medium active:scale-95"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={loading || pin.length === 0}
                  onClick={handleKeypadClear}
                  className="min-h-[48px] rounded-sm border border-[var(--pb-border)] text-xs font-semibold text-[var(--pb-muted)]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleKeypadPress('0')}
                  className="min-h-[48px] rounded-sm border border-[var(--pb-border)] bg-[var(--pb-surface-raised)] font-mono text-lg font-medium active:scale-95"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={loading || pin.length < 4}
                  onClick={() => void handlePinLogin()}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-sm bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]"
                >
                  {loading ? '...' : <ArrowRight className="size-5" aria-hidden="true" />}
                </button>
              </div>

              <div className="border-t border-[var(--pb-border)] pt-4">
                <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--pb-muted)]">
                  Demo clearances
                </p>
                <div className="grid grid-cols-2 gap-2">
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
                        className="flex min-h-[44px] items-start gap-2 rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-2.5 text-left hover:border-[var(--pb-accent)]"
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-[var(--pb-accent)]" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold">{staff.name}</span>
                          <span className="block truncate text-[10px] text-[var(--pb-muted)]">
                            {staff.role}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10px] text-[var(--pb-accent)]">
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
                <label className="mb-1 block text-xs font-medium text-[var(--pb-muted)]" htmlFor="login-email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-3 size-4 text-[var(--pb-muted)]" aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@zaikabistro.com"
                    className="min-h-[44px] w-full rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)] py-2 pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--pb-accent)]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--pb-muted)]" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-3 size-4 text-[var(--pb-muted)]" aria-hidden="true" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="min-h-[44px] w-full rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)] py-2 pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--pb-accent)]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-sm bg-[var(--pb-accent)] text-sm font-semibold text-[var(--pb-accent-ink)]"
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
                className="min-h-[44px] w-full rounded-sm border border-dashed border-[var(--pb-border)] py-2 text-xs text-[var(--pb-muted)] hover:text-[var(--pb-accent)]"
              >
                Fill demo owner credentials
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 border-t border-[var(--pb-border)] pt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--pb-muted)]">
        <span>PlateBeam Dispatch</span>
        <div className="flex flex-wrap gap-3">
          <Link href={`/t/${GUEST_QR}`} className="hover:text-[var(--pb-accent)]">
            Guest
          </Link>
          <Link href="/pos/zaika-bistro" className="hover:text-[var(--pb-accent)]">
            POS
          </Link>
          <Link href="/kds/zaika-bistro" className="hover:text-[var(--pb-accent)]">
            KDS
          </Link>
          <Link href="/dashboard" className="hover:text-[var(--pb-accent)]">
            Owner
          </Link>
        </div>
      </footer>
    </div>
  );
}
