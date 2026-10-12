import { beforeEach, describe, expect, it } from "vitest";
import { restaurantService } from "./restaurants";
import { dataAdapter } from "@/data";
import { ValidationError } from "@/lib/errors";
import { setupInMemoryDataAdapter } from "@/test/mock-adapter";
import type { Category, Membership, Product, Session } from "@/types/domain";

const now = "2026-01-01T00:00:00Z";

const mockAdminSession: Session = {
  id: "session-admin",
  profile_id: "profile-admin",
  expires_at: "2999-01-01T00:00:00Z",
};

describe("Restaurant Domain CRUD Operations", () => {
  beforeEach(async () => {
    setupInMemoryDataAdapter();
  });

  describe("Restaurant Lifecycle", () => {
    it("creates a new restaurant and auto-assigns the owner", async () => {
      const rest = await restaurantService.createRestaurant(mockAdminSession, {
        name_en: "Solar Roasters",
        name_ar: "محمصات الشمس",
        slug: "solar-roasters",
        currency: "EGP",
        cuisine_type: "Cafe",
      });

      expect(rest.id).toBeDefined();
      expect(rest.slug).toBe("solar-roasters");
      expect(rest.status).toBe("ACTIVE");
      expect(rest.menu_status).toBe("DRAFT");

      // Verify owner membership was created
      const members = (await dataAdapter.listMemberships()).filter(
        (m: Membership) => m.restaurant_id === rest.id,
      );
      expect(members.length).toBe(1);
      expect(members[0].role).toBe("RESTAURANT_OWNER");
    });

    it("rejects invalid slugs (uppercase, spaces, reserved words)", async () => {
      await expect(
        restaurantService.createRestaurant(mockAdminSession, {
          name_en: "Bad Slug",
          name_ar: "سيء",
          slug: "admin", // reserved
          currency: "USD",
          cuisine_type: "Cafe",
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        restaurantService.createRestaurant(mockAdminSession, {
          name_en: "Bad Slug 2",
          name_ar: "سيء",
          slug: "Invalid Slug",
          currency: "USD",
          cuisine_type: "Cafe",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects duplicate restaurant slugs", async () => {
      await restaurantService.createRestaurant(mockAdminSession, {
        name_en: "Unique One",
        name_ar: "فريد",
        slug: "unique-slug",
        currency: "USD",
        cuisine_type: "Cafe",
      });

      await expect(
        restaurantService.createRestaurant(mockAdminSession, {
          name_en: "Duplicate Slug",
          name_ar: "مكرر",
          slug: "unique-slug",
          currency: "USD",
          cuisine_type: "Cafe",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("updates restaurant settings and public details", async () => {
      const rest = await restaurantService.createRestaurant(mockAdminSession, {
        name_en: "Alpha Cafe",
        name_ar: "ألفا كافيه",
        slug: "alpha-cafe",
        currency: "USD",
        cuisine_type: "Cafe",
      });

      const updatedRest = await restaurantService.saveRestaurant(mockAdminSession, {
        ...rest,
        phone: "+201000000000",
        whatsapp: "+201000000000",
        address_en: "42 Nile Corniche, Maadi",
        menu_status: "PUBLISHED",
      });

      expect(updatedRest.phone).toBe("+201000000000");
      expect(updatedRest.menu_status).toBe("PUBLISHED");
    });
  });

  describe("Category CRUD", () => {
    it("creates, updates, and soft-deletes a category", async () => {
      const rest = await restaurantService.createRestaurant(mockAdminSession, {
        name_en: "Category Test Rest",
        name_ar: "مطعم تجربة",
        slug: "cat-test-rest",
        currency: "USD",
        cuisine_type: "Cafe",
      });

      const cat: Category = {
        id: crypto.randomUUID(),
        restaurant_id: rest.id,
        name_en: "Iced Drinks",
        name_ar: "مشروبات باردة",
        is_visible: true,
        sort_order: 0,
        created_at: now,
        updated_at: now,
      };

      const saved = await restaurantService.saveCategory(mockAdminSession, cat, true);
      expect(saved.id).toBe(cat.id);
      expect(saved.name_en).toBe("Iced Drinks");

      // Update
      const updatedCat = await restaurantService.saveCategory(mockAdminSession, {
        ...saved,
        name_en: "Cold Brew & Iced Drinks",
      });
      expect(updatedCat.name_en).toBe("Cold Brew & Iced Drinks");

      // Soft delete
      const deleted = await restaurantService.deleteCategory(mockAdminSession, updatedCat);
      expect(deleted.deleted_at).toBeDefined();

      // Ensure filtered out in public menu
      const publicMenu = await dataAdapter.getPublicMenu(rest.slug);
      expect(publicMenu?.categories.find((c: Category) => c.id === cat.id)).toBeUndefined();
    });
  });

  describe("Product CRUD & Validation", () => {
    it("creates, updates, duplicates, and soft-deletes a product", async () => {
      const rest = await restaurantService.createRestaurant(mockAdminSession, {
        name_en: "Product Test Rest",
        name_ar: "مطعم تجربة",
        slug: "prod-test-rest",
        currency: "EGP",
        cuisine_type: "Cafe",
      });

      const cat = await restaurantService.saveCategory(
        mockAdminSession,
        {
          id: crypto.randomUUID(),
          restaurant_id: rest.id,
          name_en: "Espresso",
          name_ar: "إسبريسو",
          is_visible: true,
          sort_order: 0,
          created_at: now,
          updated_at: now,
        },
        true,
      );

      const prod: Product = {
        id: crypto.randomUUID(),
        restaurant_id: rest.id,
        category_id: cat.id,
        name_en: "Cortado",
        name_ar: "كورتادو",
        description_en: "Equal parts espresso and steamed milk",
        description_ar: "إسبريسو مع حليب مبخر",
        price: 55,
        compare_at_price: 65,
        is_available: true,
        is_visible: true,
        is_featured: true,
        is_popular: false,
        sort_order: 0,
        sku: "CORT-01",
        options: [
          {
            id: "opt-1",
            product_id: "prod-cortado",
            name_en: "Milk Choice",
            name_ar: "نوع الحليب",
            values: [
              {
                id: "v-1",
                option_id: "opt-1",
                name_en: "Oat Milk",
                name_ar: "حليب الشوفان",
                price_delta: 15,
                created_at: now,
                updated_at: now,
              },
              {
                id: "v-2",
                option_id: "opt-1",
                name_en: "Almond Milk",
                name_ar: "حليب اللوز",
                price_delta: 15,
                created_at: now,
                updated_at: now,
              },
            ],
            created_at: now,
            updated_at: now,
          },
        ],
        created_at: now,
        updated_at: now,
      };

      const saved = await restaurantService.saveProduct(mockAdminSession, prod, true);
      expect(saved.id).toBe(prod.id);
      expect(saved.price).toBe(55);
      expect(saved.options[0].values.length).toBe(2);

      // Duplication
      const duplicate = await restaurantService.duplicateProduct(mockAdminSession, saved);
      expect(duplicate.id).not.toBe(saved.id);
      expect(duplicate.name_en).toContain("copy");

      // Soft delete
      const deleted = await restaurantService.deleteProduct(mockAdminSession, saved);
      expect(deleted.deleted_at).toBeDefined();

      const activeProducts = (await dataAdapter.listProducts(rest.id)).filter(
        (p: Product) => !p.deleted_at,
      );
      expect(activeProducts.some((p: Product) => p.id === prod.id)).toBe(false);
    });

    it("rejects negative prices and invalid compare-at prices", async () => {
      const rest = await restaurantService.createRestaurant(mockAdminSession, {
        name_en: "Price Validation Rest",
        name_ar: "مطعم تجربة",
        slug: "price-val-rest",
        currency: "USD",
        cuisine_type: "Cafe",
      });

      const cat = await restaurantService.saveCategory(
        mockAdminSession,
        {
          id: crypto.randomUUID(),
          restaurant_id: rest.id,
          name_en: "Drinks",
          name_ar: "مشروبات",
          is_visible: true,
          sort_order: 0,
          created_at: now,
          updated_at: now,
        },
        true,
      );

      // Negative price
      await expect(
        restaurantService.saveProduct(
          mockAdminSession,
          {
            id: crypto.randomUUID(),
            restaurant_id: rest.id,
            category_id: cat.id,
            name_en: "Invalid Price",
            name_ar: "سعر غير صالح",
            description_en: "",
            description_ar: "",
            price: -10,
            is_available: true,
            is_visible: true,
            is_featured: false,
            is_popular: false,
            sort_order: 0,
            sku: "SKU-BAD",
            options: [],
            created_at: now,
            updated_at: now,
          },
          true,
        ),
      ).rejects.toThrow(ValidationError);

      // Compare-at price lower than regular price
      await expect(
        restaurantService.saveProduct(
          mockAdminSession,
          {
            id: crypto.randomUUID(),
            restaurant_id: rest.id,
            category_id: cat.id,
            name_en: "Invalid Discount",
            name_ar: "خصم غير صالح",
            description_en: "",
            description_ar: "",
            price: 50,
            compare_at_price: 40, // invalid: compare_at must be higher
            is_available: true,
            is_visible: true,
            is_featured: false,
            is_popular: false,
            sort_order: 0,
            sku: "SKU-BAD-COMPARE",
            options: [],
            created_at: now,
            updated_at: now,
          },
          true,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });
});
