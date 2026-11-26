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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const HORECA_AI_BASE_URL =
  import.meta.env.VITE_HORECA_AI_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

function getProxiedHorecaImageUrl(imageUrl?: string | null): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  return `${HORECA_AI_BASE_URL}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

function formatSafeDescriptionHtml(raw?: string | null): string {
  if (!raw) return "";
  const escaped = String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\r?\n/g, "<br />");
}

export default function HorecaMenu() {
  const [activeTab, setActiveTab] = useState<
    "categories" | "items" | "recipes" | "syrve"
  >("syrve");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [syrveBrand, setSyrveBrand] = useState("rollmaster");
  const [selectedSyrveProduct, setSelectedSyrveProduct] = useState<any>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

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
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Management meniu
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
            Categorii, produse, rețete & meniu Syrve Live
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === "syrve" && (
            <select
              value={syrveBrand}
              onChange={e => setSyrveBrand(e.target.value)}
              className="apple-pill-control px-3.5 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none cursor-pointer"
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
              className="apple-pill-control px-3.5 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none cursor-pointer"
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

      {/* Tabs inside apple-surface */}
      <div className="apple-surface px-3 py-2.5">
        <div className="apple-segmented flex-wrap !rounded-2xl sm:!rounded-full max-w-full">
          <button
            type="button"
            data-active={activeTab === "syrve"}
            onClick={() => setActiveTab("syrve")}
            className="apple-segmented-item px-3.5 h-8 text-xs tabular-nums"
          >
            <LinkIcon className="w-3.5 h-3.5" /> Syrve Live ({syrveProducts.length})
          </button>
          <button
            type="button"
            data-active={activeTab === "categories"}
            onClick={() => setActiveTab("categories")}
            className="apple-segmented-item px-3.5 h-8 text-xs"
          >
            <Tag className="w-3.5 h-3.5" /> Categorii
          </button>
          <button
            type="button"
            data-active={activeTab === "items"}
            onClick={() => setActiveTab("items")}
            className="apple-segmented-item px-3.5 h-8 text-xs"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" /> Produse & prețuri
          </button>
          <button
            type="button"
            data-active={activeTab === "recipes"}
            onClick={() => setActiveTab("recipes")}
            className="apple-segmented-item px-3.5 h-8 text-xs"
          >
            <ChefHat className="w-3.5 h-3.5" /> Rețetar
          </button>
        </div>
      </div>

      {/* Alert Warning pentru Rețetar */}
      {activeTab === "recipes" && (
        <div className="bg-amber-500/10 dark:bg-amber-500/14 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-4 rounded-2xl flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <p className="font-semibold mb-0.5">
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
      <div className="apple-surface overflow-hidden">
        {activeTab === "syrve" && (
          <div className="p-5 sm:p-6">
            {syrveLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
            ) : selectedSyrveProduct ? (
              <div className="animate-in fade-in zoom-in-95 duration-200 p-2 sm:p-4">
                <button
                  type="button"
                  onClick={() => setSelectedSyrveProduct(null)}
                  className="apple-btn-glass mb-6 inline-flex items-center gap-1.5 px-3.5 h-8 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Înapoi la meniu
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
                  {/* IMAGINE */}
                  <div
                    className="relative rounded-2xl overflow-hidden bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.08] aspect-square flex items-center justify-center cursor-pointer hover:opacity-95 transition-opacity group"
                    onClick={() => {
                      if (selectedSyrveProduct.image) {
                        setFullscreenImage(selectedSyrveProduct.image);
                      }
                    }}
                  >
                    {selectedSyrveProduct.image ? (
                      <>
                        <img
                          src={getProxiedHorecaImageUrl(selectedSyrveProduct.image)}
                          alt={selectedSyrveProduct.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                          <Search className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity" />
                        </div>
                      </>
                    ) : (
                      <UtensilsCrossed className="w-20 h-20 text-[#8e8e93]" />
                    )}
                  </div>

                  {/* DETALII */}
                  <div className="flex flex-col h-full py-2">
                    <span className="inline-block px-3 py-1 bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 text-[#0071e3] dark:text-[#64d2ff] text-xs font-semibold rounded-full w-fit mb-3">
                      {selectedSyrveProduct.categoryName || "Fără categorie"}
                    </span>

                    <h2 className="text-3xl lg:text-4xl font-bold text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight mb-3 tracking-tight">
                      {selectedSyrveProduct.name}
                    </h2>

                    <div className="text-2xl font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-6 pb-6 border-b border-black/[0.06] dark:border-white/[0.08] tabular-nums">
                      {selectedSyrveProduct.price} <span className="text-base text-[#6e6e73] dark:text-[#98989d] font-semibold">RON</span>
                    </div>

                    {selectedSyrveProduct.description && (
                      <div className="mb-8">
                        <h3 className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-2.5">Ingrediente / descriere</h3>
                        <div
                          className="text-[15px] text-[#1d1d1f] dark:text-[#ebebf5] leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: formatSafeDescriptionHtml(selectedSyrveProduct.description) }}
                        />
                      </div>
                    )}

                    {selectedSyrveProduct.modifierGroups && selectedSyrveProduct.modifierGroups.length > 0 && (
                      <div>
                        <h3 className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-3 tabular-nums">Modificatori ({selectedSyrveProduct.modifierGroups.length})</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedSyrveProduct.modifierGroups.map((group: any, idx: number) => (
                            <div key={idx} className="bg-[#f2f2f7] dark:bg-[#2c2c2e] p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                              <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5 text-sm">
                                Grupa {idx + 1}
                              </div>
                              <div className="text-xs text-[#6e6e73] dark:text-[#98989d] space-y-1 tabular-nums">
                                <p>Minim: <strong className="text-[#1d1d1f] dark:text-[#ebebf5]">{group.minQuantity}</strong></p>
                                <p>Maxim: <strong className="text-[#1d1d1f] dark:text-[#ebebf5]">{group.maxQuantity}</strong></p>
                                <p className="text-[11px] mt-1.5 text-[#8e8e93]">ID: {group.modifierId}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                    <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {syrveProducts.length}
                    </strong>{" "}
                    produse în{" "}
                    <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {syrveCategories.length}
                    </strong>{" "}
                    categorii — brand{" "}
                    <strong className="text-primary">{syrveBrand}</strong>
                  </p>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/12 text-amber-700 dark:text-amber-300 font-medium">
                    Read-only din Syrve (iiko)
                  </span>
                </div>

                {/* Categories pills */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {syrveCategories.map((c: any) => (
                    <span
                      key={c.id || c.name}
                      className="bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#ebebf5] px-3 py-1 rounded-full text-xs font-medium border border-black/[0.06] dark:border-white/[0.08]"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>

                {/* Products table */}
                <div className="overflow-x-auto -mx-5 sm:-mx-6">
                  <table className="w-full text-sm">
                    <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-y border-black/[0.05] dark:border-white/[0.07]">
                      <tr className="text-[#6e6e73] dark:text-[#98989d] text-left text-[12px] font-medium">
                        <th className="px-4 py-3 font-medium text-center w-12">
                          Nr.
                        </th>
                        <th className="px-4 py-3 font-medium w-16">Foto</th>
                        <th className="px-4 py-3 font-medium">Produs</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Preț
                        </th>
                        <th className="px-4 py-3 font-medium">Categorie</th>
                        <th className="px-4 py-3 font-medium">
                          Modificatori
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                      {syrveProducts.map((p: any, idx: number) => (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedSyrveProduct(p)}
                          className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-2.5 text-center text-[#8e8e93] text-xs">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2.5">
                            {p.image ? (
                              <img
                                src={getProxiedHorecaImageUrl(p.image)}
                                alt={p.name}
                                className="w-10 h-10 rounded-lg object-cover bg-[#f2f2f7] dark:bg-[#2c2c2e]"
                                onError={e => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#8e8e93] text-xs">
                                —
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                              {p.name}
                            </span>
                            {p.description && (
                              <p
                                className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-0.5 line-clamp-1"
                                dangerouslySetInnerHTML={{ __html: formatSafeDescriptionHtml(p.description) }}
                              />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                            {p.price} RON
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2.5 py-0.5 rounded-full text-[#3a3a3c] dark:text-[#ebebf5]">
                              {p.categoryName || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {p.modifierGroups && p.modifierGroups.length > 0 ? (
                              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                                {p.modifierGroups.length} grupe
                              </span>
                            ) : (
                              <span className="text-xs text-[#8e8e93]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 pt-3 text-xs text-[#6e6e73] dark:text-[#98989d] border-t border-black/[0.05] dark:border-white/[0.07] tabular-nums">
                  Total: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{syrveProducts.length}</strong> produse afișate
                </div>
              </>
            )}
          </div>
        )}

        {/* FULLSCREEN IMAGE LIGHTBOX */}
        {fullscreenImage && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => setFullscreenImage(null)}
          >
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setFullscreenImage(null);
              }}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={getProxiedHorecaImageUrl(fullscreenImage)}
              alt="Fullscreen View"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
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
  const [categoryToDelete, setCategoryToDelete] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    icon: "",
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
      setForm({ name: "", description: "", icon: "", sortOrder: 0 });
    },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.horeca.menu.deleteCategory.useMutation({
    onSuccess: () => {
      toast.success("Categorie ștearsă");
      setCategoryToDelete(null);
      utils.horeca.menu.listCategories.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <div>
      <div className="px-4 sm:px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.07] flex justify-between items-center bg-[#fafafa] dark:bg-white/[0.025]">
        <h2 className="text-[15px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
          Categorii meniu
        </h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className={`${showForm ? "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]" : "apple-btn-prominent text-white"} inline-flex items-center gap-1.5 px-4 h-8 text-xs font-semibold cursor-pointer`}
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Anulează" : "Categorie nouă"}
        </button>
      </div>

      {showForm && (
        <div className="p-5 bg-[#f5f5f7]/60 dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.07]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Nume *
              </label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Pizza"
                className="apple-input w-full h-9 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Simbol / etichetă
              </label>
              <input
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder=""
                className="apple-input w-full h-9 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Ordine
              </label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={e =>
                  setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))
                }
                className="apple-input w-full h-9 px-3 text-sm tabular-nums"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => createMut.mutate({ locationId, ...form })}
                disabled={createMut.isPending || !form.name.trim()}
                className="apple-btn-prominent w-full flex items-center justify-center gap-1.5 disabled:opacity-50 text-white px-4 h-9 text-xs font-semibold cursor-pointer"
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
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
            <tr className="text-[#6e6e73] dark:text-[#98989d] text-left font-medium text-[12px]">
              <th className="px-4 py-3 font-medium">
                Icon
              </th>
              <th className="px-4 py-3 font-medium">
                Nume categorie
              </th>
              <th className="px-4 py-3 font-medium">
                Ordine
              </th>
              <th className="px-4 py-3 font-medium text-right">
                Acțiuni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
            {categories.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="p-8 text-center text-[#6e6e73] dark:text-[#98989d] text-[13px]"
                >
                  Nu există categorii. Adaugă prima categorie.
                </td>
              </tr>
            )}
            {categories.map(c => (
              <tr
                key={c.id}
                className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
              >
                <td className="px-4 py-3 text-xl">{c.icon}</td>
                <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[14px]">
                  {c.name}
                </td>
                <td className="px-4 py-3 text-[#6e6e73] dark:text-[#98989d] font-medium">
                  {c.sortOrder}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setCategoryToDelete(c)}
                    className="apple-btn-glass w-8 h-8 inline-flex items-center justify-center text-[#ff3b30] dark:text-[#ff453a] hover:bg-[#ff3b30]/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AlertDialog
        open={!!categoryToDelete}
        onOpenChange={open => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              Ștergi categoria „{categoryToDelete?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
              Categoria va fi eliminată din meniul locației.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                categoryToDelete && deleteMut.mutate({ id: categoryToDelete.id })
              }
              className="rounded-full bg-[#ff3b30] hover:bg-[#d70015] text-white"
            >
              Șterge categoria
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemsTab({ locationId }: { locationId: number }) {
  const [showForm, setShowForm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
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
      setItemToDelete(null);
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
      <div className="px-4 sm:px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.07] flex flex-wrap gap-3 justify-between items-center bg-[#fafafa] dark:bg-white/[0.025]">
        <h2 className="text-[15px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
          Produse meniu
        </h2>
        <div className="flex gap-2.5 w-full sm:w-auto items-center">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Caută produs..."
              style={{ paddingLeft: 34 }}
              className="apple-pill-control rounded-full w-full h-[34px] pr-3 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:bg-white dark:focus:bg-[#2c2c2e]"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className={`${showForm ? "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]" : "apple-btn-prominent text-white"} inline-flex items-center gap-1.5 px-4 h-[34px] text-xs font-semibold whitespace-nowrap cursor-pointer`}
          >
            {showForm ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {showForm ? "Anulează" : "Produs nou"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-5 bg-[#f5f5f7]/60 dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.07]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Nume *
              </label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="apple-input w-full h-9 px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Categorie *
              </label>
              <select
                value={form.categoryId}
                onChange={e =>
                  setForm(f => ({ ...f, categoryId: Number(e.target.value) }))
                }
                className="apple-input w-full h-9 px-3 text-sm cursor-pointer"
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
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Preț cu TVA (RON) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={e =>
                  setForm(f => ({ ...f, price: Number(e.target.value) }))
                }
                className="apple-input w-full h-9 px-3 text-sm font-semibold tabular-nums"
              />
            </div>
            <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-black/[0.06] dark:border-white/[0.08] pt-4 mt-1">
              <label className="flex items-center gap-2 text-[#1d1d1f] dark:text-[#ebebf5] font-medium text-xs cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.05] p-2 rounded-xl transition-colors">
                <input
                  type="checkbox"
                  checked={form.isAvailableDineIn}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      isAvailableDineIn: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                Disponibil la masă
              </label>
              <label className="flex items-center gap-2 text-[#1d1d1f] dark:text-[#ebebf5] font-medium text-xs cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.05] p-2 rounded-xl transition-colors">
                <input
                  type="checkbox"
                  checked={form.isAvailableTakeaway}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      isAvailableTakeaway: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                Disponibil ridicare
              </label>
              <label className="flex items-center gap-2 text-[#1d1d1f] dark:text-[#ebebf5] font-medium text-xs cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.05] p-2 rounded-xl transition-colors">
                <input
                  type="checkbox"
                  checked={form.isAvailableDelivery}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      isAvailableDelivery: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                Disponibil delivery
              </label>
            </div>
            <div className="md:col-span-4 flex justify-end mt-1">
              <button
                type="button"
                onClick={() =>
                  createMut.mutate({
                    locationId,
                    ...form,
                    price: String(form.price),
                    isAvailableDelivery: form.isAvailableDelivery ? 1 : 0,
                    isAvailableDineIn: form.isAvailableDineIn ? 1 : 0,
                    isAvailableTakeaway: form.isAvailableTakeaway ? 1 : 0,
                  })
                }
                disabled={
                  createMut.isPending || !form.name.trim() || !form.categoryId
                }
                className="apple-btn-prominent inline-flex items-center justify-center gap-1.5 disabled:opacity-50 text-white px-5 h-9 text-xs font-semibold cursor-pointer"
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
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr className="text-[#6e6e73] dark:text-[#98989d] text-left font-medium text-[12px]">
                <th className="px-3 py-3 w-12 text-center font-medium">
                  Nr.
                </th>
                <th className="px-4 py-3 font-medium">
                  Produs
                </th>
                <th className="px-4 py-3 font-medium">
                  Categorie
                </th>
                <th className="px-4 py-3 font-medium">
                  Preț
                </th>
                <th className="px-4 py-3 font-medium">
                  Canale disponibile
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
              {paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-[#6e6e73] dark:text-[#98989d] text-[13px]"
                  >
                    Nu am găsit produse.
                  </td>
                </tr>
              )}
              {paginated.map((item, idx) => (
                <tr
                  key={item.id}
                  className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                >
                  <td className="px-3 py-3 text-center text-[#8e8e93] text-xs font-medium">
                    {(safePage - 1) * rowsPerPage + idx + 1}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-[#6e6e73] dark:text-[#98989d] font-medium text-[13px]">
                    {categories.find(c => c.id === item.categoryId)?.name || "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
                    {formatCurrency(Number(item.price), "RON")}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex gap-1.5 flex-wrap">
                      {item.isAvailableDineIn && (
                        <span className="bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-black/[0.06] dark:border-white/[0.08]">
                          Masă
                        </span>
                      )}
                      {item.isAvailableTakeaway && (
                        <span className="bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-black/[0.06] dark:border-white/[0.08]">
                          Pick-up
                        </span>
                      )}
                      {item.isAvailableDelivery && (
                        <span className="bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-black/[0.06] dark:border-white/[0.08]">
                          Delivery
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="apple-btn-glass w-8 h-8 inline-flex items-center justify-center text-[#ff3b30] dark:text-[#ff453a] hover:bg-[#ff3b30]/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={open => !open && setItemToDelete(null)}
      >
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              Ștergi produsul „{itemToDelete?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
              Produsul va fi eliminat din lista de produse și prețuri a locației.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                itemToDelete && deleteMut.mutate({ id: itemToDelete.id })
              }
              className="rounded-full bg-[#ff3b30] hover:bg-[#d70015] text-white"
            >
              Șterge produsul
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer paginare */}
      <div className="px-4 sm:px-5 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between flex-wrap gap-2 bg-[#fafafa] dark:bg-white/[0.02] text-xs text-[#6e6e73] dark:text-[#98989d] tabular-nums">
        <span>
          Total:{" "}
          <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
            {filtered.length}
          </strong>{" "}
          produse
        </span>
        <div className="flex items-center gap-2">
          <span>
            Pagina {safePage} din {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
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
    <div className="flex flex-col md:flex-row h-[700px] divide-y md:divide-y-0 md:divide-x divide-black/[0.06] dark:divide-white/[0.08]">
      {/* Sidebar - Lista Produse */}
      <div className="w-full md:w-1/3 flex flex-col bg-[#fafafa] dark:bg-white/[0.02]">
        <div className="p-4 border-b border-black/[0.05] dark:border-white/[0.07]">
          <h3 className="font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-[14.5px] mb-1">
            Alege produsul
          </h3>
          <p className="text-xs text-[#6e6e73] dark:text-[#98989d]">
            Selectează un produs pentru a-i construi rețeta și a calcula Food
            Cost-ul.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingItems ? (
            <div className="p-4 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            items.map(item => {
              const cat = categories.find(c => c.id === item.categoryId);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-[13px] transition-all flex justify-between items-center cursor-pointer ${
                    selectedItemId === item.id
                      ? "bg-primary/12 text-primary font-semibold border border-primary/25"
                      : "text-[#1d1d1f] dark:text-[#ebebf5] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
                  }`}
                >
                  <div className="truncate">
                    <span>{cat?.icon}</span> {item.name}
                  </div>
                  {item.hasRecipe === 1 ? (
                    <div title="Are rețetă configurată">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    </div>
                  ) : (
                    <div title="Nu are rețetă">
                      <AlertCircle className="w-4 h-4 text-[#8e8e93] flex-shrink-0" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content - Editor Rețetă */}
      <div className="w-full md:w-2/3 flex flex-col bg-white dark:bg-[#1c1c1e]">
        {!selectedItemId || !selectedItem ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#6e6e73] dark:text-[#98989d] p-8 text-center">
            <ChefHat className="w-14 h-14 mb-4 opacity-20" />
            <p className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Niciun produs selectat
            </p>
            <p className="text-[13px] mt-1">
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
  const { data: horecaIngredients = [] } = trpc.horeca.inventory.listIngredients.useQuery({ locationId });

  const [lines, setLines] = useState<any[]>([]);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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
        ingredientId: null,
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

    // Auto-fill nume și preț dacă selectăm un ingredient
    if (field === "ingredientId" && val) {
      const ing = horecaIngredients.find(p => p.id === Number(val));
      if (ing) {
        newLines[idx].ingredientName = ing.name;
        newLines[idx].unit = ing.unit || "g";
        newLines[idx].unitCost = ing.unitCost || 0;
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
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.025] flex justify-between items-start gap-3 flex-wrap">
        <div>
          <h2 className="text-[17px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
            Rețetar: {item.name}
          </h2>
          <p className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-1 tabular-nums">
            Preț vânzare (TVA {vatRate}% inclus):{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              {formatCurrency(price, "RON")}
            </strong>
          </p>
        </div>
        <div
          className={`px-3.5 py-2 rounded-xl border text-right tabular-nums ${
            isGoodFc
              ? "bg-emerald-500/10 border-emerald-500/20"
              : isWarnFc
                ? "bg-amber-500/12 border-amber-500/20"
                : isBadFc
                  ? "bg-[#ff3b30]/10 border-[#ff3b30]/20"
                  : "bg-[#f2f2f7] dark:bg-[#2c2c2e] border-black/[0.06] dark:border-white/[0.08]"
          }`}
        >
          <p className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
            Food cost (net)
          </p>
          <div className="flex items-baseline gap-1.5 justify-end mt-0.5">
            <span
              className={`text-lg font-bold ${
                isGoodFc
                  ? "text-emerald-700 dark:text-emerald-300"
                  : isWarnFc
                    ? "text-amber-700 dark:text-amber-300"
                    : isBadFc
                      ? "text-[#d70015] dark:text-[#ff6961]"
                      : "text-[#1d1d1f] dark:text-[#f5f5f7]"
              }`}
            >
              {foodCostPct.toFixed(1)}%
            </span>
            <span className="text-xs font-medium text-[#6e6e73] dark:text-[#98989d]">
              ({formatCurrency(totalCost, "RON")})
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-[#0071e3]/[0.07] dark:bg-[#0a84ff]/[0.12] border border-[#0071e3]/20 rounded-xl p-3 mb-4 flex gap-3 text-[12.5px] text-[#1d1d1f] dark:text-[#ebebf5]">
          <BookOpen className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#0071e3] dark:text-[#64d2ff]" />
          <p>
            Leagă ingredientele de <strong>Stocul ERP (NIR-uri)</strong>{" "}
            selectând produsul din listă, sau tastează manual un nume pentru o
            rețetă teoretică. La comandă, se vor scădea automat cantitățile din
            stoc.
          </p>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] dark:bg-white/[0.025] text-[#6e6e73] dark:text-[#98989d] font-medium text-[12px] text-left border-b border-black/[0.05] dark:border-white/[0.07]">
            <tr>
              <th className="px-3 py-2.5 font-medium">
                Ingredient / produs stoc ERP
              </th>
              <th className="px-3 py-2.5 font-medium">Cantitate</th>
              <th className="px-3 py-2.5 font-medium">UM</th>
              <th className="px-3 py-2.5 font-medium">Cost unitar</th>
              <th className="px-3 py-2.5 font-medium text-right">Cost total</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#6e6e73] dark:text-[#98989d] text-[13px]">
                  Niciun ingredient adăugat.
                </td>
              </tr>
            )}
            {lines.map((l, idx) => (
              <tr
                key={idx}
                className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]"
              >
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-1.5">
                    <select
                      value={l.ingredientId || ""}
                      onChange={e =>
                        updateLine(
                          idx,
                          "ingredientId",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.10] rounded-lg p-1.5 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]"
                    >
                      <option value="">-- Materie Primă (Stoc HoReCa) --</option>
                      {horecaIngredients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                    {!l.ingredientId && (
                      <input
                        placeholder="Nume ingredient manual"
                        value={l.ingredientName}
                        onChange={e =>
                          updateLine(idx, "ingredientName", e.target.value)
                        }
                        className="w-full bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.10] rounded-lg p-1.5 text-xs text-[#1d1d1f] dark:text-[#f5f5f7]"
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
                    className="w-full bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.10] rounded-lg p-1.5 text-sm font-semibold text-center text-[#1d1d1f] dark:text-[#f5f5f7]"
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    value={l.unit}
                    onChange={e => updateLine(idx, "unit", e.target.value)}
                    className="w-full bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.10] rounded-lg p-1.5 text-sm text-[#1d1d1f] dark:text-[#f5f5f7]"
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
                    className="w-full bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.08] dark:border-white/[0.10] rounded-lg p-1.5 text-sm text-[#1d1d1f] dark:text-[#f5f5f7]"
                  />
                </td>
                <td className="px-2 py-2 text-right font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {formatCurrency(
                    Number(l.quantity) * Number(l.unitCost || 0),
                    "RON"
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="text-[#8e8e93] hover:text-[#ff3b30] p-1.5 hover:bg-[#ff3b30]/10 rounded-full transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={addLine}
          className="mt-4 flex items-center gap-2 text-primary font-semibold text-xs bg-primary/10 hover:bg-primary/15 px-4 py-2.5 rounded-xl transition-colors border border-primary/25 border-dashed w-full justify-center cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Adaugă ingredient
        </button>
      </div>

      <div className="p-4 border-t border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02] flex justify-end gap-2.5">
        <button
          type="button"
          onClick={() => setShowDiscardConfirm(true)}
          className="apple-btn-glass px-4 h-9 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
        >
          Anulează
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={upsertMut.isPending}
          className="apple-btn-prominent inline-flex items-center gap-1.5 disabled:opacity-50 text-white px-5 h-9 text-xs font-semibold cursor-pointer"
        >
          {upsertMut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}{" "}
          Salvează rețeta
        </button>
      </div>

      <AlertDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
      >
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">Anulezi modificările nesalvate?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
              Modificările neaplicate la rețeta produsului <strong>{item.name}</strong> vor fi revenite la ultima versiune salvată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]">Păstrează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLines(recipeLines || []);
                setShowDiscardConfirm(false);
              }}
              className="rounded-full bg-[#ff3b30] hover:bg-[#d70015] text-white"
            >
              Anulează modificările
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
