// HorecaMenu — Meniu cu 3 tab-uri: Categorii / Produse / Rețete

import { useState } from "react";
import {
  UtensilsCrossed, Plus, Pencil, Trash2, ChefHat,
  BookOpen, Tag, Loader2, Check, X, AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/store";

type Tab = "categorii" | "produse" | "retete";

export default function HorecaMenu() {
  const [activeTab, setActiveTab] = useState<Tab>("produse");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedItemForRecipe, setSelectedItemForRecipe] = useState<number | null>(null);

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <BookOpen className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Meniu</h1>
            <p className="text-slate-400 text-sm">Produse, categorii și rețete cu food cost</p>
          </div>
        </div>
        {locations.length > 1 && (
          <select
            value={locationId}
            onChange={e => { setSelectedLocationId(Number(e.target.value)); setSelectedCategoryId(null); }}
            className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500"
          >
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-lg p-1 w-fit">
        {([
          { key: "produse", label: "Produse", icon: <UtensilsCrossed className="w-4 h-4" /> },
          { key: "categorii", label: "Categorii", icon: <Tag className="w-4 h-4" /> },
          { key: "retete", label: "Rețete & Food Cost", icon: <ChefHat className="w-4 h-4" /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-orange-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {locationId === 0 ? (
        <div className="flex items-center gap-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Selectează sau creează o locație HORECA pentru a gestiona meniul.
        </div>
      ) : (
        <>
          {activeTab === "categorii" && <CategoriiTab locationId={locationId} />}
          {activeTab === "produse" && (
            <ProduseTab
              locationId={locationId}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              onOpenRecipe={id => { setSelectedItemForRecipe(id); setActiveTab("retete"); }}
            />
          )}
          {activeTab === "retete" && (
            <RetetaTab
              locationId={locationId}
              preselectedItemId={selectedItemForRecipe}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── CATEGORII TAB ─────────────────────────────────────────────────────────────
function CategoriiTab({ locationId }: { locationId: number }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", icon: "", color: "", sortOrder: 0 });

  const utils = trpc.useUtils();
  const { data: cats = [], isLoading } = trpc.horeca.menu.listCategories.useQuery({ locationId });

  const createMut = trpc.horeca.menu.createCategory.useMutation({
    onSuccess: () => { toast.success("Categorie creată"); utils.horeca.menu.listCategories.invalidate(); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.horeca.menu.updateCategory.useMutation({
    onSuccess: () => { toast.success("Categorie actualizată"); utils.horeca.menu.listCategories.invalidate(); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.horeca.menu.deleteCategory.useMutation({
    onSuccess: () => { toast.success("Categorie dezactivată"); utils.horeca.menu.listCategories.invalidate(); },
  });

  function resetForm() {
    setShowForm(false); setEditId(null);
    setForm({ name: "", description: "", icon: "", color: "", sortOrder: 0 });
  }

  function handleEdit(c: typeof cats[0]) {
    setEditId(c.id);
    setForm({ name: c.name, description: c.description || "", icon: c.icon || "", color: c.color || "", sortOrder: c.sortOrder || 0 });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editId) updateMut.mutate({ id: editId, ...form });
    else createMut.mutate({ locationId, ...form });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" /> Categorie nouă
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-xs mb-1">Nume categorie *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Grătar, Pizza, Salate..."
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Icon (emoji)</label>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="🍖"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Ordine sortare</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={resetForm} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                <X className="w-3 h-3" /> Anulează
              </button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                <Check className="w-3 h-3" /> {editId ? "Salvează" : "Adaugă"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-orange-400 animate-spin" /></div> : (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr className="text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Nr. Crt.</th>
                <th className="px-4 py-3 font-medium">Categorie</th>
                <th className="px-4 py-3 font-medium">Ordine</th>
                <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c, idx) => (
                <tr key={c.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="text-lg mr-2">{c.icon || "📁"}</span>
                    <span className="text-white font-medium">{c.name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{c.sortOrder}</td>
                  <td className="px-4 py-3 flex justify-end gap-2">
                    <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => { if (confirm("Ștergi categoria?")) deleteMut.mutate({ id: c.id }); }} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-700/50 text-slate-500 text-xs">{cats.length} categorii</div>
        </div>
      )}
    </div>
  );
}

// ── PRODUSE TAB ───────────────────────────────────────────────────────────────
function ProduseTab({
  locationId, selectedCategoryId, onSelectCategory, onOpenRecipe,
}: { locationId: number; selectedCategoryId: number | null; onSelectCategory: (id: number | null) => void; onOpenRecipe: (id: number) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", price: "", vatRate: 9, unit: "portie",
    categoryId: undefined as number | undefined, isAvailableDelivery: 1, isAvailableDineIn: 1, isAvailableTakeaway: 1,
    allergens: "", foodCostTarget: "", sortOrder: 0,
  });

  const utils = trpc.useUtils();
  const { data: cats = [] } = trpc.horeca.menu.listCategories.useQuery({ locationId });
  const { data: items = [], isLoading } = trpc.horeca.menu.listItems.useQuery({ locationId, categoryId: selectedCategoryId ?? undefined });

  const createMut = trpc.horeca.menu.createItem.useMutation({
    onSuccess: () => { toast.success("Produs adăugat"); utils.horeca.menu.listItems.invalidate(); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.horeca.menu.updateItem.useMutation({
    onSuccess: () => { toast.success("Produs actualizat"); utils.horeca.menu.listItems.invalidate(); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.horeca.menu.deleteItem.useMutation({
    onSuccess: () => { toast.success("Produs dezactivat"); utils.horeca.menu.listItems.invalidate(); },
  });

  function resetForm() {
    setShowForm(false); setEditId(null);
    setForm({ name: "", description: "", price: "", vatRate: 9, unit: "portie", categoryId: undefined, isAvailableDelivery: 1, isAvailableDineIn: 1, isAvailableTakeaway: 1, allergens: "", foodCostTarget: "", sortOrder: 0 });
  }

  function handleEdit(item: typeof items[0]) {
    setEditId(item.id);
    setForm({
      name: item.name, description: item.description || "", price: item.price || "", vatRate: item.vatRate || 9,
      unit: item.unit || "portie", categoryId: item.categoryId || undefined,
      isAvailableDelivery: item.isAvailableDelivery ?? 1, isAvailableDineIn: item.isAvailableDineIn ?? 1,
      isAvailableTakeaway: item.isAvailableTakeaway ?? 1, allergens: item.allergens || "",
      foodCostTarget: item.foodCostTarget || "", sortOrder: item.sortOrder || 0,
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.price) { toast.error("Completează câmpurile obligatorii"); return; }
    if (editId) updateMut.mutate({ id: editId, ...form });
    else createMut.mutate({ locationId, ...form });
  }

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onSelectCategory(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!selectedCategoryId ? "bg-orange-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
          Toate
        </button>
        {cats.map(c => (
          <button key={c.id} onClick={() => onSelectCategory(c.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedCategoryId === c.id ? "bg-orange-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
            {c.icon} {c.name}
          </button>
        ))}
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="ml-auto flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-lg text-xs transition-colors">
          <Plus className="w-3 h-3" /> Produs nou
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-xs mb-1">Denumire produs *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Burger Clasic"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Categorie</label>
              <select value={form.categoryId ?? ""} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                <option value="">Fără categorie</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Preț (RON) *</label>
              <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="0.00"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">TVA (%)</label>
              <select value={form.vatRate} onChange={e => setForm(f => ({ ...f, vatRate: Number(e.target.value) }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500">
                <option value={9}>9% — Mâncare/băuturi nealcoolice</option>
                <option value={19}>19% — Alcool</option>
                <option value={5}>5% — Special</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Unitate</label>
              <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-slate-400 text-xs mb-2">Disponibil pe canale</label>
              <div className="flex gap-4">
                {[
                  { key: "isAvailableDineIn", label: "🍽️ La masă" },
                  { key: "isAvailableTakeaway", label: "🥡 Ridicare" },
                  { key: "isAvailableDelivery", label: "🛵 Delivery" },
                ].map(ch => (
                  <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      checked={form[ch.key as keyof typeof form] === 1}
                      onChange={e => setForm(f => ({ ...f, [ch.key]: e.target.checked ? 1 : 0 }))}
                      className="rounded accent-orange-500" />
                    <span className="text-slate-300 text-sm">{ch.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-3 flex gap-3 justify-end">
              <button type="button" onClick={resetForm} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                <X className="w-3 h-3" /> Anulează
              </button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending}
                className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                <Check className="w-3 h-3" /> {editId ? "Salvează" : "Adaugă"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-orange-400 animate-spin" /></div> : (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr className="text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Nr. Crt.</th>
                <th className="px-4 py-3 font-medium">Produs</th>
                <th className="px-4 py-3 font-medium">Categorie</th>
                <th className="px-4 py-3 font-medium">Preț</th>
                <th className="px-4 py-3 font-medium">TVA</th>
                <th className="px-4 py-3 font-medium">Canale</th>
                <th className="px-4 py-3 font-medium">Rețetă</th>
                <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const cat = cats.find(c => c.id === item.categoryId);
                return (
                  <tr key={item.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-slate-400">{cat ? `${cat.icon} ${cat.name}` : "—"}</td>
                    <td className="px-4 py-3 text-white">{formatCurrency(Number(item.price), "RON")}</td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${item.vatRate === 9 ? "bg-blue-500/20 text-blue-300" : "bg-red-500/20 text-red-300"}`}>
                        {item.vatRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {item.isAvailableDineIn ? <span title="La masă" className="text-orange-400">🍽️</span> : null}
                        {item.isAvailableTakeaway ? <span title="Ridicare" className="text-amber-400">🥡</span> : null}
                        {item.isAvailableDelivery ? <span title="Delivery" className="text-blue-400">🛵</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.hasRecipe ? (
                        <span className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded">✓ Rețetă</span>
                      ) : (
                        <button onClick={() => onOpenRecipe(item.id)} className="text-xs text-orange-400 hover:text-orange-300 underline">
                          + Adaugă
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { if (confirm("Dezactivezi produsul?")) deleteMut.mutate({ id: item.id }); }} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-700/50 text-slate-500 text-xs">{items.length} produse</div>
        </div>
      )}
    </div>
  );
}

// ── REȚETĂ TAB ────────────────────────────────────────────────────────────────
function RetetaTab({ locationId, preselectedItemId }: { locationId: number; preselectedItemId: number | null }) {
  const [selectedItemId, setSelectedItemId] = useState<number | null>(preselectedItemId);
  const [lines, setLines] = useState<Array<{ ingredientName: string; quantity: string; unit: string; unitCost: string; sortOrder: number }>>([]);

  const utils = trpc.useUtils();
  const { data: items = [] } = trpc.horeca.menu.listItems.useQuery({ locationId });
  const { data: recipe = [], isLoading: loadingRecipe } = trpc.horeca.menu.getRecipe.useQuery(
    { menuItemId: selectedItemId! }, { enabled: !!selectedItemId }
  );
  const { data: foodCost } = trpc.horeca.menu.calculateFoodCost.useQuery(
    { menuItemId: selectedItemId! }, { enabled: !!selectedItemId }
  );

  const upsertMut = trpc.horeca.menu.upsertRecipe.useMutation({
    onSuccess: () => { toast.success("Rețetă salvată"); utils.horeca.menu.getRecipe.invalidate(); utils.horeca.menu.calculateFoodCost.invalidate(); },
    onError: e => toast.error(e.message),
  });

  // Load recipe into edit state when item changes
  function handleItemChange(id: number) {
    setSelectedItemId(id);
    setLines([]);
  }

  function loadRecipeForEdit() {
    setLines(recipe.map(l => ({
      ingredientName: l.ingredientName,
      quantity: l.quantity,
      unit: l.unit,
      unitCost: l.unitCost || "",
      sortOrder: l.sortOrder || 0,
    })));
  }

  function addLine() {
    setLines(l => [...l, { ingredientName: "", quantity: "0", unit: "g", unitCost: "0", sortOrder: l.length }]);
  }

  function removeLine(idx: number) {
    setLines(l => l.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, field: string, value: string) {
    setLines(l => l.map((line, i) => i === idx ? { ...line, [field]: value } : line));
  }

  function saveRecipe() {
    if (!selectedItemId) return;
    upsertMut.mutate({ menuItemId: selectedItemId, lines });
  }

  const foodCostPct = Number(foodCost?.foodCostPct || 0);
  const foodCostColor = foodCostPct <= 25 ? "text-green-400" : foodCostPct <= 35 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="space-y-4">
      {/* Item selector */}
      <div>
        <label className="block text-slate-400 text-sm mb-2">Selectează produsul</label>
        <select
          value={selectedItemId ?? ""}
          onChange={e => handleItemChange(Number(e.target.value))}
          className="w-full max-w-sm bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
        >
          <option value="">— Selectează un produs —</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.name} {i.hasRecipe ? "✓" : ""}</option>)}
        </select>
      </div>

      {selectedItemId && (
        <>
          {/* Food Cost indicator */}
          {foodCost && (
            <div className="flex items-center gap-4 p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl">
              <ChefHat className="w-8 h-8 text-orange-400" />
              <div>
                <p className="text-slate-400 text-xs">Food Cost calculat</p>
                <p className="text-white font-bold text-lg">
                  {foodCost.totalCost} RON
                  <span className={`ml-3 text-sm ${foodCostColor}`}>({foodCost.foodCostPct}%)</span>
                </p>
                <p className="text-slate-500 text-xs">Preț vânzare: {foodCost.price} RON · Target ideal: sub 30%</p>
              </div>
            </div>
          )}

          {/* Existing recipe display */}
          {recipe.length > 0 && lines.length === 0 && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                <h3 className="text-white font-medium">Rețetă curentă</h3>
                <button onClick={loadRecipeForEdit} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
                  Editează →
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr className="text-slate-400 text-left">
                    <th className="px-4 py-2 font-medium">Nr. Crt.</th>
                    <th className="px-4 py-2 font-medium">Ingredient</th>
                    <th className="px-4 py-2 font-medium">Cantitate</th>
                    <th className="px-4 py-2 font-medium">UM</th>
                    <th className="px-4 py-2 font-medium text-right">Cost/UM (RON)</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.map((l, idx) => (
                    <tr key={l.id} className="border-t border-slate-700/50">
                      <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-2 text-white">{l.ingredientName}</td>
                      <td className="px-4 py-2 text-slate-300">{l.quantity}</td>
                      <td className="px-4 py-2 text-slate-300">{l.unit}</td>
                      <td className="px-4 py-2 text-right text-slate-300">{l.unitCost || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Edit recipe */}
          {lines.length > 0 && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-3">
              <h3 className="text-white font-medium">Editare rețetă</h3>
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <span className="text-slate-500 text-xs col-span-1 text-right">{idx + 1}.</span>
                    <input value={line.ingredientName} onChange={e => updateLine(idx, "ingredientName", e.target.value)}
                      placeholder="Ingredient"
                      className="col-span-4 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
                    <input type="number" value={line.quantity} onChange={e => updateLine(idx, "quantity", e.target.value)}
                      placeholder="Cant."
                      className="col-span-2 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
                    <input value={line.unit} onChange={e => updateLine(idx, "unit", e.target.value)}
                      placeholder="g/ml/buc"
                      className="col-span-2 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
                    <input type="number" step="0.0001" value={line.unitCost} onChange={e => updateLine(idx, "unitCost", e.target.value)}
                      placeholder="Cost/UM"
                      className="col-span-2 bg-slate-700 border border-slate-600 text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
                    <button onClick={() => removeLine(idx)} className="col-span-1 p-1 text-slate-400 hover:text-red-400 transition-colors flex justify-center">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={addLine} className="flex items-center gap-1 text-orange-400 hover:text-orange-300 text-sm transition-colors">
                  <Plus className="w-4 h-4" /> Adaugă ingredient
                </button>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setLines([])} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                    <X className="w-3 h-3" /> Anulează
                  </button>
                  <button onClick={saveRecipe} disabled={upsertMut.isPending}
                    className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors">
                    {upsertMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Salvează rețeta
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No recipe yet */}
          {recipe.length === 0 && lines.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 bg-slate-800/40 border border-slate-700/50 rounded-xl">
              <ChefHat className="w-10 h-10 text-slate-500" />
              <p className="text-slate-400 text-sm">Nicio rețetă definită pentru acest produs</p>
              <button onClick={() => { setLines([{ ingredientName: "", quantity: "0", unit: "g", unitCost: "0", sortOrder: 0 }]); }}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                <Plus className="w-4 h-4" /> Creează rețetă
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
