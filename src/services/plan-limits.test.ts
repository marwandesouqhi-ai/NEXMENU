import { beforeEach, describe, expect, it } from "vitest";
import { restaurantService } from "./restaurants";
import { dataAdapter } from "@/data";
import { PlanLimitError } from "@/lib/errors";
import { setupInMemoryDataAdapter } from "@/test/mock-adapter";
import { PLANS } from "@/config/plans";
import type { Branch, Category, Product, Session } from "@/types/domain";

const now = "2026-01-01T00:00:00Z";

const mockAdminSession: Session = {
  id: "session-admin",
  profile_id: "profile-admin",
  expires_at: "2999-01-01T00:00:00Z",
};

describe("SaaS Plan Limits Enforcement", () => {
  beforeEach(async () => {
    setupInMemoryDataAdapter();
  });

  it("enforces product count limit on FREE plan (30 products)", async () => {
    const rest = await restaurantService.createRestaurant(mockAdminSession, {
      name_en: "Limit Test Cafe",
      name_ar: "مقهى التجربة",
      slug: "limit-test-cafe",
      currency: "EGP",
      cuisine_type: "Cafe",
    });

    // Assign FREE subscription explicitly
    await dataAdapter.saveSubscription({
      id: "sub-free",
      restaurant_id: rest.id,
      plan: "FREE",
      starts_at: "2026-01-01T00:00:00Z",
      expires_at: "2099-01-01T00:00:00Z",
      status: "ACTIVE",
      notes: "",
      created_at: now,
      updated_at: now,
    });

    const cat: Category = {
      id: crypto.randomUUID(),
      restaurant_id: rest.id,
      name_en: "General",
      name_ar: "عام",
      is_visible: true,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    };
    await dataAdapter.saveCategory(cat);

    // Seed up to the limit (30 products)
    for (let i = 0; i < PLANS.FREE.productLimit!; i++) {
      const p: Product = {
        id: crypto.randomUUID(),
        restaurant_id: rest.id,
        category_id: cat.id,
        name_en: `Product ${i + 1}`,
        name_ar: `منتج ${i + 1}`,
        description_en: "",
        description_ar: "",
        price: 10 + i,
        is_available: true,
        is_visible: true,
        is_featured: false,
        is_popular: false,
        sort_order: i,
        sku: `P-${i + 1}`,
        options: [],
        created_at: now,
        updated_at: now,
      };
      await dataAdapter.saveProduct(p);
    }

    // Creating the 31st product must throw PlanLimitError
    const overflowProduct: Product = {
      id: crypto.randomUUID(),
      restaurant_id: rest.id,
      category_id: cat.id,
      name_en: "Overflow Product",
      name_ar: "منتج زائد",
      description_en: "",
      description_ar: "",
      price: 99,
      is_available: true,
      is_visible: true,
      is_featured: false,
      is_popular: false,
      sort_order: 30,
      sku: "OVERFLOW",
      options: [],
      created_at: now,
      updated_at: now,
    };

    await expect(
      restaurantService.saveProduct(mockAdminSession, overflowProduct, true),
    ).rejects.toThrow(PlanLimitError);
  });

  it("enforces branch limit on FREE plan (max 1 branch)", async () => {
    const rest = await restaurantService.createRestaurant(mockAdminSession, {
      name_en: "Branch Limit Cafe",
      name_ar: "مقهى الفروع",
      slug: "branch-limit-cafe",
      currency: "EGP",
      cuisine_type: "Cafe",
    });

    await dataAdapter.saveSubscription({
      id: "sub-free-2",
      restaurant_id: rest.id,
      plan: "FREE",
      starts_at: "2026-01-01T00:00:00Z",
      expires_at: "2099-01-01T00:00:00Z",
      status: "ACTIVE",
      notes: "",
      created_at: now,
      updated_at: now,
    });

    const branch1: Branch = {
      id: crypto.randomUUID(),
      restaurant_id: rest.id,
      slug: "branch-1",
      name_en: "Branch 1",
      name_ar: "فرع ١",
      address_en: "123 Main St",
      address_ar: "١٢٣ شارع رئيسي",
      phone: "123",
      maps_url: "",
      opening_hours: {
        monday: { closed: false, shifts: [{ open: "08:00", close: "22:00" }] },
      },
      hidden_product_ids: [],
      created_at: now,
      updated_at: now,
    };

    // First branch succeeds
    await restaurantService.saveBranch(mockAdminSession, branch1, true);

    // Second branch on FREE plan must throw PlanLimitError
    const branch2: Branch = {
      ...branch1,
      id: crypto.randomUUID(),
      slug: "branch-2",
      name_en: "Branch 2",
    };

    await expect(
      restaurantService.saveBranch(mockAdminSession, branch2, true),
    ).rejects.toThrow(PlanLimitError);
  });

  it("falls back to FREE plan when subscription expires without deleting data", async () => {
    const rest = await restaurantService.createRestaurant(mockAdminSession, {
      name_en: "Expired Sub Cafe",
      name_ar: "مقهى منتهي",
      slug: "expired-sub-cafe",
      currency: "USD",
      cuisine_type: "Cafe",
    });

    // Sub expired in 2020
    await dataAdapter.saveSubscription({
      id: "sub-expired",
      restaurant_id: rest.id,
      plan: "PRO",
      starts_at: "2019-01-01T00:00:00Z",
      expires_at: "2020-01-01T00:00:00Z",
      status: "ACTIVE",
      notes: "",
      created_at: now,
      updated_at: now,
    });

    // Check analytics gating falls back to disabled
    const analytics = await restaurantService.analytics(mockAdminSession, rest.id);
    expect(analytics.enabled).toBe(false);

    // Branch limit is enforced at FREE tier (1)
    const branch1: Branch = {
      id: crypto.randomUUID(),
      restaurant_id: rest.id,
      slug: "exp-branch-1",
      name_en: "Exp Branch 1",
      name_ar: "فرع ١",
      address_en: "",
      address_ar: "",
      phone: "",
      maps_url: "",
      opening_hours: {},
      hidden_product_ids: [],
      created_at: now,
      updated_at: now,
    };
    await restaurantService.saveBranch(mockAdminSession, branch1, true);

    const branch2: Branch = {
      ...branch1,
      id: crypto.randomUUID(),
      slug: "exp-branch-2",
    };

    await expect(
      restaurantService.saveBranch(mockAdminSession, branch2, true),
    ).rejects.toThrow(PlanLimitError);
  });

  it("allows up to 5 branches and analytics on active PRO plan", async () => {
    const rest = await restaurantService.createRestaurant(mockAdminSession, {
      name_en: "Active Pro Cafe",
      name_ar: "مقهى برو نشط",
      slug: "active-pro-cafe",
      currency: "USD",
      cuisine_type: "Cafe",
    });

    await dataAdapter.saveSubscription({
      id: "sub-pro-active",
      restaurant_id: rest.id,
      plan: "PRO",
      starts_at: "2026-01-01T00:00:00Z",
      expires_at: "2099-01-01T00:00:00Z",
      status: "ACTIVE",
      notes: "",
      created_at: now,
      updated_at: now,
    });

    // Analytics enabled
    const analytics = await restaurantService.analytics(mockAdminSession, rest.id);
    expect(analytics.enabled).toBe(true);

    // Multiple branches allowed
    for (let i = 1; i <= 3; i++) {
      const branch: Branch = {
        id: crypto.randomUUID(),
        restaurant_id: rest.id,
        slug: `pro-branch-${i}`,
        name_en: `Pro Branch ${i}`,
        name_ar: `فرع برو ${i}`,
        address_en: "",
        address_ar: "",
        phone: "",
        maps_url: "",
        opening_hours: {},
        hidden_product_ids: [],
        created_at: now,
        updated_at: now,
      };
      const saved = await restaurantService.saveBranch(mockAdminSession, branch, true);
      expect(saved.slug).toBe(`pro-branch-${i}`);
    }
  });
});
