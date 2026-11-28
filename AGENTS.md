<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

## PlateBeam Project & Architecture Rules

### 1. Authoritative References
- **Visual Design System:** [DESIGN.md](file:///home/syed/Workspace/PlateBeam/DESIGN.md) (Obsidian `#09090B` / Carbon `#111115` + Beam Orange `#FF5412` for Ops; Warm Cream `#FAF7F2` for Guest QR; Inter + JetBrains Mono)
- **Design Prototype:** [PlateBeam_OS___Live_Restaurant_Operating_System.html](file:///home/syed/Workspace/PlateBeam/PlateBeam_OS___Live_Restaurant_Operating_System.html)
- **Implementation Gap Spec:** [DESIGN_DIFF_REPORT.md](file:///home/syed/Workspace/PlateBeam/DESIGN_DIFF_REPORT.md)
- **Product Truth:** [PRODUCT.md](file:///home/syed/Workspace/PlateBeam/PRODUCT.md)

### 2. Next.js 16 & React 19.2 Conventions
- **Async Request APIs:** Always `await params`, `await searchParams`, `await cookies()`, and `await headers()` in Server Components and Route Handlers.
- **Server vs. Client Boundaries:** Keep `page.tsx` and `layout.tsx` as Server Components. Push `"use client"` to interactive leaf components (`src/components/ops/*`, `src/components/guest/*`, `src/components/auth/*`). Use `<Suspense>`, `loading.tsx`, and `error.tsx` for streaming.
- **Cache Components (`next.config.ts`):** `cacheComponents: true` and `partialPrefetching: true` are enabled with `menuCatalog` and `analyticsLive` profiles. Use `'use cache'`, `cacheLife(...)`, and `cacheTag(...)` for cacheable server reads, and invalidate via `updateTag()` / `revalidateTag()` in mutations.
- **Network Boundary (`src/proxy.ts`):** Export `proxy(request: NextRequest)` (never `middleware`). Keep it lightweight (redirects, trace/tenant headers, session cookie checks — no DB queries).

### 3. Backend & Domain Integrity (`src/server/`)
- **Hexagonal Architecture:** Keep business logic in `src/server/core/*.service.ts` behind port interfaces (`src/server/ports/*`) and adapters (`src/server/adapters/*`).
- **Exact Money:** Always store and compute money in integer minor units (`*Minor` fields).
- **Multi-Tenant & Security:** Enforce `tenantId` / `outletId` scoping, HMAC-signed QR tokens (`qr-security.service.ts`), and 3-layer RBAC (`(Role Default + Grant) - Explicit Deny`, where `DENY` always wins).
- **Offline Resilience:** Preserve IndexedDB delta-sync (`src/lib/offline/db.ts`, `src/lib/offline/sync-manager.ts`) for FOH POS and KDS.

### 4. Verification
Before concluding any code change, run:
- `npm run typecheck`
- `npm run lint`
- `npm test` (and `npm run build` for route/config changes)
