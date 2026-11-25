import type {
  DietaryType,
  DiningTableStatus,
  KdsStatus,
  LoyaltyTier,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  ServiceRequestType,
  SessionStatus,
  SessionType,
} from '@/server/db/types';

export interface GuestOutletInfo {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  wifiSsid?: string | null;
  wifiPassword?: string | null;
  googleReviewUrl?: string | null;
  gstin?: string | null;
  vatNumber?: string | null;
  heroImageUrl?: string | null;
}

export interface GuestTableInfo {
  id: string;
  tableNumber: string;
  capacity: number;
  status: DiningTableStatus;
  zoneName?: string | null;
}

export interface GuestCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface GuestModifier {
  id: string;
  menuItemId: string;
  groupName: string;
  optionName: string;
  priceDeltaMinor: number;
  isRequired: boolean;
  isMultiSelect: boolean;
}

export interface GuestMenuItem {
  id: string;
  categoryId: string;
  stationId: string;
  name: string;
  description?: string | null;
  basePriceMinor: number;
  dietaryType: DietaryType;
  allergens: string[];
  spiceLevels: string[];
  prepTimeMins: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  isFeatured?: boolean;
  modifiers?: GuestModifier[];
}

export interface GuestUpsellRule {
  id: string;
  triggerCategoryId?: string | null;
  triggerMenuItemId?: string | null;
  suggestedMenuItemId: string;
  promoLabel: string;
  discountMinor?: number;
}

export interface GuestCartItem {
  cartItemId: string;
  menuItemId: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  modifierIds: string[];
  modifierLabels: string[];
  spiceLevel?: string;
  notes?: string;
  addedByNickname: string;
}

export interface GuestOrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  itemNameSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  kdsStatus: KdsStatus;
  spiceLevel?: string | null;
  notes?: string | null;
  modifiersSnapshot?: Array<{
    groupName: string;
    optionName: string;
    priceDeltaMinor: number;
  }>;
}

export interface GuestOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  tokenNumber?: number | null;
  createdAt: string;
  items: GuestOrderItem[];
}

export interface GuestPayment {
  id: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  amountMinor: number;
  tipMinor: number;
  status: PaymentStatus;
  splitGroupId?: string | null;
  createdAt: string;
}

export interface GuestSessionInfo {
  id: string;
  sessionType: SessionType;
  status: SessionStatus;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  serviceChargeMinor: number;
  tipMinor: number;
  totalMinor: number;
  paidMinor: number;
  remainingMinor: number;
  estimatedWaitMins?: number;
  invoiceId?: string | null;
}

export interface GuestLoyaltyProfile {
  guestId: string;
  name?: string | null;
  phone?: string | null;
  pointsBalance: number;
  tier: LoyaltyTier;
}

export interface GuestLeaderboardEntry {
  playerNickname: string;
  score: number;
  createdAt: string;
  rewardCouponCode?: string | null;
}

export interface BootstrapPayload {
  outlet: GuestOutletInfo;
  table: GuestTableInfo | null;
  session: GuestSessionInfo;
  categories: GuestCategory[];
  menuItems: GuestMenuItem[];
  modifiers: GuestModifier[];
  upsellRules: GuestUpsellRule[];
  sharedCart: GuestCartItem[];
  orders: GuestOrder[];
  payments: GuestPayment[];
  loyalty?: GuestLoyaltyProfile | null;
  leaderboard?: GuestLeaderboardEntry[];
}

export interface SplitBillBreakdown {
  mode: 'EQUAL' | 'BY_ITEM' | 'CUSTOM';
  subtotalMinor: number;
  taxMinor: number;
  serviceChargeMinor: number;
  tipMinor: number;
  grandTotalMinor: number;
  remainingMinor: number;
  shares: Array<{
    label: string;
    amountMinor: number;
    tipMinor: number;
    totalWithTipMinor: number;
  }>;
}

export interface ReceiptPayload {
  invoiceId: string;
  invoiceNumber: string;
  issuedAt: string;
  outletName: string;
  gstin?: string | null;
  vatNumber?: string | null;
  tableNumber?: string | null;
  subtotalMinor: number;
  taxMinor: number;
  serviceChargeMinor: number;
  discountMinor: number;
  tipMinor: number;
  totalMinor: number;
  taxBreakdown: Array<{
    name: string;
    rateBps: number;
    taxableMinor: number;
    taxMinor: number;
  }>;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
  payments: Array<{
    method: string;
    provider: string;
    amountMinor: number;
    status: string;
  }>;
  html?: string;
}

export const SERVICE_REQUEST_TAGS: Array<{
  type: ServiceRequestType;
  label: string;
  description: string;
}> = [
  { type: 'WATER', label: 'Water', description: 'Refill water glasses or carafe' },
  { type: 'NAPKINS', label: 'Napkins', description: 'Extra tissues or cloth napkins' },
  { type: 'CUTLERY', label: 'Cutlery', description: 'Fresh spoons, forks, or plates' },
  { type: 'CLEAN_TABLE', label: 'Clean Table', description: 'Clear empty plates or wipe spill' },
  { type: 'BILL', label: 'Request Bill', description: 'Ask captain for printed check' },
  { type: 'HELP', label: 'Need Assistance', description: 'Speak with a server at your table' },
];

export function formatMoney(minor: number, currency = 'BDT'): string {
  const code = currency.toUpperCase();
  const major = minor / 100;
  if (code === 'BDT') {
    return `৳${major.toLocaleString('en-US', {
      minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${code} ${major.toFixed(2)}`;
  }
}
