# **Software Requirements Specification (SRS): Restaurant Management & QR Ordering Software**

**Document Control Metadata**

| Field | Value |
| :---- | :---- |
| Document Title | Software Requirements Specification (SRS) — Cloud Restaurant Management & QR Ordering SaaS |
| Standard Compliance | [ISO/IEC/IEEE 29148:2018](https://www.reqview.com/doc/iso-iec-ieee-29148-templates/) (superseding IEEE 830-1998) |
| Version | 1.0 (Production Baseline) |
| Date | November 25, 2026 |
| Scope | End-to-End Lifecycle: Architecture, Features, Database Schema, ERD, Security, QA, and Production Deployment |
| Target Deployment | Multi-Tenant Cloud SaaS with Offline-Resilient Local POS & KDS Clients |

# **1\. Introduction**

## **1.1 Purpose**

This Software Requirements Specification (SRS) defines the complete functional, non-functional, architectural, data, interface, security, and operational requirements for an all-in-one, web-based Restaurant Management & QR Ordering Software platform. Following the [ISO/IEC/IEEE 29148:2018 framework](https://scopeivo.io/resources/software-requirements-specification-template), this document serves as the authoritative technical contract between product stakeholders, software architects, backend/frontend engineers, QA teams, and DevOps engineers from initial development through production release.

## **1.2 Product Scope**

The platform is a multi-tenant Hospitality SaaS suite engineered to digitize the entire dine-in, counter/QSR, and takeaway lifecycle without requiring diners to download a native mobile app.

**In Scope:**

* **Guest-Facing Zero-App QR Web Portal (PWA):** Table-specific signed QR scanning, interactive digital menu with allergens/spice levels/portions/modifiers, intelligent upsell prompts, multi-round running table tabs, live kitchen countdown timer, wait-time engagement (one-tap Wi-Fi copy, loyalty rewards, multiplayer table mini-games such as Spice Quiz), one-tap Call Waiter with quick-action tags, dynamic Split Bill (equal or item-wise), tipping, multi-rail digital checkout (UPI, Card, Apple Pay, Google Pay, Bank Transfer, Cash), instant digital receipts, and 5-star review capture.  
* **Front-of-House (FOH) Staff & Floor Operations:** Real-time color-coded Live Floor Map (Available, Ordering, Eating, Help Requested, Bill Requested), Captain Order Approval mode, table merge/transfer, Call Waiter alert queue, and counter/takeaway token management.  
* **Kitchen Display System (KDS) & Hardware Printing:** Real-time station-routed tickets (e.g., Tandoor, Curry, Drinks, Bar, Dessert), live prep timers with SLA escalation colors, bump/recall workflow, and driverless ESC/POS thermal printing for 58mm/80mm Kitchen Order Tickets (KOTs) and customer bills.  
* **Back-of-House (BOH) & Owner Analytics Portal:** Multi-outlet management, dynamic menu & 86/out-of-stock control, recipe-linked inventory auto-deduction, granular 3-layer Role-Based Access Control (RBAC), statutory tax invoicing (GST/VAT/Service Charge), and live owner analytics (table occupancy, order volume, net sales, average ticket size, table turnover time, KDS prep SLA).  
* **Multi-Tenant Platform Administration:** Tenant onboarding, custom subdomains, subscription billing, feature flags, and system-wide observability.

**Out of Scope (Phase 1):**

* Third-party food delivery aggregator fleet dispatching (e.g., Swiggy/Zomato/UberEats direct rider tracking; webhook menu sync may be added in Phase 3).  
* Full enterprise payroll/HR tax filing and accounting ERP ledger replacement (standard CSV/Tally/QuickBooks exports are in scope).

## **1.3 Definitions, Acronyms, and Abbreviations**

| Term / Acronym | Definition |
| :---- | :---- |
| BOH / FOH | Back-of-House (kitchen, inventory, management) / Front-of-House (dining floor, hosts, waiters, cashiers). |
| ESC/POS | Epson Standard Code for Point of Sale — universal command protocol for thermal receipt and KOT printers. |
| GST / VAT | Goods and Services Tax / Value Added Tax configured per line item and outlet tax jurisdiction. |
| KDS | Kitchen Display System — screen-based digital order queue replacing or augmenting paper KOTs. |
| KOT | Kitchen Order Ticket — production ticket routed to specific kitchen prep stations. |
| PCI-DSS | Payment Card Industry Data Security Standard (Level 1 required for payment gateway partners). |
| PWA | Progressive Web Application — mobile web experience supporting instant load and offline caching. |
| RBAC | Role-Based Access Control with defaults, per-user grants, and explicit denials. |
| RLS | PostgreSQL Row-Level Security enforcing strict multi-tenant data isolation at the database engine layer. |
| SLA / SLO | Service Level Agreement / Service Level Objective. |
| UPI | Unified Payments Interface — real-time mobile payment rail essential for South Asian hospitality markets. |

## **1.4 References**

* [ISO/IEC/IEEE 29148:2018 Requirements Specification Templates — ReqView](https://www.reqview.com/doc/iso-iec-ieee-29148-templates/)  
* [Software Requirements Specification Template & Verification Best Practices — Scopeivo](https://scopeivo.io/resources/software-requirements-specification-template)  
* [Multi-Tenant Restaurant SaaS Architecture (Socket.IO, RBAC, Pay-First) — RelieveX Labs](https://relievexlabs.com/blog/multi-tenant-restaurant-saas-qr-ordering-architecture)  
* [PostgreSQL Row-Level Security Multi-Tenant Checklist — Maysan Labs](https://maysanlabs.com/blog/postgres-row-level-security-a-multi-tenant-checklist)  
* [Contactless QR Ordering & Anti-Spoofing Controls — OrderGo](https://ordergo.in/docs/core-features/qr-ordering)  
* [Preventing Fake and Prank QR Orders — Shopifire](https://shopifire.in/blog/stop-fake-qr-orders)  
* [Driverless Thermal ESC/POS & LAN Receipt Printing — Restrofyi](https://restrofyi.com/thermal-printer-pos.html)  
* [Cloud Hospitality Payment, Split-Bill & Offline Cache Patterns — DinerOrbit](https://www.dinerorbit.com/terms)

# **2\. Overall Description**

## **2.1 System Perspective & Multi-Tenant Architecture**

The platform operates as a unified, single-codebase, multi-tenant cloud SaaS application where each restaurant brand (Tenant) can operate one or more physical venues (Outlets). Following proven [multi-tenant restaurant SaaS architecture principles](https://relievexlabs.com/blog/multi-tenant-restaurant-saas-qr-ordering-architecture), each outlet receives a dedicated subdomain (e.g., `zaika-indore.platform.app`) or custom domain, complete logical data isolation via [PostgreSQL Row-Level Security (RLS)](https://maysanlabs.com/blog/postgres-row-level-security-a-multi-tenant-checklist), and isolated real-time WebSocket namespaces/rooms per outlet, kitchen station, and active table session.

**Core Architectural Layers:**

1. **Edge & CDN Layer:** Cloudflare / AWS CloudFront providing TLS 1.3 termination, WAF, DDoS protection, rate limiting, and edge caching for menu images and static assets.  
2. **Client Layer:**  
   * Guest QR Web App (Next.js / React PWA — mobile-first, sub-2s cold load).  
   * FOH Waiter & POS Tablet App (React PWA with IndexedDB offline queue).  
   * Kitchen Display System (KDS) Web App (optimized for 15"–24" touch/bump-bar screens).  
   * Owner & Super-Admin Dashboard (responsive desktop/tablet analytics portal).  
   * Optional Local Print Bridge Agent (lightweight Node.js/Electron daemon on venue LAN for direct ESC/POS TCP/USB printing).  
3. **Application & Real-Time Layer:** Containerized Node.js (TypeScript / NestJS) or Go API servers \+ Socket.IO real-time cluster backed by Redis Pub/Sub adapter for horizontal scaling.  
4. **Data & Storage Layer:** PostgreSQL 16+ (primary OLTP store with strict RLS), Redis (session tokens, rate limits, real-time table presence, leaderboard state for mini-games, pub/sub), S3-compatible object storage (compressed WebP menu imagery, archived PDF invoices).  
5. **External Service Integrations:** Payment Gateways (Razorpay, Stripe, UPI Intent, Apple Pay, Google Pay, regional adapters like SSLCommerz), Transactional Email/SMS/WhatsApp (Resend/SES, Twilio/MSG91), and Observability stack (OpenTelemetry, Prometheus, Grafana, Sentry).

## **2.2 User Classes and Characteristics**

| User Class | Access Channel | Primary Responsibilities | Technical Proficiency |
| :---- | :---- | :---- | :---- |
| **Dine-In / Takeaway Guest** | Mobile Browser (via Table/Counter QR) | Browse menu, customize items, place multi-round orders, view live cook timer, play mini-games, call waiter, split & pay bill, submit review. | Low to High; zero onboarding or app install allowed. |
| **Waiter / Floor Captain** | Tablet / Smartphone POS PWA | Monitor Live Floor Map, respond to Call Waiter alerts, approve flagged QR orders, place assisted orders, collect cash, reset tables. | Moderate; requires fast PIN login and 1-tap workflows under peak rush. |
| **Kitchen Chef / Expediter** | Mounted KDS Touchscreen | View station-specific incoming KOTs, monitor prep timers, mark items Preparing / Ready / Served, trigger 86 (out-of-stock) alerts. | Low to Moderate; high-contrast large touch targets required. |
| **Cashier / Shift Manager** | Desktop / Tablet POS | Manage shift float, process cash/split settlements, apply manager discounts/voids, issue gateway refunds, print statutory bills. | Moderate to High; audit-logged sensitive actions. |
| **Restaurant Owner / Admin** | Web Dashboard | Configure outlets, tables, QR rotation, menus, recipes/inventory, tax rules, staff permissions, loyalty campaigns, and inspect live sales/BI reports. | Moderate; business-focused analytics. |
| **Platform Super-Admin** | Internal SaaS Console | Provision tenants, manage subscription plans, monitor system health, investigate support tickets with audited impersonation. | High (engineering/operations). |

## **2.3 Operating Environment**

* **Guest Devices:** iOS 15+ (Safari, Chrome) and Android 10+ (Chrome, Samsung Internet) over 4G/5G or venue Wi-Fi.  
* **Venue Staff Devices:** iPadOS 15+, Android 11+ tablets (10"+), Windows 10/11, macOS 12+, or ChromeOS terminals.  
* **Venue Peripherals:** 58mm and 80mm ESC/POS compatible thermal printers (Epson, Star Micronics, Bixolon, Sunmi, Xprinter) via Ethernet LAN, USB, or Bluetooth, plus RJ11/RJ12 cash drawers.  
* **Cloud Infrastructure:** Linux containers orchestrated on Kubernetes (EKS/GKE) or managed container cloud (ECS/Cloud Run) across multi-AZ regions.

## **2.4 Design and Implementation Constraints**

* **Zero Cardholder Data Storage:** The platform must never store raw PANs, CVVs, or UPI PINs; all card/UPI credentials must be tokenized directly by PCI-DSS Level 1 gateways.  
* **Strict Multi-Tenant Isolation:** Every tenant-scoped database table must include a non-null `tenant_id` (and `outlet_id` where applicable) enforced via PostgreSQL `FORCE ROW LEVEL SECURITY` using transaction-scoped `SET LOCAL app.tenant_id`.  
* **Graceful Network Degradation:** Venue Wi-Fi drops must not lose active orders or halt KDS/POS operations; clients must reconcile automatically via Delta-Sync upon reconnection.  
* **Statutory Tax Precision:** All monetary figures must be stored as exact integer minor units (e.g., paise/cents) or `NUMERIC(12,2)` — never binary floating-point types — to eliminate rounding errors across split bills and tax calculations.

## **2.5 Assumptions and Dependencies**

* Venues possess a basic broadband/4G router for cloud synchronization and an internal LAN if using networked thermal printers.  
* Restaurant owners are legally responsible for verifying menu allergen declarations, dietary tags, and local tax rates (GSTIN/VAT registration numbers).  
* Payment settlement timelines and automated duplicate-charge refunds depend on third-party gateway banking rails (typically 5–7 business days).

# **3\. Functional Requirements**

Every functional requirement has a unique identifier (`FR-XXX`), priority (`P0` Critical/MVP, `P1` High, `P2` Enhancement), and testable acceptance behavior.

## **3.1 Module 01: QR Code Generation, Scanning & Anti-Spoofing Security**

* **FR-001 (P0) Signed Dynamic Table QR Codes:** The system shall generate cryptographically signed QR URLs (`https://{outlet_slug}.platform.app/t/{table_token}`) containing an opaque, non-sequential signed token rather than a guessable table number, preventing guests from manually editing URLs to order for another table (as recommended by [Shopifire Anti-Spoofing Guidelines](https://shopifire.in/blog/stop-fake-qr-orders)).  
* **FR-002 (P0) One-Tap QR Rotation:** Admins shall be able to revoke and regenerate a compromised or leaked table QR token in one tap, immediately invalidating old printed stickers.  
* **FR-003 (P0) Collaborative Table Session Joining:** Multiple guests (e.g., Aman and Riya at Table 5\) scanning the same table's QR code shall automatically join the same active `table_session`, viewing a live synchronized shared cart and running order timeline.  
* **FR-004 (P0) Anti-Prank & Fraud Guardrails:** Outlets shall be able to configure per-zone security policies: (a) Optional GPS geofencing (e.g., 100m radius) or Venue Wi-Fi IP check, (b) Optional OTP/phone verification for high-value orders, (c) Captain Confirmation Mode requiring waiter tap before kitchen dispatch, (d) Pay-First Mode for counter/takeaway QRs, and (e) Phone/device blocklist and max unpaid order cap ([OrderGo QR Security](https://ordergo.in/docs/core-features/qr-ordering)).  
* **FR-005 (P1) Takeaway / Counter Token Mode:** Scanning a counter QR code shall initiate a takeaway session that issues a sequential numeric token (e.g., `Token #42`) upon payment rather than binding to a dining table.

## **3.2 Module 02: Interactive Digital Menu & Smart Ordering**

* **FR-006 (P0) Categorized Rich Menu:** The guest web app shall load the outlet's active menu within 1.5 seconds, organized by categories (e.g., Starters, Mains, Breads, Drinks, Desserts) with sticky category tabs, instant search, and dietary filters (Veg, Non-Veg, Egg, Vegan, Gluten-Free, Jain).  
* **FR-007 (P0) Dish Attributes, Allergens & Customization:** Each menu item shall display high-resolution WebP photography, description, dietary indicator, explicit allergen badges (e.g., Dairy, Nuts, Gluten, Shellfish), selectable spice level (Mild, Medium, Spicy, Extra Spicy), portion sizes (Half / Full), modifier groups (add-ons, crust/bread choices), and free-text kitchen notes.  
* **FR-008 (P0) Intelligent Upsell & Combo Engine:** The cart and item detail drawers shall surface configurable upsell pairings (e.g., "+ Mango Lassi for ₹99" or "Pair with Garlic Naan") triggered by cart contents, category rules, or margin targets, aiming to lift average order value by 15–25%.  
* **FR-009 (P0) Real-Time 86 / Availability Sync:** When BOH staff mark an item out-of-stock (or inventory auto-deduction hits zero), the item shall disable on all active guest menus within 2 seconds via WebSocket broadcast.  
* **FR-010 (P0) Multi-Round Running Tabs:** Guests shall be able to submit multiple order rounds (e.g., Starters \-\> Mains \-\> Dessert) under a single open `table_session` without paying after each round, with all items consolidated onto one master bill.  
* **FR-011 (P1) Time-Based Menu Scheduling:** Admins shall configure scheduled menu windows (e.g., Breakfast 07:00–11:30, Lunch, Happy Hour) that automatically toggle item visibility and promotional pricing.

## **3.3 Module 03: Order Routing, Kitchen Display System (KDS) & Thermal Printing**

* **FR-012 (P0) One-Tap Staff Dispatch & Auto-Fire Toggle:** Outlets shall choose between Direct-to-Kitchen auto-fire or Captain Review dispatch, where a single tap on the FOH tablet routes the order to the KDS and updates the master bill accurately (ensuring zero discrepancy between item subtotals and total check value).  
* **FR-013 (P0) Station-Based KDS Routing:** The system shall split incoming orders automatically by menu item `station_id` (e.g., Tandoor, Curry, Drinks, Bar) so each kitchen display receives only its assigned items while showing a subtle indicator of companion items cooking at other stations for coordinated plating.  
* **FR-014 (P0) Live Prep Timers & Escalation Visuals:** Every KDS ticket shall display an elapsed prep timer and target prep time (`prep_time_mins`). Ticket headers shall transition visually from Green (on-time) to Amber (\>75% target) to Pulsing Red (overdue SLA).  
* **FR-015 (P0) Ticket State Lifecycle & Bump Controls:** Kitchen staff shall transition items/tickets through `PENDING -> ACCEPTED -> PREPARING -> READY -> SERVED` (with `CANCELLED` requiring manager PIN once in `PREPARING` state). A "Recall Last Bumped" action shall restore accidentally cleared tickets.  
* **FR-016 (P0) Driverless ESC/POS Thermal Printing:** The platform shall support simultaneous dual-routing to LAN/USB/Bluetooth ESC/POS thermal printers (58mm and 80mm) for automatic KOT firing per station, bill printing at cashier stations, and RJ11 cash drawer kick pulses ([Restrofyi ESC/POS](https://restrofyi.com/thermal-printer-pos.html)).

## **3.4 Module 04: Guest Wait Experience, Loyalty & Table Gamification**

* **FR-017 (P0) Live Order Status & Countdown Timer:** Once an order enters the kitchen, guests shall view real-time item progress (`Received -> Cooking -> Ready to Serve`) alongside a dynamic estimated countdown timer derived from KDS queue load and item prep times.  
* **FR-018 (P1) One-Tap Guest Wi-Fi Card:** The waiting screen shall display the venue's guest Wi-Fi SSID and a one-tap "Copy Password" button (and optional Wi-Fi QR) to eliminate repetitive staff questions.  
* **FR-019 (P1) Built-In Loyalty & Rewards Wallet:** Guests opting in with phone/email shall earn points per currency unit spent, view tier progress, and redeem instant reward vouchers (e.g., Free Dessert or 10% Off Next Visit) directly at checkout.  
* **FR-020 (P2) Multiplayer Wait-Time Mini-Games:** While orders are in `PREPARING` state, guests shall be able to launch lightweight web mini-games (e.g., *Spice Quiz* trivia, Food Wordle) synced via WebSockets to play collaboratively/competitively with tablemates or against other active tables in the restaurant, with optional leaderboard rewards (e.g., 5% discount coupon for daily high score).

## **3.5 Module 05: Service Requests (Call Waiter) & Live Floor Map**

* **FR-021 (P0) Quick-Action Call Waiter:** Guests shall have a persistent "Call Waiter" button offering 1-tap structured tags (`Water`, `Napkins`, `Cutlery`, `Clean Table`, `Request Bill`, `Need Assistance`) plus an optional short note, preventing spam via a configurable cooldown (e.g., 60 seconds per request type).  
* **FR-022 (P0) Real-Time Color-Coded Floor Map:** FOH tablets shall render an interactive drag-and-drop floor plan divided by zones (Main Hall, Patio, VIP, Bar) where every table dynamically reflects its live status color:  
  * **Gray:** Available / Vacant  
  * **Blue:** Occupied — Browsing / Ordering  
  * **Green:** Food Served — Eating  
  * **Red (Flashing \+ Audible Chime):** Help Requested (showing exact tag like "Water" and elapsed wait seconds)  
  * **Amber:** Bill Requested / Payment In Progress  
* **FR-023 (P0) Waiter Assignment & SLA Tracking:** Tapping an active service alert shall claim the request under the waiter's ID, broadcast the assignment to other FOH devices (preventing duplicate trips), and log response time upon completion.  
* **FR-024 (P1) Table Operations (Merge, Split, Transfer):** Authorized FOH staff shall merge multiple tables into a single group session, transfer an open session to a new table, or split a single table into separate checks.

## **3.6 Module 06: Dynamic Split Billing, Tipping & Multi-Rail Checkout**

* **FR-025 (P0) Transparent Live Running Bill:** Guests and staff shall view an itemized bill showing every round's items, quantity, modifiers, discounts, configurable taxes (e.g., CGST/SGST or VAT broken down per tax slab), optional service charge, and exact grand total.  
* **FR-026 (P0) Dynamic Split-Bill Engine:** Multiple diners at the same table shall be able to split the balance via three modes: (a) **Split Equally** by N guests (automatically handling remainder minor units so sum of parts equals exact total), (b) **Split by Item** (each guest claims specific dishes or fractional shares of shared dishes), or (c) **Custom Amount**. The table session shall transition to `PAID` and auto-unlock only when cumulative verified payments equal or exceed the grand total ([DinerOrbit Split-Bill Logic](https://www.dinerorbit.com/terms)).  
* **FR-027 (P0) Configurable Tipping:** Checkout shall present preset tip buttons (e.g., 5%, 10%, 15%, Custom, No Tip) calculated on pre-tax subtotal, tracked separately from food revenue for transparent staff tip pooling.  
* **FR-028 (P0) Localized & Global Payment Rails:** The checkout orchestrator shall support pluggable regional payment adapters:  
  * **South Asia / India / Bangladesh:** UPI Intent & Dynamic UPI QR (PhonePe, GPay, Paytm, BHIM), NetBanking, Cards, Mobile Financial Services (e.g., bKash/Nagad via SSLCommerz where configured).  
  * **Global:** Credit/Debit Cards (Visa, Mastercard, Amex), Apple Pay, Google Pay, Bank Transfer.  
  * **Offline/Venue:** Pay at Counter / Cash / External EDC Card Machine (marked settled by authorized cashier/waiter).  
* **FR-029 (P0) Idempotent Payment Processing & Duplicate Reconciliation:** Every payment attempt shall use a UUID idempotency key. Verified gateway webhooks shall update ledger status atomically; network-timeout double charges shall trigger an automated reconciliation flag and reversal workflow.

## **3.7 Module 07: Digital Receipts, Reviews & CRM Feedback Loop**

* **FR-030 (P0) Instant Statutory Digital Receipts:** Immediately upon full settlement, the system shall generate a sequential, tax-compliant PDF/HTML receipt (including outlet GSTIN/VAT ID, HSN/SAC codes if required, itemized tax breakdown, payment mode, and invoice number) delivered via Email, WhatsApp, or direct download.  
* **FR-031 (P0) Post-Payment 5-Star Review & Service Recovery Routing:** Following checkout, guests shall receive a 1-tap 1–5 star rating prompt plus optional item-level tags. Ratings of 4–5 stars may present a direct link to post on Google Reviews; ratings of 1–3 stars shall capture private feedback and immediately alert the on-duty manager via dashboard/SMS for service recovery.

## **3.8 Module 08: Owner Dashboard, Inventory, RBAC & Multi-Outlet Analytics**

* **FR-032 (P0) Live Owner Command Center:** Owners shall view real-time KPIs across single or multiple outlets: Active Table Occupancy (e.g., `6/6 Tables`), Live Order Count, Gross & Net Sales Today, Average Order Value (AOV), Average Table Turnover Time, KDS Average Prep Time, and Payment Mix Breakdown.  
* **FR-033 (P0) Granular 3-Layer RBAC:** Following [three-layer hospitality permission architecture](https://relievexlabs.com/blog/multi-tenant-restaurant-saas-qr-ordering-architecture), effective user permissions shall be computed as: `(Role Default Permissions + Per-User Explicit Grants) - Per-User Explicit Denials`, where **explicit denials always win**. Sensitive actions (voiding cooked items, applying \>15% discounts, issuing refunds, exporting customer PII) shall write immutable audit log entries.  
* **FR-034 (P1) Recipe-Linked Inventory & Low-Stock Alerts:** Outlets shall map menu items to raw ingredient recipes (BOM). Confirming a KOT shall automatically deduct ingredient quantities, trigger low-stock threshold alerts, and optionally auto-86 dishes when key ingredients reach zero.  
* **FR-035 (P1) Shift Register & End-of-Day Reconciliation:** Cashiers shall open and close register shifts by entering opening cash float, recording petty cash payouts, and reconciling expected vs. counted cash, card, and UPI totals with automated Z-Report PDF/CSV export.  
* **FR-036 (P1) Menu Engineering & BI Reports:** Exportable daily/weekly/monthly reports (CSV/PDF) covering Top/Bottom Selling Items, Profit Margin vs. Popularity Matrix (Stars, Plowhorses, Puzzles, Dogs), Tax Filing Summaries (CGST/SGST/VAT), Waiter Performance, and Upsell Conversion Rate.

# **4\. Complete Database Schema (PostgreSQL 16+)**

All tenant-scoped tables include `tenant_id UUID NOT NULL` with composite indexing `(tenant_id, ...)` and enforced Row-Level Security (RLS). Monetary columns use `BIGINT` minor currency units (e.g., paise/cents) to guarantee zero floating-point drift.

## **4.1 Core Table Specifications**

| Table Name | Primary Key | Key Columns & Types | Purpose |
| :---- | :---- | :---- | :---- |
| `tenants` | `id (UUID)` | `name`, `slug (UNIQUE)`, `subscription_plan`, `status`, `currency_code`, `created_at` | Top-level restaurant brand/organization. |
| `outlets` | `id (UUID)` | `tenant_id (FK)`, `name`, `subdomain (UNIQUE)`, `address`, `timezone`, `tax_reg_no`, `wifi_ssid`, `wifi_password_enc`, `qr_security_policy (JSONB)`, `geo_lat`, `geo_lng` | Physical restaurant venue/branch. |
| `users` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK NULL)`, `full_name`, `email`, `phone`, `password_hash`, `pos_pin_hash`, `role_id (FK)`, `is_active` | Staff, managers, chefs, and owners. |
| `roles` | `id (UUID)` | `tenant_id (FK NULL)`, `name`, `default_permissions (JSONB)` | Standard and custom role definitions. |
| `user_permission_overrides` | `id (UUID)` | `tenant_id (FK)`, `user_id (FK)`, `permission_key`, `effect ('GRANT'|'DENY')` | Per-user overrides where `DENY` overrides `GRANT` and role defaults. |
| `floor_zones` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `name`, `display_order` | Logical dining zones (Main Hall, Patio, Bar). |
| `dining_tables` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `zone_id (FK)`, `table_number`, `capacity`, `qr_token (UNIQUE)`, `qr_rotated_at`, `pos_x`, `pos_y`, `status`, `active_session_id (FK NULL)` | Physical tables and signed QR tokens. |
| `kitchen_stations` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `name`, `printer_config (JSONB)`, `sla_target_mins` | Prep stations (Tandoor, Curry, Drinks, Bar). |
| `menu_categories` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `name`, `sort_order`, `schedule_rules (JSONB)`, `is_active` | Menu groupings with optional time windows. |
| `menu_items` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `category_id (FK)`, `station_id (FK)`, `name`, `description`, `base_price_minor (BIGINT)`, `tax_slab_id (FK)`, `dietary_type`, `allergens (TEXT[])`, `spice_levels (TEXT[])`, `prep_time_mins`, `image_url`, `is_available` | Core dish catalog linked to KDS station & tax slab. |
| `item_variants_modifiers` | `id (UUID)` | `tenant_id (FK)`, `menu_item_id (FK)`, `group_name`, `option_name`, `price_delta_minor (BIGINT)`, `is_required`, `max_select` | Portion sizes (Half/Full) and add-ons. |
| `upsell_rules` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `trigger_item_id (FK NULL)`, `trigger_category_id (FK NULL)`, `suggested_item_id (FK)`, `promo_price_minor (BIGINT)`, `priority` | Cart & dish upsell pairing engine. |
| `tax_slabs` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `name`, `rate_bps (INT)`, `components (JSONB)`, `hsn_code`, `is_inclusive` | Statutory tax rules (e.g., 5% GST \= 2.5% CGST \+ 2.5% SGST). |
| `guests` | `id (UUID)` | `tenant_id (FK)`, `phone`, `email`, `display_name`, `loyalty_points (INT)`, `loyalty_tier`, `is_blocked`, `created_at` | Guest CRM profiles and loyalty balances. |
| `table_sessions` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `table_id (FK NULL)`, `session_type ('DINE_IN'|'TAKEAWAY')`, `token_number`, `status`, `guest_count`, `opened_at`, `closed_at`, `subtotal_minor`, `tax_minor`, `discount_minor`, `service_charge_minor`, `tip_minor`, `total_minor` | Master dining visit / running tab container. |
| `orders` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `session_id (FK)`, `order_number`, `round_number (INT)`, `source ('QR'|'WAITER'|'COUNTER')`, `status`, `placed_by_guest_id (FK NULL)`, `approved_by_user_id (FK NULL)`, `created_at` | Individual order round within a session. |
| `order_items` | `id (UUID)` | `tenant_id (FK)`, `order_id (FK)`, `menu_item_id (FK)`, `station_id (FK)`, `item_name_snapshot`, `quantity (INT)`, `unit_price_minor (BIGINT)`, `modifiers_snapshot (JSONB)`, `spice_level`, `notes`, `tax_minor`, `kds_status`, `started_at`, `ready_at`, `served_at` | Immutable snapshot of ordered line items & KDS state. |
| `service_requests` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `session_id (FK)`, `table_id (FK)`, `request_type`, `note`, `status`, `assigned_user_id (FK NULL)`, `created_at`, `resolved_at` | Call Waiter alerts (Water, Napkins, Bill, Help). |
| `invoices` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `session_id (FK)`, `invoice_number`, `tax_breakdown (JSONB)`, `total_minor`, `pdf_url`, `issued_at` | Immutable sequential statutory invoices. |
| `payments` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `session_id (FK)`, `invoice_id (FK NULL)`, `guest_id (FK NULL)`, `split_group_id`, `idempotency_key (UNIQUE)`, `provider`, `method`, `amount_minor`, `tip_minor`, `status`, `gateway_txn_id`, `raw_webhook (JSONB)`, `paid_at` | Split-bill and full payment transaction ledger. |
| `reviews` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `session_id (FK)`, `guest_id (FK NULL)`, `rating (1–5)`, `comment`, `tags (TEXT[])`, `manager_notified`, `created_at` | Post-meal ratings and service recovery records. |
| `mini_game_sessions` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `session_id (FK)`, `game_type`, `player_nickname`, `score (INT)`, `reward_coupon_code`, `played_at` | Wait-time multiplayer game scores & rewards. |
| `inventory_items` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `sku`, `name`, `unit`, `current_qty (NUMERIC)`, `reorder_level (NUMERIC)`, `cost_per_unit_minor` | Raw ingredients & beverage stock. |
| `menu_item_recipes` | `id (UUID)` | `tenant_id (FK)`, `menu_item_id (FK)`, `inventory_item_id (FK)`, `qty_required (NUMERIC)` | Bill of Materials linking menu items to stock. |
| `audit_logs` | `id (UUID)` | `tenant_id (FK)`, `outlet_id (FK)`, `actor_user_id (FK)`, `action`, `entity_type`, `entity_id`, `before_state (JSONB)`, `after_state (JSONB)`, `ip_address`, `created_at` | Tamper-evident compliance & security audit trail. |

## **4.2 Critical SQL DDL & Multi-Tenant Row-Level Security (RLS) Implementation**

```
-- Example Production Table & Strict Multi-Tenant RLS Enforcement
CREATE TABLE table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE RESTRICT,
    table_id UUID REFERENCES dining_tables(id),
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('DINE_IN', 'TAKEAWAY')),
    token_number INT,
    status VARCHAR(25) NOT NULL CHECK (status IN ('OPEN', 'BILL_REQUESTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
    guest_count INT NOT NULL DEFAULT 1,
    subtotal_minor BIGINT NOT NULL DEFAULT 0,
    tax_minor BIGINT NOT NULL DEFAULT 0,
    discount_minor BIGINT NOT NULL DEFAULT 0,
    service_charge_minor BIGINT NOT NULL DEFAULT 0,
    tip_minor BIGINT NOT NULL DEFAULT 0,
    total_minor BIGINT NOT NULL DEFAULT 0,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Composite indexes lead with tenant_id so RLS policies execute via index scans
CREATE INDEX idx_sessions_tenant_outlet_status ON table_sessions (tenant_id, outlet_id, status);
CREATE INDEX idx_sessions_tenant_opened ON table_sessions (tenant_id, opened_at DESC);

-- Unique invoice numbers scoped per tenant + outlet
CREATE UNIQUE INDEX uq_invoices_tenant_outlet_number ON invoices (tenant_id, outlet_id, invoice_number);

-- Mandatory Row-Level Security on EVERY tenant-scoped table
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON table_sessions
    AS RESTRICTIVE
    FOR ALL
    TO app_runtime_role
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Application middleware MUST execute inside every DB transaction:
-- SET LOCAL app.tenant_id = '<authenticated_tenant_uuid>';
```

*(Per [Maysan Labs PostgreSQL RLS Checklist](https://maysanlabs.com/blog/postgres-row-level-security-a-multi-tenant-checklist): the runtime app role must never own tables or hold `BYPASSRLS`; DDL migrations execute under a separate migration role; `SET LOCAL` prevents tenant context leakage across PgBouncer connection pools.)*

# **5\. Entity-Relationship Diagram (ERD)**

## **5.1 Visual Crow's Foot ERD (ASCII Architecture Blueprint)**

```
+--------------------+          +--------------------+          +--------------------+
|      TENANTS       |1       * |      OUTLETS       |1       * |    FLOOR_ZONES     |
+--------------------+----------+--------------------+----------+--------------------+
| PK id              |          | PK id              |          | PK id              |
|    slug (UQ)       |          | FK tenant_id       |          | FK tenant_id       |
|    plan            |          |    subdomain (UQ)  |          | FK outlet_id       |
+---------+----------+          |    tax_reg_no      |          +---------+----------+
          |1                    +----+-----+----+----+                    |1
          |                          |1    |1   |1                        |
          |*                         |*    |*   |*                        |*
+---------+----------+   +-----------+--+  |  +-+----------------+  +-----+--------------+
|       USERS        |   | KITCHEN_     |  |  |  MENU_CATEGORIES |  |   DINING_TABLES    |
+--------------------+   | STATIONS     |  |  +------------------+  +--------------------+
| PK id              |   +--------------+  |  | PK id            |  | PK id              |
| FK tenant_id       |   | PK id        |  |  | FK outlet_id     |  | FK zone_id         |
| FK role_id         |   | FK outlet_id |  |  +--------+---------+  |    qr_token (UQ)   |
+---------+----------+   +------+-------+  |           |1           |    status          |
          |1                    |1         |           |            +---------+----------+
          |*                    |          |           |*                     |1
+---------+----------+          |          |  +--------+---------+            |
| USER_PERMISSION_   |          |          |  |    MENU_ITEMS    |            |
| OVERRIDES          |          |          |  +------------------+            |
+--------------------+          |          |  | PK id            |            |
| FK user_id         |          +----------+--| FK station_id    |            |
|    permission_key  |                     |  | FK category_id   |            |
|    effect (G/D)    |                     |  | FK tax_slab_id   |            |
+--------------------+                     |  +----+--------+----+            |
                                           |       |1       |1                |
                                           |       |*       |*                |*
                                           |  +----+----+ +-+--------------+  |
                                           |  |MODIFIERS| |MENU_ITEM_RECIPES| |
                                           |  +---------+ +-------+--------+  |
                                           |                      |*          |
                                           |                      |1          |
                                           |              +-------+--------+  |
                                           |              |INVENTORY_ITEMS |  |
                                           |              +----------------+  |
                                           |                                  |
+--------------------+          +----------+---------+          +-------------+------+
|       GUESTS       |1       * |   TABLE_SESSIONS   |*       1 |   (DINING_TABLES)  |
+--------------------+----+     +--------------------+----------+--------------------+
| PK id              |    |     | PK id              |
|    phone / email   |    |     | FK tenant_id       |
|    loyalty_points  |    |     | FK outlet_id       |
+---------+----------+    |     | FK table_id (NULL) |
          |1              |     |    status          |
          |               |     |    total_minor     |
          |               |     +--+-----+-----+--+--+
          |               |        |1    |1    |1 |1
          |               |        |     |     |  |
          |               |        |*    |*    |* |*
          |               |   +----+--+  |  +--+--+-------------+   +--------------------+
          |               +-->|ORDERS |  |  |  SERVICE_REQUESTS |   | MINI_GAME_SESSIONS |
          |                   +-------+  |  +-------------------+   +--------------------+
          |                   | PK id |  |  | PK id             |   | PK id              |
          |                   | FK ses|  |  | FK session_id     |   | FK session_id      |
          |                   | round |  |  | FK assigned_user  |   |    game_type/score |
          |                   +---+---+  |  +-------------------+   +--------------------+
          |                       |1     |
          |                       |*     |*
          |              +--------+---+  +--------------------+     +--------------------+
          |              |ORDER_ITEMS |  |      INVOICES      |1   *|      PAYMENTS      |
          |              +------------+  +--------------------+-----+--------------------+
          |              | PK id      |  | PK id              |     | PK id              |
          |              | FK order_id|  | FK session_id      |     | FK session_id      |
          |              | FK item_id |  |    invoice_number  |     | FK invoice_id      |
          |              | FK station |  |    total_minor     |     | FK guest_id (NULL) |
          |              | kds_status |  +--------------------+     |    idempotency_key |
          |              +------------+                             |    amount_minor    |
          |                                                         |    tip_minor       |
          |               +--------------------+                    +--------------------+
          +-------------->|      REVIEWS       |
           1            * +--------------------+
                          | PK id              |
                          | FK session_id      |
                          |    rating (1..5)   |
                          +--------------------+
```

## **5.2 Relationship & Cardinality Matrix**

| Parent Entity | Relationship | Child Entity | Cardinality | Delete Policy |
| :---- | :---- | :---- | :---- | :---- |
| `tenants` | owns | `outlets` | 1 : N | `RESTRICT (soft-delete only)` |
| `outlets` | contains | `floor_zones`, `kitchen_stations`, `menu_categories`, `inventory_items` | 1 : N | `RESTRICT` |
| `floor_zones` | organizes | `dining_tables` | 1 : N | `RESTRICT` |
| `dining_tables` | hosts over time | `table_sessions` | 1 : N | `SET NULL (preserve historical orders)` |
| `table_sessions` | groups rounds of | `orders` | 1 : N | `RESTRICT` |
| `orders` | contains line items | `order_items` | 1 : N | `CASCADE (only while Draft)` |
| `menu_items` | routed to | `kitchen_stations` | N : 1 | `RESTRICT` |
| `menu_items` | consumes via BOM | `menu_item_recipes` \-\> `inventory_items` | M : N | `CASCADE on recipe map` |
| `table_sessions` | generates | `invoices` | 1 : 1 (or 1 : N split invoices) | `RESTRICT (immutable ledger)` |
| `table_sessions` | settled by | `payments` | 1 : N (supports Split Bill) | `RESTRICT (immutable ledger)` |
| `table_sessions` | triggers | `service_requests`, `mini_game_sessions`, `reviews` | 1 : N | `RESTRICT` |
| `users` | granted/denied | `user_permission_overrides` | 1 : N | `CASCADE` |

# **6\. External Interface Requirements**

## **6.1 User Interface Requirements**

* **Guest QR PWA:** Dark/light theme support per outlet brand palette (default high-contrast accessible palette), thumb-zone primary CTAs, sticky bottom cart bar, skeleton loaders, zero horizontal scrolling on 360px mobile viewports.  
* **KDS Interface:** High-contrast dark mode designed for bright/hot kitchen environments, minimum 48x48px touch targets, color-coded elapsed timers, optional keyboard/physical bump-bar bindings, and audio alert chimes on new KOT arrival.  
* **Accessibility:** Conformance to **WCAG 2.2 Level AA** contrast ratios, semantic ARIA roles, and screen-reader-friendly menu navigation.

## **6.2 REST API & Real-Time WebSocket Contract Blueprint**

**Core REST Endpoints (`/api/v1`):**

* `GET /public/qr/:qrToken/bootstrap` — Resolves signed QR token, validates geofence/policy, returns outlet config, active table session, and categorized menu.  
* `POST /sessions/:sessionId/orders` — Places a new order round; enforces stock checks, runs upsell/tax calculations, emits WebSocket KDS events.  
* `PATCH /kds/order-items/:itemId/status` — Transitions KDS item status (`ACCEPTED`, `PREPARING`, `READY`, `SERVED`); updates guest countdown timer.  
* `POST /sessions/:sessionId/service-requests` — Triggers Call Waiter alert (`WATER`, `NAPKINS`, `BILL`, `HELP`) with cooldown enforcement.  
* `POST /sessions/:sessionId/split-bill/calculate` — Computes exact equal, item-wise, or custom split allocations down to the last minor unit.  
* `POST /sessions/:sessionId/payments/initiate` — Creates idempotent payment intent with configured gateway (UPI/Razorpay/Stripe) and returns client checkout payload.  
* `POST /webhooks/payments/:provider` — Verifies HMAC signature, settles payment row atomically, unlocks table when balance reaches zero, triggers digital receipt email/WhatsApp.  
* `GET /analytics/outlets/:outletId/live` — Returns real-time occupancy, order counts, sales totals, and KDS SLA metrics.

**Real-Time WebSocket Channels (Socket.IO Rooms):**

* `outlet:{outletId}:floor` — Broadcasts table status changes and Call Waiter alerts to all FOH tablets.  
* `outlet:{outletId}:station:{stationId}` — Pushes new KOT tickets and modifications exclusively to the relevant kitchen display and print bridge.  
* `session:{sessionId}` — Synchronizes live shared cart items, cook status updates, countdown timers, split-bill claims, and mini-game state across all diners at that table.

## **6.3 Hardware & Peripheral Interfaces**

* **ESC/POS Local Print Bridge:** Lightweight WebSocket client installed on a venue PC/Raspberry Pi/Android POS box receiving signed print jobs from the cloud and dispatching raw ESC/POS byte streams over TCP Port 9100 (LAN), USB, or Bluetooth SPP to 58mm/80mm thermal printers, including paper-cut and RJ11 cash drawer pulse commands.  
* **Fallback Print Queue:** If the local print bridge disconnects, jobs queue in Redis/IndexedDB and alert FOH tablets so staff can fall back to KDS screens or local browser print without losing orders.

# **7\. Non-Functional Requirements (NFRs)**

| ID | Category | Requirement & Measurable Verification Target |
| :---- | :---- | :---- |
| **NFR-001** | Performance (Guest Load) | Guest QR menu Largest Contentful Paint (LCP) shall be \<= 1.8s on 4G mobile networks at P95. |
| **NFR-002** | Performance (Real-Time Sync) | Order submission to KDS screen rendering latency shall be \<= 500ms at P95 and \<= 1.2s at P99. |
| **NFR-003** | Performance (API) | Core transactional API responses shall complete within \<= 250ms at P95 under peak weekend dinner load (500 concurrent orders/sec platform-wide). |
| **NFR-004** | Availability & Uptime | Platform shall maintain **99.95% monthly uptime** (\~21.6 mins max unplanned downtime/month) using multi-AZ active-active API instances and managed PostgreSQL HA failover. |
| **NFR-005** | Offline Resilience | FOH POS and KDS PWAs shall cache open sessions and menu catalogs in IndexedDB, surviving brief venue internet outages (up to 60 minutes) and automatically reconciling via idempotent Delta-Sync upon reconnection. |
| **NFR-006** | Security (Multi-Tenant) | 100% of tenant-scoped PostgreSQL tables shall enforce `FORCE ROW LEVEL SECURITY`; automated cross-tenant leakage tests shall pass with 0 breaches on every PR. |
| **NFR-007** | Security (Payments & Auth) | Zero storage of card PAN/CVV; PCI-DSS Level 1 hosted fields/intents only; TLS 1.3 in transit; AES-256-GCM at rest; Argon2id password/PIN hashing; short-lived JWT access tokens (15m) with rotating HttpOnly refresh tokens. |
| **NFR-008** | Compliance & Privacy | Support GDPR, India DPDP Act, and regional data protection (consent capture for marketing/loyalty, guest data erasure/anonymization API without corrupting immutable tax invoices). |
| **NFR-009** | Scalability | Stateless API & Redis-backed Socket.IO pods shall auto-scale horizontally via CPU/memory/WebSocket connection count metrics with zero dropped sessions during scale-out. |
| **NFR-010** | Maintainability | Monorepo architecture (TypeScript shared DTOs/validation schemas via Zod), \>= 80% backend unit/integration test coverage, automated OpenAPI 3.1 contract generation. |

# **8\. Requirements Verification & Traceability Matrix**

Per [ISO/IEC/IEEE 29148 verification standards](https://scopeivo.io/resources/software-requirements-specification-template), every requirement maps to a business goal, verification method (`Test`, `Demonstration`, `Inspection`, `Analysis`), and release gate:

| Business Goal | Requirement IDs | Verification Method | Automated / Release Gate |
| :---- | :---- | :---- | :---- |
| Eliminate waiter bottlenecks & speed up ordering | FR-001 to FR-011, NFR-001 | Automated E2E Test \+ Lighthouse CI | Guest order placed in \< 45s; LCP \<= 1.8s |
| Prevent prank/fake QR orders & cross-tenant leaks | FR-001, FR-002, FR-004, NFR-006 | Security Penetration Test \+ RLS Integration Suite | 0 cross-tenant rows returned; forged QR tokens return HTTP 403 |
| Real-time zero-error kitchen coordination | FR-012 to FR-016, NFR-002, NFR-005 | WebSocket Integration Test \+ Hardware Printer Demo | Sub-500ms KDS delivery; offline reconnect syncs 100% tickets |
| Increase check size & guest delight during wait | FR-008, FR-017 to FR-020 | Functional Demo \+ A/B Analytics Inspection | Live countdown updates accurately; upsells apply promo price |
| Accurate split billing, payments & tax compliance | FR-025 to FR-031, NFR-007 | Automated Financial Ledger Unit Tests \+ Gateway Sandbox | Sum of split payments \=== exact invoice total; 0 rounding drift |
| Actionable owner visibility & staff accountability | FR-032 to FR-036, NFR-008 | RBAC Matrix Test \+ Audit Log Inspection | Explicit `DENY` overrides `GRANT`; all voids logged immutably |

# **9\. End-to-End Development to Production Lifecycle**

## **9.1 Recommended Production Tech Stack**

| Layer | Recommended Technology | Rationale |
| :---- | :---- | :---- |
| Monorepo & Build | Turborepo \+ pnpm \+ TypeScript 5.x | Shared Zod validation schemas & API types across frontend/backend. |
| Guest PWA & Admin UI | Next.js (App Router) \+ Tailwind CSS \+ TanStack Query \+ Zustand | Fast SSR/ISR for SEO/menu load, PWA offline caching, crisp state sync. |
| Backend API & Real-Time | NestJS (Node.js 22 LTS) \+ Socket.IO \+ Redis Adapter | Modular architecture, native DI, strict DTO validation, scalable WebSockets. |
| Primary Database & ORM | PostgreSQL 16 (RDS / Cloud SQL / Supabase) \+ Drizzle or Prisma \+ PgBouncer | ACID financial integrity, native JSONB, rock-solid Row-Level Security. |
| Background Jobs & Queues | BullMQ (Redis) | Reliable async PDF invoice generation, email/WhatsApp dispatch, webhook retries, inventory sync. |
| Print Bridge | Lightweight Electron / Node.js local service (`node-thermal-printer` / raw TCP 9100\) | Driverless ESC/POS support across Windows, Linux, Raspberry Pi. |
| Infrastructure & CI/CD | Docker \+ Terraform \+ GitHub Actions \+ AWS ECS/EKS (or GCP Cloud Run) \+ Cloudflare | Reproducible environments, zero-downtime blue/green or canary rollouts. |
| Observability | OpenTelemetry \+ Grafana/Prometheus \+ Sentry \+ Loki/Datadog | Real-time KDS latency alerts, error tracing, slow query monitoring. |

## **9.2 Phased Development Roadmap (16 Weeks to Full Production)**

* **Phase 1: Core Foundation & MVP (Weeks 1–6)**  
  * Multi-tenant PostgreSQL schema, RLS middleware, Auth \+ 3-layer RBAC, Outlet & Menu Builder, Signed QR Generator, Guest Menu & Cart PWA, Basic Order Submission, Live Floor Map, and Owner Live KPI Dashboard.  
* **Phase 2: Kitchen Operations, Split Billing & Payments (Weeks 7–11)**  
  * Station-based KDS with timers/chimes, ESC/POS Print Bridge, Call Waiter quick-action alerts, Split-Bill Engine (equal/item/custom), Tipping, PCI-DSS Payment Gateway Integrations (UPI, Razorpay, Stripe, Apple/Google Pay), Statutory Tax Invoicing, and Digital Receipts.  
* **Phase 3: Engagement, Inventory & Hardening (Weeks 12–14)**  
  * Wait-time countdown & Wi-Fi copy card, Loyalty Wallet, Multiplayer Mini-Games (*Spice Quiz*), 5-Star Review routing, Recipe-linked Inventory auto-deduction, Shift Register Z-Reports, and Offline-First IndexedDB Delta-Sync.  
* **Phase 4: QA, Pilot Launch & Production Scale (Weeks 15–16)**  
  * Load & chaos testing (simulating Friday-night rush \+ Wi-Fi drops), security audit & penetration test, 2-week live pilot at 3–5 beta restaurants, telemetry tuning, and General Availability (GA) launch.

## **9.3 Quality Assurance & Testing Strategy**

1. **Unit Testing (Vitest/Jest):** 100% branch coverage on tax slabs, split-bill remainder distribution, currency arithmetic, RBAC denial precedence, and upsell pricing rules.  
2. **Multi-Tenant Isolation Tests:** Automated suite spinning up two concurrent tenants (`Tenant A` and `Tenant B`) and verifying every endpoint, WebSocket room, and raw SQL query strictly blocks cross-tenant reads and writes.  
3. **End-to-End (E2E) Testing (Playwright):** Simulates full dining journeys across 3 concurrent browser contexts (Guest 1 mobile \+ Guest 2 mobile \+ Staff KDS/Floor tablet) from QR scan \-\> multi-round order \-\> KDS bump \-\> Call Waiter \-\> Split Pay \-\> Digital Receipt.  
4. **Load & Chaos Testing (k6):** Simulates 500 outlets during peak dinner rush (50,000 active WebSocket connections, 500 orders/sec) plus simulated Redis restarts and client network disconnects to validate zero order loss.

## **9.4 CI/CD Pipeline & Deployment Architecture**

* **Environments:** `Local (Docker Compose)` \-\> `Dev/Preview (Per-PR Ephemeral)` \-\> `Staging (Production Mirror with Sandbox Gateways)` \-\> `Production (Multi-AZ)`.  
* **Automated CI Pipeline (GitHub Actions):** Lint & Typecheck \-\> Unit & RLS Isolation Tests \-\> SAST/Dependency Security Scan (Trivy/Snyk) \-\> Build & Sign Container Images \-\> Deploy to Staging \-\> Run Playwright E2E Smoke Suite \-\> Manual Approval Gate \-\> Zero-Downtime Rolling/Canary Production Deploy.  
* **Database Migrations (Expand-and-Contract Pattern):** All schema changes must be backward-compatible during rollout (add nullable column \-\> backfill \-\> deploy app \-\> add `NOT NULL` constraint) to guarantee zero downtime during active restaurant service hours; migrations run exclusively during low-traffic windows (e.g., 03:00–05:00 local venue time).

## **9.5 Observability, Monitoring & Incident Response**

* **Golden Signals & Business Alerts:**  
  * P1 Pager Alert: Payment webhook failure rate \> 1% over 5 mins, API 5xx rate \> 0.5%, WebSocket disconnect spike \> 10%, or PostgreSQL connection pool \> 85%.  
  * P2 Warning Alert: KDS event delivery P95 \> 800ms, BullMQ receipt queue lag \> 60s, or slow query \> 300ms.  
* **Backup & Disaster Recovery:** Continuous PostgreSQL Point-in-Time Recovery (PITR) with automated daily encrypted snapshots replicated cross-region; **RPO \<= 5 minutes**, **RTO \<= 30 minutes**, tested via quarterly restore drills.

## **9.6 Production Readiness & Go-Live Checklist**

- [ ] All tenant tables verified with `ENABLE` and `FORCE ROW LEVEL SECURITY` in production Postgres.  
- [ ] Live PCI-DSS payment gateway keys, webhook signing secrets, and automated duplicate-charge alerts verified with real small-value penny-drop transactions.  
- [ ] WAF rate-limiting rules enabled on QR bootstrap, OTP, and payment endpoints.  
- [ ] Statutory tax invoice numbering sequences and GST/VAT breakdowns audited by a domain accountant.  
- [ ] Venue onboarding kit ready: UV-laminated table QR tent cards (with tamper-inspection checklist), pre-configured KDS tablets, tested ESC/POS LAN printers, and 15-minute staff training SOP.  
- [ ] Automated rollback playbook verified: instant container revert via Helm/ECS \+ feature-flag kill switches for non-critical modules (e.g., Mini-Games, Upsell Engine) so core ordering and billing remain rock-solid under any incident.

