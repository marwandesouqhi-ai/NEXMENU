# Architectural & Technical Decisions Log

This document records technical and architectural decisions, rationale, and tradeoffs made during development.

## AD-001: Minimal Correction of `min(uuid)` in `002_rls.sql`
- **Context:** Finding F2 identified that `supabase/migrations/002_rls.sql` contained `b.id = (select min(id) from public.branches ...)`. In PostgreSQL, `min()` is undefined for type `uuid`, which causes clean migrations 001..007 to crash on a fresh database.
- **Decision:** As permitted by the specification ("this is the one allowed exception to 'don't rewrite old migrations', because it breaks fresh installs"), update line 78 in `002_rls.sql` to `(select b2.id from public.branches b2 where b2.restaurant_id=r.id order by b2.created_at asc, b2.id asc limit 1)`. Also provide `create or replace function public.get_public_menu` in `008_super_admin_bootstrap_and_menu_fix.sql` so already-migrated instances receive the fix deterministically.
- **Impact:** Both fresh installs (from migrations 001..008) and incremental upgrades execute cleanly and deterministically.

## AD-002: Profile Protection Trigger Bypass for Privileged Database Roles
- **Context:** Finding F1 identified that migration 007 trigger `protect_profile_sensitive_columns` raises an error on any `platform_role` change unless `public.is_super_admin()`. Because `auth.uid()` is null in the Supabase SQL Editor and CLI, initial super admin bootstrap was impossible without disabling the trigger.
- **Decision:** In `008_super_admin_bootstrap_and_menu_fix.sql`, update `protect_profile_sensitive_columns` to permit `platform_role`, `id`, and `email` changes when executing under privileged database roles (e.g. `current_user in ('postgres', 'supabase_admin', 'service_role')` or `auth.uid() is null AND current_user in ('postgres', 'supabase_admin')`). Regular client connections (`authenticated` and `anon`) always run as `authenticated`/`anon` roles where `auth.uid()` is evaluated, remaining strictly forbidden from altering `platform_role`.
- **Impact:** Platform operators can safely bootstrap the first `SUPER_ADMIN` via SQL Editor/CLI without disabling security triggers.

## AD-003: Lazy Dynamic Loading of Supabase and Local Data Adapters
- **Context:** Finding F6 identified that `data` and initial chunks were unnecessarily bloated (~230KB) because `SupabaseAdapter` (and all `@supabase/*` SDK dependencies) were imported statically regardless of whether local mode or cloud mode was configured.
- **Decision:** Re-architect `src/data/index.ts` to use a `LazyDataAdapter` class that implements `DataAdapter`. Methods dynamically invoke `getActiveAdapter()`, which performs asynchronous dynamic `import("./adapters/supabase")` or `import("./adapters/local")` based on `VITE_DATA_ADAPTER`.
- **Measured Results:**
  - Before: `data` chunk was 230.20 kB (gzip: 59.08 kB).
  - After: `data` chunk dropped to 3.40 kB (gzip: 0.81 kB) — a **98.5% reduction**!
  - Supabase client code is isolated into an on-demand `supabase-*.js` chunk (226.49 kB, gzip: 57.86 kB) downloaded only when cloud mode is enabled.

## AD-004: Dual Deployable Targets (`public` and `admin`)
- **Context:** Finding F5 observed that `/admin` lived in the same application bundle as the public site, exposing administrative route definitions and assets to public visitors.
- **Decision:** Introduce `VITE_APP_TARGET` (`all`, `public`, `admin`). When building target `public`:
  - Route `/admin` is pruned.
  - Page `@/pages/AdminPage` is aliased to an empty stub component, eliminating admin chunks from public distributions.
  When building target `admin`:
  - Only `/login`, `/reset-password`, `/admin`, and 404 routes exist.
  - Public pages (`PublicMenuPage`, `LandingPage`, `DashboardLayout`, `AnalyticsSection`, etc.) are aliased to empty stubs.
  - PWA service worker (`VitePWA`) is disabled.
  - `<meta name="robots" content="noindex,nofollow" />` and disallow-all `robots.txt` are injected.
  - Non-super-admin users attempting to log into the admin portal are immediately signed out and shown a localized access-denied state (`AdminNotAuthorized`).
- **Measured Results:**
  - `build:public` dist has 0 Admin chunks or strings.
  - `build:admin` dist has 0 public/landing/analytics chunks and 0 service workers.

## AD-005: MFA (Multi-Factor Authentication) for SUPER_ADMIN Deferral
- **Context:** Super admin accounts control multi-tenant subscriptions and platform-wide configurations. Multi-factor authentication (TOTP) is an important defense-in-depth measure.
- **Decision:** As instructed by the autonomous execution scope ("MFA for SUPER_ADMIN: do NOT implement; record in DECISIONS.md as a strongly recommended follow-up with the effort/risk"), MFA is deferred to a future phase.
- **Effort & Risk Assessment:**
  - *Effort:* Moderate (~2 days). Requires enrolling TOTP factors via `supabase.auth.mfa.enroll({ factorType: 'totp' })`, rendering QR code with URI, challenging session with `supabase.auth.mfa.challenge()` / `verify()`, and updating `AdminOnly` guard to verify `aal2` (Authenticator Assurance Level 2) via `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
  - *Risk:* Low-medium. Potential lockout risk if operator loses TOTP secret before backup codes are generated. Must provide recovery flow or CLI-based emergency MFA factor reset.

## AD-006: Dynamic Origin Resolution Removing Hardcoded Fallback (F7)
- **Context:** Finding F7 identified that `https://nexmenu.app` was hardcoded as a fallback origin in SEO utilities, canonical links, edge crawlers, and static robots.txt. If deployed to another custom domain or Vercel preview domain, URLs and sitemaps would point to an incorrect external domain.
- **Decision:** Remove the hardcoded `https://nexmenu.app` fallback across `src/utils/seo.ts`, `api/sitemap.ts`, `api/menu-meta.ts`, and `public/robots.txt`. The site origin is now derived dynamically from `VITE_SITE_URL` env variable, incoming request headers (`x-forwarded-proto` + `x-forwarded-host` or `host`), or `window.location.origin` at runtime. A dedicated Vite plugin `dynamicRobotsPlugin` stamps the correct `Sitemap: ${origin}/sitemap.xml` into the distributed `robots.txt` at build time.
- **Impact:** Any custom domain, staging environment, or Vercel preview branch automatically generates canonical URLs and sitemaps pointing to its own host.


