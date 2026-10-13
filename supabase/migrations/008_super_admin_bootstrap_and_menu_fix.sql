-- ==============================================================================
-- 008_super_admin_bootstrap_and_menu_fix.sql
-- Resolves:
-- 1. F1: Privilege escalation trigger bypass for privileged DB roles (SQL Editor / CLI)
--    so project owners can bootstrap the initial SUPER_ADMIN safely without disabling triggers.
-- 2. F2: Fixes public.get_public_menu UUID min(id) on existing databases by overriding
--    with deterministic (order by created_at asc, id asc limit 1).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRIVILEGE ESCALATION TRIGGER UPDATE (Allow privileged DB role bootstrap)
-- WARNING: The protect_profile_sensitive_columns() implementation below in 008
-- is SUPERSEDED by 009_profile_protection_security_definer_fix.sql.
-- Do NOT rely on 008's current_user check (which incorrectly bypassed all callers
-- inside SECURITY DEFINER). 009 fixes this with session_user check.
-- ------------------------------------------------------------------------------
create or replace function public.protect_profile_sensitive_columns()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_is_privileged boolean;
begin
  -- Check if executing under a privileged database role (postgres, supabase_admin, service_role, dashboard_user)
  -- or running in SQL editor / CLI without an active authenticated client session.
  v_is_privileged := (
    current_user in ('postgres', 'supabase_admin', 'service_role', 'dashboard_user') or
    session_user in ('postgres', 'supabase_admin', 'service_role', 'dashboard_user') or
    (auth.uid() is null and current_user not in ('authenticated', 'anon'))
  );

  -- If privileged DB role, permit administrative bootstrap / updates
  if v_is_privileged then
    NEW.updated_at := now();
    return NEW;
  end if;

  -- Prevent regular client connections (authenticated/anon) from altering identity/email
  if (NEW.id <> OLD.id) then
    raise exception 'Changing profile ID is not permitted.';
  end if;

  if (NEW.email <> OLD.email) then
    raise exception 'Changing profile email directly is not permitted.';
  end if;

  -- Only super administrators can modify platform_role
  if (NEW.platform_role is distinct from OLD.platform_role) and not public.is_super_admin() then
    raise exception 'Only super administrators can alter platform_role.';
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. GET_PUBLIC_MENU POSTGRESQL UUID COMPATIBILITY
-- ------------------------------------------------------------------------------
create or replace function public.get_public_menu(menu_slug text, branch_slug text default null)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'restaurant',to_jsonb(r)-'deleted_at',
    'settings',jsonb_build_object('opening_hours',coalesce(b.opening_hours,s.opening_hours),'default_locale',s.default_locale),
    'branding',to_jsonb(rb),
    'categories',coalesce((select jsonb_agg(c order by c.sort_order) from public.categories c where c.restaurant_id=r.id and c.is_visible and c.deleted_at is null),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(p order by p.sort_order) from public.products p join public.categories c on c.id=p.category_id where p.restaurant_id=r.id and p.is_visible and p.deleted_at is null and c.is_visible and c.deleted_at is null),'[]'::jsonb),
    'offers',coalesce((select jsonb_agg(o) from public.offers o where o.restaurant_id=r.id and o.is_active and o.deleted_at is null and now() between o.starts_at and o.ends_at),'[]'::jsonb),
    'branch',to_jsonb(b)
  ) from public.restaurants r
  join public.restaurant_settings s on s.restaurant_id=r.id
  join public.restaurant_branding rb on rb.restaurant_id=r.id
  left join public.branches b on b.restaurant_id=r.id and (b.slug=branch_slug or (branch_slug is null and b.id=(select b2.id from public.branches b2 where b2.restaurant_id=r.id order by b2.created_at asc, b2.id asc limit 1)))
  where r.slug=menu_slug and r.status='ACTIVE' and r.menu_status='PUBLISHED' and r.deleted_at is null
$$;

grant execute on function public.get_public_menu(text,text) to anon,authenticated;
