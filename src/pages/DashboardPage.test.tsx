import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import DashboardPage from "./DashboardPage";
import type { Restaurant } from "@/types/domain";
import type { DashboardDetails } from "@/features/dashboard/types";

const { mockRestaurant, mockDetails } = vi.hoisted(() => {
  const restaurant: Restaurant = {
    id: "rest-1",
    slug: "cafe-moon",
    name_en: "Cafe Moon",
    name_ar: "مقهى القمر",
    description_en: "Specialty coffee",
    description_ar: "قهوة مختصة",
    phone: "01000000000",
    whatsapp: "01000000000",
    address_en: "123 Nile St",
    address_ar: "١٢٣ شارع النيل",
    maps_url: "https://maps.google.com",
    website: "https://cafemoon.local",
    instagram: "",
    facebook: "",
    cuisine_type: "Cafe",
    currency: "EGP",
    timezone: "Africa/Cairo",
    menu_status: "PUBLISHED",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const details: DashboardDetails = {
    restaurant,
    settings: {
      id: "sett-1",
      restaurant_id: "rest-1",
      default_locale: "en",
      opening_hours: {
        monday: { closed: false, shifts: [{ open: "08:00", close: "23:00" }] },
      },
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    branding: {
      id: "brand-1",
      restaurant_id: "rest-1",
      primary_color: "#176b4d",
      secondary_color: "#d7aa5c",
      background_color: "#f7f4ed",
      text_color: "#17221d",
      template: "Cafe",
      radius: "rounded",
      theme: "light",
      font: "Inter",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    subscription: {
      id: "sub-1",
      restaurant_id: "rest-1",
      plan: "PRO",
      starts_at: "2026-01-01T00:00:00Z",
      expires_at: "2027-01-01T00:00:00Z",
      status: "ACTIVE",
      notes: "Pro Plan annual",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    categories: [
      {
        id: "cat-1",
        restaurant_id: "rest-1",
        name_en: "Hot Coffee",
        name_ar: "قهوة ساخنة",
        is_visible: true,
        sort_order: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    products: [
      {
        id: "prod-1",
        restaurant_id: "rest-1",
        category_id: "cat-1",
        name_en: "V60 Drip",
        name_ar: "في ٦٠",
        description_en: "Single origin pour over",
        description_ar: "قهوة مقطرة مختصة",
        price: 85,
        image_url: "/assets/food-1.webp",
        is_available: true,
        is_visible: true,
        is_featured: true,
        is_popular: false,
        sort_order: 0,
        sku: "V60-01",
        options: [],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    offers: [
      {
        id: "off-1",
        restaurant_id: "rest-1",
        title_en: "Morning Coffee Special",
        title_ar: "عرض الصباح",
        description_en: "20% off on all brewed coffee",
        description_ar: "خصم ٢٠٪",
        type: "PERCENTAGE",
        value: 20,
        is_active: true,
        starts_at: "2026-01-01T00:00:00Z",
        ends_at: "2026-12-31T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    branches: [
      {
        id: "br-1",
        restaurant_id: "rest-1",
        slug: "zama-branch",
        name_en: "Zamalek Branch",
        name_ar: "فرع الزمالك",
        address_en: "15 Brazil St, Zamalek",
        address_ar: "١٥ شارع البرازيل، الزمالك",
        phone: "01011111111",
        maps_url: "https://maps.google.com",
        opening_hours: {
          monday: { closed: false, shifts: [{ open: "08:00", close: "23:00" }] },
        },
        hidden_product_ids: [],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    members: [
      {
        id: "mem-1",
        restaurant_id: "rest-1",
        profile_id: "p1",
        role: "RESTAURANT_OWNER",
        status: "ACTIVE",
        email: "owner@cafemoon.com",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    notifications: [],
  };

  return { mockRestaurant: restaurant, mockDetails: details };
});

vi.mock("@/app/AuthContext", () => ({
  useAuth: () => ({
    session: { id: "s1", profile_id: "p1", expires_at: "2999-01-01" },
    profile: { id: "p1", email: "owner@cafemoon.com", platform_role: "USER" },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/services/restaurants", () => ({
  restaurantService: {
    mine: vi.fn().mockResolvedValue([mockRestaurant]),
    details: vi.fn().mockResolvedValue(mockDetails),
    analytics: vi.fn().mockResolvedValue({
      enabled: true,
      events: [
        {
          id: "ev-1",
          restaurant_id: "rest-1",
          event_type: "menu_view",
          created_at: "2026-10-12T10:00:00Z",
        },
      ],
    }),
    saveBranding: vi.fn().mockResolvedValue(mockDetails.branding),
    saveRestaurant: vi.fn().mockResolvedValue(mockRestaurant),
  },
}));

function renderDashboard(route = "/dashboard/overview") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/dashboard/:section?" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage Feature Modules Integration", () => {
  it("renders Overview section by default", async () => {
    renderDashboard("/dashboard/overview");
    expect(await screen.findByText("Total products", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("Menu readiness")).toBeInTheDocument();
    expect(screen.getByText("CAFE MOON")).toBeInTheDocument();
  });

  it("renders Menu section with products and categories", async () => {
    renderDashboard("/dashboard/menu");
    expect(await screen.findByText("V60 Drip")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search products…")).toBeInTheDocument();
  });

  it("renders Branding section with WCAG Contrast Audit", async () => {
    renderDashboard("/dashboard/branding");
    expect(await screen.findByText("Make it unmistakably yours")).toBeInTheDocument();
    expect(screen.getByText("WCAG 2.1 Contrast Audit")).toBeInTheDocument();
    expect(screen.getByText("Text on Background")).toBeInTheDocument();
  });

  it("renders Settings section with restaurant form", async () => {
    renderDashboard("/dashboard/settings");
    expect(await screen.findByText("Restaurant profile")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cafe Moon")).toBeInTheDocument();
  });

  it("renders Subscription section with plan details", async () => {
    renderDashboard("/dashboard/subscription");
    expect(await screen.findByText("CURRENT PLAN")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("renders Team section with members list and invite form", async () => {
    renderDashboard("/dashboard/team");
    expect(await screen.findByText("Add team member")).toBeInTheDocument();
    expect(screen.getByText("owner@cafemoon.com")).toBeInTheDocument();
  });
});
