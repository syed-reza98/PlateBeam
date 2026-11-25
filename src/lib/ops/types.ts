import type {
  DietaryType,
  DiningTableStatus,
  KdsStatus,
  OrderSource,
  OrderStatus,
  PermissionEffect,
  QrSecurityPolicy,
  ServiceRequestStatus,
  ServiceRequestType,
  ShiftStatus,
  SubscriptionPlan,
  TenantStatus,
} from '@/server/db/types';

export interface OpsZone {
  id: string;
  name: string;
  sortOrder: number;
}

export interface OpsTable {
  id: string;
  zoneId: string;
  tableNumber: string;
  capacity: number;
  status: DiningTableStatus;
  activeSessionId: string | null;
  posX: number;
  posY: number;
  qrToken: string;
  activeGuestCount?: number;
  runningTotalMinor?: number;
}

export interface OpsServiceRequest {
  id: string;
  tableId: string;
  tableNumber: string;
  requestType: ServiceRequestType;
  status: ServiceRequestStatus;
  note?: string | null;
  createdAt: string;
  claimedByName?: string | null;
}

export interface OpsPendingOrder {
  id: string;
  orderNumber: string;
  tableId: string | null;
  tableNumber: string;
  source: OrderSource;
  status: OrderStatus;
  totalMinor: number;
  createdAt: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    modifiers: string[];
    notes?: string | null;
  }>;
}

export interface OpsStaffMember {
  id: string;
  fullName: string;
  email: string;
  roleName: string;
  isActive: boolean;
  outletId?: string | null;
}

export interface OpsShiftSummary {
  id: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string | null;
  openingFloatMinor: number;
  cashSalesMinor: number;
  cardSalesMinor: number;
  upiMfsSalesMinor: number;
  pettyCashMinor: number;
  expectedCashMinor: number;
  actualCashMinor?: number | null;
  varianceMinor?: number | null;
  totalOrders: number;
}

export interface KdsTicketItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  stationId: string;
  stationName: string;
  status: KdsStatus;
  modifiers: string[];
  spiceLevel?: string | null;
  allergens: string[];
  notes?: string | null;
  companionStations: string[];
}

export interface KdsTicket {
  orderId: string;
  orderNumber: string;
  tableNumber: string | null;
  tokenNumber: number | null;
  source: OrderSource;
  createdAt: string;
  slaMinutes: number;
  items: KdsTicketItem[];
}

export interface DashboardKpiSummary {
  occupiedTables: number;
  totalTables: number;
  liveOrdersCount: number;
  netSalesMinor: number;
  aovMinor: number;
  avgTurnoverMinutes: number;
  kdsSlaOnTimePct: number;
  paymentMix: Array<{ method: string; amountMinor: number; pct: number }>;
}

export interface DashboardMenuItem {
  id: string;
  name: string;
  categoryName: string;
  stationName: string;
  basePriceMinor: number;
  costMinor: number;
  dietaryType: DietaryType;
  isAvailable: boolean;
  unitsSold30d: number;
}

export interface DashboardInventoryItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  linkedMenuItems: string[];
}

export interface DashboardAuditLog {
  id: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface DashboardOverride {
  id: string;
  userId: string;
  permissionKey: string;
  effect: PermissionEffect;
}

export interface DashboardTaxSlab {
  id: string;
  name: string;
  isInclusive: boolean;
  components: Array<{ name: string; rateBps: number }>;
  isActive: boolean;
}

export interface DashboardUpsellRule {
  id: string;
  triggerItemName: string;
  suggestedItemName: string;
  pitchText: string;
  isActive: boolean;
}

export interface SuperAdminTenant {
  id: string;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  status: TenantStatus;
  currencyCode: string;
  outletCount: number;
  activeTablesCount: number;
  monthlyGmvMinor: number;
  createdAt: string;
}

export interface PosBootstrapPayload {
  outletId: string;
  outletName: string;
  outletSlug: string;
  currencyCode: string;
  zones: OpsZone[];
  tables: OpsTable[];
  serviceRequests: OpsServiceRequest[];
  pendingApprovals: OpsPendingOrder[];
  staff: OpsStaffMember[];
  activeShift: OpsShiftSummary | null;
  nextTokenNumber: number;
}

export interface DashboardBootstrapPayload {
  outletId: string;
  outletName: string;
  currencyCode: string;
  kpis: DashboardKpiSummary;
  menuItems: DashboardMenuItem[];
  inventory: DashboardInventoryItem[];
  staff: OpsStaffMember[];
  overrides: DashboardOverride[];
  auditLogs: DashboardAuditLog[];
  taxSlabs: DashboardTaxSlab[];
  upsellRules: DashboardUpsellRule[];
  qrSecurityPolicy: QrSecurityPolicy;
}
