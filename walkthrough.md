# PlateBeam — Implementation & Verification Walkthrough

**PlateBeam** is an end-to-end, multi-tenant cloud Restaurant Management & QR Ordering SaaS platform built from the ground up according to [Complete End-to-End SRS_ Restaurant Management & QR Ordering Software.md](file:///home/syed/Workspace/PlateBeam/Complete%20End-to-End%20SRS_%20Restaurant%20Management%20%26%20QR%20Ordering%20Software.md) (`FR-001`–`FR-036`, `NFR-001`–`NFR-010`).

The system uses **Next.js 16 (`16.4.6`) App Router**, **Supabase PostgreSQL** (with `FORCE ROW LEVEL SECURITY`), and a clean **hexagonal Ports & Adapters architecture** designed for zero-friction migration to **MySQL 8+** (`DB_DIALECT=mysql`).

---

## 1. Architecture & Portability Highlights

### Hexagonal Ports & Adapters
All domain logic and API routes are strictly decoupled from vendor SDKs:
- **Database (`src/server/db/`):** Unified entity models across [PostgreSQL schema](file:///home/syed/Workspace/PlateBeam/src/server/db/schema/pg/index.ts) and [MySQL 8+ schema](file:///home/syed/Workspace/PlateBeam/src/server/db/schema/mysql/index.ts) (26 tables, `BIGINT` minor currency units, app-generated `crypto.randomUUID()` PKs, composite indexes).
- **Repositories (`src/server/ports/repositories.port.ts`):** Implemented in [Drizzle repository adapter](file:///home/syed/Workspace/PlateBeam/src/server/adapters/drizzle/repositories.adapter.ts) supporting both `DB_DIALECT=postgres` (with `SET LOCAL app.tenant_id`) and `DB_DIALECT=mysql` (with explicit `WHERE tenant_id = ?` filtering).
- **Auth (`AuthPort`):** [Supabase SSR adapter](file:///home/syed/Workspace/PlateBeam/src/server/adapters/supabase/auth.adapter.ts) with `getClaims()` and POS PIN verification, swappable with [Portable JWT/Scrypt adapter](file:///home/syed/Workspace/PlateBeam/src/server/adapters/portable/jwt-auth.adapter.ts) for self-hosted/MySQL deployments.
- **Realtime (`RealtimePort`):** [Supabase Realtime Broadcast adapter](file:///home/syed/Workspace/PlateBeam/src/server/adapters/supabase/realtime.adapter.ts) swappable with [Portable SSE adapter](file:///home/syed/Workspace/PlateBeam/src/server/adapters/portable/sse-realtime.adapter.ts) streaming over `/api/v1/realtime/stream`.
- **Payments (`PaymentPort`):** Concrete adapters for **SSLCommerz v4** (Session init, IPN verifier, refund), **Stripe**, **Razorpay**, **Cash/EDC**, and an interactive **Sandbox Simulator** that runs when gateway API keys are not yet configured.
- **Dependency Injection Container:** [src/server/container.ts](file:///home/syed/Workspace/PlateBeam/src/server/container.ts) resolves active adapters based on environment variables.

---

## 2. Live Supabase Project & Migrations

A fresh Supabase project was automatically provisioned in organization `syed-reza98`:
- **Project Ref:** `bvvxjghfyckzsayepclu` (`ap-southeast-1`)
- **Status:** `ACTIVE_HEALTHY`
- **Migrations Applied:**
  1. [0001_schema.sql](file:///home/syed/Workspace/PlateBeam/supabase/migrations/0001_schema.sql): 26 tables (`tenants`, `outlets`, `roles`, `users`, `user_permission_overrides`, `floor_zones`, `dining_tables`, `kitchen_stations`, `menu_categories`, `tax_slabs`, `menu_items`, `item_variants_modifiers`, `upsell_rules`, `guests`, `table_sessions`, `orders`, `order_items`, `service_requests`, `invoices`, `payments`, `reviews`, `mini_game_sessions`, `inventory_items`, `menu_item_recipes`, `audit_logs`, `shift_registers`).
  2. [0002_rls_policies.sql](file:///home/syed/Workspace/PlateBeam/supabase/migrations/0002_rls_policies.sql): `ENABLE` + `FORCE ROW LEVEL SECURITY` on all 26 tables using RESTRICTIVE `tenant_isolation_policy` checking `current_app_tenant_id()` (`SECURITY INVOKER`).
- **Security Audit:** `get_advisors(security)` returned **0 lints** (clean security profile).

---

## 3. Implemented Surfaces & Core Features

### 1. Guest Zero-App QR Portal (`/t/[qrToken]`)
- **Route:** [src/app/t/[qrToken]/page.tsx](file:///home/syed/Workspace/PlateBeam/src/app/t/[qrToken]/page.tsx) + [GuestPortalClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/guest/GuestPortalClient.tsx)
- Mobile-first responsive UI (`320px+` safe, `100dvh`, bottom thumb-zone cart bar, 44×44px touch targets).
- **Interactive Menu & Modifiers:** Real-time search, allergen warning badges, dietary pills, spice-level selector, portion modifiers, upsell recommendations.
- **Collaborative Cart & Running Tab:** Real-time multi-guest shared cart and multi-round ordering history.
- **Wait Experience:** Station-derived cook countdown timer, 1-tap Guest Wi-Fi password copy and QR card, Loyalty points badge, and live **Spice Quiz** mini-game with daily leaderboard and reward coupon generator.
- **Call Waiter & Split Bill:** Persistent 1-tap service requests with cooldown timer, 3-mode split bill (Equal with Hamilton largest-remainder integer distribution, By Item, Custom Amount), pre-tax tip pooling, multi-rail checkout, and post-meal 5-star review routing.

### 2. FOH Floor Map & Assisted POS (`/pos/[outletSlug]`)
- **Route:** [src/app/pos/[outletSlug]/page.tsx](file:///home/syed/Workspace/PlateBeam/src/app/pos/[outletSlug]/page.tsx) + [PosFloorClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ops/PosFloorClient.tsx)
- Fast 4-digit staff PIN switcher (`verifyPosPin`).
- Interactive color-coded floor map across zones (Vacant, Ordering, Eating, Bill Requested, Call Waiter alert with Web Audio synthesizer chime).
- Table operations modal (Merge, Split, Transfer, Reset, Rotate QR).
- Cashier Shift Register management (opening float, expected vs actual cash reconciliation, Z-Report generator).

### 3. Kitchen Display System (`/kds/[outletSlug]`)
- **Route:** [src/app/kds/[outletSlug]/page.tsx](file:///home/syed/Workspace/PlateBeam/src/app/kds/[outletSlug]/page.tsx) + [KdsConsoleClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ops/KdsConsoleClient.tsx)
- Scoped Obsidian Charcoal theme (`#111315`, `color-scheme: only dark`).
- Station filtering tabs (All, Tandoor, Curry, Drinks, etc.).
- High-contrast ticket cards with tabular `JetBrains Mono` elapsed timers (Green On-Time → Amber >75% SLA → Pulsing Crimson Overdue).
- 48×48px+ touch targets and keyboard bump-bar shortcuts (`1`–`9`, `Space`, `R` recall last bumped ticket).
- Web Audio chime on incoming KOT tickets and offline IndexedDB fallback.

### 4. Owner Command Center & Super-Admin (`/dashboard` & `/admin`)
- **Owner Dashboard:** [src/app/dashboard/page.tsx](file:///home/syed/Workspace/PlateBeam/src/app/dashboard/page.tsx) + [OwnerDashboardClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ops/OwnerDashboardClient.tsx)
  - Live revenue and operational KPI cards.
  - Menu catalog management with instant 86 toggle.
  - Recipe BOM inventory tracking with low-stock alerts.
  - 3-layer RBAC matrix (`Role Defaults + Explicit Grants - Explicit Denials`) with audit logs.
  - Menu Engineering quadrant analysis (Stars, Plowhorses, Puzzles, Dogs) and CSV report exports.
- **Super-Admin Platform Portal:** [src/app/admin/page.tsx](file:///home/syed/Workspace/PlateBeam/src/app/admin/page.tsx) + [SuperAdminClient.tsx](file:///home/syed/Workspace/PlateBeam/src/components/ops/SuperAdminClient.tsx)
  - Multi-tenant onboarding, tenant status management, subscription tier control.

### 5. Offline IndexedDB Queue & Print Daemon
- **Offline Sync:** [src/lib/offline/db.ts](file:///home/syed/Workspace/PlateBeam/src/lib/offline/db.ts) and [sync-manager.ts](file:///home/syed/Workspace/PlateBeam/src/lib/offline/sync-manager.ts) using `idb` and `navigator.storage.persist()`, automatically replaying mutations against `/api/v1/sync/delta`.
- **Print Bridge:** [scripts/print-bridge.ts](file:///home/syed/Workspace/PlateBeam/scripts/print-bridge.ts) polls `/api/v1/print-bridge/jobs` and streams raw ESC/POS byte buffers (58mm/80mm thermal receipts, KOTs, RJ11 drawer kick pulse) over TCP port 9100.

---

## 4. Verification & Build Results

All automated checks passed with zero errors:

```bash
# 1. Typecheck
npm run typecheck
> tsc --noEmit
# Exit code 0 (0 errors)

# 2. Lint
npm run lint
> eslint src
# Exit code 0 (0 errors, 0 warnings)

# 3. Financial & Security Unit Tests
npm run test
> vitest run
✓ tests/billing.test.ts (4 tests) - Hamilton remainder distribution, pre-tax tipping, exact minor units
✓ tests/rbac.test.ts (1 test) - 3-layer RBAC resolution (DENY strictly wins over GRANT)
✓ tests/qr-security.test.ts (1 test) - HMAC-SHA256 token verification and anti-tamper rejection
Test Files  3 passed (3)
Tests  6 passed (6)

# 4. Production Build (Next.js 16.4.6 Turbopack)
npm run build
> next build
▲ Next.js 16.4.6 (Turbopack)
✓ Compiled successfully in 1.4s
✓ Collecting build traces
✓ Finalizing page optimization
All 48 routes compiled cleanly (Static, Dynamic, Partial Prerendered ◐)
```

---

## 5. Getting Started & Testing

1. **Seed Demo Restaurant ("Zaika Bistro"):**
   ```bash
   npm run db:seed
   ```
   This creates demo tenant `zaika-bistro`, 1 outlet (`downtown`), 4 floor zones, 6 tables with valid signed QR tokens, 4 kitchen stations, 12 menu items with modifiers, upsell rules, BOM recipes, inventory items, and 4 staff roles with PINs:
   - **Owner:** PIN `1234`
   - **Captain:** PIN `2222`
   - **Cashier:** PIN `3333`
   - **Chef:** PIN `4444`

2. **Launch Dev Server:**
   ```bash
   npm run dev
   ```

3. **Explore Surfaces:**
   - **Guest QR Experience:** `http://localhost:3000/t/<generated-qr-token>`
   - **FOH Floor Map & POS:** `http://localhost:3000/pos/downtown`
   - **Kitchen Display System:** `http://localhost:3000/kds/downtown`
   - **Owner Command Center:** `http://localhost:3000/dashboard`
   - **Platform Super-Admin:** `http://localhost:3000/admin`
   - **OpenAPI 3.1 Spec:** `http://localhost:3000/api/v1/openapi.json`
