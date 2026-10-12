import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DataAdapter, AuthResult, StoreName } from "../types";
import type {
  AnalyticsEvent, AuditLog, Branding, Branch, Category, DatabaseExport, Membership,
  Notification, Offer, Product, Profile, PublicMenu, QrCode, Restaurant,
  RestaurantSettings, Session, Subscription,
} from "@/types/domain";
import { hashPassword } from "./crypto";
import { createSeed } from "./seed";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { PLANS, effectivePlan } from "@/config/plans";

type Value = Profile | Restaurant | Membership | RestaurantSettings | Branding | Branch | Category |
  Product | Offer | QrCode | AnalyticsEvent | Subscription | Notification | AuditLog | Session |
  { id: string; value: string } | { id: string; blob: Blob };
interface LocalSchema extends DBSchema {
  profiles: { key: string; value: Profile };
  restaurants: { key: string; value: Restaurant };
  members: { key: string; value: Membership };
  settings: { key: string; value: RestaurantSettings };
  branding: { key: string; value: Branding };
  branches: { key: string; value: Branch };
  categories: { key: string; value: Category };
  products: { key: string; value: Product };
  offers: { key: string; value: Offer };
  qr_codes: { key: string; value: QrCode };
  analytics_events: { key: string; value: AnalyticsEvent };
  subscriptions: { key: string; value: Subscription };
  notifications: { key: string; value: Notification };
  audit_logs: { key: string; value: AuditLog };
  sessions: { key: string; value: Session };
  meta: { key: string; value: { id: string; value: string } };
  files: { key: string; value: { id: string; blob: Blob } };
}
const stores: StoreName[] = ["profiles", "restaurants", "members", "settings", "branding", "branches", "categories", "products", "offers", "qr_codes", "analytics_events", "subscriptions", "notifications", "audit_logs"];
const cleanProfile = ({ password_hash: _hash, password_salt: _salt, ...profile }: Profile) => profile;

export class LocalAdapter implements DataAdapter {
  private db?: IDBPDatabase<LocalSchema>;
  private async database() {
    if (!this.db) this.db = await openDB<LocalSchema>("nexmenu-local", 1, {
      upgrade(db) {
        for (const store of [...stores, "sessions", "meta", "files"] as const) db.createObjectStore(store, { keyPath: "id" });
      },
    });
    return this.db;
  }
  async initialize() {
    const db = await this.database();
    if (await db.get("meta", "seeded")) return;
    const seed = await createSeed();
    const transaction = db.transaction(stores, "readwrite");
    for (const [name, values] of Object.entries(seed)) {
      for (const value of values) await transaction.objectStore(name as StoreName).put(value as never);
    }
    await transaction.done;
    await db.put("meta", { id: "seeded", value: "true" });
  }
  private async all<T extends Value>(store: StoreName) { return (await (await this.database()).getAll(store)) as T[]; }
  private async put<T extends Value>(store: StoreName, value: T) {
    await (await this.database()).put(store, value as never);
    return value;
  }
  async signUp(input: { email: string; password: string; name: string }): Promise<AuthResult> {
    const db = await this.database();
    const email = input.email.trim().toLowerCase();
    if ((await this.listProfiles()).some((profile) => profile.email === email)) throw new ValidationError("An account with this email already exists.");
    if (input.password.length < 8) throw new ValidationError("Password must contain at least 8 characters.");
    const password = await hashPassword(input.password);
    const now = new Date().toISOString();
    const profile: Profile = { id: crypto.randomUUID(), email, name: input.name.trim(), password_hash: password.hash, password_salt: password.salt, email_verified: false, created_at: now, updated_at: now };
    await db.put("profiles", profile);
    const pending = (await this.listMemberships()).filter((member) => member.email === email && member.status === "PENDING");
    for (const member of pending) await db.put("members", { ...member, profile_id: profile.id, status: "ACTIVE", updated_at: now });
    const session = await this.makeSession(profile.id);
    return { profile: cleanProfile(profile), session };
  }
  async signIn(email: string, password: string): Promise<AuthResult> {
    const profile = (await this.listProfiles()).find((item) => item.email === email.trim().toLowerCase());
    if (!profile) throw new ValidationError("Email or password is incorrect.");
    const candidate = await hashPassword(password, profile.password_salt);
    if (candidate.hash !== profile.password_hash) throw new ValidationError("Email or password is incorrect.");
    const session = await this.makeSession(profile.id);
    return { profile: cleanProfile(profile), session };
  }
  private async makeSession(profileId: string) {
    const db = await this.database();
    await db.clear("sessions");
    const session: Session = { id: "current", profile_id: profileId, expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() };
    await db.put("sessions", session);
    return session;
  }
  async signOut() { await (await this.database()).clear("sessions"); }
  async getSession() {
    const session = await (await this.database()).get("sessions", "current");
    if (!session || new Date(session.expires_at).getTime() < Date.now()) return null;
    return session;
  }
  async requestPasswordReset(email: string) {
    const profile = (await this.listProfiles()).find((item) => item.email === email.toLowerCase());
    if (!profile) throw new NotFoundError("No local account uses that email.");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await (await this.database()).put("meta", { id: `reset:${email.toLowerCase()}`, value: code });
    return code;
  }
  async resetPassword(email: string, code: string, password: string) {
    const db = await this.database();
    const saved = await db.get("meta", `reset:${email.toLowerCase()}`);
    if (!saved || saved.value !== code) throw new ValidationError("The development reset code is invalid.");
    const profile = (await this.listProfiles()).find((item) => item.email === email.toLowerCase());
    if (!profile) throw new NotFoundError();
    const next = await hashPassword(password);
    await db.put("profiles", { ...profile, password_hash: next.hash, password_salt: next.salt, updated_at: new Date().toISOString() });
    await db.delete("meta", saved.id);
  }
  async getProfile(id: string) { return (await this.database()).get("profiles", id); }
  async listProfiles() { return this.all<Profile>("profiles"); }
  async listRestaurants() { return this.all<Restaurant>("restaurants"); }
  async getRestaurant(id: string) { return (await this.database()).get("restaurants", id); }
  async saveRestaurant(value: Restaurant) { return this.put("restaurants", value); }
  async listMemberships() { return this.all<Membership>("members"); }
  async saveMembership(value: Membership) { return this.put("members", value); }
  async deleteMembership(id: string) { await (await this.database()).delete("members", id); }
  async getSettings(restaurantId: string) { return (await this.all<RestaurantSettings>("settings")).find((item) => item.restaurant_id === restaurantId); }
  async saveSettings(value: RestaurantSettings) { return this.put("settings", value); }
  async getBranding(restaurantId: string) { return (await this.all<Branding>("branding")).find((item) => item.restaurant_id === restaurantId); }
  async saveBranding(value: Branding) { return this.put("branding", value); }
  async listBranches(restaurantId: string) { return (await this.all<Branch>("branches")).filter((item) => item.restaurant_id === restaurantId); }
  async saveBranch(value: Branch) { return this.put("branches", value); }
  async listCategories(restaurantId: string) { return (await this.all<Category>("categories")).filter((item) => item.restaurant_id === restaurantId); }
  async saveCategory(value: Category) { return this.put("categories", value); }
  async listProducts(restaurantId: string) { return (await this.all<Product>("products")).filter((item) => item.restaurant_id === restaurantId); }
  async saveProduct(value: Product) { return this.put("products", value); }
  async listOffers(restaurantId: string) { return (await this.all<Offer>("offers")).filter((item) => item.restaurant_id === restaurantId); }
  async saveOffer(value: Offer) { return this.put("offers", value); }
  async listQrCodes(restaurantId: string) { return (await this.all<QrCode>("qr_codes")).filter((item) => item.restaurant_id === restaurantId); }
  async saveQrCode(value: QrCode) { return this.put("qr_codes", value); }
  async listAnalytics(restaurantId?: string) { const all = await this.all<AnalyticsEvent>("analytics_events"); return restaurantId ? all.filter((item) => item.restaurant_id === restaurantId) : all; }
  async saveAnalytics(value: AnalyticsEvent) { return this.put("analytics_events", value); }
  async getSubscription(restaurantId: string) { return (await this.all<Subscription>("subscriptions")).find((item) => item.restaurant_id === restaurantId); }
  async saveSubscription(value: Subscription) { return this.put("subscriptions", value); }
  async listNotifications(restaurantId: string) { return (await this.all<Notification>("notifications")).filter((item) => item.restaurant_id === restaurantId); }
  async saveNotification(value: Notification) { return this.put("notifications", value); }
  async listAuditLogs(restaurantId?: string) { const all = await this.all<AuditLog>("audit_logs"); return restaurantId ? all.filter((item) => item.restaurant_id === restaurantId) : all; }
  async saveAuditLog(value: AuditLog) { return this.put("audit_logs", value); }
  async getPublicMenu(slug: string, branchSlug?: string): Promise<PublicMenu | undefined> {
    const restaurant = (await this.listRestaurants()).find((item) => item.slug === slug && !item.deleted_at);
    if (!restaurant) return undefined;
    const [settings, branding, branches, categories, products, offers, subscription] = await Promise.all([
      this.getSettings(restaurant.id), this.getBranding(restaurant.id), this.listBranches(restaurant.id),
      this.listCategories(restaurant.id), this.listProducts(restaurant.id), this.listOffers(restaurant.id), this.getSubscription(restaurant.id),
    ]);
    if (!settings || !branding) return undefined;
    const branch = branchSlug ? branches.find((item) => item.slug === branchSlug || item.id === branchSlug) : branches[0];
    const visibleCategories = categories.filter((item) => item.is_visible && !item.deleted_at).sort((a, b) => a.sort_order - b.sort_order);
    const categoryIds = new Set(visibleCategories.map((item) => item.id));
    const publicProducts = products.filter((item) => item.is_visible && !item.deleted_at && categoryIds.has(item.category_id) && !branch?.hidden_product_ids.includes(item.id)).sort((a, b) => a.sort_order - b.sort_order);
    const activeOffers = offers.filter((item) => item.is_active && new Date(item.starts_at) <= new Date() && new Date(item.ends_at) > new Date());
    const plan = subscription ? effectivePlan(subscription.plan, subscription.expires_at) : "FREE";
    return { restaurant, settings, branding, branch, branches, categories: visibleCategories, products: publicProducts, offers: activeOffers, show_nexmenu_branding: !PLANS[plan].hideBranding };
  }
  async uploadFile(file: File) {
    if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new ValidationError("Use a JPG, PNG or WebP image smaller than 5MB.");
    const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    const isPng = signature.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]);
    const isWebp = new TextDecoder().decode(signature.slice(0, 4)) === "RIFF" && new TextDecoder().decode(signature.slice(8, 12)) === "WEBP";
    if (!isJpeg && !isPng && !isWebp) throw new ValidationError("The selected file content is not a supported image.");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new ValidationError("This browser cannot process the image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new ValidationError("Image compression failed.")), "image/webp", 0.84));
    const id = crypto.randomUUID();
    await (await this.database()).put("files", { id, blob });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new ValidationError("The processed image could not be read."));
      reader.readAsDataURL(blob);
    });
  }
  async deleteFile(url: string) {
    if (url.startsWith("nexmenu-file://")) await (await this.database()).delete("files", url.replace("nexmenu-file://", ""));
  }
  async exportDatabase(): Promise<DatabaseExport> {
    const data: Record<string, unknown[]> = {};
    for (const store of stores) data[store] = await this.all(store);
    return { version: 1, exported_at: new Date().toISOString(), data };
  }
  async importDatabase(value: DatabaseExport) {
    if (value.version !== 1) throw new ValidationError("Unsupported NEXMENU export version.");
    const db = await this.database();
    const tx = db.transaction(stores, "readwrite");
    for (const store of stores) {
      await tx.objectStore(store).clear();
      for (const item of value.data[store] ?? []) await tx.objectStore(store).put(item as never);
    }
    await tx.done;
  }
  async reset() { this.db?.close(); await indexedDB.deleteDatabase("nexmenu-local"); this.db = undefined; await this.initialize(); }
}
