# PlateBeam UI/UX Design Differences Report

**Comparison Scope:**
- **Design Prototype:** `PlateBeam_OS___Live_Restaurant_Operating_System.html` (2,415-line interactive single-file OS prototype, visually inspected and tested across 85 browser interactions at `1440×900` and `780×661`)
- **Existing Codebase:** `src/` (Next.js 16 App Router implementation + `DESIGN.md` *"Control Tower Dispatch Overlook"* design system)

---

## 1. Executive Summary

While both the HTML prototype and the `src/` codebase implement the same core domain (**PlateBeam** multi-tenant Restaurant OS, QR ordering, FOH POS, KDS, Owner BI, and RBAC), they diverge sharply in **visual identity**, **application architecture**, **workspace density**, and **several surface-level features**:

1. **Aesthetic & Brand Identity:** The HTML prototype uses an **Obsidian & Safety-Orange (`#09090B` / `#FF5412`)** high-contrast dark command aesthetic paired with a **Warm Cream (`#FAF7F2`)** mobile guest surface, **Inter + JetBrains Mono**, and generous `rounded-2xl` / `rounded-3xl` cards. In contrast, `src/` implements the **Control Tower Dispatch Overlook** (`DESIGN.md`) palette: **Night-Apron Slate (`#0B1220` / `#E7EEF8` `light-dark()`)** with **Electric Cyan/Teal (`#3DE0C5` / `#0F9F8A`)** accents, **Teko + Karla + Share Tech Mono**, and squared **`rounded-sm`** chassis geometry.
2. **Information Architecture:** The HTML prototype is a **Unified Single-Page OS Shell** with a persistent top command header (Outlet Switcher, Role Switcher, Split View toggle, Offline Simulator, Sound toggle) and a **docked `Live Guest Phone` simulator** on the right (`xl:col-span-4`) that updates in real time alongside POS/KDS/BI tabs. The `src/` codebase splits each surface into **dedicated Next.js routes** (`/`, `/login`, `/t/[qrToken]`, `/pos/[outletSlug]`, `/kds/[outletSlug]`, `/dashboard`, `/admin`) with no live split-screen phone simulator.
3. **Feature & Data Visualization Gaps:** Each version has capabilities missing in the other. The HTML prototype includes an **Hourly Revenue Bar Chart**, **Payment Mix stacked bar**, **Shift Z-Report card**, **Guest Reviews & Service Recovery Queue**, **`+ Add Menu Item` modal**, **ESC/POS 80mm Thermal KOT & GST Invoice preview modals**, and an **interactive Offline Wi-Fi Outage Simulator**. Conversely, `src/` includes **Landing (`/`) & PIN/Email Login (`/login`)**, **Platform Super-Admin (`/admin`)**, **4-Quadrant Menu Engineering Matrix (Stars/Plowhorses/Puzzles/Dogs)**, **POS Drag-and-Drop Floor Layout Editor**, **Takeaway Token issuance**, **KDS keyboard shortcuts (`1–9`, `Space`, `R`) + Companion Stations + Manager PIN cancel**, **3-mode Split Bill (`EQUAL`, `BY_ITEM`, `CUSTOM`)**, **Tax Slabs & Upsell Rules tables**, and **WCAG/Popover accessibility primitives**.

---

## 2. Design System & Visual Token Differences

| Dimension | HTML Prototype (`PlateBeam_OS...html`) | Existing `src/` Codebase (`globals.css` & `DESIGN.md`) |
| --- | --- | --- |
| **Design Metaphor** | **Obsidian SaaS Command + Warm Cream Dining** | **Control Tower Dispatch Overlook** (cool night glass over lit apron) |
| **Theme Support** | Operations shell is **dark-only** (`#09090B`); Guest phone is **light-only** (`#FAF7F2` cream). | Full **adaptive `light-dark()`** via `meta[name="color-scheme"]` + `ThemeToggle.tsx` across all surfaces except KDS (dark-first `#070D18`). |
| **Canvas & Surface** | `obsidian` `#09090B`, `carbon` `#111115`, `graphite` `#18181F`, `cream` `#FAF7F2` | Light: `#E7EEF8` / `#F4F7FC` / `#FFFFFF` • Dark: `#0B1220` / `#121A2B` / `#1A2740` |
| **Primary Accent** | **Beam Orange** (`#FF5412`, hover `#FF7033`, soft `#FFF4ED`) | **Dispatch Cyan / Teal** (Light `#0F9F8A`, Dark `#3DE0C5`) |
| **Semantic Colors** | Emerald (`#10B981`), Sky (`#0EA5E9`), Amber (`#F59E0B`), Red (`#EF4444`) | `--pb-olive` (`#1F7A4D` / `#3DCE7F`), `--pb-gold` / `--pb-turmeric` (`#C47D00` / `#F0A202`), `--pb-chili` (`#C23434` / `#D64545`) |
| **Typography** | **Inter** (sans, 400–900) + **JetBrains Mono** (mono) | **Teko** (`--font-display`, condensed callsigns) + **Karla** (`--font-sans`) + **Share Tech Mono** (`--font-mono`) |
| **Border Radius** | Soft & pill-heavy: `rounded-3xl` panels, `rounded-2xl` cards, `rounded-xl` buttons, `rounded-[2.6rem]` phone bezel | Squared chassis: `rounded-sm` on panels/strips/buttons, `rounded-xl` / `rounded-2xl` on select modals & KDS cards |
| **Background Texture** | `.grid-bg` (`36px × 36px`, `rgba(255,255,255,0.03)`) inside Floor Map container | `.tower-field` (`48px × 48px` cyan-tinted grid + diagonal `--pb-glass-sheen`) across entire page canvases + `.led-rail` top bar |
| **Motion & Effects** | `.animate-halo` on Call Waiter button, `animate-ping` on live/alert dots, `.thermal-receipt` serrated edge | `.led-pulse` on brand badge, `.tower-scan` vertical sweep on hero, `@starting-style` native `<dialog>` transitions, `prefers-reduced-motion` support |
| **Iconography** | Emoji-first (`🗺️`, `🔥`, `📱`, `🍽️`, `📊`, `🔐`, `🔔`, `🖨️`) + custom inline SVG logo | **Lucide React** vector icons (`lucide-react`) throughout all UIs; `PB` typographic monogram badge |
| **Audio Engine** | **Tone.js** (`Tone.PolySynth` loaded via CDN) with header mute toggle (`🔊`/`🔇`) | Web Audio API `playAlertChime()` in `src/lib/ops/format.ts` with KDS-local `Volume2`/`VolumeX` toggle |

---

## 3. Navigation, Shell & Global Controls

| Feature / Pattern | HTML Prototype | `src/` Codebase |
| --- | --- | --- |
| **Application Shell** | Single unified workspace shell (`max-w-[1600px]`) with sticky header + 5-tab (6-tab on `<xl`) ribbon. | Independent Next.js pages (`max-w-6xl` on `/`, `max-w-7xl` on ops, `max-w-3xl` on guest) linked via `channel-strip` home page and per-page header links. |
| **Live Split View** | **`◫ Live Split View: ON/OFF`** docks the interactive `Live Guest Phone` beside Floor/KDS/Menu/BI/RBAC (`8 cols + 4 cols`) on `xl` screens. | **Not present.** Guest Portal (`/t/[qrToken]`) and Staff consoles (`/pos`, `/kds`, `/dashboard`) are separate browser routes/tabs. |
| **Outlet Switcher** | Header `<select>` switches live between `Zaika • Main Flagship` (`zaika-flagship • RLS ON`) and `Zaika Express • QSR` (`QSR Mode`). | Outlet is bound to URL param (`/pos/[outletSlug]`, `/kds/[outletSlug]`); no global outlet switcher dropdown in headers. |
| **Role Switcher** | Header `<select>` (`OWNER`, `CAPTAIN`, `CHEF`, `CASHIER`) live-enforces RBAC across UI actions (e.g., blocking `CHEF` from `Rotate QR`). | No role switcher dropdown in header; uses real PIN/Email auth (`/login`) and a `Switch Staff PIN` modal inside POS (`PosFloorClient.tsx`). |
| **Offline Mode** | Interactive **Offline Simulator button (`Online`/`Offline`)** in header; triggers top amber banner (`OFFLINE RESILIENCE MODE ACTIVE`), queues guest orders in state, and provides `Reconnect & Delta-Sync →`. | Real IndexedDB + `syncManager` (`OfflineBanner.tsx`) that automatically detects browser offline/queued mutations with `Sync Delta Now` button (no manual outage simulator button). |
| **Toast Notifications** | Fixed `bottom-4 right-4` stack (`#toast-root`). *Visual friction observed at `1440×900`:* toasts can overlap the bottom nav bar of the docked Guest Phone. | Accessible `ToastRegion.tsx` using HTML Popover API (`popover="manual"` + `@oddbird/popover-polyfill`), `ariaNotify` / live region announcements, pause-on-hover, and focus restoration. |

---

## 4. Surface-by-Surface Detailed Differences

### 4.1 Landing & Authentication (`/`, `/login`)
- **HTML Prototype:** **Absent.** Opens directly into the live OS workspace (`Floor Map & POS` + `Live Guest Phone`).
- **`src/` Codebase:**
  - `src/app/page.tsx`: Persuasive Control Tower landing page with `.tower-scan` hero, `Open Guest Channel` / `Staff Console` CTAs, and 5 numbered `.channel-strip` rows (`CH-01` through `CH-05`).
  - `src/components/auth/LoginClient.tsx`: Dual-tab **PIN Keypad** (`1234`, `2222`, `3333`, `4444` quick-fill demo staff cards) and **Email/Password** authentication backed by `/api/v1/auth/pin` and `/api/v1/auth/session`.

---

### 4.2 Guest QR Portal (`/t/[qrToken]` vs. `Live Guest Phone` Simulator)

| Area | HTML Prototype | `src/` Codebase (`src/components/guest/*`) |
| --- | --- | --- |
| **Visual Frame & Surface** | Rendered inside a `395px` iPhone-style bezel with Dynamic Island (`pb_t5_9xK4` token badge), `640px` scrollable viewport, warm `#FAF7F2` cream background, and white rounded-2xl cards. | Full-viewport responsive web app (`max-w-3xl`) inheriting `light-dark()` Tower tokens (`--pb-canvas`, `--pb-surface`, `rounded-sm`). |
| **Guest Identity & Table Switcher** | Simulator bar above phone lets operators switch `QR: Table 1`–`Table 6` and toggle diner (`👤 Aman` ↔ `👤 Riya`) to test shared cart attribution. | Single table bound to signed JWT `qrToken` in URL; diner nickname auto-generated (`Diner-XXX`) in `localStorage`. |
| **Navigation Architecture** | **5-tab bottom navigation** inside phone: `🍽️ Menu`, `🛒 Cart` (with badge), `⏱️ Wait`, `🔔 Help`, `💳 Bill`, plus top-right `🔔 Call` button. | **Aligned:** cream guest shell now uses Dock **5-tab bottom nav** (`Menu` / `Cart` / `Wait` / `Help` / `Bill`) with sticky header Call shortcut (`GuestPortalClient.tsx`). |
| **Menu & Spotlight** | Search input + `● Veg` toggle + horizontal category pills + **`⚡ Combo Deal` upsell banner** (`Mango Lassi ₹99`). Dish cards use emoji thumbnails, Veg/Non-Veg dot indicator, spice/prep metadata, and `+ Customize`. | `MenuBrowser.tsx` adds a **16:9 / 21:9 `Chef's Spotlight` hero image card**, **7 dietary filter pills** (`All`, `Veg`, `Non-Veg`, `Vegan`, `Gluten-Free`, `Jain`, `Egg`), allergen search, and real `<Image>` dishes. |
| **Dish Customization & Upsell** | Slide-up **bottom sheet** inside phone (`#guest-customize-sheet`) with Portion Size (`Half -35%`/`Full`), Spice Level, Add-ons, Kitchen Note, and Allergen warning. | Native `<dialog>` (`ItemModifierDialog.tsx`) + dedicated **`PairingUpsellDialog.tsx`** triggered after adding a matching item to cart. |
| **Wait Experience & Gamification** | Inline in `⏱️ Wait` tab: dark `Live KDS Sync` countdown card, item status list, `Free Wi-Fi` copy card, `Rewards` progress bar (`200 pts` → `Redeem ₹99` voucher), and **inline `🎮 Spice Quiz`** with live `T5 vs T2` score. | `WaitExperienceCard.tsx` + `OrderTabTracker.tsx` in `Table Tab`: Kitchen Countdown, Guest Wi-Fi card, Loyalty tier card, and a button opening **`SpiceQuizDialog.tsx`** (modal with leaderboard). |
| **Call Waiter** | Dedicated `🔔 Help` tab with pulsing orange circular **`Call Waiter`** button (`.animate-halo`) + 4 quick chips (`Water`, `Napkins`, `Cutlery`, `Request Bill`). | `CallWaiterDialog.tsx` modal triggered from header/bottom bar. |
| **Split Bill, Payment & Review** | Dedicated `💳 Bill` tab: **2 split modes** (`Split Equally 1x–4x` vs `Split by Item` checkboxes), Tip (`0/5/10/15%`), 4 payment buttons (`UPI`, `Apple Pay`, `Card`, `Cash`), inline `View GST Receipt 🧾` thermal modal, and inline 5-star review routing. | `SplitBillCheckoutDialog.tsx` modal: **3 split modes** (`Split Equal` 1/2/3/4/6 + individual share selector, `By Item`, `Custom` amount) + `ReceiptReviewDialog.tsx` modal for GST receipt & review submission. |
| **QR Rotation Security Screen** | When POS rotates a table's QR, Guest Phone immediately locks into a **`🔐 QR Session Rotated`** screen with `📷 Scan Fresh Table QR` button. | Handled via API token validation on bootstrap/refresh; no dedicated inline "QR Rotated" simulator screen. |
| **Currency** | Hardcoded **INR (`₹`)** (`fmtINR`). | Dynamic currency (`formatMoney(..., currency)`, defaulting to `BDT` in demo). |

---

### 4.3 FOH Floor & POS (`/pos/[outletSlug]` vs. `Floor Map & POS` Tab)

| Area | HTML Prototype | `src/` Codebase (`PosFloorClient.tsx`) |
| --- | --- | --- |
| **Layout** | **2-column split**: Left `Live Floor Map` (7 cols) + Right **`Table Inspector` panel** (5 cols) always visible. | **2-column split**: Left `Live Floor Map` (`1fr`) + Right **Pending Approvals & Service Requests Queue** (`340px`). Table actions live inside cards or modals. |
| **Floor Map & Zones** | Zones: `All Zones`, `Main Hall`, `Patio` (6 tables `T1`–`T6`). Includes **`Kitchen Pass & Bar Counter`** spatial landmark header. | Zones: `All Zones`, `Main Hall`, `Patio`, `VIP`, `Bar`. Supports **`Edit Floor Layout` drag-and-drop** coordinate repositioning (`posX`, `posY`). |
| **Table Statuses** | 5 states: `AVAILABLE`, `ORDERING`, `EATING`, `BILL`, `HELP` (red pulse). | 6 states: `VACANT`, `ORDERING`, `EATING`, `CALLING_WAITER`, `BILL_REQUESTED`, `CLEANING` (`Cleaning / Turn`). |
| **POS Actions** | `Captain Approval: ON/OFF` toggle, `+ Waiter POS Order` modal, and Inspector buttons: `🔐 Rotate QR`, `🧾 Print Bill` (ESC/POS modal), `📱 Open on Phone`, `Clear Table`, `✓ Claim & Mark Resolved`. | `Switch Staff PIN` modal, **`Issue Token #`** (counter/takeaway QSR token modal), **`Shift & Z-Report`** modal, `Edit Floor Layout` toggle, plus per-table QR rotation, approval, and settlement. |

---

### 4.4 Kitchen Display System (`/kds/[outletSlug]` vs. `Kitchen KDS` Tab)

| Area | HTML Prototype | `src/` Codebase (`KdsConsoleClient.tsx`) |
| --- | --- | --- |
| **Layout** | **Fixed 3-column station board** (`🔥 Tandoor`, `🥘 Curry & Mains`, `🍹 Drinks & Cold`) showing all stations simultaneously. | **Station filter tabs** (`ALL`, `Tandoor`, `Curry`, `Drinks`, `Bar`) above a responsive 3-column ticket grid (`sm:grid-cols-2 lg:grid-cols-3`). |
| **Header & Controls** | `ESC/POS Bridge Active` badge, live `HH:MM:SS` clock, `↩ Recall Last`, and **`+ Simulate Rush KOT`** button. | Station filter pills, `Sound On/Off` toggle, `Recall Last`, keyboard shortcut hint (`bump 1–9 · space · R recall`), and `OfflineBanner` (`variant="kds"`). |
| **Ticket Lifecycle** | 2-step flow per ticket: `COOKING` (`Mark Ready ✓`) → `READY` (`Bump Served →`). | 5-step per-item status (`PENDING` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED` / `CANCELLED`) + whole-ticket `Bump Ticket (Key N)` button. |
| **SLA & Safety Details** | Timer badge escalates (`<55%` neutral, `55–85%` amber, `≥85%` red pulse). Includes **`🖨️` thermal KOT print preview** button per ticket. | Adds **visual SLA progress bar**, **Allergen warning pill** (`ALLERGY: ...`), **Companion Stations** indicator (`Companion: Bar, Curry`), and **Manager PIN required dialog** to cancel `PREPARING` items. |

---

### 4.5 Owner BI, Menu & Inventory, RBAC & Audit (`/dashboard` vs. 3 Separate OS Tabs)

In the HTML prototype, Owner capabilities are split across **3 top-level OS tabs** (`Menu & Inventory`, `Owner BI & Shift`, `RBAC & Audit`). In `src/`, they are consolidated into **`/dashboard`** (`OwnerDashboardClient.tsx`) with **5 sub-tabs** (`OVERVIEW`, `MENU_86`, `INVENTORY`, `RBAC_AUDIT`, `SECURITY_TAX`):

| Feature | HTML Prototype | `src/` Codebase (`OwnerDashboardClient.tsx`) |
| --- | --- | --- |
| **KPIs & Charts** | 4 KPI cards + **Hourly Service Revenue Bar Chart** (`5p`–`Now`) + **Payment Mix stacked bar** (`UPI` / `Cards` / `Cash`). | 4–5 KPI cards (`Table Occupancy`, `Live Orders`, `Net Sales`, `AOV`, `Avg Turnover`, `KDS SLA On-Time %`). **No hourly bar chart or visual payment-mix bar** in `OwnerDashboardClient.tsx`. |
| **Menu Engineering** | Not present. | **4-Quadrant Menu Engineering Matrix** (`Stars`, `Plowhorses`, `Puzzles`, `Dogs`) with unit sales and margin calculations. |
| **Shift & Z-Report** | Dedicated **`Shift Register & Z-Report` panel** (`SHIFT #14 OPEN`, opening float, cash/digital breakdown, expected cash drawer, `Export End-of-Day Z-Report ↓`). | Shift & Z-Report lives inside **FOH POS** (`PosFloorClient.tsx` modal); Dashboard has top-right `Export CSV` button. |
| **Reviews & Recovery** | **`Guest Reviews & Service Recovery Queue`** grid showing 1–5★ reviews and routing status (`Google Reviews` vs `Manager Alert`). | Review submission exists in `ReceiptReviewDialog.tsx`, but **no Reviews & Service Recovery feed** is rendered on `/dashboard`. |
| **Menu & 86 Management** | Side-by-side with BOM Inventory; includes **`+ Add Menu Item` modal** to publish new dishes live. | Dedicated `MENU_86` `ResponsiveTable` tab with 86 toggle. **No `+ Add Menu Item` UI modal** in `OwnerDashboardClient.tsx`. |
| **BOM Inventory** | Progress-bar cards with low-stock threshold alerts and **`Restock All`** button. | `INVENTORY` `ResponsiveTable` with `-1` and `+5` per-ingredient stock adjustment buttons. |
| **RBAC Matrix** | Interactive per-permission `+Grant` / `−Deny` toggles that immediately recompute against the active header role (`OWNER`/`CAPTAIN`/`CHEF`/`CASHIER`). | `RBAC_AUDIT` tab with **Staff Member `<select>`** + `GRANT`/`DENY` buttons + `ResponsiveTable` of `DashboardAuditLog`. |
| **QR Policies & Tax** | 4 simple `ON`/`OFF` policy switches (`Signed Opaque QR URLs`, `Captain Approval`, `100m Geofence`, `Pay-First Takeaway`). | `SECURITY_TAX` tab with checkboxes + **numeric inputs** (`Max Geofence Radius`, `Max Unpaid QR Orders`, `Call Waiter Cooldown`) + **Outlet Tax Slabs** & **Upsell Pairing Rules** tables. |
| **Audit Stream** | Live Socket.IO-style colored log stream (`time`, `actor`, `room`, `msg`). | Structured `ResponsiveTable` (`Actor`, `Action`, `Details`, `Timestamp`). |

---

### 4.6 Platform Super-Admin (`/admin`)
- **HTML Prototype:** **Absent** (only an Outlet Switcher and `tenant: zaika-flagship • RLS ON` badge in the top header).
- **`src/` Codebase (`SuperAdminClient.tsx`):** Dedicated `/admin` route with tenant search, `Provision Tenant` dialog (`name`, `slug`, `plan`, `currency`, `initialOutletName`), GMV/outlet/table counts, and `ACTIVE`/`SUSPENDED` status toggling.

---

## 5. UX Friction & Accessibility Audit

1. **Accessibility & Semantic HTML:**
   - `src/` uses native `<dialog>` with `@starting-style` transitions (`Dialog.tsx`), Popover API `ToastRegion.tsx` with screen-reader announcements, `role="tablist"` / `aria-selected` / `aria-pressed`, `min-h-11` (`44px`) coarse pointer targets, and `ResponsiveTable.tsx`.
   - The HTML prototype uses `<div>` overlays for modals, `onclick` handlers on `<button>`s without `aria-pressed`/`role="tab"`, and emoji-only icon buttons (`🔊`, `🖨️`) without `aria-label`s.
2. **Toast Occlusion (Observed in Browser):**
   - In the HTML prototype at `1440×900`, bottom-right toasts (`#toast-root`) occasionally overlap the bottom 5-tab navigation bar of the docked `Live Guest Phone`.
3. **State Isolation:**
   - In the HTML prototype, `DB.tipPercent` is global rather than per-table, causing tip selections on one table to persist when switching to another in the simulator. `src/` scopes checkout state cleanly per `SplitBillCheckoutDialog` session.

---

## 6. Recommended Alignment Actions (Gap Closure)

If the goal is to bring the `src/` production codebase closer to the interactive richness of `PlateBeam_OS___Live_Restaurant_Operating_System.html` (while preserving `src/`'s `DESIGN.md` Control Tower tokens and accessibility):

1. **Add Missing Owner BI Visualizations to `/dashboard`:** Port the **Hourly Service Revenue Bar Chart**, **Payment Mix stacked bar**, and **Guest Reviews & Service Recovery Queue** into `OwnerDashboardClient.tsx` (`OVERVIEW` tab).
2. **Add `+ Add Menu Item` Modal to `MENU_86`:** Allow owners to create new dishes directly in `OwnerDashboardClient.tsx`, matching the HTML prototype's `Add Dish to Live Menu` workflow.
3. **Add ESC/POS Thermal Preview Modal to POS & KDS:** Surface `src/server/core/escpos.service.ts` visually in `PosFloorClient.tsx` and `KdsConsoleClient.tsx` with a serrated-edge thermal preview modal like the HTML prototype's `#modal-thermal`.
4. **Optional Demo / Training Split-View Route:** Consider a `/demo` or `/simulator` route that embeds `/pos` alongside a `395px` `/t/[qrToken]` iframe for sales demos without altering production routes.
5. **Unify Design Direction Decision:** Explicitly decide whether to keep `src/`'s **Control Tower Cyan/Slate (`#3DE0C5` / `#0B1220`, Teko/Karla, `rounded-sm`)** system from `DESIGN.md` or adopt the HTML prototype's **Obsidian/Beam-Orange (`#FF5412` / `#09090B`, Inter/JetBrains Mono, `rounded-2xl`)** palette—currently the two are completely different visual brands.
