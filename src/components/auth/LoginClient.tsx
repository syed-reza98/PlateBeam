'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChefHat,
  Crown,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Store,
  UtensilsCrossed,
  ArrowRight,
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
  color: string;
}

const DEMO_STAFF_MEMBERS: DemoStaff[] = [
  {
    name: 'Aarav Rahman',
    role: 'Owner / Partner',
    email: 'owner@zaikabistro.com',
    pin: '1234',
    target: '/dashboard',
    icon: Crown,
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    name: 'Nadia Karim',
    role: 'Captain / Floor Lead',
    email: 'captain@zaikabistro.com',
    pin: '2222',
    target: '/pos/zaika-bistro',
    icon: UtensilsCrossed,
    color: 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    name: 'Tariq Hasan',
    role: 'Cashier / Billing',
    email: 'cashier@zaikabistro.com',
    pin: '3333',
    target: '/pos/zaika-bistro',
    icon: Store,
    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    name: 'Chef Kabir',
    role: 'Head Chef (KDS)',
    email: 'chef@zaikabistro.com',
    pin: '4444',
    target: '/kds/zaika-bistro',
    icon: ChefHat,
    color: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
];

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
        throw new Error(data.error || 'Invalid email or password');
      }

      const destination = from && from !== '/login' ? from : '/dashboard';
      router.push(destination);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeypadPress(digit: string) {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        handlePinLogin(nextPin);
      }
    }
  }

  function handleKeypadClear() {
    setPin('');
    setError(null);
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-canvas text-ink p-4 sm:p-8">
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-border">
        <div>
          <span className="font-serif text-2xl sm:text-3xl tracking-tight text-accent">
            PlateBeam
          </span>
          <p className="text-xs text-muted">
            Zaika Bistro & Bar — Gulshan Flagship (Demo Cloud)
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Login Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="font-serif text-2xl font-bold">Staff Access Portal</h1>
            <p className="text-xs text-muted mt-1">
              {from && from !== '/login'
                ? `Sign in to access: ${from}`
                : 'Enter your 4-digit POS PIN or partner credentials'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-canvas border border-border rounded-xl mb-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pin');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                activeTab === 'pin'
                  ? 'bg-card text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <KeyRound className="w-4 h-4 inline-block mr-1.5" />
              Staff PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('email');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                activeTab === 'email'
                  ? 'bg-card text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Mail className="w-4 h-4 inline-block mr-1.5" />
              Owner / Admin
            </button>
          </div>

          {error && (
            <div className="p-3 mb-5 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
              {error}
            </div>
          )}

          {/* Tab 1: Staff PIN */}
          {activeTab === 'pin' && (
            <div>
              {/* PIN Display */}
              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center font-mono text-2xl font-bold transition-all ${
                      pin.length > idx
                        ? 'border-accent bg-accent/5 text-ink'
                        : 'border-border bg-canvas text-muted/30'
                    }`}
                  >
                    {pin.length > idx ? '●' : '—'}
                  </div>
                ))}
              </div>

              {/* Number Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto mb-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={loading}
                    onClick={() => handleKeypadPress(digit)}
                    className="h-12 rounded-xl border border-border bg-card hover:bg-canvas active:scale-95 text-lg font-mono font-medium transition-all shadow-sm"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={loading || pin.length === 0}
                  onClick={handleKeypadClear}
                  className="h-12 rounded-xl border border-border bg-card/60 hover:bg-canvas text-xs font-semibold text-muted transition-all"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleKeypadPress('0')}
                  className="h-12 rounded-xl border border-border bg-card hover:bg-canvas active:scale-95 text-lg font-mono font-medium transition-all shadow-sm"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={loading || pin.length < 4}
                  onClick={() => handlePinLogin()}
                  className="h-12 rounded-xl bg-accent text-white hover:opacity-90 active:scale-95 text-xs font-semibold transition-all flex items-center justify-center"
                >
                  {loading ? '...' : <ArrowRight className="w-5 h-5" />}
                </button>
              </div>

              {/* 1-Tap Demo Staff Switcher */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 text-center">
                  Quick 1-Tap Demo Staff Logins
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
                          handlePinLogin(staff.pin, staff.target);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-95 flex items-start gap-2 ${staff.color}`}
                      >
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{staff.name}</p>
                          <p className="text-[10px] opacity-80 truncate">{staff.role}</p>
                          <span className="text-[10px] font-mono font-semibold underline mt-0.5 block">
                            PIN: {staff.pin}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Email & Password */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@zaikabistro.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-canvas text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : 'Sign In as Owner'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('owner@zaikabistro.com');
                  setPassword('ZaikaOwner#2026');
                }}
                className="w-full py-2 text-xs text-muted hover:text-accent border border-dashed border-border rounded-xl transition-all"
              >
                Fill Demo Owner Credentials (owner@zaikabistro.com)
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Surface Quick-Access Footer */}
      <footer className="max-w-4xl w-full mx-auto pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>PlateBeam Next.js 16 + Supabase Architecture</span>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/t/demo" className="hover:text-accent underline">
            Guest QR Portal (/t/demo)
          </Link>
          <span>•</span>
          <Link href="/pos/zaika-bistro" className="hover:text-accent underline">
            FOH Floor Map (/pos/zaika-bistro)
          </Link>
          <span>•</span>
          <Link href="/kds/zaika-bistro" className="hover:text-accent underline">
            KDS Console (/kds/zaika-bistro)
          </Link>
          <span>•</span>
          <Link href="/dashboard" className="hover:text-accent underline">
            Owner Dashboard (/dashboard)
          </Link>
        </div>
      </footer>
    </div>
  );
}
