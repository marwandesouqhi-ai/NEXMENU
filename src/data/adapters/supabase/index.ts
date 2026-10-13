import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthResult, DataAdapter } from "../types";
import type {
  AnalyticsEvent,
  AuditLog,
  Branding,
  Branch,
  Category,
  DatabaseExport,
  Membership,
  Notification,
  Offer,
  Product,
  Profile,
  PublicMenu,
  QrCode,
  Restaurant,
  RestaurantSettings,
  Session,
  Subscription,
} from "@/types/domain";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { PLANS, effectivePlan } from "@/config/plans";

export interface SupabaseAdapterOptions {
  url?: string;
  anonKey?: string;
  client?: SupabaseClient;
}

export class SupabaseAdapter implements DataAdapter {
  private client: SupabaseClient;

  constructor(options?: SupabaseAdapterOptions) {
    if (options?.client) {
      this.client = options.client;
      return;
    }

    const url = options?.url ?? import.meta.env.VITE_SUPABASE_URL;
    const anonKey =
      options?.anonKey ??
      import.meta.env.VITE_SUPABASE_ANON_KEY ??
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const isTest = import.meta.env.MODE === "test";
    const clientOptions = {
      auth: {
        persistSession: !isTest,
        autoRefreshToken: !isTest,
        detectSessionInUrl: !isTest,
        ...(isTest ? { storageKey: `sb-test-${Math.random().toString(36).slice(2)}` } : {}),
      },
    };

    if (!url || !anonKey) {
      // In dev/test when variables are missing, provide a dummy client fallback or descriptive warning
      this.client = createClient(
        url || "https://placeholder-nexmenu.supabase.co",
        anonKey || "placeholder-anon-key",
        clientOptions,
      );
      return;
    }

    this.client = createClient(url, anonKey, clientOptions);
  }

  async initialize(): Promise<void> {
    // Session state is managed by Supabase Auth automatically.
  }

  async signUp(input: { email: string; password: string; name: string }): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name } },
    });

    if (error || !data.user) {
      throw new ValidationError(error?.message ?? "Failed to create account.");
    }

    const now = new Date().toISOString();
    const profile: Profile = {
      id: data.user.id,
      email: input.email.toLowerCase(),
      name: input.name,
      platform_role: undefined,
      password_hash: "",
      password_salt: "",
      email_verified: Boolean(data.user.email_confirmed_at),
      created_at: now,
      updated_at: now,
    };

    const session: Session = {
      id: data.session?.access_token ?? `sess-${data.user.id}`,
      profile_id: data.user.id,
      expires_at: data.session?.expires_at
        ? new Date(data.session.expires_at * 1000).toISOString()
        : new Date(Date.now() + 30 * 86_400_000).toISOString(),
    };

    return { profile, session };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      throw new ValidationError("Email or password is incorrect.");
    }

    const profile = await this.getProfile(data.user.id);
    if (!profile) {
      throw new NotFoundError("User profile was not found.");
    }

    const session: Session = {
      id: data.session.access_token,
      profile_id: data.user.id,
      expires_at: new Date(data.session.expires_at! * 1000).toISOString(),
    };

    return { profile, session };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session) return null;

    if (data.session.expires_at && data.session.expires_at * 1000 < Date.now()) {
      return null;
    }

    return {
      id: data.session.access_token,
      profile_id: data.session.user.id,
      expires_at: data.session.expires_at
        ? new Date(data.session.expires_at * 1000).toISOString()
        : new Date(Date.now() + 30 * 86_400_000).toISOString(),
    };
  }

  async requestPasswordReset(email: string): Promise<string> {
    const { error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) {
      throw new ValidationError(error.message);
    }
    return "Password reset link sent to your email.";
  }

  async resetPassword(_email: string, _code: string, password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) {
      throw new ValidationError(error.message);
    }
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return undefined;
    return data as Profile;
  }

  async listProfiles(): Promise<Profile[]> {
    const { data, error } = await this.client.from("profiles").select("*");
    if (error || !data) return [];
    return data as Profile[];
  }

  async listRestaurants(): Promise<Restaurant[]> {
    const { data, error } = await this.client
      .from("restaurants")
      .select("*")
      .is("deleted_at", null);
    if (error || !data) return [];
    return data as Restaurant[];
  }

  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    const { data, error } = await this.client
      .from("restaurants")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return undefined;
    return data as Restaurant;
  }

  async saveRestaurant(value: Restaurant): Promise<Restaurant> {
    const { data, error } = await this.client
      .from("restaurants")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save restaurant.");
    return data as Restaurant;
  }

  async listMemberships(): Promise<Membership[]> {
    const { data, error } = await this.client.from("restaurant_members").select("*");
    if (error || !data) return [];
    return data as Membership[];
  }

  async saveMembership(value: Membership): Promise<Membership> {
    const { data, error } = await this.client
      .from("restaurant_members")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save membership.");
    return data as Membership;
  }

  async deleteMembership(id: string): Promise<void> {
    const { error } = await this.client.from("restaurant_members").delete().eq("id", id);
    if (error) throw new ValidationError(error.message);
  }

  async getSettings(restaurantId: string): Promise<RestaurantSettings | undefined> {
    const { data, error } = await this.client
      .from("restaurant_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (error || !data) return undefined;
    return data as RestaurantSettings;
  }

  async saveSettings(value: RestaurantSettings): Promise<RestaurantSettings> {
    const { data, error } = await this.client
      .from("restaurant_settings")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save settings.");
    return data as RestaurantSettings;
  }

  async getBranding(restaurantId: string): Promise<Branding | undefined> {
    const { data, error } = await this.client
      .from("restaurant_branding")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (error || !data) return undefined;
    return data as Branding;
  }

  async saveBranding(value: Branding): Promise<Branding> {
    const { data, error } = await this.client
      .from("restaurant_branding")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save branding.");
    return data as Branding;
  }

  async listBranches(restaurantId: string): Promise<Branch[]> {
    const { data, error } = await this.client
      .from("branches")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .is("deleted_at", null);
    if (error || !data) return [];
    return data as Branch[];
  }

  async saveBranch(value: Branch): Promise<Branch> {
    const { data, error } = await this.client
      .from("branches")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save branch.");
    return data as Branch;
  }

  async listCategories(restaurantId: string): Promise<Category[]> {
    const { data, error } = await this.client
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return data as Category[];
  }

  async saveCategory(value: Category): Promise<Category> {
    const { data, error } = await this.client
      .from("categories")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save category.");
    return data as Category;
  }

  async reorderCategories(restaurantId: string, orderedIds: string[]): Promise<Category[]> {
    const { data: rpcData, error: rpcErr } = await this.client.rpc("reorder_categories", {
      p_restaurant_id: restaurantId,
      p_category_ids: orderedIds,
    });
    if (!rpcErr && Array.isArray(rpcData)) {
      return rpcData as Category[];
    }

    const all = await this.listCategories(restaurantId);
    const catMap = new Map(all.map((c) => [c.id, c]));

    for (const id of orderedIds) {
      if (!catMap.has(id)) {
        throw new ValidationError(`Category ${id} does not belong to this restaurant or does not exist.`);
      }
    }

    const updates: Category[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < orderedIds.length; i++) {
      const cat = catMap.get(orderedIds[i])!;
      updates.push({ ...cat, sort_order: i, updated_at: now });
    }

    const unmentioned = all.filter((c) => !orderedIds.includes(c.id));
    for (let i = 0; i < unmentioned.length; i++) {
      updates.push({ ...unmentioned[i], sort_order: orderedIds.length + i, updated_at: now });
    }

    const { data, error } = await this.client
      .from("categories")
      .upsert(updates)
      .select();

    if (error || !data) throw new ValidationError(error?.message ?? "Failed to reorder categories.");
    return (data as Category[]).sort((a, b) => a.sort_order - b.sort_order);
  }

  async listProducts(restaurantId: string): Promise<Product[]> {
    const { data, error } = await this.client
      .from("products")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return data as Product[];
  }

  async saveProduct(value: Product): Promise<Product> {
    const { data, error } = await this.client
      .from("products")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save product.");
    return data as Product;
  }

  async reorderProducts(
    restaurantId: string,
    categoryId: string,
    orderedIds: string[],
  ): Promise<Product[]> {
    const { data: rpcData, error: rpcErr } = await this.client.rpc("reorder_products", {
      p_restaurant_id: restaurantId,
      p_category_id: categoryId,
      p_product_ids: orderedIds,
    });
    if (!rpcErr && Array.isArray(rpcData)) {
      return rpcData as Product[];
    }

    const all = await this.listProducts(restaurantId);
    const categoryProds = all.filter((p) => p.category_id === categoryId);
    const prodMap = new Map(categoryProds.map((p) => [p.id, p]));

    for (const id of orderedIds) {
      if (!prodMap.has(id)) {
        throw new ValidationError(
          `Product ${id} does not belong to category ${categoryId} or does not exist.`,
        );
      }
    }

    const updates: Product[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < orderedIds.length; i++) {
      const prod = prodMap.get(orderedIds[i])!;
      updates.push({ ...prod, sort_order: i, updated_at: now });
    }

    const unmentioned = categoryProds.filter((p) => !orderedIds.includes(p.id));
    for (let i = 0; i < unmentioned.length; i++) {
      updates.push({ ...unmentioned[i], sort_order: orderedIds.length + i, updated_at: now });
    }

    const { data, error } = await this.client
      .from("products")
      .upsert(updates)
      .select();

    if (error || !data) throw new ValidationError(error?.message ?? "Failed to reorder products.");
    return (data as Product[]).sort((a, b) => a.sort_order - b.sort_order);
  }

  async listOffers(restaurantId: string): Promise<Offer[]> {
    const { data, error } = await this.client
      .from("offers")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .is("deleted_at", null);
    if (error || !data) return [];
    return data as Offer[];
  }

  async saveOffer(value: Offer): Promise<Offer> {
    const { data, error } = await this.client
      .from("offers")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save offer.");
    return data as Offer;
  }

  async listQrCodes(restaurantId: string): Promise<QrCode[]> {
    const { data, error } = await this.client
      .from("qr_codes")
      .select("*")
      .eq("restaurant_id", restaurantId);
    if (error || !data) return [];
    return data as QrCode[];
  }

  async saveQrCode(value: QrCode): Promise<QrCode> {
    const { data, error } = await this.client
      .from("qr_codes")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save QR code.");
    return data as QrCode;
  }

  async listAnalytics(restaurantId?: string): Promise<AnalyticsEvent[]> {
    let query = this.client.from("analytics_events").select("*");
    if (restaurantId) query = query.eq("restaurant_id", restaurantId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as AnalyticsEvent[];
  }

  async saveAnalytics(value: AnalyticsEvent): Promise<AnalyticsEvent> {
    const { data, error } = await this.client
      .from("analytics_events")
      .insert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save analytics event.");
    return data as AnalyticsEvent;
  }

  async listSubscriptions(): Promise<Subscription[]> {
    const { data, error } = await this.client.from("subscriptions").select("*");
    if (error || !data) return [];
    return data as Subscription[];
  }

  async getSubscription(restaurantId: string): Promise<Subscription | undefined> {
    const { data, error } = await this.client
      .from("subscriptions")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (error || !data) return undefined;
    return data as Subscription;
  }

  async saveSubscription(value: Subscription): Promise<Subscription> {
    const starts = value.start_date || value.starts_at;
    const expires = value.end_date || value.expires_at;

    if (starts && expires && new Date(expires).getTime() < new Date(starts).getTime()) {
      throw new ValidationError("Subscription end date cannot be earlier than start date.");
    }

    const payload: Subscription = {
      ...value,
      starts_at: starts,
      expires_at: expires,
      start_date: starts,
      end_date: expires,
      notes: value.notes ?? "",
    };

    const { data, error } = await this.client
      .from("subscriptions")
      .upsert(payload)
      .select()
      .single();

    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save subscription.");
    return data as Subscription;
  }

  async listNotifications(restaurantId: string): Promise<Notification[]> {
    const { data, error } = await this.client
      .from("notifications")
      .select("*")
      .eq("restaurant_id", restaurantId);
    if (error || !data) return [];
    return data as Notification[];
  }

  async saveNotification(value: Notification): Promise<Notification> {
    const { data, error } = await this.client
      .from("notifications")
      .upsert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save notification.");
    return data as Notification;
  }

  async listAuditLogs(restaurantId?: string): Promise<AuditLog[]> {
    let query = this.client.from("audit_logs").select("*");
    if (restaurantId) query = query.eq("restaurant_id", restaurantId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as AuditLog[];
  }

  async saveAuditLog(value: AuditLog): Promise<AuditLog> {
    const { data, error } = await this.client
      .from("audit_logs")
      .insert(value)
      .select()
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "Failed to save audit log.");
    return data as AuditLog;
  }

  async getPublicMenu(slug: string, branchSlug?: string): Promise<PublicMenu | undefined> {
    const { data: rpcData, error: rpcErr } = await this.client.rpc("get_public_menu", {
      menu_slug: slug,
      branch_slug: branchSlug ?? null,
    });

    if (!rpcErr && rpcData && typeof rpcData === "object" && "restaurant" in rpcData) {
      const payload = rpcData as unknown as PublicMenu & {
        subscription?: Subscription;
      };
      const plan = payload.subscription
        ? effectivePlan(payload.subscription.plan, payload.subscription.expires_at)
        : "FREE";
      return {
        ...payload,
        show_nexmenu_branding: !PLANS[plan].hideBranding,
      };
    }

    const { data: restaurant, error: restErr } = await this.client
      .from("restaurants")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (restErr || !restaurant) return undefined;

    const [settings, branding, branches, categories, products, offers, subscription] =
      await Promise.all([
        this.getSettings(restaurant.id),
        this.getBranding(restaurant.id),
        this.listBranches(restaurant.id),
        this.listCategories(restaurant.id),
        this.listProducts(restaurant.id),
        this.listOffers(restaurant.id),
        this.getSubscription(restaurant.id),
      ]);

    if (!settings || !branding) return undefined;

    const branch = branchSlug
      ? branches.find((b) => b.slug === branchSlug || b.id === branchSlug)
      : branches[0];

    const visibleCategories = categories
      .filter((item) => item.is_visible && !item.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order);

    const categoryIds = new Set(visibleCategories.map((item) => item.id));

    const publicProducts = products
      .filter(
        (item) =>
          item.is_visible &&
          !item.deleted_at &&
          categoryIds.has(item.category_id) &&
          !branch?.hidden_product_ids.includes(item.id),
      )
      .sort((a, b) => a.sort_order - b.sort_order);

    const now = new Date();
    const activeOffers = offers.filter(
      (item) => item.is_active && new Date(item.starts_at) <= now && new Date(item.ends_at) > now,
    );

    const plan = subscription ? effectivePlan(subscription.plan, subscription.expires_at) : "FREE";

    return {
      restaurant,
      settings,
      branding,
      branch,
      branches,
      categories: visibleCategories,
      products: publicProducts,
      offers: activeOffers,
      show_nexmenu_branding: !PLANS[plan].hideBranding,
    };
  }

  async uploadFile(file: File): Promise<string> {
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new ValidationError("Use a JPG, PNG or WebP image smaller than 5MB.");
    }

    const ext = file.name.split(".").pop() ?? "webp";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const path = `uploads/${filename}`;

    const { error } = await this.client.storage
      .from("restaurant-assets")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (error) {
      throw new ValidationError(error.message);
    }

    const { data } = this.client.storage.from("restaurant-assets").getPublicUrl(path);
    return data.publicUrl;
  }

  async deleteFile(url: string): Promise<void> {
    const parts = url.split("/restaurant-assets/");
    if (parts.length > 1) {
      const path = parts[1];
      await this.client.storage.from("restaurant-assets").remove([path]);
    }
  }

  async exportDatabase(): Promise<DatabaseExport> {
    const [
      profiles,
      restaurants,
      members,
      settings,
      branding,
      branches,
      categories,
      products,
      offers,
      qr_codes,
      analytics_events,
      subscriptions,
      notifications,
      audit_logs,
    ] = await Promise.all([
      this.listProfiles(),
      this.listRestaurants(),
      this.listMemberships(),
      this.client.from("restaurant_settings").select("*").then((r) => r.data ?? []),
      this.client.from("restaurant_branding").select("*").then((r) => r.data ?? []),
      this.client.from("branches").select("*").then((r) => r.data ?? []),
      this.client.from("categories").select("*").then((r) => r.data ?? []),
      this.client.from("products").select("*").then((r) => r.data ?? []),
      this.client.from("offers").select("*").then((r) => r.data ?? []),
      this.client.from("qr_codes").select("*").then((r) => r.data ?? []),
      this.listAnalytics(),
      this.listSubscriptions(),
      this.client.from("notifications").select("*").then((r) => r.data ?? []),
      this.listAuditLogs(),
    ]);

    return {
      version: 1,
      exported_at: new Date().toISOString(),
      data: {
        profiles,
        restaurants,
        members,
        settings,
        branding,
        branches,
        categories,
        products,
        offers,
        qr_codes,
        analytics_events,
        subscriptions,
        notifications,
        audit_logs,
      },
    };
  }

  async importDatabase(value: DatabaseExport): Promise<void> {
    if (value.version !== 1) {
      throw new ValidationError("Unsupported NEXMENU export version.");
    }

    const tableMapping: Record<string, string> = {
      profiles: "profiles",
      restaurants: "restaurants",
      members: "restaurant_members",
      settings: "restaurant_settings",
      branding: "restaurant_branding",
      branches: "branches",
      categories: "categories",
      products: "products",
      offers: "offers",
      qr_codes: "qr_codes",
      analytics_events: "analytics_events",
      subscriptions: "subscriptions",
      notifications: "notifications",
      audit_logs: "audit_logs",
    };

    for (const [store, table] of Object.entries(tableMapping)) {
      const records = value.data[store as keyof typeof value.data];
      if (Array.isArray(records) && records.length > 0) {
        const { error } = await this.client.from(table).upsert(records);
        if (error) {
          throw new ValidationError(`Failed to import ${store}: ${error.message}`);
        }
      }
    }
  }

  async reset(): Promise<void> {
    // No-op for remote database
  }
}
