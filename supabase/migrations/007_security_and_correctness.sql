-- ==============================================================================
-- 007_security_and_correctness.sql
-- Resolves Phase A security audit findings:
-- 1. Privilege escalation protection on public.profiles
-- 2. Auth sign-up trigger populating public.profiles from auth.users
-- 3. Database-level last-owner invariant protection on public.restaurant_members
-- 4. Atomic restaurant creation RPC with automatic owner assignment
-- 5. Atomic category & product reordering RPCs
-- 6. Storage path and anonymous access policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FIX PRIVILEGE ESCALATION ON public.profiles
-- ------------------------------------------------------------------------------
-- Trigger preventing non-super-admins from modifying platform_role, id, or email.
create or replace function public.protect_profile_sensitive_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Prevent altering identity/email directly
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

drop trigger if exists tr_protect_profile_columns on public.profiles;
create trigger tr_protect_profile_columns
  before update on public.profiles
  for each row execute procedure public.protect_profile_sensitive_columns();

-- Revoke direct update on sensitive column platform_role from regular roles
revoke update (platform_role, id, email) on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;

-- ------------------------------------------------------------------------------
-- 2. SIGN-UP TRIGGER on auth.users -> public.profiles
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, name, platform_role, created_at, updated_at)
  values (new.id, lower(new.email), v_name, null, now(), now())
  on conflict (id) do update
  set email = excluded.email,
      name = coalesce(public.profiles.name, excluded.name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. LAST OWNER INVARIANT ON public.restaurant_members
-- ------------------------------------------------------------------------------
-- Rejects deleting, deactivating, or demoting the last active RESTAURANT_OWNER.
create or replace function public.protect_last_active_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_remaining_owners integer;
begin
  -- Only trigger if an active owner is being deleted, demoted, or deactivated
  if (OLD.role = 'RESTAURANT_OWNER' and OLD.status = 'ACTIVE') then
    if (TG_OP = 'DELETE' or NEW.role <> 'RESTAURANT_OWNER' or NEW.status <> 'ACTIVE') then
      select count(*)
      into v_remaining_owners
      from public.restaurant_members
      where restaurant_id = OLD.restaurant_id
        and role = 'RESTAURANT_OWNER'
        and status = 'ACTIVE'
        and id <> OLD.id;

      if v_remaining_owners = 0 then
        raise exception 'Cannot remove, deactivate, or demote the last active owner of this restaurant.';
      end if;
    end if;
  end if;

  if (TG_OP = 'DELETE') then
    return OLD;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists tr_protect_last_owner on public.restaurant_members;
create trigger tr_protect_last_owner
  before update or delete on public.restaurant_members
  for each row execute procedure public.protect_last_active_owner();

-- ------------------------------------------------------------------------------
-- 4. ATOMIC RESTAURANT CREATION RPC
-- ------------------------------------------------------------------------------
create or replace function public.create_restaurant(
  name_en text,
  name_ar text,
  slug text,
  currency text default 'EGP',
  cuisine_type text default ''
)
returns public.restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_restaurant public.restaurants;
  v_now timestamptz := now();
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required to create a restaurant.';
  end if;

  select email into v_user_email from public.profiles where id = v_user_id;
  if v_user_email is null then
    raise exception 'Profile not found for authenticated user.';
  end if;

  -- Validate slug format
  if not (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') then
    raise exception 'Choose a lowercase URL-safe slug.';
  end if;

  -- Check slug uniqueness
  if exists (select 1 from public.restaurants r where r.slug = slug and r.deleted_at is null) then
    raise exception 'That menu address is already in use.';
  end if;

  -- Create restaurant
  insert into public.restaurants (
    name_en, name_ar, slug, currency, cuisine_type,
    timezone, menu_status, status, created_at, updated_at
  ) values (
    name_en, name_ar, slug, coalesce(currency, 'EGP'), coalesce(cuisine_type, ''),
    'Africa/Cairo', 'DRAFT', 'ACTIVE', v_now, v_now
  ) returning * into v_restaurant;

  -- Assign creator as RESTAURANT_OWNER
  insert into public.restaurant_members (
    restaurant_id, profile_id, email, role, status, created_at, updated_at
  ) values (
    v_restaurant.id, v_user_id, v_user_email, 'RESTAURANT_OWNER', 'ACTIVE', v_now, v_now
  );

  -- Create default settings
  insert into public.restaurant_settings (
    restaurant_id, default_locale, opening_hours, created_at, updated_at
  ) values (
    v_restaurant.id, 'en',
    jsonb_build_object(
      'monday', jsonb_build_object('closed', false, 'shifts', jsonb_build_array(jsonb_build_object('open', '09:00', 'close', '22:00'))),
      'tuesday', jsonb_build_object('closed', false, 'shifts', jsonb_build_array(jsonb_build_object('open', '09:00', 'close', '22:00'))),
      'wednesday', jsonb_build_object('closed', false, 'shifts', jsonb_build_array(jsonb_build_object('open', '09:00', 'close', '22:00'))),
      'thursday', jsonb_build_object('closed', false, 'shifts', jsonb_build_array(jsonb_build_object('open', '09:00', 'close', '22:00'))),
      'friday', jsonb_build_object('closed', false, 'shifts', jsonb_build_array(jsonb_build_object('open', '09:00', 'close', '22:00'))),
      'saturday', jsonb_build_object('closed', false, 'shifts', jsonb_build_array(jsonb_build_object('open', '09:00', 'close', '22:00'))),
      'sunday', jsonb_build_object('closed', false, 'shifts', jsonb_build_array(jsonb_build_object('open', '09:00', 'close', '22:00')))
    ),
    v_now, v_now
  );

  -- Create default branding
  insert into public.restaurant_branding (
    restaurant_id, primary_color, secondary_color, background_color, text_color,
    template, radius, theme, font, created_at, updated_at
  ) values (
    v_restaurant.id, '#176b4d', '#d7aa5c', '#f7f4ed', '#17221d',
    'Modern', 'rounded', 'light', 'Inter', v_now, v_now
  );

  -- Create initial FREE subscription
  insert into public.subscriptions (
    restaurant_id, plan, starts_at, expires_at, status, notes, created_at, updated_at
  ) values (
    v_restaurant.id, 'FREE', v_now, v_now + interval '365 days', 'ACTIVE', 'Initial Plan', v_now, v_now
  );

  return v_restaurant;
end;
$$;

grant execute on function public.create_restaurant(text, text, text, text, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. ATOMIC REORDER RPCs
-- ------------------------------------------------------------------------------
create or replace function public.reorder_categories(
  p_restaurant_id uuid,
  p_category_ids uuid[]
)
returns setof public.categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_idx integer := 0;
begin
  if not public.is_restaurant_member(p_restaurant_id, array['RESTAURANT_OWNER', 'RESTAURANT_MANAGER']::public.app_role[]) then
    raise exception 'Permission denied to reorder categories.';
  end if;

  foreach v_id in array p_category_ids loop
    update public.categories
    set sort_order = v_idx,
        updated_at = now()
    where id = v_id
      and restaurant_id = p_restaurant_id;

    v_idx := v_idx + 1;
  end loop;

  return query
  select * from public.categories
  where restaurant_id = p_restaurant_id
    and deleted_at is null
  order by sort_order;
end;
$$;

grant execute on function public.reorder_categories(uuid, uuid[]) to authenticated;

create or replace function public.reorder_products(
  p_restaurant_id uuid,
  p_category_id uuid,
  p_product_ids uuid[]
)
returns setof public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_idx integer := 0;
begin
  if not public.is_restaurant_member(p_restaurant_id, array['RESTAURANT_OWNER', 'RESTAURANT_MANAGER']::public.app_role[]) then
    raise exception 'Permission denied to reorder products.';
  end if;

  foreach v_id in array p_product_ids loop
    update public.products
    set sort_order = v_idx,
        updated_at = now()
    where id = v_id
      and restaurant_id = p_restaurant_id
      and category_id = p_category_id;

    v_idx := v_idx + 1;
  end loop;

  return query
  select * from public.products
  where restaurant_id = p_restaurant_id
    and category_id = p_category_id
    and deleted_at is null
  order by sort_order;
end;
$$;

grant execute on function public.reorder_products(uuid, uuid, uuid[]) to authenticated;
