// Reports — Statistici detaliate și analiză business
// Revenue per client, average margin, top clients, trends

import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  TrendingUp,
  Users,
  DollarSign,
  Percent,
  Download,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  LineChart as LineChartIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  mockReInvoices,
  mockClients,
  formatCurrency,
  formatDate,
  type Currency,
} from "@/lib/store";
import {
  BarChart,
  Bar,
  PieChart as PieChartComponent,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ClientStats {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  reInvoiceCount: number;
  averageMargin: number;
  marginPercentage: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  margin: number;
  count: number;
}

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState<"all" | "3m" | "6m" | "12m">("all");
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("RON");

  // Calculate client statistics
  const clientStats: ClientStats[] = mockClients.map((client) => {
    const clientReInvoices = mockReInvoices.filter((r) => r.clientId === client.id);
    const totalRevenue = clientReInvoices.reduce((sum, r) => sum + r.total, 0);
    const totalMargin = clientReInvoices.reduce((sum, r) => {
      // Estimate margin as 15% of revenue (based on mock data)
      return sum + r.total * 0.15;
    }, 0);

    return {
      clientId: client.id,
      clientName: client.name,
      totalRevenue,
      reInvoiceCount: clientReInvoices.length,
      averageMargin: clientReInvoices.length > 0 ? totalMargin / clientReInvoices.length : 0,
      marginPercentage: totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0,
    };
  });

  // Top clients by revenue
  const topClients = clientStats
    .filter((c) => c.reInvoiceCount > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Monthly trends
  const monthlyData: MonthlyTrend[] = [
    { month: "Iun", revenue: 4200, margin: 630, count: 3 },
    { month: "Iul", revenue: 7800, margin: 1170, count: 5 },
    { month: "Aug", revenue: 5600, margin: 840, count: 4 },
    { month: "Sep", revenue: 9100, margin: 1365, count: 6 },
    { month: "Oct", revenue: 12400, margin: 1860, count: 8 },
    { month: "Nov", revenue: 18750, margin: 2812, count: 12 },
  ];

  // Overall statistics
  const totalRevenue = clientStats.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalMargin = clientStats.reduce((sum, c) => sum + c.averageMargin * c.reInvoiceCount, 0);
  const totalReInvoices = mockReInvoices.length;
  const averageMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const averageRevenuePerClient = clientStats.filter((c) => c.reInvoiceCount > 0).length > 0
    ? totalRevenue / clientStats.filter((c) => c.reInvoiceCount > 0).length
    : 0;

  // Revenue distribution (top 5 vs others)
  const revenueDistribution = [
    {
      name: "Top 5 Clienți",
      value: topClients.reduce((sum, c) => sum + c.totalRevenue, 0),
      percentage: ((topClients.reduce((sum, c) => sum + c.totalRevenue, 0) / totalRevenue) * 100).toFixed(1),
    },
    {
      name: "Alți Clienți",
      value: totalRevenue - topClients.reduce((sum, c) => sum + c.totalRevenue, 0),
      percentage: (((totalRevenue - topClients.reduce((sum, c) => sum + c.totalRevenue, 0)) / totalRevenue) * 100).toFixed(1),
    },
  ];

  const COLORS = ["#2563eb", "#10b981"];

  const handleExportCSV = () => {
    const headers = ["Client", "Venituri", "Re-facturi", "Marjă Medie", "Marjă %"];
    const rows = clientStats
      .filter((c) => c.reInvoiceCount > 0)
      .map((c) => [
        c.clientName,
        c.totalRevenue.toFixed(2),
        c.reInvoiceCount,
        c.averageMargin.toFixed(2),
        c.marginPercentage.toFixed(2),
      ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapoarte-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Raport exportat cu succes!");
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Rapoarte</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Statistici detaliate și analiză business</p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-5 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toate perioadele</option>
            <option value="3m">Ultimele 3 luni</option>
            <option value="6m">Ultimele 6 luni</option>
            <option value="12m">Ultimele 12 luni</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
        <KPICard
          title="Venituri Totale"
          value={formatCurrency(totalRevenue, selectedCurrency)}
          icon={<DollarSign className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-50 dark:bg-blue-900/30"
          sub={`${totalReInvoices} re-facturi`}
        />
        <KPICard
          title="Marjă Totală"
          value={formatCurrency(totalMargin, selectedCurrency)}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          sub={`${averageMarginPct.toFixed(1)}% din venituri`}
        />
        <KPICard
          title="Clienți Activi"
          value={clientStats.filter((c) => c.reInvoiceCount > 0).length.toString()}
          icon={<Users className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-900/30"
          sub={`${formatCurrency(averageRevenuePerClient, selectedCurrency)} mediu`}
        />
        <KPICard
          title="Marjă Medie"
          value={`${averageMarginPct.toFixed(1)}%`}
          icon={<Percent className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
          sub="Pe re-factură"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        {/* Revenue Trend */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-6">
            <LineChartIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Evoluție Venituri</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: "#2563eb", r: 4 }}
                name="Venituri (RON)"
              />
              <Line
                type="monotone"
                dataKey="margin"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 4 }}
                name="Marjă (RON)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Distribution */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Distribuție Venituri</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChartComponent>
              <Pie
                data={revenueDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
              />
            </PieChartComponent>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Clients Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Top 5 Clienți</h2>
        </div>

        {topClients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">#</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Client</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Venituri</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Re-facturi</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Marjă Medie</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Marjă %</th>
                </tr>
              </thead>
              <tbody>
                {topClients.map((client, index) => (
                  <tr key={client.clientId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{index + 1}</td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white">{client.clientName}</td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-white">
                      {formatCurrency(client.totalRevenue, selectedCurrency)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{client.reInvoiceCount}</td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-white">
                      {formatCurrency(client.averageMargin, selectedCurrency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-normal">
                        {client.marginPercentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p>Nu sunt date disponibile pentru perioada selectată.</p>
          </div>
        )}
      </div>

      {/* All Clients Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Toți Clienții</h2>
        </div>

        {clientStats.filter((c) => c.reInvoiceCount > 0).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Client</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Venituri</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Re-facturi</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Marjă Medie</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Marjă %</th>
                </tr>
              </thead>
              <tbody>
                {clientStats
                  .filter((c) => c.reInvoiceCount > 0)
                  .sort((a, b) => b.totalRevenue - a.totalRevenue)
                  .map((client) => (
                    <tr key={client.clientId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-900 dark:text-white">{client.clientName}</td>
                      <td className="py-3 px-4 text-right text-slate-900 dark:text-white">
                        {formatCurrency(client.totalRevenue, selectedCurrency)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{client.reInvoiceCount}</td>
                      <td className="py-3 px-4 text-right text-slate-900 dark:text-white">
                        {formatCurrency(client.averageMargin, selectedCurrency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-normal">
                          {client.marginPercentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p>Nu sunt clienți cu re-facturi în perioada selectată.</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  sub?: string;
}

function KPICard({ title, value, icon, iconBg, sub }: KPICardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
          {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      </div>
    </div>
  );
}
