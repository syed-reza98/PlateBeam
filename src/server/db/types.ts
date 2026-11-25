/**
 * Shared dialect-agnostic database types and JSON payload contracts.
 * Imported by both PostgreSQL and MySQL Drizzle schemas, repositories, and services.
 * Zero vendor (@supabase/*) imports allowed here.
 */

export type DbDialect = 'postgres' | 'mysql';

export type SubscriptionPlan = 'STARTER' | 'GROWTH' | 'PRO' | 'ENTERPRISE';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'ARCHIVED';

export interface QrSecurityPolicy {
  requireGps?: boolean;
  maxDistanceMeters?: number;
  requireVenueIp?: boolean;
  allowedIpCidrs?: string[];
  captainApprovalRequired?: boolean;
  payFirstTakeaway?: boolean;
  maxUnpaidOrders?: number;
  serviceRequestCooldownSecs?: number;
}

export type PermissionEffect = 'GRANT' | 'DENY';

export type DiningTableStatus =
  | 'VACANT'
  | 'ORDERING'
  | 'EATING'
  | 'CALLING_WAITER'
  | 'BILL_REQUESTED'
  | 'CLEANING';

export interface PrinterConfig {
  type?: 'LAN' | 'USB' | 'BLUETOOTH';
  host?: string;
  port?: number;
  paperWidthMm?: 58 | 80;
  autoCut?: boolean;
  openDrawer?: boolean;
}

export interface ScheduleRuleWindow {
  daysOfWeek?: number[]; // 0 (Sun) - 6 (Sat)
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

export interface ScheduleRules {
  windows?: ScheduleRuleWindow[];
  label?: string;
}

export type DietaryType = 'VEG' | 'NON_VEG' | 'VEGAN' | 'GLUTEN_FREE' | 'JAIN' | 'EGG';

export interface TaxComponent {
  name: string;
  rateBps: number;
}

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export type SessionType = 'DINE_IN' | 'TAKEAWAY';
export type SessionStatus =
  | 'OPEN'
  | 'BILL_REQUESTED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'CANCELLED';

export type OrderSource = 'QR' | 'WAITER' | 'COUNTER';
export type OrderStatus =
  | 'PENDING_APPROVAL'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type KdsStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CANCELLED';

export interface ModifierSnapshot {
  modifierId?: string;
  groupName: string;
  optionName: string;
  priceDeltaMinor: number;
}

export type ServiceRequestType =
  | 'WATER'
  | 'NAPKINS'
  | 'CUTLERY'
  | 'CLEAN_TABLE'
  | 'BILL'
  | 'HELP';

export type ServiceRequestStatus = 'OPEN' | 'CLAIMED' | 'RESOLVED' | 'CANCELLED';

export interface TaxBreakdownItem {
  name: string;
  rateBps: number;
  taxableMinor: number;
  taxMinor: number;
}

export type PaymentProvider =
  | 'SSLCOMMERZ'
  | 'STRIPE'
  | 'RAZORPAY'
  | 'CASH_EDC'
  | 'SANDBOX';

export type PaymentMethod =
  | 'CARD'
  | 'UPI'
  | 'MFS'
  | 'CASH'
  | 'NET_BANKING'
  | 'WALLET';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED'
  | 'DUPLICATE_FLAGGED';

export type ShiftStatus = 'OPEN' | 'CLOSED';
