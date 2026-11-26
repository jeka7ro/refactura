// HorecaTables — Management mese cu plan vizual de sală
// UI rules: search+counter, Nr.Crt. paginat, footer paginare, rounded-lg

import { useState, useMemo } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
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

const STATUS_CONFIG = {
  free: {
    label: "Liberă",
    bg: "bg-emerald-500/12 dark:bg-emerald-500/18",
    border: "border-emerald-500/40",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  occupied: {
    label: "Ocupată",
    bg: "bg-[#ff3b30]/12 dark:bg-[#ff453a]/18",
    border: "border-[#ff3b30]/40",
    dot: "bg-[#ff3b30]",
    text: "text-[#d70015] dark:text-[#ff6961]",
  },
  reserved: {
    label: "Rezervată",
    bg: "bg-amber-500/12 dark:bg-amber-500/18",
    border: "border-amber-500/40",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  cleaning: {
    label: "Curățenie",
    bg: "bg-[#0071e3]/12 dark:bg-[#0a84ff]/18",
    border: "border-[#0071e3]/40",
    dot: "bg-[#0071e3]",
    text: "text-[#0071e3] dark:text-[#64d2ff]",
  },
};

const ZONES = ["Sală principală", "Terasă", "VIP", "Bar", "Privat", "Exterior"];

export default function HorecaTables() {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"plan" | "list">("plan");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [tableToDelete, setTableToDelete] = useState<any | null>(null);
  const [form, setForm] = useState({
    number: "",
    capacity: 4,
    zone: "Sală principală",
  });

  // Search + paginare (pentru list view)
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("horeca_tables", 25);

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;
  const utils = trpc.useUtils();

  const { data: tables = [], isLoading } = trpc.horeca.tables.list.useQuery(
    { locationId },
    { enabled: locationId > 0 }
  );

  const createMut = trpc.horeca.tables.create.useMutation({
    onSuccess: () => {
      toast.success("Masă adăugată");
      utils.horeca.tables.list.invalidate();
      resetForm();
    },
    onError: e => toast.error(e.message),
  });
  const updateStatusMut = trpc.horeca.tables.updateStatus.useMutation({
    onSuccess: () => {
      utils.horeca.tables.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.horeca.tables.delete.useMutation({
    onSuccess: () => {
      toast.success("Masă dezactivată");
      setTableToDelete(null);
      utils.horeca.tables.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ number: "", capacity: 4, zone: "Sală principală" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.number.trim()) {
      toast.error("Numărul mesei este obligatoriu");
      return;
    }
    createMut.mutate({ locationId, ...form });
  }

  // KPI stats
  const freeCount = tables.filter(t => t.status === "free").length;
  const occupiedCount = tables.filter(t => t.status === "occupied").length;
  const reservedCount = tables.filter(t => t.status === "reserved").length;
  const totalSeats = tables.reduce((s, t) => s + (t.capacity || 0), 0);

  // Filtrare pentru list view
  const filtered = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return tables.filter(t =>
      [t.number, t.zone, t.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(q)
    );
  }, [tables, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated =
    rowsPerPage === 9999
      ? filtered
      : filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  // Grupare pe zone (pentru plan view)
  const byZone = useMemo(() => {
    const zones: Record<string, typeof tables> = {};
    tables.forEach(t => {
      const z = t.zone || "Fără zonă";
      if (!zones[z]) zones[z] = [];
      zones[z].push(t);
    });
    return zones;
  }, [tables]);

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Plan sală
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {tables.length}
            </strong>{" "}
            mese ·{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {totalSeats}
            </strong>{" "}
            locuri totale
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {locations.length > 1 && (
            <select
              value={locationId}
              onChange={e => {
                setSelectedLocationId(Number(e.target.value));
              }}
              className="apple-pill-control px-3.5 h-[34px] text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none cursor-pointer"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          {/* Toggle view */}
          <div className="apple-segmented">
            <button
              type="button"
              data-active={viewMode === "plan"}
              onClick={() => setViewMode("plan")}
              className="apple-segmented-item px-3"
            >
              <Grid3X3 className="w-3.5 h-3.5" /> Plan
            </button>
            <button
              type="button"
              data-active={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className="apple-segmented-item px-3"
            >
              <List className="w-3.5 h-3.5" /> Listă
            </button>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="apple-btn-prominent inline-flex items-center gap-1.5 text-white px-4 h-[34px] text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Masă nouă
            </button>
          )}
        </div>
      </div>

      {/* Form adăugare masă */}
      {showForm && (
        <div className="apple-surface p-5 sm:p-6">
          <h2 className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-[16px] mb-4">
            {editId ? "Editează masă" : "Masă nouă"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Număr masă *
              </label>
              <input
                type="text"
                value={form.number}
                onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                placeholder="ex: 1, 2A, VIP-1, Bar-3"
                className="apple-input w-full h-10 px-3.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Capacitate (locuri)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.capacity}
                onChange={e =>
                  setForm(f => ({ ...f, capacity: Number(e.target.value) }))
                }
                className="apple-input w-full h-10 px-3.5 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[#6e6e73] dark:text-[#98989d] text-[12.5px] font-medium mb-1">
                Zonă
              </label>
              <select
                value={form.zone}
                onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                className="apple-input w-full h-10 px-3.5 text-sm cursor-pointer"
              >
                {ZONES.map(z => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end gap-2.5 mt-1">
              <button
                type="button"
                onClick={resetForm}
                className="apple-btn-glass inline-flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#f5f5f7] px-4 h-9 text-xs font-semibold cursor-pointer"
              >
                <X className="w-4 h-4" /> Anulează
              </button>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="apple-btn-prominent inline-flex items-center gap-1.5 disabled:opacity-50 text-white px-5 h-9 text-xs font-semibold cursor-pointer"
              >
                {createMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Adaugă
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* ── PLAN VIEW ──────────────────────────────────────────────────── */}
          {viewMode === "plan" && (
            <div className="space-y-4">
              {/* Legendă */}
              <div className="apple-surface px-4 py-2.5 flex gap-4 flex-wrap items-center">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center gap-1.5 text-xs font-medium"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${v.dot}`} />
                    <span className="text-[#1d1d1f] dark:text-[#ebebf5]">
                      {v.label}
                    </span>
                  </div>
                ))}
              </div>

              {tables.length === 0 ? (
                <div className="apple-surface text-center py-16 p-6">
                  <Grid3X3 className="w-12 h-12 text-[#8e8e93] mx-auto mb-3 opacity-50" />
                  <p className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-base">
                    Nicio masă configurată
                  </p>
                  <p className="text-[#6e6e73] dark:text-[#98989d] text-xs mt-1">
                    Adaugă prima masă folosind butonul de mai sus
                  </p>
                </div>
              ) : (
                Object.entries(byZone).map(([zone, zoneTables]) => (
                  <div
                    key={zone}
                    className="apple-surface p-4 sm:p-5"
                  >
                    <h3 className="text-[#1d1d1f] dark:text-[#f5f5f7] text-[14px] font-bold mb-4 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" /> {zone}
                      <span className="text-[#6e6e73] dark:text-[#98989d] font-medium text-xs tabular-nums">
                        ({zoneTables.length} mese)
                      </span>
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                      {zoneTables.map(table => {
                        const cfg =
                          STATUS_CONFIG[
                            table.status as keyof typeof STATUS_CONFIG
                          ] || STATUS_CONFIG.free;
                        return (
                          <div
                            key={table.id}
                            className={`relative rounded-2xl border p-3 cursor-pointer transition-all hover:shadow-md bg-[#f5f5f7]/60 dark:bg-[#2c2c2e] ${cfg.border} tabular-nums`}
                            title={`Masă ${table.number} · ${cfg.label} · ${table.capacity} locuri`}
                          >
                            {/* Status dot */}
                            <div
                              className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${cfg.dot}`}
                            />
                            {/* Număr masă */}
                            <p className="text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-center text-lg leading-none mb-1 mt-1">
                              {table.number}
                            </p>
                            {/* Capacitate */}
                            <div className="flex items-center justify-center gap-1 mb-2">
                              <Users className="w-3.5 h-3.5 text-[#8e8e93]" />
                              <span className="text-[#6e6e73] dark:text-[#98989d] text-xs font-semibold">
                                {table.capacity}
                              </span>
                            </div>
                            {/* Status label */}
                            <p
                              className={`text-center text-[10px] font-semibold mt-1 rounded-full py-0.5 px-1.5 ${cfg.bg} ${cfg.text}`}
                            >
                              {cfg.label}
                            </p>

                            {/* Quick actions (visible on hover) */}
                            <div className="flex gap-1 opacity-0 hover:opacity-100 transition-opacity absolute inset-0 bg-white/92 dark:bg-[#1c1c1e]/92 backdrop-blur-sm items-center justify-center rounded-2xl p-1">
                              {["free", "occupied", "reserved", "cleaning"].map(
                                s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      updateStatusMut.mutate({
                                        id: table.id,
                                        status: s as any,
                                      });
                                    }}
                                    title={
                                      STATUS_CONFIG[
                                        s as keyof typeof STATUS_CONFIG
                                      ].label
                                    }
                                    className={`w-5 h-5 rounded-full transition-all flex items-center justify-center cursor-pointer ${STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].dot} ${table.status === s ? "ring-2 ring-offset-1 ring-black/30 dark:ring-white/40 dark:ring-offset-[#1c1c1e]" : "opacity-55 hover:opacity-100 hover:scale-110"}`}
                                  />
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── LIST VIEW ──────────────────────────────────────────────────── */}
          {viewMode === "list" && (
            <>
              {/* Search bar */}
              <div className="apple-surface px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    style={{
                      paddingLeft: 34,
                      paddingRight: search ? 84 : 16,
                    }}
                    className="apple-pill-control rounded-full w-full h-[34px] text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none focus:bg-white dark:focus:bg-[#2c2c2e]"
                    placeholder="Caută după număr, zonă, status..."
                    value={search}
                    onChange={e => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                  {search && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums">
                      {filtered.length} / {tables.length}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#6e6e73] dark:text-[#98989d] px-2 tabular-nums">
                  Total:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {filtered.length}
                  </strong>{" "}
                  mese
                </span>
              </div>

              <div className="apple-surface overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                      <tr className="text-[#6e6e73] dark:text-[#98989d] text-left text-[12px] font-medium">
                        <th className="w-12 text-center px-3 py-3 font-medium">
                          Nr.
                        </th>
                        <th className="px-4 py-3 font-medium">
                          Masă
                        </th>
                        <th className="px-4 py-3 font-medium">
                          Zonă
                        </th>
                        <th className="px-4 py-3 font-medium">
                          Locuri
                        </th>
                        <th className="px-4 py-3 font-medium">
                          Status
                        </th>
                        <th className="px-4 py-3 font-medium text-right">
                          Acțiuni
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                      {paginated.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center text-[#6e6e73] dark:text-[#98989d] text-[13px] py-12"
                          >
                            {search
                              ? "Niciun rezultat"
                              : "Nicio masă configurată"}
                          </td>
                        </tr>
                      ) : (
                        paginated.map((table, idx) => {
                          const cfg =
                            STATUS_CONFIG[
                              table.status as keyof typeof STATUS_CONFIG
                            ] || STATUS_CONFIG.free;
                          return (
                            <tr
                              key={table.id}
                              className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                            >
                              <td className="text-center px-3 py-3 text-[#8e8e93] text-xs font-medium">
                                {(safePage - 1) * rowsPerPage + idx + 1}
                              </td>
                              <td className="px-4 py-3 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[13.5px]">
                                {table.number}
                              </td>
                              <td className="px-4 py-3 text-[#6e6e73] dark:text-[#98989d] font-medium text-[13px]">
                                {table.zone || "—"}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 text-[#1d1d1f] dark:text-[#ebebf5] font-medium">
                                  <Users className="w-4 h-4 text-[#8e8e93]" />{" "}
                                  {table.capacity}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={table.status || "free"}
                                  onChange={e =>
                                    updateStatusMut.mutate({
                                      id: table.id,
                                      status: e.target.value as any,
                                    })
                                  }
                                  className={`!rounded-full border ${cfg.border} ${cfg.bg} ${cfg.text} px-3 py-1 text-xs font-semibold focus:outline-none cursor-pointer`}
                                >
                                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setTableToDelete(table)}
                                    className="apple-btn-glass w-8 h-8 flex items-center justify-center text-[#ff3b30] dark:text-[#ff453a] hover:bg-[#ff3b30]/10 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Footer paginare */}
                <div className="px-4 sm:px-5 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between flex-wrap gap-2 bg-[#fafafa] dark:bg-white/[0.02] text-xs text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      Afișează
                      <select
                        value={rowsPerPage}
                        onChange={e => {
                          setRowsPerPage(Number(e.target.value));
                          setPage(1);
                        }}
                        className="apple-pill-control px-2.5 h-7 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={9999}>Toți</option>
                      </select>
                    </span>
                    <span className="hidden sm:inline-block">
                      Total:{" "}
                      <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {filtered.length}
                      </strong>
                    </span>
                  </div>
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
                        onClick={() =>
                          setPage(p => Math.min(totalPages, p + 1))
                        }
                        disabled={safePage === totalPages}
                        className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <AlertDialog
        open={!!tableToDelete}
        onOpenChange={open => !open && setTableToDelete(null)}
      >
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              Dezactivezi masa {tableToDelete?.number}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
              Masa {tableToDelete?.number} ({tableToDelete?.zone || "Sală"}) va fi scoasă din planul sălii.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                tableToDelete && deleteMut.mutate({ id: tableToDelete.id })
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
