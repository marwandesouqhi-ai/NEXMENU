import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, Package, QrCode as QrIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/States";
import { Stat } from "../common/Stat";

export function AnalyticsSection({ restaurantId }: { restaurantId: string }) {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["analytics", restaurantId],
    queryFn: () => restaurantService.analytics(session!, restaurantId),
  });
  const [now] = useState(() => Date.now());

  if (query.isLoading) return <LoadingState />;
  if (!query.data?.enabled) {
    return (
      <Card className="grid min-h-80 place-items-center p-8 text-center">
        <div className="max-w-sm">
          <BarChart3 className="mx-auto size-8 text-[var(--accent)]" />
          <h2 className="mt-4 text-xl font-black">Analytics unlocks on Basic</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Contact NEXMENU to switch plans. There is no online checkout.
          </p>
        </div>
      </Card>
    );
  }

  const grouped = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(now - (6 - offset) * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    return {
      day: date.toLocaleDateString("en", { weekday: "short" }),
      views: query.data!.events.filter(
        (item) => item.event_type === "menu_view" && item.created_at.slice(0, 10) === key,
      ).length,
      scans: query.data!.events.filter(
        (item) => item.event_type === "qr_scan" && item.created_at.slice(0, 10) === key,
      ).length,
    };
  });

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Menu views"
          value={query.data.events.filter((item) => item.event_type === "menu_view").length}
          icon={Eye}
        />
        <Stat
          label="QR scans"
          value={query.data.events.filter((item) => item.event_type === "qr_scan").length}
          icon={QrIcon}
        />
        <Stat
          label="Product views"
          value={query.data.events.filter((item) => item.event_type === "product_view").length}
          icon={Package}
        />
      </div>
      <Card className="p-5">
        <h2 className="font-black">Last 7 days</h2>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grouped}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="views" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="scans" fill="var(--gold)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

export default AnalyticsSection;
