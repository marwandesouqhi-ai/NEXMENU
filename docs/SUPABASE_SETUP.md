# NEXMENU — Supabase Real Backend Setup Guide

This guide details how to provision and connect a production PostgreSQL backend on Supabase to NEXMENU using the `SupabaseAdapter`.

---

## 1. Prerequisites & Provisioning

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Retrieve your project connection parameters from **Project Settings > API**:
   - **Project URL** (`https://<project-ref>.supabase.co`)
   - **Anon / Public Key** (`eyJhbGciOi...`)

---

## 2. Apply Database Migrations

The database schema, Row-Level Security (RLS) policies, indexes, storage buckets, and subscription constraints are organized under `supabase/migrations/`:

| Migration File | Description |
|---|---|
| `supabase/migrations/001_initial_schema.sql` | Core schema: profiles, restaurants, members, settings, branding, branches, categories, products, options, offers, qr_codes, analytics, subscriptions, notifications, audit_logs. |
| `supabase/migrations/002_rls.sql` | Strict multi-tenant Row Level Security policies with helper functions `is_super_admin()` and `is_restaurant_member()`. Includes deterministic `order by created_at asc, id asc limit 1` in `get_public_menu`. |
| `supabase/migrations/003_indexes.sql` | Foreign key indexes, slug lookup indexes, and sorting performance optimizations. |
| `supabase/migrations/004_storage.sql` | Storage bucket creation (`restaurant-assets`, `product-images`, `branding-assets`) and access policies. |
| `supabase/migrations/005_seed.sql` | System default subscription plans (`FREE`, `BASIC`, `PRO`, `PREMIUM`). |
| `supabase/migrations/006_subscription_fields.sql` | Date validation constraint (`expires_at >= starts_at`) and notes field. |
| `supabase/migrations/007_security_and_correctness.sql` | **Critical Security & Invariants:** Privilege escalation protection trigger & column revoke, auth.users sign-up trigger, database-level last active owner protection trigger, and atomic transaction RPCs (`create_restaurant`, `reorder_categories`, `reorder_products`). |
| `supabase/migrations/008_super_admin_bootstrap_and_menu_fix.sql` | **Operator Bootstrap & Compatibility:** Modifies `get_public_menu` to use deterministic UUID ordering. (Profile trigger superseded by 009). |
| `supabase/migrations/009_profile_protection_security_definer_fix.sql` | **Critical Security Hardening:** Restricts `protect_profile_sensitive_columns` privileged bypass strictly to `auth.uid() is null AND session_user not in ('authenticator','anon','authenticated')`. Inside SECURITY DEFINER, `session_user` preserves the real client role. Revokes table UPDATE from anon/authenticated and grants UPDATE strictly on `(name)` to authenticated. |

### Applying Migrations:

- **Single Bundle (Recommended):** Generate `supabase/complete_setup.sql` with `pnpm sql:bundle` and paste the entire script into **Supabase Dashboard > SQL Editor**. Verify integrity at any time with `pnpm sql:check`.
- **Sequential Migrations (CLI):**
  ```bash
  supabase link --project-ref <your-project-ref>
  supabase db push
  ```

---

## 3. Bootstrapping the Initial Super Admin

For security reasons, client self-registration can never assign the `SUPER_ADMIN` platform role. Migration `009` securely allows direct operator bootstrap when queries execute from the Supabase Dashboard SQL Editor (running as the database `postgres` role without a client JWT):

1. **Sign Up:** Register your account normally via the app UI or Supabase Auth.
2. **Execute Bootstrap Update:** Open the **Supabase Dashboard > SQL Editor** and run:
   ```sql
   UPDATE public.profiles
   SET platform_role = 'SUPER_ADMIN'
   WHERE email = 'marwandesouqhi@gmail.com';
   ```
3. **Verify Target User:**
   ```sql
   SELECT id, email, platform_role FROM public.profiles WHERE email = 'marwandesouqhi@gmail.com';
   ```
4. **Audit Confirm:** Run a platform-wide check to verify that only authorized super admin accounts exist:
   ```sql
   SELECT id, email, platform_role FROM public.profiles WHERE platform_role = 'SUPER_ADMIN';
   ```

---

## 4. Environment Configuration

Create or update `.env.local` in the project root:

```env
# Enable Supabase data adapter
VITE_DATA_ADAPTER=supabase

# Supabase Credentials
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# App URL for QR codes
VITE_APP_ORIGIN=https://nexmenu.example.com
```

When `VITE_DATA_ADAPTER` is omitted or set to `local`, NEXMENU automatically uses the IndexedDB `LocalAdapter`.

---

## 5. Architecture & Security

- **Multi-Tenant Isolation:** Enforced via RLS in PostgreSQL and dual-checked in the application service layer (`src/services/authorization.ts`).
- **Storage:** Product photos and branding logos are stored in the `restaurant-assets` bucket and served over global CDN.
- **Data Export & Portability:** Full JSON database export/import is preserved across both adapters for tenant migration and disaster recovery.
