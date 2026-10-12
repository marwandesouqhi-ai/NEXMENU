# NEXMENU – Lighthouse CI Guide & Quality Benchmarks

## Overview

Lighthouse CI (LHCI) continuously validates NEXMENU's performance, accessibility (WCAG 2.1 AA), progressive web application (PWA) readiness, best practices, and search engine optimization (SEO) across all public menus and landing routes.

## Configuration (`lighthouserc.json`)

NEXMENU ships with a root `lighthouserc.json` configured for headless Chromium audits:

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "pnpm preview",
      "url": [
        "http://localhost:4173/",
        "http://localhost:4173/r/cafe-moon"
      ],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.90 }],
        "categories:seo": ["error", { "minScore": 0.95 }]
      }
    }
  }
}
```

## Running Lighthouse CI Locally

### Prerequisites
Ensure the production build has been generated first:
```bash
pnpm build
```

### Run LHCI
You can run Lighthouse CI on-demand using `npx` or `pnpm dlx`:
```bash
npx @lhci/cli@0.14.x autorun
```

Or step-by-step:
1. **Collect Audits:**
   ```bash
   npx @lhci/cli collect --start-server-command="pnpm preview" --url="http://localhost:4173/r/cafe-moon"
   ```
2. **Assert Assertions:**
   ```bash
   npx @lhci/cli assert
   ```

## Key Quality Gates

1. **Accessibility (Target: 95%+)**:
   - WCAG 2.1 AA compliant color contrast (checked dynamically via `@/utils/contrast`).
   - Accessible reordering buttons with informative `aria-label`s.
   - Screen-reader friendly category navigation and semantic HTML heading hierarchy.
2. **SEO (Target: 95%+)**:
   - Valid `<title>`, meta description, canonical URLs, and OpenGraph / Twitter tags.
   - Rich JSON-LD `Restaurant` and `Menu` structured data markup.
   - Crawl policy configured via `/robots.txt`.
3. **PWA (Target: 100%)**:
   - `manifest.webmanifest` served with theme colors, icons, and `display: standalone`.
   - Workbox service worker caching assets and public menu API responses for offline resilience.
4. **Performance (Target: 85%+ on Mobile, 95%+ on Desktop)**:
   - Lazy-loaded dashboard sections reducing initial load from 410 kB to 4.3 kB.
   - Optimized font subsets (`@fontsource/inter` and `@fontsource/cairo`).
   - Responsive lazy-loaded images with width/height attributes.

## Continuous Integration (`.github/workflows/ci.yml`)

Add the following step to GitHub Actions workflow after `pnpm build`:

```yaml
- name: Run Lighthouse CI
  run: npx @lhci/cli@0.14.x autorun
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```
