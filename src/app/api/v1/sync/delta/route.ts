import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { placeOrder, transitionKdsItemStatus } from '@/server/core';
import type { KdsStatus, ServiceRequestStatus } from '@/server/db/types';
import { syncDeltaSchema } from '@/lib/schemas';

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, syncDeltaSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(body.outletId);
    const { repos, realtime, print, auth } = getContainer();
    const claims = await auth.getSessionClaims(req).catch(() => null);

    const results: Array<{
      idempotencyKey: string;
      kind: string;
      status: 'APPLIED' | 'SKIPPED' | 'ERROR';
      error?: string;
    }> = [];

    for (const mut of body.mutations) {
      try {
        if (mut.kind === 'KDS_STATUS') {
          const itemId = String(mut.payload.itemId ?? '');
          const nextStatus = String(mut.payload.status ?? 'READY') as KdsStatus;
          await transitionKdsItemStatus(
            { sessionOrder: repos.sessionOrder, realtime, audit: repos.audit },
            {
              tenantId: tenant.id,
              outletId: outlet.id,
              itemId,
              nextStatus,
              actorUserId: claims?.userId ?? null,
            },
          );
          results.push({ idempotencyKey: mut.idempotencyKey, kind: mut.kind, status: 'APPLIED' });
        } else if (mut.kind === 'SERVICE_REQUEST_CLAIM') {
          const requestId = String(mut.payload.requestId ?? '');
          const nextStatus = String(mut.payload.status ?? 'CLAIMED') as ServiceRequestStatus;
          await repos.serviceRequest.updateRequestStatus(
            tenant.id,
            requestId,
            nextStatus,
            claims?.userId ?? null,
            nextStatus === 'RESOLVED' ? new Date() : null,
          );
          results.push({ idempotencyKey: mut.idempotencyKey, kind: mut.kind, status: 'APPLIED' });
        } else if (mut.kind === 'PLACE_ORDER') {
          const sessionId = String(mut.payload.sessionId ?? '');
          const items = (mut.payload.items ?? []) as Array<{
            menuItemId: string;
            quantity: number;
            modifierIds?: string[];
            spiceLevel?: string;
            notes?: string;
          }>;
          await placeOrder(
            {
              tenantOutlet: repos.tenantOutlet,
              floor: repos.floor,
              menu: repos.menu,
              sessionOrder: repos.sessionOrder,
              inventory: repos.inventory,
              realtime,
              print,
            },
            {
              tenantId: tenant.id,
              outletId: outlet.id,
              sessionId,
              source: 'WAITER',
              actorUserId: claims?.userId ?? null,
              autoApprove: true,
              items: items.map((i) => ({
                menuItemId: i.menuItemId,
                quantity: i.quantity,
                modifierIds: i.modifierIds ?? [],
                spiceLevel: i.spiceLevel,
                notes: i.notes,
              })),
            },
          );
          results.push({ idempotencyKey: mut.idempotencyKey, kind: mut.kind, status: 'APPLIED' });
        }
      } catch (err) {
        results.push({
          idempotencyKey: mut.idempotencyKey,
          kind: mut.kind,
          status: 'ERROR',
          error: err instanceof Error ? err.message : 'Mutation failed',
        });
      }
    }

    return apiOk({
      outletId: outlet.id,
      clientId: body.clientId,
      processed: results.length,
      results,
    });
  } catch (err) {
    return apiError(err);
  }
}
