import { z } from 'zod';
import { getContainer } from '@/server/container';
import { apiError, apiOk, parseJsonBody } from '@/server/api/http';

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  tenantSlug: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const claims = await getContainer().auth.getSessionClaims(req);
    return apiOk({
      authenticated: Boolean(claims),
      claims,
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, signInSchema);
    const result = await getContainer().auth.signIn(body);
    return apiOk({
      authenticated: true,
      claims: result.claims,
      accessToken: result.accessToken,
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE() {
  try {
    await getContainer().auth.signOut();
    return apiOk({ authenticated: false });
  } catch (err) {
    return apiError(err);
  }
}
