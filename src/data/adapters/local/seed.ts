import type {
  AnalyticsEvent, Branding, Branch, Category, Membership, Offer, Product, Profile,
  Restaurant, RestaurantSettings, Subscription,
} from "@/types/domain";
import { hashPassword } from "./crypto";

const now = new Date().toISOString();
const id = (value: string) => `seed-${value}`;
const entity = (value: string) => ({ id: id(value), created_at: now, updated_at: now, is_seed_data: true });
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const opening_hours = Object.fromEntries(days.map((day) => [
  day,
  day === "friday"
    ? { closed: false, shifts: [{ open: "12:00", close: "16:00" }, { open: "18:00", close: "02:00" }] }
    : { closed: false, shifts: [{ open: "09:00", close: day === "thursday" ? "01:00" : "23:30" }] },
]));

const catalog = [
  ["burgers", "Burgers", "برجر", [
    ["moon-burger", "Moon Signature", "مون سيجنتشر", "Smash beef, aged cheddar and moon sauce", "لحم سماش، شيدر معتق وصوص مون", 185],
    ["garden-burger", "Garden Burger", "جاردن برجر", "Crisp vegetables, halloumi and herb dressing", "خضروات طازجة، حلومي وصوص أعشاب", 155],
    ["fire-burger", "Fire Stack", "فاير ستاك", "Double beef, jalapeño and smoked cheese", "لحم دبل، هالبينو وجبنة مدخنة", 225],
    ["classic-burger", "Classic Cheeseburger", "كلاسيك تشيز برجر", "Beef, cheddar, pickles and house relish", "لحم، شيدر، مخلل وصوص البيت", 165],
  ]],
  ["pizza", "Pizza", "بيتزا", [
    ["margherita", "Moon Margherita", "مون مارجريتا", "Tomato, mozzarella and fresh basil", "طماطم، موزاريلا وريحان طازج", 170],
    ["truffle-pizza", "Wild Mushroom", "مشروم بري", "Mushrooms, mozzarella and truffle cream", "مشروم، موزاريلا وكريمة ترافل", 235],
    ["pepperoni", "Pepperoni", "بيبروني", "Beef pepperoni, mozzarella and oregano", "بيبروني بقري، موزاريلا وأوريجانو", 210],
  ]],
  ["chicken", "Chicken", "دجاج", [
    ["grilled-chicken", "Charred Chicken", "دجاج مشوي", "Herb-marinated chicken and lemon jus", "دجاج متبل بالأعشاب وصوص الليمون", 220],
    ["crispy-chicken", "Crispy Chicken", "دجاج مقرمش", "Golden chicken, slaw and chilli honey", "دجاج ذهبي، كول سلو وعسل حار", 195],
    ["chicken-bowl", "Green Chicken Bowl", "بول الدجاج الأخضر", "Grains, greens, avocado and grilled chicken", "حبوب، خضار، أفوكادو ودجاج مشوي", 245],
  ]],
  ["drinks", "Drinks", "مشروبات", [
    ["spanish-latte", "Spanish Latte", "سبانش لاتيه", "Double espresso and silky sweet milk", "دبل إسبريسو وحليب كريمي محلى", 95],
    ["cold-brew", "Citrus Cold Brew", "كولد برو حمضيات", "Slow-steeped coffee with orange tonic", "قهوة منقوعة ببطء مع تونك البرتقال", 110],
    ["hibiscus", "Hibiscus Cooler", "كركديه بارد", "Hibiscus, berries and sparkling water", "كركديه، توت ومياه فوارة", 85],
    ["matcha", "Ceremonial Matcha", "ماتشا", "Stone-ground matcha and oat milk", "ماتشا فاخرة وحليب الشوفان", 125],
  ]],
  ["desserts", "Desserts", "حلويات", [
    ["tiramisu", "Moon Tiramisu", "مون تيراميسو", "Espresso, mascarpone and dark cocoa", "إسبريسو، ماسكربوني وكاكاو داكن", 145],
    ["cheesecake", "Burnt Cheesecake", "تشيز كيك محروقة", "Basque-style cheesecake and berry compote", "تشيز كيك باسك وكومبوت التوت", 155],
    ["brownie", "Salted Brownie", "براوني مملح", "Dark chocolate brownie and sea salt", "براوني شوكولاتة داكنة وملح بحري", 120],
  ]],
] as const;

export async function createSeed() {
  const ownerPassword = await hashPassword("Moon@1234");
  const adminPassword = await hashPassword("Admin@1234");
  const profiles: Profile[] = [
    { ...entity("profile-admin"), email: "admin@nexmenu.local", name: "NEXMENU Admin", ...{ password_hash: adminPassword.hash, password_salt: adminPassword.salt }, platform_role: "SUPER_ADMIN", email_verified: true },
    { ...entity("profile-owner"), email: "owner@cafemoon.local", name: "Layla Hassan", ...{ password_hash: ownerPassword.hash, password_salt: ownerPassword.salt }, email_verified: true },
  ];
  const restaurant: Restaurant = {
    ...entity("restaurant-moon"), slug: "cafe-moon", name_en: "Cafe Moon", name_ar: "كافيه مون",
    description_en: "A neighborhood kitchen shaped by late mornings, honest ingredients and the comfort of familiar flavors.",
    description_ar: "مطبخ الحي بنكهات مألوفة ومكونات صادقة وأجواء دافئة.",
    phone: "+201001234567", whatsapp: "+201001234567",
    address_en: "Palm District, New Cairo", address_ar: "حي النخيل، القاهرة الجديدة",
    maps_url: "https://maps.google.com", website: "https://example.com", instagram: "https://instagram.com",
    facebook: "https://facebook.com", cuisine_type: "Modern cafe", currency: "EGP", timezone: "Africa/Cairo",
    menu_status: "PUBLISHED", status: "ACTIVE", logo_url: "/assets/moon-logo.svg", cover_url: "/assets/cafe-cover.webp",
  };
  const membership: Membership = { ...entity("member-owner"), restaurant_id: restaurant.id, profile_id: profiles[1].id, email: profiles[1].email, role: "RESTAURANT_OWNER", status: "ACTIVE" };
  const settings: RestaurantSettings = { ...entity("settings-moon"), restaurant_id: restaurant.id, opening_hours, default_locale: "en" };
  const branding: Branding = { ...entity("branding-moon"), restaurant_id: restaurant.id, primary_color: "#176b4d", secondary_color: "#d7aa5c", background_color: "#f7f4ed", text_color: "#17221d", template: "Cafe", radius: "rounded", theme: "light", font: "Inter" };
  const categories: Category[] = catalog.map(([key, en, ar], index) => ({ ...entity(`category-${key}`), restaurant_id: restaurant.id, name_en: en, name_ar: ar, is_visible: true, sort_order: index }));
  const products: Product[] = catalog.flatMap(([key, , , items], categoryIndex) => items.map(([slug, en, ar, descEn, descAr, price], index) => ({
    ...entity(`product-${slug}`), restaurant_id: restaurant.id, category_id: categories[categoryIndex].id,
    name_en: en, name_ar: ar, description_en: descEn, description_ar: descAr, price,
    compare_at_price: slug === "moon-burger" ? 210 : undefined, image_url: `/assets/food-${(categoryIndex * 4 + index) % 8 + 1}.webp`,
    is_available: slug !== "brownie", is_visible: true, is_featured: index === 0,
    is_popular: ["moon-burger", "margherita", "spanish-latte", "tiramisu"].includes(slug),
    sort_order: index, sku: `MOON-${key.slice(0, 3).toUpperCase()}-${index + 1}`,
    calories: 280 + categoryIndex * 80 + index * 20,
    options: index === 0 ? [{
      ...entity(`option-${slug}`), product_id: id(`product-${slug}`), name_en: "Extras", name_ar: "إضافات",
      values: [
        { ...entity(`value-${slug}-1`), option_id: id(`option-${slug}`), name_en: "Extra cheese", name_ar: "جبنة إضافية", price_delta: 20 },
        { ...entity(`value-${slug}-2`), option_id: id(`option-${slug}`), name_en: "Large", name_ar: "حجم كبير", price_delta: 40 },
      ],
    }] : [],
  })));
  const branches: Branch[] = [
    { ...entity("branch-new-cairo"), restaurant_id: restaurant.id, slug: "new-cairo", name_en: "New Cairo", name_ar: "القاهرة الجديدة", address_en: "Palm District", address_ar: "حي النخيل", phone: restaurant.phone, maps_url: restaurant.maps_url, opening_hours, hidden_product_ids: [] },
    { ...entity("branch-zagazig"), restaurant_id: restaurant.id, slug: "zagazig", name_en: "Zagazig", name_ar: "الزقازيق", address_en: "University District", address_ar: "حي الجامعة", phone: "+20552345678", maps_url: restaurant.maps_url, opening_hours, hidden_product_ids: [id("product-brownie")] },
  ];
  const offer: Offer = { ...entity("offer-moon"), restaurant_id: restaurant.id, product_id: id("product-moon-burger"), title_en: "Moon Hour", title_ar: "ساعة مون", description_en: "15% off our signature burger this week.", description_ar: "خصم ١٥٪ على برجر مون هذا الأسبوع.", type: "PERCENTAGE", value: 15, starts_at: new Date(Date.now() - 86_400_000).toISOString(), ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), is_active: true };
  const subscription: Subscription = { ...entity("subscription-moon"), restaurant_id: restaurant.id, plan: "PRO", starts_at: now, expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(), status: "ACTIVE", notes: "Development seed subscription" };
  const analytics: AnalyticsEvent[] = Array.from({ length: 42 }, (_, index) => ({
    ...entity(`analytics-${index}`), restaurant_id: restaurant.id,
    event_type: (["menu_view", "menu_view", "qr_scan", "product_view", "category_view"] as const)[index % 5],
    entity_id: index % 5 === 3 ? products[index % products.length].id : undefined,
    language: index % 4 === 0 ? "ar" : "en", device_class: index % 3 === 0 ? "tablet" : "mobile",
    source: index % 3 === 0 ? "qr" : "direct",
    created_at: new Date(Date.now() - (index % 14) * 86_400_000 - index * 3_600_000).toISOString(),
  }));
  return { profiles, restaurants: [restaurant], members: [membership], settings: [settings], branding: [branding], branches, categories, products, offers: [offer], subscriptions: [subscription], analytics_events: analytics };
}
