import { cookies } from 'next/headers';
import type {
  AuthPort,
  AuthSessionClaims,
  SignInInput,
  SignInResult,
} from '../../ports/auth.port';
import type {
  RbacRepository,
  TenantOutletRepository,
} from '../../ports/repositories.port';
import { AuthError } from '../supabase/auth.adapter';
import { resolveEffectivePermissions, verifySecret } from './crypto';

const SESSION_COOKIE_NAME = 'pb_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

interface JwtPayload {
  sub: string;
  tenantId: string;
  outletId?: string | null;
  roleId: string;
  roleName: string;
  email: string;
  fullName: string;
  iat: number;
  exp: number;
}

function getJwtSecret(): string {
  const secret =
    process.env.JWT_SECRET ??
    process.env.QR_HMAC_SECRET ??
    process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET (or QR_HMAC_SECRET) is required for JwtAuthAdapter',
    );
  }
  return secret;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return new Uint8Array(Buffer.from(padded + '='.repeat(padLen), 'base64'));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  ttlSeconds = TOKEN_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const headerB64 = base64UrlEncode(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  );
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importHmacKey(getJwtSecret());
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  try {
    const key = await importHmacKey(getJwtSecret());
    const sigBytes = base64UrlDecode(sigB64);
    const sigBuffer = new Uint8Array(sigBytes).buffer;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuffer,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!valid) return null;

    const decoded = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64)),
    ) as JwtPayload;
    if (decoded.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export class JwtAuthAdapter implements AuthPort {
  constructor(
    private readonly rbacRepo: RbacRepository,
    private readonly tenantRepo: TenantOutletRepository,
  ) {}

  private async buildClaimsForUser(
    tenantId: string,
    userId: string,
  ): Promise<AuthSessionClaims | null> {
    const user = await this.rbacRepo.findUserById(tenantId, userId);
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
    let token: string | undefined;

    const authHeader = req?.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {
        // Not in a Next.js request context
      }
    }

    if (!token) return null;
    const payload = await verifyJwt(token);
    if (!payload) return null;

    return this.buildClaimsForUser(payload.tenantId, payload.sub);
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
        return this.buildClaimsForUser(input.tenantId, user.id);
      }
    }

    return null;
  }

  async signIn(input: SignInInput): Promise<SignInResult> {
    const tenant = input.tenantSlug
      ? await this.tenantRepo.findTenantBySlug(input.tenantSlug)
      : (await this.tenantRepo.listTenants())[0] ?? null;

    if (!tenant) {
      throw new AuthError('Tenant not found', 401);
    }

    const user = await this.rbacRepo.findUserByEmail(tenant.id, input.email);
    if (!user || !user.isActive || !user.passwordHash) {
      throw new AuthError('Invalid email or password', 401);
    }

    if (!verifySecret(input.password, user.passwordHash)) {
      throw new AuthError('Invalid email or password', 401);
    }

    const claims = await this.buildClaimsForUser(tenant.id, user.id);
    if (!claims) {
      throw new AuthError('Staff account inactive', 403);
    }

    const accessToken = await signJwt({
      sub: claims.userId,
      tenantId: claims.tenantId,
      outletId: claims.outletId,
      roleId: claims.roleId,
      roleName: claims.roleName,
      email: claims.email,
      fullName: claims.fullName,
    });

    try {
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: TOKEN_TTL_SECONDS,
      });
    } catch {
      // Non-cookie caller (e.g. unit test)
    }

    return { claims, accessToken };
  }

  async signOut(): Promise<void> {
    try {
      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE_NAME);
    } catch {
      // Non-cookie caller
    }
  }
}
