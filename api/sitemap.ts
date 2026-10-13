import { generateSitemapXml } from "../src/utils/sitemap";

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const siteUrl = (process.env.VITE_SITE_URL || `${url.protocol}//${url.host}`).replace(/\/+$/, "");
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let restaurants: Array<{ slug: string; updated_at?: string }> = [
    { slug: "cafe-moon", updated_at: "2026-01-01T00:00:00Z" },
  ];

  if (supabaseUrl && anonKey) {
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/restaurants?select=slug,updated_at&menu_status=eq.PUBLISHED&status=eq.ACTIVE`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          restaurants = data;
        }
      }
    } catch {
      // Fallback cleanly on transient network or config issues
    }
  }

  const xml = generateSitemapXml(restaurants, siteUrl);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
