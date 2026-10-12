import type { restaurantService } from "@/services/restaurants";

export type DashboardDetails = NonNullable<Awaited<ReturnType<typeof restaurantService.details>>>;
