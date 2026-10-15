# NEXMENU Dual-Project Deployment Architecture

This guide documents deploying NEXMENU as two decoupled, independently hardened projects originating from the same GitHub repository. The primary deployment instructions use Vercel; a Netlify preview setup is documented below.

## Netlify Preview Deployment

The two applications can also be previewed as separate Netlify sites connected to the same repository. The repository includes `netlify.toml` for the SPA fallback, security headers, public SEO functions, and `dist` output. Netlify functions are deployed from `api/`.

Create two Netlify sites from the repository and configure each from **Project configuration > Build & deploy > Continuous deployment > Build settings**:

| Site | Build command | Publish directory | Environment |
|---|---|---|---|
| Customer preview | `pnpm build:public` | `dist` | `VITE_DATA_ADAPTER=local`, `VITE_SITE_URL=<Netlify preview URL>` |
| Admin/CRM preview | `pnpm build:admin` | `dist` | `VITE_DATA_ADAPTER=local`, `VITE_SITE_URL=<Netlify admin preview URL>` |

Use the Netlify-provided `*.netlify.app` URLs for previews and do not attach `nexumenu.com` or `admin.nexumenu.com` yet. Local adapter preview data is browser-local demo data and is not shared with customers or connected to production Supabase. Restrict access to the admin preview in Netlify if the account supports site access controls.

Before production launch, apply `supabase/complete_setup.sql`, verify the first `SUPER_ADMIN`, and then replace `VITE_DATA_ADAPTER=local` on both Netlify sites with `supabase`. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`), and the correct public/admin `VITE_SITE_URL` in Netlify environment variables. Never add credentials to Git or paste them into chat. Attach `nexumenu.com` to the customer site and `admin.nexumenu.com` to the CRM site only after the production backend and both sites have been verified.

---

## 1. Architecture Overview

| Dimension | Project 1: Public & Restaurant Portal (`nexmenu-public`) | Project 2: Super Admin Portal (`nexmenu-admin`) |
| :--- | :--- | :--- |
| **Domain** | `https://yourdomain.com` (Apex & `www`) | `https://admin.yourdomain.com` (or `nexmenu-admin.vercel.app`) |
| **`VITE_APP_TARGET`** | `public` | `admin` |
| **Build Command** | `pnpm build:public` | `pnpm build:admin` |
| **Output Directory** | `dist` | `dist` |
| **Exposed Routes** | `/`, `/r/:slug`, `/login`, `/signup`, `/dashboard`, `/onboarding` | `/login`, `/reset-password`, `/admin`, `/crm-admin` (`/` redirects to `/admin`) |
| **Pruned Code** | Admin and CRM pages completely removed | Landing, Public Menus, Dashboard, Analytics, PWA Service Worker completely removed |
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
6. The CRM is available at `https://admin.yourdomain.com/crm-admin`; it uses the same Supabase project and credentials as the admin portal. Admin application source files live in the repository-root `admin/` folder.

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

4. **Subscription Receipt OCR:**
   - The customer portal and CRM read receipt text in the browser using Tesseract.js (English and Arabic).
   - The browser downloads the OCR runtime and language data from the Tesseract.js CDN; allow access to that CDN if receipt analysis is required.
   - Receipt images are analyzed in the browser and are not sent to an OCR provider. If OCR is unavailable, the CRM can still review the original private receipt.
   - OCR only compares visible text with the configured transfer number and the selected plan price. It cannot verify a completed transfer and must never be treated as proof of payment; a super administrator must confirm receipt in the official payment account before approval.

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
