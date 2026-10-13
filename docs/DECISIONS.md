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
