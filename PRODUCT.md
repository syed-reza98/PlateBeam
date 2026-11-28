# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Dine-in / takeaway guests** on mobile browsers after scanning a table or counter QR — browse menu, customize, multi-round order, wait engagement (live KDS countdown, Wi-Fi, loyalty rewards, Spice Quiz), call waiter, split & pay, review. Zero app install.
- **FOH staff (waiter, captain, cashier)** on tablets/phones — live floor map, table inspector, service alerts, captain approval, assisted POS, thermal bill preview, shift float & Z-Report.
- **Kitchen chefs / expediters** on mounted touchscreens — station-routed KOTs (`Tandoor`, `Curry`, `Drinks`, `Bar`), SLA timers, bump/recall, thermal KOT preview, allergen alerts.
- **Owners / managers** on desktop/tablet — live KPIs, hourly revenue & payment mix, menu engineering, menu builder + instant 86, BOM inventory, 3-layer RBAC & audit stream, QR anti-spoofing policies, guest review recovery.
- **Platform super-admins** — multi-tenant provisioning and status.

## Product Purpose

PlateBeam is a multi-tenant restaurant operating system that synchronizes guests, floor, kitchen, and ownership over a zero-app web stack so ordering and settlement friction drop while hospitality staff focus on guests. Success means a full dining journey (QR → order → KDS → pay → review) works on unreliable venue Wi‑Fi with exact minor-unit money and strict tenant isolation.

## Positioning

One synchronized web OS for table QR, FOH floor, station KDS, and owner BI behind a portable hexagonal `/api/v1` backend — not a single-purpose QR menu page or a desktop-only POS.

## Operating Context

- Peak dinner rush, bright/hot kitchens, shared POS tablets with PIN switch.
- Guest phones on 4G/venue Wi‑Fi; thermal 80mm ESC/POS printers via local print bridge.
- Demo venue: Zaika Bistro (Main Flagship / Express QSR), multi-currency minor-unit support (BDT / INR / USD), GST/VAT tax slabs, South Asia payment rails (UPI / MFS / SSLCommerz / Razorpay) plus global adapters (Stripe).
- Staff PINs and HMAC table QR tokens; multi-tenant Supabase Postgres with FORCE RLS (MySQL portable path).

## Capabilities and Constraints

- Surfaces: `/`, `/login`, `/t/[qrToken]`, `/pos/[outletSlug]`, `/kds/[outletSlug]`, `/dashboard`, `/admin`, and optional `/demo` split-view simulator.
- Must preserve: PlateBeam product name, existing `/api/v1` API contracts and domain services, HMAC QR security, integer minor-unit billing, 3-layer RBAC, KDS high-contrast usability in bright kitchens, offline IndexedDB delta-sync for FOH/KDS.
- Visual system: Defined in [DESIGN.md](file:///home/syed/Workspace/PlateBeam/DESIGN.md) (Obsidian & Beam Orange for operations; Warm Cream for guest QR dining).

## Brand Commitments

- Product name: **PlateBeam**.
- Demo brand content: Zaika Bistro / Zaika Express may remain as illustrative venue copy.
- Visual identity follows [DESIGN.md](file:///home/syed/Workspace/PlateBeam/DESIGN.md) and the reference prototype [PlateBeam_OS___Live_Restaurant_Operating_System.html](file:///home/syed/Workspace/PlateBeam/PlateBeam_OS___Live_Restaurant_Operating_System.html).

## Evidence on Hand

- SRS, concept video specification, implementation plan, walkthrough, `DESIGN_DIFF_REPORT.md`.
- Seed script for Zaika Bistro (tables, menu, staff PINs).
- Do not invent customer testimonials or unverified GMV claims as real production proof.

## Product Principles

1. Synchronize every role on one live table session without forcing an app download.
2. Exact money and tenant isolation beat decorative dashboards.
3. Kitchen and floor UIs optimize for glanceability and large touch under stress.
4. Portable backend contracts outlast any single cloud vendor UI skin.
5. Demo/synthetic data must be labeled; commercial claims stay uninventable.

## Accessibility & Inclusion

Target WCAG 2.2 AA contrast, 44×44px minimum coarse pointer targets, keyboard bump-bar support on KDS (`1–9`, `Space`, `R`), native `<dialog>` and Popover API toasts, and `prefers-reduced-motion`.
