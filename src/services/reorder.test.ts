import { beforeEach, describe, expect, it, vi } from "vitest";
import { restaurantService } from "./restaurants";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import type { Category, Product, Profile, Restaurant, Session } from "@/types/domain";
import { dataAdapter } from "@/data";

const now = "2026-01-01T00:00:00Z";

const ownerProfileA: Profile = {
  id: "owner-a",
  email: "ownerA@resto.local",
  name: "Owner A",
  platform_role: undefined,
  password_hash: "",
  password_salt: "",
  email_verified: true,
  created_at: now,
  updated_at: now,
};

const ownerProfileB: Profile = {
  id: "owner-b",
  email: "ownerB@resto.local",
  name: "Owner B",
  platform_role: undefined,
  password_hash: "",
  password_salt: "",
  email_verified: true,
  created_at: now,
  updated_at: now,
};

const sessionOwnerA: Session = {
  id: "sess-owner-a",
  profile_id: ownerProfileA.id,
  expires_at: "2999-01-01T00:00:00Z",
};

const sessionOwnerB: Session = {
  id: "sess-owner-b",
  profile_id: ownerProfileB.id,
  expires_at: "2999-01-01T00:00:00Z",
};

const restaurantA: Restaurant = {
  id: "resto-a",
  slug: "resto-a",
  name_en: "Resto A",
  name_ar: "مطعم أ",
  description_en: "",
  description_ar: "",
  phone: "",
  whatsapp: "",
  address_en: "",
  address_ar: "",
  maps_url: "",
  website: "",
  instagram: "",
  facebook: "",
  cuisine_type: "Burger",
  currency: "EGP",
  timezone: "Africa/Cairo",
  menu_status: "PUBLISHED",
  status: "ACTIVE",
  created_at: now,
  updated_at: now,
};

const restaurantB: Restaurant = {
  id: "resto-b",
  slug: "resto-b",
  name_en: "Resto B",
  name_ar: "مطعم ب",
  description_en: "",
  description_ar: "",
  phone: "",
  whatsapp: "",
  address_en: "",
  address_ar: "",
  maps_url: "",
  website: "",
  instagram: "",
  facebook: "",
  cuisine_type: "Pizza",
  currency: "EGP",
  timezone: "Africa/Cairo",
  menu_status: "PUBLISHED",
  status: "ACTIVE",
  created_at: now,
  updated_at: now,
};

let categoriesStore: Category[] = [];
let productsStore: Product[] = [];

beforeEach(() => {
  categoriesStore = [
    {
      id: "cat-1",
      restaurant_id: "resto-a",
      name_en: "Drinks",
      name_ar: "مشروبات",
      is_visible: true,
      sort_order: 10,
      created_at: now,
      updated_at: now,
    },
    {
      id: "cat-2",
      restaurant_id: "resto-a",
      name_en: "Burgers",
      name_ar: "برجر",
      is_visible: true,
      sort_order: 25,
      created_at: now,
      updated_at: now,
    },
    {
      id: "cat-3",
      restaurant_id: "resto-a",
      name_en: "Desserts",
      name_ar: "حلويات",
      is_visible: true,
      sort_order: 30,
      created_at: now,
      updated_at: now,
    },
    {
      id: "cat-foreign",
      restaurant_id: "resto-b",
      name_en: "Pizzas",
      name_ar: "بيتزا",
      is_visible: true,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    },
  ];

  productsStore = [
    {
      id: "prod-1",
      restaurant_id: "resto-a",
      category_id: "cat-2",
      name_en: "Classic Burger",
      name_ar: "برجر كلاسيك",
      description_en: "",
      description_ar: "",
      price: 120,
      image_url: "",
      is_available: true,
      is_visible: true,
      is_featured: false,
      is_popular: false,
      sort_order: 5,
      sku: "SKU-1",
      options: [],
      created_at: now,
      updated_at: now,
    },
    {
      id: "prod-2",
      restaurant_id: "resto-a",
      category_id: "cat-2",
      name_en: "Cheese Burger",
      name_ar: "برجر بالجبنة",
      description_en: "",
      description_ar: "",
      price: 140,
      image_url: "",
      is_available: true,
      is_visible: true,
      is_featured: false,
      is_popular: false,
      sort_order: 15,
      sku: "SKU-2",
      options: [],
      created_at: now,
      updated_at: now,
    },
    {
      id: "prod-3",
      restaurant_id: "resto-a",
      category_id: "cat-2",
      name_en: "Double Bacon Burger",
      name_ar: "برجر لحم مقدد",
      description_en: "",
      description_ar: "",
      price: 180,
      image_url: "",
      is_available: true,
      is_visible: true,
      is_featured: false,
      is_popular: false,
      sort_order: 20,
      sku: "SKU-3",
      options: [],
      created_at: now,
      updated_at: now,
    },
  ];

  vi.spyOn(dataAdapter, "getProfile").mockImplementation(async (id) => {
    if (id === ownerProfileA.id) return ownerProfileA;
    if (id === ownerProfileB.id) return ownerProfileB;
    return undefined;
  });

  vi.spyOn(dataAdapter, "listMemberships").mockResolvedValue([
    {
      id: "mem-a",
      restaurant_id: "resto-a",
      profile_id: ownerProfileA.id,
      email: ownerProfileA.email,
      role: "RESTAURANT_OWNER",
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    },
    {
      id: "mem-b",
      restaurant_id: "resto-b",
      profile_id: ownerProfileB.id,
      email: ownerProfileB.email,
      role: "RESTAURANT_OWNER",
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    },
  ]);

  vi.spyOn(dataAdapter, "listRestaurants").mockResolvedValue([restaurantA, restaurantB]);

  vi.spyOn(dataAdapter, "reorderCategories").mockImplementation(
    async (restaurantId, orderedIds) => {
      const cats = categoriesStore.filter((c) => c.restaurant_id === restaurantId);
      const catMap = new Map(cats.map((c) => [c.id, c]));

      for (const id of orderedIds) {
        if (!catMap.has(id)) throw new ValidationError("Category not found");
      }

      orderedIds.forEach((id, idx) => {
        const cat = catMap.get(id)!;
        cat.sort_order = idx;
      });

      return cats.sort((a, b) => a.sort_order - b.sort_order);
    },
  );

  vi.spyOn(dataAdapter, "reorderProducts").mockImplementation(
    async (restaurantId, categoryId, orderedIds) => {
      const prods = productsStore.filter(
        (p) => p.restaurant_id === restaurantId && p.category_id === categoryId,
      );
      const prodMap = new Map(prods.map((p) => [p.id, p]));

      for (const id of orderedIds) {
        if (!prodMap.has(id)) throw new ValidationError("Product not found");
      }

      orderedIds.forEach((id, idx) => {
        const prod = prodMap.get(id)!;
        prod.sort_order = idx;
      });

      return prods.sort((a, b) => a.sort_order - b.sort_order);
    },
  );

  vi.spyOn(dataAdapter, "saveAuditLog").mockImplementation(async (log) => log);
});

describe("Phase 2: Category and Product Reordering", () => {
  describe("Category Reordering", () => {
    it("persists new category order and normalizes sort_order to contiguous integers", async () => {
      // Reorder: Desserts (cat-3) -> Drinks (cat-1) -> Burgers (cat-2)
      const reordered = await restaurantService.reorderCategories(
        sessionOwnerA,
        "resto-a",
        ["cat-3", "cat-1", "cat-2"],
      );

      expect(reordered.map((c) => c.id)).toEqual(["cat-3", "cat-1", "cat-2"]);
      expect(reordered.map((c) => c.sort_order)).toEqual([0, 1, 2]);
    });

    it("denies cross-tenant category reordering", async () => {
      // Owner A attempting to reorder Restaurant B
      await expect(
        restaurantService.reorderCategories(sessionOwnerA, "resto-b", ["cat-foreign"]),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("rejects reordering foreign category IDs inside own restaurant", async () => {
      await expect(
        restaurantService.reorderCategories(sessionOwnerA, "resto-a", [
          "cat-1",
          "cat-foreign", // Belongs to resto-b
        ]),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("Product Reordering within a Category", () => {
    it("persists new product order and normalizes sort_order", async () => {
      // Reorder: prod-3 -> prod-1 -> prod-2
      const reordered = await restaurantService.reorderProducts(
        sessionOwnerA,
        "resto-a",
        "cat-2",
        ["prod-3", "prod-1", "prod-2"],
      );

      expect(reordered.map((p) => p.id)).toEqual(["prod-3", "prod-1", "prod-2"]);
      expect(reordered.map((p) => p.sort_order)).toEqual([0, 1, 2]);
    });

    it("denies cross-tenant product reordering", async () => {
      // Owner B attempting to reorder Restaurant A's products
      await expect(
        restaurantService.reorderProducts(sessionOwnerB, "resto-a", "cat-2", [
          "prod-1",
          "prod-2",
        ]),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("rejects invalid product IDs during reorder", async () => {
      await expect(
        restaurantService.reorderProducts(sessionOwnerA, "resto-a", "cat-2", [
          "prod-1",
          "non-existent-id",
        ]),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
