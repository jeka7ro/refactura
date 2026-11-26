// HorecaLocations — Management locații HORECA
// Proper Light/Dark mode styling (Premium UI)

import { useState, useMemo } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
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
  ChevronDown,
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
  const [locationToDelete, setLocationToDelete] = useState<any | null>(null);
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
    defaultVatAlcohol: 21,
  });

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("horeca_locations", 10);

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
        address: bl.address || "",
        city: bl.city || "",
        phone: bl.phone || "",
        type: bl.type || "fast_food",
        currency: bl.currency || "RON",
        defaultVatFood: bl.defaultVatFood || 9,
        defaultVatAlcohol: bl.defaultVatAlcohol || 21,
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
      setLocationToDelete(null);
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
      defaultVatAlcohol: 21,
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
      defaultVatAlcohol: loc.defaultVatAlcohol || 21,
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
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Locații HORECA
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {locations.length}
            </strong>{" "}
            locații configurate
            {usesBridge && (
              <span className="text-primary font-semibold ml-1.5">
                (Smart Kiosk API)
              </span>
            )}
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="apple-btn-prominent inline-flex items-center gap-1.5 text-white px-4 h-9 text-[13px] font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Locație nouă
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="apple-surface p-5 sm:p-6">
          <h2 className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-[16px] mb-4">
            {editId ? "Editează locație" : "Locație nouă"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Nume locație *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Restaurant Central"
                className="apple-input w-full h-10 px-3.5"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Tip locație
              </label>
              <select
                value={form.type}
                onChange={e =>
                  setForm(f => ({ ...f, type: e.target.value as any }))
                }
                className="apple-input w-full h-10 px-3.5 cursor-pointer"
              >
                {LOCATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Telefon
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="0722 000 000"
                className="apple-input w-full h-10 px-3.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Adresă
              </label>
              <input
                type="text"
                value={form.address}
                onChange={e =>
                  setForm(f => ({ ...f, address: e.target.value }))
                }
                placeholder="Str. Exemplu nr. 1"
                className="apple-input w-full h-10 px-3.5"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Oraș
              </label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="București"
                className="apple-input w-full h-10 px-3.5"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                TVA mâncare / băuturi nealcoolice (%)
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
                className="apple-input w-full h-10 px-3.5 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                TVA alcool (%)
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
                className="apple-input w-full h-10 px-3.5 tabular-nums"
              />
            </div>
            <div className="md:col-span-2 flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="apple-btn-glass inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7] px-4 h-9 text-[13px] font-medium cursor-pointer"
              >
                <X className="w-4 h-4" /> Anulează
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="apple-btn-prominent inline-flex items-center gap-1.5 disabled:opacity-50 text-white px-4 h-9 text-[13px] font-semibold cursor-pointer"
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

      {/* Search bar inside apple-surface */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              style={{
                paddingLeft: 34,
                paddingRight: search ? 84 : 16,
              }}
              className="apple-pill-control rounded-full w-full h-[34px] text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:bg-white dark:focus:bg-[#2c2c2e]"
              placeholder="Caută după nume, oraș, tip..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <>
                <span className="absolute right-8 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums">
                  {filtered.length}/{locations.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.12] cursor-pointer"
                >
                  <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                </button>
              </>
            )}
          </div>
          <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d] px-2 tabular-nums">
            Total:{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {filtered.length}
            </strong>{" "}
            înregistrări
          </span>
        </div>
      </div>

      {/* Tabel */}
      {effectiveLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
      ) : (
        <div className="apple-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr className="text-[#6e6e73] dark:text-[#98989d] text-left text-[12px] font-medium">
                  <th className="px-4 py-3 font-medium text-center w-12">
                    Nr.
                  </th>
                  <th className="px-4 py-3 font-medium">Locație</th>
                  <th className="px-4 py-3 font-medium">Tip</th>
                  <th className="px-4 py-3 font-medium">Adresă / Oraș</th>
                  <th className="px-4 py-3 font-medium">Branduri</th>
                  <th className="px-4 py-3 font-medium">Telefon</th>
                  <th className="px-4 py-3 font-medium">TVA</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center text-[#6e6e73] dark:text-[#98989d] text-[13px] py-12"
                    >
                      {search
                        ? "Niciun rezultat pentru căutarea efectuată"
                        : "Nicio locație înregistrată"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((loc: any, idx: number) => (
                    <tr
                      key={loc.id}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors group"
                    >
                      <td className="px-4 py-3 text-center text-[#8e8e93] text-[12px] font-medium">
                        {(safePage - 1) * rowsPerPage + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[#6e6e73] dark:text-[#98989d] bg-[#f2f2f7] dark:bg-[#2c2c2e] w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0">
                            {(() => {
                              const IconComp =
                                TYPE_ICONS[loc.type || "restaurant"] ||
                                Building2;
                              return <IconComp className="w-4 h-4" />;
                            })()}
                          </span>
                          <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[13.5px]">
                            {loc.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-0.5 bg-amber-500/12 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300 rounded-full text-[11px] font-medium capitalize border border-amber-500/20">
                          {LOCATION_TYPES.find(t => t.value === loc.type)
                            ?.label || loc.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6e6e73] dark:text-[#98989d] text-[13px]">
                        {[loc.address, loc.city].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {((loc as any).brands || []).map((b: string) =>
                            BRAND_LOGOS[b] ? (
                              <img
                                key={b}
                                src={BRAND_LOGOS[b]}
                                alt={b}
                                className="h-6 object-contain rounded-md bg-[#f2f2f7] dark:bg-[#2c2c2e] px-1 py-0.5 border border-black/[0.06] dark:border-white/[0.08]"
                              />
                            ) : (
                              <span
                                key={b}
                                className="px-2 py-0.5 bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 text-[#0071e3] dark:text-[#64d2ff] text-[10.5px] font-medium rounded-full border border-[#0071e3]/20"
                              >
                                {b}
                              </span>
                            )
                          )}
                          {(!(loc as any).brands ||
                            (loc as any).brands.length === 0) && (
                            <span className="text-[#8e8e93] text-xs">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#1d1d1f] dark:text-[#ebebf5] text-[13px] font-medium">
                        {loc.phone || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-[11px] font-medium">
                          <span className="bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 text-[#0071e3] dark:text-[#64d2ff] px-2 py-0.5 rounded-full border border-[#0071e3]/20 w-fit leading-none">
                            {loc.defaultVatFood}% alimente
                          </span>
                          <span className="bg-amber-500/12 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20 w-fit leading-none">
                            {loc.defaultVatAlcohol}% alcool
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(loc)}
                            className="apple-btn-glass w-8 h-8 flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer"
                            title="Editează locație"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocationToDelete(loc)}
                            className="apple-btn-glass w-8 h-8 flex items-center justify-center text-[#ff3b30] dark:text-[#ff453a] hover:bg-[#ff3b30]/10 cursor-pointer"
                            title="Dezactivează locație"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
          <div className="px-4 sm:px-5 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between flex-wrap gap-2 bg-[#fafafa] dark:bg-white/[0.02] text-xs text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span>Afișează</span>
                <div className="relative inline-block">
                  <select
                    value={rowsPerPage}
                    onChange={e => {
                      setRowsPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="apple-pill-control appearance-none pl-3 pr-7 h-7 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={9999}>Toți</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </span>
              <span className="hidden sm:inline">
                Total înregistrări:{" "}
                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {filtered.length}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>
                Pagina{" "}
                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {safePage}
                </strong>{" "}
                din {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="apple-btn-glass w-7 h-7 flex items-center justify-center disabled:opacity-40 text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="apple-btn-glass w-7 h-7 flex items-center justify-center disabled:opacity-40 text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!locationToDelete}
        onOpenChange={open => !open && setLocationToDelete(null)}
      >
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              Dezactivezi locația „{locationToDelete?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
              Locația nu va mai apărea ca activă pentru preluarea comenzilor noi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                locationToDelete && deleteMut.mutate({ id: locationToDelete.id })
              }
              className="rounded-full bg-[#ff3b30] hover:bg-[#d70015] text-white"
            >
              Dezactivează
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
