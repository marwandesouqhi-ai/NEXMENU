/**
 * WCAG 2.1 Contrast & Relative Luminance Utility
 *
 * Implements W3C WCAG 2.1 specifications:
 * - Relative Luminance: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * - Contrast Ratio: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 * - AA Threshold: 4.5:1 for normal text, 3.0:1 for large text and UI components.
 */

export interface ContrastResult {
  ratio: number;
  formattedRatio: string;
  passesNormalAa: boolean; // >= 4.5:1
  passesLargeAa: boolean;  // >= 3.0:1
  passesAaa: boolean;      // >= 7.0:1
  level: "AAA" | "AA" | "AA-Large" | "FAIL";
  isBlocked: boolean;      // < 3.0:1
  suggestedAlternative?: string;
}

/**
 * Parses a hex color string into [R, G, B] values in 0-255 range.
 * Supports #RGB, RGB, #RRGGBB, RRGGBB. Returns null if invalid.
 */
export function parseHexColor(hex: string): [number, number, number] | null {
  if (!hex || typeof hex !== "string") return null;
  const clean = hex.trim().replace(/^#/, "");

  if (clean.length === 3) {
    if (!/^[0-9a-fA-F]{3}$/.test(clean)) return null;
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }

  if (clean.length === 6) {
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }

  return null;
}

/**
 * Calculates WCAG relative luminance from an [R, G, B] tuple (0-255).
 * Value range: 0.0 (darkest black) to 1.0 (lightest white).
 */
export function getRelativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes the contrast ratio between two hex colors according to WCAG 2.1.
 * Ratio range: 1.0 to 21.0. Returns 1.0 if any color is invalid.
 */
export function getContrastRatio(colorA: string, colorB: string): number {
  const rgbA = parseHexColor(colorA);
  const rgbB = parseHexColor(colorB);

  if (!rgbA || !rgbB) return 1.0;

  const lumA = getRelativeLuminance(rgbA);
  const lumB = getRelativeLuminance(rgbB);

  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Number(ratio.toFixed(2));
}

/**
 * Calculates an accessible alternative color when contrast fails the minimum target ratio.
 */
export function suggestAccessibleColor(
  foreground: string,
  background: string,
  targetRatio = 4.5,
): string {
  const currentRatio = getContrastRatio(foreground, background);
  if (currentRatio >= targetRatio) return foreground;

  const bgRgb = parseHexColor(background) ?? [255, 255, 255];
  const bgLum = getRelativeLuminance(bgRgb);

  // If background is light, recommend a rich dark ink color;
  // If background is dark, recommend clean crisp white.
  const fallback = bgLum >= 0.5 ? "#111827" : "#ffffff";
  if (getContrastRatio(fallback, background) >= targetRatio) {
    return fallback;
  }

  // Pure black or white boundary check
  const whiteRatio = getContrastRatio("#ffffff", background);
  const blackRatio = getContrastRatio("#000000", background);
  return whiteRatio >= blackRatio ? "#ffffff" : "#000000";
}

/**
 * Performs a full WCAG audit between two colors.
 */
export function evaluateContrast(
  foreground: string,
  background: string,
  targetRatio = 4.5,
): ContrastResult {
  const ratio = getContrastRatio(foreground, background);
  const passesNormalAa = ratio >= 4.5;
  const passesLargeAa = ratio >= 3.0;
  const passesAaa = ratio >= 7.0;

  let level: ContrastResult["level"] = "FAIL";
  if (passesAaa) level = "AAA";
  else if (passesNormalAa) level = "AA";
  else if (passesLargeAa) level = "AA-Large";

  const isBlocked = ratio < 3.0;
  const suggestedAlternative =
    ratio < targetRatio ? suggestAccessibleColor(foreground, background, targetRatio) : undefined;

  return {
    ratio,
    formattedRatio: `${ratio.toFixed(2)}:1`,
    passesNormalAa,
    passesLargeAa,
    passesAaa,
    level,
    isBlocked,
    suggestedAlternative,
  };
}

/**
 * Evaluates branding colors and produces safe fallbacks if contrast is below accessible limits.
 */
export function getSafeBrandingColors(branding: {
  primary_color: string;
  background_color: string;
  text_color: string;
  secondary_color?: string;
}) {
  const textBgResult = evaluateContrast(branding.text_color, branding.background_color, 4.5);
  // Buttons use white text on primary_color by default:
  const buttonTextResult = evaluateContrast("#ffffff", branding.primary_color, 4.5);

  let safeTextColor = branding.text_color;
  let safeButtonTextColor = "#ffffff";

  // If text on background is severely illegible (< 3.0:1), fallback to accessible suggestion
  if (textBgResult.isBlocked) {
    safeTextColor = suggestAccessibleColor(branding.text_color, branding.background_color, 4.5);
  }

  // If white text on primary button is severely illegible (< 3.0:1), check dark text fallback
  if (buttonTextResult.isBlocked) {
    const darkRatio = getContrastRatio("#111827", branding.primary_color);
    if (darkRatio >= 3.0) {
      safeButtonTextColor = "#111827";
    }
  }

  return {
    textBgResult,
    buttonTextResult,
    safeTextColor,
    safeButtonTextColor,
    needsFallback: textBgResult.isBlocked || buttonTextResult.isBlocked,
  };
}
