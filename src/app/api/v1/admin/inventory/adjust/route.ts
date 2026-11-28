import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  parseJsonBody,
  resolveTenantAndOutlet,
} from '@/server/api/http';
import { writeAuditLog } from '@/server/core';
import { inventoryAdjustSchema, uuidSchema } from '@/lib/schemas';

const restockAllSchema = z.object({
  mode: z.literal('RESTOCK_ALL'),
  outletId: uuidSchema.optional(),
  targetQty: z.number().positive().optional(),
});

const adjustRequestSchema = z.union([
  restockAllSchema,
  inventoryAdjustSchema.extend({
    mode: z.literal('DELTA').optional(),
    outletId: uuidSchema.optional(),
  }),
]);

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, adjustRequestSchema);
    const { tenant, outlet } = await resolveTenantAndOutlet(
      body.outletId,
      req.headers.get('x-tenant-id') ?? undefined,
    );
    const { repos } = getContainer();

    if ('mode' in body && body.mode === 'RESTOCK_ALL') {
      const items = await repos.inventory.listInventoryItems(tenant.id, outlet.id);
      const updated = [];

      for (const item of items) {
        const currentQty = Number(item.currentQty);
        const target =
          body.targetQty ?? Math.max(Number(item.reorderLevel) * 3, 25);
        const delta = target - currentQty;
        if (delta > 0) {
          const restocked = await repos.inventory.restockItem(
            tenant.id,
            item.id,
            delta,
          );
          updated.push(restocked);
        } else {
          updated.push(item);
        }
      }

      await writeAuditLog(repos.audit, {
        tenantId: tenant.id,
        outletId: outlet.id,
        action: 'INVENTORY_RESTOCK_ALL',
        entityType: 'inventory_items',
        entityId: outlet.id,
        afterState: {
          restockedCount: updated.length,
          targetQty: body.targetQty ?? null,
        },
      });

      revalidateTag('inventory', 'max');
      revalidateTag('analytics-live', 'max');

      return apiOk({
        mode: 'RESTOCK_ALL',
        updatedCount: updated.length,
        items: updated,
      });
    }

    const updated = await repos.inventory.restockItem(
      tenant.id,
      body.inventoryItemId,
      body.deltaQty,
    );

    revalidateTag('inventory', 'max');
    revalidateTag('analytics-live', 'max');

    return apiOk({ item: updated });
  } catch (err) {
    return apiError(err);
  }
}

export const PATCH = POST;
