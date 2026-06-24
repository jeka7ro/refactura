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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { trpc } from "@/lib/trpc";

const chartData = [
  { luna: "Iun", facturi: 4200, refacturi: 5100 },
  { luna: "Iul", facturi: 7800, refacturi: 9200 },
  { luna: "Aug", facturi: 5600, refacturi: 6800 },
  { luna: "Sep", facturi: 9100, refacturi: 11200 },
  { luna: "Oct", facturi: 12400, refacturi: 15600 },
  { luna: "Nov", facturi: 18750, refacturi: 22890 },
];

export default function Dashboard() {
  const [syncing, setSyncing] = useState(false);

  const { data: dbInvoices = [], isLoading: loadingInv } = trpc.invoices.list.useQuery();
  const { data: dbEmitted = [], isLoading: loadingEmit } = trpc.invoices.listEmise.useQuery();
  const { data: dbReInvoices = [], isLoading: loadingReInv } = trpc.reinvoice.list.useQuery();
  const { data: dbClients = [], isLoading: loadingClients } = trpc.clients.list.useQuery();

  const {
    totalImported,
    totalReInvoiced,
    margin,
    marginPct,
    overdueReInvoices,
    upcomingReInvoices
  } = useMemo(() => {
    // Basic mapping
    const invoices = dbInvoices.map((i: any) => ({ ...i, total: parseFloat(i.total || '0') }));
    const reInvoices = dbReInvoices.map((r: any) => ({ ...r, total: parseFloat(r.total || '0') }));

    const reInvoicedSourceIds = new Set(reInvoices.map(r => r.sourceInvoiceId));
    const importedForReInvoiced = invoices
      .filter(i => reInvoicedSourceIds.has(i.id))
      .reduce((s, i) => s + i.total, 0);
    
    const tImported = invoices.reduce((s, i) => s + i.total, 0);
    const tReInvoiced = reInvoices.reduce((s, r) => s + r.total, 0);
    const mrg = tReInvoiced - importedForReInvoiced;
    const mrgPct = importedForReInvoiced > 0 ? ((mrg / importedForReInvoiced) * 100).toFixed(1) : "0.0";

    const now = new Date();
    const overdue = reInvoices.filter(r => {
      if (!r.dueDate && !r.issueDate) return false;
      const dueDate = new Date(r.dueDate || r.issueDate);
      if (isNaN(dueDate.getTime())) return false;
      return dueDate < now && r.status !== 'paid';
    });
    const upcoming = reInvoices.filter(r => {
      if (!r.dueDate && !r.issueDate) return false;
      const dueDate = new Date(r.dueDate || r.issueDate);
      if (isNaN(dueDate.getTime())) return false;
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue > 0 && daysUntilDue <= 7 && r.status !== 'paid';
    });

    return { totalImported: tImported, totalReInvoiced: tReInvoiced, margin: mrg, marginPct: mrgPct, overdueReInvoices: overdue, upcomingReInvoices: upcoming };
  }, [dbInvoices, dbReInvoices]);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success("Sincronizare completă", { description: "Sincronizare manuală încheiată." });
    }, 2000);
  };

  if (loadingInv || loadingReInv || loadingClients || loadingEmit) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Alerts Section */}
      {(overdueReInvoices.length > 0 || upcomingReInvoices.length > 0) && (
        <div className="space-y-3">
          {overdueReInvoices.length > 0 && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-red-900 dark:text-red-200">Re-facturi restante</h3>
                <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                  {overdueReInvoices.length} re-factur{overdueReInvoices.length > 1 ? 'e' : 'ă'} depășit{overdueReInvoices.length > 1 ? 'e' : 'ă'} scadență. Acțiune imediată necesară.
                </p>
              </div>
            </div>
          )}
          {upcomingReInvoices.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">Re-facturi cu scadență apropiată</h3>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  {upcomingReInvoices.length} re-factur{upcomingReInvoices.length > 1 ? 'e' : 'ă'} scad în următoarele 7 zile.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Noiembrie 2024 — Rezumat activitate</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-5 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizează
          </button>
          <Link href="/facturi-primite">
            <button className="flex items-center gap-2 px-5 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-[0.97]">
              <Plus className="w-4 h-4" />
              Factură nouă
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total Importat"
          value={formatCurrency(totalImported, "RON")}
          change="+18.4%"
          positive={true}
          icon={<FileText className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-50 dark:bg-blue-900/30"
          sub={`${dbInvoices.length} facturi`}
        />
        <KPICard
          title="Total Re-Facturat"
          value={formatCurrency(totalReInvoiced, "RON")}
          change="+22.1%"
          positive={true}
          icon={<FileOutput className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          sub={`${dbReInvoices.length} re-facturi`}
        />
        <KPICard
          title="Adaos Comercial"
          value={formatCurrency(margin, "RON")}
          change={`+${marginPct}%`}
          positive={true}
          icon={<TrendingUp className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-900/30"
          sub={`Marjă medie ${marginPct}%`}
        />
        <KPICard
          title="Clienți Activi"
          value={dbClients.length.toString()}
          change="+1 luna aceasta"
          positive={true}
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
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Evoluție Facturare</h2>
              <p className="text-xs text-slate-500 mt-0.5">Facturi primite vs. re-facturi emise (RON)</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-blue-500 inline-block" />Importate</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" />Re-facturate</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorFacturi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRefacturi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="luna" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 12 }}
                formatter={(value: number) => [`${value.toLocaleString("ro-RO")} RON`]}
              />
              <Area type="monotone" dataKey="facturi" stroke="#3B82F6" strokeWidth={2} fill="url(#colorFacturi)" />
              <Area type="monotone" dataKey="refacturi" stroke="#10B981" strokeWidth={2} fill="url(#colorRefacturi)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Status Re-Facturi</h2>
          <p className="text-xs text-slate-500 mb-6">Distribuție după stare</p>
          <div className="space-y-3">
            {[
              { label: "Achitate", count: 1, color: "bg-emerald-500", pct: 33 },
              { label: "Trimise", count: 1, color: "bg-blue-500", pct: 33 },
              { label: "Ciornă", count: 1, color: "bg-slate-400", pct: 33 },
              { label: "Restante", count: 0, color: "bg-rose-500", pct: 0 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{item.label}</span>
                  <span className="text-slate-900 dark:text-white">{item.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider">Surse Conectate</div>
            <div className="space-y-2">
              {[
                { name: "SmartBill", status: "Activ", color: "text-emerald-600" },
                { name: "SPV ANAF", status: "Activ", color: "text-emerald-600" },
                { name: "Oblio", status: "Inactiv", color: "text-slate-400" },
              ].map((src) => (
                <div key={src.name} className="flex justify-between items-center text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{src.name}</span>
                  <span className={src.color}>{src.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent received */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Facturi Primite Recente</h2>
            <Link href="/facturi-primite">
              <span className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">Vezi toate →</span>
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dbInvoices.slice(0, 4).map((inv: any) => (
              <Link key={inv.id} href={`/facturi-primite/${inv.id}`}>
                <div className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">{inv.supplierName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{inv.invoiceNumber} · {formatDate(inv.issueDate)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${invoiceStatusColors[(inv.status as any) || 'pending']}`}>
                        {invoiceStatusLabels[(inv.status as any) || 'pending']}
                      </span>
                      <span className="text-sm text-slate-900 dark:text-white">{formatCurrency(parseFloat(inv.total), inv.currency)}</span>
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
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Facturi Emise Recente</h2>
            <Link href="/facturi-emise">
              <span className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">Vezi toate →</span>
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dbEmitted.slice(0, 4).map((inv: any) => (
              <div key={inv.id} className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">{inv.supplierName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{inv.invoiceNumber} · {formatDate(inv.issueDate)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${invoiceStatusColors[(inv.status as any) || 'pending']}`}>
                      {invoiceStatusLabels[(inv.status as any) || 'pending']}
                    </span>
                    <span className="text-sm text-slate-900 dark:text-white">{formatCurrency(parseFloat(inv.total), inv.currency)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent re-invoices */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Re-Facturi Emise Recente</h2>
            <Link href="/re-facturi">
              <span className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">Vezi toate →</span>
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dbReInvoices.slice(0, 4).map((ri: any) => (
              <div key={ri.id} className="px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900 dark:text-white truncate">{ri.clientName || 'Client'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{ri.number} · {formatDate(ri.issueDate || ri.date)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${reInvoiceStatusColors[(ri.status as any) || 'draft']}`}>
                      {reInvoiceStatusLabels[(ri.status as any) || 'draft']}
                    </span>
                    <span className="text-sm text-slate-900 dark:text-white">{formatCurrency(parseFloat(ri.total), ri.currency || "RON")}</span>
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

function KPICard({ title, value, change, positive, icon, iconBg, sub }: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ReactNode;
  iconBg: string;
  sub: string;
}) {
  return (
    <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-lg border border-white/20 dark:border-white/10 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
          {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {change}
        </div>
      </div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{title}</div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{sub}</div>
    </div>
  );
}
