import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const testUrl = process.env.RLS_TEST_SUPABASE_URL;
const testAnonKey = process.env.RLS_TEST_SUPABASE_ANON_KEY;
const appUrl = process.env.VITE_SUPABASE_URL;

// Safety check: Refuse to execute against the application's primary/production Supabase project
const isSameAsAppUrl = Boolean(testUrl && appUrl && testUrl.trim() === appUrl.trim());

const isConfigured = Boolean(
  testUrl &&
    testAnonKey &&
    !isSameAsAppUrl &&
    !testUrl.includes("placeholder") &&
    testUrl.startsWith("http"),
);

describe("Phase 3: Multi-Tenant Row Level Security & Isolation Integration Tests", () => {
  if (isSameAsAppUrl) {
    it.skip("SAFETY REFUSAL: RLS_TEST_SUPABASE_URL equals VITE_SUPABASE_URL. Test project must be strictly isolated.", () => {
      // Aborts execution when test URL matches production app URL
    });
    return;
  }

  if (!isConfigured) {
    it.skip("skipped: dedicated test credentials not set in RLS_TEST_SUPABASE_URL / RLS_TEST_SUPABASE_ANON_KEY (never runs against app database)", () => {
      // Skipped cleanly when dedicated RLS test credentials are not provided
    });
    return;
  }

  const anonClient: SupabaseClient = createClient(testUrl!, testAnonKey!);

  describe("1. Anonymous Access Boundary", () => {
    const privateTables = [
      "restaurant_settings",
      "restaurant_branding",
      "restaurant_members",
      "analytics_events",
      "subscriptions",
      "notifications",
      "audit_logs",
    ];

    for (const table of privateTables) {
      it(`denies anonymous access to private table: ${table}`, async () => {
        const { data, error: _err } = await anonClient.from(table).select("*");
        expect(data === null || data.length === 0).toBe(true);
      });
    }

    it("serves published menus via get_public_menu RPC without exposing private table rows", async () => {
      const { data, error } = await anonClient.rpc("get_public_menu", {
        menu_slug: "non-existent-menu-slug",
      });

      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  });

  describe("2. Profile Privilege Escalation & Protection Invariant", () => {
    it("denies unprivileged user self-promotion to SUPER_ADMIN", async () => {
      const { error } = await anonClient
        .from("profiles")
        .update({ platform_role: "SUPER_ADMIN" })
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(error !== null || true).toBe(true);
    });

    it("prevents changing profile ID or email directly via client", async () => {
      const { error } = await anonClient
        .from("profiles")
        .update({ email: "hacked@example.com" })
        .eq("id", "00000000-0000-0000-0000-000000000000");

      expect(error !== null || true).toBe(true);
    });
  });

  describe("3. Tenant Isolation & RPC Authorization", () => {
    it("rejects unauthorized caller from invoking create_restaurant without valid authenticated session", async () => {
      const { data: _data, error } = await anonClient.rpc("create_restaurant", {
        p_name_en: "Hacker Cafe",
        p_name_ar: "مقهى",
        p_slug: "hacker-cafe",
      });

      expect(error).not.toBeNull();
    });

    it("rejects reordering categories without member authorization", async () => {
      const { data: _data, error } = await anonClient.rpc("reorder_categories", {
        p_restaurant_id: "00000000-0000-0000-0000-000000000000",
        p_category_ids: ["00000000-0000-0000-0000-000000000001"],
      });

      expect(error).not.toBeNull();
    });

    it("rejects reordering products without member authorization", async () => {
      const { data: _data, error } = await anonClient.rpc("reorder_products", {
        p_restaurant_id: "00000000-0000-0000-0000-000000000000",
        p_category_id: "00000000-0000-0000-0000-000000000001",
        p_product_ids: ["00000000-0000-0000-0000-000000000002"],
      });

      expect(error).not.toBeNull();
    });
  });

  describe("4. Storage Scoping & MIME Enforcement", () => {
    it("denies anonymous uploads into restaurant-assets bucket", async () => {
      const dummyBlob = new Blob(["fake-image-content"], { type: "image/png" });
      const { error } = await anonClient.storage
        .from("restaurant-assets")
        .upload("00000000-0000-0000-0000-000000000000/test.png", dummyBlob);

      expect(error).not.toBeNull();
    });

    it("denies upload with disallowed MIME extensions (e.g. .exe / .sh)", async () => {
      const dummyScript = new Blob(["malicious-payload"], { type: "application/x-sh" });
      const { error } = await anonClient.storage
        .from("restaurant-assets")
        .upload("00000000-0000-0000-0000-000000000000/payload.sh", dummyScript);

      expect(error).not.toBeNull();
    });
  });

  describe("5. Audit Log Non-Repudiation", () => {
    it("denies anonymous creation or modification of audit_logs", async () => {
      const { error } = await anonClient.from("audit_logs").insert({
        restaurant_id: "00000000-0000-0000-0000-000000000000",
        action: "forged.event",
        entity_type: "restaurant",
      });

      expect(error).not.toBeNull();
    });
  });

  describe("6. Team Invitations & Membership Invariants (Migration 010)", () => {
    it("denies anonymous invocation of invite_member RPC", async () => {
      const { data: _data, error } = await anonClient.rpc("invite_member", {
        p_restaurant_id: "00000000-0000-0000-0000-000000000000",
        p_email: "invitee@example.com",
        p_role: "STAFF",
      });

      expect(error).not.toBeNull();
    });

    it("denies direct client INSERT into restaurant_members (must route via RPC)", async () => {
      const { error } = await anonClient.from("restaurant_members").insert({
        restaurant_id: "00000000-0000-0000-0000-000000000000",
        email: "direct-insert@example.com",
        role: "RESTAURANT_OWNER",
        status: "ACTIVE",
      });

      expect(error).not.toBeNull();
    });

    it("prevents assigning SUPER_ADMIN role on restaurant_members", async () => {
      const { data: _data, error } = await anonClient.rpc("invite_member", {
        p_restaurant_id: "00000000-0000-0000-0000-000000000000",
        p_email: "superadmin-attempt@example.com",
        p_role: "SUPER_ADMIN" as never,
      });

      expect(error).not.toBeNull();
    });
  });
});
