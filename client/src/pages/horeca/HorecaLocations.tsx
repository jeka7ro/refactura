// HorecaLocations — Management locații HORECA
// Proper Light/Dark mode styling (Premium UI)

import { useState, useMemo } from "react";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  UtensilsCrossed,
  Loader2,
  Check,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Store,
  Pizza,
  Truck,
  Hotel,
  Coffee,
  GlassWater,
  Building2,
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

const TYPE_ICONS: Record<string, any> = {
  restaurant: UtensilsCrossed,
  bar: GlassWater,
  cafenea: Coffee,
  fast_food: Store,
  pizzerie: Pizza,
  catering: Truck,
  hotel: Hotel,
};

const BRAND_LOGOS: Record<string, string> = {
  smashme: "/brands/smashme-logo.png",
  crunch: "/brands/crunch-logo.png",
  sushimaster: "/brands/sushimaster-logo.png",
  pokiwoki: "/brands/pokiwoki-logo.png",
  rollmaster: "/brands/rollmaster-logo.png",
  lovesushi: "/brands/lovesushi-logo.png", // Assuming lovesushi might have one, else fallback
};

export default function HorecaLocations() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    phone: "",
    type: "restaurant" as
      | "restaurant"
      | "bar"
      | "cafenea"
      | "fast_food"
      | "pizzerie"
      | "catering"
      | "hotel",
    currency: "RON",
    defaultVatFood: 9,
    defaultVatAlcohol: 19,
  });

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const utils = trpc.useUtils();
  const { data: localLocations = [], isLoading } =
    trpc.horeca.locations.list.useQuery();

  // Smart Kiosk Bridge — fetch real locations when local DB is empty
  const { data: bridgeLocations = [], isLoading: bridgeLoading } =
    trpc.horeca.kioskBridge.listLocations.useQuery(undefined, {
      enabled: !isLoading && localLocations.length === 0,
      refetchOnWindowFocus: false,
    });

  // Merge: use local if available, otherwise Smart Kiosk bridge
  const usesBridge = localLocations.length === 0 && bridgeLocations.length > 0;
  const locations = usesBridge
    ? bridgeLocations.map((bl: any, idx: number) => ({
        id: idx + 1,
        _bridgeId: bl.id,
        name: bl.name,
        address: "",
        city: "",
        phone: "",
        type: "fast_food" as const,
        currency: "RON",
        defaultVatFood: 9,
        defaultVatAlcohol: 19,
        brands: bl.brands || [],
        active: bl.active !== false,
      }))
    : localLocations;

  const effectiveLoading =
    isLoading || (localLocations.length === 0 && bridgeLoading);

  const filtered = useMemo(() => {
    if (!search.trim()) return locations;
    const q = search
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return locations.filter((l: any) => {
      const searchIn = [
        l.name,
        l.address,
        l.city,
        l.phone,
        l.type,
        ...(l.brands || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return searchIn.includes(q);
    });
  }, [locations, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated =
    rowsPerPage === 9999
      ? filtered
      : filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const createMut = trpc.horeca.locations.create.useMutation({
    onSuccess: () => {
      toast.success("Locație creată cu succes");
      utils.horeca.locations.list.invalidate();
      resetForm();
    },
    onError: e => toast.error(e.message),
  });

  const updateMut = trpc.horeca.locations.update.useMutation({
    onSuccess: () => {
      toast.success("Locație actualizată");
      utils.horeca.locations.list.invalidate();
      resetForm();
    },
    onError: e => toast.error(e.message),
  });

  const deleteMut = trpc.horeca.locations.delete.useMutation({
    onSuccess: () => {
      toast.success("Locație dezactivată");
      utils.horeca.locations.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setForm({
      name: "",
      address: "",
      city: "",
      phone: "",
      type: "restaurant",
      currency: "RON",
      defaultVatFood: 9,
      defaultVatAlcohol: 19,
    });
  }

  function handleEdit(loc: (typeof locations)[0]) {
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
    if (!form.name.trim()) {
      toast.error("Numele locației este obligatoriu");
      return;
    }
    if (editId) updateMut.mutate({ id: editId, ...form });
    else createMut.mutate(form);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Brand Logo" className="h-10 w-auto object-contain bg-white rounded-lg px-2 py-1 shadow-sm border border-slate-200" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Locații HORECA
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {locations.length} locații configurate
              {usesBridge && (
                <span className="text-primary font-semibold">
                  {" "}
                  (Smart Kiosk API)
                </span>
              )}
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Locație nouă
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-lg p-6">
          <h2 className="text-slate-900 dark:text-white font-semibold mb-4">
            {editId ? "Editează locație" : "Locație nouă"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">
                Nume locație *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Restaurant Central"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 dark:focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">
                Tip locație
              </label>
              <select
                value={form.type}
                onChange={e =>
                  setForm(f => ({ ...f, type: e.target.value as any }))
                }
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 dark:focus:border-orange-500"
              >
                {LOCATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {TYPE_ICONS[t.value]} {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">
                Telefon
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="0722 000 000"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 dark:focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">
                Adresă
              </label>
              <input
                type="text"
                value={form.address}
                onChange={e =>
                  setForm(f => ({ ...f, address: e.target.value }))
                }
                placeholder="Str. Exemplu nr. 1"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 dark:focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">
                Oraș
              </label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="București"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 dark:focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">
                TVA Mâncare / Băuturi nealcoolice (%)
              </label>
              <input
                type="number"
                value={form.defaultVatFood}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    defaultVatFood: Number(e.target.value),
                  }))
                }
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 dark:focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">
                TVA Alcool (%)
              </label>
              <input
                type="number"
                value={form.defaultVatAlcohol}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    defaultVatAlcohol: Number(e.target.value),
                  }))
                }
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500 dark:focus:border-orange-500"
              />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <X className="w-4 h-4" /> Anulează
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editId ? "Salvează" : "Creează"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 z-10" />
        <input
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-900 dark:text-white rounded-full focus:outline-none focus:border-orange-500 dark:focus:border-orange-500 transition-colors"
          style={{
            paddingLeft: 36,
            paddingRight: search ? 90 : 16,
            paddingTop: 10,
            paddingBottom: 10,
            fontSize: 14,
          }}
          placeholder="Caută după nume, oraș, tip..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {search && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-500 text-white rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shadow-sm">
            {filtered.length} / {locations.length}
          </div>
        )}
      </div>

      {/* Tabel */}
      {effectiveLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <span className="text-slate-500 dark:text-slate-400 text-sm">
              Total:{" "}
              <strong className="text-slate-900 dark:text-white font-bold">
                {filtered.length}
              </strong>{" "}
              înregistrări
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="text-slate-600 dark:text-slate-400 text-left text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold text-center w-12">
                    Nr.
                  </th>
                  <th className="px-4 py-3 font-semibold">Locație</th>
                  <th className="px-4 py-3 font-semibold">Tip</th>
                  <th className="px-4 py-3 font-semibold">Adresă / Oraș</th>
                  <th className="px-4 py-3 font-semibold">Branduri</th>
                  <th className="px-4 py-3 font-semibold">Telefon</th>
                  <th className="px-4 py-3 font-semibold">TVA</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center text-slate-500 dark:text-slate-400 py-12"
                    >
                      {search
                        ? "Niciun rezultat pentru căutarea efectuată"
                        : "Nicio locație înregistrată"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((loc, idx) => (
                    <tr
                      key={loc.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
                        {(safePage - 1) * rowsPerPage + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-muted-foreground bg-secondary w-8 h-8 rounded-lg flex items-center justify-center shadow-sm">
                            {(() => {
                              const IconComp =
                                TYPE_ICONS[loc.type || "restaurant"] ||
                                Building2;
                              return <IconComp className="w-4 h-4" />;
                            })()}
                          </span>
                          <span className="text-foreground font-semibold">
                            {loc.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded-md text-xs font-medium capitalize border border-orange-200 dark:border-transparent">
                          {LOCATION_TYPES.find(t => t.value === loc.type)
                            ?.label || loc.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {[loc.address, loc.city].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 items-center">
                          {((loc as any).brands || []).map((b: string) =>
                            BRAND_LOGOS[b] ? (
                              <img
                                key={b}
                                src={BRAND_LOGOS[b]}
                                alt={b}
                                className="h-6 object-contain rounded-md bg-secondary/30 px-1 py-0.5 border border-border"
                              />
                            ) : (
                              <span
                                key={b}
                                className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-semibold rounded-md border border-blue-200 dark:border-blue-500/20"
                              >
                                {b}
                              </span>
                            )
                          )}
                          {(!(loc as any).brands ||
                            (loc as any).brands.length === 0) && (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                        {loc.phone || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-[11px] font-semibold">
                          <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-500/20 w-fit">
                            {loc.defaultVatFood}% alimente
                          </span>
                          <span className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-0.5 rounded border border-red-200 dark:border-red-500/20 w-fit">
                            {loc.defaultVatAlcohol}% alcool
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(loc)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Dezactivezi "${loc.name}"?`))
                                deleteMut.mutate({ id: loc.id });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer paginare */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                Afișează
                <select
                  value={rowsPerPage}
                  onChange={e => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={9999}>Toți</option>
                </select>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400 hidden sm:inline">
                Total:{" "}
                <strong className="text-slate-900 dark:text-white">
                  {filtered.length}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span>
                Pagina{" "}
                <strong className="text-slate-900 dark:text-white">
                  {safePage}
                </strong>{" "}
                din {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-slate-900 dark:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-slate-900 dark:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
