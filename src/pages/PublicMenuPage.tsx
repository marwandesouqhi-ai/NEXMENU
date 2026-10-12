import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  AtSign, ChevronDown, Clock3, Globe2, Languages,
  MapPin, MessageCircle, Phone, Search, SlidersHorizontal, Star, X,
} from "lucide-react";
import { publicMenuService } from "@/services/restaurants";
import { isRestaurantOpen } from "@/utils/opening-hours";
import { normalizeSearch } from "@/utils/search";
import { useI18n } from "@/app/i18n";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import type { Product } from "@/types/domain";
import { useSeo } from "@/utils/useSeo";
import { buildRestaurantJsonLd, getSiteUrl } from "@/utils/seo";
import { getSafeBrandingColors } from "@/utils/contrast";

type BrandStyle = CSSProperties & Record<`--menu-${string}`, string>;
const formatPrice = (price: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
function safeContact(url: string) { return url.startsWith("http://") || url.startsWith("https://") ? url : undefined; }

export default function PublicMenuPage() {
  const { restaurantSlug = "", productId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { locale, setLocale, t } = useI18n();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const branch = params.get("branch") ?? undefined;
  const source = params.get("src") === "qr" ? "qr" : "direct";
  const query = useQuery({ queryKey: ["public-menu", restaurantSlug, branch], queryFn: () => publicMenuService.get(restaurantSlug, branch) });
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState<"all" | "featured" | "popular" | "available">("all");
  const [online, setOnline] = useState(navigator.onLine);
  const menu = query.data;
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update); addEventListener("offline", update);
    return () => { removeEventListener("online", update); removeEventListener("offline", update); };
  }, []);
  const origin = (typeof window !== "undefined" && window.location?.origin) || getSiteUrl();
  const canonicalUrl = `${origin}/r/${restaurantSlug}${branch ? `?branch=${branch}` : ""}`;
  const title = menu
    ? `${locale === "ar" ? menu.restaurant.name_ar : menu.restaurant.name_en} | Digital Menu`
    : "NEXMENU | Digital Menu";
  const seoDescription = menu
    ? (locale === "ar" ? menu.restaurant.description_ar : menu.restaurant.description_en) || "Browse our digital menu on NEXMENU"
    : "Browse digital menu on NEXMENU";
  const image = menu?.restaurant.cover_url || menu?.restaurant.logo_url;

  const jsonLd = useMemo(() => {
    if (!menu) return undefined;
    return buildRestaurantJsonLd(menu, origin, locale);
  }, [menu, origin, locale]);

  useSeo({
    title,
    description: seoDescription,
    canonicalUrl,
    image,
    ogType: "restaurant.menu",
    twitterCard: "summary_large_image",
    jsonLd,
  });

  useEffect(() => {
    if (!menu) return;
    const key = `nexmenu-view:${menu.restaurant.id}:${location.key}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      void publicMenuService.track({ restaurant_id: menu.restaurant.id, branch_id: menu.branch?.id, event_type: "menu_view", language: locale, device_class: innerWidth >= 600 ? "tablet" : "mobile", source });
      if (source === "qr" && !sessionStorage.getItem(`nexmenu-qr:${menu.restaurant.id}`)) {
        sessionStorage.setItem(`nexmenu-qr:${menu.restaurant.id}`, "1");
        void publicMenuService.track({ restaurant_id: menu.restaurant.id, branch_id: menu.branch?.id, event_type: "qr_scan", language: locale, device_class: innerWidth >= 600 ? "tablet" : "mobile", source });
      }
    }
  }, [menu, locale, location.key, source]);
  useEffect(() => {
    if (!menu || term.trim().length < 2) return;
    const timer = setTimeout(() => void publicMenuService.track({ restaurant_id: menu.restaurant.id, branch_id: menu.branch?.id, event_type: "search", language: locale, device_class: innerWidth >= 600 ? "tablet" : "mobile", source }), 650);
    return () => clearTimeout(timer);
  }, [term, menu, locale, source]);
  const products = useMemo(() => {
    if (!menu) return [];
    const needle = normalizeSearch(term);
    return menu.products.filter((product) => {
      const productCategory = menu.categories.find((item) => item.id === product.category_id);
      const haystack = normalizeSearch([product.name_en, product.name_ar, product.description_en, product.description_ar, productCategory?.name_en, productCategory?.name_ar].join(" "));
      return (!needle || haystack.includes(needle)) &&
        (category === "all" || product.category_id === category) &&
        (filter === "all" || (filter === "featured" && product.is_featured) || (filter === "popular" && product.is_popular) || (filter === "available" && product.is_available));
    });
  }, [menu, term, category, filter]);
  if (query.isLoading) return <div className="mx-auto min-h-screen max-w-[820px] bg-[var(--surface)]"><LoadingState label="Opening the menu…" /></div>;
  if (query.isError) return <ErrorState body="We couldn’t open this menu. Your saved menu may still be available offline." retry={() => void query.refetch()} />;
  if (!menu) return <ErrorState title="Menu not found" body="Check the address or ask the restaurant for a new QR code." />;
  if (menu.restaurant.status !== "ACTIVE") return <ErrorState title="Menu unavailable" body="This restaurant menu is not available right now." />;
  if (menu.restaurant.menu_status !== "PUBLISHED") return <ErrorState title={menu.restaurant.menu_status === "PAUSED" ? "Menu temporarily unavailable" : "Menu coming soon"} body={menu.restaurant.menu_status === "PAUSED" ? "The restaurant has paused this menu for now." : "This restaurant is still preparing its digital menu."} />;
  const open = isRestaurantOpen(menu.branch?.opening_hours ?? menu.settings.opening_hours, menu.restaurant.timezone);
  const selectedProduct = productId ? menu.products.find((item) => item.id === productId) : undefined;
  const safeBranding = getSafeBrandingColors(menu.branding);
  const brandStyle: BrandStyle = {
    "--menu-accent": menu.branding.primary_color,
    "--menu-secondary": menu.branding.secondary_color,
    "--menu-bg": menu.branding.background_color,
    "--menu-text": safeBranding.safeTextColor,
    "--menu-btn-text": safeBranding.safeButtonTextColor,
  };
  const name = locale === "ar" ? menu.restaurant.name_ar : menu.restaurant.name_en;
  const description = locale === "ar" ? menu.restaurant.description_ar : menu.restaurant.description_en;
  return <div className="min-h-screen bg-[var(--menu-surround)]">
    <main style={brandStyle} className="menu-root relative mx-auto min-h-screen w-full max-w-[820px] overflow-x-clip bg-[var(--menu-bg)] text-[var(--menu-text)] shadow-2xl">
      {!online && <div className="sticky top-0 z-50 bg-[var(--warning)] px-4 py-2 text-center text-xs font-bold text-white">{t("offline")}</div>}
      <header className="relative h-64 overflow-hidden sm:h-80">
        <img src={menu.restaurant.cover_url || "/assets/cafe-cover.webp"} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-3 text-white"><img src={menu.restaurant.logo_url || "/assets/moon-logo.svg"} alt="" className="size-11 rounded-xl border border-white/30 bg-white object-cover" /><p className="truncate font-extrabold">{name}</p></div>
          <Button variant="secondary" size="icon" className="border-white/20 bg-black/25 text-white backdrop-blur-md hover:bg-black/40" onClick={() => setLocale(locale === "en" ? "ar" : "en")} aria-label="Change language"><Languages className="size-5" /></Button>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
          <div className="mb-3 flex items-center gap-2"><Badge className={open ? "bg-emerald-400/20 text-emerald-100 backdrop-blur" : "bg-white/15 text-white"}><span className={open ? "me-1.5 size-1.5 rounded-full bg-emerald-300" : "me-1.5 size-1.5 rounded-full bg-white/60"} />{open ? t("open") : t("closed")}</Badge>{menu.branch && <Badge className="bg-white/15 text-white backdrop-blur"><MapPin className="me-1 size-3" />{locale === "ar" ? menu.branch.name_ar : menu.branch.name_en}</Badge>}</div>
          <h1 className="text-3xl font-black tracking-[-.04em] sm:text-4xl">{name}</h1>
          <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">{description}</p>
        </div>
      </header>
      <section className="relative z-10 -mt-1 rounded-t-[2rem] bg-[var(--menu-bg)] px-4 pb-24 pt-5 sm:px-7">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1"><span className="sr-only">{t("search")}</span><Search className="absolute start-4 top-1/2 size-4 -translate-y-1/2 opacity-50" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("search")} className="min-h-12 w-full rounded-2xl border border-black/5 bg-white/70 pe-10 ps-11 text-sm outline-none ring-[var(--menu-accent)] placeholder:opacity-50 focus:ring-2" />{term && <button type="button" onClick={() => setTerm("")} className="absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center" aria-label="Clear search"><X className="size-4" /></button>}</label>
          <button type="button" onClick={() => setFilter(filter === "all" ? "featured" : filter === "featured" ? "popular" : filter === "popular" ? "available" : "all")} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--menu-accent)] text-[var(--menu-btn-text,#ffffff)]" aria-label={`Filter: ${filter}`}><SlidersHorizontal className="size-4" /></button>
        </div>
        <nav aria-label="Menu categories" className="sticky top-0 z-30 -mx-4 mt-5 overflow-x-auto bg-[var(--menu-bg)]/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7">
          <div className="flex w-max gap-2"><button type="button" onClick={() => setCategory("all")} className={category === "all" ? "min-h-11 rounded-full bg-[var(--menu-accent)] px-4 text-sm font-bold text-[var(--menu-btn-text,#ffffff)]" : "min-h-11 rounded-full bg-white/70 px-4 text-sm font-bold"}>{t("menu")}</button>{menu.categories.map((item) => <button type="button" key={item.id} onClick={() => { setCategory(item.id); void publicMenuService.track({ restaurant_id: menu.restaurant.id, branch_id: menu.branch?.id, event_type: "category_view", entity_id: item.id, language: locale, device_class: innerWidth >= 600 ? "tablet" : "mobile", source }); }} className={category === item.id ? "min-h-11 rounded-full bg-[var(--menu-accent)] px-4 text-sm font-bold text-[var(--menu-btn-text,#ffffff)]" : "min-h-11 rounded-full bg-white/70 px-4 text-sm font-bold"}>{locale === "ar" ? item.name_ar : item.name_en}</button>)}</div>
        </nav>
        {menu.offers.length > 0 && <div className="my-5 rounded-2xl bg-[var(--menu-accent)] p-5 text-[var(--menu-btn-text,#ffffff)]"><p className="text-xs font-black uppercase tracking-[.15em] opacity-60">LIMITED OFFER</p><p className="mt-2 text-xl font-black">{locale === "ar" ? menu.offers[0].title_ar : menu.offers[0].title_en}</p><p className="mt-1 text-sm opacity-75">{locale === "ar" ? menu.offers[0].description_ar : menu.offers[0].description_en}</p></div>}
        {products.length ? <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-2 sm:gap-5 md:grid-cols-3">
          {products.map((product) => <ProductCard key={product.id} product={product} currency={menu.restaurant.currency} locale={locale} onOpen={() => { void publicMenuService.track({ restaurant_id: menu.restaurant.id, branch_id: menu.branch?.id, event_type: "product_view", entity_id: product.id, language: locale, device_class: innerWidth >= 600 ? "tablet" : "mobile", source }); navigate(`/r/${restaurantSlug}/p/${product.id}${location.search}`); }} />)}
        </div> : <div className="py-20 text-center"><Search className="mx-auto size-7 opacity-30" /><p className="mt-3 font-bold">No matching dishes</p><p className="mt-1 text-sm opacity-60">Try another category or search term.</p></div>}
        <ContactStrip menu={menu} locale={locale} />
        <footer className="mt-10 border-t border-black/5 py-7 text-center text-xs opacity-60"><p>{locale === "ar" ? menu.restaurant.address_ar : menu.restaurant.address_en}</p>{menu.show_nexmenu_branding && <p className="mt-3 font-black tracking-[.18em]">NEXMENU</p>}</footer>
      </section>
      {productId && <ProductSheet product={selectedProduct} locale={locale} currency={menu.restaurant.currency} close={() => navigate(`/r/${restaurantSlug}${location.search}`)} />}
    </main>
  </div>;
}
function ProductCard({ product, currency, locale, onOpen }: { product: Product; currency: string; locale: "en" | "ar"; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="group min-w-0 overflow-hidden rounded-2xl bg-white/75 text-start shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60" disabled={!product.is_available}>
    <div className="relative aspect-[4/3] overflow-hidden bg-black/5"><img src={product.image_url || "/assets/food-1.webp"} alt="" loading="lazy" width="480" height="360" className="size-full object-cover transition duration-500 group-hover:scale-105" />{!product.is_available && <div className="absolute inset-0 grid place-items-center bg-black/50 text-xs font-bold text-white">Unavailable</div>}<div className="absolute start-2 top-2 flex flex-wrap gap-1">{product.is_featured && <Badge><Star className="me-1 size-3 fill-current" />Featured</Badge>}{product.is_popular && <Badge className="bg-amber-100 text-amber-900">Popular</Badge>}</div></div>
    <div className="p-3 sm:p-4"><p className="line-clamp-1 font-extrabold">{locale === "ar" ? product.name_ar : product.name_en}</p><p className="mt-1 line-clamp-2 min-h-9 text-xs leading-[1.4] opacity-55">{locale === "ar" ? product.description_ar : product.description_en}</p><div className="mt-3 flex items-baseline gap-2"><p className="text-sm font-black text-[var(--menu-accent)]">{formatPrice(product.price, currency, locale)}</p>{product.compare_at_price && <p className="text-xs line-through opacity-40">{formatPrice(product.compare_at_price, currency, locale)}</p>}</div></div>
  </button>;
}
function ProductSheet({ product, locale, currency, close }: { product?: Product; locale: "en" | "ar"; currency: string; close: () => void }) {
  if (!product) return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-5"><div className="rounded-2xl bg-white p-6 text-center"><p className="font-bold">Product not found</p><Button className="mt-4" onClick={close}>Back to menu</Button></div></div>;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={locale === "ar" ? product.name_ar : product.name_en} onClick={close}>
    <article className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-[var(--menu-bg)] pb-[env(safe-area-inset-bottom)] text-[var(--menu-text)] shadow-2xl sm:rounded-[2rem]" onClick={(event) => event.stopPropagation()}>
      <div className="relative aspect-[16/10]"><img src={product.image_url} alt="" className="size-full object-cover" /><button type="button" onClick={close} className="absolute end-4 top-4 grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur"><X className="size-5" /></button></div>
      <div className="p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black">{locale === "ar" ? product.name_ar : product.name_en}</h2><p className="mt-2 leading-7 opacity-65">{locale === "ar" ? product.description_ar : product.description_en}</p></div><p className="shrink-0 font-black text-[var(--menu-accent)]">{formatPrice(product.price, currency, locale)}</p></div>
        {product.calories && <p className="mt-5 text-xs font-bold opacity-50">{product.calories} kcal</p>}
        {product.options.map((option) => <div key={option.id} className="mt-6 border-t border-black/10 pt-5"><p className="font-extrabold">{locale === "ar" ? option.name_ar : option.name_en}</p><p className="mt-1 text-xs opacity-50">For information only</p><div className="mt-3 grid gap-2">{option.values.map((value) => <div key={value.id} className="flex min-h-11 items-center justify-between rounded-xl bg-white/60 px-4 text-sm"><span>{locale === "ar" ? value.name_ar : value.name_en}</span><span className="font-bold">+{formatPrice(value.price_delta, currency, locale)}</span></div>)}</div></div>)}
      </div>
    </article>
  </div>;
}
function ContactStrip({ menu, locale }: { menu: NonNullable<Awaited<ReturnType<typeof publicMenuService.get>>>; locale: "en" | "ar" }) {
  const restaurant = menu.restaurant;
  const links = [
    [restaurant.phone ? `tel:${restaurant.phone}` : undefined, Phone, "Call"],
    [restaurant.whatsapp ? `https://wa.me/${restaurant.whatsapp.replace(/\D/g, "")}` : undefined, MessageCircle, "WhatsApp"],
    [safeContact(menu.branch?.maps_url || restaurant.maps_url), MapPin, "Map"],
    [safeContact(restaurant.instagram), AtSign, "Instagram"],
    [safeContact(restaurant.facebook), AtSign, "Facebook"],
    [safeContact(restaurant.website), Globe2, "Website"],
  ] as const;
  return <section className="mt-9"><h2 className="text-lg font-black">{locale === "ar" ? "تواصل معنا" : "Visit & contact"}</h2><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{links.filter(([url]) => url).map(([url, Icon, label]) => <a key={label} href={url} target={url?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="grid min-h-20 place-items-center rounded-2xl bg-white/65 p-2 text-center text-xs font-bold"><Icon className="mb-1 size-5 text-[var(--menu-accent)]" />{label}</a>)}</div><div className="mt-5 rounded-2xl bg-white/50 p-4"><div className="flex items-center gap-2 font-bold"><Clock3 className="size-4 text-[var(--menu-accent)]" /> Opening hours <ChevronDown className="ms-auto size-4" /></div></div></section>;
}
