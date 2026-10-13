# NEXMENU Security Architecture & Threat Model

This document specifies the security boundaries, threat model, and defense-in-depth architecture of the NEXMENU multi-tenant restaurant digital menu platform.

---

## 1. Threat Model & Trust Boundaries

```
┌───────────────────────────────────────────────────────────┐
│                      Client Layer                         │
│  (Vite + React SPA / Browser / Service Worker PWA Cache)  │
│  - Authorization checks in service layer (UX / Gating)    │
│  - Client-side input & MIME validation                    │
│  - Untrusted Execution Environment                        │
└─────────────────────────────┬─────────────────────────────┘
                              │
                    HTTPS API / SQL REST
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                 Database & Storage Boundary               │
│                  (Supabase PostgreSQL & S3)               │
│  - Row-Level Security (RLS) on all tables                 │
│  - Database Invariant Triggers                            │
│  - SECURITY DEFINER Atomic RPC Functions                  │
│  - Scoped Storage Bucket Policies                         │
└───────────────────────────────────────────────────────────┘
```

### Core Security Tenets
1. **The Database Engine is the ONLY Authoritative Security Boundary:**
   - In Supabase mode, Row-Level Security (RLS) policies, database triggers, foreign keys, and PostgreSQL column constraints constitute the real security boundary.
   - Client-side code, router guards, and service-layer checks (`src/services/authorization.ts`) provide immediate user experience feedback and prevent accidental actions, but are completely untrusted. Any client can forge HTTP REST requests using `fetch` directly against Supabase endpoints.
2. **Local Mode (IndexedDB) Has NO Security Boundary:**
   - The local IndexedDB adapter is designed strictly for offline development, rapid prototyping, and self-contained demos.
   - Any user with browser DevTools access has unrestricted read, write, and execute permissions over the local IndexedDB database. Never use Local Mode for production multi-tenant deployments.
3. **A Separate Hostname / URL is NOT a Security Control:**
   - NEXMENU provides dual deployable targets via `VITE_APP_TARGET=admin` and `VITE_APP_TARGET=public`.
   - Isolating the Super Admin panel to a dedicated domain (e.g., `admin.domain.com`) reduces attack surface, eliminates admin code from the public bundle, and allows independent CDN/WAF rules.
   - However, **URL separation is not an authorization control**. Even if an unauthenticated or non-super-admin user navigates to the admin URL, they are blocked by Supabase Auth and database RLS. Non-super-admin profiles attempting to log into the admin build are immediately signed out with a localized "Not Authorized" notification, and all database tables reject non-super-admin cross-tenant queries at the RLS layer.

---

## 2. Trust Zones & Roles

### 1. Public / Unauthenticated Visitors (`anon`)
- Can read published restaurant digital menus solely via the `get_public_menu` RPC function.
- Can submit anonymous menu view and QR scan analytics events.
- **Denied:** Direct table SELECTs on private restaurant data, unpublished/draft products, inactive menus, settings, branding, audit logs, and subscriber records.

### 2. Authenticated Restaurant Staff (`authenticated`)
- Scoped strictly to restaurants where they hold an active membership in `restaurant_members`.
- Cannot read, mutate, or enumerate data belonging to other tenant restaurants.
- Roles within a tenant:
  - `OWNER`: Full control over tenant menus, branding, settings, team members, branches, and subscriptions.
  - `STAFF`: Menu and product catalog management (create/edit categories and dishes).
  - `VIEWER`: Read-only access to tenant metrics and configuration.
- **Enforced Invariant:** Cannot self-promote to `OWNER`, cannot modify memberships of other tenants, and cannot delete or demote the last active `OWNER` of a restaurant.

### 3. Platform Super Admins (`SUPER_ADMIN`)
- Global platform administrators managing platform settings, system-wide subscriptions, and cross-tenant support.
- Can only be provisioned via direct SQL migrations or privileged database administration (SQL Editor / CLI), never through client-facing self-service APIs.

---

## 3. Database Hardening & Invariants

### Profile Protection Trigger (Migrations 007 & 008)
- **Vulnerability Mitigated:** Malicious authenticated users previously could execute `UPDATE public.profiles SET platform_role = 'SUPER_ADMIN' WHERE id = auth.uid();` to self-elevate privileges.
- **Enforcement Mechanism:** The `protect_profile_sensitive_columns` trigger intercepts all `UPDATE` statements on `public.profiles`.
  - Rejects any modification to `platform_role`, `id`, or `email` when executed by standard `authenticated` or `anon` roles.
  - **Migration 008 Fix:** Allows initial bootstrap bypass *only* for privileged database roles (`postgres`, `supabase_admin`, `service_role`, `dashboard_user`) when `auth.uid() IS NULL` (such as queries executed directly in the Supabase Dashboard SQL Editor or psql CLI). It rejects all client-supplied bypass attempts.

### Safe Sign-up Invariant
- Client applications are forbidden from directly inserting into `public.profiles`.
- Registration is handled by the database trigger `on_auth_user_created` attached to `auth.users` on `INSERT`.
- Operates under `SECURITY DEFINER` with a fixed, hardened `search_path = public, auth`.
- Automatically populates the new profile with default `name` and `email` without granting client write permissions.

### Last-Owner Invariant
- To prevent accidental or malicious lockout of a restaurant tenant:
- Database trigger `protect_last_active_owner` executes before `DELETE` or `UPDATE` on `public.restaurant_members`.
- Verifies that the affected restaurant retains at least one active `OWNER`. If the operation would reduce the active owner count below 1, the transaction raises an exception and aborts.

### Atomic Tenant Provisioning
- `create_restaurant` is implemented as a transactional `SECURITY DEFINER` RPC:
  - Creates the restaurant record.
  - Inserts the creator as the initial `OWNER` in `restaurant_members`.
  - Creates default settings, branding, and a `FREE` tier subscription record.
  - Resolves the circular RLS deadlock where an owner cannot create a restaurant because they are not yet a member of it.

---

## 4. Cryptography Standards

### Supabase Mode
- User authentication and credential storage is delegated entirely to Supabase Auth (GoTrue), utilizing server-side key derivation (bcrypt / Argon2).
- Client applications never handle or store raw password hashes.

### Local Mode (IndexedDB)
- Implemented in `src/data/adapters/local/crypto.ts`.
- Uses Web Cryptography API PBKDF2:
  - Algorithm: PBKDF2 with HMAC-SHA-256
  - Iterations: 120,000
  - Derived Key Length: 256 bits (32 bytes)
  - Salt: Cryptographically secure 128-bit random salt (`crypto.getRandomValues`)
- **Fast-Fail on Insecure Context:** If `crypto.subtle` is unavailable (e.g., when accessed over an insecure plain HTTP network IP), the adapter throws `InsecureContextCryptoError`. Insecure custom fallback mixing functions are strictly prohibited to prevent password lockout and weak credential storage.

---

## 5. Asset Storage & File Upload Security

- **Bucket:** `restaurant-assets` (public read, authenticated write).
- **Tenant Path Isolation:** Storage paths are strictly formatted as `${restaurant_id}/${filename}`.
- **RLS Policy:** Policies ensure that an authenticated user can only upload, overwrite, or delete assets inside the folder corresponding to a restaurant where they hold active membership.
- **Upload Guardrails:**
  - File size limit: 5 MB maximum.
  - MIME type restriction: image types only (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`).
  - Validation runs both on client intake and within adapter upload routines.

---

## 6. Web Application Security & Header Hardening

Configured in `vercel.json` for all edge responses:
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
- `X-Frame-Options: DENY`: Prevents clickjacking attacks.
- `Referrer-Policy: strict-origin-when-cross-origin`: Restricts referrer data leakage.
- **Admin Deployment Hardening:**
  - Injected `<meta name="robots" content="noindex,nofollow" />` on the Super Admin build.
  - Disallow-all `robots.txt` generated for the admin deployment.
  - Omission of public PWA manifest and service workers in the admin bundle.
- **HTML & XML Injection Prevention:**
  - Dynamic edge crawler tags pass through `escapeHtml()` in `src/utils/seo.ts`.
  - Dynamic sitemaps pass through `escapeXml()` in `src/utils/sitemap.ts`.
