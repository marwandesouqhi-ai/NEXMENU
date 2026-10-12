import { describe, expect, it, vi } from "vitest";
import { SupabaseAdapter } from "./index";
import { ValidationError } from "@/lib/errors";
import type { Subscription } from "@/types/domain";

describe("SupabaseAdapter Unit Tests", () => {
  it("initializes cleanly with options or fallback client", () => {
    const adapter = new SupabaseAdapter({
      url: "https://test-ref.supabase.co",
      anonKey: "test-anon-key",
    });
    expect(adapter).toBeInstanceOf(SupabaseAdapter);
  });

  describe("Subscription Validation", () => {
    it("rejects subscriptions where expires_at is before starts_at", async () => {
      const adapter = new SupabaseAdapter();
      const invalidSub: Subscription = {
        id: "sub-invalid",
        restaurant_id: "rest-1",
        plan: "PRO",
        starts_at: "2026-12-01T00:00:00Z",
        expires_at: "2026-01-01T00:00:00Z",
        status: "ACTIVE",
        notes: "Invalid date sub",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      await expect(adapter.saveSubscription(invalidSub)).rejects.toThrow(ValidationError);
    });
  });

  describe("File Upload Guardrails", () => {
    it("rejects non-image files", async () => {
      const adapter = new SupabaseAdapter();
      const textFile = new File(["not an image"], "test.txt", { type: "text/plain" });

      await expect(adapter.uploadFile(textFile)).rejects.toThrow(ValidationError);
    });

    it("rejects files larger than 5MB", async () => {
      const adapter = new SupabaseAdapter();
      const largeBlob = new Uint8Array(6 * 1024 * 1024);
      const largeFile = new File([largeBlob], "huge.jpg", { type: "image/jpeg" });

      await expect(adapter.uploadFile(largeFile)).rejects.toThrow(ValidationError);
    });
  });

  describe("Database Import Versioning", () => {
    it("rejects import with incompatible version", async () => {
      const adapter = new SupabaseAdapter();
      await expect(
        adapter.importDatabase({
          version: 99 as never,
          exported_at: "2026-01-01T00:00:00Z",
          data: {},
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("Reordering Guardrails", () => {
    it("rejects reordering when category does not exist", async () => {
      const adapter = new SupabaseAdapter();
      vi.spyOn(adapter, "listCategories").mockResolvedValue([]);

      await expect(
        adapter.reorderCategories("rest-1", ["non-existent-cat"]),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects reordering when product does not exist in category", async () => {
      const adapter = new SupabaseAdapter();
      vi.spyOn(adapter, "listProducts").mockResolvedValue([]);

      await expect(
        adapter.reorderProducts("rest-1", "cat-1", ["non-existent-prod"]),
      ).rejects.toThrow(ValidationError);
    });
  });
});
