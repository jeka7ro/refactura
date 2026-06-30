// HorecaTables — Management mese cu plan vizual de sală
// UI rules: search+counter, Nr.Crt. paginat, footer paginare, rounded-lg

import { useState, useMemo } from "react";
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

const STATUS_CONFIG = {
  free: {
    label: "Liberă",
    bg: "bg-green-500/20",
    border: "border-green-500/50",
    dot: "bg-green-400",
    text: "text-green-300",
  },
  occupied: {
    label: "Ocupată",
    bg: "bg-red-500/20",
    border: "border-red-500/50",
    dot: "bg-red-400",
    text: "text-red-300",
  },
  reserved: {
    label: "Rezervată",
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/50",
    dot: "bg-yellow-400",
    text: "text-yellow-300",
  },
  cleaning: {
    label: "Curățenie",
    bg: "bg-blue-500/20",
    border: "border-blue-500/50",
    dot: "bg-blue-400",
    text: "text-blue-300",
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
  const [form, setForm] = useState({
    number: "",
    capacity: 4,
    zone: "Sală principală",
  });

  // Search + paginare (pentru list view)
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <Grid3X3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Plan Sală
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {tables.length} mese · {totalSeats} locuri totale
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {locations.length > 1 && (
            <select
              value={locationId}
              onChange={e => {
                setSelectedLocationId(Number(e.target.value));
              }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500 shadow-sm"
            >
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          {/* Toggle view */}
          <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setViewMode("plan")}
              className={`px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1.5 transition-colors ${viewMode === "plan" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
            >
              <Grid3X3 className="w-4 h-4" /> Plan
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1.5 transition-colors ${viewMode === "list" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
            >
              <List className="w-4 h-4" /> Listă
            </button>
          </div>
          {!showForm && (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Masă nouă
            </button>
          )}
        </div>
      </div>

      {/* Form adăugare masă */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-slate-900 dark:text-white font-bold text-lg mb-4">
            {editId ? "Editează masă" : "Masă nouă"}
          </h2>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
                Număr masă *
              </label>
              <input
                type="text"
                value={form.number}
                onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                placeholder="ex: 1, 2A, VIP-1, Bar-3"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
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
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-semibold mb-1">
                Zonă
              </label>
              <select
                value={form.zone}
                onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 shadow-sm"
              >
                {ZONES.map(z => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                <X className="w-4 h-4" /> Anulează
              </button>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm"
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
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── PLAN VIEW ──────────────────────────────────────────────────── */}
          {viewMode === "plan" && (
            <div className="space-y-6">
              {/* Legendă */}
              <div className="flex gap-4 flex-wrap bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center gap-1.5 text-sm font-medium"
                  >
                    <div className={`w-3 h-3 rounded-full ${v.dot}`} />
                    <span className="text-slate-700 dark:text-slate-300">
                      {v.label}
                    </span>
                  </div>
                ))}
              </div>

              {tables.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-sm border-dashed">
                  <Grid3X3 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-900 dark:text-white font-bold text-lg">
                    Nicio masă configurată
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    Adaugă prima masă folosind butonul de mai sus
                  </p>
                </div>
              ) : (
                Object.entries(byZone).map(([zone, zoneTables]) => (
                  <div
                    key={zone}
                    className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800"
                  >
                    <h3 className="text-slate-900 dark:text-white text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" /> {zone}
                      <span className="text-slate-500 font-medium normal-case">
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
                            className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all hover:scale-105 bg-white dark:bg-slate-800 shadow-sm ${cfg.border}`}
                            title={`Masă ${table.number} · ${cfg.label} · ${table.capacity} locuri`}
                          >
                            {/* Status dot */}
                            <div
                              className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${cfg.dot} shadow-sm`}
                            />
                            {/* Număr masă */}
                            <p className="text-slate-900 dark:text-white font-black text-center text-xl leading-none mb-1 mt-1">
                              {table.number}
                            </p>
                            {/* Capacitate */}
                            <div className="flex items-center justify-center gap-1 mb-2">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">
                                {table.capacity}
                              </span>
                            </div>
                            {/* Status label */}
                            <p
                              className={`text-center text-[10px] uppercase font-bold tracking-wider mt-1 rounded-md py-0.5 px-1 bg-opacity-20 ${cfg.bg} ${cfg.text}`}
                            >
                              {cfg.label}
                            </p>

                            {/* Quick actions (visible on hover) */}
                            <div className="mt-3 flex gap-1 opacity-0 hover:opacity-100 transition-opacity absolute inset-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm items-center justify-center rounded-lg p-1">
                              {["free", "occupied", "reserved", "cleaning"].map(
                                s => (
                                  <button
                                    key={s}
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
                                    className={`w-5 h-5 rounded-full transition-all flex items-center justify-center ${STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].dot} ${table.status === s ? "ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-800" : "opacity-50 hover:opacity-100 hover:scale-110"}`}
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
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 z-10" />
                <input
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 shadow-sm transition-colors rounded-full"
                  style={{
                    paddingLeft: 36,
                    paddingRight: search ? 90 : 16,
                    paddingTop: 10,
                    paddingBottom: 10,
                    fontSize: 14,
                  }}
                  placeholder="Caută după număr, zonă, status..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                {search && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-100 dark:bg-blue-600 text-blue-800 dark:text-white rounded-full px-2.5 py-0.5 text-xs font-bold">
                    {filtered.length} / {tables.length}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    Total:{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {filtered.length}
                    </strong>{" "}
                    mese
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <tr className="text-slate-600 dark:text-slate-400 text-left">
                      <th
                        style={{ width: 50, textAlign: "center" }}
                        className="px-3 py-3 font-semibold text-xs uppercase tracking-wider"
                      >
                        Nr.
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                        Masă
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                        Zonă
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                        Locuri
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">
                        Acțiuni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginated.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center text-slate-500 py-12"
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
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <td
                              style={{ textAlign: "center" }}
                              className="px-3 py-3 text-slate-400 dark:text-slate-500 font-medium"
                            >
                              {(safePage - 1) * rowsPerPage + idx + 1}
                            </td>
                            <td className="px-4 py-3 text-slate-900 dark:text-white font-bold text-base">
                              {table.number}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                              {table.zone || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                                <Users className="w-4 h-4 text-slate-400" />{" "}
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
                                className={`bg-white dark:bg-slate-800 border ${cfg.border} text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm`}
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
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Dezactivezi masa ${table.number}?`
                                      )
                                    )
                                      deleteMut.mutate({ id: table.id });
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                {/* Footer paginare */}
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium flex items-center gap-2">
                      Afișează
                      <select
                        value={rowsPerPage}
                        onChange={e => {
                          setRowsPerPage(Number(e.target.value));
                          setPage(1);
                        }}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-blue-500"
                      >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={9999}>Toți</option>
                      </select>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium hidden sm:inline-block">
                      Total:{" "}
                      <strong className="text-slate-900 dark:text-white">
                        {filtered.length}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                      Pagina {safePage} din {totalPages}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setPage(p => Math.min(totalPages, p + 1))
                        }
                        disabled={safePage === totalPages}
                        className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
    </div>
  );
}
