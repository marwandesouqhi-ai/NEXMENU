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

**Status: NOT STARTED**

---

## Phase 2: Reordering

**Status: NOT STARTED**

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
