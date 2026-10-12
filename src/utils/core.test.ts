import { describe, expect, it } from "vitest";
import { normalizeSearch } from "./search";
import { isRestaurantOpen } from "./opening-hours";
import { slugSchema, toSlug } from "./slug";
import { effectivePlan } from "@/config/plans";
import type { OpeningHours } from "@/types/domain";

const closedWeek = (): OpeningHours => Object.fromEntries(
  ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    .map((day) => [day, { closed: true, shifts: [] }]),
);
describe("Arabic normalization", () => {
  it("normalizes variants, diacritics, tatweel and Arabic digits", () => {
    expect(normalizeSearch("إِضــافَة ١٢")).toBe("اضافه 12");
  });
});
describe("slugs", () => {
  it("creates safe slugs and blocks reserved words", () => {
    expect(toSlug("Cafe Moon!")).toBe("cafe-moon");
    expect(slugSchema.safeParse("cafe-moon").success).toBe(true);
    expect(slugSchema.safeParse("admin").success).toBe(false);
    expect(slugSchema.safeParse("Cafe Moon").success).toBe(false);
  });
});
describe("opening hours", () => {
  it("supports split shifts and a shift crossing midnight", () => {
    const hours = closedWeek();
    hours.friday = { closed: false, shifts: [{ open: "12:00", close: "16:00" }, { open: "18:00", close: "02:00" }] };
    expect(isRestaurantOpen(hours, "Africa/Cairo", new Date("2025-01-17T11:00:00Z"))).toBe(true);
    expect(isRestaurantOpen(hours, "Africa/Cairo", new Date("2025-01-17T15:00:00Z"))).toBe(false);
    expect(isRestaurantOpen(hours, "Africa/Cairo", new Date("2025-01-17T23:30:00Z"))).toBe(true);
  });
  it("uses the restaurant timezone", () => {
    const hours = closedWeek();
    hours.monday = { closed: false, shifts: [{ open: "09:00", close: "10:00" }] };
    const instant = new Date("2025-01-06T07:30:00Z");
    expect(isRestaurantOpen(hours, "Africa/Cairo", instant)).toBe(true);
    expect(isRestaurantOpen(hours, "America/New_York", instant)).toBe(false);
  });
});
describe("plan expiry", () => {
  it("falls back to FREE without deleting data", () => {
    expect(effectivePlan("PRO", "2020-01-01T00:00:00Z")).toBe("FREE");
    expect(effectivePlan("PRO", "2999-01-01T00:00:00Z")).toBe("PRO");
  });
});
