export type AppTarget = "all" | "public" | "admin";

export function getAppTarget(): AppTarget {
  const target = (import.meta.env.VITE_APP_TARGET || "all").toLowerCase().trim();
  if (target === "public") return "public";
  if (target === "admin") return "admin";
  return "all";
}

export const APP_TARGET: AppTarget = getAppTarget();
export const IS_ADMIN_TARGET: boolean = APP_TARGET === "admin";
export const IS_PUBLIC_TARGET: boolean = APP_TARGET === "public";
export const IS_ALL_TARGET: boolean = APP_TARGET === "all";

export function getPublicSiteUrl(): string {
  const envPublic = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (envPublic) return envPublic.replace(/\/+$/, "");
  const envSite = import.meta.env.VITE_SITE_URL;
  if (envSite) return envSite.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function getPublicMenuUrl(slug: string, branchSlug?: string): string {
  const base = getPublicSiteUrl();
  const query = branchSlug ? `?branch=${branchSlug}` : "";
  return `${base}/r/${slug}${query}`;
}
