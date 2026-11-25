import { z } from 'zod';
import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import {
  approveOrder,
  generatePayFirstTakeawayToken,
  rotateTableQrToken,
} from '@/server/core';
import { NotFoundError, ValidationError } from '@/server/core/errors';
import { uuidSchema } from '@/lib/schemas';

const extendedFloorOpSchema = z.object({
  operation: z.enum([
    'MERGE',
    'TRANSFER',
    'SPLIT',
    'RESET',
    'ROTATE_QR',
    'MOVE',
    'APPROVE_ORDER',
    'COUNTER_TOKEN',
  ]),
  targetTableId: uuidSchema.optional(),
  orderId: uuidSchema.optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    const { tableId } = await params;
    const body = await parseJsonBody(req, extendedFloorOpSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(
      undefined,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos, realtime, print, auth } = getContainer();

    const claims = await auth.getSessionClaims(req).catch(() => null);
    const table = await repos.floor.findTableById(tenant.id, tableId);
    if (!table && body.operation !== 'COUNTER_TOKEN') {
      throw new NotFoundError('Table not found', { tableId });
    }

    switch (body.operation) {
      case 'ROTATE_QR': {
        const updatedTable = await rotateTableQrToken(
          { floor: repos.floor, audit: repos.audit, realtime },
          {
            tenantId: tenant.id,
            outletId: outlet.id,
            tableId,
            actorUserId: claims?.userId ?? null,
          },
        );
        return apiOk({ operation: 'ROTATE_QR', table: updatedTable, qrToken: updatedTable.qrToken });
      }

      case 'MOVE': {
        if (body.posX === undefined || body.posY === undefined) {
          throw new ValidationError('posX and posY are required for MOVE');
        }
        const updated = await repos.floor.updateTablePosition(
          tenant.id,
          tableId,
          body.posX,
          body.posY,
        );
        await realtime.publishToFloor(tenant.id, outlet.id, 'table.updated', {
          table: updated,
        });
        return apiOk({ operation: 'MOVE', table: updated });
      }

      case 'RESET': {
        if (table?.activeSessionId) {
          await repos.sessionOrder.updateSessionStatus(
            tenant.id,
            table.activeSessionId,
            'PAID',
            new Date(),
          );
        }
        const updated = await repos.floor.updateTableStatus(
          tenant.id,
          tableId,
          'VACANT',
          null,
        );
        await realtime.publishToFloor(tenant.id, outlet.id, 'table.updated', {
          table: updated,
        });
        return apiOk({ operation: 'RESET', table: updated });
      }

      case 'TRANSFER':
      case 'MERGE': {
        if (!body.targetTableId) {
          throw new ValidationError('targetTableId is required for MERGE/TRANSFER');
        }
        const target = await repos.floor.findTableById(tenant.id, body.targetTableId);
        if (!target) {
          throw new NotFoundError('Target table not found', { targetTableId: body.targetTableId });
        }
        const sessionIdToMove = table?.activeSessionId ?? target.activeSessionId;
        const updatedTarget = await repos.floor.updateTableStatus(
          tenant.id,
          target.id,
          sessionIdToMove ? 'EATING' : 'VACANT',
          sessionIdToMove,
        );
        const updatedSource = await repos.floor.updateTableStatus(
          tenant.id,
          tableId,
          body.operation === 'MERGE' && sessionIdToMove ? 'EATING' : 'VACANT',
          body.operation === 'MERGE' ? sessionIdToMove : null,
        );
        await realtime.publishToFloor(tenant.id, outlet.id, 'table.updated', {
          source: updatedSource,
          target: updatedTarget,
        });
        return apiOk({ operation: body.operation, source: updatedSource, target: updatedTarget });
      }

      case 'SPLIT': {
        const updated = await repos.floor.updateTableStatus(
          tenant.id,
          tableId,
          'VACANT',
          null,
        );
        await realtime.publishToFloor(tenant.id, outlet.id, 'table.updated', {
          table: updated,
        });
        return apiOk({ operation: 'SPLIT', table: updated });
      }

      case 'APPROVE_ORDER': {
        if (!body.orderId || !table?.activeSessionId) {
          throw new ValidationError('orderId and active table session are required');
        }
        const order = await approveOrder(
          {
            floor: repos.floor,
            menu: repos.menu,
            sessionOrder: repos.sessionOrder,
            realtime,
            print,
          },
          {
            tenantId: tenant.id,
            outletId: outlet.id,
            sessionId: table.activeSessionId,
            orderId: body.orderId,
            approvedByUserId: claims?.userId ?? 'staff',
          },
        );
        return apiOk({ operation: 'APPROVE_ORDER', order });
      }

      case 'COUNTER_TOKEN': {
        const token = generatePayFirstTakeawayToken({
          lastTokenNumber: Math.floor(100 + Math.random() * 800),
        });
        return apiOk({ operation: 'COUNTER_TOKEN', ...token });
      }
    }
  } catch (err) {
    return apiError(err);
  }
}
