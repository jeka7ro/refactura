// Dashboard — RefacturaRO
// Design: Slate Command Center — KPI cards + recent activity + charts

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  TrendingUp,
  FileText,
  FileOutput,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Download,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatCurrency,
  formatDate,
  invoiceStatusLabels,
  invoiceStatusColors,
  reInvoiceStatusLabels,
  reInvoiceStatusColors,
  sourceColors,
} from "@/lib/store";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { trpc } from "@/lib/trpc";

import { useAuth } from "@/_core/hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const { data: dbInvoices = [], isLoading: loadingInv } =
    trpc.invoices.list.useQuery(undefined, { enabled: !!user });
  const { data: dbEmitted = [], isLoading: loadingEmit } =
    trpc.invoices.listEmise.useQuery(undefined, { enabled: !!user });
  const { data: dbReInvoices = [], isLoading: loadingReInv } =
    trpc.reinvoice.list.useQuery(undefined, { enabled: !!user });
  const { data: dbClients = [], isLoading: loadingClients } =
    trpc.clients.list.useQuery(undefined, { enabled: !!user });

  const {
    totalImported,
    totalReInvoiced,
    margin,
    marginPct,
    overdueReInvoices,
    upcomingReInvoices,
    chartData,
    statusData,
  } = useMemo(() => {
    // Basic mapping
    const invoices = dbInvoices.map((i: any) => ({
      ...i,
      total: parseFloat(i.total || "0"),
    }));
    const reInvoices = dbReInvoices.map((r: any) => ({
      ...r,
      total: parseFloat(r.total || "0"),
    }));

    const reInvoicedSourceIds = new Set(reInvoices.map(r => r.sourceInvoiceId));
    const importedForReInvoiced = invoices
      .filter(i => reInvoicedSourceIds.has(i.id))
      .reduce((s, i) => s + i.total, 0);

    const tImported = invoices.reduce((s, i) => s + i.total, 0);
    const tReInvoiced = reInvoices.reduce((s, r) => s + r.total, 0);
    const mrg = tReInvoiced - importedForReInvoiced;
    const mrgPct =
      importedForReInvoiced > 0
        ? ((mrg / importedForReInvoiced) * 100).toFixed(1)
        : "0.0";

    const now = new Date();
    const overdue = reInvoices.filter(r => {
      if (!r.dueDate && !r.issueDate) return false;
      const dueDate = new Date(r.dueDate || r.issueDate);
      if (isNaN(dueDate.getTime())) return false;
      return dueDate < now && r.status !== "paid";
    });
    const upcoming = reInvoices.filter(r => {
      if (!r.dueDate && !r.issueDate) return false;
      const dueDate = new Date(r.dueDate || r.issueDate);
      if (isNaN(dueDate.getTime())) return false;
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilDue > 0 && daysUntilDue <= 7 && r.status !== "paid";
    });

    // Chart Data (Facturi primite vs Facturi emise)
    const months = [
      "Ian",
      "Feb",
      "Mar",
      "Apr",
      "Mai",
      "Iun",
      "Iul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentYear = now.getFullYear();
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      luna: months[i],
      facturi: 0,
      refacturi: 0,
    }));

    invoices.forEach(i => {
      if (!i.issueDate) return;
      const date = new Date(i.issueDate);
      if (date.getFullYear() === currentYear)
        monthlyData[date.getMonth()].facturi += i.total;
    });
    const emitted = dbEmitted.map((e: any) => ({
      ...e,
      total: parseFloat(e.total || "0"),
    }));
    emitted.forEach(e => {
      if (!e.issueDate) return;
      const date = new Date(e.issueDate);
      if (date.getFullYear() === currentYear)
        monthlyData[date.getMonth()].refacturi += e.total;
    });
    const currentMonth = now.getMonth();
    const dynamicChartData = monthlyData.slice(
      Math.max(0, currentMonth - 5),
      currentMonth + 1
    );

    // Status Data
    let countPaid = 0,
      countSent = 0,
      countDraft = 0,
      countOverdue = 0;
    emitted.forEach(e => {
      if (e.status === "paid" || e.status === "processed") countPaid++;
      else if (e.status === "sent" || e.status === "pending") countSent++;
      else if (e.status === "draft") countDraft++;

      // Check overdue
      if (e.status !== "paid" && e.status !== "processed" && e.dueDate) {
        if (new Date(e.dueDate) < now) countOverdue++;
      }
    });
    const totalStatus = countPaid + countSent + countDraft + countOverdue || 1;
    const statusData = [
      {
        label: "Achitate",
        count: countPaid,
        color: "bg-emerald-500",
        pct: (countPaid / totalStatus) * 100,
      },
      {
        label: "Trimise",
        count: countSent,
        color: "bg-blue-500",
        pct: (countSent / totalStatus) * 100,
      },
      {
        label: "Ciornă",
        count: countDraft,
        color: "bg-slate-400",
        pct: (countDraft / totalStatus) * 100,
      },
      {
        label: "Restante",
        count: countOverdue,
        color: "bg-rose-500",
        pct: (countOverdue / totalStatus) * 100,
      },
    ];

    return {
      totalImported: tImported,
      totalReInvoiced: tReInvoiced,
      margin: mrg,
      marginPct: mrgPct,
      overdueReInvoices: overdue,
      upcomingReInvoices: upcoming,
      chartData: dynamicChartData,
      statusData,
    };
  }, [dbInvoices, dbReInvoices, dbEmitted]);

  if (loadingInv || loadingReInv || loadingClients || loadingEmit) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-full space-y-6">
      {/* Alerts Section */}
      {(overdueReInvoices.length > 0 || upcomingReInvoices.length > 0) && (
        <div className="space-y-3">
          {overdueReInvoices.length > 0 && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-red-900 dark:text-red-200">
                  Re-facturi restante
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                  {overdueReInvoices.length} re-factur
                  {overdueReInvoices.length > 1 ? "e" : "ă"} depășit
                  {overdueReInvoices.length > 1 ? "e" : "ă"} scadență. Acțiune
                  imediată necesară.
                </p>
              </div>
            </div>
          )}
          {upcomingReInvoices.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                  Re-facturi cu scadență apropiată
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  {upcomingReInvoices.length} re-factur
                  {upcomingReInvoices.length > 1 ? "e" : "ă"} scad în
                  următoarele 7 zile.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {new Date()
              .toLocaleDateString("ro-RO", { month: "long", year: "numeric" })
              .replace(/^\w/, c => c.toUpperCase())}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Total Importat"
          value={formatCurrency(totalImported, "RON")}
          icon={<FileText className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-50 dark:bg-blue-900/30"
          sub={`${dbInvoices.length} facturi`}
        />
        <KPICard
          title="Total Re-Facturat"
          value={formatCurrency(totalReInvoiced, "RON")}
          icon={<FileOutput className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          sub={`${dbReInvoices.length} re-facturi`}
        />

        <KPICard
          title="Clienți Activi"
          value={dbClients.length.toString()}
          icon={<Users className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
          sub="4 țări"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area Chart */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Facturi primite vs. Facturi emise
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evoluție lunară (RON)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-red-500 inline-block" />
                Primite
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Emise
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorFacturi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRefacturi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.15)"
              />
              <XAxis
                dataKey="luna"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  fontSize: 12,
                }}
                formatter={(value: number) => [
                  `${value.toLocaleString("ro-RO")} RON`,
                ]}
              />
              <Area
                type="monotone"
                dataKey="facturi"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#colorFacturi)"
              />
              <Area
                type="monotone"
                dataKey="refacturi"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#colorRefacturi)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Status Facturi Emise
          </h2>
          <p className="text-xs text-slate-500 mb-6">Distribuție după stare</p>
          <div className="space-y-3">
            {statusData.map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {item.label}
                  </span>
                  <span className="text-slate-900 dark:text-white">
                    {item.count}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent received */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Facturi Primite Recente
            </h2>
            <Link href="/facturi-primite">
              <span className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">
                Vezi toate →
              </span>
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dbInvoices.slice(0, 4).map((inv: any) => (
              <Link key={inv.id} href={`/facturi-primite/${inv.id}`}>
                <div className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                        {inv.supplierName}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {inv.invoiceNumber} · {formatDate(inv.issueDate)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${(invoiceStatusColors as any)[inv.status || "pending"]}`}
                      >
                        {(invoiceStatusLabels as any)[inv.status || "pending"]}
                      </span>
                      <span className="text-sm text-slate-900 dark:text-white">
                        {formatCurrency(parseFloat(inv.total), inv.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent emitted */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Facturi Emise Recente
            </h2>
            <Link href="/facturi-emise">
              <span className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">
                Vezi toate →
              </span>
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dbEmitted.slice(0, 4).map((inv: any) => (
              <div
                key={inv.id}
                className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                      {inv.supplierName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {inv.invoiceNumber} · {formatDate(inv.issueDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${(invoiceStatusColors as any)[inv.status || "pending"]}`}
                    >
                      {(invoiceStatusLabels as any)[inv.status || "pending"]}
                    </span>
                    <span className="text-sm text-slate-900 dark:text-white">
                      {formatCurrency(parseFloat(inv.total), inv.currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent re-invoices */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Re-Facturi Emise Recente
            </h2>
            <Link href="/re-facturi">
              <span className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">
                Vezi toate →
              </span>
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dbReInvoices.slice(0, 4).map((ri: any) => (
              <div
                key={ri.id}
                className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900 dark:text-white truncate">
                      {ri.clientName || "Client"}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {ri.number} · {formatDate(ri.issueDate || ri.date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${(reInvoiceStatusColors as any)[ri.status || "draft"]}`}
                    >
                      {(reInvoiceStatusLabels as any)[ri.status || "draft"]}
                    </span>
                    <span className="text-sm text-slate-900 dark:text-white">
                      {formatCurrency(
                        parseFloat(ri.total),
                        ri.currency || "RON"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  change,
  positive,
  icon,
  iconBg,
  sub,
}: {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  sub: string;
}) {
  return (
    <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-lg border border-white/20 dark:border-white/10 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}
        >
          {icon}
        </div>
        {change && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}
          >
            {positive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {change}
          </div>
        )}
      </div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
        {title}
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </div>
  );
}
