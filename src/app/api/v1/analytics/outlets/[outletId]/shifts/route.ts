import { z } from 'zod';
import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { closeShiftWithZReport } from '@/server/core';
import { ConflictError } from '@/server/core/errors';
import { minorAmountSchema, uuidSchema } from '@/lib/schemas';

const shiftActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('OPEN'),
    openingFloatMinor: minorAmountSchema,
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('CLOSE'),
    shiftId: uuidSchema,
    actualCashMinor: minorAmountSchema,
    pettyCashMinor: minorAmountSchema.default(0),
    notes: z.string().max(500).optional(),
  }),
]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ outletId: string }> },
) {
  try {
    const { outletId: rawOutletId } = await params;
    const { tenant, outlet } = await resolveTenantAndOutlet(rawOutletId);
    const { repos } = getContainer();

    const shifts = await repos.shift.listShifts(tenant.id, outlet.id);
    return apiOk({ outletId: outlet.id, shifts });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ outletId: string }> },
) {
  try {
    const { outletId: rawOutletId } = await params;
    const body = await parseJsonBody(req, shiftActionSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(rawOutletId);
    const { repos, auth } = getContainer();
    const claims = await auth.getSessionClaims(req).catch(() => null);
    const users = await repos.rbac.listUsersByOutlet(tenant.id, outlet.id);
    const actorUserId = claims?.userId ?? users[0]?.id ?? crypto.randomUUID();

    if (body.action === 'OPEN') {
      const existing = await repos.shift.findOpenShift(tenant.id, outlet.id);
      if (existing) {
        throw new ConflictError('An open shift register already exists', {
          shiftId: existing.id,
        });
      }

      const shift = await repos.shift.openShift({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        outletId: outlet.id,
        openedByUserId: actorUserId,
        status: 'OPEN',
        openingFloatMinor: body.openingFloatMinor,
        notes: body.notes ?? null,
      });

      return apiOk({ shift }, 201);
    }

    const zReport = await closeShiftWithZReport(
      { shift: repos.shift, audit: repos.audit },
      {
        tenantId: tenant.id,
        outletId: outlet.id,
        shiftId: body.shiftId,
        closedByUserId: actorUserId,
        actualCashMinor: body.actualCashMinor,
        pettyCashMinor: body.pettyCashMinor ?? 0,
        paymentsInShift: [],
        notes: body.notes,
      },
    );

    return apiOk({ zReport });
  } catch (err) {
    return apiError(err);
  }
}
