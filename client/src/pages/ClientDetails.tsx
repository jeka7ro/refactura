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
  FileSignature,
  Upload,
  FileCheck,
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
  const [activeTab, setActiveTab] = useState<"sent" | "received" | "products" | "firme_api" | "contracts">("sent");
  const [expandedMofIndex, setExpandedMofIndex] = useState<number | null>(null);

  // Partner Contracts Query
  const { data: partnerContracts = [], isLoading: loadingContracts } = trpc.contracts.list.useQuery(
    { partnerId: id },
    { enabled: !isNaN(id) && id > 0 }
  );

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
        <Loader2 className="w-8 h-8 animate-spin text-[#8e8e93] mb-3" />
        <p className="text-[13px] font-medium text-[#6e6e73] dark:text-[#98989d]">
          Se încarcă datele și analizele partenerului...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-3 sm:p-5 max-w-full">
        <div className="apple-surface p-6 flex items-center gap-4 border border-[#ff3b30]/25">
          <div className="w-10 h-10 rounded-xl bg-[#ff3b30]/12 text-[#ff3b30] dark:text-[#ff453a] flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7]">
              Partenerul nu a fost găsit
            </h3>
            <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
              Nu s-au putut încărca datele pentru ID-ul solicitat. Asigură-te că linkul este corect.
            </p>
            <Link
              href="/clienti"
              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Înapoi la lista de parteneri
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { client, topLines = [] } = data;

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <Link
            href="/clienti"
            className="apple-btn-glass inline-flex items-center justify-center w-9 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0"
            title="Înapoi la parteneri"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight truncate">
                {client.name}
              </h1>

              {/* FirmeAPI Quick Status Badges */}
              {firmeApiQuery.data?.general && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {firmeApiQuery.data.general.stare && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        firmeApiQuery.data.general.stare.toLowerCase().includes("inactiv")
                          ? "bg-[#ff3b30]/12 text-[#ff3b30] dark:text-[#ff453a] border border-[#ff3b30]/20"
                          : "bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158] border border-[#34c759]/20"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {firmeApiQuery.data.general.stare.split(" din data")[0]}
                    </span>
                  )}
                  {firmeApiQuery.data.general.tva !== undefined && (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        firmeApiQuery.data.general.tva.platitor
                          ? "bg-[#007aff]/10 text-[#007aff] dark:text-[#0a84ff] border-[#007aff]/20"
                          : "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] border-black/[0.06] dark:border-white/[0.08]"
                      }`}
                    >
                      {firmeApiQuery.data.general.tva.platitor ? "Plătitor TVA" : "Neplătitor TVA"}
                    </span>
                  )}
                  {firmeApiQuery.data.general.e_factura && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/[0.06] dark:border-white/[0.08]">
                      <Check className="w-3 h-3 text-[#248a3d] dark:text-[#30d158]" /> RO e-Factura
                    </span>
                  )}
                  {firmeApiQuery.data.caen?.caen_principal?.cod && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium tabular-nums bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      CAEN {firmeApiQuery.data.caen.caen_principal.cod}
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
              Dosar partener & analitice · ID #{client.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={handleOpenEdit}
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" /> Editează Profil
          </button>
          <Link
            href={`/facturi-emise-nou/new?clientId=${client.id}`}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Emite Factură Nouă
          </Link>
        </div>
      </div>

      {/* Client Overview Card */}
      <div className="apple-surface p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] min-w-0">
            <div className="text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium mb-1 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 shrink-0" /> Identificare fiscală
            </div>
            <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
              CUI: <span className="tabular-nums">{client.cui || "—"}</span>
            </div>
            <div className="text-[#6e6e73] dark:text-[#98989d] text-[12px] mt-0.5 tabular-nums">
              Reg. Com: <span className="font-medium">{client.regCom || "—"}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] min-w-0">
            <div className="text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" /> Sediu & locație
            </div>
            <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px] truncate" title={client.address || "—"}>
              {client.address || "Adresă nespecificată"}
            </div>
            <div className="text-[#6e6e73] dark:text-[#98989d] text-[12px] mt-0.5 truncate">
              {client.city ? `${client.city}, ` : ""}
              {client.country || "RO"}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] min-w-0">
            <div className="text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 shrink-0" /> Date de contact
            </div>
            <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px] truncate" title={client.email || "—"}>
              {client.email ? (
                <a href={`mailto:${client.email}`} className="hover:underline">
                  {client.email}
                </a>
              ) : (
                "—"
              )}
            </div>
            <div className="text-[#6e6e73] dark:text-[#98989d] text-[12px] mt-0.5 flex items-center gap-1 tabular-nums">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{client.phone || "—"}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] min-w-0">
            <div className="text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium mb-1 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 shrink-0" /> Preferințe financiare
            </div>
            <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]">
              Monedă: <span>{client.currency || "RON"}</span>
            </div>
            <div className="text-[#6e6e73] dark:text-[#98989d] text-[12px] mt-0.5">
              Cod SAGA: <span className="tabular-nums font-medium">{(client as any).sagaCode || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Period Filter & Search Toolbar */}
      <div className="apple-surface px-3 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Period Segmented Pills */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="apple-segmented flex items-center flex-wrap">
            {[
              { id: "all", label: "Toate dățile" },
              { id: "this_month", label: "Luna curentă" },
              { id: "last_month", label: "Luna trecută" },
              { id: "this_year", label: "Anul curent" },
              { id: "last_year", label: "Anul trecut" },
              { id: "last_30_days", label: "Ultimele 30 zile" },
              { id: "custom", label: "Personalizat" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={period === item.id}
                onClick={() => setPeriod(item.id as PeriodFilter)}
                className="apple-segmented-item h-[28px] px-3 text-[12px]"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Custom Date Inputs */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {period === "custom" && (
            <div className="flex items-center gap-1.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] h-[34px] px-3 rounded-full border border-black/[0.06] dark:border-white/[0.08]">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-7 text-[16px] sm:text-[12px] tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-28"
              />
              <span className="text-xs text-[#8e8e93]">–</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-7 text-[16px] sm:text-[12px] tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-28"
              />
            </div>
          )}

          <div className="relative flex-1 sm:flex-initial min-w-[200px] sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93] pointer-events-none" />
            <input
              type="text"
              placeholder="Caută factură / sumă..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apple-pill-control w-full h-[34px] pl-8 pr-3 rounded-full text-[16px] sm:text-[12.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Facturat */}
        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Total facturat
            </span>
            <div className="w-7 h-7 rounded-[8px] bg-[#007aff]/10 dark:bg-[#0a84ff]/15 text-[#007aff] dark:text-[#0a84ff] flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {kpis.totalInvoiced.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <span className="text-[12px] font-semibold text-[#8e8e93]">{kpis.currency}</span>
            </div>
            <div className="mt-1.5 text-[11.5px] text-[#8e8e93] tabular-nums truncate">
              {kpis.invoiceCount} facturi emise în perioadă
            </div>
          </div>
        </div>

        {/* Total Încasat */}
        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Total încasat
            </span>
            <div className="w-7 h-7 rounded-[8px] bg-[#34c759]/12 dark:bg-[#30d158]/16 text-[#248a3d] dark:text-[#30d158] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {kpis.totalCollected.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <span className="text-[12px] font-semibold text-[#8e8e93]">{kpis.currency}</span>
            </div>
            <div className="mt-1.5 text-[11.5px] text-[#8e8e93] tabular-nums truncate">
              {kpis.paidCount} facturi încasate integral
            </div>
          </div>
        </div>

        {/* Rest de Plată */}
        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Rest de plată
            </span>
            <div className="w-7 h-7 rounded-[8px] bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {kpis.totalPending.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <span className="text-[12px] font-semibold text-[#8e8e93]">{kpis.currency}</span>
            </div>
            <div className="mt-1.5 text-[11.5px] text-[#8e8e93] tabular-nums truncate">
              {kpis.pendingCount} facturi neîncasate
            </div>
          </div>
        </div>

        {/* Valoare Medie / Factură */}
        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Valoare medie / factură
            </span>
            <div className="w-7 h-7 rounded-[8px] bg-[#8e8e93]/12 dark:bg-white/[0.08] text-[#6e6e73] dark:text-[#98989d] flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {kpis.avgInvoice.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
              <span className="text-[12px] font-semibold text-[#8e8e93]">{kpis.currency}</span>
            </div>
            <div className="mt-1.5 text-[11.5px] text-[#8e8e93] truncate">
              Tichet mediu per tranzacție
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Facturi Emise | Produse / Servicii | Facturi Primite | FirmeAPI | Contracte */}
      <div className="apple-surface overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02] px-4 sm:px-5 pt-3 gap-5 overflow-x-auto">
          <button
            onClick={() => setActiveTab("sent")}
            className={`pb-3 text-[12.5px] font-semibold transition-colors relative flex items-center gap-2 whitespace-nowrap tabular-nums ${
              activeTab === "sent"
                ? "text-[#1d1d1f] dark:text-[#f5f5f7]"
                : "text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Facturi emise ({filteredSentInvoices.length})
            {activeTab === "sent" && (
              <span
                className="absolute bottom-0 left-0 w-full h-[2px] rounded-t-full"
                style={{ backgroundColor: "var(--tenant-theme-color, #007aff)" }}
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`pb-3 text-[12.5px] font-semibold transition-colors relative flex items-center gap-2 whitespace-nowrap tabular-nums ${
              activeTab === "products"
                ? "text-[#1d1d1f] dark:text-[#f5f5f7]"
                : "text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Top produse & servicii ({topLines.length})
            {activeTab === "products" && (
              <span
                className="absolute bottom-0 left-0 w-full h-[2px] rounded-t-full"
                style={{ backgroundColor: "var(--tenant-theme-color, #007aff)" }}
              />
            )}
          </button>

          {data.receivedInvoices && data.receivedInvoices.length > 0 && (
            <button
              onClick={() => setActiveTab("received")}
              className={`pb-3 text-[12.5px] font-semibold transition-colors relative flex items-center gap-2 whitespace-nowrap tabular-nums ${
                activeTab === "received"
                  ? "text-[#1d1d1f] dark:text-[#f5f5f7]"
                  : "text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Facturi primite ({filteredReceivedInvoices.length})
              {activeTab === "received" && (
                <span
                  className="absolute bottom-0 left-0 w-full h-[2px] rounded-t-full"
                  style={{ backgroundColor: "var(--tenant-theme-color, #007aff)" }}
                />
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab("firme_api")}
            className={`pb-3 text-[12.5px] font-semibold transition-colors relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === "firme_api"
                ? "text-[#1d1d1f] dark:text-[#f5f5f7]"
                : "text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-[#248a3d] dark:text-[#30d158]" />
            Dosar FirmeAPI & Bilanț
            {firmeApiQuery.data && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold tabular-nums bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158]">
                {firmeApiQuery.data.financials.length > 0
                  ? `${firmeApiQuery.data.financials.length} ani bilanț`
                  : "ONRC"}
              </span>
            )}
            {activeTab === "firme_api" && (
              <span
                className="absolute bottom-0 left-0 w-full h-[2px] rounded-t-full"
                style={{ backgroundColor: "var(--tenant-theme-color, #007aff)" }}
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab("contracts")}
            className={`pb-3 text-[12.5px] font-semibold transition-colors relative flex items-center gap-2 whitespace-nowrap tabular-nums ${
              activeTab === "contracts"
                ? "text-[#1d1d1f] dark:text-[#f5f5f7]"
                : "text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" />
            Contracte & documente ({partnerContracts.length})
            {activeTab === "contracts" && (
              <span
                className="absolute bottom-0 left-0 w-full h-[2px] rounded-t-full"
                style={{ backgroundColor: "var(--tenant-theme-color, #007aff)" }}
              />
            )}
          </button>
        </div>

        {/* Tab 1: Sent Invoices Table */}
        {activeTab === "sent" && (
          <div className="overflow-x-auto">
            {filteredSentInvoices.length > 0 ? (
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                  <tr>
                    <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nr. factură</th>
                    <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Data emiterii</th>
                    <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Scadență</th>
                    <th className="py-3 px-4 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Valoare totală</th>
                    <th className="py-3 px-4 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Status</th>
                    <th className="py-3 px-4 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                  {filteredSentInvoices.map((inv) => {
                    const isPaid = inv.status === "paid";
                    const isSent = inv.status === "sent";
                    const isStorno = inv.status === "storno";
                    const isOverdue = inv.status === "overdue";

                    const badgeClass = isPaid
                      ? "bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158]"
                      : isSent
                      ? "bg-[#007aff]/10 text-[#007aff] dark:text-[#0a84ff]"
                      : isStorno
                      ? "bg-[#ff3b30]/12 text-[#ff3b30] dark:text-[#ff453a]"
                      : isOverdue
                      ? "bg-amber-500/12 text-amber-700 dark:text-amber-400"
                      : "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]";

                    const label = isPaid
                      ? "Încasată"
                      : isSent
                      ? "Trimisă"
                      : isStorno
                      ? "Stornată"
                      : isOverdue
                      ? "Restantă"
                      : inv.status || "Emisă";

                    const viewUrl =
                      inv.type === "reinvoice"
                        ? `/re-facturi/${inv.id}`
                        : inv.type === "archive"
                        ? `/api/pdf/archive/${inv.id}`
                        : `/api/pdf/emitted/${inv.id}`;

                    return (
                      <tr
                        key={`${inv.type}-${inv.id}`}
                        className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums"
                          >
                            {inv.number}
                            <ExternalLink className="w-3 h-3 text-[#8e8e93]" />
                          </a>
                        </td>
                        <td className="py-3 px-4 tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                          {inv.issueDate || "—"}
                        </td>
                        <td className="py-3 px-4 tabular-nums text-[#8e8e93]">
                          {inv.dueDate || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {parseFloat(inv.total || "0").toLocaleString("ro-RO", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-[11px] text-[#8e8e93] font-medium">{inv.currency}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeClass}`}>
                            {label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="apple-btn-glass inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-[11.5px]"
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
              <div className="py-12 text-center text-[#8e8e93] text-[13px]">
                Nu există facturi emise în perioada selectată.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Top Products / Services */}
        {activeTab === "products" && (
          <div>
            {topLines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                    <tr>
                      <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nr.</th>
                      <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Denumire produs / serviciu</th>
                      <th className="py-3 px-4 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Cantitate</th>
                      <th className="py-3 px-4 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Valoare totală</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {topLines.map((line: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors">
                        <td className="py-3 px-4 text-[#8e8e93] font-medium tabular-nums">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {line.description}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d] font-medium">
                          {line.quantity}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {parseFloat(line.total || "0").toLocaleString("ro-RO", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-[11px] text-[#8e8e93]">{kpis.currency}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-[#8e8e93] text-[13px]">
                Nu există linii de produse detaliate înregistrate pentru acest partener.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Received Invoices */}
        {activeTab === "received" && (
          <div className="overflow-x-auto">
            {filteredReceivedInvoices.length > 0 ? (
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                  <tr>
                    <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Nr. factură</th>
                    <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Data emiterii</th>
                    <th className="py-3 px-4 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Valoare totală</th>
                    <th className="py-3 px-4 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Status</th>
                    <th className="py-3 px-4 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                  {filteredReceivedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors">
                      <td className="py-3 px-4 text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                        {inv.invoiceNumber || inv.number || `#${inv.id}`}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-[#6e6e73] dark:text-[#98989d]">{inv.issueDate || "—"}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {parseFloat(inv.total || "0").toLocaleString("ro-RO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-[11px] text-[#8e8e93]">{inv.currency}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]">
                          {inv.status || "Procesat"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <a
                          href={`/api/pdf/archive/${inv.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="apple-btn-glass inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-[11.5px]"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-[#8e8e93] text-[13px]">
                Nicio factură primită în perioada selectată.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: FirmeAPI Dossier & Bilant */}
        {activeTab === "firme_api" && (
          <div className="p-4 sm:p-6 space-y-6">
            {!cleanCui ? (
              <div className="py-12 px-4 text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                  CUI / CIF lipsă
                </h3>
                <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-1">
                  Acest partener nu are completat un cod fiscal (CUI) valid. Adaugă CUI-ul în profilul partenerului pentru a accesa dosarul complet FirmeAPI și bilanțul oficial.
                </p>
                <button
                  onClick={handleOpenEdit}
                  className="apple-btn-prominent mt-4 inline-flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-semibold rounded-full text-white"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Completează CUI
                </button>
              </div>
            ) : firmeApiQuery.isLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#8e8e93] mx-auto mb-3" />
                <h3 className="font-semibold text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Se interoghează baza de date FirmeAPI.ro & Registrul Comerțului...
                </h3>
                <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-1 max-w-sm mx-auto">
                  Se descarcă bilanțul multianual, asociații din Registrul Comerțului, codurile CAEN și istoricul din Monitorul Oficial.
                </p>
              </div>
            ) : !firmeApiQuery.data?.general ? (
              <div className="py-12 px-4 text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Firma nu a fost găsită în baza FirmeAPI
                </h3>
                <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-1">
                  Nu s-au găsit înregistrări oficiale pentru CUI: <span className="tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{cleanCui}</span>. Verifică dacă codul fiscal este corect.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={handleRefreshFirmeApi}
                    className="apple-btn-prominent inline-flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-semibold rounded-full text-white"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reîncearcă interogarea
                  </button>
                  <button
                    onClick={handleOpenEdit}
                    className="apple-btn-glass inline-flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-semibold rounded-full text-[#1d1d1f] dark:text-[#f5f5f7]"
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
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.05] dark:border-white/[0.07] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[11.5px] font-semibold text-[#248a3d] dark:text-[#30d158] flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Date oficiale ONRC & ANAF
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158]">
                            FirmeAPI.ro Intelligence
                          </span>
                          {dossier.cachedAt && (
                            <span className="text-[11px] text-[#8e8e93] tabular-nums">
                              Actualizat: {new Date(dossier.cachedAt).toLocaleDateString("ro-RO")}
                            </span>
                          )}
                        </div>
                        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                          {g?.denumire}
                        </h2>
                        <div className="mt-1 text-[12.5px] text-[#6e6e73] dark:text-[#98989d] flex items-center gap-4 flex-wrap">
                          <span>
                            CUI: <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">{g?.cui}</strong>
                          </span>
                          <span>
                            Reg. Com: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{g?.nr_reg_com || "—"}</strong>
                          </span>
                          <span>
                            Formă: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{g?.forma_juridica || "SRL"}</strong>
                          </span>
                          {g?.data_inregistrare && (
                            <span className="tabular-nums">
                              Înființat: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{g.data_inregistrare}</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleRefreshFirmeApi}
                          disabled={forceRefreshing}
                          className="apple-btn-glass inline-flex items-center gap-1.5 h-9 px-3.5 text-[12.5px] font-semibold rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${forceRefreshing ? "animate-spin" : ""}`} />
                          Actualizează Dosar
                        </button>

                        <button
                          onClick={() => syncMutation.mutate({ clientId: id, cui: cleanCui })}
                          disabled={syncMutation.isPending}
                          className="apple-btn-prominent inline-flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-semibold rounded-full text-white disabled:opacity-50"
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {/* Sediu Social */}
                      <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                        <div className="text-[#6e6e73] dark:text-[#98989d] font-medium text-[12px] mb-1.5 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> Sediu social oficial
                        </div>
                        <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13px] leading-relaxed">
                          {g?.adresa || g?.adresa_sediu_social?.strada || "Adresă indisponibilă"}
                        </div>
                        <div className="mt-1 text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                          {g?.adresa_sediu_social?.localitate ? `${g.adresa_sediu_social.localitate}, ` : ""}
                          {g?.adresa_sediu_social?.judet || ""}
                        </div>
                      </div>

                      {/* Regim TVA & e-Factura */}
                      <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                        <div className="text-[#6e6e73] dark:text-[#98989d] font-medium text-[12px] mb-1.5 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" /> Regim fiscal & TVA
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${
                              g?.tva?.platitor
                                ? "bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158]"
                                : "bg-black/[0.05] dark:bg-white/[0.08] text-[#6e6e73] dark:text-[#98989d]"
                            }`}
                          >
                            {g?.tva?.platitor ? "Plătitor de TVA" : "Neplătitor de TVA"}
                          </span>
                          {g?.tva_incasare?.activ && (
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#007aff]/10 text-[#007aff] dark:text-[#0a84ff]">
                              TVA la Încasare
                            </span>
                          )}
                          {g?.split_tva?.activ && (
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-500/12 text-amber-700 dark:text-amber-400">
                              Split TVA
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-[11.5px] text-[#6e6e73] dark:text-[#98989d] flex items-center gap-1">
                          <span>RO e-Factura:</span>
                          <strong className={g?.e_factura ? "text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold" : "text-[#8e8e93]"}>
                            {g?.e_factura ? "Înrolat în registru" : "Neînrolat"}
                          </strong>
                        </div>
                      </div>

                      {/* Stare Firmă & Inactivitate ANAF */}
                      <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                        <div className="text-[#6e6e73] dark:text-[#98989d] font-medium text-[12px] mb-1.5 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" /> Stare companie & ANAF
                        </div>
                        <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13px]">
                          {g?.stare || "Înregistrat"}
                        </div>
                        <div className="mt-1.5 text-[11.5px]">
                          {g?.status_inactiv?.inactiv ? (
                            <span className="text-[#ff3b30] dark:text-[#ff453a] font-semibold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Declarată inactivă de ANAF
                            </span>
                          ) : (
                            <span className="text-[#248a3d] dark:text-[#30d158] font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Activă fiscal (fără inactivitate)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Organ Fiscal Competent */}
                      <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                        <div className="text-[#6e6e73] dark:text-[#98989d] font-medium text-[12px] mb-1.5 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" /> Organ fiscal & proprietate
                        </div>
                        <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13px] truncate" title={g?.organ_fiscal || "—"}>
                          {g?.organ_fiscal || "ANAF"}
                        </div>
                        <div className="mt-1 text-[11.5px] text-[#6e6e73] dark:text-[#98989d] truncate" title={g?.forma_de_proprietate || "—"}>
                          {g?.forma_de_proprietate || "Capital Privat"}
                        </div>
                      </div>
                    </div>

                    {/* Section 1: Financial Evolution & Balance Sheets (Bilanț Multianual) */}
                    <div className="rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.05] dark:border-white/[0.07] pb-4">
                        <div>
                          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-[#248a3d] dark:text-[#30d158]" />
                            Performanță financiară & bilanțuri oficiale
                          </h3>
                          <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
                            Situații financiare anuale depuse la Ministerul Finanțelor Publice ({fin.length} ani raportați)
                          </p>
                        </div>
                        {latestFin && (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-[11.5px] font-semibold tabular-nums bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158]">
                              Ultimul bilanț: {latestFin.an}
                            </span>
                          </div>
                        )}
                      </div>

                      {latestFin ? (
                        <>
                          {/* Latest Year Highlight KPI Cards */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                            {/* Cifră Afaceri Netă */}
                            <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                              <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                                Cifră de afaceri netă ({latestFin.an})
                              </span>
                              <div className="mt-1.5 text-[20px] sm:text-[22px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                                {latestFin.cifraAfaceri.toLocaleString("ro-RO")}{" "}
                                <span className="text-[11.5px] font-semibold text-[#8e8e93]">RON</span>
                              </div>
                              <span className="text-[11px] text-[#8e8e93] mt-1 block tabular-nums">
                                Venituri: {latestFin.venituriTotale.toLocaleString("ro-RO")} RON
                              </span>
                            </div>

                            {/* Rezultat Net (Profit / Pierdere) */}
                            <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                              <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                                Rezultat net ({latestFin.an})
                              </span>
                              {latestFin.profitNet > 0 ? (
                                <div className="mt-1.5 text-[20px] sm:text-[22px] font-bold tabular-nums text-[#248a3d] dark:text-[#30d158]">
                                  +{latestFin.profitNet.toLocaleString("ro-RO")}{" "}
                                  <span className="text-[11.5px] font-semibold opacity-75">RON</span>
                                </div>
                              ) : latestFin.pierdereNeta > 0 ? (
                                <div className="mt-1.5 text-[20px] sm:text-[22px] font-bold tabular-nums text-[#ff3b30] dark:text-[#ff453a]">
                                  -{latestFin.pierdereNeta.toLocaleString("ro-RO")}{" "}
                                  <span className="text-[11.5px] font-semibold opacity-75">RON</span>
                                </div>
                              ) : (
                                <div className="mt-1.5 text-[20px] sm:text-[22px] font-bold tabular-nums text-[#8e8e93]">
                                  0 <span className="text-[11.5px] font-semibold">RON</span>
                                </div>
                              )}
                              <span className="text-[11px] text-[#8e8e93] mt-1 block">
                                {latestFin.profitNet > 0 ? "Profit net raportat" : latestFin.pierdereNeta > 0 ? "Pierdere netă raportată" : "Echilibru"}
                              </span>
                            </div>

                            {/* Număr Mediu Salariați */}
                            <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                              <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                                Număr mediu salariați
                              </span>
                              <div className="mt-1.5 text-[20px] sm:text-[22px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                                <Users className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                                {latestFin.angajati}{" "}
                                <span className="text-[11.5px] font-semibold text-[#8e8e93]">
                                  {latestFin.angajati === 1 ? "salariat" : "salariați"}
                                </span>
                              </div>
                              <span className="text-[11px] text-[#8e8e93] mt-1 block">
                                Conform declarației 100/101
                              </span>
                            </div>

                            {/* Datorii Totale */}
                            <div className="p-4 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                              <span className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] block">
                                Datorii totale
                              </span>
                              <div className="mt-1.5 text-[20px] sm:text-[22px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                                {latestFin.datorii.toLocaleString("ro-RO")}{" "}
                                <span className="text-[11.5px] font-semibold text-[#8e8e93]">RON</span>
                              </div>
                              <span className="text-[11px] text-[#8e8e93] mt-1 block tabular-nums">
                                Creanțe: {latestFin.creante.toLocaleString("ro-RO")} RON
                              </span>
                            </div>
                          </div>

                          {/* Multi-Year Chart (Cifră Afaceri vs Venituri vs Profit/Pierdere) */}
                          {finChartData.length > 1 && (
                            <div>
                              <h4 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-3 flex items-center gap-1.5 tabular-nums">
                                <TrendingUp className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                                Evoluție financiară multianuală (bilanțuri {finChartData[0]?.an} – {finChartData[finChartData.length - 1]?.an})
                              </h4>
                              <div className="h-[260px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={finChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(142, 142, 147, 0.18)" />
                                    <XAxis dataKey="an" tick={{ fontSize: 11 }} stroke="#8e8e93" />
                                    <YAxis
                                      tick={{ fontSize: 11 }}
                                      stroke="#8e8e93"
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
                                            <div className="apple-surface text-[#1d1d1f] dark:text-[#f5f5f7] text-xs p-3 shadow-xl space-y-1.5">
                                              <div className="font-semibold text-[13px] border-b border-black/[0.06] dark:border-white/[0.08] pb-1 tabular-nums">
                                                Anul {label}
                                              </div>
                                              {payload.map((p: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between gap-4">
                                                  <span className="flex items-center gap-1.5 text-[#6e6e73] dark:text-[#98989d]">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                                    {p.name}:
                                                  </span>
                                                  <span className="font-semibold tabular-nums">
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
                            <h4 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2.5 flex items-center gap-1.5">
                              <FileSpreadsheet className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                              Tabel comparativ bilanț pe toți anii raportați
                            </h4>
                            <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
                              <table className="w-full text-left text-[12.5px] whitespace-nowrap">
                                <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                                  <tr>
                                    <th className="py-2.5 px-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">An</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Cifră afaceri</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Venituri totale</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Cheltuieli</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Profit net</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Pierdere netă</th>
                                    <th className="py-2.5 px-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Salariați</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Active imob.</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Creanțe</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Casa & bănci</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Datorii totale</th>
                                    <th className="py-2.5 px-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Capitaluri proprii</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                                  {fin.map((item) => (
                                    <tr key={item.an} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] tabular-nums">
                                      <td className="py-2.5 px-3">
                                        <span className="font-semibold px-2 py-0.5 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]">
                                          {item.an}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                        {item.cifraAfaceri.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-[#1d1d1f] dark:text-[#f5f5f7]">
                                        {item.venituriTotale.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-[#6e6e73] dark:text-[#98989d]">
                                        {item.cheltuieliTotale.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-[#248a3d] dark:text-[#30d158]">
                                        {item.profitNet > 0 ? item.profitNet.toLocaleString("ro-RO") : "—"}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-semibold text-[#ff3b30] dark:text-[#ff453a]">
                                        {item.pierdereNeta > 0 ? item.pierdereNeta.toLocaleString("ro-RO") : "—"}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                        {item.angajati}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-[#6e6e73] dark:text-[#98989d]">
                                        {item.activeImobilizate.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-[#6e6e73] dark:text-[#98989d]">
                                        {item.creante.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">
                                        {item.casaSiConturi.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                                        {item.datorii.toLocaleString("ro-RO")}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-medium text-[#6e6e73] dark:text-[#98989d]">
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
                        <div className="py-6 text-center text-[12.5px] text-[#8e8e93]">
                          Nu au fost găsite date de bilanț raportate la ANAF pentru acest CUI.
                        </div>
                      )}
                    </div>

                    {/* Section 2: Acționari & Asociați (Holdings) & Conducere */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Acționari & Asociați */}
                      <div className="rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
                        <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.07] pb-3">
                          <h3 className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2 tabular-nums">
                            <Users className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                            Acționari & asociați oficiali ({holdings.length})
                          </h3>
                          <span className="text-[11.5px] text-[#8e8e93] font-medium">ONRC Data</span>
                        </div>

                        {holdings.length > 0 ? (
                          <div className="space-y-3">
                            {holdings.map((h, idx) => (
                              <div
                                key={idx}
                                className={`p-3.5 rounded-2xl border transition-all ${
                                  h.current
                                    ? "bg-[#f2f2f7] dark:bg-[#2c2c2e] border-black/[0.05] dark:border-white/[0.08]"
                                    : "bg-[#f2f2f7]/60 dark:bg-[#2c2c2e]/50 border-black/[0.03] dark:border-white/[0.04] opacity-70"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13px] flex items-center gap-1.5">
                                      {h.name}
                                      {h.current ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158]">
                                          Activ
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/[0.06] dark:bg-white/[0.08] text-[#6e6e73] dark:text-[#98989d]">
                                          Istoric
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                                      {h.type} {h.entity ? `(${h.entity})` : ""}
                                    </div>
                                  </div>

                                  <div className="text-right tabular-nums">
                                    <span className="text-[14px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                      {h.percent}%
                                    </span>
                                    <div className="text-[10.5px] text-[#8e8e93]">
                                      {h.from} {h.to ? `→ ${h.to}` : "→ Prezent"}
                                    </div>
                                  </div>
                                </div>

                                {/* Visual Progress Bar */}
                                <div className="w-full bg-black/[0.08] dark:bg-white/[0.1] h-1.5 rounded-full mt-2.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      h.current ? "bg-[#34c759]" : "bg-[#8e8e93]"
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, h.percent))}%` }}
                                  />
                                </div>

                                {h.placeofbirth && (
                                  <div className="mt-1.5 text-[11px] text-[#8e8e93]">
                                    Loc naștere: {h.placeofbirth}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-[12.5px] text-[#8e8e93]">
                            Nu există date detaliate despre acționari.
                          </div>
                        )}
                      </div>

                      {/* Administratori & Conducere */}
                      <div className="rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
                        <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.07] pb-3">
                          <h3 className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2 tabular-nums">
                            <Briefcase className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                            Administratori & conducere ({admins.length})
                          </h3>
                          <span className="text-[11.5px] text-[#8e8e93] font-medium">Registrul Comerțului</span>
                        </div>

                        {admins.length > 0 ? (
                          <div className="space-y-3">
                            {admins.map((adm, idx) => (
                              <div
                                key={idx}
                                className="p-3.5 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-3"
                              >
                                <div>
                                  <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13px] flex items-center gap-1.5">
                                    {adm.nume}
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#007aff]/10 text-[#007aff] dark:text-[#0a84ff]">
                                      {adm.stare || "Activ"}
                                    </span>
                                  </div>
                                  <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                                    Calitate: <strong className="capitalize text-[#1d1d1f] dark:text-[#f5f5f7]">{adm.calitate || "Administrator"}</strong>
                                    {adm.tip ? ` • ${adm.tip}` : ""}
                                  </div>
                                  {adm.loc_nastere && (
                                    <div className="text-[11px] text-[#8e8e93] mt-0.5">
                                      Loc naștere: {adm.loc_nastere}
                                    </div>
                                  )}
                                </div>

                                {adm.data && (
                                  <div className="text-right text-[11.5px] tabular-nums">
                                    <span className="text-[#8e8e93] block text-[10.5px]">Data numirii</span>
                                    <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                      {adm.data}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center text-[12.5px] text-[#8e8e93]">
                            Nu sunt înregistrați administratori oficiali distincți.
                          </div>
                        )}

                        {/* Clasificare & Coduri CAEN */}
                        <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.07]">
                          <h4 className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2 flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                            Activitate principală (CAEN Rev. 2)
                          </h4>

                          {caen?.caen_principal ? (
                            <div className="p-3 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06]">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 tabular-nums">
                                  {caen.caen_principal.cod}
                                </span>
                                <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px]">
                                  {caen.caen_principal.denumire}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[12.5px] text-[#8e8e93]">CAEN principal nespecificat.</div>
                          )}

                          {caen?.caen_secundare && caen.caen_secundare.length > 0 && (
                            <div className="mt-3">
                              <span className="text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d] block mb-1.5 tabular-nums">
                                Activități secundare autorizate ({caen.caen_secundare.length}):
                              </span>
                              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                {caen.caen_secundare.map((cs, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] border border-black/[0.04] dark:border-white/[0.06]"
                                    title={cs.denumire}
                                  >
                                    <strong className="tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] mr-1">{cs.cod}</strong>
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
                    <div className="rounded-2xl p-5 border border-black/[0.06] dark:border-white/[0.08] space-y-4">
                      <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.07] pb-3">
                        <div>
                          <h3 className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2 tabular-nums">
                            <BookOpen className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                            Monitorul Oficial — Istoric mențiuni & rezoluții ONRC ({mof.length})
                          </h3>
                          <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                            Publicații în Monitorul Oficial al României, Partea a IV-a
                          </p>
                        </div>
                        <span className="text-[11.5px] font-medium text-[#8e8e93]">Partea IV</span>
                      </div>

                      {mof.length > 0 ? (
                        <div className="space-y-2.5">
                          {mof.map((entry, idx) => {
                            const isExpanded = expandedMofIndex === idx;
                            return (
                              <div
                                key={idx}
                                className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-[#f2f2f7] dark:bg-[#2c2c2e] overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => setExpandedMofIndex(isExpanded ? null : idx)}
                                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/[0.06] dark:border-white/[0.08] tabular-nums">
                                      Nr. {entry.numar}
                                    </span>
                                    <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                      {entry.titlu_publicatie || "Notificare Monitorul Oficial"}
                                    </span>
                                    <span className="text-[11.5px] text-[#8e8e93] font-medium tabular-nums">
                                      {entry.data}
                                    </span>
                                  </div>

                                  <div className="text-[#8e8e93]">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </div>
                                </button>

                                {isExpanded && entry.continut && (
                                  <div className="p-4 bg-white dark:bg-[#1c1c1e] border-t border-black/[0.06] dark:border-white/[0.08] text-[12.5px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed space-y-2">
                                    {String(entry.continut || "")
                                      .replace(/<br\s*\/?>/gi, "\n")
                                      .replace(/<\/p>/gi, "\n\n")
                                      .replace(/<[^>]+>/g, "")
                                      .replace(/&nbsp;/gi, " ")
                                      .replace(/&amp;/gi, "&")
                                      .replace(/&lt;/gi, "<")
                                      .replace(/&gt;/gi, ">")
                                      .replace(/&quot;/gi, '"')
                                      .replace(/&#39;/gi, "'")
                                      .split(/\n+/)
                                      .map(p => p.trim())
                                      .filter(Boolean)
                                      .map((para, pIdx) => (
                                        <p key={pIdx}>
                                          {para.split(/(\*\*[^*]+\*\*)/g).map((chunk, cIdx) =>
                                            chunk.startsWith("**") && chunk.endsWith("**") ? (
                                              <strong key={cIdx} className="text-[#1d1d1f] dark:text-[#f5f5f7]">{chunk.slice(2, -2)}</strong>
                                            ) : (
                                              chunk
                                            )
                                          )}
                                        </p>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-[12.5px] text-[#8e8e93]">
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

        {/* Tab 5: Contracte & Acte Adiționale ale Partenerului */}
        {activeTab === "contracts" && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.05] dark:border-white/[0.07] pb-4">
              <div>
                <h3 className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                  Contracte și acte adiționale — {data?.client?.name}
                </h3>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                  Documente semnate, arhivate sau generate digital pentru acest partener.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/contracte/new?partnerId=${id}&mode=upload`}
                  className="apple-btn-glass inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Încarcă Contract Semnat (PDF)
                </Link>

                <Link
                  href={`/contracte/new?partnerId=${id}&mode=generate`}
                  className="apple-btn-prominent inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12.5px] font-semibold text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Generează Document Nou
                </Link>
              </div>
            </div>

            {loadingContracts ? (
              <div className="py-12 flex flex-col items-center justify-center text-[#8e8e93] text-[13px]">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                Se încarcă contractele...
              </div>
            ) : partnerContracts.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-dashed border-black/[0.1] dark:border-white/[0.12] bg-[#f2f2f7]/60 dark:bg-[#2c2c2e]/50 p-6">
                <FileSignature className="w-10 h-10 text-[#8e8e93] mx-auto mb-2 opacity-60" />
                <h4 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Niciun contract înregistrat pentru acest partener
                </h4>
                <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] max-w-sm mx-auto mt-1 mb-4">
                  Puteți încărca un contract semnat deja (PDF/scanare) sau puteți genera unul nou direct din sistem.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Link
                    href={`/contracte/new?partnerId=${id}&mode=upload`}
                    className="apple-btn-prominent inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-white font-semibold text-[12.5px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Încarcă Primul Contract Semnat
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                    <tr>
                      <th className="py-3 px-3.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Număr document</th>
                      <th className="py-3 px-3.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Tip</th>
                      <th className="py-3 px-3.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Dată încheiere</th>
                      <th className="py-3 px-3.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Valabilitate</th>
                      <th className="py-3 px-3.5 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Valoare</th>
                      <th className="py-3 px-3.5 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Status</th>
                      <th className="py-3 px-3.5 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Fișier</th>
                      <th className="py-3 px-3.5 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {partnerContracts.map((ctr: any) => (
                      <tr key={ctr.id} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors">
                        <td className="py-3 px-3.5">
                          <Link
                            href={`/contracte/${ctr.id}`}
                            className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums"
                          >
                            {ctr.number}
                          </Link>
                          {ctr.parentContractId && (
                            <div className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">
                              Act adițional
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          {ctr.type === "act_aditional" ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]">
                              Act Adițional
                            </span>
                          ) : ctr.type === "pv_receptie" ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158]">
                              Proces Verbal
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#007aff]/10 text-[#007aff] dark:text-[#0a84ff]">
                              Contract Cadru
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                          {ctr.date}
                        </td>
                        <td className="py-3 px-3.5 tabular-nums text-[#8e8e93] text-[12px]">
                          {ctr.validUntil ? `Până la ${ctr.validUntil}` : "Nedeterminată"}
                        </td>
                        <td className="py-3 px-3.5 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {parseFloat(ctr.value || 0).toLocaleString("ro-RO", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          <span className="text-[11px] font-medium text-[#8e8e93]">
                            {ctr.currency || "RON"}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {ctr.status === "activ" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#34c759]/12 text-[#248a3d] dark:text-[#30d158]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
                              Activ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]">
                              {ctr.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {ctr.fileUrl ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] tabular-nums bg-[#007aff]/10 text-[#007aff] dark:text-[#0a84ff]">
                              PDF Fizic
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] tabular-nums bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]">
                              Digital
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/contracte/${ctr.id}`}
                              className="w-8 h-8 rounded-full apple-btn-glass inline-flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
                              title="Vezi Document PDF"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            <a
                              href={`/api/pdf/contract/${ctr.id}?download=1`}
                              className="w-8 h-8 rounded-full apple-btn-glass inline-flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
                              title="Descarcă PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>

                            <Link
                              href={`/contracte/new?partnerId=${id}&parentContractId=${ctr.id}&type=act_aditional`}
                              className="w-8 h-8 rounded-full apple-btn-glass inline-flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
                              title="Adaugă Act Adițional la acest Contract"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Trend Area Chart */}
        <div className="lg:col-span-2 apple-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                Evoluție facturare lunară
              </h3>
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">Volumul vânzărilor către acest partener pe luni</p>
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="clientBillingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--tenant-theme-color, #007aff)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--tenant-theme-color, #007aff)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(142, 142, 147, 0.18)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#8e8e93" }}
                  axisLine={{ stroke: "rgba(142, 142, 147, 0.2)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#8e8e93" }}
                  axisLine={{ stroke: "rgba(142, 142, 147, 0.2)" }}
                  tickLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload;
                      return (
                        <div className="apple-surface text-[#1d1d1f] dark:text-[#f5f5f7] text-xs p-3 shadow-xl">
                          <div className="font-medium text-[#6e6e73] dark:text-[#98989d]">{dataPoint.month}</div>
                          <div className="text-[14px] font-bold tabular-nums mt-0.5">
                            {Number(dataPoint.total).toLocaleString("ro-RO", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            {kpis.currency}
                          </div>
                          <div className="text-[11px] text-[#8e8e93] mt-0.5 tabular-nums">{dataPoint.count} facturi</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--tenant-theme-color, #007aff)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#clientBillingGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Donut Chart */}
        <div className="apple-surface p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#248a3d] dark:text-[#30d158]" />
              Status încasare
            </h3>
            <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">Rata de colectare a creanțelor</p>
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
                          <div className="apple-surface text-[#1d1d1f] dark:text-[#f5f5f7] text-xs px-3 py-2 shadow-xl">
                            <span className="text-[#6e6e73] dark:text-[#98989d]">{item.name}: </span>
                            <span className="font-semibold tabular-nums">
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
              <div className="h-full flex items-center justify-center text-[12.5px] text-[#8e8e93]">
                Fără date de plată în perioada selectată
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-black/[0.05] dark:border-white/[0.07] text-[12px]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34c759] shrink-0" />
              <span className="text-[#6e6e73] dark:text-[#98989d] truncate">Încasat:</span>
              <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] ml-auto">
                {kpis.totalInvoiced > 0
                  ? Math.round((kpis.totalCollected / kpis.totalInvoiced) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#007aff] shrink-0" />
              <span className="text-[#6e6e73] dark:text-[#98989d] truncate">Rest:</span>
              <span className="font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] ml-auto">
                {kpis.totalInvoiced > 0
                  ? Math.round((kpis.totalPending / kpis.totalInvoiced) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Client Profile Modal (In-App UI modal without browser alerts) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overscroll-contain animate-in fade-in duration-200">
          <div className="apple-surface rounded-[22px] max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto overscroll-contain">
            <button
              onClick={() => setIsEditModalOpen(false)}
              aria-label="Închide"
              className="apple-btn-glass absolute top-4 right-4 w-8 h-8 rounded-full inline-flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2 mb-4">
              <Edit3 className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
              Editează profil partener
            </h2>

            <form onSubmit={handleSaveClient} className="space-y-3.5 text-[13px]">
              <div>
                <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">
                  Denumire companie *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">CUI / CIF</label>
                  <input
                    type="text"
                    value={editFormData.cui}
                    onChange={(e) => setEditFormData({ ...editFormData, cui: e.target.value })}
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Nr. Reg. Com.</label>
                  <input
                    type="text"
                    value={editFormData.regCom}
                    onChange={(e) => setEditFormData({ ...editFormData, regCom: e.target.value })}
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Adresă sediu</label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Oraș</label>
                  <input
                    type="text"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Țară</label>
                  <input
                    type="text"
                    value={editFormData.country}
                    onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">Telefon</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="apple-input w-full h-10 px-3.5 text-[16px] sm:text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="apple-btn-glass h-9 px-4 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={updateClientMutation.isPending}
                  className="apple-btn-prominent inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-50"
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
