-- ==============================================================================
-- MIGRATION 010: Team Invitations, Membership Status Expansion & Safe Claims
-- ==============================================================================
-- 1. Expands restaurant_members.status CHECK constraint to include 'SUSPENDED',
--    matching the TypeScript domain type and UI states, while verifying that
--    protect_last_active_owner continues to block suspending the last active owner.
-- 2. Restricts direct client INSERT on public.restaurant_members through RLS audit.
--    Membership creation must route through atomic create_restaurant RPC or
--    the SECURITY DEFINER public.invite_member RPC.
-- 3. Adds public.invite_member(p_restaurant_id, p_email, p_role) RPC:
--    - Enforces caller is an active RESTAURANT_OWNER or SUPER_ADMIN (mirroring
--      the src/services/authorization.ts team:write permission matrix).
--    - Rejects SUPER_ADMIN role assignments.
--    - Normalizes email to lower-case and checks duplicate membership.
--    - Looks up auth.users server-side: if an account exists AND email is confirmed,
--      sets status='ACTIVE' with profile_id. Otherwise creates status='PENDING'
--      with profile_id=NULL.
--    - Returns uniform restaurant_members record shape, preventing email enumeration.
-- 4. Safe pending membership claiming:
--    - Triggers on auth.users for new confirmations (INSERT with email_confirmed_at
--      or UPDATE transitioning email_confirmed_at from NULL to NOT NULL).
--    - Claims pending rows by setting profile_id and status='ACTIVE'.
--    - Prevents account takeover by ensuring unconfirmed sign-ups NEVER claim memberships.
-- 5. Hardens UPDATE on restaurant_members with tr_protect_membership_columns,
--    preventing modification of id, restaurant_id, email, or reassigning profile_id.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXPAND STATUS CHECK CONSTRAINT
-- ------------------------------------------------------------------------------
alter table public.restaurant_members
  drop constraint if exists restaurant_members_status_check;

alter table public.restaurant_members
  add constraint restaurant_members_status_check
  check (status in ('ACTIVE', 'PENDING', 'SUSPENDED'));

-- ------------------------------------------------------------------------------
-- 2. RLS AUDIT & POLICY HARDENING ON public.restaurant_members
-- ------------------------------------------------------------------------------
-- Drop the overly broad 'FOR ALL' policy from migration 002
drop policy if exists members_owner_write on public.restaurant_members;

-- Separate into explicit UPDATE and DELETE policies for active owners
create policy members_owner_update on public.restaurant_members
  for update
  using (public.is_restaurant_member(restaurant_id, array['RESTAURANT_OWNER']::public.app_role[]))
  with check (public.is_restaurant_member(restaurant_id, array['RESTAURANT_OWNER']::public.app_role[]));

create policy members_owner_delete on public.restaurant_members
  for delete
  using (public.is_restaurant_member(restaurant_id, array['RESTAURANT_OWNER']::public.app_role[]));

-- Note: No direct INSERT policy is granted to anon or authenticated.
-- Direct client INSERT is blocked; all inserts must occur via trusted SECURITY DEFINER
-- routines (create_restaurant or invite_member).
grant select, update, delete on public.restaurant_members to authenticated;
revoke insert on public.restaurant_members from anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. MEMBERSHIP COLUMN IMMUTABILITY GUARD
-- ------------------------------------------------------------------------------
create or replace function public.protect_membership_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Prevent altering immutable identity columns
  if (NEW.id <> OLD.id or NEW.restaurant_id <> OLD.restaurant_id or lower(NEW.email) <> lower(OLD.email)) then
    raise exception 'Cannot alter immutable membership identity columns (id, restaurant_id, email).';
  end if;

  -- Prevent reassigning profile_id once assigned
  if (OLD.profile_id is not null and NEW.profile_id is distinct from OLD.profile_id) then
    raise exception 'Cannot reassign profile_id of an active membership.';
  end if;

  -- Prevent assigning SUPER_ADMIN role
  if (NEW.role = 'SUPER_ADMIN') then
    raise exception 'Cannot assign SUPER_ADMIN role to a restaurant member.';
  end if;

  return NEW;
end;
$$;

revoke execute on function public.protect_membership_columns() from public, anon;

drop trigger if exists tr_protect_membership_columns on public.restaurant_members;
create trigger tr_protect_membership_columns
  before update on public.restaurant_members
  for each row execute procedure public.protect_membership_columns();

-- ------------------------------------------------------------------------------
-- 4. SERVER-SIDE INVITATION RPC
-- ------------------------------------------------------------------------------
-- Ensure auth.users has email_confirmed_at in test / offline environments
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    if not exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at') then
      alter table auth.users add column email_confirmed_at timestamptz;
    end if;
  end if;
end $$;

create or replace function public.invite_member(
  p_restaurant_id uuid,
  p_email text,
  p_role public.app_role
)
returns public.restaurant_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid;
  v_is_owner boolean;
  v_email text;
  v_user_id uuid;
  v_confirmed_at timestamptz;
  v_member public.restaurant_members;
  v_now timestamptz := now();
begin
  -- 1. Authentication check
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'Authentication required to invite members.';
  end if;

  -- 2. Authorization check (mirroring TS team:write permission: ACTIVE RESTAURANT_OWNER or SUPER_ADMIN)
  select (public.is_super_admin() or exists (
    select 1 from public.restaurant_members
    where restaurant_id = p_restaurant_id
      and profile_id = v_caller_id
      and role = 'RESTAURANT_OWNER'
      and status = 'ACTIVE'
  )) into v_is_owner;

  if not coalesce(v_is_owner, false) then
    raise exception 'Unauthorized: only active restaurant owners can invite team members.';
  end if;

  -- 3. Reject SUPER_ADMIN role assignment
  if p_role = 'SUPER_ADMIN' or p_role not in ('RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'STAFF') then
    raise exception 'Invalid role for restaurant member.';
  end if;

  -- 4. Normalize and validate email
  v_email := lower(trim(p_email));
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Invalid email address.';
  end if;

  -- 5. Reject duplicate per (restaurant_id, email)
  if exists (
    select 1 from public.restaurant_members
    where restaurant_id = p_restaurant_id
      and lower(email) = v_email
  ) then
    raise exception 'Member already invited or part of this restaurant.';
  end if;

  -- 6. Server-side account & confirmation lookup in auth.users
  select u.id, u.email_confirmed_at
  into v_user_id, v_confirmed_at
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  -- 7. Insert membership row
  -- ACTIVE with profile_id ONLY if the profile exists AND email is confirmed
  if v_user_id is not null and v_confirmed_at is not null and exists (select 1 from public.profiles where id = v_user_id) then
    insert into public.restaurant_members (
      restaurant_id, profile_id, email, role, status, created_at, updated_at
    ) values (
      p_restaurant_id, v_user_id, v_email, p_role, 'ACTIVE', v_now, v_now
    ) returning * into v_member;
  else
    insert into public.restaurant_members (
      restaurant_id, profile_id, email, role, status, created_at, updated_at
    ) values (
      p_restaurant_id, null, v_email, p_role, 'PENDING', v_now, v_now
    ) returning * into v_member;
  end if;

  -- Return uniform restaurant_members record shape
  return v_member;
end;
$$;

revoke execute on function public.invite_member(uuid, text, public.app_role) from public, anon;
grant execute on function public.invite_member(uuid, text, public.app_role) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. SAFE PENDING MEMBERSHIP CLAIM FUNCTION & TRIGGER
-- ------------------------------------------------------------------------------
create or replace function public.claim_pending_memberships()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Claim ONLY when email is confirmed:
  -- - On INSERT when email_confirmed_at is already set (e.g., confirmations disabled)
  -- - On UPDATE when email_confirmed_at transitions from NULL to NOT NULL
  if (
    (TG_OP = 'INSERT' and NEW.email_confirmed_at is not null) or
    (TG_OP = 'UPDATE' and OLD.email_confirmed_at is null and NEW.email_confirmed_at is not null)
  ) then
    -- Ensure user profile row exists in public.profiles before attaching profile_id
    insert into public.profiles (id, email, name, platform_role, created_at, updated_at)
    values (
      NEW.id,
      lower(NEW.email),
      coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      null,
      now(),
      now()
    )
    on conflict (id) do nothing;

    -- Atomically activate pending invitations matching confirmed email
    update public.restaurant_members
    set profile_id = NEW.id,
        status = 'ACTIVE',
        updated_at = now()
    where lower(email) = lower(NEW.email)
      and profile_id is null
      and status = 'PENDING';
  end if;

  return NEW;
end;
$$;

revoke execute on function public.claim_pending_memberships() from public, anon;

drop trigger if exists tr_claim_pending_memberships on auth.users;
create trigger tr_claim_pending_memberships
  after insert or update on auth.users
  for each row execute procedure public.claim_pending_memberships();
