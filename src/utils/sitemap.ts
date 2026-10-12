import { escapeXml, getSiteUrl } from "./seo";

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

/**
 * Builds standard XML sitemap compliant with sitemaps.org schema.
 * All slugs and URLs are strictly XML-escaped to prevent injection.
 */
export function generateSitemapXml(
  restaurants: Array<{ slug: string; updated_at?: string }>,
  siteUrl: string = getSiteUrl(),
): string {
  const base = siteUrl.replace(/\/+$/, "");
  const entries: SitemapEntry[] = [
    { loc: `${base}/`, changefreq: "daily", priority: 1.0 },
    { loc: `${base}/login`, changefreq: "monthly", priority: 0.5 },
    { loc: `${base}/signup`, changefreq: "monthly", priority: 0.5 },
  ];

  for (const r of restaurants) {
    if (!r.slug) continue;
    entries.push({
      loc: `${base}/r/${escapeXml(r.slug)}`,
      lastmod: r.updated_at ? new Date(r.updated_at).toISOString().split("T")[0] : undefined,
      changefreq: "weekly",
      priority: 0.8,
    });
  }

  const urlTags = entries
    .map((e) => {
      let tag = `  <url>\n    <loc>${e.loc}</loc>`;
      if (e.lastmod) tag += `\n    <lastmod>${e.lastmod}</lastmod>`;
      if (e.changefreq) tag += `\n    <changefreq>${e.changefreq}</changefreq>`;
      if (e.priority !== undefined) tag += `\n    <priority>${e.priority.toFixed(1)}</priority>`;
      tag += "\n  </url>";
      return tag;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlTags}\n</urlset>`;
}
