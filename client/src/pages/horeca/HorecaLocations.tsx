// HorecaLocations — Management locații HORECA (restaurant, bar, cafenea etc.)

import { useState } from "react";
import {
  MapPin, Plus, Pencil, Trash2, UtensilsCrossed,
  Phone, Building2, ChevronRight, Loader2, Check, X,
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
    type: "restaurant" as const, currency: "RON",
    defaultVatFood: 9, defaultVatAlcohol: 19,
  });

  const utils = trpc.useUtils();
  const { data: locations = [], isLoading } = trpc.horeca.locations.list.useQuery();

  const createMut = trpc.horeca.locations.create.useMutation({
    onSuccess: () => {
      toast.success("Locație creată cu succes");
      utils.horeca.locations.list.invalidate();
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.horeca.locations.update.useMutation({
    onSuccess: () => {
      toast.success("Locație actualizată");
      utils.horeca.locations.list.invalidate();
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.horeca.locations.delete.useMutation({
    onSuccess: () => {
      toast.success("Locație dezactivată");
      utils.horeca.locations.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", address: "", city: "", phone: "", type: "restaurant", currency: "RON", defaultVatFood: 9, defaultVatAlcohol: 19 });
  }

  function handleEdit(loc: typeof locations[0]) {
    setEditId(loc.id);
    setForm({
      name: loc.name,
      address: loc.address || "",
      city: loc.city || "",
      phone: loc.phone || "",
      type: (loc.type as any) || "restaurant",
      currency: loc.currency || "RON",
      defaultVatFood: loc.defaultVatFood || 9,
      defaultVatAlcohol: loc.defaultVatAlcohol || 19,
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Numele locației este obligatoriu"); return; }
    if (editId) {
      updateMut.mutate({ id: editId, ...form });
    } else {
      createMut.mutate(form);
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
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
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Locație nouă
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">
            {editId ? "Editează locație" : "Locație nouă"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-sm mb-1">Nume locație *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Restaurant Central"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Tip locație</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              >
                {LOCATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{TYPE_ICONS[t.value]} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Telefon</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="0722 000 000"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Adresă</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Str. Exemplu nr. 1"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Oraș</label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="București"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">TVA Mâncare / Băuturi nealcoolice (%)</label>
              <input
                type="number"
                value={form.defaultVatFood}
                onChange={e => setForm(f => ({ ...f, defaultVatFood: Number(e.target.value) }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">TVA Alcool (%)</label>
              <input
                type="number"
                value={form.defaultVatAlcohol}
                onChange={e => setForm(f => ({ ...f, defaultVatAlcohol: Number(e.target.value) }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              />
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

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center bg-slate-800/40 border border-slate-700/50 rounded-xl">
          <UtensilsCrossed className="w-16 h-16 text-slate-500" />
          <p className="text-slate-400">Nicio locație înregistrată</p>
          <p className="text-slate-500 text-sm">Adaugă prima ta locație pentru a începe</p>
        </div>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr className="text-slate-400 text-left">
                <th className="px-4 py-3 font-medium">Nr. Crt.</th>
                <th className="px-4 py-3 font-medium">Locație</th>
                <th className="px-4 py-3 font-medium">Tip</th>
                <th className="px-4 py-3 font-medium">Adresă / Oraș</th>
                <th className="px-4 py-3 font-medium">Telefon</th>
                <th className="px-4 py-3 font-medium">TVA</th>
                <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc, idx) => (
                <tr key={loc.id} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
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
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Dezactivezi "${loc.name}"?`)) deleteMut.mutate({ id: loc.id }); }}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-700/50 text-slate-500 text-xs">
            {locations.length} locații · Sortare: A-Z
          </div>
        </div>
      )}
    </div>
  );
}
