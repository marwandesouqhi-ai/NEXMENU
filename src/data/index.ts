import type {
  AnalyticsEvent, AuditLog, Branding, Branch, Category, DatabaseExport, Membership,
  Notification, Offer, Product, Profile, PublicMenu, QrCode, Restaurant,
  RestaurantSettings, Session, Subscription, SubscriptionRequest,
  SubscriptionRequestDecision, Role,
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
  async updatePassword(password: string): Promise<void> {
    const adapter = await this.a();
    if (adapter.updatePassword) {
      return adapter.updatePassword(password);
    }
    return adapter.resetPassword("", "", password);
  }
  onAuthStateChange(callback: (event: string, session: Session | null) => void): () => void {
    let unsub: (() => void) | undefined;
    let unsubscribed = false;
    void this.a().then((adapter) => {
      if (unsubscribed) return;
      if (adapter.onAuthStateChange) {
        unsub = adapter.onAuthStateChange(callback);
      }
    });
    return () => {
      unsubscribed = true;
      if (unsub) unsub();
    };
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
  async inviteMember(restaurantId: string, email: string, role: Exclude<Role, "SUPER_ADMIN">): Promise<Membership> {
    return (await this.a()).inviteMember(restaurantId, email, role);
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
  async listSubscriptionRequests(restaurantId?: string) {
    return (await this.a()).listSubscriptionRequests(restaurantId);
  }
  async createSubscriptionRequest(value: SubscriptionRequest) {
    return (await this.a()).createSubscriptionRequest(value);
  }
  async reviewSubscriptionRequest(
    requestId: string,
    decision: SubscriptionRequestDecision,
    adminNotes: string,
    reviewerProfileId: string,
  ) {
    return (await this.a()).reviewSubscriptionRequest(requestId, decision, adminNotes, reviewerProfileId);
  }
  async uploadSubscriptionProof(file: File, restaurantId: string, requestId: string) {
    return (await this.a()).uploadSubscriptionProof(file, restaurantId, requestId);
  }
  async getSubscriptionProofUrl(path: string) {
    return (await this.a()).getSubscriptionProofUrl(path);
  }
  async deleteSubscriptionProof(path: string) {
    return (await this.a()).deleteSubscriptionProof(path);
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
  async getPublicMenu(slug: string, branch?: string): Promise<PublicMenu | null | undefined> {
    const res = await (await this.a()).getPublicMenu(slug, branch);
    return res ?? null;
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
