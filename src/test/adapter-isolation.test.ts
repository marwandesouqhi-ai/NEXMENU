import { describe, expect, it } from "vitest";
import { dataAdapter } from "@/data";
import { LocalAdapter } from "@/data/adapters/local";

describe("Phase 2 Test Isolation: Unit Test Adapter Isolation", () => {
  it("resolves strictly to LocalAdapter and never SupabaseAdapter during unit test runs", () => {
    expect(dataAdapter).toBeInstanceOf(LocalAdapter);
    expect(dataAdapter.constructor.name).toBe("LocalAdapter");
    expect(import.meta.env.VITE_DATA_ADAPTER).toBe("local");
  });

  it("ensures live Supabase connection variables are scrubbed from default test env", () => {
    expect(import.meta.env.VITE_SUPABASE_URL || "").toBe("");
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY || "").toBe("");
    expect(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").toBe("");
  });
});
