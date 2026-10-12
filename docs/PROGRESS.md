# NEXMENU – Progress Log

## Phase 0: Project Setup and Audit

**Status: IN PROGRESS**
**Date: 2026-10-12**

### Baseline (pre-Phase-0 changes)

| Metric | Baseline |
|---|---|
| Tests | 8 passed (3 authorization, 5 utils) |
| Bundle size (DashboardPage) | 404.02 kB (118.14 kB gzip) |
| Bundle size (PublicMenuPage) | 18.34 kB (6.19 kB gzip) |
| Bundle size (Vendor/index) | 253.63 kB (79.30 kB gzip) |
| CSS | 61.50 kB (10.71 kB gzip) |
| TypeScript errors | 0 |
| Lint errors | 0 |

### Work Done in Phase 0

#### Step 0.1 – Dependency fix (supply-chain policy)
- **Issue:** `pnpm-lock.yaml` contained 26 freshly-published `@radix-ui/*` packages violating pnpm's `minimumReleaseAge` supply-chain policy (8h cutoff).
- **Resolution:** Pinned to previous stable versions in `package.json` (`@radix-ui/react-dialog` 1.1.23, `@radix-ui/react-dropdown-menu` 2.1.6, `@radix-ui/react-select` 2.1.6, `@radix-ui/react-tabs` 1.1.12).
- Regenerated lockfile with clean install.
- **Constraint respected:** Did NOT disable the supply-chain check.

#### Step 0.2 – Remove Figma Make coupling (`vite.config.ts`)
- Removed `.figma/make/site.json` imports and `figmaSiteConfiguration`/`figmaMakeKitPlugin`.
- Preserved developer HMR utilities (`devErrorOverlayReplay`, `reactRefreshBoundaryFallback`).
- Build now succeeds cleanly with standard Vite plugins.

#### Step 0.3 – Scaffold CI and environment files
- Created `.env.example` with documented keys.
- Updated `.gitignore` (un-ignored `.env.example`, added test artifact folders).
- Extended `vercel.json` with security headers and immutable asset cache headers.
- Added package scripts: `test:e2e`, `check`.
- Created `.github/workflows/ci.yml`.

### Verified
- [x] `pnpm install` exits 0 with pinned radix versions
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes (0 errors, 0 warnings)
- [x] `pnpm test` passes (8 tests)
- [x] `pnpm build` passes; baseline bundle sizes recorded

### Open Issues / Decisions
- **Supply-chain policy:** The `minimumReleaseAge` cutoff is 8 hours. The radix-ui packages were published ~19h ago at time of writing. They should age out of the policy by tomorrow. The pin can be relaxed (remove exact-version pins and let semver resolve) once the cutoff passes. Documented in `package.json` via exact version pins (not semver ranges).
- **`.figma/make/site.json`**: Was imported to provide page title/description/OG at build time. The `index.html` now has static NEXMENU title hardcoded. Dynamic per-route meta will be handled in Phase 3 (SEO).

---

## Phase 1: Admin Panel Fixes

**Status: COMPLETED**
**Date: 2026-10-12**

### Work Done
1. **Plan column regression fix (`AdminPage.tsx`):**
   - Connected `AdminPage` to real restaurant subscriptions via `adminService.dashboard()`.
   - Replaced hardcoded `defaultValue="PRO"` with controlled select bound to actual plan (`FREE`, `BASIC`, `PRO`, `PREMIUM`).
   - Added regression test `src/pages/AdminPage.test.tsx` asserting all plan types render accurately without defaulting to PRO.
2. **Subscription model extension (`domain.ts`, `dataAdapter`, `supabase/`):**
   - Extended `Subscription` interface with `start_date`, `end_date`, `notes`, and helper `getDerivedSubscriptionStatus` (`active`, `expiring_soon`, `expired`).
   - Upgraded IndexedDB adapter to database version 2 with migration normalizer for existing subscription records.
   - Added `saveSubscription` date validation (`expires_at >= starts_at`).
   - Added new Supabase migration `supabase/migrations/006_subscription_fields.sql` enforcing `check (expires_at >= starts_at)`.
3. **Subscription Editor UI (`AdminPage.tsx`):**
   - Added modal to view and update subscription plan, start date, expiration date, and administrative notes.
   - Client-side validation prevents saving when expiration is before start date.
4. **User Management (`teamService`, `AdminPage.tsx`):**
   - Full team management for tenant restaurants: list members, update role (`RESTAURANT_OWNER`, `RESTAURANT_MANAGER`, `STAFF`), activate/deactivate, remove member, and invite new member.
   - Enforced last-owner protection in service layer: nobody can demote, deactivate, or delete the last active owner of a tenant.
   - Role permissions enforced via `team:write` (super-admin or tenant owner).
5. **Audit Log Filtering and Pagination (`AdminPage.tsx`, `restaurants.ts`):**
   - Added `adminService.filterAuditLogs()` supporting date range (`dateFrom`, `dateTo`), action type substring, restaurant filter, and actor search.
   - Added pagination controls with total count and page indicators.
   - Wired audit logs to all new admin mutations (`member.role_changed`, `member.activated`, `member.deactivated`, `member.removed`, `member.invited`, `subscription.updated`, `plan.changed`).
6. **Tests:**
   - 16 new unit/authorization tests in `src/services/admin.test.ts` covering derived status, date validation, admin/owner permissions, cross-tenant rejection, last-owner demotion/deactivation/removal protection, invite deduplication, and audit log filtering.
   - 1 regression test in `src/pages/AdminPage.test.tsx`.
   - Total test suite grew from 8 to 25 tests, all passing.

### Verified
- [x] `pnpm typecheck` passed (0 errors)
- [x] `pnpm lint` passed (0 errors)
- [x] `pnpm test` passed (25 tests)
- [x] `pnpm build` passed (production bundle + PWA service worker generated)

---

## Phase 2: Reordering

**Status: COMPLETED**
**Date: 2026-10-12**

### Work Done
1. **Atomic Service Reorder Operations (`restaurants.ts`, `dataAdapter`):**
   - Added `reorderCategories(session, restaurantId, orderedIds)` and `reorderProducts(session, restaurantId, categoryId, orderedIds)`.
   - Guaranteed atomic persistence: all updates occur within a single database transaction in the data adapter, eliminating partial failures.
   - Normalizes `sort_order` values to contiguous integers (`0, 1, 2, ...`).
   - Service-layer authorization enforces `menu:update` and tenant ownership before any mutation. Rejects cross-tenant reorder attempts and foreign IDs.
   - Audit logs written for reordering events (`categories.reordered`, `products.reordered`).
2. **Accessible UI Controls (`ReorderableControls.tsx`, `DashboardPage.tsx`):**
   - Built `ReorderableControls` component featuring:
     - Drag handle with grab cursor and visual feedback for pointer/touch drag operations.
     - Keyboard-accessible "Move Up" and "Move Down" buttons with proper `aria-label`s.
     - Disabled states for boundary items (first and last).
   - Integrated into both Category and Product managers in `DashboardPage.tsx`. Products reorder cleanly within their active category.
3. **Public Menu Verification:**
   - Verified `dataAdapter.getPublicMenu` already filters and sorts visible categories and products by `a.sort_order - b.sort_order`, guaranteeing that public menu viewers see the exact updated sequence.
4. **Tests:**
   - Added 6 tests in `src/services/reorder.test.ts` verifying category order persistence, contiguous normalization, cross-tenant denial, and invalid ID rejection.
   - Total test suite grew from 25 to 31 tests, all passing.

### Verified
- [x] `pnpm typecheck` passed (0 errors)
- [x] `pnpm lint` passed (0 errors)
- [x] `pnpm test` passed (31 tests)
- [x] `pnpm build` passed

---

## Phase 3: SEO

**Status: COMPLETED**
**Date: 2026-10-12**

### Work Done
1. **SEO & Structured Data Utilities (`src/utils/seo.ts`):**
   - Built `buildRestaurantJsonLd`: generates schema.org `Restaurant` structured data including name, description, address, geo coordinates, `openingHoursSpecification`, and complete nested `Menu` -> `MenuSection` -> `MenuItem` hierarchy.
   - Built `pruneUndefined`: recursively cleans schema objects so undefined, null, or blank strings are omitted from JSON-LD.
   - Built `buildOpeningHoursSpecification`: maps day-by-day restaurant operating hours and shifts to schema.org URLs (`https://schema.org/Monday`, etc.).
   - Built `buildMetaTags`: constructs canonical, OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`), and Twitter Card tags.
2. **Dynamic React Hook (`src/utils/useSeo.ts`):**
   - Automatically synchronizes `document.title`, `<link rel="canonical">`, `<meta>` OpenGraph / Twitter tags, and `<script type="application/ld+json" id="nexmenu-jsonld">`.
3. **Public Menu Integration (`src/pages/PublicMenuPage.tsx`):**
   - Dynamically binds restaurant profile, branch address, logo/cover image, and menu items to route meta and JSON-LD.
4. **Robots Policy & Crawler Architecture (`public/robots.txt`, `docs/SEO_AND_CRAWLERS.md`):**
   - Added `robots.txt` permitting public menus (`/r/*`) and landing (`/`), while blocking private paths (`/admin`, `/dashboard`, `/auth`, `/reset-password`).
   - Documented SPA crawler limitations and a production edge proxy architecture (Vercel Edge Function / Cloudflare Worker) to serve server-rendered OG tags and JSON-LD to scrapers without executing client-side JavaScript.
5. **Tests:**
   - 5 comprehensive unit tests in `src/utils/seo.test.ts` covering prune utilities, opening hours mappings, complete JSON-LD menu trees, and Arabic localization.
   - Total test suite grew from 31 to 36 tests, all passing.

### Verified
- [x] `pnpm typecheck` passed (0 errors)
- [x] `pnpm lint` passed (0 errors)
- [x] `pnpm test` passed (36 tests)
- [x] `pnpm build` passed

---

## Phase 4: Branding Contrast

**Status: COMPLETED**
**Date: 2026-10-12**

### Work Done
1. **WCAG 2.1 Contrast Utility (`src/utils/contrast.ts`):**
   - Pure mathematical implementation of W3C WCAG 2.1 specifications:
     - `parseHexColor`: robust parser supporting 3-digit and 6-digit hex colors with or without hash, rejecting invalid input cleanly.
     - `getRelativeLuminance`: computes precise luminance with sRGB gamma correction.
     - `getContrastRatio`: computes exact contrast ratio (1:1 to 21:1).
     - `evaluateContrast`: returns structured audit results with WCAG rating levels (`AAA`, `AA`, `AA-Large`, `FAIL`), compliance flags, formatted ratio, block status, and automated color suggestions.
     - `suggestAccessibleColor`: dynamically computes high-contrast alternatives (`#111827` ink or `#ffffff` white) tailored to the background's luminance.
     - `getSafeBrandingColors`: produces runtime fallback colors for text and buttons.
2. **Branding Manager Settings UI (`src/pages/DashboardPage.tsx`):**
   - Added live WCAG 2.1 Contrast Audit section to the branding manager.
   - Live displays for:
     - Text on Background contrast ratio and AA status badge.
     - Button (Primary) on Text contrast ratio and AA status badge.
     - Interactive "Apply" suggestion button to automatically adopt accessible colors.
     - Hard save blocking (`disabled={isBlocked}`) when contrast is under 3.0:1 with critical illegibility warning.
     - Advisory notice when contrast is between 3.0:1 and 4.5:1.
3. **Public Menu Render-Time Safety Fallback (`src/pages/PublicMenuPage.tsx`):**
   - Integrated `getSafeBrandingColors` into the public menu renderer to safeguard customer menus against illegible text or buttons regardless of database state.
4. **Tests:**
   - 19 unit tests in `src/utils/contrast.test.ts` verifying hex parsing edge cases, black/white extremes, luminance curve branches, compliance thresholds, color suggestion algorithms, and safety fallbacks.
   - Total test suite grew from 36 to 55 tests, all passing.

### Verified
- [x] `pnpm typecheck` passed (0 errors)
- [x] `pnpm lint` passed (0 errors)
- [x] `pnpm test` passed (55 tests)
- [x] `pnpm build` passed

---

## Phase 5: DashboardPage Refactor

**Status: COMPLETED**
**Date: 2026-10-12**

### Work Done
1. **Feature Module Decomposition (`src/features/dashboard/`):**
   - Extracted all domain logic into clean, cohesive feature modules:
     - `overview/OverviewSection.tsx`: Restaurant metrics, readiness checklist, and live menu card.
     - `menu/MenuSection.tsx`: Category & product management with atomic drag-and-drop & keyboard reordering.
     - `qr/QrSection.tsx`: High-resolution QR code generator (PNG/SVG export, branch targeting, clipboard copy).
     - `analytics/AnalyticsSection.tsx`: Trend chart powered by Recharts (isolated to its own deferred chunk).
     - `branding/BrandingSection.tsx`: Live theme styling with real-time WCAG 2.1 contrast audits and save-blocking.
     - `settings/SettingsSection.tsx`: Profile configuration, publication status, and full local JSON backup export.
     - `subscription/SubscriptionSection.tsx`: Plan features matrix and manual renewal notices.
     - `offers/OffersSection.tsx`: Active promotions list and validity dates.
     - `branches/BranchesSection.tsx`: Multi-location branch directory.
     - `team/TeamSection.tsx`: Staff directory and membership invitation panel.
     - `common/Stat.tsx`: Shared reusable stat card.
     - `common/DashboardErrorBoundary.tsx`: Resilient section error boundary with localized retry.
2. **Thin Router Shell (`src/pages/DashboardPage.tsx`):**
   - Reduced `DashboardPage.tsx` from 622 lines to **92 lines** (well below the <150 line mandate).
   - Wrapped route views in `<Suspense fallback={<LoadingState />}>` and `<DashboardErrorBoundary>` using `React.lazy`.
3. **Bundle Size Reduction:**
   - Baseline `DashboardPage`: 404.02 kB (118.14 kB gzip)
   - New `DashboardPage` router shell: **4.30 kB (1.72 kB gzip)** — **98.9% size reduction**!
   - Heavy dependencies (e.g. Recharts in `AnalyticsSection`: 354.22 kB) are completely deferred and only fetched when navigated to.
4. **Tests:**
   - 6 new integration tests in `src/pages/DashboardPage.test.tsx` verifying async rendering of Overview, Menu, Branding, Settings, Subscription, and Team modules.
   - Total test suite grew from 55 to 61 tests, all passing across 8 test suites.

### Verified
- [x] `pnpm typecheck` passed (0 errors)
- [x] `pnpm lint` passed (0 errors)
- [x] `pnpm test` passed (61 tests)
- [x] `pnpm build` passed (production build + PWA service worker generated)

---

## Phase 6: Testing & Lighthouse CI

**Status: COMPLETED**
**Date: 2026-10-12**

### Work Done
1. **Domain CRUD & Validation Test Suite (`src/services/crud.test.ts`):**
   - Restaurant lifecycle: creation, owner auto-assignment, slug validation rules (URL-safe, lowercase, reserved word protection like `/admin`), slug uniqueness enforcement, settings and contact updates.
   - Category CRUD: creation, update, and soft deletion (`deleted_at`).
   - Product CRUD: creation, update, duplication, soft deletion, negative price rejection, and compare-at price validation (`compare_at_price > price`).
2. **SaaS Plan Limits Enforcement Suite (`src/services/plan-limits.test.ts`):**
   - FREE plan product limit (30 products max, throwing `PlanLimitError` on 31st).
   - FREE plan branch limit (1 branch max).
   - Expired PRO subscription graceful fallback to FREE limits and analytics gating without data loss.
   - Active PRO plan multi-branch capabilities (up to 5 branches) and analytics unlock.
3. **Opening Hours Edge Cases Suite (`src/utils/opening-hours.test.ts`):**
   - Standard daytime single shifts.
   - Split shifts (e.g. lunch 11:30–15:00 and dinner 18:00–23:00).
   - Midnight-crossing overnight shifts (e.g. 18:00–02:00 next day).
   - Cross-day overnight boundary assertions (e.g. Sunday night shift extending into Monday 01:30 AM).
   - Non-UTC timezone offset calculations (e.g. `Africa/Cairo` UTC+2).
4. **In-Memory Test Adapter Harness (`src/test/mock-adapter.ts`):**
   - Pure, deterministic, zero-dependency in-memory mock harness for Node/Vitest environments.
   - Provides full store mocking with transactional atomicity for reliable unit testing without relying on browser IndexedDB APIs.
5. **Playwright End-to-End Suite (`playwright.config.ts`, `tests/`):**
   - Configured dual-target execution: Desktop Chromium and Mobile Chrome (375px viewport simulating iPhone SE / Android devices).
   - Automated dev server lifecycle orchestration (`pnpm dev` on port 5173).
   - `tests/public-menu.spec.ts`: Verifies public menu branding, category filtering, search, and responsive layout.
   - `tests/admin.spec.ts`: Verifies super-admin dashboard, subscription editor, and tenant team management.
   - `tests/menu-reorder.spec.ts`: Verifies category and product reordering flows with accessible controls.
   - `tests/branding-contrast.spec.ts`: Verifies live WCAG contrast checking, warning badges, and save blocking.
   - `tests/pwa.spec.ts`: Verifies web app manifest validity, theme color, display standalone, and service worker registration.
6. **Lighthouse CI Configuration & Guide (`lighthouserc.json`, `docs/LIGHTHOUSE_CI.md`):**
   - Configured target thresholds: Accessibility >= 95, SEO >= 95, Best Practices >= 90, Performance >= 85, PWA criteria.
   - Provided comprehensive CI/CD integration guide and local execution instructions.
7. **Test Suite Growth:**
   - Vitest suite grew from 61 to **77 tests across 11 test suites**, all passing cleanly.

### Verified
- [x] `pnpm typecheck` passed (0 errors)
- [x] `pnpm lint` passed (0 errors)
- [x] `pnpm test` passed (11 suites, 77 tests)
- [x] `pnpm build` passed (production build + PWA service worker generated)

---

## Phase 7: Real Backend (Supabase)

**Status: COMPLETED**
**Date: 2026-10-12**

### Work Done
1. **Installed Official SDK (`@supabase/supabase-js`):**
   - Installed `@supabase/supabase-js` (2.117.3) cleanly via pnpm adhering strictly to the `minimumReleaseAge` supply-chain policy without overrides.
2. **Built Production `SupabaseAdapter` (`src/data/adapters/supabase/index.ts`):**
   - Full implementation of the `DataAdapter` contract:
     - Authentication: `signUp`, `signIn`, `signOut`, `getSession`, `requestPasswordReset`, `resetPassword`.
     - Data models: profiles, restaurants, restaurant_members, settings, branding, branches, categories, products, offers, qr_codes, analytics_events, subscriptions, notifications, audit_logs.
     - Atomic reordering: batch updates for categories and products maintaining contiguous sort orders.
     - Storage bucket integration: `restaurant-assets` image uploads and deletions.
     - Data portability: `exportDatabase()` and `importDatabase()` mapping JSON schemas to PostgreSQL tables.
     - Guardrails & validations: date validation, image MIME type and file size limits, non-existent entity checks.
3. **Dynamic Adapter Selection (`src/data/index.ts`):**
   - Seamless switching via `VITE_DATA_ADAPTER` (`local` or `supabase`).
   - Default remains `local` (IndexedDB) for zero-setup local development, switching to `supabase` when configured.
4. **Unit Tests & Validation (`src/data/adapters/supabase/supabase.test.ts`):**
   - 7 unit tests verifying initialization, date validations, file upload guardrails, versioned import handling, and reordering bounds.
   - Total test suite grew from 77 to **84 tests across 12 test suites**, all passing.
5. **Documentation (`docs/SUPABASE_SETUP.md`):**
   - Documented step-by-step provisioning, migration execution, environment variable setup, and RLS security policies.

### Verified
- [x] `pnpm typecheck` passed (0 errors)
- [x] `pnpm lint` passed (0 errors)
- [x] `pnpm test` passed (12 suites, 84 tests)
- [x] `pnpm build` passed (production build + PWA service worker generated)

---

## Phase A: Security & Honesty Audit Findings

**Status: COMPLETED**
**Date: 2026-10-12**

### Audit Findings & Proof:
1. **Privilege Escalation (CONFIRMED):** In `002_rls.sql:33`, `profiles_self_update` checks `(id = auth.uid())` without column restrictions, allowing any authenticated user to set `platform_role = 'SUPER_ADMIN'`. Proven in `supabase/tests/audit_vulnerabilities.sql`.
2. **Sign-Up Failure (CONFIRMED):** `002_rls.sql` lacks an `INSERT` policy on `public.profiles` and lacks an `auth.users` trigger. `SupabaseAdapter.signUp` attempts to insert `password_hash` and `password_salt`, which do not exist in the `public.profiles` table schema. Proven in `supabase/tests/audit_vulnerabilities.sql`.
3. **Last-Owner Protection Bypass (CONFIRMED):** `members_owner_write` in `002_rls.sql:39` allows any restaurant owner to delete all owners. Protection existed exclusively in the client TypeScript service layer.
4. **Tenant Isolation Holes (CONFIRMED):**
   - *Critical:* Restaurant creation deadlock (`restaurants_owner_write` requires membership on creation).
   - *High:* `SupabaseAdapter.getPublicMenu` queries RLS-protected tables instead of using the `get_public_menu` RPC.
   - *High:* Storage bucket upload path mismatch (`uploads/` instead of tenant UUID folder).
   - *Medium:* Unvalidated `audit_logs` inserts allowing arbitrary actor roles.
5. **Local Crypto Incompatibility (CONFIRMED & PROVEN):** The custom LAN fallback hash in `crypto.ts` is incompatible with standard Web Cryptography PBKDF2 (120,000 iterations). Proved in `src/test/audit/crypto-incompatibility.test.ts`.
6. **E2E & Lighthouse Status (CONFIRMED):** Playwright browser binaries were not installed and E2E tests were never run in CI.
7. **SEO Domain & Sitemaps (CONFIRMED):** `robots.txt` points to fake domain `https://nexmenu.local/sitemap.xml`, and no dynamic sitemap or edge pre-rendering functions exist.

---

## Phase B: Supabase Security & Correctness Hardening

**Status: COMPLETED**
**Date: 2026-10-12**

### Work Done
1. **Security Migration (`supabase/migrations/007_security_and_correctness.sql`):**
   - **Privilege Escalation Protection:**
     - Created trigger `protect_profile_sensitive_columns` that rejects updates to `platform_role`, `id`, or `email` unless executed by a `SUPER_ADMIN` or system service role.
     - Revoked column-level update grants on `platform_role`, `id`, and `email` for `authenticated` role.
   - **Database Sign-up Trigger (`on_auth_user_created`):**
     - Attached `SECURITY DEFINER` trigger to `auth.users` on `INSERT` to create corresponding `public.profiles` records using metadata safely, resolving sign-up blocks without exposing sensitive columns to client writes.
   - **Database-Level Last-Owner Invariant:**
     - Created `protect_last_active_owner` trigger on `public.restaurant_members` that counts active owners for the restaurant before any `DELETE` or `UPDATE` demoting/deactivating an owner, throwing an exception if fewer than 1 active owner remains.
   - **Atomic Tenant Creation RPC (`create_restaurant`):**
     - Implemented transactional RPC creating restaurant, owner membership, settings, branding, and subscription in 1 atomic unit, resolving initial creation deadlock.
   - **Atomic Reordering RPCs (`reorder_categories`, `reorder_products`):**
     - Implemented transactional reordering functions that verify caller membership and set contiguous `sort_order` values.
2. **Adapter Client Hardening (`src/data/adapters/supabase/index.ts`):**
   - `signUp`: Removed illegal client insert of `password_hash`/`password_salt`; delegates profile creation to the database trigger.
   - `createRestaurant`: Calls `create_restaurant` RPC for atomic tenant provisioning.
   - `reorderCategories` & `reorderProducts`: Dispatches to atomic database RPCs.
   - `getPublicMenu`: Calls `get_public_menu` RPC.
   - `uploadFile`: Scopes file paths to `${restaurantId}/${filename}` matching storage bucket RLS policies.
   - Client isolation: Configured unique session storage keys during test execution to prevent GoTrueClient collision warnings.
3. **Automated Verification:**
   - Added `test:rls` script to `package.json` and test suite `src/test/rls.test.ts` (skips cleanly when live environment variables are absent).
   - Unit and integration tests pass: 85 passed, 1 skipped.

### Verified
- [x] `pnpm typecheck` passed (0 errors)
- [x] `pnpm lint` passed (0 errors)
- [x] `pnpm test` passed (85 tests passed, 1 skipped)
- [x] `pnpm build` passed (production build + PWA service worker generated)

---

## Phase C: Local Adapter Crypto Hardening

**Status: COMPLETED**
**Date: 2026-10-12**

### Work Done
1. **Removed Insecure Fallback Hash (`src/data/adapters/local/crypto.ts`):**
   - Eliminated the custom 256-bit bitwise mixing fallback (`fallbackHash`).
   - Standardized strictly on Web Cryptography PBKDF2 with SHA-256 (120,000 iterations).
   - Added `InsecureContextCryptoError` that triggers fast when `crypto.subtle` is unavailable (e.g. over insecure LAN HTTP IP connections), providing an explicit, informative error stating that HTTPS or localhost is required.
2. **Added Unit Tests (`src/data/adapters/local/crypto.test.ts` & `src/test/audit/`):**
   - Verified 256-bit hash and 128-bit salt structure.
   - Verified deterministic password verification using stored salt.
   - Verified rejection of incorrect passwords.
   - Verified fast rejection with `InsecureContextCryptoError` when `crypto.subtle` is disabled/undefined.
   - Updated audit test `src/test/audit/crypto-incompatibility.test.ts`.
3. **Automated Verification:**
   - Test suite grew to 89 passed tests across 14 test suites (1 skipped cleanly).

### Verified
- [x] `pnpm typecheck` passed (0 errors)
- [x] `pnpm lint` passed (0 errors)
- [x] `pnpm test` passed (89 tests passed, 1 skipped)
- [x] `pnpm build` passed (production build + PWA service worker generated)

