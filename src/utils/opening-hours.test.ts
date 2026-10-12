import { describe, expect, it } from "vitest";
import { isRestaurantOpen } from "./opening-hours";
import type { OpeningHours } from "@/types/domain";

const emptyWeek = (): OpeningHours =>
  Object.fromEntries(
    [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ].map((day) => [day, { closed: true, shifts: [] }]),
  ) as OpeningHours;

describe("Opening Hours Engine - Edge Cases", () => {
  it("handles a standard daytime shift", () => {
    const hours = emptyWeek();
    hours.monday = {
      closed: false,
      shifts: [{ open: "09:00", close: "17:00" }],
    };

    // Monday 12:00 Cairo time -> Open
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-05T10:00:00Z")), // 12:00 Cairo (UTC+2)
    ).toBe(true);

    // Monday 08:59 Cairo time -> Closed
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-05T06:59:00Z")), // 08:59 Cairo
    ).toBe(false);

    // Monday 17:01 Cairo time -> Closed
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-05T15:01:00Z")), // 17:01 Cairo
    ).toBe(false);
  });

  it("handles shifts crossing midnight into the next day", () => {
    const hours = emptyWeek();
    // Friday night into Saturday morning: 20:00 to 03:00
    hours.friday = {
      closed: false,
      shifts: [{ open: "20:00", close: "03:00" }],
    };
    // Saturday itself is marked closed
    hours.saturday = {
      closed: true,
      shifts: [],
    };

    // Friday 22:00 Cairo (UTC+2 is 20:00Z) -> Open
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-09T20:00:00Z")),
    ).toBe(true);

    // Friday 23:59 Cairo (21:59Z) -> Open
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-09T21:59:00Z")),
    ).toBe(true);

    // Saturday 00:01 Cairo (22:01Z on Jan 9) -> Open (cross-midnight shift still active)
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-09T22:01:00Z")),
    ).toBe(true);

    // Saturday 02:30 Cairo (00:30Z on Jan 10) -> Open (before 03:00 close)
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-10T00:30:00Z")),
    ).toBe(true);

    // Saturday 03:01 Cairo (01:01Z on Jan 10) -> Closed (after 03:00 close)
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-10T01:01:00Z")),
    ).toBe(false);
  });

  it("handles multiple split shifts in the same day (e.g. Lunch & Dinner)", () => {
    const hours = emptyWeek();
    hours.sunday = {
      closed: false,
      shifts: [
        { open: "12:00", close: "16:00" }, // Lunch shift
        { open: "19:00", close: "23:30" }, // Dinner shift
      ],
    };

    // 14:00 Cairo -> Open (during lunch)
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-04T12:00:00Z")),
    ).toBe(true);

    // 17:30 Cairo -> Closed (break between lunch and dinner)
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-04T15:30:00Z")),
    ).toBe(false);

    // 21:00 Cairo -> Open (during dinner)
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-04T19:00:00Z")),
    ).toBe(true);

    // 23:45 Cairo -> Closed (after dinner)
    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-04T21:45:00Z")),
    ).toBe(false);
  });

  it("handles different timezones accurately", () => {
    const hours = emptyWeek();
    hours.wednesday = {
      closed: false,
      shifts: [{ open: "10:00", close: "22:00" }],
    };

    // Universal instant: 2026-01-07 09:00:00 UTC
    const instant = new Date("2026-01-07T09:00:00Z");

    // In Cairo (UTC+2), local time is 11:00 AM -> OPEN
    expect(isRestaurantOpen(hours, "Africa/Cairo", instant)).toBe(true);

    // In New York (UTC-5), local time is 04:00 AM -> CLOSED
    expect(isRestaurantOpen(hours, "America/New_York", instant)).toBe(false);

    // In Tokyo (UTC+9), local time is 18:00 (6:00 PM) -> OPEN
    expect(isRestaurantOpen(hours, "Asia/Tokyo", instant)).toBe(true);
  });

  it("returns false if day is explicitly marked closed even if shifts are defined", () => {
    const hours = emptyWeek();
    hours.tuesday = {
      closed: true, // Emergency closure
      shifts: [{ open: "08:00", close: "22:00" }],
    };

    expect(
      isRestaurantOpen(hours, "Africa/Cairo", new Date("2026-01-06T10:00:00Z")),
    ).toBe(false);
  });
});
