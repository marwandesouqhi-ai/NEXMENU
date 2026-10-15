import { dataAdapter } from "@/data";
import { effectivePlan, PLANS } from "@/config/plans";
import { authorize } from "./authorization";
import { PlanLimitError, ValidationError, NotFoundError } from "@/lib/errors";
import { slugSchema } from "@/utils/slug";
import type {
  AnalyticsEvent, AuditLog, Branding, Branch, Category, Membership, Offer, Product,
  QrCode, Restaurant, RestaurantSettings, Session,
} from "@/types/domain";

const updated = <T extends { updated_at: string }>(value: T) => ({ ...value, updated_at: new Date().toISOString() });
async function audit(
  session: Session,
  restaurantId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, string | number | boolean>,
) {
  const auth = await authorize(dataAdapter, session, "restaurant:read", restaurantId);
  const now = new Date().toISOString();
  const value: AuditLog = {
    id: crypto.randomUUID(),
    restaurant_id: restaurantId,
    actor_profile_id: auth.profileId,
    actor_role: auth.role,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
    created_at: now,
    updated_at: now,
  };
  await dataAdapter.saveAuditLog(value);
}
export const restaurantService = {
  async mine(session: Session) {
    const auth = await authorize(dataAdapter, session, "restaurant:read");
    const all = await dataAdapter.listRestaurants();
    return all.filter((item) => auth.role === "SUPER_ADMIN" || auth.restaurantIds.includes(item.id));
  },
  async overview(session: Session, restaurantId: string) {
    await authorize(dataAdapter, session, "restaurant:read", restaurantId);
    const [restaurant, categories, products, events, subscription, logs] = await Promise.all([
      dataAdapter.getRestaurant(restaurantId), dataAdapter.listCategories(restaurantId),
      dataAdapter.listProducts(restaurantId), dataAdapter.listAnalytics(restaurantId),
      dataAdapter.getSubscription(restaurantId), dataAdapter.listAuditLogs(restaurantId),
    ]);
    return { restaurant, categories: categories.filter((item) => !item.deleted_at), products: products.filter((item) => !item.deleted_at), events, subscription, logs: logs.slice(-8).reverse() };
  },
  async details(session: Session, restaurantId: string) {
    await authorize(dataAdapter, session, "restaurant:read", restaurantId);
    const [restaurant, settings, branding, branches, categories, products, offers, subscription, members, notifications] = await Promise.all([
      dataAdapter.getRestaurant(restaurantId), dataAdapter.getSettings(restaurantId), dataAdapter.getBranding(restaurantId),
      dataAdapter.listBranches(restaurantId), dataAdapter.listCategories(restaurantId), dataAdapter.listProducts(restaurantId),
      dataAdapter.listOffers(restaurantId), dataAdapter.getSubscription(restaurantId), dataAdapter.listMemberships(),
      dataAdapter.listNotifications(restaurantId),
    ]);
    return { restaurant, settings, branding, branches, categories, products, offers, subscription, members: members.filter((item) => item.restaurant_id === restaurantId), notifications };
  },
  async createRestaurant(session: Session, input: Pick<Restaurant, "name_en" | "name_ar" | "slug" | "currency" | "cuisine_type">) {
    const auth = await authorize(dataAdapter, session, "restaurant:read");
    if (!slugSchema.safeParse(input.slug).success) throw new ValidationError("Choose a lowercase URL-safe slug.");
    if ((await dataAdapter.listRestaurants()).some((item) => item.slug === input.slug)) throw new ValidationError("That menu address is already in use.");
    const now = new Date().toISOString();
    const restaurant: Restaurant = { id: crypto.randomUUID(), ...input, description_en: "", description_ar: "", phone: "", whatsapp: "", address_en: "", address_ar: "", maps_url: "", website: "", instagram: "", facebook: "", timezone: "Africa/Cairo", menu_status: "DRAFT", status: "ACTIVE", created_at: now, updated_at: now };
    await dataAdapter.saveRestaurant(restaurant);
    const member: Membership = { id: crypto.randomUUID(), restaurant_id: restaurant.id, profile_id: auth.profileId, email: (await dataAdapter.getProfile(auth.profileId))?.email ?? "", role: "RESTAURANT_OWNER", status: "ACTIVE", created_at: now, updated_at: now };
    await dataAdapter.saveMembership(member);
    const emptyHours = Object.fromEntries(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => [day, { closed: false, shifts: [{ open: "09:00", close: "22:00" }] }]));
    await dataAdapter.saveSettings({ id: crypto.randomUUID(), restaurant_id: restaurant.id, opening_hours: emptyHours, default_locale: "en", created_at: now, updated_at: now });
    await dataAdapter.saveBranding({ id: crypto.randomUUID(), restaurant_id: restaurant.id, primary_color: "#176b4d", secondary_color: "#d7aa5c", background_color: "#f7f4ed", text_color: "#17221d", template: "Modern", radius: "rounded", theme: "light", font: "Inter", created_at: now, updated_at: now });
    await dataAdapter.saveSubscription({ id: crypto.randomUUID(), restaurant_id: restaurant.id, plan: "FREE", starts_at: now, expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(), status: "ACTIVE", notes: "", created_at: now, updated_at: now });
    await audit(session, restaurant.id, "restaurant.created", "restaurant", restaurant.id);
    return restaurant;
  },
  async saveRestaurant(session: Session, value: Restaurant) {
    await authorize(dataAdapter, session, "restaurant:write", value.id);
    const saved = await dataAdapter.saveRestaurant(updated(value));
    await audit(session, value.id, "restaurant.updated", "restaurant", value.id);
    return saved;
  },
  async saveSettings(session: Session, value: RestaurantSettings) {
    await authorize(dataAdapter, session, "restaurant:write", value.restaurant_id);
    return dataAdapter.saveSettings(updated(value));
  },
  async saveBranding(session: Session, value: Branding) {
    await authorize(dataAdapter, session, "branding:write", value.restaurant_id);
    const saved = await dataAdapter.saveBranding(updated(value));
    await audit(session, value.restaurant_id, "branding.changed", "branding", value.id);
    return saved;
  },
  async saveCategory(session: Session, value: Category, isNew = false) {
    await authorize(dataAdapter, session, isNew ? "menu:create" : "menu:update", value.restaurant_id);
    const saved = await dataAdapter.saveCategory(updated(value));
    await audit(session, value.restaurant_id, isNew ? "category.created" : "category.updated", "category", value.id);
    return saved;
  },
  async deleteCategory(session: Session, value: Category) {
    await authorize(dataAdapter, session, "menu:delete", value.restaurant_id);
    const saved = await dataAdapter.saveCategory({ ...updated(value), deleted_at: new Date().toISOString() });
    await audit(session, value.restaurant_id, "category.deleted", "category", value.id);
    return saved;
  },
  async reorderCategories(session: Session, restaurantId: string, orderedIds: string[]) {
    await authorize(dataAdapter, session, "menu:update", restaurantId);
    if (!Array.isArray(orderedIds)) throw new ValidationError("orderedIds must be an array of IDs.");
    const saved = await dataAdapter.reorderCategories(restaurantId, orderedIds);
    await audit(session, restaurantId, "categories.reordered", "category", undefined, { count: orderedIds.length });
    return saved;
  },
  async saveProduct(session: Session, value: Product, isNew = false) {
    await authorize(dataAdapter, session, isNew ? "menu:create" : "menu:update", value.restaurant_id);
    if (value.price < 0 || (value.compare_at_price !== undefined && value.compare_at_price <= value.price)) throw new ValidationError("Compare-at price must be higher than the current price.");
    if (isNew) {
      const subscription = await dataAdapter.getSubscription(value.restaurant_id);
      const plan = subscription ? effectivePlan(subscription.plan, subscription.expires_at) : "FREE";
      const count = (await dataAdapter.listProducts(value.restaurant_id)).filter((item) => !item.deleted_at).length;
      const limit = PLANS[plan].productLimit;
      if (limit !== null && count >= limit) throw new PlanLimitError(`${PLANS[plan].name} supports up to ${limit} products. Contact NEXMENU to change your plan.`);
    }
    const saved = await dataAdapter.saveProduct(updated(value));
    await audit(session, value.restaurant_id, isNew ? "product.created" : "product.updated", "product", value.id);
    return saved;
  },
  async uploadImage(session: Session, restaurantId: string, file: File) {
    await authorize(dataAdapter, session, "menu:update", restaurantId);
    return dataAdapter.uploadFile(file);
  },
  async deleteProduct(session: Session, value: Product) {
    await authorize(dataAdapter, session, "menu:delete", value.restaurant_id);
    const saved = await dataAdapter.saveProduct({ ...updated(value), deleted_at: new Date().toISOString() });
    await audit(session, value.restaurant_id, "product.deleted", "product", value.id);
    return saved;
  },
  async reorderProducts(session: Session, restaurantId: string, categoryId: string, orderedIds: string[]) {
    await authorize(dataAdapter, session, "menu:update", restaurantId);
    if (!Array.isArray(orderedIds)) throw new ValidationError("orderedIds must be an array of IDs.");
    const saved = await dataAdapter.reorderProducts(restaurantId, categoryId, orderedIds);
    await audit(session, restaurantId, "products.reordered", "product", undefined, { category_id: categoryId, count: orderedIds.length });
    return saved;
  },
  async duplicateProduct(session: Session, value: Product) {
    const now = new Date().toISOString();
    return this.saveProduct(session, { ...value, id: crypto.randomUUID(), name_en: `${value.name_en} copy`, sku: `${value.sku}-COPY`, created_at: now, updated_at: now }, true);
  },
  async saveOffer(session: Session, value: Offer, isNew = false) {
    await authorize(dataAdapter, session, isNew ? "menu:create" : "menu:update", value.restaurant_id);
    return dataAdapter.saveOffer(updated(value));
  },
  async saveBranch(session: Session, value: Branch, isNew = false) {
    await authorize(dataAdapter, session, "restaurant:write", value.restaurant_id);
    if (isNew) {
      const subscription = await dataAdapter.getSubscription(value.restaurant_id);
      const plan = subscription ? effectivePlan(subscription.plan, subscription.expires_at) : "FREE";
      const limit = PLANS[plan].branchLimit;
      if (limit !== null && (await dataAdapter.listBranches(value.restaurant_id)).length >= limit) throw new PlanLimitError(`${PLANS[plan].name} supports up to ${limit} branch.`);
    }
    return dataAdapter.saveBranch(updated(value));
  },
  async invite(session: Session, restaurantId: string, email: string, role: Membership["role"]) {
    await authorize(dataAdapter, session, "team:write", restaurantId);
    const member = await dataAdapter.inviteMember(restaurantId, email, role);
    await audit(session, restaurantId, "member.invited", "member", member.id, { email: member.email, role: member.role });
    return member;
  },
  async qr(session: Session, restaurantId: string, branchId?: string) {
    await authorize(dataAdapter, session, "qr:write", restaurantId);
    const restaurant = await dataAdapter.getRestaurant(restaurantId);
    if (!restaurant) throw new ValidationError("Restaurant was not found.");
    const branch = branchId ? (await dataAdapter.listBranches(restaurantId)).find((item) => item.id === branchId) : undefined;
    const origin =
      import.meta.env.VITE_PUBLIC_SITE_URL ||
      import.meta.env.VITE_SITE_URL ||
      import.meta.env.VITE_APP_ORIGIN ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const target = `${origin}/r/${restaurant.slug}${branch ? `?branch=${branch.slug}&src=qr` : "?src=qr"}`;
    const now = new Date().toISOString();
    const value: QrCode = { id: crypto.randomUUID(), restaurant_id: restaurantId, branch_id: branchId, target_url: target, created_at: now, updated_at: now };
    await dataAdapter.saveQrCode(value);
    await audit(session, restaurantId, "qr.generated", "qr_code", value.id);
    return value;
  },
  async analytics(session: Session, restaurantId: string) {
    await authorize(dataAdapter, session, "analytics:read", restaurantId);
    const subscription = await dataAdapter.getSubscription(restaurantId);
    const plan = subscription ? effectivePlan(subscription.plan, subscription.expires_at) : "FREE";
    return { enabled: PLANS[plan].analytics, events: await dataAdapter.listAnalytics(restaurantId) };
  },
  exportData: async (session: Session) => { await authorize(dataAdapter, session, "restaurant:read"); return dataAdapter.exportDatabase(); },
  importData: async (session: Session, value: Parameters<typeof dataAdapter.importDatabase>[0]) => { await authorize(dataAdapter, session, "admin:access"); return dataAdapter.importDatabase(value); },
  resetLocalData: async (session: Session) => { await authorize(dataAdapter, session, "admin:access"); return dataAdapter.reset(); },
};
export const publicMenuService = {
  get: async (slug: string, branch?: string) => (await dataAdapter.getPublicMenu(slug, branch)) ?? null,
  async track(input: Omit<AnalyticsEvent, "id" | "created_at" | "updated_at">) {
    if (navigator.doNotTrack === "1") return;
    const now = new Date().toISOString();
    await dataAdapter.saveAnalytics({ ...input, id: crypto.randomUUID(), created_at: now, updated_at: now });
  },
};
export const teamService = {
  async listMembers(session: Session, restaurantId: string) {
    await authorize(dataAdapter, session, "team:write", restaurantId);
    const [allMembers, allProfiles] = await Promise.all([
      dataAdapter.listMemberships(),
      dataAdapter.listProfiles(),
    ]);
    const profileMap = new Map(allProfiles.map((p) => [p.id, p]));
    return allMembers
      .filter((m) => m.restaurant_id === restaurantId)
      .map((m) => ({
        ...m,
        profile_name: m.profile_id ? profileMap.get(m.profile_id)?.name : undefined,
      }));
  },
  async updateRole(session: Session, restaurantId: string, memberId: string, role: Membership["role"]) {
    await authorize(dataAdapter, session, "team:write", restaurantId);
    const members = (await dataAdapter.listMemberships()).filter((m) => m.restaurant_id === restaurantId);
    const target = members.find((m) => m.id === memberId);
    if (!target) throw new NotFoundError("Member was not found.");
    if (target.role === "RESTAURANT_OWNER" && role !== "RESTAURANT_OWNER" && target.status === "ACTIVE") {
      const otherActiveOwners = members.filter((m) => m.id !== memberId && m.role === "RESTAURANT_OWNER" && m.status === "ACTIVE");
      if (otherActiveOwners.length === 0) {
        throw new ValidationError("Cannot demote the last active owner of a restaurant.");
      }
    }
    const saved = await dataAdapter.saveMembership({ ...updated(target), role });
    await audit(session, restaurantId, "member.role_changed", "membership", target.id, { new_role: role });
    return saved;
  },
  async setStatus(session: Session, restaurantId: string, memberId: string, status: Membership["status"]) {
    await authorize(dataAdapter, session, "team:write", restaurantId);
    const members = (await dataAdapter.listMemberships()).filter((m) => m.restaurant_id === restaurantId);
    const target = members.find((m) => m.id === memberId);
    if (!target) throw new NotFoundError("Member was not found.");
    if (target.role === "RESTAURANT_OWNER" && status !== "ACTIVE" && target.status === "ACTIVE") {
      const otherActiveOwners = members.filter((m) => m.id !== memberId && m.role === "RESTAURANT_OWNER" && m.status === "ACTIVE");
      if (otherActiveOwners.length === 0) {
        throw new ValidationError("Cannot deactivate the last active owner of a restaurant.");
      }
    }
    const saved = await dataAdapter.saveMembership({ ...updated(target), status });
    await audit(session, restaurantId, status === "ACTIVE" ? "member.activated" : "member.deactivated", "membership", target.id);
    return saved;
  },
  async removeMember(session: Session, restaurantId: string, memberId: string) {
    await authorize(dataAdapter, session, "team:write", restaurantId);
    const members = (await dataAdapter.listMemberships()).filter((m) => m.restaurant_id === restaurantId);
    const target = members.find((m) => m.id === memberId);
    if (!target) throw new NotFoundError("Member was not found.");
    if (target.role === "RESTAURANT_OWNER" && target.status === "ACTIVE") {
      const otherActiveOwners = members.filter((m) => m.id !== memberId && m.role === "RESTAURANT_OWNER" && m.status === "ACTIVE");
      if (otherActiveOwners.length === 0) {
        throw new ValidationError("Cannot remove the last active owner of a restaurant.");
      }
    }
    await dataAdapter.deleteMembership(memberId);
    await audit(session, restaurantId, "member.removed", "membership", memberId);
  },
  async invite(session: Session, restaurantId: string, email: string, role: Membership["role"]) {
    await authorize(dataAdapter, session, "team:write", restaurantId);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) throw new ValidationError("Provide a valid email address.");
    const members = (await dataAdapter.listMemberships()).filter((m) => m.restaurant_id === restaurantId);
    if (members.some((m) => m.email.toLowerCase() === cleanEmail)) {
      throw new ValidationError("A member with this email already exists for this restaurant.");
    }
    const profile = (await dataAdapter.listProfiles()).find((item) => item.email.toLowerCase() === cleanEmail);
    const now = new Date().toISOString();
    const value: Membership = {
      id: crypto.randomUUID(),
      restaurant_id: restaurantId,
      profile_id: profile?.id,
      email: cleanEmail,
      role,
      status: profile ? "ACTIVE" : "PENDING",
      created_at: now,
      updated_at: now,
    };
    const saved = await dataAdapter.saveMembership(value);
    await audit(session, restaurantId, "member.invited", "membership", saved.id, { email: cleanEmail, role });
    return saved;
  },
};

export { adminService, type AuditLogFilters } from "@admin/services/adminService";
