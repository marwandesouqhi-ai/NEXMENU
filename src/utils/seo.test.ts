import { describe, expect, it } from "vitest";
import {
  buildMetaTags,
  buildOpeningHoursSpecification,
  buildRestaurantJsonLd,
  pruneUndefined,
} from "./seo";
import type { PublicMenu, RestaurantSettings } from "@/types/domain";

describe("SEO Utilities", () => {
  describe("pruneUndefined", () => {
    it("removes undefined, null, and empty string properties recursively", () => {
      const input = {
        name: "Test",
        emptyStr: "",
        nullVal: null,
        undefVal: undefined,
        nested: {
          valid: 123,
          bad: undefined,
          arr: ["a", undefined, null, "b"],
        },
      };

      const cleaned = pruneUndefined(input) as Record<string, unknown>;
      expect(cleaned).toEqual({
        name: "Test",
        nested: {
          valid: 123,
          arr: ["a", "b"],
        },
      });
    });
  });

  describe("buildMetaTags", () => {
    it("generates OpenGraph and Twitter card entries", () => {
      const tags = buildMetaTags({
        title: "Moon Cafe | Digital Menu",
        description: "Artisanal coffee and pastries",
        canonicalUrl: "https://nexmenu.local/r/moon-cafe",
        image: "https://nexmenu.local/assets/cafe.webp",
        ogType: "restaurant.menu",
      });

      const findProp = (prop: string) => tags.find((t) => t.property === prop)?.content;
      const findName = (name: string) => tags.find((t) => t.name === name)?.content;

      expect(findProp("og:title")).toBe("Moon Cafe | Digital Menu");
      expect(findProp("og:description")).toBe("Artisanal coffee and pastries");
      expect(findProp("og:url")).toBe("https://nexmenu.local/r/moon-cafe");
      expect(findProp("og:type")).toBe("restaurant.menu");
      expect(findProp("og:image")).toBe("https://nexmenu.local/assets/cafe.webp");

      expect(findName("twitter:card")).toBe("summary_large_image");
      expect(findName("twitter:title")).toBe("Moon Cafe | Digital Menu");
      expect(findName("description")).toBe("Artisanal coffee and pastries");
    });
  });

  describe("buildOpeningHoursSpecification", () => {
    it("converts opening_hours record to schema.org OpeningHoursSpecification array", () => {
      const hours = {
        monday: { closed: false, shifts: [{ open: "08:00", close: "22:00" }] },
        tuesday: { closed: true, shifts: [{ open: "08:00", close: "22:00" }] },
        friday: {
          closed: false,
          shifts: [
            { open: "09:00", close: "14:00" },
            { open: "16:00", close: "23:00" },
          ],
        },
      };

      const specs = buildOpeningHoursSpecification(
        hours as unknown as RestaurantSettings["opening_hours"],
      );
      expect(specs.length).toBe(3); // 1 for Monday, 0 for Tuesday (closed), 2 for Friday
      expect(specs[0]).toEqual({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "https://schema.org/Monday",
        opens: "08:00",
        closes: "22:00",
      });
      expect(specs[1].dayOfWeek).toBe("https://schema.org/Friday");
      expect(specs[2].dayOfWeek).toBe("https://schema.org/Friday");
    });
  });

  describe("buildRestaurantJsonLd", () => {
    const mockMenu: PublicMenu = {
      restaurant: {
        id: "r1",
        slug: "moon-cafe",
        name_en: "Moon Cafe",
        name_ar: "مقهى القمر",
        description_en: "Cozy specialty coffee shop",
        description_ar: "مقهى قهوة مختصة",
        phone: "+201000000000",
        whatsapp: "",
        address_en: "123 Nile St, Cairo",
        address_ar: "١٢٣ شارع النيل، القاهرة",
        maps_url: "",
        website: "",
        instagram: "",
        facebook: "",
        cuisine_type: "Cafe",
        currency: "EGP",
        timezone: "Africa/Cairo",
        menu_status: "PUBLISHED",
        status: "ACTIVE",
        logo_url: "https://nexmenu.local/logo.png",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      settings: {
        id: "s1",
        restaurant_id: "r1",
        default_locale: "en",
        opening_hours: {
          monday: { closed: false, shifts: [{ open: "09:00", close: "23:00" }] },
        },
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      branding: {
        id: "b1",
        restaurant_id: "r1",
        primary_color: "#176b4d",
        secondary_color: "#d7aa5c",
        background_color: "#f7f4ed",
        text_color: "#17221d",
        template: "Modern",
        radius: "rounded",
        theme: "light",
        font: "Inter",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      branches: [],
      categories: [
        {
          id: "cat-1",
          restaurant_id: "r1",
          name_en: "Hot Drinks",
          name_ar: "مشروبات ساخنة",
          is_visible: true,
          sort_order: 0,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      products: [
        {
          id: "prod-1",
          restaurant_id: "r1",
          category_id: "cat-1",
          name_en: "Flat White",
          name_ar: "فلات وايت",
          description_en: "Double shot espresso with silky microfoam",
          description_ar: "إسبريسو مزدوج مع حليب مبخر",
          price: 65,
          image_url: "https://nexmenu.local/flat-white.webp",
          is_available: true,
          is_visible: true,
          is_featured: true,
          is_popular: true,
          sort_order: 0,
          sku: "FW-01",
          options: [],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      offers: [],
      show_nexmenu_branding: true,
    };

    it("generates valid schema.org Restaurant with Menu hierarchy without undefined values", () => {
      const jsonLd = buildRestaurantJsonLd(mockMenu, "https://nexmenu.local", "en");

      // Assert valid JSON serialization without throwing
      const serialized = JSON.stringify(jsonLd);
      expect(serialized).not.toContain("undefined");
      expect(serialized).not.toContain("null");

      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("Restaurant");
      expect(jsonLd["name"]).toBe("Moon Cafe");
      expect(jsonLd["telephone"]).toBe("+201000000000");

      const address = jsonLd["address"] as Record<string, string>;
      expect(address["@type"]).toBe("PostalAddress");
      expect(address["streetAddress"]).toBe("123 Nile St, Cairo");

      const menu = jsonLd["hasMenu"] as Record<string, unknown>;
      expect(menu["@type"]).toBe("Menu");
      const sections = menu["hasMenuSection"] as Array<Record<string, unknown>>;
      expect(sections.length).toBe(1);

      const section = sections[0];
      expect(section["name"]).toBe("Hot Drinks");
      const items = section["hasMenuItem"] as Array<Record<string, unknown>>;
      expect(items.length).toBe(1);

      const item = items[0];
      expect(item["name"]).toBe("Flat White");
      const offers = item["offers"] as Record<string, unknown>;
      expect(offers["price"]).toBe(65);
      expect(offers["priceCurrency"]).toBe("EGP");
    });

    it("supports Arabic localization in JSON-LD", () => {
      const jsonLd = buildRestaurantJsonLd(mockMenu, "https://nexmenu.local", "ar");
      expect(jsonLd["name"]).toBe("مقهى القمر");
      expect(jsonLd["description"]).toBe("مقهى قهوة مختصة");
      const address = jsonLd["address"] as Record<string, string>;
      expect(address["streetAddress"]).toBe("١٢٣ شارع النيل، القاهرة");

      const menu = jsonLd["hasMenu"] as Record<string, unknown>;
      const sections = menu["hasMenuSection"] as Array<Record<string, unknown>>;
      const items = sections[0]["hasMenuItem"] as Array<Record<string, unknown>>;
      expect(items[0]["name"]).toBe("فلات وايت");
    });
  });
});
