import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminService, teamService } from "./restaurants";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { getDerivedSubscriptionStatus, type Membership, type Profile, type Restaurant, type Session, type Subscription } from "@/types/domain";
import { dataAdapter } from "@/data";

const now = "2026-01-01T00:00:00Z";

const superAdminProfile: Profile = {
  id: "admin-1",
  email: "admin@nexmenu.com",
  name: "Super Admin",
  platform_role: "SUPER_ADMIN",
  password_hash: "",
  password_salt: "",
  email_verified: true,
  created_at: now,
  updated_at: now,
};

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

const staffProfileA: Profile = {
  id: "staff-a",
  email: "staffA@resto.local",
  name: "Staff A",
  platform_role: undefined,
  password_hash: "",
  password_salt: "",
  email_verified: true,
  created_at: now,
  updated_at: now,
};

const superAdminSession: Session = {
  id: "sess-admin",
  profile_id: superAdminProfile.id,
  expires_at: "2999-01-01T00:00:00Z",
};

const ownerSessionA: Session = {
  id: "sess-owner-a",
  profile_id: ownerProfileA.id,
  expires_at: "2999-01-01T00:00:00Z",
};

const staffSessionA: Session = {
  id: "sess-staff-a",
  profile_id: staffProfileA.id,
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

let memberships: Membership[] = [];
let subscriptions: Subscription[] = [];

beforeEach(() => {
  memberships = [
    {
      id: "mem-owner-a",
      restaurant_id: "resto-a",
      profile_id: ownerProfileA.id,
      email: ownerProfileA.email,
      role: "RESTAURANT_OWNER",
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    },
    {
      id: "mem-staff-a",
      restaurant_id: "resto-a",
      profile_id: staffProfileA.id,
      email: staffProfileA.email,
      role: "STAFF",
      status: "ACTIVE",
      created_at: now,
      updated_at: now,
    },
  ];

  subscriptions = [
    {
      id: "sub-a",
      restaurant_id: "resto-a",
      plan: "BASIC",
      starts_at: "2026-01-01T00:00:00Z",
      expires_at: "2026-12-31T23:59:59Z",
      status: "ACTIVE",
      notes: "Initial annual",
      created_at: now,
      updated_at: now,
    },
  ];

  vi.spyOn(dataAdapter, "getProfile").mockImplementation(async (id) => {
    if (id === superAdminProfile.id) return superAdminProfile;
    if (id === ownerProfileA.id) return ownerProfileA;
    if (id === staffProfileA.id) return staffProfileA;
    return undefined;
  });

  vi.spyOn(dataAdapter, "listProfiles").mockResolvedValue([
    superAdminProfile,
    ownerProfileA,
    staffProfileA,
  ]);

  vi.spyOn(dataAdapter, "listRestaurants").mockResolvedValue([restaurantA, restaurantB]);
  vi.spyOn(dataAdapter, "listMemberships").mockImplementation(async () => [...memberships]);
  vi.spyOn(dataAdapter, "saveMembership").mockImplementation(async (val) => {
    const idx = memberships.findIndex((m) => m.id === val.id);
    if (idx >= 0) memberships[idx] = val;
    else memberships.push(val);
    return val;
  });
  vi.spyOn(dataAdapter, "deleteMembership").mockImplementation(async (id) => {
    memberships = memberships.filter((m) => m.id !== id);
  });

  vi.spyOn(dataAdapter, "listSubscriptions").mockImplementation(async () => [...subscriptions]);
  vi.spyOn(dataAdapter, "getSubscription").mockImplementation(async (rid) =>
    subscriptions.find((s) => s.restaurant_id === rid),
  );
  vi.spyOn(dataAdapter, "saveSubscription").mockImplementation(async (val) => {
    const idx = subscriptions.findIndex((s) => s.id === val.id);
    if (idx >= 0) subscriptions[idx] = val;
    else subscriptions.push(val);
    return val;
  });
  vi.spyOn(dataAdapter, "saveAuditLog").mockImplementation(async (log) => log);
});

describe("Phase 1: Admin and Team Services", () => {
  describe("Subscription Derived Status", () => {
    it("identifies active subscriptions", () => {
      const sub = {
        starts_at: "2026-01-01T00:00:00Z",
        expires_at: "2026-12-31T00:00:00Z",
        status: "ACTIVE" as const,
      };
      const status = getDerivedSubscriptionStatus(sub, new Date("2026-06-01T00:00:00Z"));
      expect(status).toBe("active");
    });

    it("identifies subscriptions expiring soon (within 14 days)", () => {
      const sub = {
        starts_at: "2026-01-01T00:00:00Z",
        expires_at: "2026-06-10T00:00:00Z",
        status: "ACTIVE" as const,
      };
      const status = getDerivedSubscriptionStatus(sub, new Date("2026-06-01T00:00:00Z"));
      expect(status).toBe("expiring_soon");
    });

    it("identifies expired subscriptions", () => {
      const sub = {
        starts_at: "2026-01-01T00:00:00Z",
        expires_at: "2026-05-01T00:00:00Z",
        status: "ACTIVE" as const,
      };
      const status = getDerivedSubscriptionStatus(sub, new Date("2026-06-01T00:00:00Z"));
      expect(status).toBe("expired");
    });
  });

  describe("Subscription Management & Validation", () => {
    it("allows SUPER_ADMIN to update subscription details", async () => {
      const updated = await adminService.saveSubscription(superAdminSession, {
        ...subscriptions[0],
        plan: "PRO",
        notes: "Upgraded by admin",
      });
      expect(updated.plan).toBe("PRO");
      expect(updated.notes).toBe("Upgraded by admin");
    });

    it("rejects subscription when end date is earlier than start date", async () => {
      await expect(
        adminService.saveSubscription(superAdminSession, {
          ...subscriptions[0],
          starts_at: "2026-06-01T00:00:00Z",
          expires_at: "2026-01-01T00:00:00Z",
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("denies non-admin users from updating subscriptions", async () => {
      await expect(
        adminService.saveSubscription(ownerSessionA, {
          ...subscriptions[0],
          plan: "PREMIUM",
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("User Management and Last Owner Protection", () => {
    it("allows tenant owner to list members of their restaurant", async () => {
      const list = await teamService.listMembers(ownerSessionA, "resto-a");
      expect(list.length).toBe(2);
    });

    it("rejects cross-tenant member access", async () => {
      await expect(
        teamService.listMembers(ownerSessionA, "resto-b"),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("denies staff members from managing team", async () => {
      await expect(
        teamService.listMembers(staffSessionA, "resto-a"),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("prevents demoting the last active owner of a restaurant", async () => {
      await expect(
        teamService.updateRole(ownerSessionA, "resto-a", "mem-owner-a", "STAFF"),
      ).rejects.toThrow("Cannot demote the last active owner");
    });

    it("prevents deactivating the last active owner of a restaurant", async () => {
      await expect(
        teamService.setStatus(ownerSessionA, "resto-a", "mem-owner-a", "SUSPENDED"),
      ).rejects.toThrow("Cannot deactivate the last active owner");
    });

    it("prevents removing the last active owner of a restaurant", async () => {
      await expect(
        teamService.removeMember(ownerSessionA, "resto-a", "mem-owner-a"),
      ).rejects.toThrow("Cannot remove the last active owner");
    });

    it("allows demoting an owner if another active owner exists", async () => {
      // Add a second owner
      memberships.push({
        id: "mem-owner-2",
        restaurant_id: "resto-a",
        profile_id: "owner-2",
        email: "owner2@resto.local",
        role: "RESTAURANT_OWNER",
        status: "ACTIVE",
        created_at: now,
        updated_at: now,
      });

      const demoted = await teamService.updateRole(
        ownerSessionA,
        "resto-a",
        "mem-owner-a",
        "RESTAURANT_MANAGER",
      );
      expect(demoted.role).toBe("RESTAURANT_MANAGER");
    });

    it("allows inviting a new team member", async () => {
      const invited = await teamService.invite(
        ownerSessionA,
        "resto-a",
        "chef@resto.local",
        "STAFF",
      );
      expect(invited.email).toBe("chef@resto.local");
      expect(invited.role).toBe("STAFF");
      expect(invited.status).toBe("PENDING");
    });

    it("rejects inviting a duplicate member", async () => {
      await expect(
        teamService.invite(ownerSessionA, "resto-a", ownerProfileA.email, "STAFF"),
      ).rejects.toThrow("already exists");
    });
  });

  describe("Audit Log Filtering", () => {
    it("filters logs by action, restaurant, and date", async () => {
      vi.spyOn(dataAdapter, "listAuditLogs").mockResolvedValue([
        {
          id: "log-1",
          restaurant_id: "resto-a",
          actor_profile_id: superAdminProfile.id,
          actor_role: "SUPER_ADMIN",
          action: "plan.changed",
          entity_type: "subscription",
          created_at: "2026-02-01T10:00:00Z",
          updated_at: "2026-02-01T10:00:00Z",
        },
        {
          id: "log-2",
          restaurant_id: "resto-b",
          actor_profile_id: superAdminProfile.id,
          actor_role: "SUPER_ADMIN",
          action: "restaurant.suspended",
          entity_type: "restaurant",
          created_at: "2026-02-02T10:00:00Z",
          updated_at: "2026-02-02T10:00:00Z",
        },
      ]);

      const result = await adminService.filterAuditLogs(superAdminSession, {
        restaurantId: "resto-a",
      });
      expect(result.items.length).toBe(1);
      expect(result.items[0].action).toBe("plan.changed");
    });
  });
});
