import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type {
  DietaryType,
  DiningTableStatus,
  KdsStatus,
  LoyaltyTier,
  ModifierSnapshot,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PermissionEffect,
  PrinterConfig,
  QrSecurityPolicy,
  ScheduleRules,
  ServiceRequestStatus,
  ServiceRequestType,
  SessionStatus,
  SessionType,
  ShiftStatus,
  SubscriptionPlan,
  TaxBreakdownItem,
  TaxComponent,
  TenantStatus,
} from '../../types';

// 1. tenants
export const tenants = pgTable('tenants', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  subscriptionPlan: varchar('subscription_plan', { length: 32 })
    .$type<SubscriptionPlan>()
    .notNull()
    .default('STARTER'),
  status: varchar('status', { length: 32 })
    .$type<TenantStatus>()
    .notNull()
    .default('ACTIVE'),
  currencyCode: varchar('currency_code', { length: 8 }).notNull().default('BDT'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
});

// 2. outlets
export const outlets = pgTable(
  'outlets',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 200 }).notNull(),
    subdomain: varchar('subdomain', { length: 100 }).notNull().unique(),
    address: text('address'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Dhaka'),
    taxRegNo: varchar('tax_reg_no', { length: 64 }),
    wifiSsid: varchar('wifi_ssid', { length: 128 }),
    wifiPasswordEnc: text('wifi_password_enc'),
    qrSecurityPolicy: jsonb('qr_security_policy')
      .$type<QrSecurityPolicy>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    geoLat: doublePrecision('geo_lat'),
    geoLng: doublePrecision('geo_lng'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('idx_outlets_tenant').on(t.tenantId)],
);

// 3. roles
export const roles = pgTable(
  'roles',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'restrict',
    }),
    name: varchar('name', { length: 80 }).notNull(),
    defaultPermissions: jsonb('default_permissions')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('idx_roles_tenant_name').on(t.tenantId, t.name)],
);

// 4. users
export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id').references(() => outlets.id, {
      onDelete: 'set null',
    }),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    passwordHash: text('password_hash'),
    posPinHash: text('pos_pin_hash'),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_users_tenant_email').on(t.tenantId, t.email),
    index('idx_users_tenant_outlet').on(t.tenantId, t.outletId),
  ],
);

// 5. user_permission_overrides
export const userPermissionOverrides = pgTable(
  'user_permission_overrides',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionKey: varchar('permission_key', { length: 120 }).notNull(),
    effect: varchar('effect', { length: 10 })
      .$type<PermissionEffect>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_user_perm_override').on(
      t.tenantId,
      t.userId,
      t.permissionKey,
    ),
  ],
);

// 6. floor_zones
export const floorZones = pgTable(
  'floor_zones',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (t) => [index('idx_floor_zones_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 7. dining_tables
export const diningTables = pgTable(
  'dining_tables',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => floorZones.id, { onDelete: 'restrict' }),
    tableNumber: varchar('table_number', { length: 32 }).notNull(),
    capacity: integer('capacity').notNull().default(4),
    qrToken: varchar('qr_token', { length: 255 }).notNull().unique(),
    qrRotatedAt: timestamp('qr_rotated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    posX: doublePrecision('pos_x').notNull().default(0),
    posY: doublePrecision('pos_y').notNull().default(0),
    status: varchar('status', { length: 32 })
      .$type<DiningTableStatus>()
      .notNull()
      .default('VACANT'),
    activeSessionId: uuid('active_session_id').references(
      (): AnyPgColumn => tableSessions.id,
      { onDelete: 'set null' },
    ),
  },
  (t) => [
    uniqueIndex('uq_dining_tables_tenant_outlet_num').on(
      t.tenantId,
      t.outletId,
      t.tableNumber,
    ),
    index('idx_dining_tables_tenant_outlet_status').on(
      t.tenantId,
      t.outletId,
      t.status,
    ),
  ],
);

// 8. kitchen_stations
export const kitchenStations = pgTable(
  'kitchen_stations',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    printerConfig: jsonb('printer_config')
      .$type<PrinterConfig>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    slaTargetMins: integer('sla_target_mins').notNull().default(15),
  },
  (t) => [index('idx_kitchen_stations_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 9. menu_categories
export const menuCategories = pgTable(
  'menu_categories',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    scheduleRules: jsonb('schedule_rules')
      .$type<ScheduleRules>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [index('idx_menu_categories_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 10. tax_slabs
export const taxSlabs = pgTable(
  'tax_slabs',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    rateBps: integer('rate_bps').notNull().default(0),
    components: jsonb('components')
      .$type<TaxComponent[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    hsnCode: varchar('hsn_code', { length: 32 }),
    isInclusive: boolean('is_inclusive').notNull().default(false),
  },
  (t) => [index('idx_tax_slabs_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 11. menu_items
export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => menuCategories.id, { onDelete: 'restrict' }),
    stationId: uuid('station_id')
      .notNull()
      .references(() => kitchenStations.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    basePriceMinor: bigint('base_price_minor', { mode: 'number' }).notNull(),
    taxSlabId: uuid('tax_slab_id')
      .notNull()
      .references(() => taxSlabs.id, { onDelete: 'restrict' }),
    dietaryType: varchar('dietary_type', { length: 32 })
      .$type<DietaryType>()
      .notNull()
      .default('VEG'),
    allergens: text('allergens')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    spiceLevels: text('spice_levels')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    prepTimeMins: integer('prep_time_mins').notNull().default(12),
    imageUrl: text('image_url'),
    isAvailable: boolean('is_available').notNull().default(true),
  },
  (t) => [
    index('idx_menu_items_tenant_outlet_cat').on(
      t.tenantId,
      t.outletId,
      t.categoryId,
    ),
    index('idx_menu_items_tenant_outlet_avail').on(
      t.tenantId,
      t.outletId,
      t.isAvailable,
    ),
  ],
);

// 12. item_variants_modifiers
export const itemVariantsModifiers = pgTable(
  'item_variants_modifiers',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    groupName: varchar('group_name', { length: 120 }).notNull(),
    optionName: varchar('option_name', { length: 120 }).notNull(),
    priceDeltaMinor: bigint('price_delta_minor', { mode: 'number' })
      .notNull()
      .default(0),
    isRequired: boolean('is_required').notNull().default(false),
    maxSelect: integer('max_select').notNull().default(1),
  },
  (t) => [
    index('idx_item_modifiers_tenant_item').on(t.tenantId, t.menuItemId),
  ],
);

// 13. upsell_rules
export const upsellRules = pgTable(
  'upsell_rules',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    triggerItemId: uuid('trigger_item_id').references(() => menuItems.id, {
      onDelete: 'cascade',
    }),
    triggerCategoryId: uuid('trigger_category_id').references(
      () => menuCategories.id,
      { onDelete: 'cascade' },
    ),
    suggestedItemId: uuid('suggested_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    promoPriceMinor: bigint('promo_price_minor', { mode: 'number' }),
    priority: integer('priority').notNull().default(0),
  },
  (t) => [index('idx_upsell_rules_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 14. guests
export const guests = pgTable(
  'guests',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    phone: varchar('phone', { length: 32 }),
    email: varchar('email', { length: 255 }),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    loyaltyTier: varchar('loyalty_tier', { length: 24 })
      .$type<LoyaltyTier>()
      .notNull()
      .default('BRONZE'),
    isBlocked: boolean('is_blocked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_guests_tenant_phone').on(t.tenantId, t.phone),
    index('idx_guests_tenant_email').on(t.tenantId, t.email),
  ],
);

// 15. table_sessions
export const tableSessions = pgTable(
  'table_sessions',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    tableId: uuid('table_id').references((): AnyPgColumn => diningTables.id, {
      onDelete: 'set null',
    }),
    sessionType: varchar('session_type', { length: 20 })
      .$type<SessionType>()
      .notNull(),
    tokenNumber: integer('token_number'),
    status: varchar('status', { length: 25 })
      .$type<SessionStatus>()
      .notNull()
      .default('OPEN'),
    guestCount: integer('guest_count').notNull().default(1),
    openedAt: timestamp('opened_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    subtotalMinor: bigint('subtotal_minor', { mode: 'number' })
      .notNull()
      .default(0),
    taxMinor: bigint('tax_minor', { mode: 'number' }).notNull().default(0),
    discountMinor: bigint('discount_minor', { mode: 'number' })
      .notNull()
      .default(0),
    serviceChargeMinor: bigint('service_charge_minor', { mode: 'number' })
      .notNull()
      .default(0),
    tipMinor: bigint('tip_minor', { mode: 'number' }).notNull().default(0),
    totalMinor: bigint('total_minor', { mode: 'number' }).notNull().default(0),
  },
  (t) => [
    index('idx_sessions_tenant_outlet_status').on(
      t.tenantId,
      t.outletId,
      t.status,
    ),
    index('idx_sessions_tenant_opened').on(t.tenantId, t.openedAt),
  ],
);

// 16. orders
export const orders = pgTable(
  'orders',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    orderNumber: varchar('order_number', { length: 48 }).notNull(),
    roundNumber: integer('round_number').notNull().default(1),
    source: varchar('source', { length: 20 })
      .$type<OrderSource>()
      .notNull()
      .default('QR'),
    status: varchar('status', { length: 25 })
      .$type<OrderStatus>()
      .notNull()
      .default('CONFIRMED'),
    placedByGuestId: uuid('placed_by_guest_id').references(() => guests.id, {
      onDelete: 'set null',
    }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_orders_tenant_session').on(t.tenantId, t.sessionId),
    index('idx_orders_tenant_outlet_created').on(
      t.tenantId,
      t.outletId,
      t.createdAt,
    ),
  ],
);

// 17. order_items
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'restrict' }),
    stationId: uuid('station_id')
      .notNull()
      .references(() => kitchenStations.id, { onDelete: 'restrict' }),
    itemNameSnapshot: varchar('item_name_snapshot', { length: 200 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }).notNull(),
    modifiersSnapshot: jsonb('modifiers_snapshot')
      .$type<ModifierSnapshot[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    spiceLevel: varchar('spice_level', { length: 48 }),
    notes: text('notes'),
    taxMinor: bigint('tax_minor', { mode: 'number' }).notNull().default(0),
    kdsStatus: varchar('kds_status', { length: 25 })
      .$type<KdsStatus>()
      .notNull()
      .default('PENDING'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    readyAt: timestamp('ready_at', { withTimezone: true, mode: 'date' }),
    servedAt: timestamp('served_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    index('idx_order_items_tenant_order').on(t.tenantId, t.orderId),
    index('idx_order_items_tenant_station_status').on(
      t.tenantId,
      t.stationId,
      t.kdsStatus,
    ),
  ],
);

// 18. service_requests
export const serviceRequests = pgTable(
  'service_requests',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    tableId: uuid('table_id')
      .notNull()
      .references(() => diningTables.id, { onDelete: 'restrict' }),
    requestType: varchar('request_type', { length: 32 })
      .$type<ServiceRequestType>()
      .notNull(),
    note: text('note'),
    status: varchar('status', { length: 24 })
      .$type<ServiceRequestStatus>()
      .notNull()
      .default('OPEN'),
    assignedUserId: uuid('assigned_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    index('idx_service_requests_tenant_outlet_status').on(
      t.tenantId,
      t.outletId,
      t.status,
    ),
  ],
);

// 19. invoices
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    invoiceNumber: varchar('invoice_number', { length: 64 }).notNull(),
    taxBreakdown: jsonb('tax_breakdown')
      .$type<TaxBreakdownItem[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    totalMinor: bigint('total_minor', { mode: 'number' }).notNull(),
    pdfUrl: text('pdf_url'),
    issuedAt: timestamp('issued_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_invoices_tenant_outlet_number').on(
      t.tenantId,
      t.outletId,
      t.invoiceNumber,
    ),
    index('idx_invoices_tenant_session').on(t.tenantId, t.sessionId),
  ],
);

// 20. payments
export const payments = pgTable(
  'payments',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, {
      onDelete: 'restrict',
    }),
    guestId: uuid('guest_id').references(() => guests.id, {
      onDelete: 'set null',
    }),
    splitGroupId: varchar('split_group_id', { length: 64 }),
    idempotencyKey: varchar('idempotency_key', { length: 128 })
      .notNull()
      .unique(),
    provider: varchar('provider', { length: 32 })
      .$type<PaymentProvider>()
      .notNull(),
    method: varchar('method', { length: 32 }).$type<PaymentMethod>().notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    tipMinor: bigint('tip_minor', { mode: 'number' }).notNull().default(0),
    status: varchar('status', { length: 32 })
      .$type<PaymentStatus>()
      .notNull()
      .default('PENDING'),
    gatewayTxnId: varchar('gateway_txn_id', { length: 160 }),
    rawWebhook: jsonb('raw_webhook').$type<Record<string, unknown>>(),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    index('idx_payments_tenant_session').on(t.tenantId, t.sessionId),
    index('idx_payments_tenant_outlet_status').on(
      t.tenantId,
      t.outletId,
      t.status,
    ),
  ],
);

// 21. reviews
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    guestId: uuid('guest_id').references(() => guests.id, {
      onDelete: 'set null',
    }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    managerNotified: boolean('manager_notified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('idx_reviews_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 22. mini_game_sessions
export const miniGameSessions = pgTable(
  'mini_game_sessions',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    gameType: varchar('game_type', { length: 48 }).notNull(),
    playerNickname: varchar('player_nickname', { length: 80 }).notNull(),
    score: integer('score').notNull().default(0),
    rewardCouponCode: varchar('reward_coupon_code', { length: 48 }),
    playedAt: timestamp('played_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_mini_game_tenant_session').on(t.tenantId, t.sessionId),
  ],
);

// 23. inventory_items
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sku: varchar('sku', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    unit: varchar('unit', { length: 24 }).notNull(),
    currentQty: numeric('current_qty', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),
    reorderLevel: numeric('reorder_level', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),
    costPerUnitMinor: bigint('cost_per_unit_minor', { mode: 'number' })
      .notNull()
      .default(0),
  },
  (t) => [
    uniqueIndex('uq_inventory_tenant_outlet_sku').on(
      t.tenantId,
      t.outletId,
      t.sku,
    ),
  ],
);

// 24. menu_item_recipes
export const menuItemRecipes = pgTable(
  'menu_item_recipes',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    qtyRequired: numeric('qty_required', { precision: 12, scale: 3 }).notNull(),
  },
  (t) => [
    uniqueIndex('uq_recipe_tenant_item_inv').on(
      t.tenantId,
      t.menuItemId,
      t.inventoryItemId,
    ),
  ],
);

// 25. audit_logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id').references(() => outlets.id, {
      onDelete: 'set null',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 120 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: varchar('entity_id', { length: 80 }).notNull(),
    beforeState: jsonb('before_state').$type<Record<string, unknown>>(),
    afterState: jsonb('after_state').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_audit_logs_tenant_created').on(t.tenantId, t.createdAt),
    index('idx_audit_logs_tenant_entity').on(
      t.tenantId,
      t.entityType,
      t.entityId,
    ),
  ],
);

// 26. shift_registers (FR-035 cashier opening float, petty cash & Z-Report reconciliation)
export const shiftRegisters = pgTable(
  'shift_registers',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    openedByUserId: uuid('opened_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    closedByUserId: uuid('closed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 20 })
      .$type<ShiftStatus>()
      .notNull()
      .default('OPEN'),
    openingFloatMinor: bigint('opening_float_minor', { mode: 'number' })
      .notNull()
      .default(0),
    cashSalesMinor: bigint('cash_sales_minor', { mode: 'number' })
      .notNull()
      .default(0),
    pettyCashMinor: bigint('petty_cash_minor', { mode: 'number' })
      .notNull()
      .default(0),
    expectedCashMinor: bigint('expected_cash_minor', { mode: 'number' })
      .notNull()
      .default(0),
    actualCashMinor: bigint('actual_cash_minor', { mode: 'number' }),
    varianceMinor: bigint('variance_minor', { mode: 'number' }),
    notes: text('notes'),
    openedAt: timestamp('opened_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [
    index('idx_shift_registers_tenant_outlet_status').on(
      t.tenantId,
      t.outletId,
      t.status,
    ),
  ],
);

export const pgSchema = {
  tenants,
  outlets,
  roles,
  users,
  userPermissionOverrides,
  floorZones,
  diningTables,
  kitchenStations,
  menuCategories,
  taxSlabs,
  menuItems,
  itemVariantsModifiers,
  upsellRules,
  guests,
  tableSessions,
  orders,
  orderItems,
  serviceRequests,
  invoices,
  payments,
  reviews,
  miniGameSessions,
  inventoryItems,
  menuItemRecipes,
  auditLogs,
  shiftRegisters,
};
