import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Layers,
  Globe,
  LogOut,
  ChevronLeft,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  TrendingUp,
  Mail,
  Phone,
  Building2,
  Calendar,
  FileText,
  Activity,
  Clock,
  Search,
  Filter,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

type Tab = "overview" | "activity" | "registrations" | "users" | "pricing" | "seo";
const CURRENCIES = ["RON", "EUR", "USD"];

const NAV_ITEMS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Prezentare generală", icon: LayoutDashboard },
  { id: "activity", label: "Activitate & Logări", icon: Activity },
  { id: "users", label: "Utilizatori", icon: Users },
  { id: "registrations", label: "Înregistrări / Leaduri", icon: UserCheck },
  { id: "pricing", label: "Module & Prețuri", icon: Layers },
  { id: "seo", label: "SEO & Conținut", icon: Globe },
];

export default function SuperAdmin() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    if (user && user.role !== "superadmin" && user.role !== "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (user && user.role !== "superadmin" && user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <div className="text-slate-900 text-sm font-bold leading-tight">
                Refactura<span className="text-blue-600">.ro</span>
              </div>
              <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                Super Admin
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                activeTab === item.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <item.icon
                className={`w-4 h-4 flex-shrink-0 ${activeTab === item.id ? "text-blue-600" : "text-slate-400"}`}
              />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="px-2 py-3 border-t border-slate-100 space-y-0.5">
          <button
            onClick={() => setLocation("/")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
            <span>Înapoi la App</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Deconectare</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "activity" && <ActivityTab />}
          {activeTab === "users" && <UsersTab />}
          {activeTab === "registrations" && <RegistrationsTab />}
          {activeTab === "pricing" && <PricingTab />}
          {activeTab === "seo" && <SeoTab />}
        </div>
      </main>
    </div>
  );
}

// ─── Shared: Page Header ──────────────────────────────────────────────────────
function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── Shared: Status badge ─────────────────────────────────────────────────────
function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: "Nou", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    contacted: {
      label: "Contactat",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    converted: {
      label: "Convertit",
      cls: "bg-green-50 text-green-700 border-green-200",
    },
    lost: { label: "Pierdut", cls: "bg-red-50 text-red-600 border-red-200" },
  };
  const s = map[status] ?? {
    label: status,
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();
  const { data: leads = [] } = trpc.admin.leads.useQuery();
  const { data: traffic = [] } = trpc.admin.trafficStats.useQuery();
  const recentLeads = (leads as any[]).slice(0, 6);

  const kpis = [
    {
      label: "Total Leaduri",
      value: stats?.totalLeads,
      icon: UserCheck,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Leaduri Noi",
      value: stats?.newLeads,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Companii",
      value: stats?.totalTenants,
      icon: Building2,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Conturi Active",
      value: stats?.totalAccounts,
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Prezentare Generală"
        subtitle="Statistici în timp real"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div
            key={k.label}
            className="bg-white rounded-lg border border-slate-200 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500">{k.label}</span>
              <div
                className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center`}
              >
                <k.icon className={`w-3.5 h-3.5 ${k.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? "—" : String(k.value ?? "0")}
            </div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent leads */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">
              Ultimele Înregistrări
            </h3>
          </div>
          {recentLeads.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Nicio înregistrare încă.
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentLeads.map((lead: any) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 text-xs font-bold">
                      {(lead.name || lead.email)?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">
                      {lead.name || lead.email}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {lead.company || lead.email}
                    </p>
                  </div>
                  <LeadStatusBadge status={lead.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Traffic */}
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">
              Trafic Pagini
            </h3>
          </div>
          {(traffic as any[]).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              Nicio vizită înregistrată.
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {(traffic as any[]).slice(0, 8).map((t: any) => (
                <div
                  key={t.path}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <span className="text-xs text-slate-500 truncate flex-1">
                    {t.path}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    {t.visits}
                  </span>
                  <span className="text-xs text-slate-400">vizite</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Registrations ────────────────────────────────────────────────────────────
function RegistrationsTab() {
  const utils = trpc.useUtils();
  const { data: leads = [], isLoading } = trpc.admin.leads.useQuery();
  const updateStatus = trpc.admin.updateLeadStatus.useMutation({
    onSuccess: () => utils.admin.leads.invalidate(),
  });
  const deleteLead = trpc.admin.deleteLead.useMutation({
    onSuccess: () => utils.admin.leads.invalidate(),
  });

  const statusLabels: Record<string, string> = {
    new: "Nou",
    contacted: "Contactat",
    converted: "Convertit",
    lost: "Pierdut",
  };

  return (
    <div>
      <PageHeader
        title="Înregistrări & Leaduri"
        subtitle={`${(leads as any[]).length} solicitări trial de pe landing page`}
      />

      {isLoading ? (
        <div className="text-sm text-slate-400">Se încarcă...</div>
      ) : (leads as any[]).length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            Nicio înregistrare încă. Leadurile apar când vizitatorii completează
            formularul de trial.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Nume</span>
            <span>Email</span>
            <span>Companie</span>
            <span>Data</span>
            <span>Status</span>
            <span></span>
          </div>
          <div className="divide-y divide-slate-100">
            {(leads as any[]).map((lead: any) => (
              <div
                key={lead.id}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 text-[10px] font-bold">
                      {(lead.name || lead.email)?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-slate-800 truncate">
                    {lead.name || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-600 truncate">
                    {lead.email}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-600 truncate">
                    {lead.company || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span className="text-sm text-slate-500">
                    {lead.createdAt
                      ? new Date(lead.createdAt).toLocaleDateString("ro-RO")
                      : "—"}
                  </span>
                </div>
                <select
                  value={lead.status}
                  onChange={e =>
                    updateStatus.mutate({
                      id: lead.id,
                      status: e.target.value as any,
                    })
                  }
                  className="text-xs border border-slate-200 text-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  {Object.entries(statusLabels).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (confirm("Ștergi acest lead?"))
                      deleteLead.mutate({ id: lead.id });
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function UsersTab() {
  const { data: accounts = [], isLoading } = trpc.admin.accounts.useQuery();
  const { data: tenants = [] } = trpc.admin.tenants.useQuery();

  return (
    <div>
      <PageHeader
        title="Utilizatori"
        subtitle="Conturi și companii înregistrate"
      />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Accounts */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-800">
              Conturi ({(accounts as any[]).length})
            </h3>
          </div>
          {isLoading ? (
            <div className="px-4 py-6 text-sm text-slate-400">
              Se încarcă...
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(accounts as any[]).map((acc: any) => (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-xs font-bold">
                      {acc.email?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">
                      {acc.email}
                    </p>
                    <p className="text-xs text-slate-400">
                      {acc.createdAt
                        ? new Date(acc.createdAt).toLocaleDateString("ro-RO")
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        acc.role === "superadmin"
                          ? "bg-violet-50 text-violet-700 border-violet-200"
                          : acc.role === "admin"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {acc.role}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${acc.isActive ? "bg-green-500" : "bg-red-400"}`}
                    />
                  </div>
                </div>
              ))}
              {(accounts as any[]).length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-400">
                  Niciun cont.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tenants */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-slate-800">
              Companii ({(tenants as any[]).length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {(tenants as any[]).map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{t.name}</p>
                  <p className="text-xs text-slate-400 truncate">{t.email}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    t.subscriptionStatus === "active"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {t.subscriptionStatus || "—"}
                </span>
              </div>
            ))}
            {(tenants as any[]).length === 0 && (
              <div className="px-4 py-6 text-sm text-slate-400">
                Nicio companie.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Activity & Logins ──────────────────────────────────────────────────
function ActivityTab() {
  const { data, isLoading, refetch } = trpc.admin.userActivity.useQuery();
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"tenants" | "users">("tenants");

  const summary = data?.summary || {
    totalUsers: 0,
    activeToday: 0,
    activeThisWeek: 0,
    inactive: 0,
    neverLoggedIn: 0,
    totalTenants: 0,
  };

  const allUsers = data?.allUsers || [];
  const tenants = data?.tenants || [];

  const formatActivityTime = (dateStr: string | Date | null) => {
    if (!dateStr) return { relative: "Niciodată", exact: "Fără istoric", isNever: true };
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    let relative = "";
    if (diffMins < 1) relative = "Chiar acum";
    else if (diffMins < 60) relative = `Acum ${diffMins} min`;
    else if (diffHours < 24) relative = `Azi la ${date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`;
    else if (diffDays === 1) relative = `Ieri la ${date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`;
    else if (diffDays < 7) relative = `Acum ${diffDays} zile`;
    else relative = date.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });

    const exact = date.toLocaleString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return { relative, exact, isNever: false };
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "today":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Activ Azi
          </span>
        );
      case "week":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Activ în 7z
          </span>
        );
      case "month":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Activ în 30z
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Inactiv &gt; 30z
          </span>
        );
      case "never":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Niciodată logat
          </span>
        );
    }
  };

  // Filtering users
  const filteredUsers = allUsers.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      u.email.toLowerCase().includes(q) ||
      (u.primaryTenantName && u.primaryTenantName.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q));

    const matchesTenant =
      selectedTenantId === "all" ||
      u.tenantIds.includes(Number(selectedTenantId));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "today" && u.activityStatus === "today") ||
      (statusFilter === "week" && (u.activityStatus === "today" || u.activityStatus === "week")) ||
      (statusFilter === "inactive" && (u.activityStatus === "inactive" || u.activityStatus === "never")) ||
      (statusFilter === "never" && u.activityStatus === "never");

    return matchesSearch && matchesTenant && matchesStatus;
  });

  // Filtering tenants
  const filteredTenants = tenants
    .filter(t => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(q) ||
        (t.cui && t.cui.toLowerCase().includes(q)) ||
        t.users.some((u: any) => u.email.toLowerCase().includes(q));

      const matchesTenant =
        selectedTenantId === "all" || t.id === Number(selectedTenantId);

      return matchesSearch && matchesTenant;
    })
    .map(t => {
      const q = search.toLowerCase();
      const usersInTenant = t.users.filter((u: any) => {
        const matchesUserSearch =
          !search ||
          u.email.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q);

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "today" && u.activityStatus === "today") ||
          (statusFilter === "week" && (u.activityStatus === "today" || u.activityStatus === "week")) ||
          (statusFilter === "inactive" && (u.activityStatus === "inactive" || u.activityStatus === "never")) ||
          (statusFilter === "never" && u.activityStatus === "never");

        return matchesUserSearch && matchesStatus;
      });

      return {
        ...t,
        visibleUsers: usersInTenant,
      };
    })
    .filter(t => statusFilter === "all" || t.visibleUsers.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activitate & Logări Utilizatori"
        subtitle="Monitorizare activitate, ultimele logări și utilizatori arondați pe companii (tenanți)"
        action={
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Actualizează
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Utilizatori</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{summary.totalUsers}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">în toate firmele</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Activi Azi</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{summary.activeToday}</div>
          <p className="text-[10px] text-emerald-600/80 mt-0.5">logări în ultimele 24h</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-sm bg-gradient-to-br from-blue-50/40 to-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700">Activi în 7 zile</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-600">{summary.activeThisWeek}</div>
          <p className="text-[10px] text-blue-600/80 mt-0.5">utilizatori recenți</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Inactivi &gt; 30z</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-700">{summary.inactive + summary.neverLoggedIn}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">{summary.neverLoggedIn} nelogați vreodată</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Tenanți</span>
            <Building2 className="w-4 h-4 text-violet-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-violet-700">{summary.totalTenants}</div>
          <p className="text-[10px] text-slate-400 mt-0.5">companii înregistrate</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Căutare */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Caută utilizator sau companie..."
              className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Filtre */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedTenantId}
                onChange={e => setSelectedTenantId(e.target.value)}
                className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none"
              >
                <option value="all">Toți Tenanții ({tenants.length})</option>
                {tenants.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.usersCount} useri)
                  </option>
                ))}
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none"
            >
              <option value="all">Toate activitățile</option>
              <option value="today">🟢 Conectați Azi</option>
              <option value="week">🔵 Conectați în 7 zile</option>
              <option value="inactive">⚪ Inactivi / Fără logare</option>
              <option value="never">🔴 Niciodată logați</option>
            </select>

            {/* Toggle View */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("tenants")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === "tenants"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🏢 Pe Tenanți
              </button>
              <button
                type="button"
                onClick={() => setViewMode("users")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === "users"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                👥 Listă Utilizatori
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
          Se încarcă activitatea...
        </div>
      ) : viewMode === "tenants" ? (
        /* 🏢 Grupare pe Tenanți */
        <div className="space-y-4">
          {filteredTenants.map(t => {
            const lastActive = formatActivityTime(t.lastActiveAt);
            return (
              <div
                key={t.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Antet Tenant */}
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 text-violet-700 font-bold text-xs">
                      {t.name?.[0]?.toUpperCase() || "T"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{t.name}</h4>
                        {t.cui && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700">
                            CUI: {t.cui}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {t.visibleUsers.length} utilizator(i) asociați
                        {t.createdAt && ` • Înregistrat la ${new Date(t.createdAt).toLocaleDateString("ro-RO")}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Ultima activitate
                      </span>
                      <span className={`font-medium ${lastActive.isNever ? "text-slate-400" : "text-slate-700"}`}>
                        {lastActive.relative}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista utilizatorilor din tenant */}
                <div className="divide-y divide-slate-100">
                  {t.visibleUsers.map((u: any) => {
                    const activity = formatActivityTime(u.lastLoginAt);
                    return (
                      <div
                        key={u.id}
                        className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            {u.email?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800">{u.email}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  u.role === "superadmin"
                                    ? "bg-violet-100 text-violet-700"
                                    : u.role === "admin"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {u.role}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {u.phone ? `Tel: ${u.phone}` : "Fără număr de telefon"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {renderStatusBadge(u.activityStatus)}

                          <div className="text-right min-w-[130px]">
                            <div className="text-xs font-semibold text-slate-800">
                              {activity.relative}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {activity.exact}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {t.visibleUsers.length === 0 && (
                    <div className="px-4 py-5 text-center text-xs text-slate-400">
                      Niciun utilizator care să corespundă filtrului pentru această companie.
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredTenants.length === 0 && (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
              Nicio companie găsită conform criteriilor de filtrare.
            </div>
          )}
        </div>
      ) : (
        /* 👥 Listă Tabelară Utilizatori */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Utilizator</th>
                  <th className="px-4 py-3">Companie / Tenant</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Statut Activitate</th>
                  <th className="px-4 py-3">Ultima Logare</th>
                  <th className="px-4 py-3">Creat La</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(u => {
                  const activity = formatActivityTime(u.lastLoginAt);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs">
                            {u.email?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{u.email}</div>
                            {u.phone && (
                              <div className="text-[10px] text-slate-400">{u.phone}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-700">
                          {u.primaryTenantName}
                        </div>
                        {u.tenantNames.length > 1 && (
                          <div className="text-[10px] text-slate-400">
                            +{u.tenantNames.length - 1} alte companii
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase ${
                            u.role === "superadmin"
                              ? "bg-violet-100 text-violet-700"
                              : u.role === "admin"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">{renderStatusBadge(u.activityStatus)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{activity.relative}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {activity.exact}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString("ro-RO")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Niciun utilizator găsit conform criteriilor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pricing / Modules CMS ────────────────────────────────────────────────────
function PricingTab() {
  const utils = trpc.useUtils();
  const { data: modulesWithPricing = [], isLoading } =
    trpc.admin.modulesWithPricing.useQuery();
  const upsertModule = trpc.admin.upsertModule.useMutation({
    onSuccess: () => {
      utils.admin.modulesWithPricing.invalidate();
      setEditingModule(null);
      setShowNewModule(false);
    },
  });
  const deleteModule = trpc.admin.deleteModule.useMutation({
    onSuccess: () => utils.admin.modulesWithPricing.invalidate(),
  });
  const upsertPricing = trpc.admin.upsertModulePricing.useMutation({
    onSuccess: () => {
      utils.admin.modulesWithPricing.invalidate();
      setEditingPrice(null);
      setNewPriceFor(null);
    },
  });
  const deletePricing = trpc.admin.deleteModulePricing.useMutation({
    onSuccess: () => utils.admin.modulesWithPricing.invalidate(),
  });

  const [editingModule, setEditingModule] = useState<any>(null);
  const [showNewModule, setShowNewModule] = useState(false);
  const [editingPrice, setEditingPrice] = useState<any>(null);
  const [newPriceFor, setNewPriceFor] = useState<number | null>(null);
  const [modForm, setModForm] = useState({
    slug: "",
    name: "",
    description: "",
    icon: "Layers",
    color: "#3B82F6",
    isCombo: 0,
    sortOrder: 0,
  });
  const [priceForm, setPriceForm] = useState({
    currency: "RON",
    monthlyPrice: "",
    yearlyPrice: "",
    trialDays: 7,
  });

  const openEditModule = (mod: any) => {
    setEditingModule(mod);
    setShowNewModule(false);
    setModForm({
      slug: mod.slug,
      name: mod.name,
      description: mod.description || "",
      icon: mod.icon || "Layers",
      color: mod.color || "#3B82F6",
      isCombo: mod.isCombo || 0,
      sortOrder: mod.sortOrder || 0,
    });
  };
  const openNewModule = () => {
    setEditingModule(null);
    setShowNewModule(true);
    setModForm({
      slug: "",
      name: "",
      description: "",
      icon: "Layers",
      color: "#3B82F6",
      isCombo: 0,
      sortOrder: 0,
    });
  };
  const openNewPrice = (moduleId: number) => {
    setNewPriceFor(moduleId);
    setEditingPrice(null);
    setPriceForm({
      currency: "RON",
      monthlyPrice: "",
      yearlyPrice: "",
      trialDays: 7,
    });
  };
  const openEditPrice = (price: any) => {
    setEditingPrice(price);
    setNewPriceFor(null);
    setPriceForm({
      currency: price.currency,
      monthlyPrice: String(price.monthlyPrice),
      yearlyPrice: String(price.yearlyPrice || ""),
      trialDays: price.trialDays || 7,
    });
  };
  const saveModule = () =>
    upsertModule.mutate({
      ...modForm,
      ...(editingModule ? { id: editingModule.id } : {}),
    } as any);
  const savePrice = () => {
    if (editingPrice)
      upsertPricing.mutate({
        id: editingPrice.id,
        moduleId: editingPrice.moduleId,
        ...priceForm,
      });
    else if (newPriceFor)
      upsertPricing.mutate({ moduleId: newPriceFor, ...priceForm });
  };

  const inputCls =
    "w-full border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-slate-400";

  return (
    <div>
      <PageHeader
        title="Module & Prețuri"
        subtitle="Editează modulele și prețurile afișate pe landing page"
        action={
          <button
            onClick={openNewModule}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Modul Nou
          </button>
        }
      />

      {/* New/Edit Module Form */}
      {(showNewModule || editingModule) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            {editingModule ? "Editează Modul" : "Modul Nou"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={modForm.name}
              onChange={e => setModForm({ ...modForm, name: e.target.value })}
              placeholder="Nume modul *"
              className={inputCls}
            />
            <input
              value={modForm.slug}
              onChange={e => setModForm({ ...modForm, slug: e.target.value })}
              placeholder="Slug *"
              className={inputCls}
            />
            <textarea
              value={modForm.description}
              onChange={e =>
                setModForm({ ...modForm, description: e.target.value })
              }
              placeholder="Descriere"
              rows={2}
              className={`${inputCls} md:col-span-2 resize-none`}
            />
            <input
              value={modForm.icon}
              onChange={e => setModForm({ ...modForm, icon: e.target.value })}
              placeholder="Iconică Lucide"
              className={inputCls}
            />
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={modForm.color}
                onChange={e =>
                  setModForm({ ...modForm, color: e.target.value })
                }
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer flex-shrink-0"
              />
              <input
                value={modForm.color}
                onChange={e =>
                  setModForm({ ...modForm, color: e.target.value })
                }
                placeholder="#3B82F6"
                className={`${inputCls} flex-1`}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">Combo?</label>
              <button
                type="button"
                onClick={() =>
                  setModForm({ ...modForm, isCombo: modForm.isCombo ? 0 : 1 })
                }
                className={`w-10 h-6 rounded-full transition-colors ${modForm.isCombo ? "bg-blue-600" : "bg-slate-300"}`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${modForm.isCombo ? "translate-x-4" : ""}`}
                />
              </button>
            </div>
            <input
              type="number"
              value={modForm.sortOrder}
              onChange={e =>
                setModForm({ ...modForm, sortOrder: Number(e.target.value) })
              }
              placeholder="Ordine afișare"
              className={inputCls}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={saveModule}
              disabled={upsertModule.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Salvează
            </button>
            <button
              onClick={() => {
                setShowNewModule(false);
                setEditingModule(null);
              }}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-white transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Anulează
            </button>
          </div>
        </div>
      )}

      {/* Price Form */}
      {(editingPrice || newPriceFor) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            {editingPrice ? "Editează Preț" : "Preț Nou"}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Valută
              </label>
              <select
                value={priceForm.currency}
                onChange={e =>
                  setPriceForm({ ...priceForm, currency: e.target.value })
                }
                className={inputCls}
              >
                {CURRENCIES.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Preț/lună
              </label>
              <input
                type="number"
                step="0.01"
                value={priceForm.monthlyPrice}
                onChange={e =>
                  setPriceForm({ ...priceForm, monthlyPrice: e.target.value })
                }
                placeholder="149.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Preț/an (opțional)
              </label>
              <input
                type="number"
                step="0.01"
                value={priceForm.yearlyPrice}
                onChange={e =>
                  setPriceForm({ ...priceForm, yearlyPrice: e.target.value })
                }
                placeholder="1490.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Zile trial
              </label>
              <input
                type="number"
                value={priceForm.trialDays}
                onChange={e =>
                  setPriceForm({
                    ...priceForm,
                    trialDays: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={savePrice}
              disabled={upsertPricing.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Salvează Preț
            </button>
            <button
              onClick={() => {
                setEditingPrice(null);
                setNewPriceFor(null);
              }}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-white transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Anulează
            </button>
          </div>
        </div>
      )}

      {/* Modules list */}
      {isLoading ? (
        <div className="text-sm text-slate-400">Se încarcă...</div>
      ) : (
        <div className="space-y-3">
          {(modulesWithPricing as any[]).map(mod => (
            <div
              key={mod.id}
              className="bg-white rounded-lg border border-slate-200"
            >
              {/* Module header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: (mod.color || "#3B82F6") + "18" }}
                >
                  <Layers
                    className="w-4 h-4"
                    style={{ color: mod.color || "#3B82F6" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {mod.name}
                    </span>
                    {mod.isCombo ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                        Combo
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {mod.description}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openEditModule(mod)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Ștergi modulul "${mod.name}"?`))
                        deleteModule.mutate({ id: mod.id });
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Pricing rows */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Prețuri
                  </span>
                  <button
                    onClick={() => openNewPrice(mod.id)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Adaugă
                  </button>
                </div>
                {mod.pricing.length === 0 ? (
                  <p className="text-xs text-slate-400">Niciun preț setat.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {mod.pricing.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5"
                      >
                        <span className="text-xs font-semibold text-slate-600">
                          {p.currency}
                        </span>
                        <span className="text-sm text-slate-900">
                          {Number(p.monthlyPrice).toLocaleString("ro-RO", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-xs text-slate-400">/lună</span>
                        {p.yearlyPrice ? (
                          <span className="text-xs text-slate-400">
                            ·{" "}
                            {Number(p.yearlyPrice).toLocaleString("ro-RO", {
                              minimumFractionDigits: 2,
                            })}
                            /an
                          </span>
                        ) : null}
                        <span className="text-xs text-slate-400">
                          · {p.trialDays}z
                        </span>
                        <div className="flex gap-0.5 ml-1">
                          <button
                            onClick={() => openEditPrice(p)}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deletePricing.mutate({ id: p.id })}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {(modulesWithPricing as any[]).length === 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-10 text-center">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                Niciun modul. Apasă "Modul Nou" pentru a adăuga.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SEO & Content ────────────────────────────────────────────────────────────
function SeoTab() {
  const utils = trpc.useUtils();
  const { data: settings = [], isLoading } = trpc.admin.getCmsSettings.useQuery(
    { group: "seo" }
  );
  const upsert = trpc.admin.upsertCmsSetting.useMutation({
    onSuccess: () => utils.admin.getCmsSettings.invalidate(),
  });
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const fields = [
    {
      key: "seo_title",
      label: "Titlu SEO (meta title)",
      group: "seo",
      multiline: false,
    },
    {
      key: "seo_description",
      label: "Descriere SEO (meta description)",
      group: "seo",
      multiline: true,
    },
    {
      key: "seo_keywords",
      label: "Cuvinte cheie (keywords)",
      group: "seo",
      multiline: false,
    },
    {
      key: "hero_title",
      label: "Titlu Hero (landing page)",
      group: "seo",
      multiline: false,
    },
    {
      key: "hero_subtitle",
      label: "Subtitlu Hero",
      group: "seo",
      multiline: true,
    },
    {
      key: "hero_cta",
      label: "Text buton CTA",
      group: "seo",
      multiline: false,
    },
  ];

  const getValue = (key: string) =>
    (settings as any[]).find(s => s.key === key)?.value || "";

  const handleSave = async () => {
    for (const s of fields) {
      const val = form[s.key] ?? getValue(s.key);
      if (val)
        await upsert.mutateAsync({
          key: s.key,
          value: val,
          label: s.label,
          group: s.group,
        });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputCls =
    "w-full border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-slate-400";

  return (
    <div>
      <PageHeader
        title="SEO & Conținut"
        subtitle="Editează textele și meta-tagurile pentru landing page"
      />

      {isLoading ? (
        <div className="text-sm text-slate-400">Se încarcă...</div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="space-y-4">
            {fields.map(s => (
              <div key={s.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {s.label}
                </label>
                {s.multiline ? (
                  <textarea
                    defaultValue={getValue(s.key)}
                    onChange={e =>
                      setForm(f => ({ ...f, [s.key]: e.target.value }))
                    }
                    rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder={`Introdu ${s.label.toLowerCase()}...`}
                  />
                ) : (
                  <input
                    defaultValue={getValue(s.key)}
                    onChange={e =>
                      setForm(f => ({ ...f, [s.key]: e.target.value }))
                    }
                    className={inputCls}
                    placeholder={`Introdu ${s.label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Salvat!
                </>
              ) : (
                "Salvează Modificările"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
