import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  AuthPort,
  AuthSessionClaims,
  SignInInput,
  SignInResult,
} from '../../ports/auth.port';
import type { RbacRepository, TenantOutletRepository } from '../../ports/repositories.port';
import { resolveEffectivePermissions, verifySecret } from '../portable/crypto';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403 = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required for SupabaseAuthAdapter',
    );
  }
  return { url, key };
}

export class SupabaseAuthAdapter implements AuthPort {
  constructor(
    private readonly rbacRepo: RbacRepository,
    private readonly tenantRepo: TenantOutletRepository,
  ) {}

  private async createClient() {
    const { url, key } = getSupabaseEnv();
    const cookieStore = await cookies();

    return createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }>,
        ) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component where mutating cookies is a no-op
          }
        },
      },
    });
  }

  private async buildClaimsForUser(
    tenantId: string,
    userId: string,
    emailFallback: string,
  ): Promise<AuthSessionClaims | null> {
    let user = await this.rbacRepo.findUserById(tenantId, userId);
    if (!user && emailFallback) {
      user = await this.rbacRepo.findUserByEmail(tenantId, emailFallback);
    }
    if (!user || !user.isActive) return null;

    const [role, overrides] = await Promise.all([
      this.rbacRepo.findRoleById(tenantId, user.roleId),
      this.rbacRepo.listUserOverrides(tenantId, user.id),
    ]);

    const permissions = resolveEffectivePermissions(
      role?.defaultPermissions ?? [],
      overrides,
    );

    return {
      userId: user.id,
      tenantId: user.tenantId,
      outletId: user.outletId,
      roleId: user.roleId,
      roleName: role?.name ?? 'STAFF',
      email: user.email,
      fullName: user.fullName,
      permissions,
    };
  }

  async getSessionClaims(req?: Request): Promise<AuthSessionClaims | null> {
    const supabase = await this.createClient();
    const authHeader = req?.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

    const { data, error } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    const supaUser = data.user;
    const metaTenantId =
      (supaUser.app_metadata?.tenant_id as string | undefined) ??
      (supaUser.user_metadata?.tenant_id as string | undefined);

    if (!metaTenantId) {
      return null;
    }

    return this.buildClaimsForUser(
      metaTenantId,
      supaUser.id,
      supaUser.email ?? '',
    );
  }

  async requireStaff(
    req?: Request,
    requiredPermissions?: string[],
  ): Promise<AuthSessionClaims> {
    const claims = await this.getSessionClaims(req);
    if (!claims) {
      throw new AuthError('Authentication required', 401);
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAll = requiredPermissions.every(
        (perm) =>
          claims.permissions.includes('*') || claims.permissions.includes(perm),
      );
      if (!hasAll) {
        throw new AuthError('Insufficient permissions', 403);
      }
    }

    return claims;
  }

  async verifyPosPin(input: {
    tenantId: string;
    outletId?: string;
    pin: string;
    userId?: string;
  }): Promise<AuthSessionClaims | null> {
    let users = input.userId
      ? [await this.rbacRepo.findUserById(input.tenantId, input.userId)].filter(
          (u): u is NonNullable<typeof u> => Boolean(u),
        )
      : await this.rbacRepo.listUsersByOutlet(input.tenantId, input.outletId);

    if (users.length === 0) {
      users = await this.rbacRepo.listUsersByOutlet(input.tenantId);
    }

    for (const user of users) {
      if (!user.isActive || !user.posPinHash) continue;
      if (verifySecret(input.pin, user.posPinHash)) {
        return this.buildClaimsForUser(input.tenantId, user.id, user.email);
      }
    }

    return null;
  }

  async signIn(input: SignInInput): Promise<SignInResult> {
    const supabase = await this.createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user || !data.session) {
      throw new AuthError(error?.message ?? 'Invalid credentials', 401);
    }

    let tenantId =
      (data.user.app_metadata?.tenant_id as string | undefined) ??
      (data.user.user_metadata?.tenant_id as string | undefined);

    if (!tenantId && input.tenantSlug) {
      const tenant = await this.tenantRepo.findTenantBySlug(input.tenantSlug);
      tenantId = tenant?.id;
    }

    if (!tenantId) {
      throw new AuthError('User is not bound to a tenant', 403);
    }

    const claims = await this.buildClaimsForUser(
      tenantId,
      data.user.id,
      data.user.email ?? input.email,
    );

    if (!claims) {
      throw new AuthError('Staff account inactive or not provisioned', 403);
    }

    return {
      claims,
      accessToken: data.session.access_token,
    };
  }

  async signOut(): Promise<void> {
    const supabase = await this.createClient();
    await supabase.auth.signOut();
  }
}
