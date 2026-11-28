# PlateBeam OS Full Upgrade — Walkthrough

## Summary of Changes

All components from [implementation_plan.md](file:///home/syed/.gemini/antigravity/brain/ada7640c-289e-4ed1-937d-7c117755352e/implementation_plan.md) were implemented in parallel by the swarm, landed on `main` (`6a924fb`), and verified with `BDT (৳)` as the demo currency and `/demo` split-view enabled.

### 1. Design System & Shared UI Primitives
- **[layout.tsx](file:///home/syed/Workspace/PlateBeam/src/app/layout.tsx) & [globals.css](file:///home/syed/Workspace/PlateBeam/src/app/globals.css):** Migrated typography to `Inter` (`400`–`900`) and `JetBrains Mono` (`400`–`700`), and updated palette tokens to **Obsidian (`#09090B`) / Carbon (`#111115`) / Graphite (`#18181F`) / Beam Orange (`#FF5412`)** for operations and **Warm Cream (`#FAF7F2`)** for Guest QR dining. Added `.grid-bg`, `.shadow-beam`, `.animate-halo`, `.thermal-receipt`, and `.ops-column-contain` (`content-visibility: auto` with `@supports not` fallback).
- **[Dialog.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ui/Dialog.tsx) & [ToastRegion.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ui/ToastRegion.tsx):** Restyled native `<dialog>` (`rounded-3xl`) with `@starting-style` + `allow-discrete` transitions and repositioned `popover="manual"` toasts (`bottom-20 sm:bottom-4 right-4`) to avoid occluding mobile bottom bars.
- **[page.tsx](file:///home/syed/Workspace/PlateBeam/src/app/page.tsx) & [LoginClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/auth/LoginClient.tsx):** Restyled Home `/` (including `CH-06` `/demo` channel strip) and PIN/Email Login `/login`.

### 2. Backend Services, APIs & Next.js 16 Caching
- **[analytics.service.ts](file:///home/syed/Workspace/PlateBeam/src/server/core/analytics.service.ts) & [live/route.ts](file:///home/syed/Workspace/PlateBeam/src/app/api/v1/analytics/outlets/[outletId]/live/route.ts):** Added `computeHourlyRevenueBuckets()` and extended `GET /api/v1/analytics/outlets/[outletId]/live` with `hourlyRevenue`, `recentReviews` (including `tableNumber` and `needsRecovery`), and `activeShift` summary (`totalOrders`, `expectedDrawerMinor`, etc.).
- **[escpos.service.ts](file:///home/syed/Workspace/PlateBeam/src/server/core/escpos.service.ts) & [kot-preview/route.ts](file:///home/syed/Workspace/PlateBeam/src/app/api/v1/kds/[outletSlug]/tickets/[orderId]/kot-preview/route.ts):** Added 80mm/58mm thermal line formatters (`formatKotPreviewLines`, `formatBillPreviewLines`) and `GET /api/v1/kds/[outletSlug]/tickets/[orderId]/kot-preview`.
- **[inventory/adjust/route.ts](file:///home/syed/Workspace/PlateBeam/src/app/api/v1/admin/inventory/adjust/route.ts):** Added `RESTOCK_ALL` batch mode with `revalidateTag('inventory', 'max')`.
- **[loyalty/redeem/route.ts](file:///home/syed/Workspace/PlateBeam/src/app/api/v1/sessions/[sessionId]/loyalty/redeem/route.ts):** Added `POST /api/v1/sessions/[sessionId]/loyalty/redeem` validating `>= 200` points, applying session `discountMinor`, writing an audit log, and publishing `session.updated`.
- **[cached-queries.ts](file:///home/syed/Workspace/PlateBeam/src/server/queries/cached-queries.ts):** Added `'use cache'` wrappers (`getCachedMenuCatalog`, `getCachedInventorySnapshot`, `getCachedAnalyticsLive`) with `cacheLife('menuCatalog' | 'analyticsLive')`, `cacheTag(...)`, and `revalidateTag(..., 'max')` invalidation in menu/availability mutations.

### 3. Customer Guest QR Portal (`/t/[qrToken]`)
- Upgraded [page.tsx](file:///home/syed/Workspace/PlateBeam/src/app/t/[qrToken]/page.tsx) and all 11 components under `src/components/guest/*` to Warm Cream (`#FAF7F2`), white `rounded-2xl` cards, Beam Orange (`#FF5412`) CTAs, `.animate-halo` Call Waiter CTA, `QR Session Rotated` recovery screen, 200-pt Loyalty Voucher Redeem in [WaitExperienceCard.tsx](file:///home/syed/Workspace/PlateBeam/src/components/guest/WaitExperienceCard.tsx) + [SplitBillCheckoutDialog.tsx](file:///home/syed/Workspace/PlateBeam/src/components/guest/SplitBillCheckoutDialog.tsx), `.thermal-receipt` styling in [ReceiptReviewDialog.tsx](file:///home/syed/Workspace/PlateBeam/src/components/guest/ReceiptReviewDialog.tsx), `min-h-dvh`, `44px` touch targets, and `clamp()` typography.

### 4. FOH POS, Kitchen KDS, Owner BI, Admin & `/demo`
- **POS & KDS ([PosFloorClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ops/PosFloorClient.tsx), [KdsConsoleClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ops/KdsConsoleClient.tsx)):** Added `Kitchen Pass & Bar Counter` spatial header, persistent Selected Table Inspector (`Rotate QR`, `Print Bill` thermal modal, `Clear Table`, `Claim & Resolve`), `+ Waiter POS Order` `<Dialog>`, KDS 3-Column Station Board toggle, Thermal KOT Preview modal, and `+ Simulate Rush KOT`.
- **Owner BI, Admin & `/demo` ([OwnerDashboardClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ops/OwnerDashboardClient.tsx), [SuperAdminClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ops/SuperAdminClient.tsx), [demo/page.tsx](file:///home/syed/Workspace/PlateBeam/src/app/demo/page.tsx), [DemoSplitClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ops/DemoSplitClient.tsx)):** Added Hourly Revenue bar chart, Payment Mix stacked bar, Shift Register & Z-Report card, Guest Reviews & Service Recovery Queue, `+ Add Menu Item` `<Dialog>`, BOM progress bars + `Restock All`, Outlet Switcher, `dashboard/loading.tsx` + `error.tsx`, and `/demo` split-view pairing Ops tabs (`xl:col-span-8`) with a docked `395px` Guest QR phone simulator (`xl:col-span-4`).

## Verification Results

All automated checks passed on `main` (`6a924fb`):
- `npm run typecheck` (`tsc --noEmit`): **passed** (0 errors)
- `npm run lint` (`eslint src`): **passed** (0 errors/warnings)
- `npm test` (`vitest run`): **passed** (9/9 tests across `tests/unit/backend-api.test.ts` and `tests/unit/core.test.ts`)
- `npm run build` (`next build` with Cache Components + Partial Prefetching): **passed** (exit 0, 30/30 static pages generated)
