# NEXMENU Dual-Project Deployment Architecture (Vercel)

This guide documents deploying NEXMENU as two decoupled, independently hardened Vercel projects originating from the same GitHub repository.

---

## 1. Architecture Overview

| Dimension | Project 1: Public & Restaurant Portal (`nexmenu-public`) | Project 2: Super Admin Portal (`nexmenu-admin`) |
| :--- | :--- | :--- |
| **Domain** | `https://yourdomain.com` (Apex & `www`) | `https://admin.yourdomain.com` (or `nexmenu-admin.vercel.app`) |
| **`VITE_APP_TARGET`** | `public` | `admin` |
| **Build Command** | `pnpm build:public` | `pnpm build:admin` |
| **Output Directory** | `dist` | `dist` |
| **Exposed Routes** | `/`, `/r/:slug`, `/login`, `/signup`, `/dashboard`, `/onboarding` | `/login`, `/reset-password`, `/admin` (`/` redirects to `/admin`) |
| **Pruned Code** | `/admin` and `AdminPage` completely removed | Landing, Public Menus, Dashboard, Analytics, PWA Service Worker completely removed |
| **SEO & Crawlers** | Indexed (`robots.txt`, `sitemap.xml`, OpenGraph) | Blocked (`noindex,nofollow` meta, disallow-all `robots.txt`) |

---

## 2. Setting Up the Two Vercel Projects

### Project 1: Public Site (`nexmenu-public`)
1. In Vercel, click **Add New... > Project** and import the `nexmenu` repository.
2. Configure **Build & Development Settings**:
   - Framework Preset: **Vite**
   - Root Directory: `./`
   - Build Command: `pnpm build:public`
   - Output Directory: `dist`
   - Install Command: `pnpm install`
3. Configure **Environment Variables**:
   ```ini
   VITE_DATA_ADAPTER=supabase
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   VITE_SITE_URL=https://yourdomain.com
   VITE_PUBLIC_SITE_URL=https://yourdomain.com
   VITE_APP_TARGET=public
   ```
4. Assign Custom Domain:
   - Add `yourdomain.com` and `www.yourdomain.com`.

### Project 2: Super Admin Site (`nexmenu-admin`)
1. In Vercel, click **Add New... > Project** and import the **same** repository again.
2. Name the project `nexmenu-admin`.
3. Configure **Build & Development Settings**:
   - Framework Preset: **Vite**
   - Root Directory: `./`
   - Build Command: `pnpm build:admin`
   - Output Directory: `dist`
   - Install Command: `pnpm install`
4. Configure **Environment Variables**:
   ```ini
   VITE_DATA_ADAPTER=supabase
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   VITE_SITE_URL=https://admin.yourdomain.com
   VITE_PUBLIC_SITE_URL=https://yourdomain.com
   VITE_APP_TARGET=admin
   ```
5. Assign Custom Domain:
   - Add `admin.yourdomain.com` (or use the Vercel default domain `nexmenu-admin.vercel.app`).

---

## 3. DNS Configuration (CNAME Records)

In your DNS provider (Cloudflare, Namecheap, Route 53, etc.):
- **Public Domain (`yourdomain.com` / `www`):**
  - Type `A`: `@` points to `76.76.21.21` (Vercel IP)
  - Type `CNAME`: `www` points to `cname.vercel-dns.com`
- **Admin Domain (`admin.yourdomain.com`):**
  - Type `CNAME`: `admin` points to `cname.vercel-dns.com`

---

## 4. Supabase Auth Redirect URLs

Because browser `localStorage` sessions and auth callbacks are scoped per origin, you **must register BOTH origins** in the Supabase Dashboard:

1. Open **Supabase Dashboard > Authentication > URL Configuration**.
2. Set **Site URL** to:
   ```
   https://yourdomain.com
   ```
3. In **Redirect URLs**, add:
   ```
   https://yourdomain.com/**
   https://www.yourdomain.com/**
   https://admin.yourdomain.com/**
   https://nexmenu-admin.vercel.app/**
   http://localhost:5173/**
   ```
4. Save changes.

---

## 5. Security & Access Control

1. **Admin Portal Isolation:**
   - The admin target code has all public routes and restaurant menus stripped at build time.
   - Non-`SUPER_ADMIN` accounts attempting to log into `admin.yourdomain.com` are signed out immediately with an explicit "Access Denied" screen and never redirected to `/dashboard`.
2. **Optional Vercel Deployment Protection:**
   - If using a Vercel Pro/Enterprise plan, you can enable **Vercel Authentication** or **Password Protection** specifically on the `nexmenu-admin` project under **Settings > Deployment Protection**.
   - Note: Free Vercel Hobby tier does not support IP allowlisting; application-level RLS and `SUPER_ADMIN` role checks serve as the primary security boundary.
3. **HTTP Security Headers for Admin:**
   - To enforce strict caching barriers on the admin portal, configure headers in Vercel Project Settings for `nexmenu-admin`:
     - `X-Robots-Tag`: `noindex, nofollow, noarchive`
     - `Cache-Control`: `no-store, no-cache, must-revalidate`

---

## 6. Verification Checklist

1. **Verify Public Site:**
   - Visit `https://yourdomain.com/` — Landing page loads.
   - Visit `https://yourdomain.com/r/cafe-moon` — Public menu loads.
   - Visit `https://yourdomain.com/admin` — Returns 404 Not Found.
   - Visit `https://yourdomain.com/robots.txt` — Shows normal indexing directives.
2. **Verify Admin Site:**
   - Visit `https://admin.yourdomain.com/` — Automatically redirects to `/admin`.
   - Visit `https://admin.yourdomain.com/robots.txt` — Returns `User-agent: *\nDisallow: /`.
   - View Source on `https://admin.yourdomain.com/` — Contains `<meta name="robots" content="noindex,nofollow" />`.
   - Log in with non-super-admin account — Displays "Access Denied" screen and logs user out.
   - Log in with `SUPER_ADMIN` account — Displays platform management panel.
