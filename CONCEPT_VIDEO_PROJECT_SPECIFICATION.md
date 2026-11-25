# PlateBeam: Complete Concept Video Project Specification & Idea Blueprints

> **Source Material:** Promotional Concept Video (`PlateBeam-concept.mp4` / WebSoln Labs `@websolnlabs`)  
> **Target Persona:** Modern Dine-in & Quick-Service Restaurant Operators, Staff, and Diners  
> **Demonstration Venue:** *Zaika Bistro & Bar* (Gulshan / Indore Flagship Concept, Table 5 Demo)  
> **Core Value Proposition:** *"Your waiter cannot be at every table at once, but your website can."* — Seamlessly synchronizing Guests, Front-of-House (FOH), Kitchen (KDS), and Management through a zero-app web platform.

---

## 1. Executive Summary & Vision

PlateBeam transforms the traditional high-friction dining model into an all-in-one, synchronized real-time web operating system. The concept video illustrates a frictionless **10-step dining journey** experienced by two diners (**Aman & Riya**) at **Table 5**, capturing interactions across three distinct user roles:

1. **The Diners (Guest Web Portal):** Zero-app browser ordering, personalized allergen/spice filters, automated pairing upsells, wait-time gamification (trivia, Wi-Fi credentials), call-waiter dispatch, and an instant split-bill checkout.
2. **The Floor Staff & Captains (FOH POS Tablet):** One-tap captain order approval, color-coded floor status tracking, instant waiter service request alerts, and counter takeaway token generation.
3. **The Kitchen Line (Obsidian KDS & Expo):** Multi-station ticket sorting (Tandoor, Curry, Bar, Fry), live elapsed preparation timers with SLA color escalation, and bump-bar hardware shortcuts.
4. **The Restaurant Owner / General Manager (Executive Command Center):** Bird's-eye operational analytics, live table occupancy, GMV/revenue tracking, BCG menu engineering matrix, and automated review routing.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PLATEBEAM REAL-TIME CORE                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   GUEST PORTAL   │       │   FOH FLOOR POS  │       │   KITCHEN KDS    │
│  (Zero-App PWA)  │       │ (Staff Tablet)   │       │(Obsidian Surface)│
│                  │       │                  │       │                  │
│ • HMAC Table QR  │       │ • Live Floor Map │       │ • Station Split  │
│ • Dynamic Menu   │◄─────►│ • Waiter Alerts  │◄─────►│ • Elapsed Timers │
│ • Spice Quiz     │       │ • Captain Review │       │ • SLA Visuals    │
│ • Split Checkout │       │ • Table Transfer │       │ • Recall Action  │
└──────────────────┘       └──────────────────┘       └──────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ OWNER COMMAND CENTER │
                         │                      │
                         │ • Live Occupancy %   │
                         │ • Real-time Sales    │
                         │ • BCG Menu Matrix    │
                         │ • Google Review CTA  │
                         └──────────────────────┘
```

---

## 2. Chronological Feature & Workflow Breakdown (The 10-Step Journey)

### Step 00: The Hook — Eliminating the Labor Bottleneck (0:00 – 0:05)
* **Problem Addressed:** High labor turnover, peak-hour order delays, and diners waving frantically for staff attention.
* **Visual Representation:** An animated bird's-eye floor grid with tables `T1` to `T6`. Flashing alert exclamation points illuminate as a single waiter dot scrambles between tables, quickly becoming overwhelmed. The waiter icon is smoothly replaced by illuminated smartphones placed atop each table.
* **Core Philosophy:** Rather than replacing human hospitality, the software automates ordering and transaction friction, freeing staff to focus on genuine guest engagement and hospitality.

---

### Step 01: Zero-App Instant QR Onboarding (0:06 – 0:11)
* **Diner Action:** Guests sit at **Table 05** and point their native smartphone camera at the table-top QR sticker.
* **Frontend UI & Experience:**
  * **Instant Web Landing:** Opens immediately in Mobile Safari or Chrome with no App Store download, account registration, or SMS OTP requirement.
  * **Table & Venue Header:** Displays the venue brand (*Zaika Bistro & Bar*), table number (*Table 5*), and dining session type.
  * **Cryptographic Anti-Spoofing:** Dynamic HMAC-signed URL tokens (`/t/{hmac_token}`) prevent malicious customers from changing URL parameters (e.g., editing `?table=3` to order food to other tables).
  * **Wi-Fi & GPS Validation:** Geofence verification ensures the device is physically located inside the venue perimeter.

---

### Step 02: Digital Menu, Customization & Upsell Deals (0:12 – 0:23)
* **Diner Action:** Diners browse the rich visual menu, customize dishes to their dietary needs, and accept pairing recommendations.
* **Frontend UI & Experience:**
  * **Category Navigation:** Horizontal sticky pills for *Starters*, *Mains*, *Breads*, *Desserts*, and *Beverages*.
  * **Dietary & Allergen Badges:** High-contrast tags highlighting allergens (e.g., `Contains Dairy`, `Tree Nuts`, `Gluten-Free`) and dietary preferences (`Veg`, `Non-Veg`, `Jain`, `Halal`).
  * **Dish Customization Dialog:**
    * **Portion Selection:** Radio buttons for `Half` vs. `Full` portions.
    * **Spice Level Customizer:** Visual flame indicators for `Mild`, `Medium`, and `Extra Spicy`.
    * **Cooking Instructions:** Freeform text input for special preparation requests (e.g., *"Less oil, extra crispy"*).
  * **Chef Upsell Recommendation:** An automated modal pairing dialog triggered when adding mains (e.g., *"Add Mango Lassi for ₹99"* paired with *Paneer Makhani* & *Dal Makhani*), increasing Average Order Value (AOV).

---

### Step 04: Staff Dispatch & Station-Routed KDS (0:24 – 0:33)
* **Staff & Kitchen Action:** The order is confirmed on the floor terminal and instantly dispatched to cooking stations.
* **Frontend UI & Experience:**
  * **Floor Staff Tablet (`/pos`):**
    * Incoming order notification banner: `TABLE 5 · 2 GUESTS · 4 items · ₹1,200`.
    * Items itemized: *Paneer Makhani (₹320), Dal Makhani (₹280), 4x Garlic Naan (₹280), 2x Mango Lassi (₹240)*.
    * **One-Tap Captain Approval:** Floor lead taps "Accept & Fire" to prevent accidental orders or kitchen overloading.
  * **Kitchen Display System (`/kds`):**
    * **Automatic Multi-Station Routing:** The single customer order is split across kitchen line displays:
      * **Tandoor Station:** Displays `T5 · 00:14 · 4x Garlic Naan` (alongside queue item `T3 · 04:23 · Paneer Tikka`).
      * **Curry Station:** Displays `T5 · 00:21 · Paneer Makhani + Dal Makhani`.
      * **Bar / Beverage Station:** Displays `T5 · 2x Mango Lassi`.
    * **Elapsed Timers:** Real-time counters showing exact cooking time elapsed.

---

### Step 05: The Wait Experience — Live Timers, Wi-Fi & Games (0:34 – 0:44)
* **Diner Action:** While the kitchen prepares the food, the customer's phone switches from an order menu to an interactive wait console.
* **Frontend UI & Experience:**
  * **Dynamic Cook Countdown:** Displays an estimated preparation timer (e.g., *"Your food is cooking · 10:48 remaining"*), calculated dynamically from active station queue depth.
  * **1-Tap Guest Wi-Fi Card:** Prominently presents the restaurant's SSID (`Zaika_Guest`) and password (`zaika2026`) with a single-tap "Copy" button or Wi-Fi QR setup, eliminating repetitive staff inquiries.
  * **Multiplayer Table Mini-Games ("Spice Quiz"):**
    * Interactive trivia game testing knowledge of culinary spices, ingredients, and trivia.
    * **Table vs. Table Competition:** Live scoreboard displaying points (*Aman: 3 pts vs. Riya: 2 pts*).
    * **Incentive Engine:** High daily scorers unlock promotional rewards (e.g., 5% off dessert voucher code).

---

### Step 06 & 07: Call Waiter & Live Floor Map Telemetry (0:45 – 0:56)
* **Diner & Staff Action:** Diners request physical assistance without flagging down staff; staff monitors the entire floor state live.
* **Frontend UI & Experience:**
  * **One-Tap "Call Waiter" Dialog:**
    * Prompts the diner with quick preset tags: `Water`, `Napkins`, `Extra Cutlery`, `Clean Table`, `Bill Assistance`.
    * Generates an immediate silent push alert to staff.
  * **Live Color-Coded Floor Map (`/pos`):**
    * Bird's-eye architectural view of restaurant zones and tables:
      * 🟢 `VACANT` (Table free for seating)
      * 🟡 `ORDERING` (Guests actively browsing/building cart)
      * 🔵 `EATING` (Dishes served, dining in progress)
      * 🟣 `BILL_REQUESTED` (Payment calculation in progress)
      * 🔴 `HELP / ASSISTANCE` (Flashing alert: `T5: WAITER - 00:01 (Water)`)
    * 1-Tap claim and resolve buttons for floor runners.

---

### Step 08: 2-Tap Dynamic Split Billing & Multi-Tender Checkout (0:57 – 1:07)
* **Diner Action:** Guests settle their bill at the table without waiting for a physical paper folder or EDC card machine.
* **Frontend UI & Experience:**
  * **Consolidated Bill Summary:** Complete itemization across all dining rounds (*Paneer Makhani, Dal Makhani, Garlic Naan x4, Mango Lassi x2, Gulab Jamun* — Subtotal: ₹1,200).
  * **Flexible Split Engine:**
    * **Split Evenly:** Select 2, 3, or N guests (e.g., ₹600 each for 2 diners), mathematically balanced down to integer minor units with zero rounding drift.
    * **Split by Item:** Diners tap checkboxes next to their specific consumed dishes.
    * **Custom Amount:** Manual contribution entry.
  * **Pre-Tax Tip Presets:** Quick tip percentage chips (`5%`, `10%`, `15%`, or Custom ₹ Amount).
  * **Multi-Tender Payment Methods:**
    * **Mobile / UPI:** Instant deep-link or QR for PhonePe, Google Pay, Paytm, BHIM.
    * **Cards & Digital Wallets:** Apple Pay, Google Pay, Visa/Mastercard credit/debit.
    * **Cash / Counter EDC:** Option to request staff to bring physical terminal or cash change.

---

### Step 09: Automated Statutory E-Receipt & 5-Star Review Routing (1:08 – 1:13)
* **Diner Action:** Diner receives their official bill and submits instant dining feedback.
* **Frontend UI & Experience:**
  * **Instant E-Receipt:** Delivered automatically via email (`aman@gmail.com`) or SMS/WhatsApp, containing statutory GST/VAT tax breakdown and fiscal invoice numbers.
  * **Intelligent Review Routing:**
    * **Interactive Star Rating:** *"How was your meal?"* with 5 animated stars.
    * **Positive Sentiment (4–5 Stars):** Automatically redirects to the restaurant's live **Google Maps Review** page with a pre-filled prompt to drive public SEO ranking.
    * **Constructive Feedback (1–3 Stars):** Diverts to a private feedback form and alerts the floor manager in real-time for immediate table-side service recovery before the guest exits.

---

### Step 10: Executive Owner Command Center & Platform BI (1:14 – 1:27)
* **Owner / Manager Action:** Real-time visibility over the entire venue's operational rhythm and financial health.
* **Frontend UI & Experience:**
  * **Live KPI Ribbon:**
    * **Table Occupancy:** `6/6 Tables (100% Capacity)`
    * **Live Order Volume:** `46 Orders Placed`
    * **Gross Daily Sales:** `₹48,500 Gross Sales Today`
    * **Average Ticket / AOV:** Running basket averages
    * **Kitchen SLA Performance:** Average preparation duration and on-time readiness percentage.
  * **Payment Mix Telemetry:** Visual distribution across UPI, Credit/Debit Cards, Cash, and Digital Wallets.
  * **BCG Menu Engineering Matrix:** Categorizing dishes into *Stars* (high margin, high popularity), *Plowhorses* (low margin, high popularity), *Puzzles* (high margin, low popularity), and *Dogs* (low margin, low popularity).
  * **Instant 86 Switch:** Emergency stock toggle to disable sold-out dishes across all customer phones venue-wide in under 1 second.

---

## 3. Visual & Design System Guidelines

The visual aesthetic captured in the video combines high-end hospitality editorial warmth with high-contrast kitchen utility:

| Component / Layer | Visual Design Spec | Technical Tokens |
|---|---|---|
| **Primary Theme** | Deep Obsidian Black & Charcoal Slate | `--pb-canvas: #111315`, `--pb-surface: #1B1E23` |
| **Accent / Highlight** | Saffron Orange & Amber Ember | `--pb-accent: #F07346`, `--pb-accent-ink: #FFFFFF` |
| **Typography (Display)**| Editorial Serif (Warm, upscale bistro feel) | `font-serif` (`Instrument Serif`, `Playfair Display`) |
| **Typography (Body/UI)**| Clean Geometric Sans-Serif | `font-sans` (`Plus Jakarta Sans`, `Inter`) |
| **Typography (Data/POS)**| Monospaced tabular numerals | `font-mono` (`JetBrains Mono`) |
| **Floor Status: Vacant** | Neutral Muted Slate | `bg-emerald-500/10 text-emerald-400 border-emerald-500/30` |
| **Floor Status: Ordering**| Radiant Amber Glow | `bg-amber-500/10 text-amber-400 border-amber-500/30` |
| **Floor Status: Eating** | Cool Azure Blue | `bg-blue-500/10 text-blue-400 border-blue-500/30` |
| **Floor Status: Alert** | High-Intensity Crimson Pulse | `bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse` |

---

## 4. Complete Application Surface Directory

Below is the definitive routing map realizing the concept video into a production software architecture:

| Surface Name | Route Path | Target Device | Core Video Demonstration |
|---|---|---|---|
| **Home / Surface Hub** | `/` | Desktop / Mobile | Unified launcher for all surfaces & brand introduction |
| **Staff & Owner Login** | `/login` | All Devices | 4-Digit Staff PIN quick-switcher + Owner credentials |
| **Guest QR Dining Portal**| `/t/[qrToken]` | Mobile Smartphones | Steps 01, 02, 05, 06, 08, 09 (Menu, Quiz, Call, Split) |
| **FOH POS & Floor Map** | `/pos/[outletSlug]`| Tablets / Laptops | Steps 04 & 07 (Order dispatch, Floor grid, Waiter alerts) |
| **Obsidian Kitchen (KDS)**| `/kds/[outletSlug]`| Wall Mount Touchscreens | Step 04 (Multi-station ticket routing & SLA prep timers) |
| **Owner Command Center** | `/dashboard` | Desktop / iPad Pro | Step 10 (Live KPIs, Occupancy, Menu Matrix, 86 Controls) |
| **Platform Super-Admin** | `/admin` | Desktop Web | Multi-tenant SaaS provisioning & global compliance |

---

## 5. Architectural Verification & Security Safeguards

To prevent common vulnerabilities identified in standard QR ordering software, this project enforces the following system invariants:

1. **Anti-URL Tampering (FR-001):** QR codes encode opaque HMAC-SHA256 tokens signed with a venue secret. Guessing or incrementing table numbers in the browser address bar is mathematically impossible.
2. **Instant QR Invalidation (FR-002):** If a customer photographs a table QR code and leaves the restaurant, managers can rotate the token in 1 tap from `/pos`, instantly severing any external attempt to order from home.
3. **Physical Proximity Safeguards (FR-004):** Built-in GPS geofencing and venue Wi-Fi subnet validation reject orders placed outside the restaurant boundary.
4. **Zero-Drift Minor Unit Accounting (FR-026):** Split-bill algorithms compute shares using integer minor units (paisa/cents) and the Hamilton largest-remainder method, ensuring the sum of split transactions matches the statutory tax invoice down to the exact cent.
5. **Captain Approval Safety Net (FR-012):** High-value or takeaway orders can be gated behind a captain verification tap, preventing prank orders from firing expensive meats or seafood to the grill without staff confirmation.

---

*Document compiled from comprehensive frame-by-frame and architectural analysis of `PlateBeam-concept.mp4`.*
