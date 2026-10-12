export type Role =
  | "SUPER_ADMIN"
  | "RESTAURANT_OWNER"
  | "RESTAURANT_MANAGER"
  | "STAFF";
export type MenuStatus = "DRAFT" | "PUBLISHED" | "PAUSED";
export type RestaurantStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";
export type PlanCode = "FREE" | "BASIC" | "PRO" | "PREMIUM";
export type Locale = "en" | "ar";
export type ThemeMode = "light" | "dark" | "auto";
export type Entity = { id: string; created_at: string; updated_at: string; is_seed_data?: boolean };

export interface Profile extends Entity {
  email: string;
  name: string;
  password_hash: string;
  password_salt: string;
  platform_role?: "SUPER_ADMIN";
  email_verified: boolean;
}
export interface Session {
  id: string;
  profile_id: string;
  expires_at: string;
}
export interface Restaurant extends Entity {
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  phone: string;
  whatsapp: string;
  address_en: string;
  address_ar: string;
  maps_url: string;
  website: string;
  instagram: string;
  facebook: string;
  cuisine_type: string;
  currency: string;
  timezone: string;
  menu_status: MenuStatus;
  status: RestaurantStatus;
  logo_url?: string;
  cover_url?: string;
  deleted_at?: string;
}
export interface Membership extends Entity {
  restaurant_id: string;
  profile_id?: string;
  email: string;
  role: Exclude<Role, "SUPER_ADMIN">;
  status: "ACTIVE" | "PENDING";
}
export interface Shift { open: string; close: string }
export interface DayHours { closed: boolean; shifts: Shift[] }
export type OpeningHours = Record<string, DayHours>;
export interface RestaurantSettings extends Entity {
  restaurant_id: string;
  opening_hours: OpeningHours;
  default_locale: Locale;
}
export interface Branding extends Entity {
  restaurant_id: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  template: "Modern" | "Minimal" | "Elegant" | "Cafe" | "Restaurant" | "Fast Food";
  radius: "soft" | "rounded" | "pill";
  theme: ThemeMode;
  font: "Inter" | "Cairo";
}
export interface Branch extends Entity {
  restaurant_id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  address_en: string;
  address_ar: string;
  phone: string;
  maps_url: string;
  opening_hours: OpeningHours;
  hidden_product_ids: string[];
}
export interface Category extends Entity {
  restaurant_id: string;
  name_en: string;
  name_ar: string;
  image_url?: string;
  is_visible: boolean;
  sort_order: number;
  deleted_at?: string;
}
export interface ProductOptionValue extends Entity {
  option_id: string;
  name_en: string;
  name_ar: string;
  price_delta: number;
}
export interface ProductOption extends Entity {
  product_id: string;
  name_en: string;
  name_ar: string;
  values: ProductOptionValue[];
}
export interface Product extends Entity {
  restaurant_id: string;
  category_id: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  price: number;
  compare_at_price?: number;
  image_url?: string;
  is_available: boolean;
  is_visible: boolean;
  is_featured: boolean;
  is_popular: boolean;
  sort_order: number;
  sku: string;
  calories?: number;
  options: ProductOption[];
  deleted_at?: string;
}
export interface Offer extends Entity {
  restaurant_id: string;
  product_id?: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  type: "PERCENTAGE" | "FIXED" | "SPECIAL" | "FEATURED";
  value?: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}
export interface QrCode extends Entity {
  restaurant_id: string;
  branch_id?: string;
  target_url: string;
}
export type AnalyticsEventType =
  | "menu_view" | "qr_scan" | "product_view" | "category_view" | "search";
export interface AnalyticsEvent extends Entity {
  restaurant_id: string;
  branch_id?: string;
  event_type: AnalyticsEventType;
  entity_id?: string;
  language: Locale;
  device_class: "mobile" | "tablet";
  source: "qr" | "direct";
  visitor_day_id?: string;
}
export interface Subscription extends Entity {
  restaurant_id: string;
  plan: PlanCode;
  starts_at: string;
  expires_at: string;
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED";
  notes: string;
}
export interface Notification extends Entity {
  restaurant_id: string;
  profile_id?: string;
  title: string;
  body: string;
  read_at?: string;
}
export interface AuditLog extends Entity {
  restaurant_id?: string;
  actor_profile_id: string;
  actor_role: Role;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: Record<string, string | number | boolean>;
}
export interface PublicMenu {
  restaurant: Omit<Restaurant, "deleted_at">;
  settings: RestaurantSettings;
  branding: Branding;
  branch?: Branch;
  branches: Branch[];
  categories: Category[];
  products: Product[];
  offers: Offer[];
  show_nexmenu_branding: boolean;
}
export interface DatabaseExport {
  version: 1;
  exported_at: string;
  data: Record<string, unknown[]>;
}
