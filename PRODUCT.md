# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Dine-in / takeaway guests** on mobile browsers after scanning a table or counter QR — browse menu, customize, multi-round order, wait engagement, call waiter, split & pay, review. Zero app install.
- **FOH staff (waiter, captain, cashier)** on tablets/phones — live floor map, service alerts, captain approval, assisted POS, shift float.
- **Kitchen chefs / expediters** on mounted touchscreens — station-routed KOTs, SLA timers, bump/recall.
- **Owners / managers** on desktop/tablet — live KPIs, menu/86, inventory BOM, RBAC, BI exports.
- **Platform super-admins** — multi-tenant provisioning and status.

## Product Purpose

PlateBeam is a multi-tenant restaurant operating system that synchronizes guests, floor, kitchen, and ownership over a zero-app web stack so ordering and settlement friction drop while hospitality staff focus on guests. Success means a full dining journey (QR → order → KDS → pay → review) works on unreliable venue Wi‑Fi with exact minor-unit money and strict tenant isolation.

## Positioning

One synchronized web OS for table QR, FOH floor, station KDS, and owner BI behind a portable hexagonal `/api/v1` backend — not a single-purpose QR menu page or a desktop-only POS.

## Operating Context

- Peak dinner rush, bright/hot kitchens, shared POS tablets with PIN switch.
- Guest phones on 4G/venue Wi‑Fi; thermal ESC/POS printers via local print bridge.
- Demo venue: Zaika Bistro (Gulshan), BDT, GST/VAT tax slabs, South Asia payment rails (SSLCommerz/UPI) plus global adapters.
- Staff PINs and HMAC table QR tokens; multi-tenant Supabase Postgres with FORCE RLS (MySQL portable path).

## Capabilities and Constraints

- Surfaces: `/`, `/login`, `/t/[qrToken]`, `/pos/[outletSlug]`, `/kds/[outletSlug]`, `/dashboard`, `/admin`.
- Must preserve: PlateBeam product name, existing API contracts and domain services, HMAC QR security, integer minor-unit billing, 3-layer RBAC, KDS high-contrast usability in bright kitchens, offline IndexedDB delta-sync for FOH/KDS.
- Out of scope this redesign: Nest/Redis rewrite, deep floor merge ledger, full API auth hardening, aggregator delivery.

## Brand Commitments

- Product name: **PlateBeam**.
- Demo brand content: Zaika Bistro & Bar may remain as illustrative venue copy.
- Visual identity is **fully replaceable** (user-approved redesign): previous Warm Editorial Bistro / saffron / Instrument Serif / Plus Jakarta system is anti-reference only.

## Evidence on Hand

- SRS, concept video specification, implementation plan, walkthrough.
- Seed script for Zaika Bistro (tables, menu, staff PINs).
- No production photography pack or custom logo files beyond text mark; do not invent customer testimonials or unverified GMV claims as real proof.

## Product Principles

1. Synchronize every role on one live table session without forcing an app download.
2. Exact money and tenant isolation beat decorative dashboards.
3. Kitchen and floor UIs optimize for glanceability and large touch under stress.
4. Portable backend contracts outlast any single cloud vendor UI skin.
5. Demo/synthetic data must be labeled; commercial claims stay uninventable.

## Accessibility & Inclusion

Target WCAG 2.2 AA contrast, 44×44px minimum coarse pointer targets, keyboard bump-bar support on KDS, `prefers-reduced-motion`, and themeable light/dark where the surface is not kitchen-mounted.
