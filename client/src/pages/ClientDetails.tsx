import React, { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Building2,
  MapPin,
  Mail,
  Phone,
  Plus,
  ExternalLink,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Download,
  Edit3,
  X,
  Check,
  Search,
  Package,
  CreditCard,
  Hash,
  ShieldCheck,
  Briefcase,
  Users,
  RefreshCw,
  Layers,
  FileSpreadsheet,
  BookOpen,
  Info,
  Sparkles,
  Percent,
  Award,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type PeriodFilter =
  | "all"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "last_30_days"
  | "custom";

const STATUS_COLORS: Record<string, string> = {
  paid: "#10b981", // Emerald green
  sent: "#3b82f6", // Blue
  draft: "#94a3b8", // Slate
  overdue: "#f59e0b", // Amber
  storno: "#ef4444", // Red
  cancelled: "#64748b",
};

export default function ClientDetails() {
  const params = useParams();
  const id = Number(params.id);
  const utils = trpc.useUtils();

  // Period Filter State (aligned with Evidență Facturi)
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Search & Pagination & Tabs
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"sent" | "received" | "products" | "firme_api">("sent");
  const [expandedMofIndex, setExpandedMofIndex] = useState<number | null>(null);

  // Edit Client Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    cui: "",
    regCom: "",
    address: "",
    city: "",
    country: "RO",
    email: "",
    phone: "",
    sagaCode: "",
  });

  // Query Client Details
  const { data, isLoading, error } = trpc.clients.getDetails.useQuery(
    { id },
    { enabled: !isNaN(id) && id > 0 }
  );

  const rawCui = data?.client?.cui || "";
  const cleanCui = useMemo(() => (rawCui ? rawCui.replace(/\D/g, "") : ""), [rawCui]);

  // FirmeAPI Data Query
  const [forceRefreshing, setForceRefreshing] = useState(false);
  const firmeApiQuery = trpc.clients.getFirmeApiData.useQuery(
    { cui: cleanCui, forceRefresh: forceRefreshing },
    {
      enabled: Boolean(cleanCui && cleanCui.length >= 2),
      staleTime: 1000 * 60 * 30, // 30 mins
    }
  );

  // FirmeAPI Sync Mutation
  const syncMutation = trpc.clients.syncFromFirmeApi.useMutation({
    onSuccess: (res) => {
      utils.clients.getDetails.invalidate({ id });
      utils.clients.list.invalidate();
      if (res.updatedFields && res.updatedFields.length > 0) {
        toast.success(`Profil sincronizat cu succes! Câmpuri actualizate: ${res.updatedFields.join(", ")}`);
      } else {
        toast.info("Profilul clientului este deja la zi cu datele din FirmeAPI.");
      }
    },
    onError: (err) => {
      toast.error(`Eroare la sincronizare: ${err.message}`);
    },
  });

  const handleRefreshFirmeApi = async () => {
    setForceRefreshing(true);
    try {
      await firmeApiQuery.refetch();
      toast.success("Dosarul FirmeAPI a fost actualizat cu succes!");
    } catch (e: any) {
      toast.error(`Eroare la actualizare FirmeAPI: ${e.message}`);
    } finally {
      setForceRefreshing(false);
    }
  };

  const updateClientMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.getDetails.invalidate({ id });
      utils.clients.list.invalidate();
      setIsEditModalOpen(false);
      toast.success("Profil client actualizat cu succes!");
    },
    onError: (err) => {
      toast.error(`Eroare: ${err.message}`);
    },
  });

  // Helper date range calculator
  const dateRange = useMemo<[string, string] | null>(() => {
    const now = new Date();
    const fmt = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${yr}-${mo}-${da}`;
    };

    switch (period) {
      case "this_month": {
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return [fmt(s), fmt(e)];
      }
      case "last_month": {
        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const e = new Date(now.getFullYear(), now.getMonth(), 0);
        return [fmt(s), fmt(e)];
      }
      case "this_year":
        return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
      case "last_year":
        return [`${now.getFullYear() - 1}-01-01`, `${now.getFullYear() - 1}-12-31`];
      case "last_30_days": {
        const past = new Date(now);
        past.setDate(past.getDate() - 30);
        return [fmt(past), fmt(now)];
      }
      case "custom":
        return customFrom && customTo ? [customFrom, customTo] : null;
      case "all":
      default:
        return null;
    }
  }, [period, customFrom, customTo]);

  // Open Edit Modal with current values
  const handleOpenEdit = () => {
    if (!data?.client) return;
    setEditFormData({
      name: data.client.name || "",
      cui: data.client.cui || "",
      regCom: data.client.regCom || "",
      address: data.client.address || "",
      city: data.client.city || "",
      country: data.client.country || "RO",
      email: data.client.email || "",
      phone: data.client.phone || "",
      sagaCode: (data.client as any).sagaCode || "",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    updateClientMutation.mutate({
      id,
      ...editFormData,
    });
  };

  // Filtered Sent Invoices
  const filteredSentInvoices = useMemo(() => {
    if (!data?.sentInvoices) return [];
    return data.sentInvoices.filter((inv) => {
      // Date filter
      if (dateRange && inv.issueDate) {
        const d = inv.issueDate.substring(0, 10);
        if (d < dateRange[0] || d > dateRange[1]) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = (inv.number || "").toLowerCase().includes(q);
        const matchTotal = String(inv.total || "").includes(q);
        if (!matchNum && !matchTotal) return false;
      }
      return true;
    });
  }, [data?.sentInvoices, dateRange, searchQuery]);

  // Filtered Received Invoices
  const filteredReceivedInvoices = useMemo(() => {
    if (!data?.receivedInvoices) return [];
    return data.receivedInvoices.filter((inv) => {
      if (dateRange && inv.issueDate) {
        const d = inv.issueDate.substring(0, 10);
        if (d < dateRange[0] || d > dateRange[1]) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = (inv.number || inv.invoiceNumber || "").toLowerCase().includes(q);
        if (!matchNum) return false;
      }
      return true;
    });
  }, [data?.receivedInvoices, dateRange, searchQuery]);

  // Financial KPIs
  const kpis = useMemo(() => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let primaryCurrency = "RON";

    filteredSentInvoices.forEach((inv) => {
      const tot = parseFloat(inv.total || "0");
      if (inv.currency) primaryCurrency = inv.currency;
      totalInvoiced += tot;

      const isPaid = inv.status === "paid";
      if (isPaid) {
        totalCollected += tot;
        paidCount++;
      } else if (inv.status !== "storno" && inv.status !== "cancelled") {
        totalPending += tot;
        pendingCount++;
      }
    });

    const invoiceCount = filteredSentInvoices.length;
    const avgInvoice = invoiceCount > 0 ? totalInvoiced / invoiceCount : 0;

    return {
      totalInvoiced,
      totalCollected,
      totalPending,
      invoiceCount,
      paidCount,
      pendingCount,
      avgInvoice,
      currency: primaryCurrency,
    };
  }, [filteredSentInvoices]);

  // Monthly Billing Trend Chart Data
  const monthlyTrendData = useMemo(() => {
    const monthsMap: Record<string, { month: string; total: number; count: number }> = {};

    // Sort invoices chronologically
    const sorted = [...filteredSentInvoices].sort((a, b) =>
      (a.issueDate || "").localeCompare(b.issueDate || "")
    );

    sorted.forEach((inv) => {
      if (!inv.issueDate) return;
      const key = inv.issueDate.substring(0, 7); // YYYY-MM
      if (!monthsMap[key]) {
        // Format as MMM YYYY (e.g. Feb 2026)
        const dateObj = new Date(key + "-01");
        const monthLabel = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleDateString("ro-RO", { month: "short", year: "2-digit" })
          : key;
        monthsMap[key] = { month: monthLabel, total: 0, count: 0 };
      }
      monthsMap[key].total += parseFloat(inv.total || "0");
      monthsMap[key].count += 1;
    });

    const result = Object.values(monthsMap);
    // If fewer than 2 data points, return default friendly points
    if (result.length === 0) {
      return [{ month: "Fără date", total: 0, count: 0 }];
    }
    return result;
  }, [filteredSentInvoices]);

  // Payment Status Distribution Chart Data
  const statusDistributionData = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let storno = 0;

    filteredSentInvoices.forEach((inv) => {
      const tot = Math.abs(parseFloat(inv.total || "0"));
      if (inv.status === "paid") paid += tot;
      else if (inv.status === "storno") storno += tot;
      else pending += tot;
    });

    const dataArr = [
      { name: "Încasat", value: Math.round(paid * 100) / 100, color: "#10b981" },
      { name: "Rest Plată", value: Math.round(pending * 100) / 100, color: "#3b82f6" },
    ];
    if (storno > 0) {
      dataArr.push({ name: "Storno", value: Math.round(storno * 100) / 100, color: "#ef4444" });
    }
    return dataArr.filter((d) => d.value > 0);
  }, [filteredSentInvoices]);

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col justify-center items-center h-full min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium text-slate-500">Se încarcă datele și analizele clientului...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-red-500 bg-red-50 dark:bg-red-950/40 p-6 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm flex items-center gap-4">
          <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <h3 className="font-bold text-base text-red-800 dark:text-red-300">Clientul nu a fost găsit</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Nu s-au putut încărca datele pentru ID-ul solicitat. Asigură-te că linkul este corect.
            </p>
            <Link
              href="/clienti"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300 underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Înapoi la lista de clienți
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { client, topLines = [] } = data;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/clienti"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 shadow-sm transition-all"
            title="Înapoi la clienți"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Dosar Client & Analitice
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                ID: {client.id}
              </span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-6 h-6 text-primary shrink-0" />
                {client.name}
              </h1>

              {/* FirmeAPI Quick Status Badges */}
              {firmeApiQuery.data?.general && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {firmeApiQuery.data.general.stare && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-xs ${
                        firmeApiQuery.data.general.stare.toLowerCase().includes("inactiv")
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {firmeApiQuery.data.general.stare.split(" din data")[0]}
                    </span>
                  )}
                  {firmeApiQuery.data.general.tva !== undefined && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        firmeApiQuery.data.general.tva.platitor
                          ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900"
                          : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      {firmeApiQuery.data.general.tva.platitor ? "Plătitor TVA" : "Neplătitor TVA"}
                    </span>
                  )}
                  {firmeApiQuery.data.general.e_factura && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900">
                      <Check className="w-3 h-3 text-purple-600" /> RO e-Factura
                    </span>
                  )}
                  {firmeApiQuery.data.caen?.caen_principal?.cod && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900">
                      CAEN {firmeApiQuery.data.caen.caen_principal.cod}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleOpenEdit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-sm transition-all"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Editează Profil
          </button>
          <Link
            href={`/facturi-emise-nou/new?clientId=${client.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:opacity-95 shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Emite Factură Nouă
          </Link>
        </div>
      </div>

      {/* Client Overview Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-medium mb-1 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-primary" /> Identificare Fiscală
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              CUI: <span className="font-mono">{client.cui || "—"}</span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
              Reg. Com: <span className="font-medium">{client.regCom || "—"}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-medium mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" /> Sediu & Locație
            </div>
            <div className="font-bold text-slate-900 dark:text-white truncate" title={client.address || "—"}>
              {client.address || "Adresă nespecificată"}
            </div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
              {client.city ? `${client.city}, ` : ""}
              {client.country || "RO"}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-medium mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-primary" /> Date de Contact
            </div>
            <div className="font-bold text-slate-900 dark:text-white truncate" title={client.email || "—"}>
              {client.email ? (
                <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                  {client.email}
                </a>
              ) : (
                "—"
              )}
            </div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <span>{client.phone || "—"}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 font-medium mb-1 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-primary" /> Preferințe Financiare
            </div>
            <div className="font-bold text-slate-900 dark:text-white">
              Monedă: <span className="font-bold text-primary">{client.currency || "RON"}</span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
              Cod SAGA: <span className="font-mono">{(client as any).sagaCode || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Period Filter & Search Bar (Identical to Evidență Facturi) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Period Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-primary" /> Perioadă:
          </span>
          {[
            { id: "all", label: "Toate dățile" },
            { id: "this_month", label: "Luna curentă" },
            { id: "last_month", label: "Luna trecută" },
            { id: "this_year", label: "Anul curent" },
            { id: "last_year", label: "Anul trecut" },
            { id: "last_30_days", label: "Ultimele 30 zile" },
            { id: "custom", label: "Personalizat..." },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id as PeriodFilter)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                period === item.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search & Custom Date Inputs */}
        <div className="flex items-center gap-3 flex-wrap">
          {period === "custom" && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-7 text-xs bg-transparent text-slate-700 dark:text-slate-200 outline-none w-28"
              />
              <span className="text-xs text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-7 text-xs bg-transparent text-slate-700 dark:text-slate-200 outline-none w-28"
              />
            </div>
          )}

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Caută factură / sumă..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Facturat */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Facturat</span>
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {kpis.totalInvoiced.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-xs font-bold text-slate-500">{kpis.currency}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 font-medium">
            <FileText className="w-3 h-3 text-slate-400" />
            <span>{kpis.invoiceCount} facturi emise în perioadă</span>
          </div>
        </div>

        {/* Total Încasat */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Încasat</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {kpis.totalCollected.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-xs font-bold text-emerald-600/70">{kpis.currency}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 font-medium">
            <span>{kpis.paidCount} facturi achitate integral</span>
          </div>
        </div>

        {/* Rest de Plată */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rest de Plată</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
            {kpis.totalPending.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-xs font-bold text-amber-600/70">{kpis.currency}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 font-medium">
            <span>{kpis.pendingCount} facturi în așteptare / neachitate</span>
          </div>
        </div>

        {/* Valoare Medie / Factură */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Valoare Medie / Factură</span>
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {kpis.avgInvoice.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
            <span className="text-xs font-bold text-slate-500">{kpis.currency}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 font-medium">
            <span>Ticket mediu per tranzacție</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Evoluție Facturare Lunară
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Volumul vânzărilor către acest client pe luni</p>
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="clientBillingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary, #239040)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary, #239040)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(148, 163, 184, 0.2)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={{ stroke: "rgba(148, 163, 184, 0.2)" }}
                  tickLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-lg border border-slate-700">
                          <div className="font-semibold text-slate-300">{dataPoint.month}</div>
                          <div className="text-sm font-bold text-white mt-1">
                            {Number(dataPoint.total).toLocaleString("ro-RO", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            {kpis.currency}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{dataPoint.count} facturi</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--primary, #239040)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#clientBillingGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Donut Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Status Încasare
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Rata de colectare a creanțelor</p>
          </div>

          <div className="h-[180px] w-full my-auto">
            {statusDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0];
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2 rounded-lg shadow-md border border-slate-700">
                            <span className="font-semibold">{item.name}: </span>
                            <span className="font-bold">
                              {Number(item.value).toLocaleString("ro-RO", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              {kpis.currency}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Fără date de plată în perioada selectată
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-400 truncate">Încasat:</span>
              <span className="font-bold text-slate-900 dark:text-white ml-auto">
                {kpis.totalInvoiced > 0
                  ? Math.round((kpis.totalCollected / kpis.totalInvoiced) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-slate-600 dark:text-slate-400 truncate">Rest:</span>
              <span className="font-bold text-slate-900 dark:text-white ml-auto">
                {kpis.totalInvoiced > 0
                  ? Math.round((kpis.totalPending / kpis.totalInvoiced) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Facturi Emise | Produse / Servicii | Facturi Primite */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-5 pt-3 gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("sent")}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === "sent"
                ? "text-primary"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            Facturi Emise Către Client ({filteredSentInvoices.length})
            {activeTab === "sent" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === "products"
                ? "text-primary"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Package className="w-4 h-4" />
            Top Produse & Servicii ({topLines.length})
            {activeTab === "products" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
            )}
          </button>

          {data.receivedInvoices && data.receivedInvoices.length > 0 && (
            <button
              onClick={() => setActiveTab("received")}
              className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
                activeTab === "received"
                  ? "text-primary"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Facturi Primite de la Client (Furnizor) ({filteredReceivedInvoices.length})
              {activeTab === "received" && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab("firme_api")}
            className={`pb-3 text-xs font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === "firme_api"
                ? "text-primary"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Dosar FirmeAPI & Bilanț
            {firmeApiQuery.data && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                {firmeApiQuery.data.financials.length > 0
                  ? `${firmeApiQuery.data.financials.length} Ani Bilanț`
                  : "ONRC"}
              </span>
            )}
            {activeTab === "firme_api" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Sent Invoices Table */}
        {activeTab === "sent" && (
          <div className="overflow-x-auto">
            {filteredSentInvoices.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Nr. Factură</th>
                    <th className="py-3 px-4">Data Emiterii</th>
                    <th className="py-3 px-4">Scadență</th>
                    <th className="py-3 px-4 text-right">Valoare Totală</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredSentInvoices.map((inv) => {
                    const isPaid = inv.status === "paid";
                    const isSent = inv.status === "sent";
                    const isStorno = inv.status === "storno";
                    const isOverdue = inv.status === "overdue";

                    const badgeClass = isPaid
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : isSent
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                      : isStorno
                      ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
                      : isOverdue
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                    const label = isPaid
                      ? "PLĂTITĂ"
                      : isSent
                      ? "TRIMISĂ"
                      : isStorno
                      ? "STORNATĂ"
                      : isOverdue
                      ? "RESTANTĂ"
                      : (inv.status || "EMISĂ").toUpperCase();

                    const viewUrl =
                      inv.type === "reinvoice"
                        ? `/re-facturi/${inv.id}`
                        : inv.type === "archive"
                        ? `/api/pdf/archive/${inv.id}`
                        : `/api/pdf/emitted/${inv.id}`;

                    return (
                      <tr
                        key={`${inv.type}-${inv.id}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-primary hover:underline"
                          >
                            {inv.number}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {inv.issueDate || "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {inv.dueDate || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                          {parseFloat(inv.total || "0").toLocaleString("ro-RO", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-[10px] text-slate-400 font-semibold">{inv.currency}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${badgeClass}`}>
                            {label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-[11px] transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nu există facturi emise în perioada selectată.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Top Products / Services */}
        {activeTab === "products" && (
          <div className="p-5">
            {topLines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Denumire Produs / Serviciu</th>
                      <th className="py-3 px-4 text-right">Cantitate</th>
                      <th className="py-3 px-4 text-right">Valoare Totală</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {topLines.map((line: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                          {line.description}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300 font-semibold">
                          {line.quantity}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-white">
                          {parseFloat(line.total || "0").toLocaleString("ro-RO", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-[10px] text-slate-400">{kpis.currency}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nu există linii de produse detaliate înregistrate pentru acest client.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Received Invoices */}
        {activeTab === "received" && (
          <div className="overflow-x-auto">
            {filteredReceivedInvoices.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Nr. Factură</th>
                    <th className="py-3 px-4">Data Emiterii</th>
                    <th className="py-3 px-4 text-right">Valoare Totală</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredReceivedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-purple-600 dark:text-purple-400">
                        {inv.invoiceNumber || inv.number || `#${inv.id}`}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{inv.issueDate || "—"}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                        {parseFloat(inv.total || "0").toLocaleString("ro-RO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-[10px] text-slate-400">{inv.currency}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400">
                          {inv.status || "PROCESAT"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <a
                          href={`/api/pdf/archive/${inv.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nicio factură primită în perioada selectată.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: FirmeAPI Dossier & Bilant */}
        {activeTab === "firme_api" && (
          <div className="p-5 sm:p-6 space-y-6">
            {!cleanCui ? (
              <div className="py-12 px-4 text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  CUI / CIF lipsă
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Acest client nu are completat un cod fiscal (CUI) valid. Adaugă CUI-ul în profilul clientului pentru a accesa dosarul complet FirmeAPI și bilanțul oficial.
                </p>
                <button
                  onClick={handleOpenEdit}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-white shadow-sm hover:opacity-95"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Completează CUI Client
                </button>
              </div>
            ) : firmeApiQuery.isLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-9 h-9 animate-spin text-emerald-600 mx-auto mb-3" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Se interoghează baza de date FirmeAPI.ro & Registrul Comerțului...
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Se descarcă bilanțul multianual, asociații din Registrul Comerțului, codurile CAEN și istoricul din Monitorul Oficial.
                </p>
              </div>
            ) : !firmeApiQuery.data?.general ? (
              <div className="py-12 px-4 text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Firma nu a fost găsită în baza FirmeAPI
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Nu s-au găsit înregistrări oficiale pentru CUI: <span className="font-mono font-bold">{cleanCui}</span>. Verifică dacă codul fiscal este corect.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={handleRefreshFirmeApi}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white shadow-sm hover:opacity-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reîncearcă interogarea
                  </button>
                  <button
                    onClick={handleOpenEdit}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editează CUI
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const dossier = firmeApiQuery.data;
                const g = dossier.general;
                const fin = dossier.financials || [];
                const latestFin = fin.length > 0 ? fin[0] : null;
                const holdings = dossier.holdings || [];
                const admins = dossier.administrators || [];
                const caen = dossier.caen;
                const mof = dossier.mof || [];

                // Chart data sorted chronologically
                const finChartData = [...fin].reverse().map((f) => ({
                  an: String(f.an),
                  "Cifră Afaceri": f.cifraAfaceri,
                  "Venituri Totale": f.venituriTotale,
                  "Profit Net": f.profitNet,
                  "Pierdere Netă": f.pierdereNeta,
                  Salariați: f.angajati,
                }));

                return (
                  <div className="space-y-6">
                    {/* Header Bar with Legal & Official Info */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200/80 dark:border-emerald-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Date Oficiale ONRC & ANAF
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                            FirmeAPI.ro Intelligence
                          </span>
                          {dossier.cachedAt && (
                            <span className="text-[10px] text-slate-400">
                              Actualizat: {new Date(dossier.cachedAt).toLocaleDateString("ro-RO")}
                            </span>
                          )}
                        </div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                          {g?.denumire}
                        </h2>
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-4 flex-wrap">
                          <span>
                            CUI: <strong className="font-mono text-slate-900 dark:text-white">{g?.cui}</strong>
                          </span>
                          <span>
                            Reg. Com: <strong className="text-slate-900 dark:text-white">{g?.nr_reg_com || "—"}</strong>
                          </span>
                          <span>
                            Formă: <strong className="text-slate-900 dark:text-white">{g?.forma_juridica || "SRL"}</strong>
                          </span>
                          {g?.data_inregistrare && (
                            <span>
                              Înființat: <strong className="text-slate-900 dark:text-white">{g.data_inregistrare}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleRefreshFirmeApi}
                          disabled={forceRefreshing}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-xs transition-all disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${forceRefreshing ? "animate-spin" : ""}`} />
                          Actualizează Dosar
                        </button>

                        <button
                          onClick={() => syncMutation.mutate({ clientId: id, cui: cleanCui })}
                          disabled={syncMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
                        >
                          {syncMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Sincronizează în Profil Client
                        </button>
                      </div>
                    </div>

                    {/* Fiscal & Legal Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Sediu Social */}
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="text-slate-400 font-medium text-xs mb-1.5 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Sediu Social Oficial
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white text-xs leading-relaxed">
                          {g?.adresa || g?.adresa_sediu_social?.strada || "Adresă indisponibilă"}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {g?.adresa_sediu_social?.localitate ? `${g.adresa_sediu_social.localitate}, ` : ""}
                          {g?.adresa_sediu_social?.judet || ""}
                        </div>
                      </div>

                      {/* Regim TVA & e-Factura */}
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="text-slate-400 font-medium text-xs mb-1.5 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Regim Fiscal & TVA
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              g?.tva?.platitor
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {g?.tva?.platitor ? "Plătitor de TVA" : "Neplătitor de TVA"}
                          </span>
                          {g?.tva_incasare?.activ && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              TVA la Încasare
                            </span>
                          )}
                          {g?.split_tva?.activ && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Split TVA
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                          <span>RO e-Factura:</span>
                          <strong className={g?.e_factura ? "text-purple-600 font-bold" : "text-slate-400"}>
                            {g?.e_factura ? "Înrolat în registru" : "Neînrolat"}
                          </strong>
                        </div>
                      </div>

                      {/* Stare Firmă & Inactivitate ANAF */}
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="text-slate-400 font-medium text-xs mb-1.5 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Stare Companie & ANAF
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {g?.stare || "Înregistrat"}
                        </div>
                        <div className="mt-1.5 text-[11px]">
                          {g?.status_inactiv?.inactiv ? (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Declarată Inactivă de ANAF
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Activă fiscal (fără inactivitate)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Organ Fiscal Competent */}
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div className="text-slate-400 font-medium text-xs mb-1.5 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-emerald-600" /> Organ Fiscal & Proprietate
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white text-xs truncate" title={g?.organ_fiscal || "—"}>
                          {g?.organ_fiscal || "ANAF"}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 truncate" title={g?.forma_de_proprietate || "—"}>
                          {g?.forma_de_proprietate || "Capital Privat"}
                        </div>
                      </div>
                    </div>

                    {/* Section 1: Financial Evolution & Balance Sheets (Bilanț Multianual) */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                            Performanță Financiară & Bilanțuri Oficiale
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Situații financiare anuale depuse la Ministerul Finanțelor Publice ({fin.length} ani raportați)
                          </p>
                        </div>
                        {latestFin && (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Ultimul Bilanț: {latestFin.an}
                            </span>
                          </div>
                        )}
                      </div>

                      {latestFin ? (
                        <>
                          {/* Latest Year Highlight KPI Cards */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Cifră Afaceri Netă */}
                            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                                Cifră de Afaceri Netă ({latestFin.an})
                              </span>
                              <div className="mt-1 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                                {latestFin.cifraAfaceri.toLocaleString("ro-RO")}{" "}
                                <span className="text-xs font-bold text-slate-400">RON</span>
                              </div>
                              <span className="text-[10px] text-slate-400 mt-0.5 block">
                                Venituri: {latestFin.venituriTotale.toLocaleString("ro-RO")} RON
                              </span>
                            </div>

                            {/* Rezultat Net (Profit / Pierdere) */}
                            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                                Rezultat Net ({latestFin.an})
                              </span>
                              {latestFin.profitNet > 0 ? (
                                <div className="mt-1 text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                  +{latestFin.profitNet.toLocaleString("ro-RO")}{" "}
                                  <span className="text-xs font-bold text-emerald-600/70">RON</span>
                                </div>
                              ) : latestFin.pierdereNeta > 0 ? (
                                <div className="mt-1 text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                                  -{latestFin.pierdereNeta.toLocaleString("ro-RO")}{" "}
                                  <span className="text-xs font-bold text-rose-600/70">RON</span>
                                </div>
                              ) : (
                                <div className="mt-1 text-xl sm:text-2xl font-black text-slate-500">
                                  0 <span className="text-xs font-bold text-slate-400">RON</span>
                                </div>
                              )}
                              <span className="text-[10px] text-slate-400 mt-0.5 block">
                                {latestFin.profitNet > 0 ? "Profit Net Raportat" : latestFin.pierdereNeta > 0 ? "Pierdere Netă Raportată" : "Echilibru"}
                              </span>
                            </div>

                            {/* Număr Mediu Salariați */}
                            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                                Număr Mediu Salariați
                              </span>
                              <div className="mt-1 text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-emerald-600" />
                                {latestFin.angajati}{" "}
                                <span className="text-xs font-bold text-slate-400">
                                  {latestFin.angajati === 1 ? "salariat" : "salariați"}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 mt-0.5 block">
                                Conform declarației 100/101
                              </span>
                            </div>

                            {/* Datorii Totale */}
                            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                                Datorii Totale
                              </span>
                              <div className="mt-1 text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                                {latestFin.datorii.toLocaleString("ro-RO")}{" "}
                                <span className="text-xs font-bold text-amber-600/70">RON</span>
                              </div>
                              <span className="text-[10px] text-slate-400 mt-0.5 block">
                                Creanțe: {latestFin.creante.toLocaleString("ro-RO")} RON
                              </span>
                            </div>
                          </div>

                          {/* Multi-Year Chart (Cifră Afaceri vs Venituri vs Profit/Pierdere) */}
                          {finChartData.length > 1 && (
                            <div>
                              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                                <TrendingUp className="w-4 h-4 text-emerald-600" />
                                Evoluție Financiară Multianuală (Bilanțuri {finChartData[0]?.an} - {finChartData[finChartData.length - 1]?.an})
                              </h4>
                              <div className="h-[260px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={finChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                                    <XAxis dataKey="an" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                    <YAxis
                                      tick={{ fontSize: 11 }}
                                      stroke="#94a3b8"
                                      tickFormatter={(val) =>
                                        val >= 1000000
                                          ? `${(val / 1000000).toFixed(1)}M`
                                          : val >= 1000
                                          ? `${(val / 1000).toFixed(0)}k`
                                          : val
                                      }
                                    />
                                    <Tooltip
                                      content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                          return (
                                            <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700 space-y-1.5">
                                              <div className="font-black text-sm border-b border-slate-700 pb-1 text-emerald-400">
                                                Anul {label}
                                              </div>
                                              {payload.map((p: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between gap-4">
                                                  <span className="flex items-center gap-1.5 text-slate-300">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                                    {p.name}:
                                                  </span>
                                                  <span className="font-bold">
                                                    {Number(p.value).toLocaleString("ro-RO")} {p.name === "Salariați" ? "pers." : "RON"}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        }
                                        return null;
                                      }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                                    <Bar dataKey="Cifră Afaceri" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Venituri Totale" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Profit Net" fill="#059669" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Pierdere Netă" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}

                          {/* Multi-Year Detailed Table */}
                          <div>
                            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                              Tabel Comparativ Bilanț pe Toți Anii Raportați
                            </h4>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                              <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                                  <tr>
                                    <th className="py-2.5 px-3">An</th>
                                    <th className="py-2.5 px-3 text-right">Cifră Afaceri</th>
                                    <th className="py-2.5 px-3 text-right">Venituri Totale</th>
                                    <th className="py-2.5 px-3 text-right">Cheltuieli</th>
                                    <th className="py-2.5 px-3 text-right">Profit Net</th>
                                    <th className="py-2.5 px-3 text-right">Pierdere Netă</th>
                                    <th className="py-2.5 px-3 text-center">Salariați</th>
                                    <th className="py-2.5 px-3 text-right">Active Imob.</th>
                                    <th className="py-2.5 px-3 text-right">Creanțe</th>
                                    <th className="py-2.5 px-3 text-right">Casa & Bănci</th>
                                    <th className="py-2.5 px-3 text-right">Datorii Totale</th>
                                    <th className="py-2.5 px-3 text-right">Capitaluri Proprii</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {fin.map((item) => (
                                    <tr key={item.an} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                                      <td className="py-2.5 px-3">
                                        <span className="font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono">
                                          {item.an}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                                        {item.cifraAfaceri.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-200">
                                        {item.venituriTotale.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-500">
                                        {item.cheltuieliTotale.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                        {item.profitNet > 0 ? item.profitNet.toLocaleString("ro-RO") : "—"}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                                        {item.pierdereNeta > 0 ? item.pierdereNeta.toLocaleString("ro-RO") : "—"}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                                        {item.angajati}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                                        {item.activeImobilizate.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                                        {item.creante.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                                        {item.casaSiConturi.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                                        {item.datorii.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                                        {item.capitaluriProprii.toLocaleString("ro-RO")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400">
                          Nu au fost găsite date de bilanț raportate la ANAF pentru acest CUI.
                        </div>
                      )}
                    </div>

                    {/* Section 2: Acționari & Asociați (Holdings) & Conducere */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Acționari & Asociați */}
                      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Users className="w-4 h-4 text-emerald-600" />
                            Acționari & Asociați Oficiali ({holdings.length})
                          </h3>
                          <span className="text-[11px] text-slate-400 font-medium">ONRC Data</span>
                        </div>

                        {holdings.length > 0 ? (
                          <div className="space-y-3">
                            {holdings.map((h, idx) => (
                              <div
                                key={idx}
                                className={`p-3.5 rounded-xl border transition-all ${
                                  h.current
                                    ? "bg-slate-50/70 dark:bg-slate-800/50 border-emerald-200/80 dark:border-emerald-800/40"
                                    : "bg-slate-50/30 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800 opacity-70"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                                      {h.name}
                                      {h.current ? (
                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                          Activ
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                          Istoric
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      {h.type} {h.entity ? `(${h.entity})` : ""}
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                      {h.percent}%
                                    </span>
                                    <div className="text-[10px] text-slate-400">
                                      {h.from} {h.to ? `→ ${h.to}` : "→ Prezent"}
                                    </div>
                                  </div>
                                </div>

                                {/* Visual Progress Bar */}
                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      h.current ? "bg-emerald-500" : "bg-slate-400"
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, h.percent))}%` }}
                                  />
                                </div>

                                {h.placeofbirth && (
                                  <div className="mt-1.5 text-[10px] text-slate-400">
                                    Loc naștere: {h.placeofbirth}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-xs text-slate-400">
                            Nu există date detaliate despre acționari.
                          </div>
                        )}
                      </div>

                      {/* Administratori & Conducere */}
                      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-emerald-600" />
                            Administratori & Conducere Oficială ({admins.length})
                          </h3>
                          <span className="text-[11px] text-slate-400 font-medium">Registrul Comerțului</span>
                        </div>

                        {admins.length > 0 ? (
                          <div className="space-y-3">
                            {admins.map((adm, idx) => (
                              <div
                                key={idx}
                                className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
                              >
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                                    {adm.nume}
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                      {adm.stare || "Activ"}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    Calitate: <strong className="capitalize">{adm.calitate || "Administrator"}</strong>
                                    {adm.tip ? ` • ${adm.tip}` : ""}
                                  </div>
                                  {adm.loc_nastere && (
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      Loc naștere: {adm.loc_nastere}
                                    </div>
                                  )}
                                </div>

                                {adm.data && (
                                  <div className="text-right text-[11px]">
                                    <span className="text-slate-400 block text-[10px]">Data numirii</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                      {adm.data}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-xs text-slate-400">
                            Nu sunt înregistrați administratori oficiali distincți.
                          </div>
                        )}

                        {/* Clasificare & Coduri CAEN */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-emerald-600" />
                            Activitate Principală (CAEN Rev. 2)
                          </h4>

                          {caen?.caen_principal ? (
                            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-amber-500 text-white font-mono">
                                  {caen.caen_principal.cod}
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white text-xs">
                                  {caen.caen_principal.denumire}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">CAEN principal nespecificat.</div>
                          )}

                          {caen?.caen_secundare && caen.caen_secundare.length > 0 && (
                            <div className="mt-3">
                              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                                Activități Secundare Autorizate ({caen.caen_secundare.length}):
                              </span>
                              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                {caen.caen_secundare.map((cs, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                    title={cs.denumire}
                                  >
                                    <strong className="font-mono text-emerald-600 mr-1">{cs.cod}</strong>
                                    {cs.denumire.length > 35 ? `${cs.denumire.substring(0, 35)}...` : cs.denumire}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Monitorul Oficial (Publicații & Rezoluții ONRC) */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-emerald-600" />
                            Monitorul Oficial — Istoric Mențiuni & Rezoluții ONRC ({mof.length})
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Publicații în Monitorul Oficial al României, Partea a IV-a
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">Partea IV</span>
                      </div>

                      {mof.length > 0 ? (
                        <div className="space-y-3">
                          {mof.map((entry, idx) => {
                            const isExpanded = expandedMofIndex === idx;
                            return (
                              <div
                                key={idx}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => setExpandedMofIndex(isExpanded ? null : idx)}
                                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-mono">
                                      Nr. {entry.numar}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                      {entry.titlu_publicatie || "Notificare Monitorul Oficial"}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-medium">
                                      {entry.data}
                                    </span>
                                  </div>

                                  <div className="text-slate-400">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </div>
                                </button>

                                {isExpanded && entry.continut && (
                                  <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-serif space-y-2">
                                    <div
                                      dangerouslySetInnerHTML={{
                                        __html: entry.continut,
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400">
                          Nu au fost găsite publicații recente în Monitorul Oficial pentru acest CUI.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* Edit Client Profile Modal (In-App UI modal without browser alerts) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Edit3 className="w-4 h-4 text-primary" />
              Editează Profil Client
            </h2>

            <form onSubmit={handleSaveClient} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Denumire Companie *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">CUI / CIF</label>
                  <input
                    type="text"
                    value={editFormData.cui}
                    onChange={(e) => setEditFormData({ ...editFormData, cui: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nr. Reg. Com.</label>
                  <input
                    type="text"
                    value={editFormData.regCom}
                    onChange={(e) => setEditFormData({ ...editFormData, regCom: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Adresă Sediu</label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Oraș</label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Țară</label>
                  <input
                    type="text"
                    value={editFormData.country}
                    onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Telefon</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={updateClientMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:opacity-95 shadow-sm disabled:opacity-50"
                >
                  {updateClientMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Salvează Modificările
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
