// Reports — date reale din DB via tRPC (zero mock-uri)
import { useState } from "react";
import {
  TrendingUp, Users, DollarSign, Percent, Download,
  Calendar, BarChart3, LineChart as LineChartIcon, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, type Currency } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export default function Reports() {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("RON");

  // Date reale
  const { data: reInvoices = [], isLoading: loadingRI } = trpc.reinvoice.list.useQuery();
  const { data: dbClients = [], isLoading: loadingCl } = trpc.clients.list.useQuery();
  const { data: archiveInvoices = [], isLoading: loadingAI } = trpc.invoiceArchive.list.useQuery();

  const loading = loadingRI || loadingCl || loadingAI;

  // ── Statistici per client ──────────────────────────────────────────────────
  const clientStats = dbClients.map((client: any) => {
    const clientRI = reInvoices.filter((r: any) => r.clientId === client.id || r.clientName === client.name);
    const totalRevenue = clientRI.reduce((s: number, r: any) => s + Number(r.total || 0), 0);
    const totalMargin = totalRevenue * 0.15; // marjă estimată
    return {
      clientId: client.id,
      clientName: client.name,
      totalRevenue,
      reInvoiceCount: clientRI.length,
      averageMargin: clientRI.length > 0 ? totalMargin / clientRI.length : 0,
      marginPercentage: totalRevenue > 0 ? 15 : 0,
    };
  }).filter((c: any) => c.reInvoiceCount > 0)
    .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

  const topClients = clientStats.slice(0, 5);

  // ── Trend lunar din invoiceArchive ────────────────────────────────────────
  const monthlyMap: Record<string, { revenue: number; count: number }> = {};
  archiveInvoices.forEach((inv: any) => {
    if (!inv.issueDate) return;
    const d = new Date(inv.issueDate);
    if (isNaN(d.getTime())) return;
    const key = d.toLocaleString("ro-RO", { month: "short", year: "2-digit" });
    if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, count: 0 };
    monthlyMap[key].revenue += Number(inv.total || 0);
    monthlyMap[key].count++;
  });

  const monthlyData = Object.entries(monthlyMap)
    .slice(-6)
    .map(([month, v]) => ({
      month,
      revenue: Math.round(v.revenue),
      margin: Math.round(v.revenue * 0.15),
      count: v.count,
    }));

  // ── KPI totale ────────────────────────────────────────────────────────────
  const totalRevenue = clientStats.reduce((s: number, c: any) => s + c.totalRevenue, 0);
  const totalMargin = totalRevenue * 0.15;
  const totalReInvoices = reInvoices.length;
  const avgMarginPct = 15;
  const activeClients = clientStats.length;

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ["Client", "Venituri", "Re-facturi", "Marjă Medie", "Marjă %"];
    const rows = clientStats.map((c: any) => [
      c.clientName, c.totalRevenue.toFixed(2), c.reInvoiceCount,
      c.averageMargin.toFixed(2), c.marginPercentage.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Rapoarte</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Date reale din contul tău</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-5 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Venituri Totale"
          value={formatCurrency(totalRevenue, selectedCurrency)}
          icon={<DollarSign className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-50"
          sub={`${totalReInvoices} re-facturi`}
        />
        <KPICard
          title="Marjă Totală"
          value={formatCurrency(totalMargin, selectedCurrency)}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          sub={`${avgMarginPct}% estimat`}
        />
        <KPICard
          title="Clienți Activi"
          value={activeClients.toString()}
          icon={<Users className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-50"
          sub={`${dbClients.length} total în BD`}
        />
        <KPICard
          title="Facturi Arhivă"
          value={archiveInvoices.length.toString()}
          icon={<Percent className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-50"
          sub="Din toate sursele"
        />
      </div>

      {/* Chart evoluție lunară */}
      {monthlyData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-6">
            <LineChartIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Evoluție Venituri (ultimele 6 luni)</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px", color: "#f1f5f9" }} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={{ fill: "#2563eb", r: 4 }} name="Venituri (RON)" />
              <Line type="monotone" dataKey="margin" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 4 }} name="Marjă (RON)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Clienți */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Top Clienți după venituri</h2>
        </div>
        {topClients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {["#", "Client", "Venituri", "Re-facturi", "Marjă Medie", "Marjă %"].map(h => (
                    <th key={h} className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400 last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topClients.map((c: any, i: number) => (
                  <tr key={c.clientId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4 text-slate-500">{i + 1}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{c.clientName}</td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white">{formatCurrency(c.totalRevenue, selectedCurrency)}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{c.reInvoiceCount}</td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white">{formatCurrency(c.averageMargin, selectedCurrency)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">{c.marginPercentage.toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nicio re-factură înregistrată încă.</p>
            <p className="text-xs mt-1">Datele vor apărea automat după prima re-facturare.</p>
          </div>
        )}
      </div>

      {/* Facturi din arhivă */}
      {archiveInvoices.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Facturi în arhivă</h2>
            <span className="ml-auto text-xs text-slate-500">{archiveInvoices.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {["Furnizor", "Nr. Factură", "Dată", "Total", "Sursă"].map(h => (
                    <th key={h} className="text-left py-2 px-4 font-semibold text-slate-600 dark:text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(archiveInvoices as any[]).slice(0, 20).map((inv: any) => {
                  const d = inv.issueDate ? new Date(inv.issueDate) : null;
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-4 font-medium text-slate-900 dark:text-white">{inv.supplierName || "—"}</td>
                      <td className="py-2 px-4 text-slate-600">{inv.invoiceNumber}</td>
                      <td className="py-2 px-4 text-slate-500">{d && !isNaN(d.getTime()) ? d.toLocaleDateString("ro-RO") : "—"}</td>
                      <td className="py-2 px-4 text-slate-900 dark:text-white">{formatCurrency(Number(inv.total || 0), (inv.currency || "RON") as Currency)}</td>
                      <td className="py-2 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">{inv.source}</span>
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

function KPICard({ title, value, icon, iconBg, sub }: { title: string; value: string; icon: React.ReactNode; iconBg: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      </div>
    </div>
  );
}
