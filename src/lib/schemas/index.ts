import { z } from 'zod';

/**
 * Shared Zod DTO contracts for PlateBeam API v1, QR, Menu, Orders, KDS,
 * Split-Bill, Payments, Inventory, RBAC, and Analytics.
 * Zero vendor (@supabase/*) imports allowed here.
 */

export const uuidSchema = z.string().uuid();
export const minorAmountSchema = z.number().int().nonnegative();

// --- QR & Guest Bootstrap ---
export const qrBootstrapQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  guestId: uuidSchema.optional(),
});

export const qrRotateSchema = z.object({
  tableId: uuidSchema,
});

// --- Menu & Catalog ---
export const dietaryTypeSchema = z.enum([
  'VEG',
  'NON_VEG',
  'VEGAN',
  'GLUTEN_FREE',
  'JAIN',
  'EGG',
]);

export const menuItemCreateSchema = z.object({
  outletId: uuidSchema,
  categoryId: uuidSchema,
  stationId: uuidSchema,
  taxSlabId: uuidSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  basePriceMinor: minorAmountSchema,
  dietaryType: dietaryTypeSchema.default('VEG'),
  allergens: z.array(z.string().max(48)).default([]),
  spiceLevels: z.array(z.string().max(48)).default([]),
  prepTimeMins: z.number().int().min(1).max(180).default(12),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().default(true),
});

export const menuItemAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

// --- Cart & Orders ---
export const orderItemInputSchema = z.object({
  menuItemId: uuidSchema,
  quantity: z.number().int().min(1).max(99),
  modifierIds: z.array(uuidSchema).default([]),
  spiceLevel: z.string().max(48).optional(),
  notes: z.string().max(400).optional(),
});

export const sharedCartSyncSchema = z.object({
  guestNickname: z.string().min(1).max(60),
  items: z.array(orderItemInputSchema).max(100),
});

export const placeOrderSchema = z.object({
  source: z.enum(['QR', 'WAITER', 'COUNTER']).default('QR'),
  guestId: uuidSchema.optional(),
  items: z.array(orderItemInputSchema).min(1).max(100),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

// --- KDS ---
export const kdsStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'SERVED',
  'CANCELLED',
]);

export const kdsItemStatusPatchSchema = z.object({
  status: kdsStatusSchema,
  managerPin: z.string().min(4).max(8).optional(),
});

export const kdsRecallTicketSchema = z.object({
  orderId: uuidSchema,
});

// --- Service Requests (Call Waiter) ---
export const serviceRequestTypeSchema = z.enum([
  'WATER',
  'NAPKINS',
  'CUTLERY',
  'CLEAN_TABLE',
  'BILL',
  'HELP',
]);

export const createServiceRequestSchema = z.object({
  tableId: uuidSchema,
  requestType: serviceRequestTypeSchema,
  note: z.string().max(300).optional(),
});

export const claimServiceRequestSchema = z.object({
  status: z.enum(['CLAIMED', 'RESOLVED', 'CANCELLED']),
});

// --- Split-Bill & Payments ---
export const splitBillModeSchema = z.enum(['EQUAL', 'BY_ITEM', 'CUSTOM']);

export const splitBillCalculateSchema = z.object({
  mode: splitBillModeSchema,
  splitCount: z.number().int().min(1).max(20).optional(),
  itemSelections: z
    .array(
      z.object({
        payerLabel: z.string().min(1).max(60),
        orderItemId: uuidSchema,
        shareRatio: z.number().positive().max(1).default(1),
      }),
    )
    .optional(),
  customAmountsMinor: z.array(minorAmountSchema).optional(),
  tipMinor: minorAmountSchema.default(0),
});

export const paymentProviderSchema = z.enum([
  'SSLCOMMERZ',
  'STRIPE',
  'RAZORPAY',
  'CASH_EDC',
  'SANDBOX',
]);

export const paymentMethodSchema = z.enum([
  'CARD',
  'UPI',
  'MFS',
  'CASH',
  'NET_BANKING',
  'WALLET',
]);

export const initiatePaymentSchema = z.object({
  provider: paymentProviderSchema,
  method: paymentMethodSchema,
  amountMinor: z.number().int().positive(),
  tipMinor: minorAmountSchema.default(0),
  splitGroupId: z.string().max(64).optional(),
  guestId: uuidSchema.optional(),
  customerName: z.string().max(120).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(32).optional(),
  idempotencyKey: z.string().min(8).max(128),
});

// --- Reviews & Mini-Games ---
export const createReviewSchema = z.object({
  guestId: uuidSchema.optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1500).optional(),
  tags: z.array(z.string().max(40)).max(10).default([]),
});

export const miniGameSubmitSchema = z.object({
  gameType: z.string().min(1).max(48).default('SPICE_QUIZ'),
  playerNickname: z.string().min(1).max(80),
  score: z.number().int().nonnegative(),
});

// --- Floor Operations ---
export const tableOperationSchema = z.object({
  operation: z.enum(['MERGE', 'TRANSFER', 'SPLIT', 'RESET', 'ROTATE_QR', 'MOVE']),
  targetTableId: uuidSchema.optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
});

// --- Inventory & Recipes ---
export const inventoryAdjustSchema = z.object({
  inventoryItemId: uuidSchema,
  deltaQty: z.number(),
  reason: z.string().max(200).optional(),
});

// --- RBAC & Staff ---
export const staffPinVerifySchema = z.object({
  outletId: z.string().optional(),
  pin: z.string().min(4).max(8),
  userId: uuidSchema.optional(),
});

export const permissionOverrideSchema = z.object({
  userId: uuidSchema,
  permissionKey: z.string().min(2).max(120),
  effect: z.enum(['GRANT', 'DENY']),
});

// --- Shift Register & Analytics ---
export const openShiftSchema = z.object({
  outletId: uuidSchema,
  openingFloatMinor: minorAmountSchema,
  notes: z.string().max(500).optional(),
});

export const closeShiftSchema = z.object({
  shiftId: uuidSchema,
  actualCashMinor: minorAmountSchema,
  pettyCashMinor: minorAmountSchema.default(0),
  notes: z.string().max(500).optional(),
});

export const analyticsLiveQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// --- Offline Delta Sync ---
export const syncDeltaSchema = z.object({
  outletId: uuidSchema,
  clientId: z.string().min(4).max(80),
  mutations: z
    .array(
      z.object({
        idempotencyKey: z.string().min(8).max(128),
        kind: z.enum(['PLACE_ORDER', 'KDS_STATUS', 'SERVICE_REQUEST_CLAIM']),
        payload: z.record(z.string(), z.unknown()),
        queuedAt: z.string().datetime(),
      }),
    )
    .max(100),
});
