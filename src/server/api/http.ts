import { NextResponse } from 'next/server';
import { ZodError, type z } from 'zod';
import { getContainer } from '../container';
import {
  DomainError,
  NotFoundError,
  ValidationError,
} from '../core/errors';
import type { AuthSessionClaims } from '../ports/auth.port';
import type { OutletRecord, TenantRecord } from '../ports/repositories.port';

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiError(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
      { status: err.statusCode },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: {
          issues: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      },
      { status: 400 },
    );
  }

  if (
    err &&
    typeof err === 'object' &&
    'statusCode' in err &&
    typeof (err as { statusCode: unknown }).statusCode === 'number'
  ) {
    const statusCode = (err as { statusCode: number }).statusCode;
    const message =
      err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json(
      { error: message, code: statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN' },
      { status: statusCode },
    );
  }

  const message =
    err instanceof Error ? err.message : 'Internal server error';
  return NextResponse.json(
    { error: message, code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}

export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ValidationError('Invalid JSON request body');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }
  return parsed.data;
}

export function parseQuery<T>(req: Request, schema: z.ZodType<T>): T {
  const url = new URL(req.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }
  return parsed.data;
}

export function getRequestIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return req.headers.get('x-real-ip') ?? null;
}

export async function requireStaffClaims(
  req: Request,
  requiredPermissions?: string[],
): Promise<AuthSessionClaims> {
  return getContainer().auth.requireStaff(req, requiredPermissions);
}

/**
 * Resolves a tenant and outlet from an outlet ID, subdomain slug, or `'default'`.
 */
export async function resolveTenantAndOutlet(
  outletIdOrSlug?: string,
  preferredTenantId?: string,
): Promise<{ tenant: TenantRecord; outlet: OutletRecord }> {
  const { repos } = getContainer();

  if (outletIdOrSlug && outletIdOrSlug !== 'default') {
    const bySubdomain = await repos.tenantOutlet.findOutletBySubdomain(outletIdOrSlug);
    if (bySubdomain) {
      const tenant = await repos.tenantOutlet.findTenantById(bySubdomain.tenantId);
      if (tenant) return { tenant, outlet: bySubdomain };
    }
  }

  const tenants = await repos.tenantOutlet.listTenants();
  const tenant =
    (preferredTenantId
      ? tenants.find((t) => t.id === preferredTenantId)
      : undefined) ?? tenants[0];

  if (!tenant) {
    throw new NotFoundError('No tenant configured. Run npm run db:seed first.');
  }

  const outlets = await repos.tenantOutlet.listOutlets(tenant.id);
  const outlet =
    (outletIdOrSlug && outletIdOrSlug !== 'default'
      ? outlets.find(
          (o) => o.id === outletIdOrSlug || o.subdomain === outletIdOrSlug,
        )
      : undefined) ?? outlets[0];

  if (!outlet) {
    throw new NotFoundError('Outlet not found', { outletIdOrSlug });
  }

  return { tenant, outlet };
}

export function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host = req.headers.get('host') ?? url.host;
  return `${proto}://${host}`;
}
