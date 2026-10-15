import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import AdminPage from "./AdminPage";
import type { Restaurant, Subscription } from "@/types/domain";

const { mockRestaurants, mockSubscriptions } = vi.hoisted(() => {
  const restaurants: Restaurant[] = [
    {
      id: "rest-free",
      slug: "free-cafe",
      name_en: "Free Cafe",
      name_ar: "مقهى مجاني",
      description_en: "",
      description_ar: "",
      phone: "123",
      whatsapp: "",
      address_en: "",
      address_ar: "",
      maps_url: "",
      website: "",
      instagram: "",
      facebook: "",
      cuisine_type: "Cafe",
      currency: "USD",
      timezone: "UTC",
      menu_status: "PUBLISHED",
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "rest-basic",
      slug: "basic-bistro",
      name_en: "Basic Bistro",
      name_ar: "بيسترو أساسي",
      description_en: "",
      description_ar: "",
      phone: "456",
      whatsapp: "",
      address_en: "",
      address_ar: "",
      maps_url: "",
      website: "",
      instagram: "",
      facebook: "",
      cuisine_type: "Bistro",
      currency: "USD",
      timezone: "UTC",
      menu_status: "PUBLISHED",
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "rest-pro",
      slug: "pro-pizza",
      name_en: "Pro Pizza",
      name_ar: "بيتزا برو",
      description_en: "",
      description_ar: "",
      phone: "789",
      whatsapp: "",
      address_en: "",
      address_ar: "",
      maps_url: "",
      website: "",
      instagram: "",
      facebook: "",
      cuisine_type: "Pizza",
      currency: "USD",
      timezone: "UTC",
      menu_status: "PUBLISHED",
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "rest-premium",
      slug: "premium-palace",
      name_en: "Premium Palace",
      name_ar: "قصر بريميوم",
      description_en: "",
      description_ar: "",
      phone: "999",
      whatsapp: "",
      address_en: "",
      address_ar: "",
      maps_url: "",
      website: "",
      instagram: "",
      facebook: "",
      cuisine_type: "Fine Dining",
      currency: "USD",
      timezone: "UTC",
      menu_status: "PUBLISHED",
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  const subscriptions: Subscription[] = [
    {
      id: "sub-1",
      restaurant_id: "rest-free",
      plan: "FREE",
      starts_at: "2026-01-01T00:00:00Z",
      expires_at: "2027-01-01T00:00:00Z",
      status: "ACTIVE",
      notes: "Free trial",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "sub-2",
      restaurant_id: "rest-basic",
      plan: "BASIC",
      starts_at: "2026-01-01T00:00:00Z",
      expires_at: "2027-01-01T00:00:00Z",
      status: "ACTIVE",
      notes: "Basic monthly",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "sub-3",
      restaurant_id: "rest-pro",
      plan: "PRO",
      starts_at: "2026-01-01T00:00:00Z",
      expires_at: "2027-01-01T00:00:00Z",
      status: "ACTIVE",
      notes: "Pro annual",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "sub-4",
      restaurant_id: "rest-premium",
      plan: "PREMIUM",
      starts_at: "2026-01-01T00:00:00Z",
      expires_at: "2027-01-01T00:00:00Z",
      status: "ACTIVE",
      notes: "Premium enterprise",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];

  return { mockRestaurants: restaurants, mockSubscriptions: subscriptions };
});

// Mock AuthContext
vi.mock("@/app/AuthContext", () => ({
  useAuth: () => ({
    session: { id: "s1", profile_id: "p1", expires_at: "2999-01-01" },
    profile: { id: "p1", email: "admin@nexmenu.com", platform_role: "SUPER_ADMIN" },
    signOut: vi.fn(),
  }),
}));

// Mock adminService
vi.mock("@admin/services/adminService", () => ({
  adminService: {
    dashboard: vi.fn().mockImplementation(async () => ({
      restaurants: mockRestaurants,
      profiles: [],
      events: [],
      logs: [],
      subscriptions: mockSubscriptions,
      memberships: [],
    })),
    filterAuditLogs: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    }),
    setStatus: vi.fn(),
    setPlan: vi.fn(),
    saveSubscription: vi.fn(),
  },
}));

describe("AdminPage - Plan Column Regression Test", () => {
  it("renders restaurants with their real plans rather than hardcoding PRO", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Assert each restaurant's plan select matches its actual subscription plan
    const freeSelect = (await screen.findByLabelText("Plan for Free Cafe")) as HTMLSelectElement;
    expect(freeSelect.value).toBe("FREE");

    const basicSelect = (await screen.findByLabelText("Plan for Basic Bistro")) as HTMLSelectElement;
    expect(basicSelect.value).toBe("BASIC");

    const proSelect = (await screen.findByLabelText("Plan for Pro Pizza")) as HTMLSelectElement;
    expect(proSelect.value).toBe("PRO");

    const premiumSelect = (await screen.findByLabelText("Plan for Premium Palace")) as HTMLSelectElement;
    expect(premiumSelect.value).toBe("PREMIUM");
  });
});
