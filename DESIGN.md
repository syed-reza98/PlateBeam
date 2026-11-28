# Design System — PlateBeam OS

<!-- impeccable:design-schema 1 -->

## World

**Obsidian Command + Warm Cream Dining** — PlateBeam is a dual-mode Restaurant Operating System. Back-of-house operations (FOH POS, Kitchen KDS, Menu & Inventory, Owner BI, RBAC & Audit, Super-Admin) run on a high-contrast **Obsidian & Carbon** command console with **Beam Orange** live actions, while the Guest QR Portal runs on a **Warm Cream** high-legibility dining surface.

Reference prototype: [PlateBeam_OS___Live_Restaurant_Operating_System.html](file:///home/syed/Workspace/PlateBeam/PlateBeam_OS___Live_Restaurant_Operating_System.html)
Gap specification: [DESIGN_DIFF_REPORT.md](file:///home/syed/Workspace/PlateBeam/DESIGN_DIFF_REPORT.md)

## Palette

### Operations Surfaces (`/pos/*`, `/kds/*`, `/dashboard`, `/admin`, `/login`, `/`)

| Token | Value | Role |
| --- | --- | --- |
| `--pb-canvas` (Obsidian) | `#09090B` | Page ground, grid-bg canvas, inset inputs |
| `--pb-surface` (Carbon) | `#111115` | Primary panels, cards, sticky header |
| `--pb-surface-raised` (Graphite) | `#18181F` | Elevated controls, hover states |
| `--pb-border` (Slateborder) | `#262630` / `rgba(255,255,255,0.10)` | Hairline panel & card borders |
| `--pb-ink` | `#F4F4F5` | Primary text |
| `--pb-muted` | `#A1A1AA` (Zinc 400) | Secondary text, metadata |
| `--pb-accent` (Beam 500) | `#FF5412` | Primary CTAs, live indicators, brand mark |
| `--pb-accent-hover` (Beam 400) | `#FF7033` | Hover & highlight states |
| `--pb-accent-soft` (Beam 50/300) | `#FFF4ED` / `#FFA06D` | Active badges, approval bars |
| `--pb-olive` (Emerald) | `#10B981` | Ready, In Stock, Eating, Online, ALLOW |
| `--pb-gold` / amber | `#F59E0B` | Bill Requested, 5–10m SLA warning, Offline banner |
| `--pb-sky` | `#0EA5E9` | Ordering state, Drinks KDS station, digital payment mix |
| `--pb-chili` (Red) | `#EF4444` | Help / Waiter alert, >10m SLA breach, 86'd Out, DENY |

### Guest QR Dining Surface (`/t/[qrToken]`)

| Token | Value | Role |
| --- | --- | --- |
| `--pb-guest-canvas` (Cream) | `#FAF7F2` | Warm, appetizing mobile dining background |
| `--pb-guest-surface` | `#FFFFFF` | Dish cards, cart items, bill & receipt cards |
| `--pb-guest-ink` | `#18181B` (Zinc 900) | High-legibility menu & pricing text |
| `--pb-guest-muted` | `#71717A` (Zinc 500) | Dish descriptions, secondary metadata |
| `--pb-accent` (Beam 500) | `#FF5412` | Add/Customize, Call Waiter halo, active tabs |

## Typography

- **Primary Sans:** `Inter` (`--font-sans`, weights 400–900) — headings, navigation, dish cards, UI controls
- **Tabular / Data Mono:** `JetBrains Mono` (`--font-mono`, weights 400–700) — prices, SLA timers, KOT IDs, QR tokens, RBAC keys, audit logs, ESC/POS thermal previews

## Materials & Components

- **Grid Canvas (`.grid-bg`):** Subtle `36px × 36px` `rgba(255, 255, 255, 0.03)` architectural grid behind the FOH Floor Map and command hero
- **Soft-Command Geometry:** `rounded-3xl` outer workspace cards, `rounded-2xl` inner cards/tables/tickets, `rounded-xl` buttons and inputs, `rounded-full` status & category pills
- **Elevation & Glow:** `shadow-beam` (`0 0 32px -8px rgba(255, 84, 18, 0.5)`) on primary Beam Orange CTAs and `.animate-halo` pulse on the Guest `Call Waiter` CTA
- **Thermal Receipt (`.thermal-receipt`):** Serrated-edge white 80mm monospaced receipt preview modal for KOTs and GST/VAT invoices
- **Accessibility & Production Primitives:** Native `<dialog>` with `@starting-style` transitions (`Dialog.tsx`), HTML Popover API `ToastRegion` (`ToastRegion.tsx`) positioned to avoid occluding mobile/docked bottom navigation, `44×44px` minimum coarse pointer targets, and `prefers-reduced-motion` support

## Motion

- `.animate-halo` pulse on live Call Waiter CTA; subtle `animate-ping` on live status dots and Captain Approval alerts
- Smooth modal/drawer enter (`opacity` + `translateY`)
- Honor `prefers-reduced-motion` across all animations and transitions

## Surfaces

| Route | Mode | Notes |
| --- | --- | --- |
| `/` | Persuade | PlateBeam OS landing hero + live surface channel launchpad |
| `/login` | Operate | PIN keypad & email clearance |
| `/t/[qrToken]` | Operate | Warm Cream mobile QR dining (5-tab flow: Menu, Cart, Wait, Help, Bill) |
| `/pos/[outletSlug]` | Operate | FOH Floor Map, Table Inspector, Captain Approval queue, Assisted POS, Shift/Z-Report |
| `/kds/[outletSlug]` | Operate | Dark 3-station KDS (`Tandoor`, `Curry`, `Drinks`), SLA timers, bump/recall, thermal KOT |
| `/dashboard` | Operate | Owner BI (KPIs, hourly revenue chart, payment mix, Menu Engineering), Menu/86 + Add Dish, BOM Inventory, RBAC & Audit, Reviews |
| `/admin` | Operate | Multi-tenant SaaS provisioning & status control |
| `/demo` *(optional)* | Demo | Split-view OS shell pairing Ops workspaces with docked `395px` Guest QR phone simulator |
