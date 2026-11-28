import { createClient } from '@supabase/supabase-js';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { writeAuditLog } from '@/server/core';
import { ConflictError, NotFoundError, ValidationError } from '@/server/core/errors';
import { getDbDialect, withTenantTx } from '@/server/db/client';
import { mysqlSchema } from '@/server/db/schema/mysql';
import { pgSchema } from '@/server/db/schema/pg';
import type { RealtimeEventType } from '@/server/ports/realtime.port';
import type { GuestRecord } from '@/server/ports/repositories.port';
import { uuidSchema } from '@/lib/schemas';

const MIN_LOYALTY_REDEEM_POINTS = 200;
const MINOR_DISCOUNT_PER_POINT = 50; // 200 pts = 10000 minor units (৳100.00)

const loyaltyRedeemSchema = z.object({
  guestId: uuidSchema.optional(),
  phone: z.string().min(4).max(32).optional(),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(120).optional(),
  pointsToRedeem: z.number().int().min(MIN_LOYALTY_REDEEM_POINTS).default(MIN_LOYALTY_REDEEM_POINTS),
});

async function findGuestById(tenantId: string, guestId: string): Promise<GuestRecord | null> {
  if (process.env.DATABASE_URL) {
    return withTenantTx(tenantId, async (ctx) => {
      if (ctx.dialect === 'mysql') {
        const rows = await ctx.tx
          .select()
          .from(mysqlSchema.guests)
          .where(
            and(
              eq(mysqlSchema.guests.tenantId, tenantId),
              eq(mysqlSchema.guests.id, guestId),
            ),
          )
          .limit(1);
        return (rows[0] as GuestRecord | undefined) ?? null;
      }
      const rows = await ctx.tx
        .select()
        .from(pgSchema.guests)
        .where(
          and(
            eq(pgSchema.guests.tenantId, tenantId),
            eq(pgSchema.guests.id, guestId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await client
      .from('guests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', guestId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      tenantId: data.tenant_id,
      phone: data.phone,
      email: data.email,
      displayName: data.display_name,
      loyaltyPoints: data.loyalty_points ?? 0,
      loyaltyTier: data.loyalty_tier ?? 'BRONZE',
      isBlocked: Boolean(data.is_blocked),
      createdAt: new Date(data.created_at),
    };
  }

  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = await parseJsonBody(req, loyaltyRedeemSchema);
    const { tenant } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime } = getContainer();

    const session = await repos.sessionOrder.findSessionById(tenant.id, sessionId);
    if (!session) {
      throw new NotFoundError('Session not found', { sessionId });
    }
    if (session.status === 'PAID' || session.status === 'CANCELLED') {
      throw new ConflictError('Cannot redeem loyalty points on a closed session');
    }

    let guest: GuestRecord | null = null;
    if (body.guestId) {
      guest = await findGuestById(tenant.id, body.guestId);
    } else if (body.phone || body.email) {
      guest = await repos.engagement.findOrCreateGuest({
        tenantId: tenant.id,
        phone: body.phone,
        email: body.email,
        displayName: body.displayName ?? 'Guest',
      });
    } else {
      throw new ValidationError('guestId, phone, or email is required to redeem loyalty points');
    }

    if (!guest) {
      throw new NotFoundError('Guest not found', { guestId: body.guestId });
    }

    const pointsToRedeem = body.pointsToRedeem ?? MIN_LOYALTY_REDEEM_POINTS;

    if (guest.loyaltyPoints < pointsToRedeem) {
      throw new ValidationError(
        `Insufficient loyalty points: ${guest.loyaltyPoints} available, ${pointsToRedeem} required.`,
        {
          currentPoints: guest.loyaltyPoints,
          requiredPoints: pointsToRedeem,
        },
      );
    }

    const discountMinor = pointsToRedeem * MINOR_DISCOUNT_PER_POINT;
    const updatedGuest = await repos.engagement.addLoyaltyPoints(
      tenant.id,
      guest.id,
      -pointsToRedeem,
    );

    const nextDiscountMinor = session.discountMinor + discountMinor;
    const nextTotalMinor = Math.max(
      0,
      session.subtotalMinor +
        session.taxMinor +
        session.serviceChargeMinor +
        session.tipMinor -
        nextDiscountMinor,
    );

    const updatedSession = await repos.sessionOrder.updateSessionTotals(
      tenant.id,
      session.id,
      {
        subtotalMinor: session.subtotalMinor,
        taxMinor: session.taxMinor,
        discountMinor: nextDiscountMinor,
        serviceChargeMinor: session.serviceChargeMinor,
        tipMinor: session.tipMinor,
        totalMinor: nextTotalMinor,
        status: session.status,
        closedAt: session.closedAt,
      },
    );

    await writeAuditLog(repos.audit, {
      tenantId: tenant.id,
      outletId: session.outletId,
      action: 'LOYALTY_REDEEMED',
      entityType: 'table_sessions',
      entityId: session.id,
      beforeState: {
        discountMinor: session.discountMinor,
        totalMinor: session.totalMinor,
        loyaltyPoints: guest.loyaltyPoints,
      },
      afterState: {
        guestId: guest.id,
        pointsRedeemed: pointsToRedeem,
        discountAppliedMinor: discountMinor,
        discountMinor: updatedSession.discountMinor,
        totalMinor: updatedSession.totalMinor,
        loyaltyPoints: updatedGuest.loyaltyPoints,
      },
    });

    await realtime.publishToTableSession(
      tenant.id,
      session.id,
      'session.updated' as RealtimeEventType,
      {
        session: updatedSession,
        pointsRedeemed: pointsToRedeem,
        discountMinor,
      },
    );

    return apiOk({
      session: updatedSession,
      guest: {
        id: updatedGuest.id,
        displayName: updatedGuest.displayName,
        loyaltyPoints: updatedGuest.loyaltyPoints,
        loyaltyTier: updatedGuest.loyaltyTier,
      },
      pointsRedeemed: pointsToRedeem,
      discountMinor,
      currencyCode: tenant.currencyCode,
    });
  } catch (err) {
    return apiError(err);
  }
}

void getDbDialect;
