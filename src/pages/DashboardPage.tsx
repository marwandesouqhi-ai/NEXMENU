import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { DashboardErrorBoundary } from "@/features/dashboard/common/DashboardErrorBoundary";
import OverviewSection from "@/features/dashboard/overview/OverviewSection";
import MenuSection from "@/features/dashboard/menu/MenuSection";
import QrSection from "@/features/dashboard/qr/QrSection";
import AnalyticsSection from "@/features/dashboard/analytics/AnalyticsSection";
import BrandingSection from "@/features/dashboard/branding/BrandingSection";
import SettingsSection from "@/features/dashboard/settings/SettingsSection";
import SubscriptionSection from "@/features/dashboard/subscription/SubscriptionSection";
import OffersSection from "@/features/dashboard/offers/OffersSection";
import BranchesSection from "@/features/dashboard/branches/BranchesSection";
import TeamSection from "@/features/dashboard/team/TeamSection";

export default function DashboardPage() {
  const { section = "overview" } = useParams();
  const navigate = useNavigate();
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
        action={{
          label: "Start Onboarding",
          onClick: () => navigate("/onboarding"),
        }}
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
      </DashboardErrorBoundary>
    </div>
  );
}
