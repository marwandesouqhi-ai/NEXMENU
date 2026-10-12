# Edge SEO placeholder

Future route: `/r/:slug`.

A Vercel edge or server function should fetch only the public menu projection and
inject title, description, canonical, Open Graph image and Restaurant JSON-LD.
This is intentionally not implemented while the application is local-only because
another device or crawler cannot access this browser's IndexedDB.
