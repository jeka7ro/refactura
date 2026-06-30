// HorecaMenu — Meniu cu 3 tab-uri: Categorii / Produse / Rețete
// Proper Light/Dark mode styling (Premium UI)

import { useState, useEffect } from "react";
import {
  UtensilsCrossed,
  Plus,
  Pencil,
  Trash2,
  ChefHat,
  BookOpen,
  Tag,
  Loader2,
  Check,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Link as LinkIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/store";

export default function HorecaMenu() {
  const [activeTab, setActiveTab] = useState<
    "categories" | "items" | "recipes" | "syrve"
  >("syrve");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [syrveBrand, setSyrveBrand] = useState("rollmaster");

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  // Smart Kiosk Bridge — Syrve menu
  const { data: syrveMenu, isLoading: syrveLoading } =
    trpc.horeca.kioskBridge.getMenu.useQuery(
      { brandId: syrveBrand },
      { enabled: activeTab === "syrve", refetchOnWindowFocus: false }
    );
  const syrveCategories = syrveMenu?.categories || [];
  const syrveProducts = syrveMenu?.products || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Management Meniu
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Categorii, Produse, Rețete & Meniu Syrve Live
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab === "syrve" && (
            <select
              value={syrveBrand}
              onChange={e => setSyrveBrand(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-full text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
            >
              <option value="rollmaster">Roll Master</option>
              <option value="lovesushi">Love Sushi</option>
              <option value="pokiwoki">Poki Woki</option>
              <option value="smashme">SmashMe</option>
              <option value="crunch">Crunch</option>
            </select>
          )}
          {activeTab !== "syrve" && locations.length > 1 && (
            <select
              value={locationId}
              onChange={e => setSelectedLocationId(Number(e.target.value))}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-full text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-fit shadow-sm">
        <button
          onClick={() => setActiveTab("syrve")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "syrve" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
        >
          <LinkIcon className="w-4 h-4" /> Syrve Live ({syrveProducts.length})
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "categories" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
        >
          <Tag className="w-4 h-4" /> Categorii
        </button>
        <button
          onClick={() => setActiveTab("items")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "items" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
        >
          <UtensilsCrossed className="w-4 h-4" /> Produse & Prețuri
        </button>
        <button
          onClick={() => setActiveTab("recipes")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${activeTab === "recipes" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
        >
          <ChefHat className="w-4 h-4" /> Rețetar
        </button>
      </div>

      {/* Alert Warning pentru Rețetar */}
      {activeTab === "recipes" && (
        <div className="bg-amber-50 dark:bg-yellow-500/10 border border-amber-200 dark:border-yellow-500/20 text-amber-800 dark:text-yellow-400 p-4 rounded-xl flex gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm font-medium">
            <p className="font-bold mb-1">
              Atenție: Rețetarul scade stocurile automat!
            </p>
            <p className="opacity-90 leading-snug">
              Asigură-te că ingredientele sunt definite în modulul de
              Gestiune/Stocuri înainte de a construi rețete. Când un produs este
              vândut, ingredientele aferente vor fi scăzute proporțional.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {activeTab === "syrve" && (
          <div className="p-6">
            {syrveLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-white">
                      {syrveProducts.length}
                    </strong>{" "}
                    produse în{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {syrveCategories.length}
                    </strong>{" "}
                    categorii — brand{" "}
                    <strong className="text-blue-600">{syrveBrand}</strong>
                  </p>
                  <span className="text-xs text-amber-600 font-semibold">
                    READ-ONLY din Syrve (iiko)
                  </span>
                </div>

                {/* Categories pills */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {syrveCategories.map((c: any) => (
                    <span
                      key={c.id || c.name}
                      className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>

                {/* Products table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr className="text-slate-600 dark:text-slate-400 text-left text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-semibold text-center w-12">
                          Nr.
                        </th>
                        <th className="px-4 py-3 font-semibold w-16">Foto</th>
                        <th className="px-4 py-3 font-semibold">Produs</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Preț
                        </th>
                        <th className="px-4 py-3 font-semibold">Categorie</th>
                        <th className="px-4 py-3 font-semibold">
                          Modificatori
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {syrveProducts.map((p: any, idx: number) => (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-4 py-2.5 text-center text-slate-400 text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2.5">
                            {p.image ? (
                              <img
                                src={
                                  p.image?.startsWith("http")
                                    ? p.image
                                    : `http://localhost:4000/api/image-proxy?url=${encodeURIComponent(p.image)}`
                                }
                                alt={p.name}
                                className="w-10 h-10 rounded-lg object-cover bg-slate-100"
                                onError={e => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                                —
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {p.name}
                            </span>
                            {p.description && (
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                {p.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-blue-600 dark:text-blue-400">
                            {p.price} RON
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                              {p.categoryName || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {p.modifierGroups && p.modifierGroups.length > 0 ? (
                              <span className="text-xs text-green-600 font-semibold">
                                {p.modifierGroups.length} grupe
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 px-4 py-2 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
                  Total: <strong>{syrveProducts.length}</strong> produse afișate
                </div>
              </>
            )}
          </div>
        )}
        {activeTab === "categories" && (
          <CategoriesTab locationId={locationId} />
        )}
        {activeTab === "items" && <ItemsTab locationId={locationId} />}
        {activeTab === "recipes" && <RecipesTab locationId={locationId} />}
      </div>
    </div>
  );
}

function CategoriesTab({ locationId }: { locationId: number }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    icon: "🍽️",
    sortOrder: 0,
  });

  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } =
    trpc.horeca.menu.listCategories.useQuery(
      { locationId },
      { enabled: locationId > 0 }
    );
  const createMut = trpc.horeca.menu.createCategory.useMutation({
    onSuccess: () => {
      toast.success("Categorie salvată");
      utils.horeca.menu.listCategories.invalidate();
      setShowForm(false);
      setForm({ name: "", description: "", icon: "🍽️", sortOrder: 0 });
    },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.horeca.menu.deleteCategory.useMutation({
    onSuccess: () => {
      toast.success("Categorie ștearsă");
      utils.horeca.menu.listCategories.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div>
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Categorii Meniu
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors shadow-sm"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Anulează" : "Categorie nouă"}
        </button>
      </div>

      {showForm && (
        <div className="p-5 bg-blue-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
                Nume *
              </label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Pizza"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none shadow-sm"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
                Icon (Emoji)
              </label>
              <input
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="🍕"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none shadow-sm"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
                Ordine
              </label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={e =>
                  setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))
                }
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none shadow-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => createMut.mutate({ locationId, ...form })}
                disabled={createMut.isPending || !form.name.trim()}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors shadow-sm"
              >
                {createMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}{" "}
                Salvează
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr className="text-slate-600 dark:text-slate-400 text-left font-semibold">
              <th className="px-4 py-3 uppercase tracking-wider text-xs">
                Icon
              </th>
              <th className="px-4 py-3 uppercase tracking-wider text-xs">
                Nume Categorie
              </th>
              <th className="px-4 py-3 uppercase tracking-wider text-xs">
                Ordine
              </th>
              <th className="px-4 py-3 uppercase tracking-wider text-xs text-right">
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {categories.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="p-8 text-center text-slate-500 dark:text-slate-400"
                >
                  Nu există categorii. Adaugă prima categorie.
                </td>
              </tr>
            )}
            {categories.map(c => (
              <tr
                key={c.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-4 py-3 text-2xl">{c.icon}</td>
                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white text-base">
                  {c.name}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">
                  {c.sortOrder}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      if (confirm("Ștergi?")) deleteMut.mutate({ id: c.id });
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ItemsTab({ locationId }: { locationId: number }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 15;
  const { data: items = [], isLoading } = trpc.horeca.menu.listItems.useQuery(
    { locationId },
    { enabled: locationId > 0 }
  );
  const { data: categories = [] } = trpc.horeca.menu.listCategories.useQuery(
    { locationId },
    { enabled: locationId > 0 }
  );
  const utils = trpc.useUtils();

  const initialForm = {
    categoryId: 0,
    name: "",
    description: "",
    price: 0,
    vatRate: 9,
    unit: "portie",
    isAvailableDineIn: true,
    isAvailableTakeaway: true,
    isAvailableDelivery: true,
  };
  const [form, setForm] = useState(initialForm);

  const createMut = trpc.horeca.menu.createItem.useMutation({
    onSuccess: () => {
      toast.success("Produs salvat");
      utils.horeca.menu.listItems.invalidate();
      setShowForm(false);
      setForm(initialForm);
    },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.horeca.menu.deleteItem.useMutation({
    onSuccess: () => {
      toast.success("Produs șters");
      utils.horeca.menu.listItems.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const filtered = items.filter(
    i => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  );

  return (
    <div>
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Produse Meniu
        </h2>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Caută produs..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none shadow-sm rounded-full"
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
          >
            {showForm ? (
              <X className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {showForm ? "Anulează" : "Produs nou"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-5 bg-blue-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
                Nume *
              </label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none shadow-sm"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
                Categorie *
              </label>
              <select
                value={form.categoryId}
                onChange={e =>
                  setForm(f => ({ ...f, categoryId: Number(e.target.value) }))
                }
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none shadow-sm"
              >
                <option value={0}>— Selectează —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
                Preț cu TVA (RON) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={e =>
                  setForm(f => ({ ...f, price: Number(e.target.value) }))
                }
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-bold focus:border-blue-500 focus:outline-none shadow-sm"
              />
            </div>
            <div className="md:col-span-4 grid grid-cols-3 gap-4 border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={form.isAvailableDineIn}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      isAvailableDineIn: e.target.checked,
                    }))
                  }
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
                Disponibil La Masă
              </label>
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={form.isAvailableTakeaway}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      isAvailableTakeaway: e.target.checked,
                    }))
                  }
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
                Disponibil Ridicare
              </label>
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={form.isAvailableDelivery}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      isAvailableDelivery: e.target.checked,
                    }))
                  }
                  className="rounded text-blue-500 focus:ring-blue-500"
                />
                Disponibil Delivery
              </label>
            </div>
            <div className="md:col-span-4 flex justify-end mt-2">
              <button
                onClick={() => createMut.mutate({ locationId, ...form })}
                disabled={
                  createMut.isPending || !form.name.trim() || !form.categoryId
                }
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
              >
                {createMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}{" "}
                Salvează
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr className="text-slate-600 dark:text-slate-400 text-left font-semibold">
              <th className="px-3 py-3 w-12 text-center text-xs uppercase tracking-wider">
                Nr.
              </th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">
                Produs
              </th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">
                Categorie
              </th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">
                Preț
              </th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">
                Canale Disponibile
              </th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider text-right">
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginated.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-slate-500 dark:text-slate-400"
                >
                  Nu am găsit produse.
                </td>
              </tr>
            )}
            {paginated.map((item, idx) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-3 py-3 text-center text-slate-400 dark:text-slate-500 font-medium">
                  {(safePage - 1) * rowsPerPage + idx + 1}
                </td>
                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white text-base">
                  {item.name}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                  {categories.find(c => c.id === item.categoryId)?.name || "—"}
                </td>
                <td className="px-4 py-3 font-black text-blue-600 dark:text-blue-400 text-base">
                  {formatCurrency(Number(item.price), "RON")}
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex gap-1.5">
                    {item.isAvailableDineIn && (
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded font-bold border border-slate-200 dark:border-slate-700 shadow-sm">
                        Masă
                      </span>
                    )}
                    {item.isAvailableTakeaway && (
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded font-bold border border-slate-200 dark:border-slate-700 shadow-sm">
                        Pick-up
                      </span>
                    )}
                    {item.isAvailableDelivery && (
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded font-bold border border-slate-200 dark:border-slate-700 shadow-sm">
                        Deliv
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      if (confirm("Ștergi?")) deleteMut.mutate({ id: item.id });
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Footer paginare */}
      <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          Total:{" "}
          <strong className="text-slate-900 dark:text-white">
            {filtered.length}
          </strong>{" "}
          produse
        </span>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            Pagina {safePage} din {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecipesTab({ locationId }: { locationId: number }) {
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const { data: items = [], isLoading: loadingItems } =
    trpc.horeca.menu.listItems.useQuery(
      { locationId },
      { enabled: locationId > 0 }
    );
  const { data: categories = [] } = trpc.horeca.menu.listCategories.useQuery(
    { locationId },
    { enabled: locationId > 0 }
  );

  const selectedItem = items.find(i => i.id === selectedItemId);

  return (
    <div className="flex flex-col md:flex-row h-[700px] divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
      {/* Sidebar - Lista Produse */}
      <div className="w-full md:w-1/3 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">
            Alege Produsul
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selectează un produs pentru a-i construi rețeta și a calcula Food
            Cost-ul.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {loadingItems ? (
            <div className="p-4 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : (
            items.map(item => {
              const cat = categories.find(c => c.id === item.categoryId);
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex justify-between items-center ${selectedItemId === item.id ? "bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 font-bold shadow-sm border border-blue-200 dark:border-blue-500/30" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent"}`}
                >
                  <div className="truncate">
                    <span>{cat?.icon}</span> {item.name}
                  </div>
                  {item.hasRecipe === 1 ? (
                    <Check
                      className="w-4 h-4 text-emerald-500 flex-shrink-0"
                      title="Are rețetă configurată"
                    />
                  ) : (
                    <AlertCircle
                      className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0"
                      title="Nu are rețetă"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content - Editor Rețetă */}
      <div className="w-full md:w-2/3 flex flex-col bg-white dark:bg-slate-900">
        {!selectedItemId || !selectedItem ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8 text-center">
            <ChefHat className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              Niciun produs selectat
            </p>
            <p className="text-sm mt-1">
              Alege un produs din lista din stânga pentru a-i edita
              ingredientele.
            </p>
          </div>
        ) : (
          <RecipeBuilder item={selectedItem} locationId={locationId} />
        )}
      </div>
    </div>
  );
}

function RecipeBuilder({
  item,
  locationId,
}: {
  item: any;
  locationId: number;
}) {
  const utils = trpc.useUtils();
  const { data: recipeLines = [], isLoading } =
    trpc.horeca.menu.getRecipe.useQuery(
      { menuItemId: item.id },
      { enabled: !!item.id }
    );
  const { data: erpProducts = [] } = trpc.products.list.useQuery();

  const [lines, setLines] = useState<any[]>([]);

  // Sync state when data loads
  useEffect(() => {
    if (recipeLines) setLines(recipeLines);
  }, [recipeLines, item.id]);

  const upsertMut = trpc.horeca.menu.upsertRecipe.useMutation({
    onSuccess: () => {
      toast.success("Rețetă salvată cu succes!");
      utils.horeca.menu.listItems.invalidate();
      utils.horeca.menu.getRecipe.invalidate({ menuItemId: item.id });
    },
    onError: e => toast.error(e.message),
  });

  function addLine() {
    setLines([
      ...lines,
      {
        ingredientName: "",
        productId: null,
        quantity: 1,
        unit: "g",
        unitCost: 0,
        sortOrder: lines.length,
      },
    ]);
  }

  function updateLine(idx: number, field: string, val: any) {
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], [field]: val };

    // Auto-fill nume dacă selectăm un produs ERP
    if (field === "productId" && val) {
      const prod = erpProducts.find(p => p.id === Number(val));
      if (prod) {
        newLines[idx].ingredientName = prod.name;
        newLines[idx].unitCost = prod.defaultPrice || 0; // Aproximare cost de la defaultPrice
      }
    }
    setLines(newLines);
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  function handleSave() {
    const validLines = lines.filter(l => l.ingredientName.trim() !== "");
    upsertMut.mutate({ menuItemId: item.id, lines: validLines });
  }

  // Calcul Food Cost
  const totalCost = lines.reduce(
    (sum, l) => sum + Number(l.quantity) * Number(l.unitCost || 0),
    0
  );
  const price = Number(item.price) || 0;
  const vatRate = Number(item.vatRate) || 9;
  const netPrice = price / (1 + vatRate / 100);
  const foodCostPct = netPrice > 0 ? (totalCost / netPrice) * 100 : 0;

  const isGoodFc = foodCostPct > 0 && foodCostPct <= 30;
  const isWarnFc = foodCostPct > 30 && foodCostPct <= 40;
  const isBadFc = foodCostPct > 40;

  if (isLoading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Rețetar: {item.name}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Preț vânzare (TVA {vatRate}% inclus):{" "}
            <strong className="text-blue-600 dark:text-blue-400">
              {formatCurrency(price, "RON")}
            </strong>
          </p>
        </div>
        <div
          className={`px-4 py-2 rounded-xl border text-right shadow-sm ${isGoodFc ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20" : isWarnFc ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/20" : isBadFc ? "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20" : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700"}`}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Food Cost (Net)
          </p>
          <div className="flex items-baseline gap-2 justify-end mt-0.5">
            <span
              className={`text-xl font-black ${isGoodFc ? "text-emerald-600 dark:text-emerald-400" : isWarnFc ? "text-yellow-600 dark:text-yellow-400" : isBadFc ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}
            >
              {foodCostPct.toFixed(1)}%
            </span>
            <span className="text-sm font-semibold text-slate-500">
              ({formatCurrency(totalCost, "RON")})
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-lg p-3 mb-4 flex gap-3 text-sm text-blue-800 dark:text-blue-300 shadow-sm">
          <BookOpen className="w-5 h-5 flex-shrink-0" />
          <p>
            Leagă ingredientele de <strong>Stocul ERP (NIR-uri)</strong>{" "}
            selectând produsul din listă, sau tastează manual un nume pentru o
            rețetă teoretică. La comandă, se vor scădea automat cantitățile din
            stoc.
          </p>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-left">
            <tr>
              <th className="px-3 py-2 rounded-tl-lg">
                Ingredient / Produs Stoc ERP
              </th>
              <th className="px-3 py-2">Cantitate</th>
              <th className="px-3 py-2">UM</th>
              <th className="px-3 py-2">Cost Unitar</th>
              <th className="px-3 py-2 text-right">Cost Total</th>
              <th className="px-3 py-2 rounded-tr-lg"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Niciun ingredient adăugat.
                </td>
              </tr>
            )}
            {lines.map((l, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
              >
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-1.5">
                    <select
                      value={l.productId || ""}
                      onChange={e =>
                        updateLine(
                          idx,
                          "productId",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="">-- Produs din Stoc (ERP) --</option>
                      {erpProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {!l.productId && (
                      <input
                        placeholder="Nume ingredient manual"
                        value={l.ingredientName}
                        onChange={e =>
                          updateLine(idx, "ingredientName", e.target.value)
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-xs text-slate-900 dark:text-white"
                      />
                    )}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    step="0.0001"
                    value={l.quantity}
                    onChange={e =>
                      updateLine(idx, "quantity", Number(e.target.value))
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-sm font-bold text-center text-slate-900 dark:text-white focus:border-blue-500"
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    value={l.unit}
                    onChange={e => updateLine(idx, "unit", e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="g">Grame (g)</option>
                    <option value="kg">Kilo (kg)</option>
                    <option value="ml">Mili (ml)</option>
                    <option value="l">Litri (l)</option>
                    <option value="buc">Bucăți</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={l.unitCost}
                    onChange={e =>
                      updateLine(idx, "unitCost", Number(e.target.value))
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-sm text-slate-900 dark:text-white"
                  />
                </td>
                <td className="px-2 py-2 text-right font-bold text-slate-700 dark:text-slate-300">
                  {formatCurrency(
                    Number(l.quantity) * Number(l.unitCost || 0),
                    "RON"
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => removeLine(idx)}
                    className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          onClick={addLine}
          className="mt-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 px-4 py-2 rounded-lg transition-colors border border-blue-200 dark:border-blue-500/30 border-dashed w-full justify-center"
        >
          <Plus className="w-4 h-4" /> Adaugă ingredient
        </button>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
        <button
          onClick={() => {
            if (confirm("Anulezi modificările?")) {
              setLines(recipeLines || []);
            }
          }}
          className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          Anulează
        </button>
        <button
          onClick={handleSave}
          disabled={upsertMut.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
        >
          {upsertMut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}{" "}
          Salvează Rețeta
        </button>
      </div>
    </div>
  );
}
