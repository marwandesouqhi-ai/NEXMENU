import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { DashboardErrorBoundary } from "@/features/dashboard/common/DashboardErrorBoundary";

// Lazy load feature modules for code splitting and minimal bundle size
const OverviewSection = lazy(() => import("@/features/dashboard/overview/OverviewSection"));
const MenuSection = lazy(() => import("@/features/dashboard/menu/MenuSection"));
const QrSection = lazy(() => import("@/features/dashboard/qr/QrSection"));
const AnalyticsSection = lazy(() => import("@/features/dashboard/analytics/AnalyticsSection"));
const BrandingSection = lazy(() => import("@/features/dashboard/branding/BrandingSection"));
const SettingsSection = lazy(() => import("@/features/dashboard/settings/SettingsSection"));
const SubscriptionSection = lazy(
  () => import("@/features/dashboard/subscription/SubscriptionSection"),
);
const OffersSection = lazy(() => import("@/features/dashboard/offers/OffersSection"));
const BranchesSection = lazy(() => import("@/features/dashboard/branches/BranchesSection"));
const TeamSection = lazy(() => import("@/features/dashboard/team/TeamSection"));

export default function DashboardPage() {
  const { section = "overview" } = useParams();
  const { session } = useAuth();

  const mine = useQuery({
    queryKey: ["restaurants", "mine"],
    queryFn: () => restaurantService.mine(session!),
    enabled: Boolean(session),
  });

  const restaurant = mine.data?.[0];

  const details = useQuery({
    queryKey: ["restaurant", restaurant?.id],
    queryFn: () => restaurantService.details(session!, restaurant!.id),
    enabled: Boolean(session && restaurant),
  });

  if (mine.isLoading || details.isLoading) return <LoadingState />;
  if (mine.isError || details.isError) {
    return (
      <ErrorState
        body="Your restaurant workspace could not be loaded."
        retry={() => {
          void mine.refetch();
          void details.refetch();
        }}
      />
    );
  }
  if (!restaurant) {
    return (
      <EmptyState
        title="Create your first restaurant"
        body="Complete onboarding to publish your first digital menu."
      />
    );
  }
  if (!details.data) return <LoadingState />;

  const data = details.data;
  const title =
    section === "overview"
      ? `Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}`
      : section[0].toUpperCase() + section.slice(1);

  return (
    <div>
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[var(--accent)]">
            {restaurant.name_en.toUpperCase()}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-[-.04em] sm:text-4xl">{title}</h1>
        </div>
        <Badge className="w-fit">{restaurant.menu_status}</Badge>
      </div>

      <DashboardErrorBoundary>
        <Suspense fallback={<LoadingState label={`Loading ${section}…`} />}>
          {section === "overview" && <OverviewSection data={data} />}
          {section === "menu" && <MenuSection data={data} />}
          {section === "qr" && <QrSection data={data} />}
          {section === "analytics" && <AnalyticsSection restaurantId={restaurant.id} />}
          {section === "branding" && <BrandingSection branding={data.branding} />}
          {section === "settings" && <SettingsSection data={data} />}
          {section === "subscription" && <SubscriptionSection data={data} />}
          {section === "offers" && <OffersSection data={data} />}
          {section === "branches" && <BranchesSection data={data} />}
          {section === "team" && <TeamSection data={data} />}
        </Suspense>
      </DashboardErrorBoundary>
    </div>
  );
}
