// HorecaTables — Management mese cu plan vizual de sală
// UI rules: search+counter, Nr.Crt. paginat, footer paginare, rounded-lg

import { useState, useMemo } from "react";
import {
  MapPin, Plus, Pencil, Trash2, Loader2, Check, X,
  Search, ChevronLeft, ChevronRight, Grid3X3, List,
  Users, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const STATUS_CONFIG = {
  free:     { label: "Liberă",    bg: "bg-green-500/20",  border: "border-green-500/50",  dot: "bg-green-400",  text: "text-green-300" },
  occupied: { label: "Ocupată",   bg: "bg-red-500/20",    border: "border-red-500/50",    dot: "bg-red-400",    text: "text-red-300" },
  reserved: { label: "Rezervată", bg: "bg-yellow-500/20", border: "border-yellow-500/50", dot: "bg-yellow-400", text: "text-yellow-300" },
  cleaning: { label: "Curățenie", bg: "bg-blue-500/20",   border: "border-blue-500/50",   dot: "bg-blue-400",   text: "text-blue-300" },
};

const ZONES = ["Sală principală", "Terasă", "VIP", "Bar", "Privat", "Exterior"];

export default function HorecaTables() {
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"plan" | "list">("plan");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ number: "", capacity: 4, zone: "Sală principală" });

  // Search + paginare (pentru list view)
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const { data: locations = [] } = trpc.horeca.locations.list.useQuery();
  const locationId = selectedLocationId ?? locations[0]?.id ?? 0;
  const utils = trpc.useUtils();

  const { data: tables = [], isLoading } = trpc.horeca.tables.list.useQuery(
    { locationId }, { enabled: locationId > 0 }
  );

  const createMut = trpc.horeca.tables.create.useMutation({
    onSuccess: () => { toast.success("Masă adăugată"); utils.horeca.tables.list.invalidate(); resetForm(); },
    onError: e => toast.error(e.message),
  });
  const updateStatusMut = trpc.horeca.tables.updateStatus.useMutation({
    onSuccess: () => { utils.horeca.tables.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.horeca.tables.delete.useMutation({
    onSuccess: () => { toast.success("Masă dezactivată"); utils.horeca.tables.list.invalidate(); },
    onError: e => toast.error(e.message),
  });

  function resetForm() {
    setShowForm(false); setEditId(null);
    setForm({ number: "", capacity: 4, zone: "Sală principală" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.number.trim()) { toast.error("Numărul mesei este obligatoriu"); return; }
    createMut.mutate({ locationId, ...form });
  }

  // KPI stats
  const freeCount     = tables.filter(t => t.status === "free").length;
  const occupiedCount = tables.filter(t => t.status === "occupied").length;
  const reservedCount = tables.filter(t => t.status === "reserved").length;
  const totalSeats    = tables.reduce((s, t) => s + (t.capacity || 0), 0);

  // Filtrare pentru list view
  const filtered = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return tables.filter(t => [t.number, t.zone, t.status].filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q));
  }, [tables, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginated = rowsPerPage === 9999 ? filtered : filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

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
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Grid3X3 className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Plan Sală</h1>
            <p className="text-slate-400 text-sm">{tables.length} mese · {totalSeats} locuri totale</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {locations.length > 1 && (
            <select value={locationId} onChange={e => { setSelectedLocationId(Number(e.target.value)); }}
              className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          {/* Toggle view */}
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
            <button onClick={() => setViewMode("plan")}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 transition-colors ${viewMode === "plan" ? "bg-orange-600 text-white" : "text-slate-400 hover:text-white"}`}>
              <Grid3X3 className="w-4 h-4" /> Plan
            </button>
            <button onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded text-sm flex items-center gap-1 transition-colors ${viewMode === "list" ? "bg-orange-600 text-white" : "text-slate-400 hover:text-white"}`}>
              <List className="w-4 h-4" /> Listă
            </button>
          </div>
          {!showForm && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Masă nouă
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards — dispar la form */}
      {!showForm && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
            <p className="text-green-400 text-2xl font-bold">{freeCount}</p>
            <p className="text-slate-400 text-xs">Libere</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
            <p className="text-red-400 text-2xl font-bold">{occupiedCount}</p>
            <p className="text-slate-400 text-xs">Ocupate</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
            <p className="text-yellow-400 text-2xl font-bold">{reservedCount}</p>
            <p className="text-slate-400 text-xs">Rezervate</p>
          </div>
          <div className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-3 text-center">
            <p className="text-white text-2xl font-bold">{totalSeats}</p>
            <p className="text-slate-400 text-xs">Locuri totale</p>
          </div>
        </div>
      )}

      {/* Form adăugare masă */}
      {showForm && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-6">
          <h2 className="text-white font-semibold mb-4">{editId ? "Editează masă" : "Masă nouă"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Număr masă *</label>
              <input type="text" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                placeholder="ex: 1, 2A, VIP-1, Bar-3"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Capacitate (locuri)</label>
              <input type="number" min={1} max={50} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Zonă</label>
              <select value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500">
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={resetForm} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                <X className="w-4 h-4" /> Anulează
              </button>
              <button type="submit" disabled={createMut.isPending} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Adaugă
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-orange-400 animate-spin" /></div>
      ) : (
        <>
          {/* ── PLAN VIEW ──────────────────────────────────────────────────── */}
          {viewMode === "plan" && (
            <div className="space-y-6">
              {/* Legendă */}
              <div className="flex gap-4 flex-wrap">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1.5 text-sm">
                    <div className={`w-3 h-3 rounded-full ${v.dot}`} />
                    <span className="text-slate-400">{v.label}</span>
                  </div>
                ))}
              </div>

              {tables.length === 0 ? (
                <div className="text-center py-16 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  <Grid3X3 className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400">Nicio masă configurată</p>
                  <p className="text-slate-500 text-sm mt-1">Adaugă prima masă folosind butonul de mai sus</p>
                </div>
              ) : (
                Object.entries(byZone).map(([zone, zoneTables]) => (
                  <div key={zone}>
                    <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                      <MapPin className="w-3 h-3" /> {zone}
                      <span className="text-slate-600">({zoneTables.length} mese)</span>
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                      {zoneTables.map(table => {
                        const cfg = STATUS_CONFIG[table.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.free;
                        return (
                          <div key={table.id}
                            className={`relative rounded-lg border-2 p-3 cursor-pointer transition-all hover:scale-105 ${cfg.bg} ${cfg.border}`}
                            title={`Masă ${table.number} · ${cfg.label} · ${table.capacity} locuri`}
                          >
                            {/* Status dot */}
                            <div className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${cfg.dot}`} />
                            {/* Număr masă */}
                            <p className="text-white font-bold text-center text-lg leading-none mb-1">{table.number}</p>
                            {/* Capacitate */}
                            <div className="flex items-center justify-center gap-0.5">
                              <Users className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-500 text-xs">{table.capacity}</span>
                            </div>
                            {/* Status label */}
                            <p className={`text-center text-xs mt-1 ${cfg.text}`}>{cfg.label}</p>
                            {/* Quick actions */}
                            <div className="mt-2 flex gap-1">
                              {["free", "occupied", "reserved", "cleaning"].map(s => (
                                <button key={s}
                                  onClick={() => updateStatusMut.mutate({ id: table.id, status: s as any })}
                                  title={STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}
                                  className={`flex-1 h-1.5 rounded-full transition-all ${STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].dot} ${table.status === s ? "opacity-100" : "opacity-25 hover:opacity-60"}`}
                                />
                              ))}
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
              <div style={{ position: "relative" }}>
                <Search className="w-4 h-4 text-slate-500" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 1 }} />
                <input
                  className="w-full bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-orange-500"
                  style={{ paddingLeft: 36, paddingRight: search ? 90 : 16, paddingTop: 8, paddingBottom: 8, borderRadius: 9999, fontSize: 14 }}
                  placeholder="Caută după număr, zonă, status..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
                {search && (
                  <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgb(234 88 12)", color: "white", borderRadius: 9999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                    {filtered.length} / {tables.length}
                  </div>
                )}
              </div>

              <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700/50">
                  <span className="text-slate-400 text-sm">Total: <strong className="text-white">{filtered.length}</strong> mese</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr className="text-slate-400 text-left">
                      <th style={{ width: 50, textAlign: "center" }} className="px-3 py-3 font-medium">Nr.</th>
                      <th className="px-4 py-3 font-medium">Masă</th>
                      <th className="px-4 py-3 font-medium">Zonă</th>
                      <th className="px-4 py-3 font-medium">Locuri</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr><td colSpan={6} className="text-center text-slate-500 py-10">
                        {search ? "Niciun rezultat" : "Nicio masă configurată"}
                      </td></tr>
                    ) : paginated.map((table, idx) => {
                      const cfg = STATUS_CONFIG[table.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.free;
                      return (
                        <tr key={table.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                          <td style={{ textAlign: "center", color: "rgb(100 116 139)", fontSize: 13 }} className="px-3 py-3">
                            {(safePage - 1) * rowsPerPage + idx + 1}
                          </td>
                          <td className="px-4 py-3 text-white font-bold text-lg">{table.number}</td>
                          <td className="px-4 py-3 text-slate-300">{table.zone || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-slate-300">
                              <Users className="w-3 h-3" /> {table.capacity}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select value={table.status || "free"}
                              onChange={e => updateStatusMut.mutate({ id: table.id, status: e.target.value as any })}
                              className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-orange-500">
                              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <button onClick={() => { if (confirm(`Dezactivezi masa ${table.number}?`)) deleteMut.mutate({ id: table.id }); }}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Footer paginare */}
                <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(51,65,85,0.5)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(15,23,42,0.4)", borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ color: "rgb(148 163 184)", fontSize: 13, whiteSpace: "nowrap" }}>
                      Afișează&nbsp;
                      <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                        style={{ background: "rgb(30 41 59)", border: "1px solid rgb(51 65 85)", borderRadius: 9999, padding: "2px 8px", color: "white", fontSize: 12 }}>
                        <option value={10}>10</option><option value={15}>15</option><option value={25}>25</option>
                        <option value={50}>50</option><option value={9999}>Toți</option>
                      </select>
                    </span>
                    <span style={{ color: "rgb(148 163 184)", fontSize: 13, whiteSpace: "nowrap" }}>
                      Total: <strong style={{ color: "white" }}>{filtered.length}</strong>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "rgb(148 163 184)", fontSize: 13, whiteSpace: "nowrap" }}>Pagina {safePage} din {totalPages}</span>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                      style={{ padding: "4px 8px", borderRadius: 8, background: safePage === 1 ? "transparent" : "rgb(51 65 85)", color: "white", border: "none", cursor: safePage === 1 ? "not-allowed" : "pointer", opacity: safePage === 1 ? 0.4 : 1 }}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                      style={{ padding: "4px 8px", borderRadius: 8, background: safePage === totalPages ? "transparent" : "rgb(51 65 85)", color: "white", border: "none", cursor: safePage === totalPages ? "not-allowed" : "pointer", opacity: safePage === totalPages ? 0.4 : 1 }}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
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
