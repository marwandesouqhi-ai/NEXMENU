-- NOT YET APPLIED / NOT CONNECTED.
-- Safe plan metadata only. Development restaurant/user seed must be created via a server-side script.
insert into public.subscription_plans(code,name,limits,features) values
('FREE','Free','{"products":30,"branches":1}','{"analytics":false,"advanced_branding":false,"hide_branding":false}'),
('BASIC','Basic','{"products":100,"branches":1}','{"analytics":true,"advanced_branding":true,"hide_branding":false}'),
('PRO','Pro','{"products":null,"branches":5}','{"analytics":true,"advanced_branding":true,"hide_branding":true}'),
('PREMIUM','Premium','{"products":null,"branches":null}','{"analytics":true,"advanced_branding":true,"hide_branding":true,"custom_domain_preparation":true}')
on conflict(code) do update set name=excluded.name,limits=excluded.limits,features=excluded.features;
