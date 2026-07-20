import { useState, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { ArrowLeft, Search, Calendar, FileText, TrendingUp, Users, Receipt, X, Building2 } from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────── */
function fmt(n: number) { return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#8b5cf6", "#f97316", "#06b6d4"];

function KPI({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex gap-3 items-start hover:shadow-md transition-shadow">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:    { label: "În așteptare", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    processed:  { label: "Procesată",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    refactured: { label: "Refacturată", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    archived:   { label: "Arhivată",    cls: "bg-slate-50 text-slate-500 border-slate-200" },
  };
  const s = map[status || ""] || { label: status || "-", cls: "bg-slate-50 text-slate-500 border-slate-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>{s.label}</span>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-4 py-3 text-sm">
      <p className="text-xs font-semibold text-slate-500 mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-700 dark:text-slate-300">{p.name}:</span>
          <span className="font-bold text-slate-900 dark:text-white">{fmt(p.value)} RON</span>
        </div>
      ))}
    </div>
  );
};

/* ─── main component ──────────────────────────────────────── */
export default function CostCenterDetail() {
  const params = useParams<{ id: string }>();
  const centerId = Number(params.id);
  const [, navigate] = useLocation();

  const [supplierSearch, setSupplierSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSupplierSearch = useCallback((val: string) => {
    setSupplierSearch(val);
    clearTimeout((window as any).__st);
    (window as any).__st = setTimeout(() => setDebouncedSearch(val), 350);
  }, []);

  const { data: centers = [] } = trpc.costCenters.list.useQuery();
  const center = (centers as any[]).find((c) => c.id === centerId);

  const { data: invoices = [], isLoading, isFetching } = trpc.costCenters.getInvoicesByCostCenter.useQuery(
    { costCenterId: centerId, supplierSearch: debouncedSearch || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: centerId > 0, placeholderData: keepPreviousData }
  );

  /* ── computed KPIs ──── */
  const totalSpend   = useMemo(() => (invoices as any[]).reduce((s, i) => s + (Number(i.total) || 0), 0), [invoices]);
  const totalVAT     = useMemo(() => (invoices as any[]).reduce((s, i) => s + (Number(i.totalVAT) || 0), 0), [invoices]);
  const totalNoVAT   = totalSpend - totalVAT;
  const uniqueCount  = useMemo(() => new Set((invoices as any[]).map(i => i.supplierCUI).filter(Boolean)).size, [invoices]);
  const currency     = (invoices[0] as any)?.currency || "RON";
  const hasFilters   = supplierSearch || dateFrom || dateTo;

  /* ── chart data: monthly spend ─── */
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; total: number; vat: number }> = {};
    (invoices as any[]).forEach(inv => {
      const d = (inv.issueDate || "").slice(0, 7);
      if (!d) return;
      if (!map[d]) map[d] = { month: d, total: 0, vat: 0 };
      map[d].total += Number(inv.total) || 0;
      map[d].vat   += Number(inv.totalVAT) || 0;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [invoices]);

  /* ── chart data: per supplier ─── */
  const supplierData = useMemo(() => {
    const map: Record<string, number> = {};
    (invoices as any[]).forEach(inv => {
      const key = inv.supplierName || inv.supplierCUI || "Necunoscut";
      map[key] = (map[key] || 0) + (Number(inv.total) || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [invoices]);

  /* ── pie: status distribution ─── */
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    (invoices as any[]).forEach(inv => {
      const s = inv.status || "pending";
      map[s] = (map[s] || 0) + 1;
    });
    const labels: Record<string, string> = { pending: "În așteptare", processed: "Procesată", refactured: "Refacturată", archived: "Arhivată" };
    return Object.entries(map).map(([key, value]) => ({ name: labels[key] || key, value }));
  }, [invoices]);

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/centre-cost")} className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {center?.name || `Centru de Cost #${centerId}`}
            </h1>
            {center?.city && <p className="text-xs text-slate-500">{center.city}{center.address ? ` · ${center.address}` : ""}</p>}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Receipt} label="Total Facturi" value={invoices.length} color="bg-blue-100 dark:bg-blue-900/30 text-blue-600" />
        <KPI icon={TrendingUp} label="Total Cheltuieli" value={fmt(totalSpend)} sub={`Fără TVA: ${fmt(totalNoVAT)} ${currency}`} color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" />
        <KPI icon={FileText} label="Total TVA" value={fmt(totalVAT)} sub={currency} color="bg-purple-100 dark:bg-purple-900/30 text-purple-600" />
        <KPI icon={Users} label="Furnizori Unici" value={uniqueCount} color="bg-amber-100 dark:bg-amber-900/30 text-amber-600" />
      </div>

      {/* ── Charts Row ── */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Area chart - Monthly spend */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Cheltuieli Lunare</h3>
              <p className="text-xs text-slate-400 mt-0.5">Evoluția cheltuielilor pe luni</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gVAT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2.5} fill="url(#gTotal)" dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="vat" name="TVA" stroke="#22c55e" strokeWidth={2} fill="url(#gVAT)" dot={{ r: 3, fill: "#22c55e" }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie - Status */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Status Facturi</h3>
              <p className="text-xs text-slate-400 mt-0.5">Distribuția pe status</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v} facturi`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {statusData.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-600 dark:text-slate-400">{s.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bar chart - Top Suppliers */}
          {supplierData.length > 0 && (
            <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Furnizori după Cheltuieli</h3>
                <p className="text-xs text-slate-400 mt-0.5">Primii {supplierData.length} furnizori după valoarea totală</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={supplierData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Total" radius={[6, 6, 0, 0]}>
                    {supplierData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Caută Furnizor</label>
            <div className="flex items-center gap-2 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 focus-within:ring-2 focus-within:ring-indigo-500">
              {isFetching
                ? <svg className="w-3.5 h-3.5 text-indigo-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                : <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              }
              <input type="text" placeholder="Denumire sau CUI..." value={supplierSearch}
                onChange={(e) => handleSupplierSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">De la dată</label>
            <div className="flex items-center gap-2 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 focus-within:ring-2 focus-within:ring-indigo-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Până la dată</label>
            <div className="flex items-center gap-2 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 focus-within:ring-2 focus-within:ring-indigo-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-sm focus:outline-none" />
            </div>
          </div>
          {hasFilters && (
            <button onClick={() => { setSupplierSearch(""); setDebouncedSearch(""); setDateFrom(""); setDateTo(""); }}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs transition-colors">
              <X className="w-3.5 h-3.5" /> Resetează
            </button>
          )}
        </div>
      </div>


      {/* ── Invoices Table ── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Facturi Alocate</h2>
          <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-full">
            {isLoading ? "Se încarcă..." : `${invoices.length} înregistrări`}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Se încarcă facturile...</div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <FileText className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">Nicio factură găsită</p>
            <p className="text-xs">{hasFilters ? 'Niciun rezultat. Reseteaza filtrele.' : 'Adauga reguli si apasa butonul Recalculeaza Facturile Vechi.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  {["Nr.", "Furnizor", "CUI", "Nr. Factură", "Dată Emitere", "Scadență", "TVA", "Total", "Status"].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === "TVA" || h === "Total" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(invoices as any[]).map((inv, idx) => (
                  <tr key={inv.id}
                    onClick={() => navigate(`/facturi-primite/${inv.id}`)}
                    className="hover:bg-indigo-50/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[180px]">
                      <span className="block truncate">{inv.supplierName || "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{inv.supplierCUI || "-"}</td>
                    <td className="px-4 py-3 text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline">{inv.invoiceNumber || "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{inv.issueDate ? String(inv.issueDate).slice(0, 10) : "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{inv.dueDate ? String(inv.dueDate).slice(0, 10) : "-"}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                      {inv.totalVAT != null ? fmt(Number(inv.totalVAT)) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {inv.total != null ? fmt(Number(inv.total)) : "-"}
                      <span className="text-xs text-slate-400 ml-1">{inv.currency || "RON"}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-900/50 border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                    TOTAL ({invoices.length} facturi)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700 text-sm">{fmt(totalVAT)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                    {fmt(totalSpend)} <span className="text-xs text-slate-400">{currency}</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
