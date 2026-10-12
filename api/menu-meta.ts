import { escapeHtml } from "../src/utils/seo";

export const config = {
  runtime: "edge",
};

const BOT_USER_AGENTS =
  /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest\/0\.|pinterestbot|slackbot|vkshare|w3c_validator|whatsapp|telegrambot/i;

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || url.pathname.split("/").filter(Boolean).pop() || "";
  const userAgent = req.headers.get("user-agent") || "";
  const isBot = BOT_USER_AGENTS.test(userAgent);

  const siteUrl = process.env.VITE_SITE_URL || `${url.protocol}//${url.host}`;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  let restaurantName = slug;
  let restaurantDesc = "Browse digital menu on NEXMENU";
  let restaurantImage = `${siteUrl}/favicon.svg`;

  if (supabaseUrl && anonKey && slug) {
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/restaurants?select=name_en,name_ar,description_en,description_ar,cover_url,logo_url&slug=eq.${encodeURIComponent(slug)}&menu_status=eq.PUBLISHED&limit=1`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        },
      );
      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows[0]) {
          const r = rows[0];
          restaurantName = r.name_en || r.name_ar || slug;
          restaurantDesc = r.description_en || r.description_ar || restaurantDesc;
          restaurantImage = r.cover_url || r.logo_url || restaurantImage;
        }
      }
    } catch {
      // Fallback cleanly on error
    }
  }

  const safeTitle = escapeHtml(`${restaurantName} | Digital Menu - NEXMENU`);
  const safeDesc = escapeHtml(restaurantDesc);
  const safeUrl = escapeHtml(`${siteUrl}/r/${slug}`);
  const safeImage = escapeHtml(restaurantImage);

  let html = "";
  try {
    const originResponse = await fetch(new URL("/index.html", req.url).toString());
    if (originResponse.ok) {
      html = await originResponse.text();
    }
  } catch {
    // Fallback if local fetch fails
  }

  const metaTags = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:type" content="restaurant.menu" />
    <meta property="og:image" content="${safeImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImage}" />
  `;

  if (html && html.includes("</head>")) {
    html = html.replace("</head>", `${metaTags}</head>`);
  } else {
    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${metaTags}
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": isBot
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "public, max-age=0, must-revalidate",
    },
  });
}
