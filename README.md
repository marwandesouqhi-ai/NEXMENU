# NEXMENU

**Your Restaurant. Your Menu. One QR.**

NEXMENU is a local-first digital restaurant menu SaaS application. Restaurants
manage bilingual menus, branding, branches, offers and QR codes. Guests open
`/r/:slug` without an account. The product intentionally contains no cart,
checkout, ordering, payment, customer account, delivery or order-management code.

## Status and honesty

This build uses a working IndexedDB adapter. CRUD, authentication, persistence,
role checks, public reads, QR generation and analytics execute locally. It calls no
remote backend and has no Supabase runtime dependency.

Local mode is suitable for development and demonstrations, not production:

- data exists only in the current browser;
- a QR scanned on another device cannot see that browser's IndexedDB;
- password reset and email verification are clearly simulated in development;
- client-side authorization is **not real security** because browser owners can
  edit local data;
- real tenant enforcement requires PostgreSQL RLS in a future backend adapter.

Use the dashboard export tool to back up or move local data between browsers.

## Architecture

```text
React UI → TanStack Query/hooks → domain services → authorization layer
                                                  ↓
                                      DataAdapter contract
                                                  ↓
                                  LocalAdapter (IndexedDB)
                                  Future SupabaseAdapter
```

Components never import the local adapter. Services are the only persistence
boundary, so a future adapter requires no UI changes. Public reads use a dedicated
projection that excludes users, memberships, subscriptions, notes, audit logs and
private analytics.

## Technology

React 19, Vite, strict TypeScript, Tailwind CSS v4, local shadcn-style primitives,
Lucide, React Router Data Mode, TanStack Query, Zod, IndexedDB via `idb`, Recharts,
QRCode, Web Crypto PBKDF2, vite-plugin-pwa, Vitest and ESLint.

## Structure

- `src/app` — providers, RouterProvider, guards and locale context
- `src/components` — reusable UI and product components
- `src/config` — plan capabilities and limits
- `src/data/adapters/types.ts` — complete persistence contract
- `src/data/adapters/local` — IndexedDB auth, repositories and seed
- `src/data/adapters/supabase` — intentionally empty placeholder
- `src/services` — business logic, authorization and tenant checks
- `src/pages`, `src/layouts` — route surfaces
- `src/types/domain.ts` — backend-agnostic domain types
- `src/utils` — opening-hours, slug and Arabic search logic
- `supabase/migrations` — unexecuted future schema/RLS/storage preparation
- `docs/future-supabase` — migration and edge SEO guidance

## Setup

The repository uses pnpm as defined by its toolchain:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Figma Make already supervises the development server; do not start a second server
inside that environment.

### Environment

```dotenv
VITE_DATA_ADAPTER=local
VITE_APP_ORIGIN=
```

`VITE_APP_ORIGIN` defaults to `window.location.origin`. Future Supabase variables
are commented placeholders and unused.

## Development credentials

Development-only seeded accounts:

- Owner: `owner@cafemoon.local` / `Moon@1234`
- Super admin: `admin@nexmenu.local` / `Admin@1234`

Never use these credentials in production.

The first IndexedDB initialization also creates the clearly flagged Cafe Moon seed:
five categories, eighteen products, informational extras, an active offer, opening
hours with split/overnight shifts, two branches, a PRO subscription and privacy-safe
sample analytics. Bundled artwork is original generated imagery.

## Authentication and authorization

Local passwords use PBKDF2-SHA256 with a random salt and 120,000 iterations.
Sessions persist in IndexedDB. Development password reset returns a one-time code
to the UI rather than pretending to send email. Pending local team invitations are
accepted when the matching email signs up.

`src/services/authorization.ts` centralizes tenant and role checks. Every private
service call receives a session. Cross-tenant access throws `ForbiddenError`.
Owner, manager, staff and super-admin permissions are unit tested.

## Plans

FREE, BASIC, PRO and PREMIUM are data in `src/config/plans.ts`. Services enforce
product and branch limits. Expired plans fall back to FREE capabilities without
deleting data. Plans are assigned manually; there is no billing or payment page.

## Public menu

The menu supports English/Arabic and updates `<html lang>`/`dir`, instant normalized
Arabic/English search, category/availability filters, offers, branch contact data,
restaurant-timezone opening status, informational options and product detail sheets.
At wide viewport sizes it remains centered at 820px and never becomes a desktop
storefront.

Client-side title and metadata are updated per menu, but social crawlers commonly do
not execute SPA JavaScript. Therefore WhatsApp/Facebook previews are **not claimed
to work in local mode**. See `docs/future-supabase/edge-seo-placeholder.md`.

## Analytics privacy

Events are limited to menu view, QR scan, product view, category view and search.
They contain restaurant/branch, timestamp, language, source and coarse mobile/tablet
class. No IP, full user agent, fingerprint or personal information is recorded.
Do-Not-Track disables event persistence. QR scans are deduplicated per session and
search logging is debounced.

## PWA

The generated manifest includes 192px, 512px, maskable and Apple icons. Workbox
caches the public shell and immutable assets. Dashboard, admin and auth navigations
are excluded from service-worker navigation fallback caching. Menu data itself is
offline-capable because it resides in IndexedDB. When a remote adapter is added,
cache only its public menu endpoint using network-first with a safe fallback.

## Tests and quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Unit tests cover tenant isolation, role permissions, plan expiry, URL slugs, Arabic
normalization and timezone-aware split/overnight opening hours. Responsive browser
and Lighthouse testing should also be run in deployment CI with Playwright and
real device labs.

## Vercel

`vercel.json` rewrites routes to `index.html`. Set `VITE_DATA_ADAPTER=local` only
for demos; local mode is not cross-device production hosting. Deploy built assets
from `dist`.

## Future backend

See [the Supabase migration guide](docs/future-supabase/MIGRATION_GUIDE.md).
Prepared SQL includes UUID keys, constraints, indexes, tenant RLS, a public-safe
menu RPC and storage policies. The files are marked **NOT YET APPLIED / NOT
CONNECTED** and have not been tested against a live database.

Roadmap: Supabase adapter, verified RLS/storage, transactional onboarding, real
email delivery, edge-rendered SEO, custom domain resolution and plan-gated
white-label support.
