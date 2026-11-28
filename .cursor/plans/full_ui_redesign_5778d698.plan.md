---
name: Full UI Redesign
overview: Update modern-web-guidance, baseline-test every PlateBeam surface across desktop/tablet/mobile, then replace the entire visual world (palette, type, theme) across Home, Login, Guest, POS, KDS, Dashboard, and Admin while preserving product functions and PlateBeam naming.
todos:
  - id: mwg-update
    content: Update modern-web-guidance skill to latest; re-retrieve guides
    status: completed
  - id: product-md
    content: Write PRODUCT.md from existing SRS/code product truth
    status: completed
  - id: baseline-browser
    content: Start/seed app; multi-viewport + real flow baseline review
    status: completed
  - id: direction
    content: Impeccable concept-seed; lock full replacement visual world
    status: completed
  - id: design-system
    content: Replace tokens, fonts, shared UI primitives
    status: completed
  - id: surfaces
    content: Redesign Home, Login, Guest, POS, KDS, Dashboard, Admin
    status: completed
  - id: verify-finish
    content: Re-test flows/viewports; detect; DESIGN.md via documenter
    status: completed
isProject: false
---

# PlateBeam Full-Surface Visual Replacement

## Locked decisions

- **Scope:** All surfaces in one pass — Home, Login, Guest QR, POS, KDS, Dashboard, Admin
- **Visual world:** Full replacement (new palette, type, theme). Keep **PlateBeam** name, Zaika demo content, and existing product functions only
- **Build path:** **Code-led** Impeccable new-work (direction contract + QUALITY BAR; no per-surface comps). Fits a 7-surface OS rewrite without stalling on hero-gate loops
- **KDS constraint (product truth, not old look):** Kitchen remains **high-contrast dark-first** for bright kitchens — expressed in the *new* world, not as a polish of Obsidian Charcoal
- **Database:** Prefer existing seed + APIs. Touch Supabase only if guest/QR/auth flows fail without seed or a real schema fix

## Phase 0 — Update Modern Web Guidance

Run from project root:

```bash
npx modern-web-guidance@latest update
```

Confirm skill version moves toward `2026_11_16-*`. Re-search/retrieve guides used for this work (`form-factor-adaptation`, `responsive-design`, `css`, `accessibility`, `dialog`, `css-layout`, `browser-ui-theming`).

Impeccable launcher path (previous call missed `skills/impeccable/`):

`/home/syed/.cursor/plugins/cache/cursor-public/impeccable/.../skills/impeccable/scripts/impeccable`

## Phase 1 — Product truth + baseline review

1. Write [`PRODUCT.md`](PRODUCT.md) from SRS / concept / codebase (users, jobs, constraints; no visual recipes).
2. Start app: `npm run db:seed` (if needed) + `npm run dev`.
3. Browser automation baseline at **1440 / 768 / 390** for:
   - `/` Home
   - `/login` (PIN + email)
   - `/t/<seeded-qr>` Guest
   - `/pos/zaika-bistro` POS
   - `/kds/zaika-bistro` KDS
   - `/dashboard` Owner
   - `/admin` Super-admin
4. Exercise real flows: QR bootstrap → cart → order → call waiter → split/pay (sandbox); POS PIN → floor claim → approve; KDS bump/recall; dashboard 86; admin tenant list.
5. Capture UI/UX findings (demo fallbacks masking DB, no POS/KDS live poll/SSE, missing PWA icons, CSS token holes, soft API auth, static home metrics).

## Phase 2 — Impeccable direction (replacement world)

1. Run Impeccable `concept-seed --scope direction` with mode **Persuade** for the Home hub as the world-defining surface; Operate surfaces inherit the same world grammar.
2. Present direction cards; user locks one (or assigned direction if unattended after wait fallback).
3. Persist surface brief + **Direction contract** for `/` (THESIS / OWN-WORLD / STORY / FIRST VIEWPORT / FORM / FINISH).
4. Anti-defaults to avoid: cream+terracotta editorial, purple SaaS glow, broadsheet hairlines, Inter/Plus Jakarta as display (current Instrument Serif + Plus Jakarta + saffron must be abandoned as the *system*, not lightly retinted).

## Phase 3 — System rebuild then cascade

Rebuild design system first, then restyle every surface in one grammar:

| Layer | Primary files |
|-------|----------------|
| Tokens + fonts | [`src/app/globals.css`](src/app/globals.css), [`src/app/layout.tsx`](src/app/layout.tsx) |
| Shared UI | [`src/components/ui/*`](src/components/ui/) |
| Home (Persuade) | [`src/app/page.tsx`](src/app/page.tsx) |
| Auth | [`src/components/auth/LoginClient.tsx`](src/components/auth/LoginClient.tsx) |
| Guest | [`src/components/guest/*`](src/components/guest/) |
| POS / KDS / Owner / Admin | [`src/components/ops/*`](src/components/ops/) |
| PWA | [`public/manifest.json`](public/manifest.json) + generate missing icons |

Implementation rules:

- Preserve API contracts and behavior; redesign presentation, hierarchy, motion, and chrome
- Apply Modern Web Guidance: `dvh` / safe-area, 44px+ coarse targets, container queries, native `<dialog>`, `light-dark()` / theme tokens, reduced-motion
- Fix redesign blockers only: PWA icons, undefined CSS utilities (`pb-safe-bottom-bar`, Login `bg-card`/`destructive`), guest demo QR link → seeded token path, optional light POS/KDS refresh (SSE or short poll) so live floors/tickets update during flows
- No Nest/Redis rewrite; no inventing commercial claims

## Phase 4 — Verify + finish

1. Re-run the same multi-viewport + user-flow matrix after redesign.
2. Impeccable `detect` on changed UI targets; one fix batch; one confirm round.
3. Spawn finish reviewer + documenter → write [`DESIGN.md`](DESIGN.md) + `.impeccable/design.json` from the shipped world.
4. Brief report: what passed, what still fails functionally (auth soft-gates, schema drift, shallow merge) vs what was redesign-scoped.

## Out of scope this run

- Full API auth hardening / SQL↔Drizzle enum reconciliation / deep MERGE-TRANSFER-SPLIT ledger logic / Redis Socket.IO / production observability — track as follow-ups unless a flow is completely blocked.
