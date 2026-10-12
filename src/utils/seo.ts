import type { PublicMenu, RestaurantSettings, DayHours } from "@/types/domain";

export interface SeoOptions {
  title: string;
  description?: string;
  canonicalUrl?: string;
  ogType?: "website" | "restaurant.menu" | "article";
  image?: string;
  twitterCard?: "summary" | "summary_large_image";
  jsonLd?: Record<string, unknown>;
}

export interface MetaTagEntry {
  property?: string;
  name?: string;
  content: string;
}

/**
 * Strips undefined, null, or empty string values recursively so JSON-LD output
 * never contains invalid schema properties.
 */
export function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => pruneUndefined(item))
      .filter((item) => item !== undefined && item !== null) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined && val !== null && val !== "") {
        cleaned[key] = pruneUndefined(val);
      }
    }
    return cleaned as T;
  }
  return value;
}

const DAY_MAP: Record<string, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

/**
 * Builds schema.org openingHoursSpecification from NEXMENU settings.
 */
export function buildOpeningHoursSpecification(openingHours?: RestaurantSettings["opening_hours"]) {
  if (!openingHours) return [];
  const specs: Array<{
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string;
    opens: string;
    closes: string;
  }> = [];

  for (const [day, config] of Object.entries(openingHours)) {
    const dayUrl = DAY_MAP[day.toLowerCase()];
    const dayConfig = config as DayHours;
    if (!dayUrl || dayConfig.closed || !dayConfig.shifts) continue;

    for (const shift of dayConfig.shifts) {
      if (shift.open && shift.close) {
        specs.push({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: dayUrl,
          opens: shift.open,
          closes: shift.close,
        });
      }
    }
  }

  return specs;
}

/**
 * Builds schema.org Restaurant and Menu JSON-LD payload.
 */
export function buildRestaurantJsonLd(
  menu: PublicMenu,
  origin: string,
  locale: "en" | "ar" = "en",
): Record<string, unknown> {
  const isAr = locale === "ar";
  const restaurant = menu.restaurant;
  const name = (isAr ? restaurant.name_ar : restaurant.name_en) || restaurant.name_en;
  const description =
    (isAr ? restaurant.description_ar : restaurant.description_en) || restaurant.description_en;
  const address = (isAr ? restaurant.address_ar : restaurant.address_en) || restaurant.address_en;
  const url = `${origin}/r/${restaurant.slug}`;
  const image = restaurant.cover_url || restaurant.logo_url || `${origin}/favicon.svg`;

  const openingSpecs = buildOpeningHoursSpecification(menu.settings.opening_hours);

  // Group products into menu sections
  const menuSections = menu.categories.map((cat) => {
    const catName = isAr ? cat.name_ar : cat.name_en;
    const catProducts = menu.products
      .filter((p) => p.category_id === cat.id)
      .map((p) => {
        const prodName = isAr ? p.name_ar : p.name_en;
        const prodDesc = isAr ? p.description_ar : p.description_en;
        return {
          "@type": "MenuItem",
          name: prodName,
          description: prodDesc || undefined,
          image: p.image_url || undefined,
          offers: {
            "@type": "Offer",
            price: p.price,
            priceCurrency: restaurant.currency || "EGP",
            availability: p.is_available
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
        };
      });

    return {
      "@type": "MenuSection",
      name: catName,
      hasMenuItem: catProducts,
    };
  });

  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name,
    description: description || undefined,
    image: image || undefined,
    url,
    telephone: restaurant.phone || undefined,
    servesCuisine: restaurant.cuisine_type || undefined,
    address: address
      ? {
          "@type": "PostalAddress",
          streetAddress: address,
        }
      : undefined,
    openingHoursSpecification: openingSpecs.length ? openingSpecs : undefined,
    hasMenu: {
      "@type": "Menu",
      name: `${name} Menu`,
      hasMenuSection: menuSections,
    },
  };

  return pruneUndefined(payload);
}

/**
 * Generates OpenGraph and Twitter meta tag list.
 */
export function buildMetaTags(options: SeoOptions): MetaTagEntry[] {
  const tags: MetaTagEntry[] = [];
  const { title, description, canonicalUrl, ogType = "website", image, twitterCard = "summary_large_image" } = options;

  if (description) {
    tags.push({ name: "description", content: description });
  }

  // Open Graph
  tags.push({ property: "og:title", content: title });
  if (description) tags.push({ property: "og:description", content: description });
  tags.push({ property: "og:type", content: ogType });
  if (canonicalUrl) tags.push({ property: "og:url", content: canonicalUrl });
  if (image) tags.push({ property: "og:image", content: image });
  tags.push({ property: "og:site_name", content: "NEXMENU" });

  // Twitter Cards
  tags.push({ name: "twitter:card", content: twitterCard });
  tags.push({ name: "twitter:title", content: title });
  if (description) tags.push({ name: "twitter:description", content: description });
  if (image) tags.push({ name: "twitter:image", content: image });

  return tags;
}
