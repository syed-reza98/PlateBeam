import {
  bigint,
  boolean,
  char,
  datetime,
  decimal,
  double,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
  type AnyMySqlColumn,
} from 'drizzle-orm/mysql-core';
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
export const tenants = mysqlTable('tenants', {
  id: char('id', { length: 36 })
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
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 2. outlets
export const outlets = mysqlTable(
  'outlets',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 200 }).notNull(),
    subdomain: varchar('subdomain', { length: 100 }).notNull().unique(),
    address: text('address'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('Asia/Dhaka'),
    taxRegNo: varchar('tax_reg_no', { length: 64 }),
    wifiSsid: varchar('wifi_ssid', { length: 128 }),
    wifiPasswordEnc: text('wifi_password_enc'),
    qrSecurityPolicy: json('qr_security_policy')
      .$type<QrSecurityPolicy>()
      .notNull()
      .$defaultFn(() => ({})),
    geoLat: double('geo_lat'),
    geoLng: double('geo_lng'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('idx_outlets_tenant').on(t.tenantId)],
);

// 3. roles
export const roles = mysqlTable(
  'roles',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 }).references(() => tenants.id, {
      onDelete: 'restrict',
    }),
    name: varchar('name', { length: 80 }).notNull(),
    defaultPermissions: json('default_permissions')
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('idx_roles_tenant_name').on(t.tenantId, t.name)],
);

// 4. users
export const users = mysqlTable(
  'users',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 }).references(() => outlets.id, {
      onDelete: 'set null',
    }),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    passwordHash: text('password_hash'),
    posPinHash: text('pos_pin_hash'),
    roleId: char('role_id', { length: 36 })
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('uq_users_tenant_email').on(t.tenantId, t.email),
    index('idx_users_tenant_outlet').on(t.tenantId, t.outletId),
  ],
);

// 5. user_permission_overrides
export const userPermissionOverrides = mysqlTable(
  'user_permission_overrides',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    userId: char('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionKey: varchar('permission_key', { length: 120 }).notNull(),
    effect: varchar('effect', { length: 10 })
      .$type<PermissionEffect>()
      .notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
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
export const floorZones = mysqlTable(
  'floor_zones',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    displayOrder: int('display_order').notNull().default(0),
  },
  (t) => [index('idx_floor_zones_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 7. dining_tables
export const diningTables = mysqlTable(
  'dining_tables',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    zoneId: char('zone_id', { length: 36 })
      .notNull()
      .references(() => floorZones.id, { onDelete: 'restrict' }),
    tableNumber: varchar('table_number', { length: 32 }).notNull(),
    capacity: int('capacity').notNull().default(4),
    qrToken: varchar('qr_token', { length: 255 }).notNull().unique(),
    qrRotatedAt: datetime('qr_rotated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    posX: double('pos_x').notNull().default(0),
    posY: double('pos_y').notNull().default(0),
    status: varchar('status', { length: 32 })
      .$type<DiningTableStatus>()
      .notNull()
      .default('VACANT'),
    activeSessionId: char('active_session_id', { length: 36 }).references(
      (): AnyMySqlColumn => tableSessions.id,
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
export const kitchenStations = mysqlTable(
  'kitchen_stations',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    printerConfig: json('printer_config')
      .$type<PrinterConfig>()
      .notNull()
      .$defaultFn(() => ({})),
    slaTargetMins: int('sla_target_mins').notNull().default(15),
  },
  (t) => [index('idx_kitchen_stations_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 9. menu_categories
export const menuCategories = mysqlTable(
  'menu_categories',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    sortOrder: int('sort_order').notNull().default(0),
    scheduleRules: json('schedule_rules')
      .$type<ScheduleRules>()
      .notNull()
      .$defaultFn(() => ({})),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [index('idx_menu_categories_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 10. tax_slabs
export const taxSlabs = mysqlTable(
  'tax_slabs',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    rateBps: int('rate_bps').notNull().default(0),
    components: json('components')
      .$type<TaxComponent[]>()
      .notNull()
      .$defaultFn(() => []),
    hsnCode: varchar('hsn_code', { length: 32 }),
    isInclusive: boolean('is_inclusive').notNull().default(false),
  },
  (t) => [index('idx_tax_slabs_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 11. menu_items
export const menuItems = mysqlTable(
  'menu_items',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    categoryId: char('category_id', { length: 36 })
      .notNull()
      .references(() => menuCategories.id, { onDelete: 'restrict' }),
    stationId: char('station_id', { length: 36 })
      .notNull()
      .references(() => kitchenStations.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    basePriceMinor: bigint('base_price_minor', { mode: 'number' }).notNull(),
    taxSlabId: char('tax_slab_id', { length: 36 })
      .notNull()
      .references(() => taxSlabs.id, { onDelete: 'restrict' }),
    dietaryType: varchar('dietary_type', { length: 32 })
      .$type<DietaryType>()
      .notNull()
      .default('VEG'),
    allergens: json('allergens')
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    spiceLevels: json('spice_levels')
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    prepTimeMins: int('prep_time_mins').notNull().default(12),
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
export const itemVariantsModifiers = mysqlTable(
  'item_variants_modifiers',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    menuItemId: char('menu_item_id', { length: 36 })
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    groupName: varchar('group_name', { length: 120 }).notNull(),
    optionName: varchar('option_name', { length: 120 }).notNull(),
    priceDeltaMinor: bigint('price_delta_minor', { mode: 'number' })
      .notNull()
      .default(0),
    isRequired: boolean('is_required').notNull().default(false),
    maxSelect: int('max_select').notNull().default(1),
  },
  (t) => [
    index('idx_item_modifiers_tenant_item').on(t.tenantId, t.menuItemId),
  ],
);

// 13. upsell_rules
export const upsellRules = mysqlTable(
  'upsell_rules',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    triggerItemId: char('trigger_item_id', { length: 36 }).references(
      () => menuItems.id,
      { onDelete: 'cascade' },
    ),
    triggerCategoryId: char('trigger_category_id', { length: 36 }).references(
      () => menuCategories.id,
      { onDelete: 'cascade' },
    ),
    suggestedItemId: char('suggested_item_id', { length: 36 })
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    promoPriceMinor: bigint('promo_price_minor', { mode: 'number' }),
    priority: int('priority').notNull().default(0),
  },
  (t) => [index('idx_upsell_rules_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 14. guests
export const guests = mysqlTable(
  'guests',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    phone: varchar('phone', { length: 32 }),
    email: varchar('email', { length: 255 }),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    loyaltyPoints: int('loyalty_points').notNull().default(0),
    loyaltyTier: varchar('loyalty_tier', { length: 24 })
      .$type<LoyaltyTier>()
      .notNull()
      .default('BRONZE'),
    isBlocked: boolean('is_blocked').notNull().default(false),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_guests_tenant_phone').on(t.tenantId, t.phone),
    index('idx_guests_tenant_email').on(t.tenantId, t.email),
  ],
);

// 15. table_sessions
export const tableSessions = mysqlTable(
  'table_sessions',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    tableId: char('table_id', { length: 36 }).references(
      (): AnyMySqlColumn => diningTables.id,
      { onDelete: 'set null' },
    ),
    sessionType: varchar('session_type', { length: 20 })
      .$type<SessionType>()
      .notNull(),
    tokenNumber: int('token_number'),
    status: varchar('status', { length: 25 })
      .$type<SessionStatus>()
      .notNull()
      .default('OPEN'),
    guestCount: int('guest_count').notNull().default(1),
    openedAt: datetime('opened_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    closedAt: datetime('closed_at', { mode: 'date', fsp: 3 }),
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
export const orders = mysqlTable(
  'orders',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: char('session_id', { length: 36 })
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    orderNumber: varchar('order_number', { length: 48 }).notNull(),
    roundNumber: int('round_number').notNull().default(1),
    source: varchar('source', { length: 20 })
      .$type<OrderSource>()
      .notNull()
      .default('QR'),
    status: varchar('status', { length: 25 })
      .$type<OrderStatus>()
      .notNull()
      .default('CONFIRMED'),
    placedByGuestId: char('placed_by_guest_id', { length: 36 }).references(
      () => guests.id,
      { onDelete: 'set null' },
    ),
    approvedByUserId: char('approved_by_user_id', { length: 36 }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
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
export const orderItems = mysqlTable(
  'order_items',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    orderId: char('order_id', { length: 36 })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    menuItemId: char('menu_item_id', { length: 36 })
      .notNull()
      .references(() => menuItems.id, { onDelete: 'restrict' }),
    stationId: char('station_id', { length: 36 })
      .notNull()
      .references(() => kitchenStations.id, { onDelete: 'restrict' }),
    itemNameSnapshot: varchar('item_name_snapshot', { length: 200 }).notNull(),
    quantity: int('quantity').notNull().default(1),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }).notNull(),
    modifiersSnapshot: json('modifiers_snapshot')
      .$type<ModifierSnapshot[]>()
      .notNull()
      .$defaultFn(() => []),
    spiceLevel: varchar('spice_level', { length: 48 }),
    notes: text('notes'),
    taxMinor: bigint('tax_minor', { mode: 'number' }).notNull().default(0),
    kdsStatus: varchar('kds_status', { length: 25 })
      .$type<KdsStatus>()
      .notNull()
      .default('PENDING'),
    startedAt: datetime('started_at', { mode: 'date', fsp: 3 }),
    readyAt: datetime('ready_at', { mode: 'date', fsp: 3 }),
    servedAt: datetime('served_at', { mode: 'date', fsp: 3 }),
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
export const serviceRequests = mysqlTable(
  'service_requests',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: char('session_id', { length: 36 })
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    tableId: char('table_id', { length: 36 })
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
    assignedUserId: char('assigned_user_id', { length: 36 }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    resolvedAt: datetime('resolved_at', { mode: 'date', fsp: 3 }),
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
export const invoices = mysqlTable(
  'invoices',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: char('session_id', { length: 36 })
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    invoiceNumber: varchar('invoice_number', { length: 64 }).notNull(),
    taxBreakdown: json('tax_breakdown')
      .$type<TaxBreakdownItem[]>()
      .notNull()
      .$defaultFn(() => []),
    totalMinor: bigint('total_minor', { mode: 'number' }).notNull(),
    pdfUrl: text('pdf_url'),
    issuedAt: datetime('issued_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
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
export const payments = mysqlTable(
  'payments',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: char('session_id', { length: 36 })
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    invoiceId: char('invoice_id', { length: 36 }).references(
      () => invoices.id,
      { onDelete: 'restrict' },
    ),
    guestId: char('guest_id', { length: 36 }).references(() => guests.id, {
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
    rawWebhook: json('raw_webhook').$type<Record<string, unknown>>(),
    paidAt: datetime('paid_at', { mode: 'date', fsp: 3 }),
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
export const reviews = mysqlTable(
  'reviews',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: char('session_id', { length: 36 })
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    guestId: char('guest_id', { length: 36 }).references(() => guests.id, {
      onDelete: 'set null',
    }),
    rating: int('rating').notNull(),
    comment: text('comment'),
    tags: json('tags')
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    managerNotified: boolean('manager_notified').notNull().default(false),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('idx_reviews_tenant_outlet').on(t.tenantId, t.outletId)],
);

// 22. mini_game_sessions
export const miniGameSessions = mysqlTable(
  'mini_game_sessions',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sessionId: char('session_id', { length: 36 })
      .notNull()
      .references(() => tableSessions.id, { onDelete: 'restrict' }),
    gameType: varchar('game_type', { length: 48 }).notNull(),
    playerNickname: varchar('player_nickname', { length: 80 }).notNull(),
    score: int('score').notNull().default(0),
    rewardCouponCode: varchar('reward_coupon_code', { length: 48 }),
    playedAt: datetime('played_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index('idx_mini_game_tenant_session').on(t.tenantId, t.sessionId),
  ],
);

// 23. inventory_items
export const inventoryItems = mysqlTable(
  'inventory_items',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    sku: varchar('sku', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    unit: varchar('unit', { length: 24 }).notNull(),
    currentQty: decimal('current_qty', { precision: 12, scale: 3 })
      .notNull()
      .default('0'),
    reorderLevel: decimal('reorder_level', { precision: 12, scale: 3 })
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
export const menuItemRecipes = mysqlTable(
  'menu_item_recipes',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    menuItemId: char('menu_item_id', { length: 36 })
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    inventoryItemId: char('inventory_item_id', { length: 36 })
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    qtyRequired: decimal('qty_required', { precision: 12, scale: 3 }).notNull(),
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
export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 }).references(() => outlets.id, {
      onDelete: 'set null',
    }),
    actorUserId: char('actor_user_id', { length: 36 }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    action: varchar('action', { length: 120 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: varchar('entity_id', { length: 80 }).notNull(),
    beforeState: json('before_state').$type<Record<string, unknown>>(),
    afterState: json('after_state').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
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
export const shiftRegisters = mysqlTable(
  'shift_registers',
  {
    id: char('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: char('tenant_id', { length: 36 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    outletId: char('outlet_id', { length: 36 })
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    openedByUserId: char('opened_by_user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    closedByUserId: char('closed_by_user_id', { length: 36 }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
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
    openedAt: datetime('opened_at', { mode: 'date', fsp: 3 })
      .notNull()
      .$defaultFn(() => new Date()),
    closedAt: datetime('closed_at', { mode: 'date', fsp: 3 }),
  },
  (t) => [
    index('idx_shift_registers_tenant_outlet_status').on(
      t.tenantId,
      t.outletId,
      t.status,
    ),
  ],
);

export const mysqlSchema = {
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
