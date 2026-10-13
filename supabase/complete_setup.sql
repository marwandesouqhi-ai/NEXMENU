-- ==============================================================================
-- NEXMENU — COMPLETE SUPABASE SETUP SCRIPT (MIGRATIONS 001 TO 007)
-- Paste and run this entire script once in Supabase Dashboard > SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- FILE: 001_initial_schema.sql
-- ------------------------------------------------------------------------------

-- NOT YET APPLIED / NOT CONNECTED.
-- Future PostgreSQL schema for the SupabaseAdapter. The local app does not execute this file.
create extension if not exists pgcrypto;
create type public.app_role as enum ('SUPER_ADMIN','RESTAURANT_OWNER','RESTAURANT_MANAGER','STAFF');
create type public.menu_status as enum ('DRAFT','PUBLISHED','PAUSED');
create type public.restaurant_status as enum ('ACTIVE','SUSPENDED','INACTIVE');
create type public.plan_code as enum ('FREE','BASIC','PRO','PREMIUM');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique, name text not null, platform_role public.app_role,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.restaurants (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null, name_ar text not null, description_en text not null default '', description_ar text not null default '',
  phone text not null default '', whatsapp text not null default '', address_en text not null default '', address_ar text not null default '',
  maps_url text not null default '', website text not null default '', instagram text not null default '', facebook text not null default '',
  cuisine_type text not null default '', currency text not null default 'EGP', timezone text not null default 'Africa/Cairo',
  menu_status public.menu_status not null default 'DRAFT', status public.restaurant_status not null default 'ACTIVE',
  logo_url text, cover_url text, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.restaurant_members (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade, email text not null, role public.app_role not null check (role <> 'SUPER_ADMIN'),
  status text not null default 'PENDING' check (status in ('ACTIVE','PENDING')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (restaurant_id,email)
);
create table public.restaurant_settings (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  opening_hours jsonb not null default '{}', default_locale text not null default 'en' check (default_locale in ('en','ar')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.restaurant_branding (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  primary_color text not null default '#176b4d', secondary_color text not null default '#d7aa5c',
  background_color text not null default '#f7f4ed', text_color text not null default '#17221d',
  template text not null default 'Modern', radius text not null default 'rounded', theme text not null default 'light', font text not null default 'Inter',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.branches (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  slug text not null, name_en text not null, name_ar text not null, address_en text not null default '', address_ar text not null default '',
  phone text not null default '', maps_url text not null default '', opening_hours jsonb not null default '{}', hidden_product_ids uuid[] not null default '{}',
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (restaurant_id,slug)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name_en text not null, name_ar text not null, image_url text, is_visible boolean not null default true, sort_order integer not null default 0,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.categories(id), name_en text not null, name_ar text not null,
  description_en text not null default '', description_ar text not null default '', price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price > price), image_url text,
  is_available boolean not null default true, is_visible boolean not null default true, is_featured boolean not null default false,
  is_popular boolean not null default false, sort_order integer not null default 0, sku text not null default '', calories integer check (calories is null or calories >= 0),
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_images (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, storage_path text not null, alt_en text not null default '', alt_ar text not null default '',
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_options (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, name_en text not null, name_ar text not null,
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_option_values (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade, option_id uuid not null references public.product_options(id) on delete cascade,
  name_en text not null, name_ar text not null, price_delta numeric(12,2) not null default 0 check (price_delta >= 0),
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.offers (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, title_en text not null, title_ar text not null,
  description_en text not null default '', description_ar text not null default '', type text not null,
  value numeric(12,2), starts_at timestamptz not null, ends_at timestamptz not null check (ends_at > starts_at),
  is_active boolean not null default true, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.qr_codes (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade, target_url text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null, event_type text not null check (event_type in ('menu_view','qr_scan','product_view','category_view','search')),
  entity_id uuid, language text not null check (language in ('en','ar')), device_class text not null check (device_class in ('mobile','tablet')),
  source text not null check (source in ('qr','direct')), visitor_day_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.subscription_plans (
  code public.plan_code primary key, name text not null, limits jsonb not null default '{}', features jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  plan public.plan_code not null default 'FREE', starts_at timestamptz not null, expires_at timestamptz not null,
  status text not null check (status in ('ACTIVE','SUSPENDED','EXPIRED')), notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade, title text not null, body text not null, read_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid references public.restaurants(id) on delete set null,
  actor_profile_id uuid not null references public.profiles(id), actor_role public.app_role not null, action text not null,
  entity_type text not null, entity_id uuid, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------------------------
-- FILE: 002_rls.sql
-- ------------------------------------------------------------------------------

-- NOT YET APPLIED / NOT CONNECTED.
-- Every policy is deny-by-default. The future adapter must never use a service-role key in the browser.
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and platform_role='SUPER_ADMIN') $$;
create or replace function public.is_restaurant_member(target uuid, accepted_roles public.app_role[] default null)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_super_admin() or exists(
    select 1 from public.restaurant_members
    where restaurant_id=target and profile_id=auth.uid() and status='ACTIVE'
      and (accepted_roles is null or role=any(accepted_roles))
  )
$$;
alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.restaurant_branding enable row level security;
alter table public.branches enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.offers enable row level security;
alter table public.qr_codes enable row level security;
alter table public.analytics_events enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
-- A user may read/update their own profile; super admins may administer all profiles.
create policy profiles_self_read on public.profiles for select using (id=auth.uid() or public.is_super_admin());
create policy profiles_self_update on public.profiles for update using (id=auth.uid() or public.is_super_admin()) with check (id=auth.uid() or public.is_super_admin());
-- Members read their tenant restaurant. Owners and admins change restaurant-level data.
create policy restaurants_member_read on public.restaurants for select using (public.is_restaurant_member(id));
create policy restaurants_owner_write on public.restaurants for all using (public.is_restaurant_member(id,array['RESTAURANT_OWNER']::public.app_role[])) with check (public.is_restaurant_member(id,array['RESTAURANT_OWNER']::public.app_role[]));
-- Team details remain private. Owners administer members; each member may see their own membership.
create policy members_private_read on public.restaurant_members for select using (profile_id=auth.uid() or public.is_restaurant_member(restaurant_id,array['RESTAURANT_OWNER']::public.app_role[]));
create policy members_owner_write on public.restaurant_members for all using (public.is_restaurant_member(restaurant_id,array['RESTAURANT_OWNER']::public.app_role[])) with check (public.is_restaurant_member(restaurant_id,array['RESTAURANT_OWNER']::public.app_role[]));
-- Private settings and branding are tenant-member readable; only owners write them.
create policy settings_member_read on public.restaurant_settings for select using (public.is_restaurant_member(restaurant_id));
create policy settings_owner_write on public.restaurant_settings for all using (public.is_restaurant_member(restaurant_id,array['RESTAURANT_OWNER']::public.app_role[])) with check (public.is_restaurant_member(restaurant_id,array['RESTAURANT_OWNER']::public.app_role[]));
create policy branding_member_read on public.restaurant_branding for select using (public.is_restaurant_member(restaurant_id));
create policy branding_owner_write on public.restaurant_branding for all using (public.is_restaurant_member(restaurant_id,array['RESTAURANT_OWNER']::public.app_role[])) with check (public.is_restaurant_member(restaurant_id,array['RESTAURANT_OWNER']::public.app_role[]));
-- Menu editors may manage menu entities, while staff cannot delete (enforced by command-specific policies in production).
do $$ declare tab text; begin foreach tab in array array['branches','categories','products','product_images','product_options','product_option_values','offers','qr_codes'] loop
  execute format('create policy %I_member_read on public.%I for select using (public.is_restaurant_member(restaurant_id))',tab,tab);
  execute format('create policy %I_editor_write on public.%I for all using (public.is_restaurant_member(restaurant_id,array[''RESTAURANT_OWNER'',''RESTAURANT_MANAGER'']::public.app_role[])) with check (public.is_restaurant_member(restaurant_id,array[''RESTAURANT_OWNER'',''RESTAURANT_MANAGER'']::public.app_role[]))',tab,tab);
end loop; end $$;
-- Public analytics inserts are limited to the five non-PII event types by table checks; only members read them.
create policy analytics_public_insert on public.analytics_events for insert to anon,authenticated with check (
  exists(select 1 from public.restaurants r where r.id=restaurant_id and r.status='ACTIVE' and r.menu_status='PUBLISHED')
);
create policy analytics_member_read on public.analytics_events for select using (public.is_restaurant_member(restaurant_id));
-- Plans are publicly readable as product metadata. Subscriptions and notes are tenant-private; only admins write.
create policy plans_public_read on public.subscription_plans for select to anon,authenticated using (true);
create policy subscriptions_member_read on public.subscriptions for select using (public.is_restaurant_member(restaurant_id));
create policy subscriptions_admin_write on public.subscriptions for all using (public.is_super_admin()) with check (public.is_super_admin());
-- Notifications are visible only to their intended member. Audit logs are owner/admin private.
create policy notifications_member_read on public.notifications for select using (public.is_restaurant_member(restaurant_id) and (profile_id is null or profile_id=auth.uid()));
create policy notifications_member_update on public.notifications for update using (profile_id=auth.uid()) with check (profile_id=auth.uid());
create policy audit_owner_read on public.audit_logs for select using (public.is_super_admin() or public.is_restaurant_member(restaurant_id,array['RESTAURANT_OWNER']::public.app_role[]));
create policy audit_authenticated_insert on public.audit_logs for insert to authenticated with check (actor_profile_id=auth.uid() and (restaurant_id is null or public.is_restaurant_member(restaurant_id)));
-- Anonymous clients call this RPC instead of selecting tables. It returns only published, public-safe JSON.
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
  left join public.branches b on b.restaurant_id=r.id and (b.slug=branch_slug or (branch_slug is null and b.id=(select min(id) from public.branches where restaurant_id=r.id)))
  where r.slug=menu_slug and r.status='ACTIVE' and r.menu_status='PUBLISHED' and r.deleted_at is null
$$;
grant execute on function public.get_public_menu(text,text) to anon,authenticated;


-- ------------------------------------------------------------------------------
-- FILE: 003_indexes.sql
-- ------------------------------------------------------------------------------

-- NOT YET APPLIED / NOT CONNECTED.
create index members_restaurant_idx on public.restaurant_members(restaurant_id);
create index members_profile_idx on public.restaurant_members(profile_id);
create index restaurants_slug_active_idx on public.restaurants(slug) where deleted_at is null;
create index branches_restaurant_idx on public.branches(restaurant_id);
create index categories_restaurant_sort_idx on public.categories(restaurant_id,sort_order) where deleted_at is null;
create index products_restaurant_sort_idx on public.products(restaurant_id,sort_order) where deleted_at is null;
create index products_category_idx on public.products(category_id) where deleted_at is null;
create index product_images_product_idx on public.product_images(product_id,sort_order);
create index options_product_idx on public.product_options(product_id,sort_order);
create index option_values_product_idx on public.product_option_values(product_id,option_id,sort_order);
create index offers_restaurant_dates_idx on public.offers(restaurant_id,starts_at,ends_at) where deleted_at is null;
create index qr_codes_restaurant_idx on public.qr_codes(restaurant_id);
create index analytics_restaurant_created_idx on public.analytics_events(restaurant_id,created_at desc);
create index analytics_restaurant_type_created_idx on public.analytics_events(restaurant_id,event_type,created_at desc);
create index notifications_restaurant_created_idx on public.notifications(restaurant_id,created_at desc);
create index audit_restaurant_created_idx on public.audit_logs(restaurant_id,created_at desc);


-- ------------------------------------------------------------------------------
-- FILE: 004_storage.sql
-- ------------------------------------------------------------------------------

-- NOT YET APPLIED / NOT CONNECTED.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('restaurant-assets','restaurant-assets',true,5242880,array['image/jpeg','image/png','image/webp']),
('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']),
('branding-assets','branding-assets',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- Paths must begin with the restaurant UUID. Members can read their tenant assets; editors upload.
create policy assets_public_read on storage.objects for select to anon,authenticated using (bucket_id in ('restaurant-assets','product-images','branding-assets'));
create policy assets_member_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('restaurant-assets','product-images','branding-assets')
  and public.is_restaurant_member(((storage.foldername(name))[1])::uuid,array['RESTAURANT_OWNER','RESTAURANT_MANAGER']::public.app_role[])
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);
create policy assets_member_update on storage.objects for update to authenticated using (
  public.is_restaurant_member(((storage.foldername(name))[1])::uuid,array['RESTAURANT_OWNER','RESTAURANT_MANAGER']::public.app_role[])
);
create policy assets_member_delete on storage.objects for delete to authenticated using (
  public.is_restaurant_member(((storage.foldername(name))[1])::uuid,array['RESTAURANT_OWNER','RESTAURANT_MANAGER']::public.app_role[])
);


-- ------------------------------------------------------------------------------
-- FILE: 005_seed.sql
-- ------------------------------------------------------------------------------

-- NOT YET APPLIED / NOT CONNECTED.
-- Safe plan metadata only. Development restaurant/user seed must be created via a server-side script.
insert into public.subscription_plans(code,name,limits,features) values
('FREE','Free','{"products":30,"branches":1}','{"analytics":false,"advanced_branding":false,"hide_branding":false}'),
('BASIC','Basic','{"products":100,"branches":1}','{"analytics":true,"advanced_branding":true,"hide_branding":false}'),
('PRO','Pro','{"products":null,"branches":5}','{"analytics":true,"advanced_branding":true,"hide_branding":true}'),
('PREMIUM','Premium','{"products":null,"branches":null}','{"analytics":true,"advanced_branding":true,"hide_branding":true,"custom_domain_preparation":true}')
on conflict(code) do update set name=excluded.name,limits=excluded.limits,features=excluded.features;


-- ------------------------------------------------------------------------------
-- FILE: 006_subscription_fields.sql
-- ------------------------------------------------------------------------------

-- Migration 006: Subscription date validation and audit log indexes
-- Extends subscriptions with date consistency checks and explicit column constraints

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_subscription_dates'
  ) then
    alter table public.subscriptions
      add constraint check_subscription_dates
      check (expires_at >= starts_at);
  end if;
end $$;

-- Comments explaining the subscription lifecycle and derived status
comment on column public.subscriptions.starts_at is 'Subscription start timestamp (ISO 8601).';
comment on column public.subscriptions.expires_at is 'Subscription expiration timestamp (ISO 8601). Must be >= starts_at.';
comment on column public.subscriptions.notes is 'Internal administrative notes for this subscription.';
comment on column public.subscriptions.status is 'Explicit subscription status: ACTIVE, SUSPENDED, or EXPIRED. Derived status: active, expiring_soon (within 14 days of expires_at), or expired.';


-- ------------------------------------------------------------------------------
-- FILE: 007_security_and_correctness.sql
-- ------------------------------------------------------------------------------

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


