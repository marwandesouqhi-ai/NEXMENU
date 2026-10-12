import { describe, expect, it } from "vitest";
import { generateSitemapXml } from "./sitemap";

describe("Sitemap Generator", () => {
  it("generates a valid XML sitemap including static roots and restaurant routes", () => {
    const restaurants = [
      { slug: "cafe-moon", updated_at: "2026-06-15T12:00:00Z" },
      { slug: "nile-bistro", updated_at: "2026-07-01T08:30:00Z" },
    ];

    const xml = generateSitemapXml(restaurants, "https://nexmenu.app");

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://nexmenu.app/</loc>");
    expect(xml).toContain("<loc>https://nexmenu.app/login</loc>");
    expect(xml).toContain("<loc>https://nexmenu.app/signup</loc>");
    expect(xml).toContain("<loc>https://nexmenu.app/r/cafe-moon</loc>");
    expect(xml).toContain("<lastmod>2026-06-15</lastmod>");
    expect(xml).toContain("<loc>https://nexmenu.app/r/nile-bistro</loc>");
    expect(xml).toContain("<lastmod>2026-07-01</lastmod>");
    expect(xml).toContain("</urlset>");
  });

  it("strictly escapes XML characters in slugs to prevent XML injection", () => {
    const malicious = [
      { slug: 'evil<script>tag&"quote"\'apos\'' },
    ];

    const xml = generateSitemapXml(malicious, "https://nexmenu.app");

    expect(xml).not.toContain("<script>");
    expect(xml).toContain("evil&lt;script&gt;tag&amp;&quot;quote&quot;&apos;apos&apos;");
  });

  it("handles trailing slashes on siteUrl gracefully", () => {
    const xml = generateSitemapXml([{ slug: "my-cafe" }], "https://nexmenu.app///");
    expect(xml).toContain("<loc>https://nexmenu.app/r/my-cafe</loc>");
    expect(xml).not.toContain("https://nexmenu.app////");
  });
});
