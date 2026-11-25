import { z } from 'zod';
import { getContainer } from '@/server/container';
import { hashSecret } from '@/server/adapters/portable/crypto';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { setUserPermissionOverride } from '@/server/core';
import { permissionOverrideSchema } from '@/lib/schemas';

const createStaffSchema = z.object({
  fullName: z.string().min(2).max(160),
  email: z.string().email(),
  phone: z.string().max(32).optional(),
  roleId: z.string().uuid(),
  outletId: z.string().uuid().optional(),
  pin: z.string().min(4).max(8),
  password: z.string().min(6).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const outletParam = url.searchParams.get('outletId') ?? undefined;
    const { tenant, outlet } = await resolveTenantAndOutlet(outletParam);
    const { repos } = getContainer();

    const [users, roles] = await Promise.all([
      repos.rbac.listUsersByOutlet(tenant.id, outlet.id),
      repos.rbac.listRoles(tenant.id),
    ]);

    const overrideLists = await Promise.all(
      users.map((u) => repos.rbac.listUserOverrides(tenant.id, u.id)),
    );

    return apiOk({
      outletId: outlet.id,
      users: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        roleId: u.roleId,
        outletId: u.outletId,
        isActive: u.isActive,
      })),
      roles,
      overrides: overrideLists.flat(),
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, createStaffSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(body.outletId);
    const { repos } = getContainer();

    const user = await repos.rbac.createUser({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      outletId: body.outletId ?? outlet.id,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      passwordHash: hashSecret(body.password ?? 'PlateBeam#2026'),
      posPinHash: hashSecret(body.pin),
      roleId: body.roleId,
      isActive: true,
    });

    return apiOk(
      {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          roleId: user.roleId,
          outletId: user.outletId,
          isActive: user.isActive,
        },
      },
      201,
    );
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await parseJsonBody(req, permissionOverrideSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet();
    const { repos, auth } = getContainer();
    const claims = await auth.getSessionClaims(req).catch(() => null);

    const result = await setUserPermissionOverride(
      { rbac: repos.rbac, audit: repos.audit },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        actorUserId: claims?.userId ?? body.userId,
        targetUserId: body.userId,
        permissionKey: body.permissionKey,
        effect: body.effect,
      },
    );

    return apiOk(result);
  } catch (err) {
    return apiError(err);
  }
}
