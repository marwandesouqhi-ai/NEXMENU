import { describe, expect, it } from "vitest";
import {
  evaluateContrast,
  getContrastRatio,
  getRelativeLuminance,
  getSafeBrandingColors,
  parseHexColor,
  suggestAccessibleColor,
} from "./contrast";

describe("WCAG Contrast Utilities", () => {
  describe("parseHexColor", () => {
    it("parses valid 6-digit hex with and without hash", () => {
      expect(parseHexColor("#ffffff")).toEqual([255, 255, 255]);
      expect(parseHexColor("000000")).toEqual([0, 0, 0]);
      expect(parseHexColor("#176B4D")).toEqual([23, 107, 77]);
    });

    it("parses valid 3-digit hex with and without hash", () => {
      expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
      expect(parseHexColor("000")).toEqual([0, 0, 0]);
      expect(parseHexColor("#f0a")).toEqual([255, 0, 170]);
    });

    it("returns null for invalid inputs", () => {
      expect(parseHexColor("")).toBeNull();
      expect(parseHexColor("#12")).toBeNull();
      expect(parseHexColor("#12345")).toBeNull();
      expect(parseHexColor("#1234567")).toBeNull();
      expect(parseHexColor("#gggggg")).toBeNull();
      expect(parseHexColor("not-a-color")).toBeNull();
      expect(parseHexColor(null as unknown as string)).toBeNull();
      expect(parseHexColor(undefined as unknown as string)).toBeNull();
    });
  });

  describe("getRelativeLuminance", () => {
    it("calculates 0 for pure black and 1 for pure white", () => {
      expect(getRelativeLuminance([0, 0, 0])).toBe(0);
      expect(getRelativeLuminance([255, 255, 255])).toBe(1);
    });

    it("handles low linear values under 0.04045 threshold", () => {
      const lum = getRelativeLuminance([5, 5, 5]);
      expect(lum).toBeGreaterThan(0);
      expect(lum).toBeLessThan(0.01);
    });
  });

  describe("getContrastRatio", () => {
    it("returns 21:1 for black and white", () => {
      expect(getContrastRatio("#000000", "#ffffff")).toBe(21);
      expect(getContrastRatio("#ffffff", "#000000")).toBe(21);
    });

    it("returns 1:1 for identical colors", () => {
      expect(getContrastRatio("#176b4d", "#176b4d")).toBe(1);
    });

    it("returns 1:1 when invalid hex inputs are provided", () => {
      expect(getContrastRatio("invalid", "#ffffff")).toBe(1);
      expect(getContrastRatio("#ffffff", "invalid")).toBe(1);
    });

    it("accurately computes contrast for NEXMENU brand colors", () => {
      // Primary #176b4d on Light background #f7f4ed
      const ratio = getContrastRatio("#176b4d", "#f7f4ed");
      expect(ratio).toBeGreaterThan(5);
    });
  });

  describe("evaluateContrast", () => {
    it("identifies AAA compliance (>= 7.0)", () => {
      const result = evaluateContrast("#000000", "#ffffff");
      expect(result.ratio).toBe(21);
      expect(result.level).toBe("AAA");
      expect(result.passesNormalAa).toBe(true);
      expect(result.passesLargeAa).toBe(true);
      expect(result.passesAaa).toBe(true);
      expect(result.isBlocked).toBe(false);
      expect(result.suggestedAlternative).toBeUndefined();
    });

    it("identifies AA compliance (4.5 <= ratio < 7.0)", () => {
      // #707070 on #ffffff has ~5.7:1 contrast
      const result = evaluateContrast("#707070", "#ffffff");
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
      expect(result.ratio).toBeLessThan(7.0);
      expect(result.level).toBe("AA");
      expect(result.passesNormalAa).toBe(true);
      expect(result.isBlocked).toBe(false);
    });

    it("identifies AA-Large compliance (3.0 <= ratio < 4.5)", () => {
      // #767676 on #ffffff has ~4.54:1, #808080 is around ~3.95:1
      const result = evaluateContrast("#888888", "#ffffff");
      expect(result.ratio).toBeGreaterThanOrEqual(3.0);
      expect(result.ratio).toBeLessThan(4.5);
      expect(result.level).toBe("AA-Large");
      expect(result.passesNormalAa).toBe(false);
      expect(result.passesLargeAa).toBe(true);
      expect(result.isBlocked).toBe(false);
      expect(result.suggestedAlternative).toBeDefined();
    });

    it("identifies severe FAIL and isBlocked (< 3.0)", () => {
      const result = evaluateContrast("#ffffff", "#fefefe");
      expect(result.ratio).toBeLessThan(3.0);
      expect(result.level).toBe("FAIL");
      expect(result.passesNormalAa).toBe(false);
      expect(result.passesLargeAa).toBe(false);
      expect(result.isBlocked).toBe(true);
      expect(result.suggestedAlternative).toBeDefined();
    });
  });

  describe("suggestAccessibleColor", () => {
    it("returns original color if contrast already satisfies target", () => {
      expect(suggestAccessibleColor("#000000", "#ffffff")).toBe("#000000");
    });

    it("suggests dark ink color for light backgrounds when contrast fails", () => {
      const suggestion = suggestAccessibleColor("#ffffff", "#f7f4ed");
      expect(suggestion).toBe("#111827");
      expect(getContrastRatio(suggestion, "#f7f4ed")).toBeGreaterThanOrEqual(4.5);
    });

    it("suggests white text for dark backgrounds when contrast fails", () => {
      const suggestion = suggestAccessibleColor("#111111", "#17221d");
      expect(suggestion).toBe("#ffffff");
      expect(getContrastRatio(suggestion, "#17221d")).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("getSafeBrandingColors", () => {
    it("leaves compliant branding intact without fallback", () => {
      const validBranding = {
        primary_color: "#176b4d",
        background_color: "#f7f4ed",
        text_color: "#17221d",
      };
      const audited = getSafeBrandingColors(validBranding);
      expect(audited.needsFallback).toBe(false);
      expect(audited.safeTextColor).toBe("#17221d");
      expect(audited.safeButtonTextColor).toBe("#ffffff");
    });

    it("replaces blocked text color on background with safe suggestion", () => {
      const inaccessibleBranding = {
        primary_color: "#176b4d",
        background_color: "#f7f4ed",
        text_color: "#ffffff", // white text on light cream background fails (< 1.2:1)
      };
      const audited = getSafeBrandingColors(inaccessibleBranding);
      expect(audited.needsFallback).toBe(true);
      expect(audited.textBgResult.isBlocked).toBe(true);
      expect(audited.safeTextColor).toBe("#111827");
    });

    it("provides safe dark text for low-contrast primary buttons", () => {
      const yellowButtonBranding = {
        primary_color: "#ffff00", // pure yellow button with default white text is illegible
        background_color: "#ffffff",
        text_color: "#111827",
      };
      const audited = getSafeBrandingColors(yellowButtonBranding);
      expect(audited.needsFallback).toBe(true);
      expect(audited.buttonTextResult.isBlocked).toBe(true);
      expect(audited.safeButtonTextColor).toBe("#111827");
    });
  });
});
