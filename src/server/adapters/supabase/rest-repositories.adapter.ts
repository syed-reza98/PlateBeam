import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { InferInsertModel } from 'drizzle-orm';
import type {
  auditLogs,
  invoices,
  menuItems,
  miniGameSessions,
  orderItems,
  orders,
  payments,
  reviews,
  serviceRequests,
  shiftRegisters,
  tableSessions,
} from '../../db/schema/pg';
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
import type {
  DiningTableStatus,
  KdsStatus,
  OrderStatus,
  PaymentStatus,
  ServiceRequestStatus,
  SessionStatus,
  ShiftStatus,
} from '../../db/types';

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase URL and API Key are required for Supabase REST repositories');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const DATE_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'openedAt',
  'closedAt',
  'startedAt',
  'readyAt',
  'servedAt',
  'paidAt',
  'resolvedAt',
  'issuedAt',
  'qrRotatedAt',
  'lastActiveAt',
]);

// Helper to convert snake_case object keys to camelCase
function toCamel<T>(obj: Record<string, unknown>): T {
  if (!obj || typeof obj !== 'object') return obj as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const camelKey = k.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
    if (typeof v === 'string' && DATE_KEYS.has(camelKey) && !isNaN(Date.parse(v))) {
      out[camelKey] = new Date(v);
    } else {
      out[camelKey] = v;
    }
  }
  return out as T;
}

// Helper to convert camelCase object keys to snake_case
function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (v instanceof Date) {
      out[snakeKey] = v.toISOString();
    } else {
      out[snakeKey] = v;
    }
  }
  return out;
}

class SupabaseTenantOutletRepository implements TenantOutletRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findTenantById(tenantId: string): Promise<TenantRecord | null> {
    const { data } = await this.client
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle();
    return data ? toCamel<TenantRecord>(data) : null;
  }

  async findTenantBySlug(slug: string): Promise<TenantRecord | null> {
    const { data } = await this.client
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    return data ? toCamel<TenantRecord>(data) : null;
  }

  async listTenants(): Promise<TenantRecord[]> {
    const { data } = await this.client.from('tenants').select('*').order('name');
    return (data ?? []).map((r) => toCamel<TenantRecord>(r));
  }

  async createTenant(data: NewTenantRecord): Promise<TenantRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({ ...data, id });
    const { data: res, error } = await this.client
      .from('tenants')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to create tenant: ${error?.message}`);
    return toCamel<TenantRecord>(res);
  }

  async findOutletById(tenantId: string, outletId: string): Promise<OutletRecord | null> {
    const { data } = await this.client
      .from('outlets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', outletId)
      .maybeSingle();
    return data ? toCamel<OutletRecord>(data) : null;
  }

  async findOutletBySubdomain(subdomain: string): Promise<OutletRecord | null> {
    const { data } = await this.client
      .from('outlets')
      .select('*')
      .eq('subdomain', subdomain)
      .maybeSingle();
    return data ? toCamel<OutletRecord>(data) : null;
  }

  async listOutlets(tenantId: string): Promise<OutletRecord[]> {
    const { data } = await this.client
      .from('outlets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
    return (data ?? []).map((r) => toCamel<OutletRecord>(r));
  }

  async createOutlet(data: NewOutletRecord): Promise<OutletRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({ ...data, id });
    const { data: res, error } = await this.client
      .from('outlets')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to create outlet: ${error?.message}`);
    return toCamel<OutletRecord>(res);
  }

  async updateOutletPolicy(
    tenantId: string,
    outletId: string,
    policy: OutletRecord['qrSecurityPolicy'],
  ): Promise<OutletRecord> {
    const { data: res, error } = await this.client
      .from('outlets')
      .update({ qr_security_policy: policy })
      .eq('tenant_id', tenantId)
      .eq('id', outletId)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to update outlet policy: ${error?.message}`);
    return toCamel<OutletRecord>(res);
  }
}

class SupabaseRbacRepository implements RbacRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findUserById(tenantId: string, userId: string): Promise<UserRecord | null> {
    const { data } = await this.client
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', userId)
      .maybeSingle();
    return data ? toCamel<UserRecord>(data) : null;
  }

  async findUserByEmail(tenantId: string, email: string): Promise<UserRecord | null> {
    const { data } = await this.client
      .from('users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .maybeSingle();
    return data ? toCamel<UserRecord>(data) : null;
  }

  async listUsersByOutlet(tenantId: string, outletId?: string): Promise<UserRecord[]> {
    let q = this.client.from('users').select('*').eq('tenant_id', tenantId);
    if (outletId) q = q.eq('outlet_id', outletId);
    const { data } = await q.order('full_name');
    return (data ?? []).map((r) => toCamel<UserRecord>(r));
  }

  async createUser(data: NewUserRecord): Promise<UserRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({ ...data, id });
    const { data: res, error } = await this.client
      .from('users')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to create user: ${error?.message}`);
    return toCamel<UserRecord>(res);
  }

  async findRoleById(tenantId: string, roleId: string): Promise<RoleRecord | null> {
    const { data } = await this.client
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .maybeSingle();
    return data ? toCamel<RoleRecord>(data) : null;
  }

  async listRoles(tenantId: string): Promise<RoleRecord[]> {
    const { data } = await this.client
      .from('roles')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    return (data ?? []).map((r) => toCamel<RoleRecord>(r));
  }

  async listUserOverrides(
    tenantId: string,
    userId: string,
  ): Promise<UserPermissionOverrideRecord[]> {
    const { data } = await this.client
      .from('user_permission_overrides')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);
    return (data ?? []).map((r) => toCamel<UserPermissionOverrideRecord>(r));
  }

  async upsertPermissionOverride(input: {
    tenantId: string;
    userId: string;
    permissionKey: string;
    effect: 'GRANT' | 'DENY';
  }): Promise<UserPermissionOverrideRecord> {
    const payload = {
      tenant_id: input.tenantId,
      user_id: input.userId,
      permission_key: input.permissionKey,
      effect: input.effect,
    };
    const { data: res, error } = await this.client
      .from('user_permission_overrides')
      .upsert(payload, { onConflict: 'tenant_id,user_id,permission_key' })
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to upsert override: ${error?.message}`);
    return toCamel<UserPermissionOverrideRecord>(res);
  }
}

class SupabaseFloorRepository implements FloorRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listZones(tenantId: string, outletId: string): Promise<FloorZoneRecord[]> {
    const { data } = await this.client
      .from('floor_zones')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .order('display_order');
    return (data ?? []).map((r) => toCamel<FloorZoneRecord>(r));
  }

  async listTables(tenantId: string, outletId: string): Promise<DiningTableRecord[]> {
    const { data } = await this.client
      .from('dining_tables')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .order('table_number');
    return (data ?? []).map((r) => toCamel<DiningTableRecord>(r));
  }

  async findTableById(tenantId: string, tableId: string): Promise<DiningTableRecord | null> {
    const { data } = await this.client
      .from('dining_tables')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', tableId)
      .maybeSingle();
    return data ? toCamel<DiningTableRecord>(data) : null;
  }

  async findTableByQrToken(qrToken: string): Promise<DiningTableRecord | null> {
    let q = this.client.from('dining_tables').select('*');
    if (qrToken === 'demo') {
      q = q.eq('table_number', 'T1').limit(1);
    } else {
      q = q.eq('qr_token', qrToken).limit(1);
    }
    const { data } = await q.maybeSingle();
    return data ? toCamel<DiningTableRecord>(data) : null;
  }

  async updateTableStatus(
    tenantId: string,
    tableId: string,
    status: DiningTableStatus,
    activeSessionId?: string | null,
  ): Promise<DiningTableRecord> {
    const patch: Record<string, unknown> = { status };
    if (activeSessionId !== undefined) {
      patch.active_session_id = activeSessionId;
    }
    const { data, error } = await this.client
      .from('dining_tables')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', tableId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update table status: ${error?.message}`);
    return toCamel<DiningTableRecord>(data);
  }

  async rotateTableQrToken(
    tenantId: string,
    tableId: string,
    newToken: string,
  ): Promise<DiningTableRecord> {
    const { data, error } = await this.client
      .from('dining_tables')
      .update({ qr_token: newToken, qr_rotated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', tableId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update qrToken: ${error?.message}`);
    return toCamel<DiningTableRecord>(data);
  }

  async updateTablePosition(
    tenantId: string,
    tableId: string,
    posX: number,
    posY: number,
  ): Promise<DiningTableRecord> {
    const { data, error } = await this.client
      .from('dining_tables')
      .update({ pos_x: posX, pos_y: posY })
      .eq('tenant_id', tenantId)
      .eq('id', tableId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update position: ${error?.message}`);
    return toCamel<DiningTableRecord>(data);
  }
}

class SupabaseMenuRepository implements MenuRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listStations(tenantId: string, outletId: string): Promise<KitchenStationRecord[]> {
    const { data } = await this.client
      .from('kitchen_stations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .order('name');
    return (data ?? []).map((r) => toCamel<KitchenStationRecord>(r));
  }

  async listCategories(tenantId: string, outletId: string): Promise<MenuCategoryRecord[]> {
    const { data } = await this.client
      .from('menu_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .order('sort_order');
    return (data ?? []).map((r) => toCamel<MenuCategoryRecord>(r));
  }

  async listTaxSlabs(tenantId: string, outletId: string): Promise<TaxSlabRecord[]> {
    const { data } = await this.client
      .from('tax_slabs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .order('name');
    return (data ?? []).map((r) => toCamel<TaxSlabRecord>(r));
  }

  async listMenuItems(
    tenantId: string,
    outletId: string,
    onlyAvailable?: boolean,
  ): Promise<MenuItemRecord[]> {
    let q = this.client
      .from('menu_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId);
    if (onlyAvailable) {
      q = q.eq('is_available', true);
    }
    const { data } = await q.order('name');
    return (data ?? []).map((r) => toCamel<MenuItemRecord>(r));
  }

  async findMenuItemById(tenantId: string, itemId: string): Promise<MenuItemRecord | null> {
    const { data } = await this.client
      .from('menu_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', itemId)
      .maybeSingle();
    return data ? toCamel<MenuItemRecord>(data) : null;
  }

  async listModifiersByOutlet(tenantId: string, outletId: string): Promise<ItemModifierRecord[]> {
    const items = await this.listMenuItems(tenantId, outletId);
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) return [];
    const { data } = await this.client
      .from('item_variants_modifiers')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('menu_item_id', itemIds);
    return (data ?? []).map((r) => toCamel<ItemModifierRecord>(r));
  }

  async listUpsellRules(tenantId: string, outletId: string): Promise<UpsellRuleRecord[]> {
    const { data } = await this.client
      .from('upsell_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .order('priority', { ascending: false });
    return (data ?? []).map((r) => toCamel<UpsellRuleRecord>(r));
  }

  async setItemAvailability(
    tenantId: string,
    itemId: string,
    isAvailable: boolean,
  ): Promise<MenuItemRecord> {
    const { data, error } = await this.client
      .from('menu_items')
      .update({ is_available: isAvailable })
      .eq('tenant_id', tenantId)
      .eq('id', itemId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update item: ${error?.message}`);
    return toCamel<MenuItemRecord>(data);
  }

  async upsertMenuItem(
    itemData: InferInsertModel<typeof menuItems>,
  ): Promise<MenuItemRecord> {
    const id = itemData.id ?? crypto.randomUUID();
    const payload = toSnake({ ...itemData, id });
    const { data, error } = await this.client
      .from('menu_items')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to upsert menu item: ${error?.message}`);
    return toCamel<MenuItemRecord>(data);
  }
}

class SupabaseSessionOrderRepository implements SessionOrderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findSessionById(tenantId: string, sessionId: string): Promise<TableSessionRecord | null> {
    const { data } = await this.client
      .from('table_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', sessionId)
      .maybeSingle();
    return data ? toCamel<TableSessionRecord>(data) : null;
  }

  async findOpenSessionByTable(tenantId: string, tableId: string): Promise<TableSessionRecord | null> {
    const { data } = await this.client
      .from('table_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('table_id', tableId)
      .in('status', ['OPEN', 'BILL_REQUESTED', 'PARTIALLY_PAID'])
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? toCamel<TableSessionRecord>(data) : null;
  }

  async createSession(
    data: InferInsertModel<typeof tableSessions>,
  ): Promise<TableSessionRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({
      id,
      guestCount: 1,
      status: 'OPEN',
      subtotalMinor: 0,
      taxMinor: 0,
      discountMinor: 0,
      serviceChargeMinor: 0,
      tipMinor: 0,
      totalMinor: 0,
      ...data,
    });
    const { data: res, error } = await this.client
      .from('table_sessions')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to create session: ${error?.message}`);
    return toCamel<TableSessionRecord>(res);
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
    const { data, error } = await this.client
      .from('table_sessions')
      .update(toSnake(totals))
      .eq('tenant_id', tenantId)
      .eq('id', sessionId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update totals: ${error?.message}`);
    return toCamel<TableSessionRecord>(data);
  }

  async updateSessionStatus(
    tenantId: string,
    sessionId: string,
    status: SessionStatus,
    closedAt?: Date | null,
  ): Promise<TableSessionRecord> {
    const patch: Record<string, unknown> = { status };
    if (closedAt !== undefined) {
      patch.closed_at = closedAt ? closedAt.toISOString() : null;
    }
    const { data, error } = await this.client
      .from('table_sessions')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', sessionId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update status: ${error?.message}`);
    return toCamel<TableSessionRecord>(data);
  }

  async listOrdersBySession(tenantId: string, sessionId: string): Promise<OrderRecord[]> {
    const { data } = await this.client
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId)
      .order('round_number')
      .order('created_at');
    return (data ?? []).map((r) => toCamel<OrderRecord>(r));
  }

  async createOrderWithItems(input: {
    order: InferInsertModel<typeof orders>;
    items: InferInsertModel<typeof orderItems>[];
  }): Promise<{ order: OrderRecord; items: OrderItemRecord[] }> {
    const orderId = input.order.id ?? crypto.randomUUID();
    const tenantId = input.order.tenantId;
    const orderPayload = toSnake({
      id: orderId,
      roundNumber: 1,
      status: 'PENDING',
      ...input.order,
    });

    const { data: orderData, error: orderErr } = await this.client
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();
    if (orderErr || !orderData) {
      throw new Error(`Failed to create order: ${orderErr?.message}`);
    }

    let itemsData: OrderItemRecord[] = [];
    if (input.items.length > 0) {
      const itemsPayload = input.items.map((i) =>
        toSnake({
          kdsStatus: 'PENDING',
          ...i,
          id: i.id ?? crypto.randomUUID(),
          orderId,
          tenantId,
        }),
      );
      const { data: insertedItems, error: itemsErr } = await this.client
        .from('order_items')
        .insert(itemsPayload)
        .select();
      if (itemsErr || !insertedItems) {
        throw new Error(`Failed to insert order items: ${itemsErr?.message}`);
      }
      itemsData = insertedItems.map((r) => toCamel<OrderItemRecord>(r));
    }

    return {
      order: toCamel<OrderRecord>(orderData),
      items: itemsData,
    };
  }

  async updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    approvedByUserId?: string | null,
  ): Promise<OrderRecord> {
    const patch: Record<string, unknown> = { status };
    if (approvedByUserId !== undefined) patch.approved_by_user_id = approvedByUserId;
    const { data, error } = await this.client
      .from('orders')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update order status: ${error?.message}`);
    return toCamel<OrderRecord>(data);
  }

  async listOrderItemsBySession(tenantId: string, sessionId: string): Promise<OrderItemRecord[]> {
    const orders = await this.listOrdersBySession(tenantId, sessionId);
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) return [];
    const { data } = await this.client
      .from('order_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('order_id', orderIds);
    return (data ?? []).map((r) => toCamel<OrderItemRecord>(r));
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
    let q = this.client
      .from('order_items')
      .select('*, orders!inner(id, order_number, created_at, outlet_id, session_id, table_sessions!inner(table_id, token_number))')
      .eq('tenant_id', tenantId)
      .eq('orders.outlet_id', outletId)
      .in('kds_status', ['PENDING', 'ACCEPTED', 'PREPARING', 'READY']);

    if (stationId) q = q.eq('station_id', stationId);
    const { data } = await q.order('created_at', { referencedTable: 'orders' });

    return (data ?? []).map((row: Record<string, unknown>) => {
      const order = (row.orders as Record<string, unknown> | undefined) ?? {};
      const session = (order.table_sessions as Record<string, unknown> | undefined) ?? {};
      const itemRecord = toCamel<OrderItemRecord>(row);
      return {
        ...itemRecord,
        orderNumber: typeof order.order_number === 'string' ? order.order_number : '',
        tableId: typeof session.table_id === 'string' ? session.table_id : null,
        tokenNumber: typeof session.token_number === 'number' ? session.token_number : null,
        createdAt: typeof order.created_at === 'string' ? new Date(order.created_at) : new Date(),
      };
    });
  }

  async updateOrderItemKdsStatus(
    tenantId: string,
    itemId: string,
    status: KdsStatus,
    timestamps?: Partial<Pick<OrderItemRecord, 'startedAt' | 'readyAt' | 'servedAt'>>,
  ): Promise<OrderItemRecord> {
    const patch: Record<string, unknown> = { kds_status: status };
    if (timestamps) {
      if (timestamps.startedAt !== undefined) {
        patch.started_at = timestamps.startedAt ? timestamps.startedAt.toISOString() : null;
      }
      if (timestamps.readyAt !== undefined) {
        patch.ready_at = timestamps.readyAt ? timestamps.readyAt.toISOString() : null;
      }
      if (timestamps.servedAt !== undefined) {
        patch.served_at = timestamps.servedAt ? timestamps.servedAt.toISOString() : null;
      }
    }
    const { data, error } = await this.client
      .from('order_items')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', itemId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update item kds status: ${error?.message}`);
    return toCamel<OrderItemRecord>(data);
  }
}

class SupabaseServiceRequestRepository implements ServiceRequestRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listOpenRequests(
    tenantId: string,
    outletId: string,
  ): Promise<ServiceRequestRecord[]> {
    const { data } = await this.client
      .from('service_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .in('status', ['OPEN', 'CLAIMED'])
      .order('created_at');
    return (data ?? []).map((r) => toCamel<ServiceRequestRecord>(r));
  }

  async findRecentRequestForTable(
    tenantId: string,
    tableId: string,
    requestType: ServiceRequestRecord['requestType'],
    since: Date,
  ): Promise<ServiceRequestRecord | null> {
    const { data } = await this.client
      .from('service_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('table_id', tableId)
      .eq('request_type', requestType)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? toCamel<ServiceRequestRecord>(data) : null;
  }

  async createRequest(
    data: InferInsertModel<typeof serviceRequests>,
  ): Promise<ServiceRequestRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({
      id,
      status: 'OPEN',
      ...data,
    });
    const { data: res, error } = await this.client
      .from('service_requests')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to create service request: ${error?.message}`);
    return toCamel<ServiceRequestRecord>(res);
  }

  async updateRequestStatus(
    tenantId: string,
    requestId: string,
    status: ServiceRequestStatus,
    assignedUserId?: string | null,
    resolvedAt?: Date | null,
  ): Promise<ServiceRequestRecord> {
    const patch: Record<string, unknown> = { status };
    if (assignedUserId !== undefined) patch.assigned_user_id = assignedUserId;
    if (resolvedAt !== undefined) {
      patch.resolved_at = resolvedAt ? resolvedAt.toISOString() : null;
    }
    const { data, error } = await this.client
      .from('service_requests')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', requestId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update service request: ${error?.message}`);
    return toCamel<ServiceRequestRecord>(data);
  }
}

class SupabaseBillingRepository implements BillingRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findPaymentByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<PaymentRecord | null> {
    const { data } = await this.client
      .from('payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    return data ? toCamel<PaymentRecord>(data) : null;
  }

  async findPaymentByGatewayTxnId(
    gatewayTxnId: string,
  ): Promise<PaymentRecord | null> {
    const { data } = await this.client
      .from('payments')
      .select('*')
      .eq('gateway_txn_id', gatewayTxnId)
      .maybeSingle();
    return data ? toCamel<PaymentRecord>(data) : null;
  }

  async listPaymentsBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<PaymentRecord[]> {
    const { data } = await this.client
      .from('payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId);
    return (data ?? []).map((r) => toCamel<PaymentRecord>(r));
  }

  async createPayment(
    data: InferInsertModel<typeof payments>,
  ): Promise<PaymentRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({
      id,
      tipMinor: 0,
      status: 'PENDING',
      ...data,
    });
    const { data: res, error } = await this.client
      .from('payments')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to create payment: ${error?.message}`);
    return toCamel<PaymentRecord>(res);
  }

  async updatePaymentStatus(
    tenantId: string,
    paymentId: string,
    status: PaymentStatus,
    updates?: Partial<
      Pick<PaymentRecord, 'gatewayTxnId' | 'rawWebhook' | 'paidAt' | 'invoiceId'>
    >,
  ): Promise<PaymentRecord> {
    const patch: Record<string, unknown> = { status };
    if (updates?.gatewayTxnId !== undefined) patch.gateway_txn_id = updates.gatewayTxnId;
    if (updates?.rawWebhook !== undefined) patch.raw_webhook = updates.rawWebhook;
    if (updates?.invoiceId !== undefined) patch.invoice_id = updates.invoiceId;
    if (updates?.paidAt !== undefined) {
      patch.paid_at = updates.paidAt ? updates.paidAt.toISOString() : null;
    }
    const { data, error } = await this.client
      .from('payments')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', paymentId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update payment status: ${error?.message}`);
    return toCamel<PaymentRecord>(data);
  }

  async createInvoice(
    data: InferInsertModel<typeof invoices>,
  ): Promise<InvoiceRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({ ...data, id });
    const { data: res, error } = await this.client
      .from('invoices')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to create invoice: ${error?.message}`);
    return toCamel<InvoiceRecord>(res);
  }

  async findInvoiceById(
    tenantId: string,
    invoiceId: string,
  ): Promise<InvoiceRecord | null> {
    const { data } = await this.client
      .from('invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .maybeSingle();
    return data ? toCamel<InvoiceRecord>(data) : null;
  }

  async nextInvoiceNumber(tenantId: string, outletId: string): Promise<string> {
    const { count } = await this.client
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId);
    const seq = (count ?? 0) + 1;
    const prefix = outletId.slice(0, 4).toUpperCase();
    return `INV-${prefix}-${String(seq).padStart(6, '0')}`;
  }
}

class SupabaseGuestEngagementRepository implements GuestEngagementRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findOrCreateGuest(input: {
    tenantId: string;
    phone?: string;
    email?: string;
    displayName: string;
  }): Promise<GuestRecord> {
    if (input.phone) {
      const { data } = await this.client
        .from('guests')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('phone', input.phone)
        .maybeSingle();
      if (data) return toCamel<GuestRecord>(data);
    }
    if (input.email) {
      const { data } = await this.client
        .from('guests')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('email', input.email)
        .maybeSingle();
      if (data) return toCamel<GuestRecord>(data);
    }
    const id = crypto.randomUUID();
    const payload = {
      id,
      tenant_id: input.tenantId,
      phone: input.phone ?? null,
      email: input.email ?? null,
      display_name: input.displayName,
      loyalty_points: 0,
      loyalty_tier: 'BRONZE',
      is_blocked: false,
    };
    const { data: created, error } = await this.client
      .from('guests')
      .insert(payload)
      .select()
      .single();
    if (error || !created) throw new Error(`Failed to create guest: ${error?.message}`);
    return toCamel<GuestRecord>(created);
  }

  async addLoyaltyPoints(
    tenantId: string,
    guestId: string,
    deltaPoints: number,
  ): Promise<GuestRecord> {
    const { data: guest } = await this.client
      .from('guests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', guestId)
      .single();
    if (!guest) throw new Error(`Guest not found: ${guestId}`);
    const nextPoints = Math.max(0, (guest.loyalty_points ?? 0) + deltaPoints);
    const nextTier =
      nextPoints >= 5000
        ? 'PLATINUM'
        : nextPoints >= 2000
          ? 'GOLD'
          : nextPoints >= 500
            ? 'SILVER'
            : 'BRONZE';

    const { data, error } = await this.client
      .from('guests')
      .update({ loyalty_points: nextPoints, loyalty_tier: nextTier })
      .eq('tenant_id', tenantId)
      .eq('id', guestId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update loyalty points: ${error?.message}`);
    return toCamel<GuestRecord>(data);
  }

  async createReview(
    data: InferInsertModel<typeof reviews>,
  ): Promise<ReviewRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({
      id,
      tags: [],
      managerNotified: false,
      ...data,
    });
    const { data: res, error } = await this.client
      .from('reviews')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to create review: ${error?.message}`);
    return toCamel<ReviewRecord>(res);
  }

  async recordMiniGameScore(
    data: InferInsertModel<typeof miniGameSessions>,
  ): Promise<MiniGameSessionRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({ ...data, id });
    const { data: res, error } = await this.client
      .from('mini_game_sessions')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to record mini game score: ${error?.message}`);
    return toCamel<MiniGameSessionRecord>(res);
  }

  async listMiniGameLeaderboard(
    tenantId: string,
    outletId: string,
    sessionId?: string,
  ): Promise<MiniGameSessionRecord[]> {
    let q = this.client
      .from('mini_game_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId);
    if (sessionId) q = q.eq('session_id', sessionId);
    const { data } = await q.order('score', { ascending: false }).limit(50);
    return (data ?? []).map((r) => toCamel<MiniGameSessionRecord>(r));
  }
}

class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listInventoryItems(
    tenantId: string,
    outletId: string,
  ): Promise<InventoryItemRecord[]> {
    const { data } = await this.client
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .order('name');
    return (data ?? []).map((r) => toCamel<InventoryItemRecord>(r));
  }

  async listRecipesForMenuItems(
    tenantId: string,
    menuItemIds: string[],
  ): Promise<MenuItemRecipeRecord[]> {
    if (menuItemIds.length === 0) return [];
    const { data } = await this.client
      .from('menu_item_recipes')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('menu_item_id', menuItemIds);
    return (data ?? []).map((r) => toCamel<MenuItemRecipeRecord>(r));
  }

  async deductStock(
    tenantId: string,
    outletId: string,
    deductions: Array<{ inventoryItemId: string; qtyToDeduct: number }>,
  ): Promise<{ depletedItemIds: string[] }> {
    if (deductions.length === 0) return { depletedItemIds: [] };
    const depletedItemIds: string[] = [];
    for (const d of deductions) {
      const { data: item } = await this.client
        .from('inventory_items')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('outlet_id', outletId)
        .eq('id', d.inventoryItemId)
        .maybeSingle();
      if (!item) continue;

      const nextQty = Number(item.current_qty) - d.qtyToDeduct;
      const clamped = Math.max(0, nextQty);
      if (clamped <= 0) {
        depletedItemIds.push(item.id);
      }
      await this.client
        .from('inventory_items')
        .update({ current_qty: clamped.toFixed(3) })
        .eq('tenant_id', tenantId)
        .eq('id', item.id);
    }
    return { depletedItemIds };
  }

  async restockItem(
    tenantId: string,
    inventoryItemId: string,
    deltaQty: number,
  ): Promise<InventoryItemRecord> {
    const { data: item } = await this.client
      .from('inventory_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', inventoryItemId)
      .single();
    if (!item) throw new Error(`Inventory item not found: ${inventoryItemId}`);

    const nextQty = Math.max(0, Number(item.current_qty) + deltaQty);
    const { data, error } = await this.client
      .from('inventory_items')
      .update({ current_qty: nextQty.toFixed(3) })
      .eq('tenant_id', tenantId)
      .eq('id', inventoryItemId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to restock item: ${error?.message}`);
    return toCamel<InventoryItemRecord>(data);
  }
}

class SupabaseShiftRegisterRepository implements ShiftRegisterRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findOpenShift(
    tenantId: string,
    outletId: string,
  ): Promise<ShiftRegisterRecord | null> {
    const { data } = await this.client
      .from('shift_registers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .eq('status', 'OPEN')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? toCamel<ShiftRegisterRecord>(data) : null;
  }

  async openShift(
    data: InferInsertModel<typeof shiftRegisters>,
  ): Promise<ShiftRegisterRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({
      id,
      status: 'OPEN',
      cashSalesMinor: 0,
      cardSalesMinor: 0,
      upiSalesMinor: 0,
      pettyCashMinor: 0,
      expectedCashMinor: data.openingFloatMinor ?? 0,
      ...data,
    });
    const { data: res, error } = await this.client
      .from('shift_registers')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to open shift: ${error?.message}`);
    return toCamel<ShiftRegisterRecord>(res);
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
    const patch = toSnake(updates);
    const { data, error } = await this.client
      .from('shift_registers')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', shiftId)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to close shift: ${error?.message}`);
    return toCamel<ShiftRegisterRecord>(data);
  }

  async listShifts(
    tenantId: string,
    outletId: string,
  ): Promise<ShiftRegisterRecord[]> {
    const { data } = await this.client
      .from('shift_registers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('outlet_id', outletId)
      .order('opened_at', { ascending: false });
    return (data ?? []).map((r) => toCamel<ShiftRegisterRecord>(r));
  }
}

class SupabaseAuditRepository implements AuditRepository {
  constructor(private readonly client: SupabaseClient) {}

  async appendLog(
    data: InferInsertModel<typeof auditLogs>,
  ): Promise<AuditLogRecord> {
    const id = data.id ?? crypto.randomUUID();
    const payload = toSnake({ ...data, id });
    const { data: res, error } = await this.client
      .from('audit_logs')
      .insert(payload)
      .select()
      .single();
    if (error || !res) throw new Error(`Failed to append audit log: ${error?.message}`);
    return toCamel<AuditLogRecord>(res);
  }

  async listLogs(
    tenantId: string,
    outletId?: string,
    limit = 100,
  ): Promise<AuditLogRecord[]> {
    let q = this.client
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId);
    if (outletId) q = q.eq('outlet_id', outletId);
    const { data } = await q.order('created_at', { ascending: false }).limit(limit);
    return (data ?? []).map((r) => toCamel<AuditLogRecord>(r));
  }
}

export function createSupabaseRestRepositories(): RepositoryRegistry {
  const client = getSupabaseClient();
  return {
    tenantOutlet: new SupabaseTenantOutletRepository(client),
    rbac: new SupabaseRbacRepository(client),
    floor: new SupabaseFloorRepository(client),
    menu: new SupabaseMenuRepository(client),
    sessionOrder: new SupabaseSessionOrderRepository(client),
    serviceRequest: new SupabaseServiceRequestRepository(client),
    billing: new SupabaseBillingRepository(client),
    engagement: new SupabaseGuestEngagementRepository(client),
    inventory: new SupabaseInventoryRepository(client),
    shift: new SupabaseShiftRegisterRepository(client),
    audit: new SupabaseAuditRepository(client),
  };
}
