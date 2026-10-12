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
