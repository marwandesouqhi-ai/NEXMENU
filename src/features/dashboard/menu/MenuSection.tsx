import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { ReorderableControls } from "@/components/shared/ReorderableControls";
import type { Category, Product } from "@/types/domain";
import type { DashboardDetails } from "../types";

export function MenuSection({ data }: { data: DashboardDetails }) {
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
    onSuccess: () => {
      setShowForm(false);
      void refresh();
    },
  });

  const saveCategory = useMutation({
    mutationFn: ({ value, isNew }: { value: Category; isNew: boolean }) =>
      restaurantService.saveCategory(session!, value, isNew),
    onSuccess: () => {
      setShowForm(false);
      void refresh();
    },
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
                    {cat.name_en} (
                    {data.products.filter((p) => !p.deleted_at && p.category_id === cat.id).length})
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
                    {product.is_available ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      void restaurantService.deleteProduct(session!, product).then(refresh)
                    }
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
                onClick={() =>
                  void restaurantService.deleteCategory(session!, category).then(refresh)
                }
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

export default MenuSection;
