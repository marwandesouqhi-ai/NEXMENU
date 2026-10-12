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
