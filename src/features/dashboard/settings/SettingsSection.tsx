import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/States";
import type { DashboardDetails } from "../types";

export function SettingsSection({ data }: { data: DashboardDetails }) {
  const { session } = useAuth();
  const client = useQueryClient();
  const [restaurant, setRestaurant] = useState(data.restaurant);

  if (!restaurant) return <ErrorState body="Restaurant settings are missing." />;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    await restaurantService.saveRestaurant(session!, restaurant);
    await client.invalidateQueries({ queryKey: ["restaurant", restaurant.id] });
  };

  return (
    <form onSubmit={(event) => void save(event)} className="grid gap-6">
      <Card className="p-6">
        <h2 className="text-xl font-black">Restaurant profile</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Public contact links only. WhatsApp does not create an order flow.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Input
            label="English name"
            value={restaurant.name_en}
            onChange={(e) => setRestaurant({ ...restaurant, name_en: e.target.value })}
          />
          <Input
            label="Arabic name"
            value={restaurant.name_ar}
            onChange={(e) => setRestaurant({ ...restaurant, name_ar: e.target.value })}
          />
          <Input
            label="Phone"
            value={restaurant.phone}
            onChange={(e) => setRestaurant({ ...restaurant, phone: e.target.value })}
          />
          <Input
            label="WhatsApp contact"
            value={restaurant.whatsapp}
            onChange={(e) => setRestaurant({ ...restaurant, whatsapp: e.target.value })}
          />
          <Input
            label="Address"
            value={restaurant.address_en}
            onChange={(e) => setRestaurant({ ...restaurant, address_en: e.target.value })}
          />
          <Input
            label="Google Maps URL"
            type="url"
            value={restaurant.maps_url}
            onChange={(e) => setRestaurant({ ...restaurant, maps_url: e.target.value })}
          />
          <Input
            label="Website"
            type="url"
            value={restaurant.website}
            onChange={(e) => setRestaurant({ ...restaurant, website: e.target.value })}
          />
          <label className="grid gap-2 text-sm font-bold">
            Menu status
            <select
              value={restaurant.menu_status}
              onChange={(e) =>
                setRestaurant({
                  ...restaurant,
                  menu_status: e.target.value as typeof restaurant.menu_status,
                })
              }
              className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3"
            >
              <option>DRAFT</option>
              <option>PUBLISHED</option>
              <option>PAUSED</option>
            </select>
          </label>
        </div>
        <Button type="submit" className="mt-6">
          Save changes
        </Button>
      </Card>
    </form>
  );
}

export default SettingsSection;
