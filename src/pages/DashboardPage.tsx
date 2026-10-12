import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import QRCode from "qrcode";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  BarChart3, Check, Copy, Download, Eye, EyeOff,
  FileDown, Gift, Package, Plus, Printer, QrCode as QrIcon,
  Search, Settings2, Sparkles, Store, Trash2,
} from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import type { Branding, Category, Product } from "@/types/domain";
import { PLANS } from "@/config/plans";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { ReorderableControls } from "@/components/shared/ReorderableControls";
import { evaluateContrast } from "@/utils/contrast";

export default function DashboardPage() {
  const { section = "overview" } = useParams();
  const { session } = useAuth();
  const mine = useQuery({ queryKey: ["restaurants", "mine"], queryFn: () => restaurantService.mine(session!), enabled: Boolean(session) });
  const restaurant = mine.data?.[0];
  const details = useQuery({ queryKey: ["restaurant", restaurant?.id], queryFn: () => restaurantService.details(session!, restaurant!.id), enabled: Boolean(session && restaurant) });
  if (mine.isLoading || details.isLoading) return <LoadingState />;
  if (mine.isError || details.isError) return <ErrorState body="Your restaurant workspace could not be loaded." retry={() => { void mine.refetch(); void details.refetch(); }} />;
  if (!restaurant) return <EmptyState title="Create your first restaurant" body="Complete onboarding to publish your first digital menu." />;
  if (!details.data) return <LoadingState />;
  const data = details.data;
  const title = section === "overview" ? `Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}` : section[0].toUpperCase() + section.slice(1);
  return <div><div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-[var(--accent)]">{restaurant.name_en.toUpperCase()}</p><h1 className="mt-1 text-3xl font-black tracking-[-.04em] sm:text-4xl">{title}</h1></div><Badge className="w-fit">{restaurant.menu_status}</Badge></div>
    {section === "overview" && <Overview data={data} />}
    {section === "menu" && <MenuManager data={data} />}
    {section === "qr" && <QrManager data={data} />}
    {section === "analytics" && <Analytics restaurantId={restaurant.id} />}
    {section === "branding" && <BrandingManager branding={data.branding} />}
    {section === "settings" && <SettingsManager data={data} />}
    {section === "subscription" && <SubscriptionView data={data} />}
    {section === "offers" && <OffersView data={data} />}
    {section === "branches" && <BranchesView data={data} />}
    {section === "team" && <TeamView data={data} />}
  </div>;
}
type Details = NonNullable<Awaited<ReturnType<typeof restaurantService.details>>>;
function Stat({ label, value, icon: Icon, note }: { label: string; value: string | number; icon: typeof Package; note?: string }) {
  return <Card className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-[var(--ink-soft)]">{label}</p><p className="mt-3 text-3xl font-black tracking-[-.04em]">{value}</p>{note && <p className="mt-2 text-xs text-[var(--ink-faint)]">{note}</p>}</div><span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon className="size-5" /></span></div></Card>;
}
function Overview({ data }: { data: Details }) {
  const events = data.products.length ? 42 : 0;
  return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Total products" value={data.products.filter((item) => !item.deleted_at).length} icon={Package} note={`${data.products.filter((item) => item.is_available).length} currently available`} /><Stat label="Categories" value={data.categories.filter((item) => !item.deleted_at).length} icon={Settings2} note="Across your public menu" /><Stat label="Menu views" value={events} icon={Eye} note="Last 30 days" /><Stat label="Current plan" value={data.subscription?.plan ?? "FREE"} icon={Sparkles} note={data.subscription ? `Until ${new Date(data.subscription.expires_at).toLocaleDateString()}` : "Local workspace"} /></div><div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><Card className="p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Menu readiness</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Your publishing essentials at a glance.</p></div><Badge>4 of 4 ready</Badge></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{[["Menu published", data.restaurant?.menu_status === "PUBLISHED"], ["Products available", data.products.some((item) => item.is_available)], ["Branding complete", Boolean(data.branding)], ["Restaurant details", Boolean(data.restaurant?.phone)]].map(([label, done]) => <div key={String(label)} className="flex min-h-14 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"><span className={done ? "grid size-7 place-items-center rounded-full bg-[var(--accent)] text-white" : "grid size-7 place-items-center rounded-full bg-[var(--line)]"}><Check className="size-4" /></span><p className="text-sm font-bold">{String(label)}</p></div>)}</div></Card><Card className="overflow-hidden bg-[var(--ink)] p-6 text-white"><p className="text-xs font-bold text-[var(--accent-bright)]">LIVE MENU</p><h2 className="mt-3 text-2xl font-black">{data.restaurant?.name_en}</h2><p className="mt-2 text-sm leading-6 text-white/55">Your menu is live and ready to scan.</p><div className="mt-8 flex items-center gap-4"><img src={data.restaurant?.logo_url} alt="" className="size-14 rounded-2xl bg-white" /><div><p className="text-sm font-bold">nexmenu.local</p><p className="text-xs text-white/45">/r/{data.restaurant?.slug}</p></div></div></Card></div></div>;
}
function MenuManager({ data }: { data: Details }) {
  const { session } = useAuth();
  const client = useQueryClient();
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [term, setTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [imageUrl, setImageUrl] = useState("/assets/food-8.webp");
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);
  const [draggedProdIndex, setDraggedProdIndex] = useState<number | null>(null);

  const refresh = () => client.invalidateQueries({ queryKey: ["restaurant", data.restaurant?.id] });

  const saveProduct = useMutation({
    mutationFn: ({ value, isNew }: { value: Product; isNew: boolean }) =>
      restaurantService.saveProduct(session!, value, isNew),
    onSuccess: () => { setShowForm(false); void refresh(); },
  });

  const saveCategory = useMutation({
    mutationFn: ({ value, isNew }: { value: Category; isNew: boolean }) =>
      restaurantService.saveCategory(session!, value, isNew),
    onSuccess: () => { setShowForm(false); void refresh(); },
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      restaurantService.reorderCategories(session!, data.restaurant!.id, orderedIds),
    onSuccess: () => void refresh(),
  });

  const reorderProductsMutation = useMutation({
    mutationFn: ({ categoryId, orderedIds }: { categoryId: string; orderedIds: string[] }) =>
      restaurantService.reorderProducts(session!, data.restaurant!.id, categoryId, orderedIds),
    onSuccess: () => void refresh(),
  });

  const now = new Date().toISOString();

  const addCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value: Category = {
      id: crypto.randomUUID(),
      restaurant_id: data.restaurant!.id,
      name_en: String(form.get("name_en")),
      name_ar: String(form.get("name_ar")),
      is_visible: true,
      sort_order: data.categories.length,
      created_at: now,
      updated_at: now,
    };
    saveCategory.mutate({ value, isNew: true });
  };

  const addProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value: Product = {
      id: crypto.randomUUID(),
      restaurant_id: data.restaurant!.id,
      category_id: String(form.get("category")),
      name_en: String(form.get("name_en")),
      name_ar: String(form.get("name_ar")),
      description_en: String(form.get("description_en")),
      description_ar: "",
      price: Number(form.get("price")),
      image_url: imageUrl,
      is_available: true,
      is_visible: true,
      is_featured: false,
      is_popular: false,
      sort_order: data.products.length,
      sku: `LOCAL-${Date.now()}`,
      options: [],
      created_at: now,
      updated_at: now,
    };
    saveProduct.mutate({ value, isNew: true });
  };

  const sortedCategories = [...data.categories.filter((item) => !item.deleted_at)].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  const moveCategory = (from: number, to: number) => {
    if (to < 0 || to >= sortedCategories.length) return;
    const next = [...sortedCategories];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorderCategoriesMutation.mutate(next.map((c) => c.id));
  };

  const activeCategoryForProducts =
    selectedCatId === "all" ? (sortedCategories[0]?.id ?? "") : selectedCatId;

  const productsInActiveCategory = data.products
    .filter((item) => !item.deleted_at && item.category_id === activeCategoryForProducts)
    .sort((a, b) => a.sort_order - b.sort_order);

  const filteredProducts = productsInActiveCategory.filter((item) =>
    item.name_en.toLowerCase().includes(term.toLowerCase()),
  );

  const moveProduct = (from: number, to: number) => {
    if (to < 0 || to >= productsInActiveCategory.length) return;
    const next = [...productsInActiveCategory];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorderProductsMutation.mutate({
      categoryId: activeCategoryForProducts,
      orderedIds: next.map((p) => p.id),
    });
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-[var(--muted)] p-1">
          {(["products", "categories"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={
                tab === value
                  ? "min-h-10 rounded-lg bg-[var(--surface)] px-4 text-sm font-bold shadow-sm"
                  : "min-h-10 px-4 text-sm font-bold text-[var(--ink-soft)]"
              }
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="size-4" />
          Add {tab === "products" ? "product" : "category"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-5">
          <form
            onSubmit={tab === "products" ? addProduct : addCategory}
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <Input name="name_en" label="English name" required />
            <Input name="name_ar" label="Arabic name" required />
            {tab === "products" && (
              <>
                <Input name="description_en" label="Description" />
                <Input name="price" label="Price" type="number" min="0" required />
                <label className="grid gap-2 text-sm font-medium">
                  Category
                  <select
                    name="category"
                    required
                    defaultValue={activeCategoryForProducts}
                    className="min-h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3"
                  >
                    {sortedCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name_en}
                      </option>
                    ))}
                  </select>
                </label>
                <ImageUploader
                  onSelect={async (file) =>
                    setImageUrl(
                      await restaurantService.uploadImage(session!, data.restaurant!.id, file),
                    )
                  }
                />
              </>
            )}
            <div className="flex items-end gap-2">
              <Button type="submit" loading={saveProduct.isPending || saveCategory.isPending}>
                Save
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
            {(saveProduct.error || saveCategory.error) && (
              <p className="text-sm text-[var(--danger)]">
                {(saveProduct.error || saveCategory.error)?.message}
              </p>
            )}
          </form>
        </Card>
      )}

      {tab === "products" ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--ink-soft)]">Category:</span>
              <select
                aria-label="Filter products by category"
                value={activeCategoryForProducts}
                onChange={(e) => setSelectedCatId(e.target.value)}
                className="min-h-10 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold"
              >
                {sortedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name_en} ({data.products.filter((p) => !p.deleted_at && p.category_id === cat.id).length})
                  </option>
                ))}
              </select>
            </div>
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search products…"
              leading={<Search className="size-4" />}
              className="max-w-sm"
            />
          </div>

          <div className="grid gap-3">
            {filteredProducts.length ? (
              filteredProducts.map((product, index) => (
                <Card
                  key={product.id}
                  draggable
                  onDragStart={() => setDraggedProdIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedProdIndex !== null && draggedProdIndex !== index) {
                      moveProduct(draggedProdIndex, index);
                    }
                    setDraggedProdIndex(null);
                  }}
                  className={`flex min-w-0 items-center gap-4 p-3 transition ${
                    draggedProdIndex === index ? "opacity-50 ring-2 ring-[var(--accent)]" : ""
                  }`}
                >
                  <ReorderableControls
                    label={product.name_en}
                    index={index}
                    total={productsInActiveCategory.length}
                    onMoveUp={() => moveProduct(index, index - 1)}
                    onMoveDown={() => moveProduct(index, index + 1)}
                    isDragging={draggedProdIndex === index}
                  />

                  <img
                    src={product.image_url}
                    alt=""
                    className="size-16 shrink-0 rounded-xl object-cover sm:size-20"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-extrabold">{product.name_en}</p>
                      {!product.is_available && (
                        <Badge className="bg-[var(--danger-soft)] text-[var(--danger)]">
                          Unavailable
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-[var(--ink-soft)]">
                      {product.description_en}
                    </p>
                    <p className="mt-2 text-sm font-black text-[var(--accent)]">
                      {product.price} EGP
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      saveProduct.mutate({
                        value: { ...product, is_available: !product.is_available },
                        isNew: false,
                      })
                    }
                    title="Toggle availability"
                  >
                    {product.is_available ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void restaurantService.deleteProduct(session!, product).then(refresh)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </Card>
              ))
            ) : (
              <p className="p-6 text-sm text-[var(--ink-soft)]">No products in this category.</p>
            )}
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedCategories.map((category, index) => (
            <Card
              key={category.id}
              draggable
              onDragStart={() => setDraggedCatIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedCatIndex !== null && draggedCatIndex !== index) {
                  moveCategory(draggedCatIndex, index);
                }
                setDraggedCatIndex(null);
              }}
              className={`flex items-center gap-3 p-4 transition ${
                draggedCatIndex === index ? "opacity-50 ring-2 ring-[var(--accent)]" : ""
              }`}
            >
              <ReorderableControls
                label={category.name_en}
                index={index}
                total={sortedCategories.length}
                onMoveUp={() => moveCategory(index, index - 1)}
                onMoveDown={() => moveCategory(index, index + 1)}
                isDragging={draggedCatIndex === index}
              />
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--accent-soft)] font-black text-[var(--accent)]">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{category.name_en}</p>
                <p className="text-sm text-[var(--ink-soft)]">{category.name_ar}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  saveCategory.mutate({
                    value: { ...category, is_visible: !category.is_visible },
                    isNew: false,
                  })
                }
              >
                {category.is_visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void restaurantService.deleteCategory(session!, category).then(refresh)}
              >
                <Trash2 className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
function Analytics({ restaurantId }: { restaurantId: string }) {
  const { session } = useAuth(); const query = useQuery({ queryKey: ["analytics", restaurantId], queryFn: () => restaurantService.analytics(session!, restaurantId) });
  const [now] = useState(() => Date.now());
  if (query.isLoading) return <LoadingState />; if (!query.data?.enabled) return <Card className="grid min-h-80 place-items-center p-8 text-center"><div className="max-w-sm"><BarChart3 className="mx-auto size-8 text-[var(--accent)]" /><h2 className="mt-4 text-xl font-black">Analytics unlocks on Basic</h2><p className="mt-2 text-sm text-[var(--ink-soft)]">Contact NEXMENU to switch plans. There is no online checkout.</p></div></Card>;
  const grouped = Array.from({ length: 7 }, (_, offset) => { const date = new Date(now - (6 - offset) * 86_400_000); const key = date.toISOString().slice(0, 10); return { day: date.toLocaleDateString("en", { weekday: "short" }), views: query.data!.events.filter((item) => item.event_type === "menu_view" && item.created_at.slice(0, 10) === key).length, scans: query.data!.events.filter((item) => item.event_type === "qr_scan" && item.created_at.slice(0, 10) === key).length }; });
  return <div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-3"><Stat label="Menu views" value={query.data.events.filter((item) => item.event_type === "menu_view").length} icon={Eye} /><Stat label="QR scans" value={query.data.events.filter((item) => item.event_type === "qr_scan").length} icon={QrIcon} /><Stat label="Product views" value={query.data.events.filter((item) => item.event_type === "product_view").length} icon={Package} /></div><Card className="p-5"><h2 className="font-black">Last 7 days</h2><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={grouped}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="views" fill="var(--accent)" radius={[6, 6, 0, 0]} /><Bar dataKey="scans" fill="var(--gold)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></Card></div>;
}
function QrManager({ data }: { data: Details }) {
  const { session } = useAuth(); const [qr, setQr] = useState(""); const [target, setTarget] = useState("");
  const generate = async (branchId?: string) => { const value = await restaurantService.qr(session!, data.restaurant!.id, branchId); setTarget(value.target_url); setQr(await QRCode.toDataURL(value.target_url, { width: 720, margin: 2, color: { dark: "#17221d", light: "#ffffff" } })); };
  const download = () => { const anchor = document.createElement("a"); anchor.href = qr; anchor.download = `${data.restaurant!.slug}-qr.png`; anchor.click(); };
  const downloadSvg = async () => { const svg = await QRCode.toString(target, { type: "svg", margin: 2, color: { dark: "#17221d", light: "#ffffff" } }); const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${data.restaurant!.slug}-qr.svg`; anchor.click(); URL.revokeObjectURL(url); };
  return <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><Card className="p-6"><p className="text-sm font-bold text-[var(--accent)]">MENU QR</p><h2 className="mt-2 text-2xl font-black">One scan to your menu</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Generate a QR for your main menu or a branch. Every scan opens the public menu directly.</p><div className="mt-6 grid gap-2"><Button onClick={() => void generate()}><QrIcon className="size-4" />Generate main QR</Button>{data.branches.map((branch) => <Button key={branch.id} variant="secondary" onClick={() => void generate(branch.id)}>{branch.name_en}</Button>)}</div></Card><Card className="grid min-h-96 place-items-center p-6">{qr ? <div className="w-full max-w-sm text-center"><div className="rounded-3xl border border-[var(--line)] bg-white p-6"><img src={data.restaurant?.logo_url} alt="" className="mx-auto mb-3 size-12 rounded-xl" /><p className="font-black">{data.restaurant?.name_en}</p><p className="mb-4 mt-1 text-xs text-[var(--ink-soft)]">Scan to view our menu</p><img src={qr} alt="Restaurant menu QR" className="mx-auto aspect-square w-full max-w-64" /><p className="mt-3 text-xs font-black tracking-[.18em]">NEXMENU</p></div><p className="mt-4 truncate text-xs text-[var(--ink-soft)]">{target}</p><div className="mt-4 flex flex-wrap justify-center gap-2"><Button onClick={download}><Download className="size-4" />PNG</Button><Button variant="secondary" onClick={() => void downloadSvg()}><Download className="size-4" />SVG</Button><Button variant="secondary" onClick={() => void navigator.clipboard.writeText(target)}><Copy className="size-4" />Copy URL</Button><Button variant="secondary" onClick={() => print()}><Printer className="size-4" />Print</Button></div></div> : <div className="text-center text-[var(--ink-soft)]"><QrIcon className="mx-auto size-10 opacity-30" /><p className="mt-3 text-sm">Generate a QR to preview it here.</p></div>}</Card></div>;
}
function BrandingManager({ branding }: { branding?: Branding }) {
  const { session } = useAuth();
  const client = useQueryClient();
  const [value, setValue] = useState(branding);

  if (!value) return <ErrorState body="Branding settings are missing." />;

  const textBgAudit = evaluateContrast(value.text_color, value.background_color, 4.5);
  const buttonAudit = evaluateContrast("#ffffff", value.primary_color, 4.5);
  const isBlocked = textBgAudit.isBlocked || buttonAudit.isBlocked;
  const hasWarning = !isBlocked && (!textBgAudit.passesNormalAa || !buttonAudit.passesNormalAa);

  const save = async () => {
    if (isBlocked) return;
    await restaurantService.saveBranding(session!, value);
    await client.invalidateQueries({ queryKey: ["restaurant", value.restaurant_id] });
  };

  return (
    <Card className="p-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-black">Make it unmistakably yours</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Templates only change presentation. Your menu data stays intact.
          </p>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-bold">
              Template
              <select
                value={value.template}
                onChange={(e) =>
                  setValue({ ...value, template: e.target.value as Branding["template"] })
                }
                className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3"
              >
                {["Modern", "Minimal", "Elegant", "Cafe", "Restaurant", "Fast Food"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Primary", "primary_color"],
                ["Background", "background_color"],
                ["Text", "text_color"],
                ["Secondary", "secondary_color"],
              ].map(([label, field]) => (
                <label key={field} className="grid gap-2 text-sm font-bold">
                  {label}
                  <input
                    type="color"
                    value={String(value[field as keyof Branding])}
                    onChange={(e) => setValue({ ...value, [field]: e.target.value })}
                    className="h-12 w-full rounded-xl border border-[var(--line)] bg-white p-1"
                  />
                </label>
              ))}
            </div>

            {/* Accessibility & Contrast (WCAG 2.1) Audit */}
            <div className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[var(--ink)]">WCAG 2.1 Contrast Audit</span>
                {isBlocked ? (
                  <Badge className="bg-rose-100 text-rose-800">Critical Fail (&lt; 3:1)</Badge>
                ) : hasWarning ? (
                  <Badge className="bg-amber-100 text-amber-800">Warning (AA Large)</Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800">AA Passed</Badge>
                )}
              </div>

              {/* Text / Background */}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
                <div>
                  <p className="font-bold text-[var(--ink)]">Text on Background</p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    Contrast: <span className="font-mono font-bold">{textBgAudit.formattedRatio}</span>
                  </p>
                </div>
                <Badge
                  className={
                    textBgAudit.passesNormalAa
                      ? "bg-emerald-100 text-emerald-800"
                      : textBgAudit.passesLargeAa
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                  }
                >
                  {textBgAudit.passesNormalAa
                    ? "Pass (4.5:1+)"
                    : textBgAudit.passesLargeAa
                      ? "Large Only (3:1+)"
                      : "Fail (< 3:1)"}
                </Badge>
              </div>
              {textBgAudit.suggestedAlternative && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--muted)] p-2.5 text-xs">
                  <span>
                    Suggested accessible text: <code className="font-mono font-bold">{textBgAudit.suggestedAlternative}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setValue({ ...value, text_color: textBgAudit.suggestedAlternative! })
                    }
                    className="rounded-lg bg-[var(--accent)] px-2.5 py-1 font-bold text-white hover:brightness-95"
                  >
                    Apply
                  </button>
                </div>
              )}

              {/* Button (Primary) / White Text */}
              <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
                <div>
                  <p className="font-bold text-[var(--ink)]">Button (Primary) / Text</p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    Contrast: <span className="font-mono font-bold">{buttonAudit.formattedRatio}</span>
                  </p>
                </div>
                <Badge
                  className={
                    buttonAudit.passesNormalAa
                      ? "bg-emerald-100 text-emerald-800"
                      : buttonAudit.passesLargeAa
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                  }
                >
                  {buttonAudit.passesNormalAa
                    ? "Pass (4.5:1+)"
                    : buttonAudit.passesLargeAa
                      ? "Large Only (3:1+)"
                      : "Fail (< 3:1)"}
                </Badge>
              </div>

              {/* Warnings and Block Notices */}
              {isBlocked && (
                <p className="mt-3 text-xs font-bold text-rose-600">
                  Saving is blocked: Contrast ratio is below 3.0:1. Text will be unreadable on mobile screens in sunlight. Please choose higher-contrast colors.
                </p>
              )}
              {hasWarning && (
                <p className="mt-3 text-xs font-medium text-amber-700">
                  Warning: Colors meet 3.0:1 minimum for large text, but fall short of 4.5:1 for standard menu descriptions.
                </p>
              )}
            </div>

            <Button onClick={() => void save()} disabled={isBlocked}>
              Save branding
            </Button>
          </div>
        </div>
        <div style={{ background: value.background_color, color: value.text_color }} className="min-h-96 rounded-3xl p-5">
          <div style={{ background: value.primary_color }} className="rounded-2xl p-6 text-white">
            <p className="text-xs font-bold opacity-70">{value.template.toUpperCase()}</p>
            <p className="mt-12 text-3xl font-black">Cafe Moon</p>
            <p className="mt-2 text-sm opacity-75">Your menu, beautifully yours.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[1, 2].map((item) => (
              <div key={item} className="rounded-2xl bg-white/70 p-3">
                <div className="aspect-square rounded-xl bg-black/10" />
                <p className="mt-3 font-bold">Menu item</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
function SettingsManager({ data }: { data: Details }) {
  const { session } = useAuth(); const client = useQueryClient(); const [restaurant, setRestaurant] = useState(data.restaurant);
  if (!restaurant) return <ErrorState body="Restaurant settings are missing." />;
  const save = async (event: FormEvent) => { event.preventDefault(); await restaurantService.saveRestaurant(session!, restaurant); await client.invalidateQueries({ queryKey: ["restaurant", restaurant.id] }); };
  return <form onSubmit={(event) => void save(event)} className="grid gap-6 xl:grid-cols-[1fr_.6fr]"><Card className="p-6"><h2 className="text-xl font-black">Restaurant profile</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">Public contact links only. WhatsApp does not create an order flow.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Input label="English name" value={restaurant.name_en} onChange={(e) => setRestaurant({ ...restaurant, name_en: e.target.value })} /><Input label="Arabic name" value={restaurant.name_ar} onChange={(e) => setRestaurant({ ...restaurant, name_ar: e.target.value })} /><Input label="Phone" value={restaurant.phone} onChange={(e) => setRestaurant({ ...restaurant, phone: e.target.value })} /><Input label="WhatsApp contact" value={restaurant.whatsapp} onChange={(e) => setRestaurant({ ...restaurant, whatsapp: e.target.value })} /><Input label="Address" value={restaurant.address_en} onChange={(e) => setRestaurant({ ...restaurant, address_en: e.target.value })} /><Input label="Google Maps URL" type="url" value={restaurant.maps_url} onChange={(e) => setRestaurant({ ...restaurant, maps_url: e.target.value })} /><Input label="Website" type="url" value={restaurant.website} onChange={(e) => setRestaurant({ ...restaurant, website: e.target.value })} /><label className="grid gap-2 text-sm font-bold">Menu status<select value={restaurant.menu_status} onChange={(e) => setRestaurant({ ...restaurant, menu_status: e.target.value as typeof restaurant.menu_status })} className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3"><option>DRAFT</option><option>PUBLISHED</option><option>PAUSED</option></select></label></div><Button type="submit" className="mt-6">Save changes</Button></Card><Card className="p-6"><h2 className="font-black">Data tools</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">Export this browser’s entire local workspace as JSON.</p><Button variant="secondary" className="mt-5 w-full" type="button" onClick={() => void restaurantService.exportData(session!).then((value) => { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "nexmenu-local-export.json"; a.click(); URL.revokeObjectURL(url); })}><FileDown className="size-4" />Export local data</Button></Card></form>;
}
function SubscriptionView({ data }: { data: Details }) {
  const subscription = data.subscription; const plan = PLANS[subscription?.plan ?? "FREE"];
  return <div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]"><Card className="overflow-hidden bg-[var(--ink)] p-7 text-white"><p className="text-xs font-bold tracking-[.15em] text-[var(--accent-bright)]">CURRENT PLAN</p><p className="mt-4 text-4xl font-black">{plan.name}</p><p className="mt-3 text-sm text-white/55">{subscription?.status ?? "ACTIVE"} · Renews manually</p><div className="mt-10 border-t border-white/10 pt-5 text-sm text-white/55"><p>Start: {subscription ? new Date(subscription.starts_at).toLocaleDateString() : "—"}</p><p className="mt-2">Expires: {subscription ? new Date(subscription.expires_at).toLocaleDateString() : "—"}</p></div></Card><Card className="p-7"><h2 className="text-xl font-black">Plan capabilities</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{[[plan.productLimit ? `${plan.productLimit} products` : "Unlimited products", true], [plan.branchLimit ? `${plan.branchLimit} branches` : "Unlimited branches", true], ["Menu analytics", plan.analytics], ["Advanced branding", plan.advancedBranding], ["Remove NEXMENU branding", plan.hideBranding]].map(([label, enabled]) => <div key={String(label)} className="flex min-h-14 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"><span className={enabled ? "grid size-6 place-items-center rounded-full bg-[var(--accent)] text-white" : "grid size-6 place-items-center rounded-full bg-[var(--line)] text-[var(--ink-faint)]"}><Check className="size-3.5" /></span><p className="text-sm font-bold">{String(label)}</p></div>)}</div><p className="mt-6 text-sm text-[var(--ink-soft)]">To change your plan, contact NEXMENU. Plans are assigned manually; there is no online payment.</p></Card></div>;
}
function OffersView({ data }: { data: Details }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.offers.map((offer) => <Card key={offer.id} className="p-5"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Gift className="size-5" /></span><Badge>{offer.is_active ? "ACTIVE" : "HIDDEN"}</Badge></div><h2 className="mt-5 text-lg font-black">{offer.title_en}</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{offer.description_en}</p><p className="mt-4 text-xs font-bold text-[var(--ink-faint)]">Ends {new Date(offer.ends_at).toLocaleDateString()}</p></Card>)}</div>;
}
function BranchesView({ data }: { data: Details }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.branches.map((branch) => <Card key={branch.id} className="p-5"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Store className="size-5" /></span><Badge>ACTIVE</Badge></div><h2 className="mt-5 text-lg font-black">{branch.name_en}</h2><p className="mt-1 text-sm text-[var(--ink-soft)]">{branch.address_en}</p><p className="mt-4 text-sm font-bold">{branch.phone}</p></Card>)}</div>;
}
function TeamView({ data }: { data: Details }) {
  const { session } = useAuth(); const client = useQueryClient(); const [email, setEmail] = useState(""); const [error, setError] = useState("");
  const invite = async (event: FormEvent) => { event.preventDefault(); setError(""); try { await restaurantService.invite(session!, data.restaurant!.id, email, "STAFF"); setEmail(""); await client.invalidateQueries({ queryKey: ["restaurant", data.restaurant!.id] }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add member."); } };
  return <div className="grid gap-6 xl:grid-cols-[1fr_.5fr]"><div className="grid gap-3">{data.members.map((member) => <Card key={member.id} className="flex items-center gap-4 p-4"><span className="grid size-11 place-items-center rounded-full bg-[var(--accent-soft)] font-black text-[var(--accent)]">{member.email[0].toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{member.email}</p><p className="text-xs text-[var(--ink-soft)]">{member.role.replace("RESTAURANT_", "").replace("_", " ")}</p></div><Badge>{member.status}</Badge></Card>)}</div><Card className="h-fit p-5"><h2 className="font-black">Add team member</h2><p className="mt-2 text-xs leading-5 text-[var(--ink-soft)]">Local mode creates a pending membership. No email is sent.</p><form onSubmit={(event) => void invite(event)} className="mt-5 grid gap-3"><Input type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />{error && <p className="text-xs text-[var(--danger)]">{error}</p>}<Button type="submit"><Plus className="size-4" />Add as staff</Button></form></Card></div>;
}
