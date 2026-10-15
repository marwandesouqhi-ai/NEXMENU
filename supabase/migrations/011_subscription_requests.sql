create table public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  requester_profile_id uuid not null references public.profiles(id) on delete restrict,
  requested_plan public.plan_code not null,
  payment_method text not null check (payment_method in ('INSTAPAY', 'VODAFONE_CASH', 'FREE')),
  payment_number text not null default '',
  payment_reference text not null default '',
  amount numeric(10, 2) not null check (amount >= 0),
  proof_path text,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_request_payment_details check (
    (payment_method = 'FREE' and payment_number = '' and amount = 0 and proof_path is null)
    or
    (payment_method <> 'FREE' and length(trim(payment_number)) > 0 and amount > 0 and proof_path is not null)
  ),
  constraint subscription_request_proof_tenant_path check (
    proof_path is null or proof_path like restaurant_id::text || '/' || id::text || '/%'
  )
);

create index subscription_requests_restaurant_created_idx
  on public.subscription_requests (restaurant_id, created_at desc);
create index subscription_requests_pending_created_idx
  on public.subscription_requests (created_at desc)
  where status = 'PENDING';
create unique index subscription_requests_one_pending_per_restaurant_idx
  on public.subscription_requests (restaurant_id)
  where status = 'PENDING';

alter table public.subscription_requests enable row level security;
create policy subscription_requests_owner_read
  on public.subscription_requests for select to authenticated
  using (public.is_restaurant_member(restaurant_id, array['RESTAURANT_OWNER']::public.app_role[]));
create policy subscription_requests_owner_create
  on public.subscription_requests for insert to authenticated
  with check (
    requester_profile_id = (select auth.uid())
    and status = 'PENDING'
    and reviewer_profile_id is null
    and reviewed_at is null
    and public.is_restaurant_member(restaurant_id, array['RESTAURANT_OWNER']::public.app_role[])
  );
create policy subscription_requests_admin_update
  on public.subscription_requests for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant select, insert, update on public.subscription_requests to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subscription-proofs',
  'subscription-proofs',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy subscription_proofs_owner_upload
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'subscription-proofs'
    and public.is_restaurant_member(
      ((storage.foldername(name))[1])::uuid,
      array['RESTAURANT_OWNER']::public.app_role[]
    )
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );
create policy subscription_proofs_owner_or_admin_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'subscription-proofs'
    and (
      public.is_super_admin()
      or public.is_restaurant_member(
        ((storage.foldername(name))[1])::uuid,
        array['RESTAURANT_OWNER']::public.app_role[]
      )
    )
  );
create policy subscription_proofs_owner_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'subscription-proofs'
    and public.is_restaurant_member(
      ((storage.foldername(name))[1])::uuid,
      array['RESTAURANT_OWNER']::public.app_role[]
    )
  );

grant insert on public.notifications to authenticated;
create policy notifications_admin_insert
  on public.notifications for insert to authenticated
  with check (public.is_super_admin());

create or replace function public.review_subscription_request(
  p_request_id uuid,
  p_decision text,
  p_admin_notes text,
  p_reviewer_profile_id uuid
)
returns setof public.subscription_requests
language plpgsql
set search_path = public
as $$
declare
  v_request public.subscription_requests;
  v_now timestamptz := now();
  v_expires timestamptz := now() + interval '1 year';
  v_status text;
begin
  if not public.is_super_admin()
     or p_reviewer_profile_id is distinct from (select auth.uid()) then
    raise exception 'Only the authenticated super administrator can review subscription requests.';
  end if;

  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Invalid subscription request decision.';
  end if;

  select *
    into v_request
    from public.subscription_requests
    where id = p_request_id
    for update;

  if not found then
    raise exception 'Subscription request not found.';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'This subscription request has already been reviewed.';
  end if;

  update public.subscription_requests
     set status = p_decision,
         reviewer_profile_id = p_reviewer_profile_id,
         reviewed_at = v_now,
         admin_notes = coalesce(p_admin_notes, ''),
         updated_at = v_now
   where id = p_request_id
   returning * into v_request;

  if p_decision = 'APPROVED' then
    insert into public.subscriptions (
      id, restaurant_id, plan, starts_at, expires_at, status, notes, created_at, updated_at
    )
    values (
      gen_random_uuid(),
      v_request.restaurant_id,
      v_request.requested_plan,
      v_now,
      v_expires,
      'ACTIVE',
      'Approved payment request ' || v_request.id::text,
      v_now,
      v_now
    )
    on conflict (restaurant_id) do update
       set plan = excluded.plan,
           starts_at = excluded.starts_at,
           expires_at = excluded.expires_at,
           status = 'ACTIVE',
           notes = excluded.notes,
           updated_at = excluded.updated_at;
  end if;

  v_status := lower(p_decision);
  insert into public.notifications (
    id, restaurant_id, profile_id, title, body, created_at, updated_at
  )
  select
    gen_random_uuid(),
    v_request.restaurant_id,
    member.profile_id,
    'Subscription request ' || v_status,
    case
      when p_decision = 'APPROVED' then
        'Your ' || v_request.requested_plan::text || ' plan is active until ' || v_expires::date::text || '.'
      else
        'Your request for the ' || v_request.requested_plan::text || ' plan was not approved.'
          || case when length(coalesce(p_admin_notes, '')) > 0 then ' Admin note: ' || p_admin_notes else '' end
    end,
    v_now,
    v_now
  from public.restaurant_members member
  where member.restaurant_id = v_request.restaurant_id
    and member.role = 'RESTAURANT_OWNER'
    and member.status = 'ACTIVE'
    and member.profile_id is not null;

  insert into public.audit_logs (
    id, restaurant_id, actor_profile_id, actor_role, action, entity_type, entity_id, metadata, created_at, updated_at
  )
  values (
    gen_random_uuid(),
    v_request.restaurant_id,
    p_reviewer_profile_id,
    'SUPER_ADMIN',
    'subscription_request.' || v_status,
    'subscription_request',
    v_request.id,
    jsonb_build_object('plan', v_request.requested_plan),
    v_now,
    v_now
  );

  return next v_request;
end;
$$;

revoke all on function public.review_subscription_request(uuid, text, text, uuid) from public, anon;
grant execute on function public.review_subscription_request(uuid, text, text, uuid) to authenticated;
