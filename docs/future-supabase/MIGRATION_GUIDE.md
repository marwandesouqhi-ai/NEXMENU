# Future Supabase migration

> The SQL files in `supabase/migrations` are **NOT YET APPLIED / NOT CONNECTED**.
> They are architectural preparation and have not been tested against a live database.

## Adapter implementation

1. Create `src/data/adapters/supabase/index.ts`.
2. Implement every method in `DataAdapter` from `src/data/adapters/types.ts`.
3. Keep all UI and domain services unchanged. Only `src/data/index.ts` should select
   the adapter based on `VITE_DATA_ADAPTER`.
4. Map Supabase Auth to `Session` and safe profile types.
5. Use `get_public_menu(slug, branch)` for anonymous reads. Never assemble public
   menus from private table queries in the browser.
6. Use signed uploads or authenticated storage operations with paths beginning in
   the restaurant UUID.
7. Convert a local JSON export into table inserts in dependency order:
   profiles/users, restaurants, memberships, settings/branding, branches,
   categories, products/options, offers, subscriptions, analytics and logs.

## Environment variables

Uncomment these placeholders in `.env.example` only when the adapter exists:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The anonymous key is designed for browser use with RLS. **Never put a Supabase
service-role key in frontend code, Vite variables, commits, or client logs.**

## Applying migrations

Review and test `001` through `005` against a disposable project first. Apply them
in filename order through the Supabase CLI in a controlled CI/CD workflow. Verify:

- anonymous users can call only the public menu RPC and analytics insert;
- owners cannot read a second tenant;
- managers and staff cannot cross their role boundary;
- storage rejects SVG, oversized files and cross-tenant paths;
- subscription notes, users, memberships, audit logs and analytics are never public.

## Public SEO

Client-side metadata is not dependable for WhatsApp, Facebook, or other unfurl
crawlers. Add Vercel Edge Middleware or a prerender endpoint that resolves a slug
through the production adapter and injects Open Graph tags into HTML. Do not expose
private fields or use service credentials at the edge unless they are server-only.
