import type {
  AnalyticsEvent, AuditLog, Branding, Branch, Category, DatabaseExport, Membership,
  Notification, Offer, Product, Profile, PublicMenu, QrCode, Restaurant,
  RestaurantSettings, Session, Subscription,
} from "@/types/domain";
import type { AuthResult, DataAdapter } from "./adapters/types";

let resolvedAdapter: DataAdapter | null = null;
let adapterPromise: Promise<DataAdapter> | null = null;

export async function getActiveAdapter(): Promise<DataAdapter> {
  if (resolvedAdapter) return resolvedAdapter;
  if (!adapterPromise) {
    adapterPromise = (async () => {
      if (import.meta.env.VITE_DATA_ADAPTER === "supabase") {
        const { SupabaseAdapter } = await import("./adapters/supabase");
        resolvedAdapter = new SupabaseAdapter();
      } else {
        const { LocalAdapter } = await import("./adapters/local");
        resolvedAdapter = new LocalAdapter();
      }
      return resolvedAdapter;
    })();
  }
  return adapterPromise;
}

export class LazyDataAdapter implements DataAdapter {
  private async a(): Promise<DataAdapter> {
    return getActiveAdapter();
  }

  async initialize(): Promise<void> {
    return (await this.a()).initialize();
  }
  async signUp(input: { email: string; password: string; name: string }): Promise<AuthResult> {
    return (await this.a()).signUp(input);
  }
  async signIn(email: string, password: string): Promise<AuthResult> {
    return (await this.a()).signIn(email, password);
  }
  async signOut(): Promise<void> {
    return (await this.a()).signOut();
  }
  async getSession(): Promise<Session | null> {
    return (await this.a()).getSession();
  }
  async requestPasswordReset(email: string): Promise<string> {
    return (await this.a()).requestPasswordReset(email);
  }
  async resetPassword(email: string, code: string, password: string): Promise<void> {
    return (await this.a()).resetPassword(email, code, password);
  }
  async getProfile(id: string): Promise<Profile | undefined> {
    return (await this.a()).getProfile(id);
  }
  async listProfiles(): Promise<Profile[]> {
    return (await this.a()).listProfiles();
  }
  async listRestaurants(): Promise<Restaurant[]> {
    return (await this.a()).listRestaurants();
  }
  async getRestaurant(id: string): Promise<Restaurant | undefined> {
    return (await this.a()).getRestaurant(id);
  }
  async saveRestaurant(value: Restaurant): Promise<Restaurant> {
    return (await this.a()).saveRestaurant(value);
  }
  async listMemberships(): Promise<Membership[]> {
    return (await this.a()).listMemberships();
  }
  async saveMembership(value: Membership): Promise<Membership> {
    return (await this.a()).saveMembership(value);
  }
  async deleteMembership(id: string): Promise<void> {
    return (await this.a()).deleteMembership(id);
  }
  async getSettings(restaurantId: string): Promise<RestaurantSettings | undefined> {
    return (await this.a()).getSettings(restaurantId);
  }
  async saveSettings(value: RestaurantSettings): Promise<RestaurantSettings> {
    return (await this.a()).saveSettings(value);
  }
  async getBranding(restaurantId: string): Promise<Branding | undefined> {
    return (await this.a()).getBranding(restaurantId);
  }
  async saveBranding(value: Branding): Promise<Branding> {
    return (await this.a()).saveBranding(value);
  }
  async listBranches(restaurantId: string): Promise<Branch[]> {
    return (await this.a()).listBranches(restaurantId);
  }
  async saveBranch(value: Branch): Promise<Branch> {
    return (await this.a()).saveBranch(value);
  }
  async listCategories(restaurantId: string): Promise<Category[]> {
    return (await this.a()).listCategories(restaurantId);
  }
  async saveCategory(value: Category): Promise<Category> {
    return (await this.a()).saveCategory(value);
  }
  async reorderCategories(restaurantId: string, orderedIds: string[]): Promise<Category[]> {
    return (await this.a()).reorderCategories(restaurantId, orderedIds);
  }
  async listProducts(restaurantId: string): Promise<Product[]> {
    return (await this.a()).listProducts(restaurantId);
  }
  async saveProduct(value: Product): Promise<Product> {
    return (await this.a()).saveProduct(value);
  }
  async reorderProducts(restaurantId: string, categoryId: string, orderedIds: string[]): Promise<Product[]> {
    return (await this.a()).reorderProducts(restaurantId, categoryId, orderedIds);
  }
  async listOffers(restaurantId: string): Promise<Offer[]> {
    return (await this.a()).listOffers(restaurantId);
  }
  async saveOffer(value: Offer): Promise<Offer> {
    return (await this.a()).saveOffer(value);
  }
  async listQrCodes(restaurantId: string): Promise<QrCode[]> {
    return (await this.a()).listQrCodes(restaurantId);
  }
  async saveQrCode(value: QrCode): Promise<QrCode> {
    return (await this.a()).saveQrCode(value);
  }
  async listAnalytics(restaurantId?: string): Promise<AnalyticsEvent[]> {
    return (await this.a()).listAnalytics(restaurantId);
  }
  async saveAnalytics(value: AnalyticsEvent): Promise<AnalyticsEvent> {
    return (await this.a()).saveAnalytics(value);
  }
  async listSubscriptions(): Promise<Subscription[]> {
    return (await this.a()).listSubscriptions();
  }
  async getSubscription(restaurantId: string): Promise<Subscription | undefined> {
    return (await this.a()).getSubscription(restaurantId);
  }
  async saveSubscription(value: Subscription): Promise<Subscription> {
    return (await this.a()).saveSubscription(value);
  }
  async listNotifications(restaurantId: string): Promise<Notification[]> {
    return (await this.a()).listNotifications(restaurantId);
  }
  async saveNotification(value: Notification): Promise<Notification> {
    return (await this.a()).saveNotification(value);
  }
  async listAuditLogs(restaurantId?: string): Promise<AuditLog[]> {
    return (await this.a()).listAuditLogs(restaurantId);
  }
  async saveAuditLog(value: AuditLog): Promise<AuditLog> {
    return (await this.a()).saveAuditLog(value);
  }
  async getPublicMenu(slug: string, branch?: string): Promise<PublicMenu | undefined> {
    return (await this.a()).getPublicMenu(slug, branch);
  }
  async uploadFile(file: File): Promise<string> {
    return (await this.a()).uploadFile(file);
  }
  async deleteFile(url: string): Promise<void> {
    return (await this.a()).deleteFile(url);
  }
  async exportDatabase(): Promise<DatabaseExport> {
    return (await this.a()).exportDatabase();
  }
  async importDatabase(value: DatabaseExport): Promise<void> {
    return (await this.a()).importDatabase(value);
  }
  async reset(): Promise<void> {
    return (await this.a()).reset();
  }
}

export const dataAdapter: DataAdapter = new LazyDataAdapter();
