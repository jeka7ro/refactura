// HorecaLocations — Management locații HORECA
// UI Rules: search bar cu counter, Nr.Crt. cu pagina, footer paginare complet, rounded-lg

import { useState, useMemo } from "react";
import {
  MapPin, Plus, Pencil, Trash2, UtensilsCrossed,
  Loader2, Check, X, Search, ChevronLeft, ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const LOCATION_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar" },
  { value: "cafenea", label: "Cafenea" },
  { value: "fast_food", label: "Fast Food" },
  { value: "pizzerie", label: "Pizzerie" },
  { value: "catering", label: "Catering" },
  { value: "hotel", label: "Hotel" },
];

const TYPE_ICONS: Record<string, string> = {
  restaurant: "🍽️", bar: "🍸", cafenea: "☕",
  fast_food: "🍔", pizzerie: "🍕", catering: "🎪", hotel: "🏨",
};

export default function HorecaLocations() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", address: "", city: "", phone: "",
    type: "restaurant" as "restaurant" | "bar" | "cafenea" | "fast_food" | "pizzerie" | "catering" | "hotel",
    currency: "RON", defaultVatFood: 9, defaultVatAlcohol: 19,
  });

  // ── Paginare & search ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const utils = trpc.useUtils();
  const { data: locations = [], isLoading } = trpc.horeca.locations.list.useQuery();

  // Filtrare
  const filtered = useMemo(() => {
    if (!search.trim()) return locations;
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return locations.filter(l => {
      const searchIn = [l.name, l.address, l.city, l.phone, l.type]
        .filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return searchIn.includes(q);
    });
  }, [locations, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated = rowsPerPage === 9999
    ? filtered
    : filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const createMut = trpc.horeca.locations.create.useMutation({
    onSuccess: () => { toast.success("Locație creată cu succes"); utils.horeca.locations.list.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.horeca.locations.update.useMutation({
    onSuccess: () => { toast.success("Locație actualizată"); utils.horeca.locations.list.invalidate(); resetForm(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.horeca.locations.delete.useMutation({
    onSuccess: () => { toast.success("Locație dezactivată"); utils.horeca.locations.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setShowForm(false); setEditId(null);
    setForm({ name: "", address: "", city: "", phone: "", type: "restaurant", currency: "RON", defaultVatFood: 9, defaultVatAlcohol: 19 });
  }

  function handleEdit(loc: typeof locations[0]) {
    setEditId(loc.id);
    setForm({
      name: loc.name, address: loc.address || "", city: loc.city || "",
      phone: loc.phone || "", type: (loc.type as any) || "restaurant",
      currency: loc.currency || "RON", defaultVatFood: loc.defaultVatFood || 9,
      defaultVatAlcohol: loc.defaultVatAlcohol || 19,
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Numele locației este obligatoriu"); return; }
    if (editId) updateMut.mutate({ id: editId, ...form });
    else createMut.mutate(form);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <MapPin className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Locații HORECA</h1>
            <p className="text-slate-400 text-sm">{locations.length} locații configurate</p>
          </div>
        </div>
        {/* Butonul dispare când formularul e deschis */}
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Locație nouă
          </button>
        )}
      </div>

      {/* Form — apare, KPI-urile dispar */}
      {showForm && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-6">
          <h2 className="text-white font-semibold mb-4">
            {editId ? "Editează locație" : "Locație nouă"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-sm mb-1">Nume locație *</label>
              <input type="text" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Restaurant Central"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Tip locație</label>
              <select value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500">
                {LOCATION_TYPES.map(t => <option key={t.value} value={t.value}>{TYPE_ICONS[t.value]} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Telefon</label>
              <input type="text" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="0722 000 000"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Adresă</label>
              <input type="text" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Str. Exemplu nr. 1"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Oraș</label>
              <input type="text" value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="București"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">TVA Mâncare / Băuturi nealcoolice (%)</label>
              <input type="number" value={form.defaultVatFood}
                onChange={e => setForm(f => ({ ...f, defaultVatFood: Number(e.target.value) }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">TVA Alcool (%)</label>
              <input type="number" value={form.defaultVatAlcohol}
                onChange={e => setForm(f => ({ ...f, defaultVatAlcohol: Number(e.target.value) }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end pt-2">
              <button type="button" onClick={resetForm}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                <X className="w-4 h-4" /> Anulează
              </button>
              <button type="submit" disabled={isPending}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editId ? "Salvează" : "Creează"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search bar — regula 1 */}
      <div style={{ position: "relative" }}>
        <Search className="w-4 h-4 text-slate-500" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 1 }} />
        <input
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-full focus:outline-none focus:border-orange-500"
          style={{ paddingLeft: 36, paddingRight: search ? 90 : 16, paddingTop: 8, paddingBottom: 8, fontSize: 14 }}
          placeholder="Caută după nume, oraș, tip..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        {search && (
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgb(234 88 12)", color: "white", borderRadius: 9999, padding: "2px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
            {filtered.length} / {locations.length}
          </div>
        )}
      </div>

      {/* Tabel — afișat mereu, chiar și gol (regula 4) */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-orange-400 animate-spin" /></div>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden">
          {/* Header tabel cu total */}
          <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <span className="text-slate-400 text-sm">Total: <strong className="text-white">{filtered.length}</strong> înregistrări</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr className="text-slate-400 text-left">
                  {/* Nr. Crt. — regula 2 */}
                  <th style={{ width: 50, textAlign: "center" }} className="px-3 py-3 font-medium">Nr.</th>
                  <th className="px-4 py-3 font-medium">Locație</th>
                  <th className="px-4 py-3 font-medium">Tip</th>
                  <th className="px-4 py-3 font-medium">Adresă / Oraș</th>
                  <th className="px-4 py-3 font-medium">Telefon</th>
                  <th className="px-4 py-3 font-medium">TVA</th>
                  <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-10">
                      {search ? "Niciun rezultat pentru căutarea efectuată" : "Nicio locație înregistrată"}
                    </td>
                  </tr>
                ) : paginated.map((loc, idx) => (
                  <tr key={loc.id} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    {/* Nr. Crt. calculat corect cu pagina */}
                    <td style={{ textAlign: "center", color: "rgb(100 116 139)", fontSize: 13 }} className="px-3 py-3">
                      {(safePage - 1) * rowsPerPage + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{TYPE_ICONS[loc.type || "restaurant"] || "🍽️"}</span>
                        <span className="text-white font-medium">{loc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded text-xs capitalize">
                        {LOCATION_TYPES.find(t => t.value === loc.type)?.label || loc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {[loc.address, loc.city].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{loc.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 text-xs">
                        <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">{loc.defaultVatFood}% alim.</span>
                        <span className="bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">{loc.defaultVatAlcohol}% alc.</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(loc)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded-lg transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Dezactivezi "${loc.name}"?`)) deleteMut.mutate({ id: loc.id }); }}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer paginare — regula 3, OBLIGATORIU */}
          <div style={{
            padding: "12px 20px", borderTop: "1px solid rgba(51,65,85,0.5)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(15,23,42,0.4)", borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ color: "rgb(148 163 184)", fontSize: 13, whiteSpace: "nowrap" }}>
                Afișează&nbsp;
                <select
                  value={rowsPerPage}
                  onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                  style={{ background: "rgb(30 41 59)", border: "1px solid rgb(51 65 85)", borderRadius: 9999, padding: "2px 8px", color: "white", fontSize: 12 }}
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={9999}>Toți</option>
                </select>
              </span>
              <span style={{ color: "rgb(148 163 184)", fontSize: 13, whiteSpace: "nowrap" }}>
                Total înregistrări: <strong style={{ color: "white" }}>{filtered.length}</strong>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "rgb(148 163 184)", fontSize: 13, whiteSpace: "nowrap" }}>
                Pagina {safePage} din {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                style={{ padding: "4px 8px", borderRadius: 8, background: safePage === 1 ? "transparent" : "rgb(51 65 85)", color: "white", border: "none", cursor: safePage === 1 ? "not-allowed" : "pointer", opacity: safePage === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                style={{ padding: "4px 8px", borderRadius: 8, background: safePage === totalPages ? "transparent" : "rgb(51 65 85)", color: "white", border: "none", cursor: safePage === totalPages ? "not-allowed" : "pointer", opacity: safePage === totalPages ? 0.4 : 1 }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
