import { createDrizzleRepositories } from './adapters/drizzle/repositories.adapter';
import { createSupabaseRestRepositories } from './adapters/supabase/rest-repositories.adapter';
import { CashEdcPaymentAdapter } from './adapters/payments/cash-edc.adapter';
import { RazorpayPaymentAdapter } from './adapters/payments/razorpay.adapter';
import { SandboxPaymentAdapter } from './adapters/payments/sandbox.adapter';
import { SslCommerzPaymentAdapter } from './adapters/payments/sslcommerz.adapter';
import { StripePaymentAdapter } from './adapters/payments/stripe.adapter';
import { JwtAuthAdapter } from './adapters/portable/jwt-auth.adapter';
import { InMemoryPrintAdapter } from './adapters/portable/print.adapter';
import { S3StorageAdapter } from './adapters/portable/s3-storage.adapter';
import { SseRealtimeAdapter } from './adapters/portable/sse-realtime.adapter';
import { SupabaseAuthAdapter } from './adapters/supabase/auth.adapter';
import { SupabaseRealtimeAdapter } from './adapters/supabase/realtime.adapter';
import { SupabaseStorageAdapter } from './adapters/supabase/storage.adapter';
import { getDbDialect } from './db/client';
import type { DbDialect, PaymentProvider } from './db/types';
import type { AuthPort } from './ports/auth.port';
import type { PaymentPort } from './ports/payment.port';
import type { PrintPort } from './ports/print.port';
import type { RealtimePort } from './ports/realtime.port';
import type { RepositoryRegistry } from './ports/repositories.port';
import type { StoragePort } from './ports/storage.port';

export interface ServerContainer {
  dbDialect: DbDialect;
  repos: RepositoryRegistry;
  auth: AuthPort;
  realtime: RealtimePort;
  storage: StoragePort;
  print: PrintPort;
  defaultPaymentProvider: PaymentProvider;
  getPaymentAdapter(provider?: PaymentProvider): PaymentPort;
}

function hasSupabasePublicEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

function hasSupabaseSecretEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

function resolveAuthProvider(): 'supabase' | 'portable' {
  const raw = (process.env.AUTH_PROVIDER ?? '').toLowerCase().trim();
  if (raw === 'portable' || raw === 'jwt') return 'portable';
  if (raw === 'supabase') return 'supabase';
  return hasSupabasePublicEnv() ? 'supabase' : 'portable';
}

function resolveRealtimeProvider(): 'supabase' | 'sse' {
  const raw = (process.env.REALTIME_PROVIDER ?? '').toLowerCase().trim();
  if (raw === 'sse' || raw === 'portable') return 'sse';
  if (raw === 'supabase') return 'supabase';
  return hasSupabaseSecretEnv() ? 'supabase' : 'sse';
}

function resolveStorageProvider(): 'supabase' | 's3' {
  const raw = (process.env.STORAGE_PROVIDER ?? '').toLowerCase().trim();
  if (raw === 's3' || raw === 'portable') return 's3';
  if (raw === 'supabase') return 'supabase';
  return hasSupabaseSecretEnv() ? 'supabase' : 's3';
}

function resolveDefaultPaymentProvider(): PaymentProvider {
  const raw = (process.env.PAYMENT_PROVIDER ?? '').toUpperCase().trim();
  if (
    raw === 'SSLCOMMERZ' ||
    raw === 'STRIPE' ||
    raw === 'RAZORPAY' ||
    raw === 'CASH_EDC' ||
    raw === 'SANDBOX'
  ) {
    return raw;
  }
  return 'SANDBOX';
}

function createPaymentAdapters(): Record<PaymentProvider, PaymentPort> {
  const sandbox = new SandboxPaymentAdapter();
  const sslcommerz =
    process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWD
      ? new SslCommerzPaymentAdapter()
      : sandbox;
  const stripe = process.env.STRIPE_SECRET_KEY
    ? new StripePaymentAdapter()
    : sandbox;
  const razorpay =
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
      ? new RazorpayPaymentAdapter()
      : sandbox;
  const cashEdc = new CashEdcPaymentAdapter();

  return {
    SSLCOMMERZ: sslcommerz,
    STRIPE: stripe,
    RAZORPAY: razorpay,
    CASH_EDC: cashEdc,
    SANDBOX: sandbox,
  };
}

export function createContainer(): ServerContainer {
  const dbDialect = getDbDialect();
  const dbUrl = process.env.DATABASE_URL;
  const repos =
    !dbUrl && hasSupabaseSecretEnv()
      ? createSupabaseRestRepositories()
      : createDrizzleRepositories();

  const auth: AuthPort =
    resolveAuthProvider() === 'supabase'
      ? new SupabaseAuthAdapter(repos.rbac, repos.tenantOutlet)
      : new JwtAuthAdapter(repos.rbac, repos.tenantOutlet);

  const realtime: RealtimePort =
    resolveRealtimeProvider() === 'supabase'
      ? new SupabaseRealtimeAdapter()
      : new SseRealtimeAdapter();

  const storage: StoragePort =
    resolveStorageProvider() === 'supabase'
      ? new SupabaseStorageAdapter()
      : new S3StorageAdapter();

  const print: PrintPort = new InMemoryPrintAdapter();
  const defaultPaymentProvider = resolveDefaultPaymentProvider();
  const paymentAdapters = createPaymentAdapters();

  return {
    dbDialect,
    repos,
    auth,
    realtime,
    storage,
    print,
    defaultPaymentProvider,
    getPaymentAdapter(provider?: PaymentProvider): PaymentPort {
      const target = provider ?? defaultPaymentProvider;
      return paymentAdapters[target] ?? paymentAdapters.SANDBOX;
    },
  };
}

const globalForContainer = globalThis as unknown as {
  __platebeamContainer?: ServerContainer;
};

export function getContainer(): ServerContainer {
  if (!globalForContainer.__platebeamContainer) {
    globalForContainer.__platebeamContainer = createContainer();
  }
  return globalForContainer.__platebeamContainer;
}
