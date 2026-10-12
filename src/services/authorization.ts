import type { DataAdapter } from "@/data/adapters/types";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { Role, Session } from "@/types/domain";

export type Permission =
  | "restaurant:read" | "restaurant:write" | "menu:create" | "menu:update"
  | "menu:delete" | "branding:write" | "team:write" | "analytics:read"
  | "qr:write" | "subscription:write" | "admin:access";
const matrix: Record<Role, Permission[]> = {
  SUPER_ADMIN: ["restaurant:read", "restaurant:write", "menu:create", "menu:update", "menu:delete", "branding:write", "team:write", "analytics:read", "qr:write", "subscription:write", "admin:access"],
  RESTAURANT_OWNER: ["restaurant:read", "restaurant:write", "menu:create", "menu:update", "menu:delete", "branding:write", "team:write", "analytics:read", "qr:write"],
  RESTAURANT_MANAGER: ["restaurant:read", "menu:create", "menu:update", "menu:delete", "analytics:read", "qr:write"],
  STAFF: ["restaurant:read", "menu:update"],
};
export interface AuthorizationContext { profileId: string; role: Role; restaurantIds: string[] }
export async function authorize(
  adapter: DataAdapter, session: Session | null, permission: Permission, restaurantId?: string,
): Promise<AuthorizationContext> {
  if (!session) throw new UnauthorizedError();
  const profile = await adapter.getProfile(session.profile_id);
  if (!profile) throw new UnauthorizedError();
  const isAdmin = profile.platform_role === "SUPER_ADMIN";
  const memberships = isAdmin ? [] : (await adapter.listMemberships())
    .filter((member) => member.profile_id === profile.id && member.status === "ACTIVE");
  const role: Role = isAdmin ? "SUPER_ADMIN" : (memberships.find((m) => !restaurantId || m.restaurant_id === restaurantId)?.role ?? "STAFF");
  const restaurantIds = isAdmin ? (await adapter.listRestaurants()).map((item) => item.id) : memberships.map((item) => item.restaurant_id);
  if (!matrix[role].includes(permission)) throw new ForbiddenError();
  if (restaurantId && !isAdmin && !restaurantIds.includes(restaurantId)) throw new ForbiddenError("This restaurant belongs to another tenant.");
  return { profileId: profile.id, role, restaurantIds };
}
export const can = (role: Role, permission: Permission) => matrix[role].includes(permission);
