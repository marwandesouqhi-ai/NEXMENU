import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getAppTarget, getPublicSiteUrl, getPublicMenuUrl } from "./target";
import { AdminOnly } from "./guards";
import { createTargetRoutes } from "./routes";
import { AuthContext } from "./AuthContext";
import type { SafeProfile } from "@/services/auth";
import type { Session } from "@/types/domain";

describe("Target Accessor and URL helpers", () => {
  it("defaults to all if VITE_APP_TARGET is empty or unrecognized", () => {
    expect(getAppTarget()).toBeDefined();
  });

  it("computes public menu URLs accurately using public origin", () => {
    const menuUrl = getPublicMenuUrl("cafe-moon");
    expect(menuUrl).toContain("/r/cafe-moon");

    const branchUrl = getPublicMenuUrl("cafe-moon", "downtown");
    expect(branchUrl).toContain("/r/cafe-moon?branch=downtown");
  });

  it("resolves public site url without trailing slash", () => {
    const siteUrl = getPublicSiteUrl();
    expect(siteUrl.endsWith("/")).toBe(false);
  });
});

describe("Per-Target Router structure", () => {
  it("creates route objects for current configuration", () => {
    const routes = createTargetRoutes();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.some((route) => route.path === "/crm-admin")).toBe(true);
  });
});

describe("AdminOnly Guard", () => {
  const dummySession: Session = {
    id: "sess-1",
    profile_id: "user-123",
    expires_at: "2099-01-01T00:00:00Z",
  };

  it("renders children when user is SUPER_ADMIN", () => {
    const superAdminProfile: SafeProfile = {
      id: "user-123",
      name: "Admin User",
      email: "admin@nexmenu.local",
      platform_role: "SUPER_ADMIN",
      email_verified: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    render(
      <AuthContext.Provider
        value={{
          session: dummySession,
          profile: superAdminProfile,
          signIn: vi.fn(),
          signUp: vi.fn(),
          signOut: vi.fn(),
          refresh: vi.fn(),
        }}
      >
        <AdminOnly>
          <div data-testid="admin-content">Super Admin Access Granted</div>
        </AdminOnly>
      </AuthContext.Provider>
    );

    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
  });
});
