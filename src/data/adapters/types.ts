import type {
  AnalyticsEvent, AuditLog, Branding, Branch, Category, DatabaseExport, Membership,
  Notification, Offer, Product, Profile, PublicMenu, QrCode, Restaurant,
  RestaurantSettings, Session, Subscription,
} from "@/types/domain";

export type StoreName = "profiles" | "restaurants" | "members" | "settings" | "branding" |
  "branches" | "categories" | "products" | "offers" | "qr_codes" | "analytics_events" |
  "subscriptions" | "notifications" | "audit_logs";
export interface AuthResult { profile: Omit<Profile, "password_hash" | "password_salt">; session: Session }
export interface DataAdapter {
  initialize(): Promise<void>;
  signUp(input: { email: string; password: string; name: string }): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  requestPasswordReset(email: string): Promise<string>;
  resetPassword(email: string, code: string, password: string): Promise<void>;
  updatePassword?(password: string): Promise<void>;
  onAuthStateChange?(callback: (event: string, session: Session | null) => void): () => void;
  getProfile(id: string): Promise<Profile | undefined>;
  listProfiles(): Promise<Profile[]>;
  listRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | undefined>;
  saveRestaurant(value: Restaurant): Promise<Restaurant>;
  listMemberships(): Promise<Membership[]>;
  saveMembership(value: Membership): Promise<Membership>;
  deleteMembership(id: string): Promise<void>;
  getSettings(restaurantId: string): Promise<RestaurantSettings | undefined>;
  saveSettings(value: RestaurantSettings): Promise<RestaurantSettings>;
  getBranding(restaurantId: string): Promise<Branding | undefined>;
  saveBranding(value: Branding): Promise<Branding>;
  listBranches(restaurantId: string): Promise<Branch[]>;
  saveBranch(value: Branch): Promise<Branch>;
  listCategories(restaurantId: string): Promise<Category[]>;
  saveCategory(value: Category): Promise<Category>;
  reorderCategories(restaurantId: string, orderedIds: string[]): Promise<Category[]>;
  listProducts(restaurantId: string): Promise<Product[]>;
  saveProduct(value: Product): Promise<Product>;
  reorderProducts(restaurantId: string, categoryId: string, orderedIds: string[]): Promise<Product[]>;
  listOffers(restaurantId: string): Promise<Offer[]>;
  saveOffer(value: Offer): Promise<Offer>;
  listQrCodes(restaurantId: string): Promise<QrCode[]>;
  saveQrCode(value: QrCode): Promise<QrCode>;
  listAnalytics(restaurantId?: string): Promise<AnalyticsEvent[]>;
  saveAnalytics(value: AnalyticsEvent): Promise<AnalyticsEvent>;
  listSubscriptions(): Promise<Subscription[]>;
  getSubscription(restaurantId: string): Promise<Subscription | undefined>;
  saveSubscription(value: Subscription): Promise<Subscription>;
  listNotifications(restaurantId: string): Promise<Notification[]>;
  saveNotification(value: Notification): Promise<Notification>;
  listAuditLogs(restaurantId?: string): Promise<AuditLog[]>;
  saveAuditLog(value: AuditLog): Promise<AuditLog>;
  getPublicMenu(slug: string, branch?: string): Promise<PublicMenu | null | undefined>;
  uploadFile(file: File): Promise<string>;
  deleteFile(url: string): Promise<void>;
  exportDatabase(): Promise<DatabaseExport>;
  importDatabase(value: DatabaseExport): Promise<void>;
  reset(): Promise<void>;
}
