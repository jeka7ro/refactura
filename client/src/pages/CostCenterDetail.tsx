import { useState, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  ArrowLeft,
  Search,
  Calendar,
  FileText,
  TrendingUp,
  Users,
  Receipt,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ─── helpers ─────────────────────────────────────────────── */
function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const COLORS = ["#34c759", "#0071e3", "#ff9500", "#ff3b30", "#af52de", "#5ac8fa", "#ffcc00", "#8e8e93"];

function KPI({ icon: Icon, label, value, sub, badgeBg, iconColor }: any) {
  return (
    <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
          {label}
        </span>
        <span className={`w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 ${badgeBg}`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums truncate">
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-[#6e6e73] dark:text-[#98989d] mt-1 tabular-nums truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "În așteptare",
      cls: "bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300",
    },
    processed: {
      label: "Procesată",
      cls: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300",
    },
    refactured: {
      label: "Refacturată",
      cls: "bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff]",
    },
    archived: {
      label: "Arhivată",
      cls: "bg-[#f2f2f7] text-[#6e6e73] dark:bg-[#2c2c2e] dark:text-[#98989d]",
    },
  };
  const s = map[status || ""] || {
    label: status || "—",
    cls: "bg-[#f2f2f7] text-[#6e6e73] dark:bg-[#2c2c2e] dark:text-[#98989d]",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium leading-none ${s.cls}`}>
      {s.label}
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="apple-surface px-3.5 py-2.5 text-xs shadow-lg">
      <p className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5 tabular-nums">
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 tabular-nums">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#6e6e73] dark:text-[#98989d]">{p.name}:</span>
          <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            {fmt(p.value)} RON
          </span>
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
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("cost_center_detail", 15);

  const handleSupplierSearch = useCallback((val: string) => {
    setSupplierSearch(val);
    setPage(1);
    clearTimeout((window as any).__st);
    (window as any).__st = setTimeout(() => setDebouncedSearch(val), 350);
  }, []);

  const { data: centers = [] } = trpc.costCenters.list.useQuery();
  const center = (centers as any[]).find((c) => c.id === centerId);

  const { data: invoices = [], isLoading, isFetching } = trpc.costCenters.getInvoicesByCostCenter.useQuery(
    {
      costCenterId: centerId,
      supplierSearch: debouncedSearch || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    { enabled: centerId > 0, placeholderData: keepPreviousData }
  );

  /* ── computed KPIs ──── */
  const totalSpend = useMemo(
    () => (invoices as any[]).reduce((s, i) => s + (Number(i.total) || 0), 0),
    [invoices]
  );
  const totalVAT = useMemo(
    () => (invoices as any[]).reduce((s, i) => s + (Number(i.totalVAT) || 0), 0),
    [invoices]
  );
  const totalNoVAT = totalSpend - totalVAT;
  const uniqueCount = useMemo(
    () => new Set((invoices as any[]).map(i => i.supplierCUI).filter(Boolean)).size,
    [invoices]
  );
  const currency = (invoices[0] as any)?.currency || "RON";
  const hasFilters = Boolean(supplierSearch || dateFrom || dateTo);

  const totalPages = Math.max(1, Math.ceil(invoices.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginatedInvoices = (invoices as any[]).slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  );

  /* ── chart data: monthly spend ─── */
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; total: number; vat: number }> = {};
    (invoices as any[]).forEach(inv => {
      const d = (inv.issueDate || "").slice(0, 7);
      if (!d) return;
      if (!map[d]) map[d] = { month: d, total: 0, vat: 0 };
      map[d].total += Number(inv.total) || 0;
      map[d].vat += Number(inv.totalVAT) || 0;
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
    const labels: Record<string, string> = {
      pending: "În așteptare",
      processed: "Procesată",
      refactured: "Refacturată",
      archived: "Arhivată",
    };
    return Object.entries(map).map(([key, value]) => ({ name: labels[key] || key, value }));
  }, [invoices]);

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      {/* ── Header — Apple macOS Window Title ── */}
      <div className="flex items-center gap-3 px-0.5">
        <button
          type="button"
          onClick={() => navigate("/centre-cost")}
          aria-label="Înapoi la Centre de Cost"
          className="apple-btn-glass w-9 h-9 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight truncate">
            {center?.name || `Centru de Cost #${centerId}`}
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            {center?.city
              ? `${center.city}${center.address ? ` · ${center.address}` : ""} · `
              : ""}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {invoices.length}
            </strong>{" "}
            facturi alocate
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI
          icon={Receipt}
          label="Total facturi"
          value={invoices.length}
          badgeBg="bg-[#f2f4f7] dark:bg-[#2c2c2e]"
          iconColor="text-[#0071e3] dark:text-[#0a84ff]"
        />
        <KPI
          icon={TrendingUp}
          label="Total cheltuieli"
          value={`${fmt(totalSpend)} ${currency}`}
          sub={`Fără TVA: ${fmt(totalNoVAT)} ${currency}`}
          badgeBg="bg-[#eefbf3] dark:bg-emerald-500/18"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <KPI
          icon={FileText}
          label="Total TVA"
          value={`${fmt(totalVAT)} ${currency}`}
          badgeBg="bg-[#f2f4f7] dark:bg-[#2c2c2e]"
          iconColor="text-[#6e6e73] dark:text-[#98989d]"
        />
        <KPI
          icon={Users}
          label="Furnizori unici"
          value={uniqueCount}
          badgeBg="bg-[#fff6eb] dark:bg-amber-500/18"
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* ── Charts Row ── */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Area chart - Monthly spend */}
          <div className="lg:col-span-2 apple-surface p-5">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Cheltuieli lunare
              </h3>
              <p className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                Evoluția cheltuielilor pe luni
              </p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--tenant-theme-color, #16a34a)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--tenant-theme-color, #16a34a)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gVAT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0071e3" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0071e3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.18)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8e8e93" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#8e8e93" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="var(--tenant-theme-color, #16a34a)"
                  strokeWidth={2.5}
                  fill="url(#gTotal)"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="vat"
                  name="TVA"
                  stroke="#0071e3"
                  strokeWidth={2}
                  fill="url(#gVAT)"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie - Status */}
          <div className="apple-surface p-5">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Status facturi
              </h3>
              <p className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                Distribuția pe status
              </p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v} facturi`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5 tabular-nums">
              {statusData.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-[#6e6e73] dark:text-[#98989d]">{s.name}</span>
                  </div>
                  <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bar chart - Top Suppliers */}
          {supplierData.length > 0 && (
            <div className="lg:col-span-3 apple-surface p-5">
              <div className="mb-4">
                <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Top furnizori după cheltuieli
                </h3>
                <p className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                  Primii {supplierData.length} furnizori după valoarea totală
                </p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={supplierData} margin={{ top: 5, right: 10, left: 10, bottom: 40 }} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.18)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#8e8e93" }}
                    axisLine={false}
                    tickLine={false}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#8e8e93" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Total" radius={[6, 6, 0, 0]}>
                    {supplierData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Unified Filter & Search Toolbar ── */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 h-[34px] rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-xs tabular-nums shrink-0 max-w-full overflow-x-auto no-scrollbar">
            <Calendar className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              aria-label="De la dată"
              className="h-6 px-1 text-xs tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-[108px]"
            />
            <span className="text-[#8e8e93]">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              aria-label="Până la dată"
              className="h-6 px-1 text-xs tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-[108px]"
            />
          </div>

          <div className="sm:ml-auto flex items-center gap-1.5 w-full sm:w-auto sm:flex-1 justify-end min-w-0">
            <div className="relative flex-1 min-w-[160px] max-w-full sm:max-w-[300px]">
              {isFetching ? (
                <Loader2 className="w-3.5 h-3.5 text-[#6e6e73] animate-spin absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              ) : (
                <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
              <input
                type="text"
                placeholder="Caută furnizor după denumire sau CUI..."
                value={supplierSearch}
                onChange={(e) => handleSupplierSearch(e.target.value)}
                style={{ paddingLeft: 34, paddingRight: supplierSearch ? 36 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
              />
              {supplierSearch && (
                <button
                  type="button"
                  onClick={() => handleSupplierSearch("")}
                  aria-label="Șterge căutarea"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.12] cursor-pointer"
                >
                  <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                </button>
              )}
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSupplierSearch("");
                  setDebouncedSearch("");
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
                title="Elimină toate filtrele"
                aria-label="Elimină toate filtrele"
                className="apple-pill-control w-[34px] h-[34px] shrink-0 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Invoices Table ── */}
      <div className="apple-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.025] flex items-center justify-between">
          <h2 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Facturi alocate
          </h2>
          <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2.5 py-0.5 rounded-full tabular-nums font-medium">
            {isLoading ? "Se încarcă..." : `${invoices.length} înregistrări`}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73]" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-[#6e6e73] dark:text-[#98989d]">
            <FileText className="w-9 h-9 opacity-30" />
            <p className="text-[13px] font-medium">Nicio factură găsită</p>
            <p className="text-xs">
              {hasFilters
                ? "Niciun rezultat pentru filtrele selectate."
                : "Adaugă reguli și apasă butonul „Recalculează Facturile Vechi”."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                  <tr>
                    {[
                      "Nr.",
                      "Furnizor",
                      "CUI",
                      "Nr. factură",
                      "Dată emitere",
                      "Scadență",
                      "TVA",
                      "Total",
                      "Status",
                    ].map(h => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap ${
                          h === "TVA" || h === "Total"
                            ? "text-right"
                            : h === "Nr."
                              ? "text-center w-12"
                              : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                  {paginatedInvoices.map((inv, idx) => (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/facturi-primite/${inv.id}`)}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors cursor-pointer group"
                    >
                      <td className="px-3 py-3 text-center text-[12px] text-[#8e8e93] font-medium tabular-nums">
                        {(safePage - 1) * rowsPerPage + idx + 1}
                      </td>
                      <td className="px-4 py-3 text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[200px]">
                        <span className="block truncate">{inv.supplierName || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums whitespace-nowrap">
                        {inv.supplierCUI || "—"}
                      </td>
                      <td className="px-4 py-3 text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold group-hover:underline tabular-nums whitespace-nowrap">
                        {inv.invoiceNumber || "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#6e6e73] dark:text-[#98989d] tabular-nums whitespace-nowrap">
                        {inv.issueDate ? String(inv.issueDate).slice(0, 10) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#6e6e73] dark:text-[#98989d] tabular-nums whitespace-nowrap">
                        {inv.dueDate ? String(inv.dueDate).slice(0, 10) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] text-[#6e6e73] dark:text-[#98989d] tabular-nums whitespace-nowrap">
                        {inv.totalVAT != null ? fmt(Number(inv.totalVAT)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums whitespace-nowrap">
                        {inv.total != null ? fmt(Number(inv.total)) : "—"}
                        <span className="text-[11px] font-medium text-[#8e8e93] ml-1">
                          {inv.currency || "RON"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#fafafa]/85 dark:bg-white/[0.025] border-t border-black/[0.06] dark:border-white/[0.08]">
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-3 text-[12.5px] font-semibold text-[#6e6e73] dark:text-[#98989d] tabular-nums"
                    >
                      Total ({invoices.length} facturi)
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#1d1d1f] dark:text-[#ebebf5] text-[13.5px] tabular-nums">
                      {fmt(totalVAT)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-[14px] whitespace-nowrap tabular-nums">
                      {fmt(totalSpend)}{" "}
                      <span className="text-[11px] font-medium text-[#8e8e93]">{currency}</span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa]/85 dark:bg-white/[0.02] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                <span className="flex items-center whitespace-nowrap">
                  Afișează
                  <Select
                    value={rowsPerPage.toString()}
                    onValueChange={val => {
                      setRowsPerPage(Number(val));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="apple-pill-control h-7 px-2.5 text-[12px] w-[66px] mx-1.5 bg-white dark:bg-[#2c2c2e]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="9999">Toți</SelectItem>
                    </SelectContent>
                  </Select>
                </span>
                <span className="whitespace-nowrap ml-1">
                  din{" "}
                  <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                    {invoices.length}
                  </strong>{" "}
                  facturi
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                <span className="whitespace-nowrap mr-1.5">
                  Pagina{" "}
                  <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                    {safePage}
                  </strong>{" "}
                  din{" "}
                  <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                    {totalPages}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  aria-label="Pagina anterioară"
                  className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  aria-label="Pagina următoare"
                  className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
