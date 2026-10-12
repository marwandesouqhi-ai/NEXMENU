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

**Status: NOT STARTED**

---

## Phase 4: Branding Contrast

**Status: NOT STARTED**

---

## Phase 5: DashboardPage Refactor

**Status: NOT STARTED**

---

## Phase 6: Testing

**Status: NOT STARTED**

---

## Phase 7: Real Backend (STOP AND ASK)

**Status: NOT STARTED – requires explicit user approval**
