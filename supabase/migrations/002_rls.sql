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
