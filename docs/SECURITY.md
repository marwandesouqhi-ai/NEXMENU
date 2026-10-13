# NEXMENU Security Architecture & Threat Model

This document specifies the security boundaries, threat model, and defense-in-depth architecture of the NEXMENU multi-tenant restaurant digital menu platform.

---

## 1. Threat Model & Trust Boundaries

```
┌───────────────────────────────────────────────────────────┐
│                      Client Layer                         │
│  (Vite + React SPA / Browser / Service Worker PWA Cache)  │
│  - Authorization checks in service layer                  │
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
│  - Column-Level Privilege Revocations                     │
│  - Database Invariant Triggers                            │
│  - SECURITY DEFINER Atomic RPC Functions                  │
│  - Scoped Storage Bucket Policies                         │
└───────────────────────────────────────────────────────────┘
```

### Trust Zones
1. **Public / Unauthenticated Visitors (`anon`):**
   - Can read published restaurant digital menus via `get_public_menu` RPC.
   - Can submit menu view and QR scan analytics events.
   - Cannot access administrative dashboards, inactive menus, unpublished draft items, or subscriber details.
2. **Authenticated Restaurant Staff (`authenticated`):**
   - Scoped strictly to restaurants where they hold an active membership in `restaurant_members`.
   - Cannot read, mutate, or enumerate data of other tenant restaurants.
   - Roles within a tenant:
     - `OWNER`: Full control over tenant menus, branding, settings, team members, and branches.
     - `STAFF`: Menu and product catalog management.
     - `VIEWER`: Read-only access to tenant metrics and configuration.
3. **Platform Super Admins (`SUPER_ADMIN`):**
   - Global platform administrators managing platform settings, subscriptions, and cross-tenant support.
   - Can only be provisioned via direct SQL migrations or service-role administrative operations, never through self-service client APIs.

---

## 2. Authorization: Client Service Layer vs Database RLS

NEXMENU implements defense-in-depth across two distinct layers:

| Layer | Implementation | Purpose | Can Be Bypassed by Malicious Client? |
|---|---|---|:---:|
| **Client Service Layer** | `src/services/authorization.ts` | Instant UI feedback, permission gating, optimistic validation | Yes (by direct HTTP/REST calls) |
| **Database RLS Layer** | `supabase/migrations/001_initial_schema.sql` - `007_security_and_correctness.sql` | Authoritative security enforcement, tenant isolation | **No** (Enforced by PostgreSQL engine) |

### Privilege Escalation Mitigations (Migration 007)
Prior audits identified that a basic `profiles_self_update` policy (`id = auth.uid()`) allowed clients to update any column in `public.profiles`, including `platform_role`.

**Mitigation Implemented:**
1. **Trigger `protect_profile_sensitive_columns`:** Rejects any `UPDATE` modifying `platform_role`, `id`, or `email` unless executed by a user with `platform_role = 'SUPER_ADMIN'` or the PostgreSQL system superuser.
2. **Column-Level Revocation:** Explicitly executed `REVOKE UPDATE (platform_role, id, email) ON public.profiles FROM authenticated;`.

### Safe Sign-up Invariant
Rather than relying on client-side writes to `public.profiles` during registration (which fails when sensitive columns are restricted or triggers are absent):
- Database trigger `on_auth_user_created` is attached to `auth.users` on `INSERT`.
- Operates under `SECURITY DEFINER` with a hardened `search_path = public, auth`.
- Automatically populates the new profile with default `name` and `email` from user metadata without opening write permissions to the client.

### Last-Owner Invariant
To prevent accidental or malicious lockout of a restaurant tenant:
- Database trigger `protect_last_active_owner` runs before `DELETE` or `UPDATE` on `public.restaurant_members`.
- Verifies that the affected restaurant retains at least one active `OWNER`. If the operation would reduce the count below 1, the transaction raises an exception and aborts.

### Atomic Tenant Provisioning
`create_restaurant` is implemented as a transactional `SECURITY DEFINER` RPC:
- Creates the restaurant record.
- Inserts the creator as the initial `OWNER` in `restaurant_members`.
- Creates default settings, branding, and a `FREE` tier subscription record.
- Resolves the circular RLS chicken-and-egg deadlock where an owner cannot create a restaurant because they are not yet a member of it.

---

## 3. Cryptography Standards

### Supabase Mode
- User authentication and credential storage is delegated entirely to Supabase Auth (GoTrue), utilizing industry-standard server-side key derivation (bcrypt / Argon2).
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

## 4. Asset Storage & File Upload Security

- **Bucket:** `restaurant-assets` (public read, authenticated write).
- **Tenant Path Isolation:** Storage paths are strictly formatted as `${restaurant_id}/${filename}`.
- **RLS Policy:** Policies ensure that an authenticated user can only upload, overwrite, or delete assets inside the folder corresponding to a restaurant where they hold active membership.
- **Upload Guardrails:**
  - File size limit: 5 MB maximum.
  - MIME type restriction: image types only (`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`).
  - Validation runs both on client intake and within adapter upload routines.

---

## 5. Web Application Security & Header Hardening

Configured in `vercel.json` for all edge responses:
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
- `X-Frame-Options: DENY`: Prevents clickjacking attacks.
- `Referrer-Policy: strict-origin-when-cross-origin`: Restricts referrer data leakage.
- HTML & XML Injection Prevention:
  - Dynamic edge crawler tags pass through `escapeHtml()` in `src/utils/seo.ts`.
  - Dynamic sitemaps pass through `escapeXml()` in `src/utils/sitemap.ts`.
