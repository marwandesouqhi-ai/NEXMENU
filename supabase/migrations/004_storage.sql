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
