import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { signJwt } from '@/server/adapters/portable/jwt-auth.adapter';
import { UnauthorizedError } from '@/server/core/errors';
import { staffPinVerifySchema } from '@/lib/schemas';

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, staffPinVerifySchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(body.outletId);
    const { auth } = getContainer();

    const claims = await auth.verifyPosPin({
      tenantId: tenant.id,
      outletId: body.outletId ? outlet.id : undefined,
      pin: body.pin,
      userId: body.userId,
    });

    if (!claims) {
      throw new UnauthorizedError('Invalid staff PIN');
    }

    const token = await signJwt({
      sub: claims.userId,
      tenantId: claims.tenantId,
      outletId: claims.outletId,
      roleId: claims.roleId,
      roleName: claims.roleName,
      email: claims.email,
      fullName: claims.fullName,
    });

    const res = apiOk({
      verified: true,
      claims,
      token,
      user: {
        id: claims.userId,
        fullName: claims.fullName,
        email: claims.email,
        roleName: claims.roleName,
        isActive: true,
        outletId: claims.outletId,
      },
    });

    res.cookies.set('pb_session', token, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (err) {
    return apiError(err);
  }
}
