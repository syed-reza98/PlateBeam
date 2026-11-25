import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDb, withTenantTx, type PgDb } from '../../db/client';
import { mysqlSchema } from '../../db/schema/mysql';
import { pgSchema } from '../../db/schema/pg';
import type {
  DiningTableStatus,
  KdsStatus,
  OrderStatus,
  PaymentStatus,
  ServiceRequestStatus,
  SessionStatus,
  ShiftStatus,
} from '../../db/types';
import type {
  AuditLogRecord,
  AuditRepository,
  BillingRepository,
  DiningTableRecord,
  FloorRepository,
  FloorZoneRecord,
  GuestEngagementRepository,
  GuestRecord,
  InventoryItemRecord,
  InventoryRepository,
  InvoiceRecord,
  ItemModifierRecord,
  KitchenStationRecord,
  MenuCategoryRecord,
  MenuItemRecipeRecord,
  MenuItemRecord,
  MenuRepository,
  MiniGameSessionRecord,
  NewOutletRecord,
  NewTenantRecord,
  NewUserRecord,
  OrderItemRecord,
  OrderRecord,
  OutletRecord,
  PaymentRecord,
  RbacRepository,
  RepositoryRegistry,
  ReviewRecord,
  RoleRecord,
  ServiceRequestRecord,
  ServiceRequestRepository,
  SessionOrderRepository,
  ShiftRegisterRecord,
  ShiftRegisterRepository,
  TableSessionRecord,
  TaxSlabRecord,
  TenantOutletRepository,
  TenantRecord,
  UpsellRuleRecord,
  UserPermissionOverrideRecord,
  UserRecord,
} from '../../ports/repositories.port';

type PgTx = Parameters<Parameters<PgDb['transaction']>[0]>[0];
type Schema = typeof pgSchema;

/**
 * Runs a database callback inside `withTenantTx` (PostgreSQL RLS + explicit tenant_id)
 * and provides the active dialect's Drizzle schema (`pgSchema` or `mysqlSchema`).
 */
async function withSchemaTx<T>(
  tenantId: string,
  fn: (tx: PgTx, s: Schema) => Promise<T>,
): Promise<T> {
  return withTenantTx(tenantId, async (ctx) => {
    if (ctx.dialect === 'postgres') {
      return fn(ctx.tx, pgSchema);
    }
    return fn(
      ctx.tx as unknown as PgTx,
      mysqlSchema as unknown as Schema,
    );
  });
}

/**
 * Runs a global (non-tenant-scoped) lookup or bootstrap query on the active dialect.
 */
async function withGlobalDb<T>(
  fn: (db: PgDb, s: Schema) => Promise<T>,
): Promise<T> {
  const conn = getDb();
  if (conn.dialect === 'postgres') {
    return fn(conn.db, pgSchema);
  }
  return fn(
    conn.db as unknown as PgDb,
    mysqlSchema as unknown as Schema,
  );
}

function mustOne<T>(rows: T[], entity: string, id: string): T {
  const row = rows[0];
  if (!row) {
    throw new Error(`${entity} not found: ${id}`);
  }
  return row;
}

class DrizzleTenantOutletRepository implements TenantOutletRepository {
  async findTenantById(tenantId: string): Promise<TenantRecord | null> {
    return withGlobalDb(async (db, s) => {
      const rows = await db
        .select()
        .from(s.tenants)
        .where(eq(s.tenants.id, tenantId))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async findTenantBySlug(slug: string): Promise<TenantRecord | null> {
    return withGlobalDb(async (db, s) => {
      const rows = await db
        .select()
        .from(s.tenants)
        .where(eq(s.tenants.slug, slug))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async listTenants(): Promise<TenantRecord[]> {
    return withGlobalDb(async (db, s) => {
      return db.select().from(s.tenants).orderBy(asc(s.tenants.name));
    });
  }

  async createTenant(data: NewTenantRecord): Promise<TenantRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withGlobalDb(async (db, s) => {
      await db.insert(s.tenants).values({ ...data, id });
      const rows = await db
        .select()
        .from(s.tenants)
        .where(eq(s.tenants.id, id))
        .limit(1);
      return mustOne(rows, 'Tenant', id);
    });
  }

  async findOutletById(
    tenantId: string,
    outletId: string,
  ): Promise<OutletRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.outlets)
        .where(and(eq(s.outlets.tenantId, tenantId), eq(s.outlets.id, outletId)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async findOutletBySubdomain(subdomain: string): Promise<OutletRecord | null> {
    return withGlobalDb(async (db, s) => {
      const rows = await db
        .select()
        .from(s.outlets)
        .where(eq(s.outlets.subdomain, subdomain))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async listOutlets(tenantId: string): Promise<OutletRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.outlets)
        .where(eq(s.outlets.tenantId, tenantId))
        .orderBy(asc(s.outlets.name));
    });
  }

  async createOutlet(data: NewOutletRecord): Promise<OutletRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.outlets).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.outlets)
        .where(and(eq(s.outlets.tenantId, data.tenantId), eq(s.outlets.id, id)))
        .limit(1);
      return mustOne(rows, 'Outlet', id);
    });
  }

  async updateOutletPolicy(
    tenantId: string,
    outletId: string,
    policy: OutletRecord['qrSecurityPolicy'],
  ): Promise<OutletRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      await tx
        .update(s.outlets)
        .set({ qrSecurityPolicy: policy })
        .where(and(eq(s.outlets.tenantId, tenantId), eq(s.outlets.id, outletId)));
      const rows = await tx
        .select()
        .from(s.outlets)
        .where(and(eq(s.outlets.tenantId, tenantId), eq(s.outlets.id, outletId)))
        .limit(1);
      return mustOne(rows, 'Outlet', outletId);
    });
  }
}

class DrizzleRbacRepository implements RbacRepository {
  async findUserById(tenantId: string, userId: string): Promise<UserRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.users)
        .where(and(eq(s.users.tenantId, tenantId), eq(s.users.id, userId)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async findUserByEmail(
    tenantId: string,
    email: string,
  ): Promise<UserRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.users)
        .where(and(eq(s.users.tenantId, tenantId), eq(s.users.email, email)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async listUsersByOutlet(
    tenantId: string,
    outletId?: string,
  ): Promise<UserRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const cond = outletId
        ? and(eq(s.users.tenantId, tenantId), eq(s.users.outletId, outletId))
        : eq(s.users.tenantId, tenantId);
      return tx.select().from(s.users).where(cond).orderBy(asc(s.users.fullName));
    });
  }

  async createUser(data: NewUserRecord): Promise<UserRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.users).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.users)
        .where(and(eq(s.users.tenantId, data.tenantId), eq(s.users.id, id)))
        .limit(1);
      return mustOne(rows, 'User', id);
    });
  }

  async findRoleById(tenantId: string, roleId: string): Promise<RoleRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.roles)
        .where(eq(s.roles.id, roleId))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async listRoles(tenantId: string): Promise<RoleRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.roles)
        .where(
          sql`${s.roles.tenantId} = ${tenantId} OR ${s.roles.tenantId} IS NULL`,
        )
        .orderBy(asc(s.roles.name));
    });
  }

  async listUserOverrides(
    tenantId: string,
    userId: string,
  ): Promise<UserPermissionOverrideRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.userPermissionOverrides)
        .where(
          and(
            eq(s.userPermissionOverrides.tenantId, tenantId),
            eq(s.userPermissionOverrides.userId, userId),
          ),
        );
    });
  }

  async upsertPermissionOverride(input: {
    tenantId: string;
    userId: string;
    permissionKey: string;
    effect: 'GRANT' | 'DENY';
  }): Promise<UserPermissionOverrideRecord> {
    return withSchemaTx(input.tenantId, async (tx, s) => {
      const existing = await tx
        .select()
        .from(s.userPermissionOverrides)
        .where(
          and(
            eq(s.userPermissionOverrides.tenantId, input.tenantId),
            eq(s.userPermissionOverrides.userId, input.userId),
            eq(s.userPermissionOverrides.permissionKey, input.permissionKey),
          ),
        )
        .limit(1);

      if (existing[0]) {
        await tx
          .update(s.userPermissionOverrides)
          .set({ effect: input.effect })
          .where(
            and(
              eq(s.userPermissionOverrides.tenantId, input.tenantId),
              eq(s.userPermissionOverrides.id, existing[0].id),
            ),
          );
        const updated = await tx
          .select()
          .from(s.userPermissionOverrides)
          .where(
            and(
              eq(s.userPermissionOverrides.tenantId, input.tenantId),
              eq(s.userPermissionOverrides.id, existing[0].id),
            ),
          )
          .limit(1);
        return mustOne(updated, 'UserPermissionOverride', existing[0].id);
      }

      const id = crypto.randomUUID();
      await tx.insert(s.userPermissionOverrides).values({
        id,
        tenantId: input.tenantId,
        userId: input.userId,
        permissionKey: input.permissionKey,
        effect: input.effect,
      });
      const inserted = await tx
        .select()
        .from(s.userPermissionOverrides)
        .where(
          and(
            eq(s.userPermissionOverrides.tenantId, input.tenantId),
            eq(s.userPermissionOverrides.id, id),
          ),
        )
        .limit(1);
      return mustOne(inserted, 'UserPermissionOverride', id);
    });
  }
}

class DrizzleFloorRepository implements FloorRepository {
  async listZones(tenantId: string, outletId: string): Promise<FloorZoneRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.floorZones)
        .where(
          and(
            eq(s.floorZones.tenantId, tenantId),
            eq(s.floorZones.outletId, outletId),
          ),
        )
        .orderBy(asc(s.floorZones.displayOrder));
    });
  }

  async listTables(
    tenantId: string,
    outletId: string,
  ): Promise<DiningTableRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.diningTables)
        .where(
          and(
            eq(s.diningTables.tenantId, tenantId),
            eq(s.diningTables.outletId, outletId),
          ),
        )
        .orderBy(asc(s.diningTables.tableNumber));
    });
  }

  async findTableById(
    tenantId: string,
    tableId: string,
  ): Promise<DiningTableRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.diningTables)
        .where(
          and(
            eq(s.diningTables.tenantId, tenantId),
            eq(s.diningTables.id, tableId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async findTableByQrToken(qrToken: string): Promise<DiningTableRecord | null> {
    return withGlobalDb(async (db, s) => {
      const rows = await db
        .select()
        .from(s.diningTables)
        .where(eq(s.diningTables.qrToken, qrToken))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async updateTableStatus(
    tenantId: string,
    tableId: string,
    status: DiningTableStatus,
    activeSessionId?: string | null,
  ): Promise<DiningTableRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const patch: Partial<DiningTableRecord> = { status };
      if (activeSessionId !== undefined) {
        patch.activeSessionId = activeSessionId;
      }
      await tx
        .update(s.diningTables)
        .set(patch)
        .where(
          and(
            eq(s.diningTables.tenantId, tenantId),
            eq(s.diningTables.id, tableId),
          ),
        );
      const rows = await tx
        .select()
        .from(s.diningTables)
        .where(
          and(
            eq(s.diningTables.tenantId, tenantId),
            eq(s.diningTables.id, tableId),
          ),
        )
        .limit(1);
      return mustOne(rows, 'DiningTable', tableId);
    });
  }

  async rotateTableQrToken(
    tenantId: string,
    tableId: string,
    newToken: string,
  ): Promise<DiningTableRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      await tx
        .update(s.diningTables)
        .set({ qrToken: newToken, qrRotatedAt: new Date() })
        .where(
          and(
            eq(s.diningTables.tenantId, tenantId),
            eq(s.diningTables.id, tableId),
          ),
        );
      const rows = await tx
        .select()
        .from(s.diningTables)
        .where(
          and(
            eq(s.diningTables.tenantId, tenantId),
            eq(s.diningTables.id, tableId),
          ),
        )
        .limit(1);
      return mustOne(rows, 'DiningTable', tableId);
    });
  }

  async updateTablePosition(
    tenantId: string,
    tableId: string,
    posX: number,
    posY: number,
  ): Promise<DiningTableRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      await tx
        .update(s.diningTables)
        .set({ posX, posY })
        .where(
          and(
            eq(s.diningTables.tenantId, tenantId),
            eq(s.diningTables.id, tableId),
          ),
        );
      const rows = await tx
        .select()
        .from(s.diningTables)
        .where(
          and(
            eq(s.diningTables.tenantId, tenantId),
            eq(s.diningTables.id, tableId),
          ),
        )
        .limit(1);
      return mustOne(rows, 'DiningTable', tableId);
    });
  }
}

class DrizzleMenuRepository implements MenuRepository {
  async listStations(
    tenantId: string,
    outletId: string,
  ): Promise<KitchenStationRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.kitchenStations)
        .where(
          and(
            eq(s.kitchenStations.tenantId, tenantId),
            eq(s.kitchenStations.outletId, outletId),
          ),
        )
        .orderBy(asc(s.kitchenStations.name));
    });
  }

  async listCategories(
    tenantId: string,
    outletId: string,
  ): Promise<MenuCategoryRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.menuCategories)
        .where(
          and(
            eq(s.menuCategories.tenantId, tenantId),
            eq(s.menuCategories.outletId, outletId),
          ),
        )
        .orderBy(asc(s.menuCategories.sortOrder));
    });
  }

  async listTaxSlabs(tenantId: string, outletId: string): Promise<TaxSlabRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.taxSlabs)
        .where(
          and(eq(s.taxSlabs.tenantId, tenantId), eq(s.taxSlabs.outletId, outletId)),
        )
        .orderBy(asc(s.taxSlabs.name));
    });
  }

  async listMenuItems(
    tenantId: string,
    outletId: string,
    onlyAvailable?: boolean,
  ): Promise<MenuItemRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const cond = onlyAvailable
        ? and(
            eq(s.menuItems.tenantId, tenantId),
            eq(s.menuItems.outletId, outletId),
            eq(s.menuItems.isAvailable, true),
          )
        : and(
            eq(s.menuItems.tenantId, tenantId),
            eq(s.menuItems.outletId, outletId),
          );
      return tx.select().from(s.menuItems).where(cond).orderBy(asc(s.menuItems.name));
    });
  }

  async findMenuItemById(
    tenantId: string,
    itemId: string,
  ): Promise<MenuItemRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.menuItems)
        .where(and(eq(s.menuItems.tenantId, tenantId), eq(s.menuItems.id, itemId)))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async listModifiersByOutlet(
    tenantId: string,
    outletId: string,
  ): Promise<ItemModifierRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select({ mod: s.itemVariantsModifiers })
        .from(s.itemVariantsModifiers)
        .innerJoin(
          s.menuItems,
          eq(s.itemVariantsModifiers.menuItemId, s.menuItems.id),
        )
        .where(
          and(
            eq(s.itemVariantsModifiers.tenantId, tenantId),
            eq(s.menuItems.outletId, outletId),
          ),
        );
      return rows.map((r) => r.mod);
    });
  }

  async listUpsellRules(
    tenantId: string,
    outletId: string,
  ): Promise<UpsellRuleRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.upsellRules)
        .where(
          and(
            eq(s.upsellRules.tenantId, tenantId),
            eq(s.upsellRules.outletId, outletId),
          ),
        )
        .orderBy(desc(s.upsellRules.priority));
    });
  }

  async setItemAvailability(
    tenantId: string,
    itemId: string,
    isAvailable: boolean,
  ): Promise<MenuItemRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      await tx
        .update(s.menuItems)
        .set({ isAvailable })
        .where(and(eq(s.menuItems.tenantId, tenantId), eq(s.menuItems.id, itemId)));
      const rows = await tx
        .select()
        .from(s.menuItems)
        .where(and(eq(s.menuItems.tenantId, tenantId), eq(s.menuItems.id, itemId)))
        .limit(1);
      return mustOne(rows, 'MenuItem', itemId);
    });
  }

  async upsertMenuItem(
    data: typeof pgSchema.menuItems.$inferInsert,
  ): Promise<MenuItemRecord> {
    return withSchemaTx(data.tenantId, async (tx, s) => {
      if (data.id) {
        const existing = await tx
          .select()
          .from(s.menuItems)
          .where(
            and(
              eq(s.menuItems.tenantId, data.tenantId),
              eq(s.menuItems.id, data.id),
            ),
          )
          .limit(1);
        if (existing[0]) {
          await tx
            .update(s.menuItems)
            .set(data)
            .where(
              and(
                eq(s.menuItems.tenantId, data.tenantId),
                eq(s.menuItems.id, data.id),
              ),
            );
          const updated = await tx
            .select()
            .from(s.menuItems)
            .where(
              and(
                eq(s.menuItems.tenantId, data.tenantId),
                eq(s.menuItems.id, data.id),
              ),
            )
            .limit(1);
          return mustOne(updated, 'MenuItem', data.id);
        }
      }

      const id = data.id ?? crypto.randomUUID();
      await tx.insert(s.menuItems).values({ ...data, id });
      const inserted = await tx
        .select()
        .from(s.menuItems)
        .where(
          and(eq(s.menuItems.tenantId, data.tenantId), eq(s.menuItems.id, id)),
        )
        .limit(1);
      return mustOne(inserted, 'MenuItem', id);
    });
  }
}

class DrizzleSessionOrderRepository implements SessionOrderRepository {
  async findSessionById(
    tenantId: string,
    sessionId: string,
  ): Promise<TableSessionRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.tableSessions)
        .where(
          and(
            eq(s.tableSessions.tenantId, tenantId),
            eq(s.tableSessions.id, sessionId),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async findOpenSessionByTable(
    tenantId: string,
    tableId: string,
  ): Promise<TableSessionRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.tableSessions)
        .where(
          and(
            eq(s.tableSessions.tenantId, tenantId),
            eq(s.tableSessions.tableId, tableId),
            inArray(s.tableSessions.status, [
              'OPEN',
              'BILL_REQUESTED',
              'PARTIALLY_PAID',
            ]),
          ),
        )
        .orderBy(desc(s.tableSessions.openedAt))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async createSession(
    data: typeof pgSchema.tableSessions.$inferInsert,
  ): Promise<TableSessionRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.tableSessions).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.tableSessions)
        .where(
          and(
            eq(s.tableSessions.tenantId, data.tenantId),
            eq(s.tableSessions.id, id),
          ),
        )
        .limit(1);
      return mustOne(rows, 'TableSession', id);
    });
  }

  async updateSessionTotals(
    tenantId: string,
    sessionId: string,
    totals: Pick<
      TableSessionRecord,
      | 'subtotalMinor'
      | 'taxMinor'
      | 'discountMinor'
      | 'serviceChargeMinor'
      | 'tipMinor'
      | 'totalMinor'
      | 'status'
      | 'closedAt'
    >,
  ): Promise<TableSessionRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      await tx
        .update(s.tableSessions)
        .set(totals)
        .where(
          and(
            eq(s.tableSessions.tenantId, tenantId),
            eq(s.tableSessions.id, sessionId),
          ),
        );
      const rows = await tx
        .select()
        .from(s.tableSessions)
        .where(
          and(
            eq(s.tableSessions.tenantId, tenantId),
            eq(s.tableSessions.id, sessionId),
          ),
        )
        .limit(1);
      return mustOne(rows, 'TableSession', sessionId);
    });
  }

  async updateSessionStatus(
    tenantId: string,
    sessionId: string,
    status: SessionStatus,
    closedAt?: Date | null,
  ): Promise<TableSessionRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const patch: Partial<TableSessionRecord> = { status };
      if (closedAt !== undefined) {
        patch.closedAt = closedAt;
      }
      await tx
        .update(s.tableSessions)
        .set(patch)
        .where(
          and(
            eq(s.tableSessions.tenantId, tenantId),
            eq(s.tableSessions.id, sessionId),
          ),
        );
      const rows = await tx
        .select()
        .from(s.tableSessions)
        .where(
          and(
            eq(s.tableSessions.tenantId, tenantId),
            eq(s.tableSessions.id, sessionId),
          ),
        )
        .limit(1);
      return mustOne(rows, 'TableSession', sessionId);
    });
  }

  async listOrdersBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<OrderRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.orders)
        .where(
          and(eq(s.orders.tenantId, tenantId), eq(s.orders.sessionId, sessionId)),
        )
        .orderBy(asc(s.orders.roundNumber), asc(s.orders.createdAt));
    });
  }

  async createOrderWithItems(input: {
    order: typeof pgSchema.orders.$inferInsert;
    items: Array<typeof pgSchema.orderItems.$inferInsert>;
  }): Promise<{ order: OrderRecord; items: OrderItemRecord[] }> {
    const orderId = input.order.id ?? crypto.randomUUID();
    const tenantId = input.order.tenantId;
    const itemRowsToInsert = input.items.map((item) => ({
      ...item,
      id: item.id ?? crypto.randomUUID(),
      orderId,
      tenantId,
    }));

    return withSchemaTx(tenantId, async (tx, s) => {
      await tx.insert(s.orders).values({ ...input.order, id: orderId });
      if (itemRowsToInsert.length > 0) {
        await tx.insert(s.orderItems).values(itemRowsToInsert);
      }
      const orderRows = await tx
        .select()
        .from(s.orders)
        .where(and(eq(s.orders.tenantId, tenantId), eq(s.orders.id, orderId)))
        .limit(1);
      const items = await tx
        .select()
        .from(s.orderItems)
        .where(
          and(
            eq(s.orderItems.tenantId, tenantId),
            eq(s.orderItems.orderId, orderId),
          ),
        );
      return {
        order: mustOne(orderRows, 'Order', orderId),
        items,
      };
    });
  }

  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    approvedByUserId?: string | null,
  ): Promise<OrderRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const patch: Partial<OrderRecord> = { status };
      if (approvedByUserId !== undefined) {
        patch.approvedByUserId = approvedByUserId;
      }
      await tx
        .update(s.orders)
        .set(patch)
        .where(and(eq(s.orders.tenantId, tenantId), eq(s.orders.id, orderId)));
      const rows = await tx
        .select()
        .from(s.orders)
        .where(and(eq(s.orders.tenantId, tenantId), eq(s.orders.id, orderId)))
        .limit(1);
      return mustOne(rows, 'Order', orderId);
    });
  }

  async listOrderItemsBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<OrderItemRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select({ item: s.orderItems })
        .from(s.orderItems)
        .innerJoin(s.orders, eq(s.orderItems.orderId, s.orders.id))
        .where(
          and(
            eq(s.orderItems.tenantId, tenantId),
            eq(s.orders.sessionId, sessionId),
          ),
        );
      return rows.map((r) => r.item);
    });
  }

  async listKdsQueue(
    tenantId: string,
    outletId: string,
    stationId?: string,
  ): Promise<
    Array<
      OrderItemRecord & {
        orderNumber: string;
        tableId: string | null;
        tokenNumber: number | null;
        createdAt: Date;
      }
    >
  > {
    return withSchemaTx(tenantId, async (tx, s) => {
      const conditions = [
        eq(s.orderItems.tenantId, tenantId),
        eq(s.orders.outletId, outletId),
        inArray(s.orderItems.kdsStatus, [
          'PENDING',
          'ACCEPTED',
          'PREPARING',
          'READY',
        ]),
      ];
      if (stationId) {
        conditions.push(eq(s.orderItems.stationId, stationId));
      }

      const rows = await tx
        .select({
          item: s.orderItems,
          orderNumber: s.orders.orderNumber,
          createdAt: s.orders.createdAt,
          tableId: s.tableSessions.tableId,
          tokenNumber: s.tableSessions.tokenNumber,
        })
        .from(s.orderItems)
        .innerJoin(s.orders, eq(s.orderItems.orderId, s.orders.id))
        .innerJoin(
          s.tableSessions,
          eq(s.orders.sessionId, s.tableSessions.id),
        )
        .where(and(...conditions))
        .orderBy(asc(s.orders.createdAt));

      return rows.map((r) => ({
        ...r.item,
        orderNumber: r.orderNumber,
        tableId: r.tableId,
        tokenNumber: r.tokenNumber,
        createdAt: r.createdAt,
      }));
    });
  }

  async updateOrderItemKdsStatus(
    tenantId: string,
    itemId: string,
    status: KdsStatus,
    timestamps?: Partial<Pick<OrderItemRecord, 'startedAt' | 'readyAt' | 'servedAt'>>,
  ): Promise<OrderItemRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      await tx
        .update(s.orderItems)
        .set({ kdsStatus: status, ...(timestamps ?? {}) })
        .where(
          and(eq(s.orderItems.tenantId, tenantId), eq(s.orderItems.id, itemId)),
        );
      const rows = await tx
        .select()
        .from(s.orderItems)
        .where(
          and(eq(s.orderItems.tenantId, tenantId), eq(s.orderItems.id, itemId)),
        )
        .limit(1);
      return mustOne(rows, 'OrderItem', itemId);
    });
  }
}

class DrizzleServiceRequestRepository implements ServiceRequestRepository {
  async listOpenRequests(
    tenantId: string,
    outletId: string,
  ): Promise<ServiceRequestRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.serviceRequests)
        .where(
          and(
            eq(s.serviceRequests.tenantId, tenantId),
            eq(s.serviceRequests.outletId, outletId),
            inArray(s.serviceRequests.status, ['OPEN', 'CLAIMED']),
          ),
        )
        .orderBy(asc(s.serviceRequests.createdAt));
    });
  }

  async findRecentRequestForTable(
    tenantId: string,
    tableId: string,
    requestType: ServiceRequestRecord['requestType'],
    since: Date,
  ): Promise<ServiceRequestRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.serviceRequests)
        .where(
          and(
            eq(s.serviceRequests.tenantId, tenantId),
            eq(s.serviceRequests.tableId, tableId),
            eq(s.serviceRequests.requestType, requestType),
            gte(s.serviceRequests.createdAt, since),
          ),
        )
        .orderBy(desc(s.serviceRequests.createdAt))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async createRequest(
    data: typeof pgSchema.serviceRequests.$inferInsert,
  ): Promise<ServiceRequestRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.serviceRequests).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.serviceRequests)
        .where(
          and(
            eq(s.serviceRequests.tenantId, data.tenantId),
            eq(s.serviceRequests.id, id),
          ),
        )
        .limit(1);
      return mustOne(rows, 'ServiceRequest', id);
    });
  }

  async updateRequestStatus(
    tenantId: string,
    requestId: string,
    status: ServiceRequestStatus,
    assignedUserId?: string | null,
    resolvedAt?: Date | null,
  ): Promise<ServiceRequestRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const patch: Partial<ServiceRequestRecord> = { status };
      if (assignedUserId !== undefined) patch.assignedUserId = assignedUserId;
      if (resolvedAt !== undefined) patch.resolvedAt = resolvedAt;
      await tx
        .update(s.serviceRequests)
        .set(patch)
        .where(
          and(
            eq(s.serviceRequests.tenantId, tenantId),
            eq(s.serviceRequests.id, requestId),
          ),
        );
      const rows = await tx
        .select()
        .from(s.serviceRequests)
        .where(
          and(
            eq(s.serviceRequests.tenantId, tenantId),
            eq(s.serviceRequests.id, requestId),
          ),
        )
        .limit(1);
      return mustOne(rows, 'ServiceRequest', requestId);
    });
  }
}

class DrizzleBillingRepository implements BillingRepository {
  async findPaymentByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<PaymentRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.payments)
        .where(
          and(
            eq(s.payments.tenantId, tenantId),
            eq(s.payments.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async findPaymentByGatewayTxnId(
    gatewayTxnId: string,
  ): Promise<PaymentRecord | null> {
    return withGlobalDb(async (db, s) => {
      const rows = await db
        .select()
        .from(s.payments)
        .where(eq(s.payments.gatewayTxnId, gatewayTxnId))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async listPaymentsBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<PaymentRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.payments)
        .where(
          and(
            eq(s.payments.tenantId, tenantId),
            eq(s.payments.sessionId, sessionId),
          ),
        );
    });
  }

  async createPayment(
    data: typeof pgSchema.payments.$inferInsert,
  ): Promise<PaymentRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.payments).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.payments)
        .where(
          and(eq(s.payments.tenantId, data.tenantId), eq(s.payments.id, id)),
        )
        .limit(1);
      return mustOne(rows, 'Payment', id);
    });
  }

  async updatePaymentStatus(
    tenantId: string,
    paymentId: string,
    status: PaymentStatus,
    updates?: Partial<
      Pick<PaymentRecord, 'gatewayTxnId' | 'rawWebhook' | 'paidAt' | 'invoiceId'>
    >,
  ): Promise<PaymentRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      await tx
        .update(s.payments)
        .set({ status, ...(updates ?? {}) })
        .where(
          and(eq(s.payments.tenantId, tenantId), eq(s.payments.id, paymentId)),
        );
      const rows = await tx
        .select()
        .from(s.payments)
        .where(
          and(eq(s.payments.tenantId, tenantId), eq(s.payments.id, paymentId)),
        )
        .limit(1);
      return mustOne(rows, 'Payment', paymentId);
    });
  }

  async createInvoice(
    data: typeof pgSchema.invoices.$inferInsert,
  ): Promise<InvoiceRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.invoices).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.invoices)
        .where(
          and(eq(s.invoices.tenantId, data.tenantId), eq(s.invoices.id, id)),
        )
        .limit(1);
      return mustOne(rows, 'Invoice', id);
    });
  }

  async findInvoiceById(
    tenantId: string,
    invoiceId: string,
  ): Promise<InvoiceRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.invoices)
        .where(
          and(eq(s.invoices.tenantId, tenantId), eq(s.invoices.id, invoiceId)),
        )
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async nextInvoiceNumber(tenantId: string, outletId: string): Promise<string> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select({ count: sql<number>`count(*)` })
        .from(s.invoices)
        .where(
          and(
            eq(s.invoices.tenantId, tenantId),
            eq(s.invoices.outletId, outletId),
          ),
        );
      const seq = Number(rows[0]?.count ?? 0) + 1;
      const prefix = outletId.slice(0, 4).toUpperCase();
      const rand = Math.floor(1000 + Math.random() * 9000);
      return `INV-${prefix}-${String(seq).padStart(5, '0')}-${rand}`;
    });
  }
}

class DrizzleGuestEngagementRepository implements GuestEngagementRepository {
  async findOrCreateGuest(input: {
    tenantId: string;
    phone?: string;
    email?: string;
    displayName: string;
  }): Promise<GuestRecord> {
    return withSchemaTx(input.tenantId, async (tx, s) => {
      if (input.phone) {
        const byPhone = await tx
          .select()
          .from(s.guests)
          .where(
            and(
              eq(s.guests.tenantId, input.tenantId),
              eq(s.guests.phone, input.phone),
            ),
          )
          .limit(1);
        if (byPhone[0]) return byPhone[0];
      }

      if (input.email) {
        const byEmail = await tx
          .select()
          .from(s.guests)
          .where(
            and(
              eq(s.guests.tenantId, input.tenantId),
              eq(s.guests.email, input.email),
            ),
          )
          .limit(1);
        if (byEmail[0]) return byEmail[0];
      }

      const id = crypto.randomUUID();
      await tx.insert(s.guests).values({
        id,
        tenantId: input.tenantId,
        phone: input.phone ?? null,
        email: input.email ?? null,
        displayName: input.displayName,
      });
      const rows = await tx
        .select()
        .from(s.guests)
        .where(
          and(eq(s.guests.tenantId, input.tenantId), eq(s.guests.id, id)),
        )
        .limit(1);
      return mustOne(rows, 'Guest', id);
    });
  }

  async addLoyaltyPoints(
    tenantId: string,
    guestId: string,
    deltaPoints: number,
  ): Promise<GuestRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const existing = await tx
        .select()
        .from(s.guests)
        .where(and(eq(s.guests.tenantId, tenantId), eq(s.guests.id, guestId)))
        .limit(1);
      const guest = mustOne(existing, 'Guest', guestId);
      const nextPoints = Math.max(0, guest.loyaltyPoints + deltaPoints);
      const nextTier =
        nextPoints >= 5000
          ? 'PLATINUM'
          : nextPoints >= 2000
            ? 'GOLD'
            : nextPoints >= 500
              ? 'SILVER'
              : 'BRONZE';

      await tx
        .update(s.guests)
        .set({ loyaltyPoints: nextPoints, loyaltyTier: nextTier })
        .where(and(eq(s.guests.tenantId, tenantId), eq(s.guests.id, guestId)));
      const rows = await tx
        .select()
        .from(s.guests)
        .where(and(eq(s.guests.tenantId, tenantId), eq(s.guests.id, guestId)))
        .limit(1);
      return mustOne(rows, 'Guest', guestId);
    });
  }

  async createReview(
    data: typeof pgSchema.reviews.$inferInsert,
  ): Promise<ReviewRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.reviews).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.reviews)
        .where(
          and(eq(s.reviews.tenantId, data.tenantId), eq(s.reviews.id, id)),
        )
        .limit(1);
      return mustOne(rows, 'Review', id);
    });
  }

  async recordMiniGameScore(
    data: typeof pgSchema.miniGameSessions.$inferInsert,
  ): Promise<MiniGameSessionRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.miniGameSessions).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.miniGameSessions)
        .where(
          and(
            eq(s.miniGameSessions.tenantId, data.tenantId),
            eq(s.miniGameSessions.id, id),
          ),
        )
        .limit(1);
      return mustOne(rows, 'MiniGameSession', id);
    });
  }

  async listMiniGameLeaderboard(
    tenantId: string,
    outletId: string,
    sessionId?: string,
  ): Promise<MiniGameSessionRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const cond = sessionId
        ? and(
            eq(s.miniGameSessions.tenantId, tenantId),
            eq(s.miniGameSessions.outletId, outletId),
            eq(s.miniGameSessions.sessionId, sessionId),
          )
        : and(
            eq(s.miniGameSessions.tenantId, tenantId),
            eq(s.miniGameSessions.outletId, outletId),
          );
      return tx
        .select()
        .from(s.miniGameSessions)
        .where(cond)
        .orderBy(desc(s.miniGameSessions.score))
        .limit(50);
    });
  }
}

class DrizzleInventoryRepository implements InventoryRepository {
  async listInventoryItems(
    tenantId: string,
    outletId: string,
  ): Promise<InventoryItemRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.inventoryItems)
        .where(
          and(
            eq(s.inventoryItems.tenantId, tenantId),
            eq(s.inventoryItems.outletId, outletId),
          ),
        )
        .orderBy(asc(s.inventoryItems.name));
    });
  }

  async listRecipesForMenuItems(
    tenantId: string,
    menuItemIds: string[],
  ): Promise<MenuItemRecipeRecord[]> {
    if (menuItemIds.length === 0) return [];
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.menuItemRecipes)
        .where(
          and(
            eq(s.menuItemRecipes.tenantId, tenantId),
            inArray(s.menuItemRecipes.menuItemId, menuItemIds),
          ),
        );
    });
  }

  async deductStock(
    tenantId: string,
    outletId: string,
    deductions: Array<{ inventoryItemId: string; qtyToDeduct: number }>,
  ): Promise<{ depletedItemIds: string[] }> {
    if (deductions.length === 0) return { depletedItemIds: [] };
    return withSchemaTx(tenantId, async (tx, s) => {
      const depletedItemIds: string[] = [];
      for (const d of deductions) {
        if (d.qtyToDeduct <= 0) continue;

        // Atomic stock deduction to prevent TOCTOU race conditions under concurrency
        await tx
          .update(s.inventoryItems)
          .set({
            currentQty: sql`GREATEST(0, CAST(${s.inventoryItems.currentQty} AS DECIMAL(10,3)) - ${d.qtyToDeduct})`,
          })
          .where(
            and(
              eq(s.inventoryItems.tenantId, tenantId),
              eq(s.inventoryItems.outletId, outletId),
              eq(s.inventoryItems.id, d.inventoryItemId),
            ),
          );

        const rows = await tx
          .select({
            id: s.inventoryItems.id,
            currentQty: s.inventoryItems.currentQty,
          })
          .from(s.inventoryItems)
          .where(
            and(
              eq(s.inventoryItems.tenantId, tenantId),
              eq(s.inventoryItems.outletId, outletId),
              eq(s.inventoryItems.id, d.inventoryItemId),
            ),
          )
          .limit(1);

        const item = rows[0];
        if (item && Number(item.currentQty) <= 0) {
          depletedItemIds.push(item.id);
        }
      }
      return { depletedItemIds };
    });
  }

  async restockItem(
    tenantId: string,
    inventoryItemId: string,
    deltaQty: number,
  ): Promise<InventoryItemRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.inventoryItems)
        .where(
          and(
            eq(s.inventoryItems.tenantId, tenantId),
            eq(s.inventoryItems.id, inventoryItemId),
          ),
        )
        .limit(1);
      const item = mustOne(rows, 'InventoryItem', inventoryItemId);
      const nextQty = Math.max(0, Number(item.currentQty) + deltaQty);
      await tx
        .update(s.inventoryItems)
        .set({ currentQty: nextQty.toFixed(3) })
        .where(
          and(
            eq(s.inventoryItems.tenantId, tenantId),
            eq(s.inventoryItems.id, inventoryItemId),
          ),
        );
      const updated = await tx
        .select()
        .from(s.inventoryItems)
        .where(
          and(
            eq(s.inventoryItems.tenantId, tenantId),
            eq(s.inventoryItems.id, inventoryItemId),
          ),
        )
        .limit(1);
      return mustOne(updated, 'InventoryItem', inventoryItemId);
    });
  }
}

class DrizzleShiftRegisterRepository implements ShiftRegisterRepository {
  async findOpenShift(
    tenantId: string,
    outletId: string,
  ): Promise<ShiftRegisterRecord | null> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const rows = await tx
        .select()
        .from(s.shiftRegisters)
        .where(
          and(
            eq(s.shiftRegisters.tenantId, tenantId),
            eq(s.shiftRegisters.outletId, outletId),
            eq(s.shiftRegisters.status, 'OPEN'),
          ),
        )
        .orderBy(desc(s.shiftRegisters.openedAt))
        .limit(1);
      return rows[0] ?? null;
    });
  }

  async openShift(
    data: typeof pgSchema.shiftRegisters.$inferInsert,
  ): Promise<ShiftRegisterRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.shiftRegisters).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.shiftRegisters)
        .where(
          and(
            eq(s.shiftRegisters.tenantId, data.tenantId),
            eq(s.shiftRegisters.id, id),
          ),
        )
        .limit(1);
      return mustOne(rows, 'ShiftRegister', id);
    });
  }

  async closeShift(
    tenantId: string,
    shiftId: string,
    updates: {
      closedByUserId: string;
      status: ShiftStatus;
      cashSalesMinor: number;
      pettyCashMinor: number;
      expectedCashMinor: number;
      actualCashMinor: number;
      varianceMinor: number;
      notes?: string | null;
      closedAt: Date;
    },
  ): Promise<ShiftRegisterRecord> {
    return withSchemaTx(tenantId, async (tx, s) => {
      await tx
        .update(s.shiftRegisters)
        .set(updates)
        .where(
          and(
            eq(s.shiftRegisters.tenantId, tenantId),
            eq(s.shiftRegisters.id, shiftId),
          ),
        );
      const rows = await tx
        .select()
        .from(s.shiftRegisters)
        .where(
          and(
            eq(s.shiftRegisters.tenantId, tenantId),
            eq(s.shiftRegisters.id, shiftId),
          ),
        )
        .limit(1);
      return mustOne(rows, 'ShiftRegister', shiftId);
    });
  }

  async listShifts(
    tenantId: string,
    outletId: string,
  ): Promise<ShiftRegisterRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      return tx
        .select()
        .from(s.shiftRegisters)
        .where(
          and(
            eq(s.shiftRegisters.tenantId, tenantId),
            eq(s.shiftRegisters.outletId, outletId),
          ),
        )
        .orderBy(desc(s.shiftRegisters.openedAt));
    });
  }
}

class DrizzleAuditRepository implements AuditRepository {
  async appendLog(
    data: typeof pgSchema.auditLogs.$inferInsert,
  ): Promise<AuditLogRecord> {
    const id = data.id ?? crypto.randomUUID();
    return withSchemaTx(data.tenantId, async (tx, s) => {
      await tx.insert(s.auditLogs).values({ ...data, id });
      const rows = await tx
        .select()
        .from(s.auditLogs)
        .where(
          and(eq(s.auditLogs.tenantId, data.tenantId), eq(s.auditLogs.id, id)),
        )
        .limit(1);
      return mustOne(rows, 'AuditLog', id);
    });
  }

  async listLogs(
    tenantId: string,
    outletId?: string,
    limit = 100,
  ): Promise<AuditLogRecord[]> {
    return withSchemaTx(tenantId, async (tx, s) => {
      const cond = outletId
        ? and(
            eq(s.auditLogs.tenantId, tenantId),
            eq(s.auditLogs.outletId, outletId),
          )
        : eq(s.auditLogs.tenantId, tenantId);
      return tx
        .select()
        .from(s.auditLogs)
        .where(cond)
        .orderBy(desc(s.auditLogs.createdAt))
        .limit(limit);
    });
  }
}

export function createDrizzleRepositories(): RepositoryRegistry {
  return {
    tenantOutlet: new DrizzleTenantOutletRepository(),
    rbac: new DrizzleRbacRepository(),
    floor: new DrizzleFloorRepository(),
    menu: new DrizzleMenuRepository(),
    sessionOrder: new DrizzleSessionOrderRepository(),
    serviceRequest: new DrizzleServiceRequestRepository(),
    billing: new DrizzleBillingRepository(),
    engagement: new DrizzleGuestEngagementRepository(),
    inventory: new DrizzleInventoryRepository(),
    shift: new DrizzleShiftRegisterRepository(),
    audit: new DrizzleAuditRepository(),
  };
}
