# NEXMENU – SEO Architecture & Social Crawler Handling

## Current Architecture (Client-Side SPA / IndexedDB Mode)

In local browser mode:
1. `useSeo` hook actively injects:
   - `<title>`
   - `<meta name="description">`
   - `<link rel="canonical" href="...">`
   - Open Graph tags (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:site_name`)
   - Twitter card tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
   - `<script type="application/ld+json">` with schema.org `Restaurant` and `Menu` hierarchy.
2. Search engine crawlers that execute JavaScript (such as Googlebot and Bingbot) discover, render, and index these tags and the rich JSON-LD structure accurately.

---

## Limitation with Social Media Crawlers

Social media link preview scrapers (WhatsApp, Facebook, Twitter / X, Telegram, Discord, LinkedIn, iMessage):
- **Do not execute client-side JavaScript.**
- They perform an immediate `GET /r/:slug` HTTP request and inspect only the static HTML returned in the HTTP response.
- Because the raw `index.html` only contains the static NEXMENU platform title and description, link previews would show generic platform branding rather than the specific restaurant's name, cover image, and description.

---

## Recommended Solution for Vercel & Supabase Phase

When real backend persistence is active (Phase 7 with Supabase or Edge Config):

### Vercel Edge Function (`api/edge-meta.ts`)

A lightweight Vercel Edge Middleware / Serverless Function intercepts incoming requests matching `/r/:slug`:
1. Checks the user agent against known social crawler patterns (`WhatsApp`, `facebookexternalhit`, `Twitterbot`, `TelegramBot`, `LinkedInBot`, `Discordbot`).
2. If the user agent is a social crawler:
   - Queries the restaurant record via Supabase REST API or Edge Config using `slug`.
   - Reads `index.html` template.
   - Replaces `<title>`, `meta[property="og:*"]`, and `meta[name="twitter:*"]` placeholders with the restaurant's real name, description, and cover image.
   - Returns the prerendered HTML with status 200 and `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
3. If the user is a normal browser:
   - Continues to the standard SPA rewrite (`/index.html`), which boots React and runs the client-side app with full offline PWA service worker caching.

### Dynamic XML Sitemap (`api/sitemap.xml.ts`)

- In local mode, menu data lives in client IndexedDB, so build-time static sitemap generation is not feasible.
- In backend mode, an endpoint `GET /sitemap.xml` queries active restaurant slugs:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://nexmenu.com/r/moon-cafe</loc>
      <changefreq>daily</changefreq>
      <priority>0.8</priority>
    </url>
  </urlset>
  ```
