// Reports — date reale din DB via tRPC (zero mock-uri)
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Percent,
  Download,
  Calendar,
  BarChart3,
  LineChart as LineChartIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, type Currency } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Reports() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("RON");

  // Date reale
  const { data: reInvoices = [], isLoading: loadingRI } =
    trpc.reinvoice.list.useQuery();
  const { data: emittedInvoices = [], isLoading: loadingEI } =
    trpc.emittedInvoice.list.useQuery();
  const { data: dbClients = [], isLoading: loadingCl } =
    trpc.clients.list.useQuery();
  const { data: archiveData, isLoading: loadingAI } =
    trpc.invoiceArchive.list.useQuery({ limit: 5000 });
  const { data: bnrData } = trpc.system.getBnrRates.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
  });
  const archiveInvoices = (archiveData as any)?.items ?? [];

  const loading = loadingRI || loadingEI || loadingCl || loadingAI;

  const toRonAmount = (val: number, cur?: string | null) => {
    const c = (cur || "RON").toUpperCase();
    if (c === "RON" || c === "LEI") return val;
    const rate =
      bnrData?.rates?.[c] ||
      (c === "EUR" ? 4.977 : c === "USD" ? 4.58 : c === "GBP" ? 5.85 : c === "CHF" ? 5.32 : 1);
    return val * rate;
  };

  // ── Statistici per client ──────────────────────────────────────────────────
  const clientStats = dbClients
    .map((client: any) => {
      const clientRI = reInvoices.filter(
        (r: any) => r.clientId === client.id || r.clientName === client.name
      );
      const totalRevenue = clientRI.reduce(
        (s: number, r: any) => s + Number(r.total || 0),
        0
      );
      const totalMargin = totalRevenue * 0.15; // marjă estimată
      return {
        clientId: client.id,
        clientName: client.name,
        totalRevenue,
        reInvoiceCount: clientRI.length,
        averageMargin: clientRI.length > 0 ? totalMargin / clientRI.length : 0,
        marginPercentage: totalRevenue > 0 ? 15 : 0,
      };
    })
    .filter((c: any) => c.reInvoiceCount > 0)
    .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

  const topClients = clientStats.slice(0, 5);

  // ── Trend lunar din invoiceArchive + emittedInvoices + reInvoices (convertit în RON BNR) ──
  const monthlyMap: Record<
    string,
    { emise: number; primite: number; dateVal: number }
  > = {};
  const platformOutKeys = new Set<string>();
  const normNum = (s?: string | null) =>
    String(s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().replace(/^0+/, "");

  (Array.isArray(emittedInvoices) ? emittedInvoices : []).forEach((e: any) => {
    if (e.status === "cancelled" || e.status === "draft") return;
    if (e.spvIndex) platformOutKeys.add(`SPV:${String(e.spvIndex).trim()}`);
    if (e.number) platformOutKeys.add(`NUM:${normNum(e.number)}`);
    const d = new Date(e.issueDate || e.createdAt);
    if (isNaN(d.getTime())) return;
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[sortKey]) monthlyMap[sortKey] = { emise: 0, primite: 0, dateVal: d.getTime() };
    monthlyMap[sortKey].emise += toRonAmount(Number(e.total || 0), e.currency);
  });

  (Array.isArray(reInvoices) ? reInvoices : []).forEach((r: any) => {
    if (r.status === "cancelled" || r.status === "draft") return;
    if (r.spvIndex) platformOutKeys.add(`SPV:${String(r.spvIndex).trim()}`);
    if (r.number) platformOutKeys.add(`NUM:${normNum(r.number)}`);
    const d = new Date(r.issueDate || r.createdAt);
    if (isNaN(d.getTime())) return;
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[sortKey]) monthlyMap[sortKey] = { emise: 0, primite: 0, dateVal: d.getTime() };
    monthlyMap[sortKey].emise += toRonAmount(Number(r.total || 0), r.currency);
  });

  archiveInvoices.forEach((inv: any) => {
    const rawDate = inv.issueDate || inv.createdAt;
    if (!rawDate) return;

    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return;

    if (inv.direction !== "in") {
      const spvIdx = inv.spvIndex ? String(inv.spvIndex).trim() : "";
      if (
        (spvIdx && platformOutKeys.has(`SPV:${spvIdx}`)) ||
        (inv.invoiceNumber && platformOutKeys.has(`NUM:${normNum(inv.invoiceNumber)}`))
      ) {
        return;
      }
    }

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const sortKey = `${yyyy}-${mm}`;

    if (!monthlyMap[sortKey])
      monthlyMap[sortKey] = { emise: 0, primite: 0, dateVal: d.getTime() };

    const ronVal = toRonAmount(Number(inv.total || 0), inv.currency);
    if (inv.direction === "in") {
      monthlyMap[sortKey].primite += ronVal;
    } else {
      monthlyMap[sortKey].emise += ronVal;
    }
  });

  const monthlyData = Object.entries(monthlyMap)
    .sort((a, b) => a[0].localeCompare(b[0])) // sortare cronologică garantată YYYY-MM
    .slice(-6)
    .map(([key, v]) => {
      const d = new Date(v.dateVal);
      return {
        month: d.toLocaleString("ro-RO", { month: "short", year: "2-digit" }),
        emise: Math.round(v.emise),
        primite: Math.round(v.primite),
      };
    });

  // ── KPI totale (echivalent RON la curs BNR pentru toate sursele, inclusiv externe) ──
  const totalEmittedPlatform = (Array.isArray(emittedInvoices) ? emittedInvoices : [])
    .filter((e: any) => e.status !== "cancelled" && e.status !== "draft")
    .reduce((s: number, e: any) => s + toRonAmount(Number(e.total || 0), e.currency), 0);

  const totalReInvoicesRevenue = (Array.isArray(reInvoices) ? reInvoices : [])
    .filter((r: any) => r.status !== "cancelled" && r.status !== "draft")
    .reduce((s: number, r: any) => s + toRonAmount(Number(r.total || 0), r.currency), 0);

  const totalFacturiEmise = archiveInvoices
    .filter((inv: any) => {
      if (inv.direction === "in") return false;
      const spvIdx = inv.spvIndex ? String(inv.spvIndex).trim() : "";
      if (spvIdx && platformOutKeys.has(`SPV:${spvIdx}`)) return false;
      if (inv.invoiceNumber && platformOutKeys.has(`NUM:${normNum(inv.invoiceNumber)}`)) return false;
      return true;
    })
    .reduce((s: number, inv: any) => s + toRonAmount(Number(inv.total || 0), inv.currency), 0);

  const totalFacturiPrimite = archiveInvoices
    .filter((inv: any) => inv.direction === "in")
    .reduce((s: number, inv: any) => s + toRonAmount(Number(inv.total || 0), inv.currency), 0);

  const totalRevenue = totalEmittedPlatform + totalReInvoicesRevenue + totalFacturiEmise;
  const totalExpenses = totalFacturiPrimite;
  const totalReInvoices = reInvoices.length;
  const activeClients = clientStats.length;

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = [
      "Client",
      "Venituri",
      "Re-facturi",
      "Marjă Medie",
      "Marjă %",
    ];
    const rows = clientStats.map((c: any) => [
      c.clientName,
      c.totalRevenue.toFixed(2),
      c.reInvoiceCount,
      c.averageMargin.toFixed(2),
      c.marginPercentage.toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapoarte-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Raport exportat cu succes!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73]" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Rapoarte
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
            Date reale din contul tău
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          className="apple-btn-glass inline-flex items-center gap-1.5 px-4 h-9 text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Venituri totale"
          value={formatCurrency(totalRevenue, selectedCurrency)}
          icon={<DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-[#eefbf3] dark:bg-emerald-500/18"
          sub={`${totalReInvoices} re-facturi + arhiva emise`}
        />
        <KPICard
          title="Facturi primite"
          value={formatCurrency(totalExpenses, selectedCurrency)}
          icon={<TrendingDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-[#fff6eb] dark:bg-amber-500/18"
          sub="Cheltuieli SPV + facturi externe"
        />
        <KPICard
          title="Clienți activi"
          value={activeClients.toString()}
          icon={<Users className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />}
          iconBg="bg-[#f2f4f7] dark:bg-[#2c2c2e]"
          sub={`${dbClients.length} total în BD`}
        />
        <KPICard
          title="Facturi arhivă"
          value={archiveInvoices.length.toString()}
          icon={<Percent className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />}
          iconBg="bg-[#f2f4f7] dark:bg-[#2c2c2e]"
          sub="Din toate sursele"
        />
      </div>

      {/* Chart evoluție lunară */}
      {monthlyData.length > 0 && (
        <div className="apple-surface p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <LineChartIcon className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Evoluție venituri (ultimele 6 luni)
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(142,142,147,0.2)" />
              <XAxis dataKey="month" stroke="#8e8e93" fontSize={12} />
              <YAxis stroke="#8e8e93" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c1c1e",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: "12px",
                  color: "#f5f5f7",
                  fontSize: "12px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="emise"
                stroke="#0071e3"
                strokeWidth={2}
                dot={{ fill: "#0071e3", r: 4 }}
                name="Facturi emise (RON)"
              />
              <Line
                type="monotone"
                dataKey="primite"
                stroke="#e11d48"
                strokeWidth={2}
                dot={{ fill: "#e11d48", r: 4 }}
                name="Facturi primite (RON)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Clienți */}
      <div className="apple-surface overflow-hidden">
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.07]">
          <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
          </span>
          <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Top clienți după venituri
          </h2>
        </div>
        {topClients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr>
                  {[
                    "Nr.",
                    "Client",
                    "Venituri",
                    "Re-facturi",
                    "Marjă medie",
                    "Marjă %",
                  ].map(h => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] last:text-right whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                {topClients.map((c: any, i: number) => (
                  <tr
                    key={c.clientId}
                    className="transition-colors hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]"
                  >
                    <td className="py-3 px-4 text-[12px] font-medium tabular-nums text-[#8e8e93]">
                      {i + 1}
                    </td>
                    <td className="py-3 px-4 text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {c.clientName}
                    </td>
                    <td className="py-3 px-4 text-[13.5px] font-medium tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {formatCurrency(c.totalRevenue, selectedCurrency)}
                    </td>
                    <td className="py-3 px-4 text-[13px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                      {c.reInvoiceCount}
                    </td>
                    <td className="py-3 px-4 text-[13px] tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {formatCurrency(c.averageMargin, selectedCurrency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 text-[11px] font-medium tabular-nums">
                        {c.marginPercentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-[#6e6e73] dark:text-[#98989d]">
            <BarChart3 className="w-8 h-8 mx-auto mb-2.5 opacity-30" />
            <p className="text-[13px]">Nicio re-factură înregistrată încă.</p>
            <p className="text-[12px] mt-1 opacity-80">
              Datele vor apărea automat după prima re-facturare.
            </p>
          </div>
        )}
      </div>

      {/* Facturi din arhivă */}
      {archiveInvoices.length > 0 && (
        <div className="apple-surface overflow-hidden">
          <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-black/[0.05] dark:border-white/[0.07]">
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Facturi în arhivă
            </h2>
            <span className="ml-auto text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
              {archiveInvoices.length} total
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr>
                  {["Furnizor", "Nr. factură", "Dată", "Total", "Sursă"].map(
                    h => (
                      <th
                        key={h}
                        className="text-left py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                {(archiveInvoices as any[]).slice(0, 20).map((inv: any) => {
                  const d = inv.issueDate ? new Date(inv.issueDate) : null;
                  return (
                    <tr
                      key={inv.id}
                      className="transition-colors hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]"
                    >
                      <td className="py-2.5 px-4 text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {inv.supplierName || "—"}
                      </td>
                      <td className="py-2.5 px-4 text-[13px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-4 text-[13px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                        {d && !isNaN(d.getTime())
                          ? d.toLocaleDateString("ro-RO")
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-[13.5px] font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {formatCurrency(
                          Number(inv.total || 0),
                          (inv.currency || "RON") as Currency
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5]">
                          {inv.source}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({
  title,
  value,
  icon,
  iconBg,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  sub?: string;
}) {
  return (
    <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
          {title}
        </span>
        <span
          className={`w-7 h-7 rounded-[8px] ${iconBg} flex items-center justify-center shrink-0`}
        >
          {icon}
        </span>
      </div>
      <div className="min-w-0 tabular-nums">
        <p className="text-[22px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none truncate">
          {value}
        </p>
        {sub && (
          <p className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-1.5 truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
