import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type {
  auditLogs,
  diningTables,
  floorZones,
  guests,
  inventoryItems,
  invoices,
  itemVariantsModifiers,
  kitchenStations,
  menuCategories,
  menuItemRecipes,
  menuItems,
  miniGameSessions,
  orderItems,
  orders,
  outlets,
  payments,
  reviews,
  roles,
  serviceRequests,
  shiftRegisters,
  tableSessions,
  taxSlabs,
  tenants,
  upsellRules,
  userPermissionOverrides,
  users,
} from '../db/schema/pg';
import type {
  DiningTableStatus,
  KdsStatus,
  OrderStatus,
  PaymentStatus,
  ServiceRequestStatus,
  SessionStatus,
  ShiftStatus,
} from '../db/types';

// Canonical entity record types inferred from schema (identical across PG and MySQL)
export type TenantRecord = InferSelectModel<typeof tenants>;
export type NewTenantRecord = InferInsertModel<typeof tenants>;
export type OutletRecord = InferSelectModel<typeof outlets>;
export type NewOutletRecord = InferInsertModel<typeof outlets>;
export type RoleRecord = InferSelectModel<typeof roles>;
export type NewRoleRecord = InferInsertModel<typeof roles>;
export type UserRecord = InferSelectModel<typeof users>;
export type NewUserRecord = InferInsertModel<typeof users>;
export type UserPermissionOverrideRecord = InferSelectModel<typeof userPermissionOverrides>;
export type FloorZoneRecord = InferSelectModel<typeof floorZones>;
export type DiningTableRecord = InferSelectModel<typeof diningTables>;
export type KitchenStationRecord = InferSelectModel<typeof kitchenStations>;
export type MenuCategoryRecord = InferSelectModel<typeof menuCategories>;
export type TaxSlabRecord = InferSelectModel<typeof taxSlabs>;
export type MenuItemRecord = InferSelectModel<typeof menuItems>;
export type ItemModifierRecord = InferSelectModel<typeof itemVariantsModifiers>;
export type UpsellRuleRecord = InferSelectModel<typeof upsellRules>;
export type GuestRecord = InferSelectModel<typeof guests>;
export type TableSessionRecord = InferSelectModel<typeof tableSessions>;
export type OrderRecord = InferSelectModel<typeof orders>;
export type OrderItemRecord = InferSelectModel<typeof orderItems>;
export type ServiceRequestRecord = InferSelectModel<typeof serviceRequests>;
export type InvoiceRecord = InferSelectModel<typeof invoices>;
export type PaymentRecord = InferSelectModel<typeof payments>;
export type ReviewRecord = InferSelectModel<typeof reviews>;
export type MiniGameSessionRecord = InferSelectModel<typeof miniGameSessions>;
export type InventoryItemRecord = InferSelectModel<typeof inventoryItems>;
export type MenuItemRecipeRecord = InferSelectModel<typeof menuItemRecipes>;
export type AuditLogRecord = InferSelectModel<typeof auditLogs>;
export type ShiftRegisterRecord = InferSelectModel<typeof shiftRegisters>;

export interface TenantOutletRepository {
  findTenantById(tenantId: string): Promise<TenantRecord | null>;
  findTenantBySlug(slug: string): Promise<TenantRecord | null>;
  listTenants(): Promise<TenantRecord[]>;
  createTenant(data: NewTenantRecord): Promise<TenantRecord>;
  findOutletById(tenantId: string, outletId: string): Promise<OutletRecord | null>;
  findOutletBySubdomain(subdomain: string): Promise<OutletRecord | null>;
  listOutlets(tenantId: string): Promise<OutletRecord[]>;
  createOutlet(data: NewOutletRecord): Promise<OutletRecord>;
  updateOutletPolicy(
    tenantId: string,
    outletId: string,
    policy: OutletRecord['qrSecurityPolicy'],
  ): Promise<OutletRecord>;
}

export interface RbacRepository {
  findUserById(tenantId: string, userId: string): Promise<UserRecord | null>;
  findUserByEmail(tenantId: string, email: string): Promise<UserRecord | null>;
  listUsersByOutlet(tenantId: string, outletId?: string): Promise<UserRecord[]>;
  createUser(data: NewUserRecord): Promise<UserRecord>;
  findRoleById(tenantId: string, roleId: string): Promise<RoleRecord | null>;
  listRoles(tenantId: string): Promise<RoleRecord[]>;
  listUserOverrides(
    tenantId: string,
    userId: string,
  ): Promise<UserPermissionOverrideRecord[]>;
  upsertPermissionOverride(input: {
    tenantId: string;
    userId: string;
    permissionKey: string;
    effect: 'GRANT' | 'DENY';
  }): Promise<UserPermissionOverrideRecord>;
}

export interface FloorRepository {
  listZones(tenantId: string, outletId: string): Promise<FloorZoneRecord[]>;
  listTables(tenantId: string, outletId: string): Promise<DiningTableRecord[]>;
  findTableById(
    tenantId: string,
    tableId: string,
  ): Promise<DiningTableRecord | null>;
  findTableByQrToken(qrToken: string): Promise<DiningTableRecord | null>;
  updateTableStatus(
    tenantId: string,
    tableId: string,
    status: DiningTableStatus,
    activeSessionId?: string | null,
  ): Promise<DiningTableRecord>;
  rotateTableQrToken(
    tenantId: string,
    tableId: string,
    newToken: string,
  ): Promise<DiningTableRecord>;
  updateTablePosition(
    tenantId: string,
    tableId: string,
    posX: number,
    posY: number,
  ): Promise<DiningTableRecord>;
}

export interface MenuRepository {
  listStations(tenantId: string, outletId: string): Promise<KitchenStationRecord[]>;
  listCategories(tenantId: string, outletId: string): Promise<MenuCategoryRecord[]>;
  listTaxSlabs(tenantId: string, outletId: string): Promise<TaxSlabRecord[]>;
  listMenuItems(
    tenantId: string,
    outletId: string,
    onlyAvailable?: boolean,
  ): Promise<MenuItemRecord[]>;
  findMenuItemById(
    tenantId: string,
    itemId: string,
  ): Promise<MenuItemRecord | null>;
  listModifiersByOutlet(
    tenantId: string,
    outletId: string,
  ): Promise<ItemModifierRecord[]>;
  listUpsellRules(tenantId: string, outletId: string): Promise<UpsellRuleRecord[]>;
  setItemAvailability(
    tenantId: string,
    itemId: string,
    isAvailable: boolean,
  ): Promise<MenuItemRecord>;
  upsertMenuItem(
    data: InferInsertModel<typeof menuItems>,
  ): Promise<MenuItemRecord>;
}

export interface SessionOrderRepository {
  findSessionById(
    tenantId: string,
    sessionId: string,
  ): Promise<TableSessionRecord | null>;
  findOpenSessionByTable(
    tenantId: string,
    tableId: string,
  ): Promise<TableSessionRecord | null>;
  createSession(
    data: InferInsertModel<typeof tableSessions>,
  ): Promise<TableSessionRecord>;
  updateSessionTotals(
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
  ): Promise<TableSessionRecord>;
  updateSessionStatus(
    tenantId: string,
    sessionId: string,
    status: SessionStatus,
    closedAt?: Date | null,
  ): Promise<TableSessionRecord>;
  listOrdersBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<OrderRecord[]>;
  createOrderWithItems(input: {
    order: InferInsertModel<typeof orders>;
    items: InferInsertModel<typeof orderItems>[];
  }): Promise<{ order: OrderRecord; items: OrderItemRecord[] }>;
  updateOrderStatus(
    tenantId: string,
    orderId: string,
    status: OrderStatus,
    approvedByUserId?: string | null,
  ): Promise<OrderRecord>;
  listOrderItemsBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<OrderItemRecord[]>;
  listKdsQueue(
    tenantId: string,
    outletId: string,
    stationId?: string,
  ): Promise<Array<OrderItemRecord & { orderNumber: string; tableId: string | null; tokenNumber: number | null; createdAt: Date }>>;
  updateOrderItemKdsStatus(
    tenantId: string,
    itemId: string,
    status: KdsStatus,
    timestamps?: Partial<Pick<OrderItemRecord, 'startedAt' | 'readyAt' | 'servedAt'>>,
  ): Promise<OrderItemRecord>;
}

export interface ServiceRequestRepository {
  listOpenRequests(
    tenantId: string,
    outletId: string,
  ): Promise<ServiceRequestRecord[]>;
  findRecentRequestForTable(
    tenantId: string,
    tableId: string,
    requestType: ServiceRequestRecord['requestType'],
    since: Date,
  ): Promise<ServiceRequestRecord | null>;
  createRequest(
    data: InferInsertModel<typeof serviceRequests>,
  ): Promise<ServiceRequestRecord>;
  updateRequestStatus(
    tenantId: string,
    requestId: string,
    status: ServiceRequestStatus,
    assignedUserId?: string | null,
    resolvedAt?: Date | null,
  ): Promise<ServiceRequestRecord>;
}

export interface BillingRepository {
  findPaymentByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<PaymentRecord | null>;
  findPaymentByGatewayTxnId(
    gatewayTxnId: string,
  ): Promise<PaymentRecord | null>;
  listPaymentsBySession(
    tenantId: string,
    sessionId: string,
  ): Promise<PaymentRecord[]>;
  createPayment(
    data: InferInsertModel<typeof payments>,
  ): Promise<PaymentRecord>;
  updatePaymentStatus(
    tenantId: string,
    paymentId: string,
    status: PaymentStatus,
    updates?: Partial<
      Pick<PaymentRecord, 'gatewayTxnId' | 'rawWebhook' | 'paidAt' | 'invoiceId'>
    >,
  ): Promise<PaymentRecord>;
  createInvoice(
    data: InferInsertModel<typeof invoices>,
  ): Promise<InvoiceRecord>;
  findInvoiceById(
    tenantId: string,
    invoiceId: string,
  ): Promise<InvoiceRecord | null>;
  nextInvoiceNumber(tenantId: string, outletId: string): Promise<string>;
}

export interface GuestEngagementRepository {
  findOrCreateGuest(input: {
    tenantId: string;
    phone?: string;
    email?: string;
    displayName: string;
  }): Promise<GuestRecord>;
  addLoyaltyPoints(
    tenantId: string,
    guestId: string,
    deltaPoints: number,
  ): Promise<GuestRecord>;
  createReview(
    data: InferInsertModel<typeof reviews>,
  ): Promise<ReviewRecord>;
  recordMiniGameScore(
    data: InferInsertModel<typeof miniGameSessions>,
  ): Promise<MiniGameSessionRecord>;
  listMiniGameLeaderboard(
    tenantId: string,
    outletId: string,
    sessionId?: string,
  ): Promise<MiniGameSessionRecord[]>;
}

export interface InventoryRepository {
  listInventoryItems(
    tenantId: string,
    outletId: string,
  ): Promise<InventoryItemRecord[]>;
  listRecipesForMenuItems(
    tenantId: string,
    menuItemIds: string[],
  ): Promise<MenuItemRecipeRecord[]>;
  deductStock(
    tenantId: string,
    outletId: string,
    deductions: Array<{ inventoryItemId: string; qtyToDeduct: number }>,
  ): Promise<{ depletedItemIds: string[] }>;
  restockItem(
    tenantId: string,
    inventoryItemId: string,
    deltaQty: number,
  ): Promise<InventoryItemRecord>;
}

export interface ShiftRegisterRepository {
  findOpenShift(
    tenantId: string,
    outletId: string,
  ): Promise<ShiftRegisterRecord | null>;
  openShift(
    data: InferInsertModel<typeof shiftRegisters>,
  ): Promise<ShiftRegisterRecord>;
  closeShift(
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
  ): Promise<ShiftRegisterRecord>;
  listShifts(
    tenantId: string,
    outletId: string,
  ): Promise<ShiftRegisterRecord[]>;
}

export interface AuditRepository {
  appendLog(data: InferInsertModel<typeof auditLogs>): Promise<AuditLogRecord>;
  listLogs(
    tenantId: string,
    outletId?: string,
    limit?: number,
  ): Promise<AuditLogRecord[]>;
}

export interface RepositoryRegistry {
  tenantOutlet: TenantOutletRepository;
  rbac: RbacRepository;
  floor: FloorRepository;
  menu: MenuRepository;
  sessionOrder: SessionOrderRepository;
  serviceRequest: ServiceRequestRepository;
  billing: BillingRepository;
  engagement: GuestEngagementRepository;
  inventory: InventoryRepository;
  shift: ShiftRegisterRepository;
  audit: AuditRepository;
}
