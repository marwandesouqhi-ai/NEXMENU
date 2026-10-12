import { describe, expect, it } from "vitest";
import { authorize, can } from "./authorization";
import { ForbiddenError } from "@/lib/errors";
import type { DataAdapter } from "@/data/adapters/types";
import type { Membership, Profile, Restaurant, Session } from "@/types/domain";

const now = "2025-01-01T00:00:00Z";
const profile: Profile = { id: "user-a", email: "a@test.local", name: "A", password_hash: "", password_salt: "", email_verified: true, created_at: now, updated_at: now };
const session: Session = { id: "s", profile_id: profile.id, expires_at: "2999-01-01T00:00:00Z" };
const restaurant = (id: string): Restaurant => ({ id, slug: id, name_en: id, name_ar: id, description_en: "", description_ar: "", phone: "", whatsapp: "", address_en: "", address_ar: "", maps_url: "", website: "", instagram: "", facebook: "", cuisine_type: "", currency: "EGP", timezone: "Africa/Cairo", menu_status: "PUBLISHED", status: "ACTIVE", created_at: now, updated_at: now });
const membership: Membership = { id: "m", restaurant_id: "restaurant-a", profile_id: profile.id, email: profile.email, role: "RESTAURANT_OWNER", status: "ACTIVE", created_at: now, updated_at: now };
const adapter = {
  getProfile: async () => profile,
  listMemberships: async () => [membership],
  listRestaurants: async () => [restaurant("restaurant-a"), restaurant("restaurant-b")],
} as unknown as DataAdapter;
describe("authorization", () => {
  it("allows a member to access their tenant", async () => {
    await expect(authorize(adapter, session, "restaurant:read", "restaurant-a")).resolves.toMatchObject({ restaurantIds: ["restaurant-a"] });
  });
  it("rejects cross-tenant reads and writes", async () => {
    await expect(authorize(adapter, session, "restaurant:read", "restaurant-b")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(authorize(adapter, session, "menu:update", "restaurant-b")).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("enforces the role permission matrix", () => {
    expect(can("STAFF", "menu:update")).toBe(true);
    expect(can("STAFF", "menu:delete")).toBe(false);
    expect(can("RESTAURANT_MANAGER", "branding:write")).toBe(false);
    expect(can("RESTAURANT_OWNER", "team:write")).toBe(true);
    expect(can("SUPER_ADMIN", "subscription:write")).toBe(true);
  });
});
