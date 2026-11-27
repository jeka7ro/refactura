import { useState, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import {
  FileText,
  FileOutput,
  Calendar,
  Search,
  AlertCircle,
  FileSpreadsheet,
  Package,
  Building2,
  Lock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  Coins,
  Receipt,
  Percent,
  RefreshCw,
  FileCode,
  ClipboardCheck,
  Layers,
  Landmark,
  Download,
  Eye,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import AccountantPinLock from "@/components/AccountantPinLock";
import DocumentModalPreview from "@/components/DocumentModalPreview";
import SagaClassicPortalView from "@/components/SagaClassicPortalView";
import { encodeWindows1250Blob } from "@/lib/fileSave";
import {
  groupStatementsByMonth,
  formatStatementMonthLabel,
  formatStatementPeriodLabel,
} from "@/lib/statementMonthGroups";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatCurrency(amount: number, currency: string = "RON"): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: currency || "RON",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function AccountantPortal() {
  const [, params] = useRoute("/portal-contabil/:token");
  const [, altParams] = useRoute("/contabil/:token");
  const token = params?.token || altParams?.token || "";

  const storageKey = `smart_invoice_accountant_session_${token}`;
  const [sessionToken, setSessionToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem(storageKey) || "";
    } catch {
      return "";
    }
  });

  // Re-hidratare automată a token-ului de sesiune dacă router-ul a montat componenta
  useEffect(() => {
    if (token && !sessionToken && typeof window !== "undefined") {
      try {
        const stored =
          sessionStorage.getItem(`smart_invoice_accountant_session_${token}`) ||
          sessionStorage.getItem("smart_invoice_accountant_session") ||
          "";
        if (stored) {
          setSessionToken(stored);
        }
      } catch {}
    }
  }, [token, sessionToken]);

  // Navigare Sidebar: "received" (Facturi Primite), "emitted" (Facturi Emise) sau "statements" (Extrase de Cont)
  const [activeTab, setActiveTab] = useState<"received" | "emitted" | "statements">("received");
  const [searchStatements, setSearchStatements] = useState("");
  const [statementMonthFilter, setStatementMonthFilter] = useState("all");
  const [statementCurrencyFilter, setStatementCurrencyFilter] = useState("all");
  const [collapsedStatementMonths, setCollapsedStatementMonths] = useState<Record<string, boolean>>({});

  // Suprascriere manuală temporară pe sesiunea curentă (altfel se folosește modul setat în Setări -> Portal Contabil)
  const [manualViewOverride, setManualViewOverride] = useState<"modern" | "saga" | null>(null);

  const [copiedCui, setCopiedCui] = useState<string | null>(null);

  // Stare Modal Previzualizare PDF (în aceeași fereastră, fără alt tab)
  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    title: string;
    pdfUrl: string | null;
    filename?: string;
    type?: "invoice" | "nir" | "emitted";
  }>({
    isOpen: false,
    title: "",
    pdfUrl: null,
    type: "invoice",
  });

  // Filtre Facturi Primite
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<
    "current_month" | "last_month" | "last_3_months" | "current_year" | "all" | "custom"
  >("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [nirFilter, setNirFilter] = useState<"all" | "cu_nir" | "fara_nir">("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  // Filtre Facturi Emise
  const [searchEmitted, setSearchEmitted] = useState("");
  const [periodEmitted, setPeriodEmitted] = useState<
    "current_month" | "last_month" | "last_3_months" | "current_year" | "all" | "custom"
  >("all");
  const [customStartDateEmitted, setCustomStartDateEmitted] = useState("");
  const [customEndDateEmitted, setCustomEndDateEmitted] = useState("");

  // Paginare & Selecție
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Stare descărcare ZIP / XML
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<string>("");

  // Preluare informații publice ale portalului
  const {
    data: publicInfo,
    isLoading: isLoadingPublic,
  } = trpc.accountantPortal.getPublicInfo.useQuery(
    { token },
    { enabled: Boolean(token), retry: 1 }
  );

  const serverDefaultMode: "modern" | "saga" =
    publicInfo?.defaultViewMode === "modern" ? "modern" : "saga";
  const viewOverrideKey = `smart_invoice_accountant_view_override_${token}_${serverDefaultMode}`;

  useEffect(() => {
    if (!token || !publicInfo?.found) return;
    try {
      const savedOverride = sessionStorage.getItem(viewOverrideKey);
      if (savedOverride === "modern" || savedOverride === "saga") {
        setManualViewOverride(savedOverride);
      } else {
        setManualViewOverride(null);
      }
    } catch {
      setManualViewOverride(null);
    }
  }, [token, publicInfo?.found, viewOverrideKey]);

  const viewMode: "modern" | "saga" = manualViewOverride ?? serverDefaultMode;

  const handleToggleViewMode = () => {
    const next = viewMode === "modern" ? "saga" : "modern";
    setManualViewOverride(next);
    try {
      sessionStorage.setItem(viewOverrideKey, next);
    } catch {}
    toast.success(
      `Ați comutat pe ${next === "saga" ? "Modul SAGA C Clasic" : "Modul Modern"}`
    );
  };

  // Verificare sesiune existentă
  const { data: sessionStatus, isLoading: isCheckingSession } =
    trpc.accountantPortal.validateSession.useQuery(
      { token, sessionToken },
      { enabled: Boolean(token && sessionToken), retry: false }
    );

  const isUnlocked = Boolean(
    publicInfo?.found &&
      (!publicInfo.requiresPin || (sessionToken && sessionStatus?.valid))
  );

  // Dacă portalul nu necesită PIN, setăm automat tokenul de sesiune primit din server
  useEffect(() => {
    if (publicInfo?.found && !publicInfo.requiresPin && publicInfo.autoSessionToken) {
      if (sessionToken !== publicInfo.autoSessionToken) {
        try {
          sessionStorage.setItem(storageKey, publicInfo.autoSessionToken);
          document.cookie = `accountantSession=${encodeURIComponent(publicInfo.autoSessionToken)}; path=/; max-age=604800; SameSite=Lax`;
        } catch {}
        setSessionToken(publicInfo.autoSessionToken);
      }
    }
  }, [publicInfo, sessionToken, storageKey]);

  // Preluare date facturi & NIR
  const {
    data: portalData,
    isLoading: isLoadingData,
    refetch: refetchData,
    isFetching,
  } = trpc.accountantPortal.getData.useQuery(
    {
      token,
      sessionToken,
    },
    {
      enabled: Boolean(token && isUnlocked),
      refetchOnWindowFocus: false,
    }
  );

  const downloadSagaXmlMutation = trpc.accountantPortal.downloadSagaXml.useMutation();

  const getAuthenticatedPdfUrl = (url: string | null) => {
    if (!url) return null;
    let effectiveToken = sessionToken;
    if (!effectiveToken && typeof window !== "undefined") {
      try {
        effectiveToken =
          sessionStorage.getItem(storageKey) ||
          sessionStorage.getItem(`smart_invoice_accountant_session_${token}`) ||
          "";
        if (!effectiveToken) {
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && k.startsWith("smart_invoice_accountant_session")) {
              const v = sessionStorage.getItem(k);
              if (v) {
                effectiveToken = v;
                break;
              }
            }
          }
        }
      } catch {}
    }
    if (!effectiveToken && publicInfo && !publicInfo.requiresPin) {
      effectiveToken = publicInfo.autoSessionToken || "";
    }
    const sep = url.includes("?") ? "&" : "?";
    return effectiveToken
      ? `${url}${sep}accountantToken=${encodeURIComponent(effectiveToken)}`
      : url;
  };

  const handleUnlockSuccess = (newToken: string) => {
    try {
      sessionStorage.setItem(storageKey, newToken);
      const secureAttr =
        typeof window !== "undefined" && window.location.protocol === "https:"
          ? "; Secure"
          : "";
      document.cookie = `accountantSession=${encodeURIComponent(newToken)}; path=/; max-age=604800; SameSite=Lax${secureAttr}`;
    } catch {}
    setSessionToken(newToken);
    toast.success("Acces autorizat cu succes!");
  };

  const handleLockPortal = () => {
    try {
      sessionStorage.removeItem(storageKey);
      document.cookie = "accountantSession=; path=/; max-age=0; SameSite=Lax";
    } catch {}
    setSessionToken("");
    setSelectedIds(new Set());
    toast.info("Sesiunea a fost închisă.");
  };

  const handleCopyCui = (cui: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cui.replace(/^RO/i, "").trim());
    setCopiedCui(cui);
    toast.success(`CUI ${cui} copiat în clipboard!`);
    setTimeout(() => setCopiedCui(null), 2000);
  };

  // Calcul interval de date activ pentru filtrare primite
  const activeDateRange = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    if (period === "current_month") {
      const start = new Date(curYear, curMonth, 1);
      const end = new Date(curYear, curMonth + 1, 0, 23, 59, 59);
      return { start, end };
    }
    if (period === "last_month") {
      const start = new Date(curYear, curMonth - 1, 1);
      const end = new Date(curYear, curMonth, 0, 23, 59, 59);
      return { start, end };
    }
    if (period === "last_3_months") {
      const start = new Date(curYear, curMonth - 2, 1);
      const end = new Date(curYear, curMonth + 1, 0, 23, 59, 59);
      return { start, end };
    }
    if (period === "current_year") {
      const start = new Date(curYear, 0, 1);
      const end = new Date(curYear, 11, 31, 23, 59, 59);
      return { start, end };
    }
    if (period === "custom") {
      const start = customStartDate ? new Date(customStartDate) : null;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59`) : null;
      return { start, end };
    }
    return { start: null, end: null };
  }, [period, customStartDate, customEndDate]);

  // Calcul interval de date activ pentru filtrare emise
  const activeEmittedDateRange = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    if (periodEmitted === "current_month") {
      const start = new Date(curYear, curMonth, 1);
      const end = new Date(curYear, curMonth + 1, 0, 23, 59, 59);
      return { start, end };
    }
    if (periodEmitted === "last_month") {
      const start = new Date(curYear, curMonth - 1, 1);
      const end = new Date(curYear, curMonth, 0, 23, 59, 59);
      return { start, end };
    }
    if (periodEmitted === "last_3_months") {
      const start = new Date(curYear, curMonth - 2, 1);
      const end = new Date(curYear, curMonth + 1, 0, 23, 59, 59);
      return { start, end };
    }
    if (periodEmitted === "current_year") {
      const start = new Date(curYear, 0, 1);
      const end = new Date(curYear, 11, 31, 23, 59, 59);
      return { start, end };
    }
    if (periodEmitted === "custom") {
      const start = customStartDateEmitted ? new Date(customStartDateEmitted) : null;
      const end = customEndDateEmitted ? new Date(`${customEndDateEmitted}T23:59:59`) : null;
      return { start, end };
    }
    return { start: null, end: null };
  }, [periodEmitted, customStartDateEmitted, customEndDateEmitted]);

  // Lista completă a furnizorilor din facturile primite
  const allSuppliers = useMemo(() => {
    if (!portalData?.invoices) return [];
    const set = new Set<string>();
    portalData.invoices.forEach(i => {
      if (i.supplierName) set.add(i.supplierName.trim());
    });
    return Array.from(set).sort();
  }, [portalData?.invoices]);

  // Filtrare locală facturi primite
  const filteredInvoices = useMemo(() => {
    if (!portalData?.invoices) return [];
    let list = portalData.invoices;

    if (activeDateRange.start || activeDateRange.end) {
      list = list.filter(inv => {
        if (!inv.issueDate) return false;
        const d = new Date(inv.issueDate);
        if (isNaN(d.getTime())) return true;
        if (activeDateRange.start && d < activeDateRange.start) return false;
        if (activeDateRange.end && d > activeDateRange.end) return false;
        return true;
      });
    }

    if (nirFilter === "cu_nir") {
      list = list.filter(inv => inv.hasNir);
    } else if (nirFilter === "fara_nir") {
      list = list.filter(inv => !inv.hasNir);
    }

    if (supplierFilter !== "all") {
      list = list.filter(inv => inv.supplierName === supplierFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(inv => {
        return (
          inv.supplierName.toLowerCase().includes(q) ||
          inv.supplierCUI.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          (inv.spvIndex && inv.spvIndex.toLowerCase().includes(q)) ||
          (inv.nirNumber && inv.nirNumber.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [portalData?.invoices, activeDateRange, nirFilter, supplierFilter, search]);

  // Filtrare locală facturi emise
  const filteredEmittedInvoices = useMemo(() => {
    if (!portalData?.emittedInvoices) return [];
    let list = portalData.emittedInvoices;

    if (activeEmittedDateRange.start || activeEmittedDateRange.end) {
      list = list.filter(inv => {
        if (!inv.issueDate) return false;
        const d = new Date(inv.issueDate);
        if (isNaN(d.getTime())) return true;
        if (activeEmittedDateRange.start && d < activeEmittedDateRange.start) return false;
        if (activeEmittedDateRange.end && d > activeEmittedDateRange.end) return false;
        return true;
      });
    }

    if (searchEmitted.trim()) {
      const q = searchEmitted.trim().toLowerCase();
      list = list.filter(inv => {
        return (
          inv.clientName.toLowerCase().includes(q) ||
          inv.clientCUI.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          (inv.spvIndex && inv.spvIndex.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [portalData?.emittedInvoices, activeEmittedDateRange, searchEmitted]);

  // Filtrare locală extrase de cont
  const allStatements = portalData?.bankStatements || [];
  const statementMonths = useMemo(() => {
    const s = new Set<string>();
    allStatements.forEach((st: any) => {
      if (st.statementMonth) s.add(st.statementMonth);
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [allStatements]);

  const filteredStatements = useMemo(() => {
    return allStatements.filter((st: any) => {
      if (statementMonthFilter !== "all" && st.statementMonth !== statementMonthFilter) {
        return false;
      }
      if (
        statementCurrencyFilter !== "all" &&
        String(st.currency || "RON").toUpperCase() !== statementCurrencyFilter
      ) {
        return false;
      }
      if (searchStatements.trim()) {
        const q = searchStatements.trim().toLowerCase();
        const hay = `${st.bankName || ""} ${st.iban || ""} ${st.statementNumber || ""} ${st.fileName || ""} ${st.notes || ""} ${st.statementMonth || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allStatements, statementMonthFilter, statementCurrencyFilter, searchStatements]);

  const groupedPortalStatements = useMemo(
    () => groupStatementsByMonth(filteredStatements),
    [filteredStatements]
  );

  // KPI-uri Facturi Primite (convertite în RON la cursul BNR pentru facturile externe în valută)
  const currentKpis = useMemo(() => {
    const totalCount = filteredInvoices.length;
    let totalBase = 0;
    let totalVat = 0;
    let totalGross = 0;
    let withNirCount = 0;
    let withoutNirCount = 0;

    for (const inv of filteredInvoices) {
      totalBase += inv.totalBaseRon ?? inv.totalBase;
      totalVat += inv.totalVatRon ?? inv.totalVAT;
      totalGross += inv.totalRon ?? inv.total;
      if (inv.hasNir) withNirCount++;
      else withoutNirCount++;
    }

    return {
      totalCount,
      totalBase: Math.round(totalBase * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalGross: Math.round(totalGross * 100) / 100,
      withNirCount,
      withoutNirCount,
      nirCoveragePercent:
        totalCount > 0 ? Math.round((withNirCount / totalCount) * 100) : 0,
    };
  }, [filteredInvoices]);

  // KPI-uri Facturi Emise (convertite în RON la cursul BNR pentru facturile în valută)
  const currentEmittedKpis = useMemo(() => {
    const totalCount = filteredEmittedInvoices.length;
    let totalBase = 0;
    let totalVat = 0;
    let totalGross = 0;

    for (const inv of filteredEmittedInvoices) {
      totalBase += inv.totalBaseRon ?? inv.totalBase;
      totalVat += inv.totalVatRon ?? inv.totalVAT;
      totalGross += inv.totalRon ?? inv.total;
    }

    return {
      totalCount,
      totalBase: Math.round(totalBase * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalGross: Math.round(totalGross * 100) / 100,
    };
  }, [filteredEmittedInvoices]);

  // Paginare
  const activeList =
    activeTab === "received"
      ? filteredInvoices
      : activeTab === "emitted"
        ? filteredEmittedInvoices
        : filteredStatements;
  const totalPages = Math.ceil(activeList.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return activeList.slice(start, start + pageSize);
  }, [activeList, safePage, pageSize]);

  // Reset paginare la schimbare tab
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [activeTab]);

  // Gestionare selecție multiplă
  const handleToggleSelectAll = () => {
    if (
      selectedIds.size === filteredInvoices.length &&
      filteredInvoices.length > 0
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const handleToggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Export Excel (.xlsx) Facturi Primite
  const handleExportExcel = () => {
    if (filteredInvoices.length === 0) {
      toast.error("Nu există facturi pentru export.");
      return;
    }

    const itemsToExport =
      selectedIds.size > 0
        ? filteredInvoices.filter(i => selectedIds.has(i.id))
        : filteredInvoices;

    const rows = itemsToExport.map((inv, idx) => ({
      "Nr. Crt.": idx + 1,
      "Dată Factură": formatDate(inv.issueDate),
      "Dată Scadență": formatDate(inv.dueDate),
      "Sursă Document": inv.isExternal ? "Factură Externă / Non-SPV" : "SPV ANAF",
      Furnizor: inv.supplierName,
      "CUI / VAT Furnizor": inv.supplierCUI || "",
      "Număr Factură": inv.invoiceNumber,
      "Valoare Bază (valută)": inv.totalBase,
      "TVA (valută)": inv.totalVAT,
      "Total Factură (valută)": inv.total,
      Monedă: inv.currency,
      "Curs BNR": inv.fxRateToRon || 1,
      "Total Echivalent (RON)": inv.totalRon ?? inv.total,
      "Status NIR": inv.hasNir ? "Generat" : "Fără NIR",
      "Număr NIR": inv.nirNumber || "",
      "Dată NIR": formatDate(inv.nirDate),
      Gestiune: inv.gestiune || "",
      "Index SPV": inv.spvIndex || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 13 },
      { wch: 13 },
      { wch: 24 },
      { wch: 30 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 11 },
      { wch: 18 },
      { wch: 13 },
      { wch: 14 },
      { wch: 13 },
      { wch: 14 },
      { wch: 15 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturi Primite & NIR");

    const companyCui = portalData?.company?.cui
      ? `_${portalData.company.cui}`
      : "";
    const filename = `Facturi_Primite${companyCui}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success(`Fișierul ${filename} a fost exportat cu succes!`);
  };

  // Export Excel (.xlsx) Facturi Emise
  const handleExportEmittedExcel = () => {
    if (filteredEmittedInvoices.length === 0) {
      toast.error("Nu există facturi emise pentru export.");
      return;
    }

    const rows = filteredEmittedInvoices.map((inv, idx) => ({
      "Nr. Crt.": idx + 1,
      "Dată Factură": formatDate(inv.issueDate),
      "Dată Scadență": formatDate(inv.dueDate),
      "Sursă Document": inv.isExternal ? "Extern / Non-SPV" : inv.spvIndex ? "SPV ANAF" : "Emisă Platformă",
      Client: inv.clientName,
      "CUI Client": inv.clientCUI || "",
      "Număr Factură": inv.invoiceNumber,
      "Valoare Bază (valută)": inv.totalBase,
      "TVA (valută)": inv.totalVAT,
      "Total Factură (valută)": inv.total,
      Monedă: inv.currency,
      "Curs BNR": inv.fxRateToRon || 1,
      "Total Echivalent (RON)": inv.totalRon ?? inv.total,
      Stare: inv.status,
      "Index SPV": inv.spvIndex || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 13 },
      { wch: 13 },
      { wch: 20 },
      { wch: 30 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 11 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturi Emise");

    const companyCui = portalData?.company?.cui
      ? `_${portalData.company.cui}`
      : "";
    const filename = `Facturi_Emise${companyCui}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success(`Fișierul ${filename} a fost exportat cu succes!`);
  };

  // Descarcă XML SAGA
  const handleDownloadSagaXml = async (tabOverride?: "received" | "emitted" | unknown) => {
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    let month = curMonth;
    let year = curYear;
    let startDate: string | undefined;
    let endDate: string | undefined;

    const effectiveTab =
      tabOverride === "received" || tabOverride === "emitted"
        ? tabOverride
        : activeTab === "emitted"
          ? "emitted"
          : "received";
    const activePeriod = effectiveTab === "emitted" ? periodEmitted : period;
    const activeCustomStart = effectiveTab === "emitted" ? customStartDateEmitted : customStartDate;
    const activeCustomEnd = effectiveTab === "emitted" ? customEndDateEmitted : customEndDate;

    if (activePeriod === "last_month") {
      month = curMonth === 1 ? 12 : curMonth - 1;
      year = curMonth === 1 ? curYear - 1 : curYear;
    } else if (activePeriod === "last_3_months") {
      month = 0;
      const threeMonthsStart = new Date(curYear, curMonth - 3, 1);
      const sY = threeMonthsStart.getFullYear();
      const sM = String(threeMonthsStart.getMonth() + 1).padStart(2, "0");
      startDate = `${sY}-${sM}-01`;
      endDate = `${curYear}-${String(curMonth).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    } else if (activePeriod === "custom") {
      const sMatch = activeCustomStart.match(/^(\d{4})-(\d{2})-\d{2}$/);
      const eMatch = activeCustomEnd.match(/^(\d{4})-(\d{2})-\d{2}$/);
      if (
        sMatch &&
        eMatch &&
        sMatch[1] === eMatch[1] &&
        sMatch[2] === eMatch[2] &&
        activeCustomStart.endsWith("-01")
      ) {
        year = parseInt(sMatch[1], 10);
        month = parseInt(sMatch[2], 10);
      } else {
        month = 0;
        if (sMatch) year = parseInt(sMatch[1], 10);
        if (activeCustomStart) startDate = activeCustomStart;
        if (activeCustomEnd) endDate = activeCustomEnd;
      }
    } else if (activePeriod === "current_year" || activePeriod === "all") {
      month = 0;
    }

    toast.loading("Generare fișier XML pentru SAGA C...", { id: "saga-export" });
    try {
      const res = await downloadSagaXmlMutation.mutateAsync({
        token,
        sessionToken,
        month,
        year,
        startDate,
        endDate,
      });

      let blob: Blob;
      if (res.base64) {
        const binaryStr = window.atob(res.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        blob = new Blob([bytes], {
          type: "application/xml;charset=windows-1250",
        });
      } else {
        blob = encodeWindows1250Blob(res.xml);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Fișierul ${res.filename} a fost descărcat!`, {
        id: "saga-export",
      });
    } catch (err: any) {
      toast.error(
        err?.message || "Eroare la generarea fișierului XML SAGA.",
        { id: "saga-export" }
      );
    }
  };

  // Descarcă Pachet ZIP
  const handleDownloadZipBundle = async () => {
    const targets =
      selectedIds.size > 0
        ? filteredInvoices.filter(i => selectedIds.has(i.id))
        : filteredInvoices;

    if (targets.length === 0) {
      toast.error("Nu există facturi selectate pentru arhivă.");
      return;
    }

    setIsDownloadingZip(true);
    setZipProgress("Inițializare arhivă ZIP...");
    const zip = new JSZip();
    const invoicesFolder = zip.folder("Facturi_PDF");
    const nirFolder = zip.folder("NIR_PDF");

    let count = 0;
    let addedFiles = 0;
    const total = targets.length;

    try {
      for (const inv of targets) {
        count++;
        setZipProgress(`Descărcare documente (${count}/${total})...`);

        const invPdfUrl = getAuthenticatedPdfUrl(inv.pdfUrl);
        if (invPdfUrl) {
          try {
            const pdfRes = await fetch(invPdfUrl, { credentials: "include" });
            const contentType = pdfRes.headers.get("content-type") || "";
            if (pdfRes.ok && !contentType.includes("text/html")) {
              const blob = await pdfRes.blob();
              if (blob.size > 0) {
                const safeNum = (inv.invoiceNumber || String(inv.id)).replace(
                  /[^a-zA-Z0-9-_]/g,
                  "_"
                );
                const safeSupp = (inv.supplierName || "FURNIZ")
                  .replace(/[^a-zA-Z0-9-_]/g, "_")
                  .slice(0, 20);
                const extFromMime = contentType.includes("png")
                  ? "png"
                  : contentType.includes("jpeg") || contentType.includes("jpg")
                    ? "jpg"
                    : contentType.includes("webp")
                      ? "webp"
                      : "pdf";
                const prefix = inv.isExternal ? "Factura_Externa" : "Factura";
                invoicesFolder?.file(`${prefix}_${safeSupp}_${safeNum}.${extFromMime}`, blob);
                addedFiles++;
              }
            }
          } catch {}
        }

        if (inv.hasNir && inv.nirId) {
          try {
            const nirUrl = getAuthenticatedPdfUrl(
              `/api/pdf/nir/${inv.nirId}?download=1`
            );
            if (nirUrl) {
              const nirRes = await fetch(nirUrl, { credentials: "include" });
              const contentType = nirRes.headers.get("content-type") || "";
              if (nirRes.ok && !contentType.includes("text/html")) {
                const blob = await nirRes.blob();
                if (blob.size > 0) {
                  const safeNirNum = (
                    inv.nirNumber || String(inv.nirId)
                  ).replace(/[^a-zA-Z0-9-_]/g, "_");
                  nirFolder?.file(`NIR_${safeNirNum}.pdf`, blob);
                  addedFiles++;
                }
              }
            }
          } catch {}
        }
      }

      // Include și extrasele de cont încărcate în folderul Extrase_de_Cont/ când nu există selecție strictă doar pe anumite facturi
      if (selectedIds.size === 0 && allStatements.length > 0) {
        const statementsFolder = zip.folder("Extrase_de_Cont");
        for (const st of allStatements) {
          try {
            const stUrl = getAuthenticatedPdfUrl(`${st.downloadUrl}?download=1`);
            if (stUrl) {
              const stRes = await fetch(stUrl, { credentials: "include" });
              const ct = stRes.headers.get("content-type") || "";
              if (stRes.ok && !ct.includes("text/html")) {
                const blob = await stRes.blob();
                if (blob.size > 0) {
                  const safeName = (
                    st.fileName ||
                    `Extras_${st.bankName}_${st.statementMonth}.${st.fileType || "pdf"}`
                  ).replace(/[^a-zA-Z0-9._-]/g, "_");
                  statementsFolder?.file(`${st.statementMonth}_${safeName}`, blob);
                  addedFiles++;
                }
              }
            }
          } catch {}
        }
      }

      if (addedFiles === 0) {
        toast.error(
          "Niciun document PDF disponibil pentru descărcare în arhivă.",
          { id: "zip-bundle" }
        );
        return;
      }

      setZipProgress("Comprimare arhivă ZIP...");
      const content = await zip.generateAsync({ type: "blob" });
      const companyName =
        portalData?.company?.name?.replace(/[^a-zA-Z0-9-_]/g, "_") || "Firma";
      const filename = `Pachet_Contabilitate_${companyName}_${new Date().toISOString().slice(0, 10)}.zip`;

      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Arhiva ${filename} a fost descărcată cu succes!`);
    } catch {
      toast.error("Eroare la împachetarea arhivei ZIP.");
    } finally {
      setIsDownloadingZip(false);
      setZipProgress("");
    }
  };

  const handleDownloadZip = handleDownloadZipBundle;

  const handleDownloadStatementsZip = async (customSubset?: any[], customMonthKey?: string) => {
    const targets = Array.isArray(customSubset) ? customSubset : filteredStatements;
    if (targets.length === 0) {
      toast.error("Nu există extrase de cont pentru descărcare.");
      return;
    }
    setIsDownloadingZip(true);
    setZipProgress("Se descarcă extrasele de cont...");
    const zip = new JSZip();
    let added = 0;
    try {
      for (const st of targets) {
        const stUrl = getAuthenticatedPdfUrl(`${st.downloadUrl}?download=1`);
        if (!stUrl) continue;
        const res = await fetch(stUrl, { credentials: "include" });
        const ct = res.headers.get("content-type") || "";
        if (res.ok && !ct.includes("text/html")) {
          const blob = await res.blob();
          if (blob.size > 0) {
            const safeBank = String(st.bankName || "Banca").replace(/[^a-zA-Z0-9_-]/g, "_");
            const safeName = String(st.fileName || `extras.${st.fileType || "pdf"}`).replace(
              /[^a-zA-Z0-9._-]/g,
              "_"
            );
            zip.file(`${st.statementMonth}_${safeBank}_${safeName}`, blob);
            added++;
          }
        }
      }
      if (added === 0) {
        toast.error("Fișierele extraselor nu au putut fi descărcate.");
        return;
      }
      const content = await zip.generateAsync({ type: "blob" });
      const companyName =
        portalData?.company?.name?.replace(/[^a-zA-Z0-9-_]/g, "_") || "Firma";
      const suffix = customMonthKey || new Date().toISOString().slice(0, 10);
      const filename = `Extrase_Cont_${companyName}_${suffix}.zip`;
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Arhiva cu ${added} extrase de cont a fost descărcată!`);
    } catch {
      toast.error("Eroare la crearea arhivei de extrase.");
    } finally {
      setIsDownloadingZip(false);
      setZipProgress("");
    }
  };

  const handleExportStatementsExcel = () => {
    if (filteredStatements.length === 0) {
      toast.error("Nu există extrase de cont pentru export.");
      return;
    }
    const rows = filteredStatements.map((st: any, idx: number) => ({
      "Nr. Crt.": idx + 1,
      "Lună Contabilă": st.statementMonth,
      "De la": st.periodStart || "",
      "Până la": st.periodEnd || "",
      Bancă: st.bankName,
      IBAN: st.iban || "",
      Monedă: st.currency || "RON",
      "Nr. Extras": st.statementNumber || "",
      "Sold Inițial": st.openingBalance ?? "",
      "Sold Final": st.closingBalance ?? "",
      "Fișier Original": st.fileName,
      Observații: st.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 26 },
      { wch: 28 },
      { wch: 9 },
      { wch: 14 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 25 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Extrase de Cont");
    const companyCui = portalData?.company?.cui ? `_${portalData.company.cui}` : "";
    const filename = `Extrase_Cont${companyCui}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Fișierul ${filename} a fost exportat!`);
  };

  const handleDirectStatementDownload = async (st: any) => {
    const url = getAuthenticatedPdfUrl(`${st.downloadUrl}?download=1`);
    if (!url) return;
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Eroare la descărcare");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = st.fileName || `Extras_${st.bankName}_${st.statementMonth}.${st.fileType || "pdf"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  // 1. Ecran de încărcare inițială
  if (isLoadingPublic || (Boolean(sessionToken) && isCheckingSession)) {
    return (
      <div className="min-h-screen apple-canvas flex flex-col items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7]">
        <Loader2 className="w-7 h-7 animate-spin text-[#6e6e73] mb-3" />
        <p className="text-[13.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
          Se încarcă portalul contabil...
        </p>
      </div>
    );
  }

  // 2. Portal negăsit sau dezactivat
  if (!publicInfo?.found || !publicInfo.isEnabled) {
    return (
      <div className="min-h-screen apple-canvas flex items-center justify-center p-4">
        <div className="max-w-md w-full apple-surface p-8 text-center text-[#1d1d1f] dark:text-[#f5f5f7]">
          <div className="w-12 h-12 rounded-2xl bg-[#fff6eb] dark:bg-amber-500/18 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-[18px] font-bold mb-2">
            Portal contabil indisponibil
          </h2>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
            Acest portal nu este activ sau link-ul accesat este invalid. Vă rugăm să contactați
            administratorul firmei pentru a primi link-ul corect sau pentru a activa accesul.
          </p>
        </div>
      </div>
    );
  }

  // 3. Ecran de blocare PIN (Lock Screen)
  if (!isUnlocked) {
    return (
      <AccountantPinLock
        token={token}
        companyName={publicInfo?.companyName || "Companie"}
        cui={publicInfo.cui}
        companyLogo={publicInfo.logoUrl}
        logoBgColor={publicInfo.logoBgColor}
        logoHasBackground={publicInfo.logoHasBackground}
        themeColor={publicInfo.themeColor}
        onUnlocked={handleUnlockSuccess}
      />
    );
  }

  const incomingCount = portalData?.invoices?.length || 0;
  const emittedCount = portalData?.emittedInvoices?.length || 0;
  const statementsCount = portalData?.bankStatements?.length || 0;
  const sagaTab: "received" | "emitted" =
    activeTab === "emitted" ? "emitted" : "received";

  // 4. Randare Mod SAGA C Clasic
  if (viewMode === "saga") {
    return (
      <>
        <SagaClassicPortalView
          portalData={portalData}
          token={token}
          sessionToken={sessionToken}
          activeTab={sagaTab}
          setActiveTab={setActiveTab}
          search={search}
          setSearch={setSearch}
          period={period}
          setPeriod={setPeriod}
          nirFilter={nirFilter}
          setNirFilter={setNirFilter}
          supplierFilter={supplierFilter}
          setSupplierFilter={setSupplierFilter}
          allSuppliers={allSuppliers}
          filteredInvoices={filteredInvoices}
          currentKpis={currentKpis}
          searchEmitted={searchEmitted}
          setSearchEmitted={setSearchEmitted}
          periodEmitted={periodEmitted}
          setPeriodEmitted={setPeriodEmitted}
          filteredEmittedInvoices={filteredEmittedInvoices}
          currentEmittedKpis={currentEmittedKpis}
          onViewInvoicePdf={inv =>
            setPreviewDoc({
              isOpen: true,
              title: `Factura ${inv.invoiceNumber} - ${
                activeTab === "received" ? inv.supplierName : inv.clientName
              }`,
              pdfUrl: getAuthenticatedPdfUrl(inv.pdfUrl),
              filename: `Factura_${inv.invoiceNumber}.pdf`,
              type: activeTab === "received" ? "invoice" : "emitted",
            })
          }
          onViewNirPdf={inv => {
            const targetNirId = inv.nirId || inv.id;
            const rawNum = inv.nirNumber || targetNirId;
            const targetNirNum = String(rawNum).startsWith("NIR")
              ? rawNum
              : `NIR-${rawNum}`;
            setPreviewDoc({
              isOpen: true,
              title: `${targetNirNum} - ${inv.supplierName || ""}`.trim(),
              pdfUrl: getAuthenticatedPdfUrl(`/api/pdf/nir/${targetNirId}`),
              filename: `${targetNirNum}.pdf`,
              type: "nir",
            });
          }}
          onDownloadSagaXml={handleDownloadSagaXml}
          onExportExcel={handleExportExcel}
          onExportEmittedExcel={handleExportEmittedExcel}
          onDownloadZip={handleDownloadZip}
          onLockSession={handleLockPortal}
          onSwitchToModern={handleToggleViewMode}
          onViewStatementPdf={st =>
            setPreviewDoc({
              isOpen: true,
              title: `Extras de cont ${st.bankName} — ${st.statementMonth}`,
              pdfUrl: getAuthenticatedPdfUrl(st.downloadUrl),
              filename: st.fileName,
              type: "invoice",
            })
          }
          onDownloadStatement={handleDirectStatementDownload}
          onDownloadStatementsZip={handleDownloadStatementsZip}
        />

        <DocumentModalPreview
          isOpen={previewDoc.isOpen}
          onClose={() =>
            setPreviewDoc(prev => ({ ...prev, isOpen: false, pdfUrl: null }))
          }
          title={previewDoc.title}
          pdfUrl={previewDoc.pdfUrl}
          filename={previewDoc.filename}
          type={previewDoc.type}
        />
      </>
    );
  }

  const hasActiveReceivedFilters =
    Boolean(search) ||
    period !== "all" ||
    nirFilter !== "all" ||
    supplierFilter !== "all";

  const hasActiveEmittedFilters =
    Boolean(searchEmitted) || periodEmitted !== "all";

  // 5. Spațiul de lucru principal MOD MODERN cu SIDEBAR și PREVIZUALIZARE ÎN MODAL
  return (
    <div className="min-h-screen apple-canvas text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col md:flex-row font-sans">
      {/* SIDEBAR DEDICAT PENTRU CONTABIL (Desktop) */}
      <aside className="hidden md:flex w-56 xl:w-60 bg-white/90 dark:bg-[#18181a] backdrop-blur-xl border-r border-black/[0.06] dark:border-white/[0.08] flex-col shrink-0 min-h-screen sticky top-0 h-screen z-20">
        {/* Antet Sidebar */}
        <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            {publicInfo.logoUrl ? (
              <div
                className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-black/[0.08] dark:border-white/[0.10] bg-white shrink-0"
                style={{
                  backgroundColor:
                    publicInfo.logoBgColor ||
                    (publicInfo.logoHasBackground ? "#1c1c1e" : "#ffffff"),
                }}
              >
                <img
                  src={publicInfo.logoUrl}
                  alt={publicInfo.companyName}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#f2f4f7] dark:bg-[#2c2c2e] text-[#0071e3] dark:text-[#0a84ff] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className="text-[13.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate"
                title={publicInfo.companyName}
              >
                {publicInfo.companyName}
              </div>
              {publicInfo.cui && (
                <p className="text-[11px] text-[#6e6e73] dark:text-[#98989d] tabular-nums mt-0.5">
                  CUI {publicInfo.cui}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] text-[11px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Portal contabilitate</span>
          </div>
        </div>

        {/* Meniu Sidebar — Facturi Primite & Facturi Emise */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="text-[11px] font-medium text-[#8e8e93] px-3 py-1">
            Documente contabile
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("received")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-[12.5px] transition-all cursor-pointer ${
              activeTab === "received"
                ? "apple-sidebar-active"
                : "text-[#3a3a3c] dark:text-[#ebebf5] font-medium hover:bg-black/[0.045] dark:hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText
                className={`w-4 h-4 ${
                  activeTab === "received"
                    ? "text-white"
                    : "text-[#6e6e73] dark:text-[#98989d]"
                }`}
              />
              <span>Facturi primite</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                activeTab === "received"
                  ? "bg-white/20 text-white"
                  : "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]"
              }`}
            >
              {incomingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("emitted")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-[12.5px] transition-all cursor-pointer ${
              activeTab === "emitted"
                ? "apple-sidebar-active"
                : "text-[#3a3a3c] dark:text-[#ebebf5] font-medium hover:bg-black/[0.045] dark:hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileOutput
                className={`w-4 h-4 ${
                  activeTab === "emitted"
                    ? "text-white"
                    : "text-[#6e6e73] dark:text-[#98989d]"
                }`}
              />
              <span>Facturi emise</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                activeTab === "emitted"
                  ? "bg-white/20 text-white"
                  : "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]"
              }`}
            >
              {emittedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("statements")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-[12.5px] transition-all cursor-pointer ${
              activeTab === "statements"
                ? "apple-sidebar-active"
                : "text-[#3a3a3c] dark:text-[#ebebf5] font-medium hover:bg-black/[0.045] dark:hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Landmark
                className={`w-4 h-4 ${
                  activeTab === "statements"
                    ? "text-white"
                    : "text-[#6e6e73] dark:text-[#98989d]"
                }`}
              />
              <span>Extrase de cont</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                activeTab === "statements"
                  ? "bg-white/20 text-white"
                  : "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]"
              }`}
            >
              {statementsCount}
            </span>
          </button>
        </nav>

        {/* Footer Sidebar: Buton Închide Sesiunea */}
        <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            type="button"
            onClick={handleLockPortal}
            className="apple-btn-glass w-full flex items-center justify-center gap-2 h-9 px-3 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#ff3b30] dark:hover:text-[#ff453a] text-[12.5px] font-semibold cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Închide sesiunea</span>
          </button>
        </div>
      </aside>

      {/* ZONA PRINCIPALĂ DE CONȚINUT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Bara Mobilă (sub md:) */}
        <div className="md:hidden bg-white/90 dark:bg-[#18181a] backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08] px-3 py-2.5 space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                {publicInfo.companyName}
              </div>
              {publicInfo.cui && (
                <div className="text-[11px] text-[#6e6e73] dark:text-[#98989d] tabular-nums truncate">
                  CUI {publicInfo.cui}
                </div>
              )}
            </div>
            <button
              type="button"
              aria-label="Închide sesiunea"
              onClick={handleLockPortal}
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="apple-segmented w-full min-w-0 flex">
            <button
              type="button"
              data-active={activeTab === "received"}
              onClick={() => setActiveTab("received")}
              className="apple-segmented-item flex-1 justify-center px-1.5 text-[11.5px] tabular-nums min-w-0 truncate"
            >
              Primite ({incomingCount})
            </button>
            <button
              type="button"
              data-active={activeTab === "emitted"}
              onClick={() => setActiveTab("emitted")}
              className="apple-segmented-item flex-1 justify-center px-1.5 text-[11.5px] tabular-nums min-w-0 truncate"
            >
              Emise ({emittedCount})
            </button>
            <button
              type="button"
              data-active={activeTab === "statements"}
              onClick={() => setActiveTab("statements")}
              className="apple-segmented-item flex-1 justify-center px-1.5 text-[11.5px] tabular-nums min-w-0 truncate"
            >
              Extrase ({statementsCount})
            </button>
          </div>
        </div>

        <main className="p-3 sm:p-5 space-y-4 flex-1 min-w-0 max-w-full">
          {/* Page Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
                {activeTab === "received"
                  ? "Facturi primite & NIR-uri"
                  : activeTab === "emitted"
                    ? "Facturi emise (vânzări)"
                    : "Extrase de cont bancare"}
              </h1>
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
                {activeTab === "received" ? (
                  <>
                    Intrări de la furnizori (SPV + externe) ·{" "}
                    <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                      {incomingCount}
                    </strong>{" "}
                    documente
                    {filteredInvoices.length !== incomingCount && (
                      <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                        ({filteredInvoices.length} afișate)
                      </span>
                    )}
                  </>
                ) : activeTab === "emitted" ? (
                  <>
                    Ieșiri către clienți ·{" "}
                    <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                      {emittedCount}
                    </strong>{" "}
                    documente
                    {filteredEmittedInvoices.length !== emittedCount && (
                      <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                        ({filteredEmittedInvoices.length} afișate)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    Extrase bancare lunare puse la dispoziție de firmă ·{" "}
                    <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                      {statementsCount}
                    </strong>{" "}
                    extrase
                    {filteredStatements.length !== statementsCount && (
                      <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                        ({filteredStatements.length} afișate)
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleToggleViewMode}
                className="apple-btn-glass flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                title="Comută la vederea clasică de lucru SAGA C (ecran împărțit pe 2 tabele dense)"
              >
                <Layers className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                <span>Mod SAGA Clasic</span>
              </button>

              <button
                type="button"
                onClick={() => refetchData()}
                disabled={isFetching}
                title="Reîmprospătează datele"
                className="apple-btn-glass flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
                />
                <span>Actualizează</span>
              </button>

              {activeTab === "received" ? (
                <>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={filteredInvoices.length === 0}
                    className="apple-btn-glass flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-50 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Export Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSagaXml}
                    disabled={downloadSagaXmlMutation.isPending}
                    className="apple-btn-glass flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-50 cursor-pointer"
                  >
                    {downloadSagaXmlMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                    )}
                    <span>Export XML SAGA</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadZipBundle}
                    disabled={filteredInvoices.length === 0 || isDownloadingZip}
                    className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {isDownloadingZip ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{zipProgress || "Comprimare..."}</span>
                      </>
                    ) : (
                      <>
                        <Package className="w-3.5 h-3.5" />
                        <span>Descarcă Pachet ZIP</span>
                      </>
                    )}
                  </button>
                </>
              ) : activeTab === "emitted" ? (
                <button
                  type="button"
                  onClick={handleExportEmittedExcel}
                  disabled={filteredEmittedInvoices.length === 0}
                  className="apple-btn-glass flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-50 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Excel (.xlsx)</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleExportStatementsExcel}
                    disabled={filteredStatements.length === 0}
                    className="apple-btn-glass flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-50 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Export Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadStatementsZip()}
                    disabled={filteredStatements.length === 0 || isDownloadingZip}
                    className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {isDownloadingZip ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{zipProgress || "Comprimare..."}</span>
                      </>
                    ) : (
                      <>
                        <Package className="w-3.5 h-3.5" />
                        <span>Descarcă extrase (.zip)</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TAB 1: FACTURI PRIMITE */}
          {activeTab === "received" && (
            <>
              {/* KPI Cards Primite */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                      Facturi primite
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none">
                      {currentKpis.totalCount}
                    </span>
                  </div>
                </div>

                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                      Bază impozabilă
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
                      <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                  </div>
                  <div className="tabular-nums min-w-0">
                    <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none truncate block">
                      {formatCurrency(currentKpis.totalBase)}
                    </span>
                  </div>
                </div>

                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                      TVA deductibil
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
                      <Percent className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </span>
                  </div>
                  <div className="tabular-nums min-w-0">
                    <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none truncate block">
                      {formatCurrency(currentKpis.totalVat)}
                    </span>
                  </div>
                </div>

                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                      Total de plată
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                      <Receipt className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                    </span>
                  </div>
                  <div className="tabular-nums min-w-0">
                    <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none truncate block">
                      {formatCurrency(currentKpis.totalGross)}
                    </span>
                  </div>
                </div>

                <div className="col-span-2 lg:col-span-1 apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                      Recepții NIR
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-teal-500/10 dark:bg-teal-500/18 flex items-center justify-center shrink-0">
                      <ClipboardCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-baseline gap-1.5 tabular-nums">
                      <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none">
                        {currentKpis.withNirCount}
                      </span>
                      <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                        / {currentKpis.totalCount}
                      </span>
                      <span className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-700 dark:bg-teal-500/18 dark:text-teal-300 leading-none">
                        {currentKpis.nirCoveragePercent}%
                      </span>
                    </div>
                    <div className="w-full bg-[#f2f2f7] dark:bg-[#2c2c2e] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${currentKpis.nirCoveragePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Unified Single-Row Filter & Search Toolbar (Primite) */}
              <div className="apple-surface px-3 py-2.5">
                <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full min-w-0">
                  {/* Period Segmented Track */}
                  <div className="apple-segmented flex-wrap sm:flex-nowrap !rounded-2xl sm:!rounded-full max-w-full shrink-0">
                    {[
                      { id: "all", label: "Toate" },
                      { id: "current_month", label: "Lună" },
                      { id: "last_month", label: "Luna trec." },
                      { id: "last_3_months", label: "3 luni" },
                      { id: "current_year", label: "An" },
                      { id: "custom", label: "Interval" },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        data-active={period === item.id}
                        onClick={() => {
                          setPeriod(item.id as any);
                          setPage(1);
                        }}
                        className="apple-segmented-item px-2 2xl:px-2.5 shrink-0"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {period === "custom" && (
                    <div className="inline-flex items-center gap-1 px-2.5 h-[34px] rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-xs tabular-nums shrink-0 max-w-full overflow-x-auto no-scrollbar">
                      <Calendar className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={e => {
                          setCustomStartDate(e.target.value);
                          setPage(1);
                        }}
                        className="h-6 px-1 text-xs tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-[104px]"
                      />
                      <span className="text-[#8e8e93]">–</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={e => {
                          setCustomEndDate(e.target.value);
                          setPage(1);
                        }}
                        className="h-6 px-1 text-xs tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-[104px]"
                      />
                    </div>
                  )}

                  {/* NIR Filter Segmented */}
                  <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar shrink-0">
                    <button
                      type="button"
                      data-active={nirFilter === "cu_nir"}
                      onClick={() => {
                        setNirFilter(nirFilter === "cu_nir" ? "all" : "cu_nir");
                        setPage(1);
                      }}
                      className="apple-segmented-item px-2 2xl:px-2.5 tabular-nums shrink-0"
                    >
                      <span>Cu NIR</span>
                      <span className="opacity-75">{currentKpis.withNirCount}</span>
                    </button>
                    <button
                      type="button"
                      data-active={nirFilter === "fara_nir"}
                      onClick={() => {
                        setNirFilter(
                          nirFilter === "fara_nir" ? "all" : "fara_nir"
                        );
                        setPage(1);
                      }}
                      className="apple-segmented-item px-2 2xl:px-2.5 tabular-nums shrink-0"
                    >
                      <span>Fără NIR</span>
                      <span className="opacity-75">
                        {currentKpis.withoutNirCount}
                      </span>
                    </button>
                  </div>

                  {/* Right Side: Supplier Select + Search + Reset */}
                  <div className="xl:ml-auto flex flex-wrap sm:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full xl:w-auto xl:flex-1 justify-end min-w-0">
                    <Select
                      value={supplierFilter}
                      onValueChange={val => {
                        setSupplierFilter(val);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger
                        data-filtered={supplierFilter !== "all"}
                        className="apple-pill-control h-[34px] w-auto max-w-[210px] shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 2xl:px-3"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                        <SelectValue placeholder="Toți furnizorii" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          Toți furnizorii ({allSuppliers.length})
                        </SelectItem>
                        {allSuppliers.map(supp => (
                          <SelectItem key={supp} value={supp}>
                            {supp}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="relative flex-1 min-w-[130px] max-w-full sm:max-w-[260px]">
                      <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={search}
                        onChange={e => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Caută furnizor, CUI, factură..."
                        style={{ paddingLeft: 34, paddingRight: search ? 74 : 14 }}
                        className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
                      />
                      {search && (
                        <>
                          <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap">
                            {filteredInvoices.length}/{incomingCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSearch("");
                              setPage(1);
                            }}
                            aria-label="Șterge căutarea"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.12] cursor-pointer"
                          >
                            <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                          </button>
                        </>
                      )}
                    </div>

                    {hasActiveReceivedFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setPeriod("all");
                          setNirFilter("all");
                          setSupplierFilter("all");
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

              {/* Tabel Facturi Primite */}
              <div className="apple-surface overflow-hidden">
                {selectedIds.size > 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#f2f2f7]/90 dark:bg-[#2c2c2e]/85 border-b border-black/[0.06] dark:border-white/[0.08]">
                    <span className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                      {selectedIds.size} facturi selectate pentru export
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="apple-btn-glass px-3 h-7 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    >
                      Deselectează
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                      <tr>
                        <th className="px-4 py-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              selectedIds.size === filteredInvoices.length &&
                              filteredInvoices.length > 0
                            }
                            onChange={handleToggleSelectAll}
                            className="w-4 h-4 rounded border-black/20 dark:border-white/25 text-primary cursor-pointer"
                          />
                        </th>
                        <th className="px-3 py-3 w-12 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Nr.
                        </th>
                        <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Dată & Scadență
                        </th>
                        <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Furnizor & CUI
                        </th>
                        <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Nr. factură
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Bază
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          TVA
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Total
                        </th>
                        <th className="px-4 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Status NIR
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Documente
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={10} className="py-14 text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73] mx-auto" />
                          </td>
                        </tr>
                      ) : paginatedItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            className="py-12 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]"
                          >
                            Nu a fost găsită nicio factură conform filtrelor selectate.
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((inv: any, idx) => {
                          const rowNumber = (safePage - 1) * pageSize + idx + 1;
                          const isSelected = selectedIds.has(inv.id);

                          return (
                            <tr
                              key={inv.id}
                              className={`hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors ${
                                isSelected
                                  ? "bg-[#0071e3]/[0.05] dark:bg-[#0a84ff]/[0.12]"
                                  : ""
                              }`}
                            >
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelect(inv.id)}
                                  className="w-4 h-4 rounded border-black/20 dark:border-white/25 text-primary cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-3 text-center tabular-nums font-medium text-[12px] text-[#8e8e93]">
                                {rowNumber}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#ebebf5] leading-tight">
                                  {formatDate(inv.issueDate)}
                                </div>
                                {inv.dueDate && (
                                  <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                                    Scad. {formatDate(inv.dueDate)}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 max-w-[230px]">
                                <div
                                  className="text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate"
                                  title={inv.supplierName}
                                >
                                  {inv.supplierName}
                                </div>
                                {inv.supplierCUI && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[11.5px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                                      CUI {inv.supplierCUI}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={e => handleCopyCui(inv.supplierCUI, e)}
                                      title="Copiază CUI"
                                      aria-label="Copiază CUI"
                                      className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[#8e8e93] hover:text-[#1d1d1f] hover:bg-black/[0.06] dark:hover:text-white dark:hover:bg-white/[0.10] transition cursor-pointer"
                                    >
                                      {copiedCui === inv.supplierCUI ? (
                                        <Check className="w-3 h-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDoc({
                                      isOpen: true,
                                      title: `Factură ${inv.invoiceNumber} — ${inv.supplierName}`,
                                      pdfUrl: getAuthenticatedPdfUrl(inv.pdfUrl),
                                      filename: `Factura_${inv.invoiceNumber}.pdf`,
                                      type: "invoice",
                                    })
                                  }
                                  title="Deschide factura în fereastră"
                                  className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums text-left block cursor-pointer"
                                >
                                  {inv.invoiceNumber}
                                </button>
                                {inv.spvIndex ? (
                                  <div
                                    className="text-[11px] tabular-nums text-[#8e8e93] mt-0.5"
                                    title={`Index încărcare SPV: ${inv.spvIndex}`}
                                  >
                                    SPV #{inv.spvIndex}
                                  </div>
                                ) : inv.isExternal ? (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/12 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 mt-0.5">
                                    Extern / Non-SPV
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-[13px] text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                                {formatCurrency(inv.totalBase, inv.currency)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-[13px] text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                                {formatCurrency(inv.totalVAT, inv.currency)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                                <div>{formatCurrency(inv.total, inv.currency)}</div>
                                {inv.currency && inv.currency !== "RON" && inv.totalRon !== undefined && (
                                  <div className="text-[10.5px] font-medium text-[#8e8e93]">
                                    ≈ {formatCurrency(inv.totalRon, "RON")}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {inv.hasNir ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const targetNirId = inv.nirId || inv.id;
                                      const rawNum = inv.nirNumber || targetNirId;
                                      const targetNirNum = String(rawNum).startsWith(
                                        "NIR"
                                      )
                                        ? rawNum
                                        : `NIR #${rawNum}`;
                                      setPreviewDoc({
                                        isOpen: true,
                                        title: `${targetNirNum} — ${inv.supplierName}`,
                                        pdfUrl: getAuthenticatedPdfUrl(
                                          `/api/pdf/nir/${targetNirId}`
                                        ),
                                        filename: `${targetNirNum}.pdf`,
                                        type: "nir",
                                      });
                                    }}
                                    title="Deschide NIR în fereastră"
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/10 text-teal-700 hover:bg-teal-500/18 dark:bg-teal-500/18 dark:text-teal-300 transition-colors cursor-pointer tabular-nums leading-none"
                                  >
                                    <ClipboardCheck className="w-3 h-3 shrink-0" />
                                    <span>
                                      {inv.nirNumber
                                        ? String(inv.nirNumber).startsWith("NIR")
                                          ? inv.nirNumber
                                          : `NIR #${inv.nirNumber}`
                                        : "Recepție"}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="text-[#8e8e93] text-[12px]">
                                    Fără NIR
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewDoc({
                                        isOpen: true,
                                        title: `Factură ${inv.invoiceNumber} — ${inv.supplierName}`,
                                        pdfUrl: getAuthenticatedPdfUrl(inv.pdfUrl),
                                        filename: `Factura_${inv.invoiceNumber}.pdf`,
                                        type: "invoice",
                                      })
                                    }
                                    title="Deschide factura în fereastră"
                                    aria-label="Deschide factura"
                                    className="w-8 h-8 rounded-full apple-btn-glass text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>

                                  {inv.hasNir ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const targetNirId = inv.nirId || inv.id;
                                        const rawNum = inv.nirNumber || targetNirId;
                                        const targetNirNum = String(
                                          rawNum
                                        ).startsWith("NIR")
                                          ? rawNum
                                          : `NIR #${rawNum}`;
                                        setPreviewDoc({
                                          isOpen: true,
                                          title: `${targetNirNum} — ${inv.supplierName}`,
                                          pdfUrl: getAuthenticatedPdfUrl(
                                            `/api/pdf/nir/${targetNirId}`
                                          ),
                                          filename: `${targetNirNum}.pdf`,
                                          type: "nir",
                                        });
                                      }}
                                      title="Deschide NIR în fereastră"
                                      aria-label="Deschide NIR"
                                      className="w-8 h-8 rounded-full apple-btn-glass text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center justify-center transition-colors cursor-pointer"
                                    >
                                      <ClipboardCheck className="w-3.5 h-3.5" />
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginare Footer Primite */}
                <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02] flex items-center justify-between flex-wrap gap-2 tabular-nums">
                  <div className="flex items-center gap-3 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span>Rânduri:</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={val => {
                          setPageSize(Number(val));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-7 px-2.5 text-xs border-black/[0.08] bg-white dark:bg-[#2c2c2e] dark:border-white/[0.10] w-[68px] rounded-full tabular-nums">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <span>
                      Afișare{" "}
                      <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                        {filteredInvoices.length > 0
                          ? (safePage - 1) * pageSize + 1
                          : 0}
                        –
                        {Math.min(safePage * pageSize, filteredInvoices.length)}
                      </strong>{" "}
                      din{" "}
                      <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                        {filteredInvoices.length}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                    <span className="mr-1.5">
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
                      className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      aria-label="Pagina următoare"
                      className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: FACTURI EMISE */}
          {activeTab === "emitted" && (
            <>
              {/* KPI Cards Emise */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                      Facturi emise
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
                      <FileOutput className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                  </div>
                  <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
                    {currentEmittedKpis.totalCount}
                  </span>
                </div>

                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                      Bază facturată
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                      <Coins className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                    </span>
                  </div>
                  <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums truncate">
                    {formatCurrency(currentEmittedKpis.totalBase)}
                  </span>
                </div>

                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                      TVA colectat
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
                      <Percent className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </span>
                  </div>
                  <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums truncate">
                    {formatCurrency(currentEmittedKpis.totalVat)}
                  </span>
                </div>

                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                      Total general emis
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
                      <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                  </div>
                  <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums truncate">
                    {formatCurrency(currentEmittedKpis.totalGross)}
                  </span>
                </div>
              </div>

              {/* Unified Single-Row Filter & Search Toolbar (Emise) */}
              <div className="apple-surface px-3 py-2.5">
                <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full min-w-0">
                  <div className="apple-segmented flex-wrap sm:flex-nowrap !rounded-2xl sm:!rounded-full max-w-full shrink-0">
                    {[
                      { id: "all", label: "Toate" },
                      { id: "current_month", label: "Lună" },
                      { id: "last_month", label: "Luna trec." },
                      { id: "last_3_months", label: "3 luni" },
                      { id: "current_year", label: "An" },
                      { id: "custom", label: "Interval" },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        data-active={periodEmitted === item.id}
                        onClick={() => {
                          setPeriodEmitted(item.id as any);
                          setPage(1);
                        }}
                        className="apple-segmented-item px-2 2xl:px-2.5 shrink-0"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {periodEmitted === "custom" && (
                    <div className="inline-flex items-center gap-1 px-2.5 h-[34px] rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-xs tabular-nums shrink-0 max-w-full overflow-x-auto no-scrollbar">
                      <Calendar className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                      <input
                        type="date"
                        value={customStartDateEmitted}
                        onChange={e => {
                          setCustomStartDateEmitted(e.target.value);
                          setPage(1);
                        }}
                        className="h-6 px-1 text-xs tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-[104px]"
                      />
                      <span className="text-[#8e8e93]">–</span>
                      <input
                        type="date"
                        value={customEndDateEmitted}
                        onChange={e => {
                          setCustomEndDateEmitted(e.target.value);
                          setPage(1);
                        }}
                        className="h-6 px-1 text-xs tabular-nums bg-transparent text-[#1d1d1f] dark:text-[#f5f5f7] outline-none w-[104px]"
                      />
                    </div>
                  )}

                  <div className="xl:ml-auto flex items-center gap-1.5 w-full xl:w-auto xl:flex-1 justify-end min-w-0">
                    <div className="relative flex-1 min-w-[140px] max-w-full sm:max-w-[300px]">
                      <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchEmitted}
                        onChange={e => {
                          setSearchEmitted(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Caută client, CUI, factură emisă..."
                        style={{
                          paddingLeft: 34,
                          paddingRight: searchEmitted ? 74 : 14,
                        }}
                        className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
                      />
                      {searchEmitted && (
                        <>
                          <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap">
                            {filteredEmittedInvoices.length}/{emittedCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchEmitted("");
                              setPage(1);
                            }}
                            aria-label="Șterge căutarea"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.12] cursor-pointer"
                          >
                            <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                          </button>
                        </>
                      )}
                    </div>

                    {hasActiveEmittedFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchEmitted("");
                          setPeriodEmitted("all");
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

              {/* Tabel Facturi Emise */}
              <div className="apple-surface overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                      <tr>
                        <th className="px-3 py-3 w-12 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Nr.
                        </th>
                        <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Dată & Scadență
                        </th>
                        <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Client & CUI
                        </th>
                        <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Nr. factură
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Bază
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          TVA
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Total
                        </th>
                        <th className="px-4 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Stare
                        </th>
                        <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                          Document
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={9} className="py-14 text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73] mx-auto" />
                          </td>
                        </tr>
                      ) : paginatedItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            className="py-12 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]"
                          >
                            Nu a fost găsită nicio factură emisă conform filtrelor.
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((inv: any, idx) => {
                          const rowNumber = (safePage - 1) * pageSize + idx + 1;

                          return (
                            <tr
                              key={`${inv.source}-${inv.id}`}
                              className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                            >
                              <td className="px-3 py-3 text-center tabular-nums font-medium text-[12px] text-[#8e8e93]">
                                {rowNumber}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#ebebf5] leading-tight">
                                  {formatDate(inv.issueDate)}
                                </div>
                                {inv.dueDate && (
                                  <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                                    Scad. {formatDate(inv.dueDate)}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 max-w-[230px]">
                                <div
                                  className="text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate"
                                  title={inv.clientName}
                                >
                                  {inv.clientName}
                                </div>
                                {inv.clientCUI && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[11.5px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                                      CUI {inv.clientCUI}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={e => handleCopyCui(inv.clientCUI, e)}
                                      title="Copiază CUI"
                                      aria-label="Copiază CUI"
                                      className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[#8e8e93] hover:text-[#1d1d1f] hover:bg-black/[0.06] dark:hover:text-white dark:hover:bg-white/[0.10] transition cursor-pointer"
                                    >
                                      {copiedCui === inv.clientCUI ? (
                                        <Check className="w-3 h-3 text-emerald-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDoc({
                                      isOpen: true,
                                      title: `Factură Emisă ${inv.invoiceNumber} — ${inv.clientName}`,
                                      pdfUrl: getAuthenticatedPdfUrl(inv.pdfUrl),
                                      filename: `Factura_Emisa_${inv.invoiceNumber}.pdf`,
                                      type: "emitted",
                                    })
                                  }
                                  title="Deschide factura în fereastră"
                                  className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums text-left block cursor-pointer"
                                >
                                  {inv.invoiceNumber}
                                </button>
                                {inv.spvIndex ? (
                                  <div
                                    className="text-[11px] tabular-nums text-[#8e8e93] mt-0.5"
                                    title={`Index încărcare SPV: ${inv.spvIndex}`}
                                  >
                                    SPV #{inv.spvIndex}
                                  </div>
                                ) : inv.isExternal ? (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/12 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 mt-0.5">
                                    Extern / Non-SPV
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-[13px] text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                                {formatCurrency(inv.totalBase, inv.currency)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-[13px] text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                                {formatCurrency(inv.totalVAT, inv.currency)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                                <div>{formatCurrency(inv.total, inv.currency)}</div>
                                {inv.currency && inv.currency !== "RON" && inv.totalRon !== undefined && (
                                  <div className="text-[10.5px] font-medium text-[#8e8e93]">
                                    ≈ {formatCurrency(inv.totalRon, "RON")}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-500/18 dark:text-emerald-300 dark:border-emerald-500/25 leading-none">
                                  {inv.status || "Emis"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDoc({
                                      isOpen: true,
                                      title: `Factură Emisă ${inv.invoiceNumber} — ${inv.clientName}`,
                                      pdfUrl: getAuthenticatedPdfUrl(inv.pdfUrl),
                                      filename: `Factura_Emisa_${inv.invoiceNumber}.pdf`,
                                      type: "emitted",
                                    })
                                  }
                                  title="Deschide factura în fereastră"
                                  aria-label="Deschide factura"
                                  className="w-8 h-8 rounded-full apple-btn-glass text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginare Footer Emise */}
                <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02] flex items-center justify-between flex-wrap gap-2 tabular-nums">
                  <div className="flex items-center gap-3 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span>Rânduri:</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={val => {
                          setPageSize(Number(val));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-7 px-2.5 text-xs border-black/[0.08] bg-white dark:bg-[#2c2c2e] dark:border-white/[0.10] w-[68px] rounded-full tabular-nums">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <span>
                      Afișare{" "}
                      <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                        {filteredEmittedInvoices.length > 0
                          ? (safePage - 1) * pageSize + 1
                          : 0}
                        –
                        {Math.min(
                          safePage * pageSize,
                          filteredEmittedInvoices.length
                        )}
                      </strong>{" "}
                      din{" "}
                      <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                        {filteredEmittedInvoices.length}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                    <span className="mr-1.5">
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
                      className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      aria-label="Pagina următoare"
                      className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: EXTRASE DE CONT BANCARE */}
          {activeTab === "statements" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Extrase disponibile
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                      <Landmark className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                    </span>
                  </div>
                  <span className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums leading-none">
                    {filteredStatements.length}
                  </span>
                </div>

                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Luni contabile acoperite
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                  </div>
                  <span className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums leading-none">
                    {portalData?.bankStatementsKpis?.monthsCount ?? statementMonths.length}
                  </span>
                </div>

                <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      Bănci / Conturi
                    </span>
                    <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
                      <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </span>
                  </div>
                  <span className="text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums leading-none">
                    {portalData?.bankStatementsKpis?.banksCount ?? 0}
                  </span>
                </div>
              </div>

              {/* Bara Filtre Extrase */}
              <div className="apple-surface px-3 py-2.5">
                <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 w-full min-w-0">
                  <div className="apple-segmented shrink-0 max-w-full overflow-x-auto no-scrollbar">
                    {["all", "RON", "EUR", "USD"].map(cur => (
                      <button
                        key={cur}
                        type="button"
                        data-active={statementCurrencyFilter === cur}
                        onClick={() => {
                          setStatementCurrencyFilter(cur);
                          setPage(1);
                        }}
                        className="apple-segmented-item px-3 shrink-0"
                      >
                        {cur === "all" ? "Toate valutele" : cur}
                      </button>
                    ))}
                  </div>

                  <div className="xl:ml-auto flex flex-wrap sm:flex-nowrap items-center gap-2 w-full xl:w-auto xl:flex-1 justify-end min-w-0">
                    <Select
                      value={statementMonthFilter}
                      onValueChange={v => {
                        setStatementMonthFilter(v);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger
                        data-filtered={statementMonthFilter !== "all"}
                        className="apple-pill-control h-[34px] w-auto min-w-[155px] px-3 shrink-0"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] mr-1.5 shrink-0" />
                        <SelectValue placeholder="Toate lunile" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toate lunile</SelectItem>
                        {statementMonths.map(m => (
                          <SelectItem key={m} value={m}>
                            {formatStatementMonthLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="relative flex-1 min-w-[150px] max-w-full sm:max-w-[260px]">
                      <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        value={searchStatements}
                        onChange={e => {
                          setSearchStatements(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Caută bancă, IBAN, fișier..."
                        style={{ paddingLeft: 34, paddingRight: searchStatements ? 32 : 14 }}
                        className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[16px] sm:text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93]"
                      />
                      {searchStatements && (
                        <button
                          type="button"
                          onClick={() => setSearchStatements("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.12] cursor-pointer"
                        >
                          <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Extrase de Cont Grupate pe Luni */}
              {groupedPortalStatements.length === 0 ? (
                <div className="apple-surface py-12 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                  Nu există extrase de cont încărcate pentru selecția curentă.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {groupedPortalStatements.map(group => {
                    const isCollapsed = Boolean(collapsedStatementMonths[group.monthKey]);
                    return (
                      <div key={group.monthKey} className="apple-surface overflow-hidden">
                        {/* Antet Lună Contabilă */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setCollapsedStatementMonths(prev => ({
                              ...prev,
                              [group.monthKey]: !prev[group.monthKey],
                            }))
                          }
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setCollapsedStatementMonths(prev => ({
                                ...prev,
                                [group.monthKey]: !prev[group.monthKey],
                              }));
                            }
                          }}
                          className="px-4 py-3 bg-[#fafafa]/90 dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between gap-3 flex-wrap cursor-pointer hover:bg-[#f2f4f7]/80 dark:hover:bg-white/[0.04] transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                            <span className="w-8 h-8 rounded-[10px] bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 flex items-center justify-center shrink-0">
                              <Calendar className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[15px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.015em]">
                                {group.monthLabel}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-black/[0.05] dark:bg-white/[0.09] text-[#3a3a3c] dark:text-[#ebebf5] tabular-nums">
                                {group.items.length}{" "}
                                {group.items.length === 1 ? "extras" : "extrase"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap ml-auto">
                            {group.accounts.map(acc => (
                              <div
                                key={acc.key}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#2c2c2e] border border-black/[0.06] dark:border-white/[0.09] text-[11.5px] tabular-nums"
                              >
                                <span className="font-semibold text-[#6e6e73] dark:text-[#98989d]">
                                  {acc.bankName} ({acc.currency}):
                                </span>
                                {acc.openingBalance !== null && (
                                  <span className="text-[#6e6e73] dark:text-[#98989d]">
                                    Inițial{" "}
                                    <strong className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                      {formatCurrency(acc.openingBalance, acc.currency)}
                                    </strong>
                                  </span>
                                )}
                                {acc.openingBalance !== null && acc.closingBalance !== null && (
                                  <span className="text-[#8e8e93]">→</span>
                                )}
                                {acc.closingBalance !== null && (
                                  <span className="text-[#6e6e73] dark:text-[#98989d]">
                                    Final{" "}
                                    <strong className="font-bold text-emerald-600 dark:text-emerald-400">
                                      {formatCurrency(acc.closingBalance, acc.currency)}
                                    </strong>
                                  </span>
                                )}
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleDownloadStatementsZip(group.items, group.monthKey);
                              }}
                              disabled={isDownloadingZip}
                              className="apple-btn-glass h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer disabled:opacity-50"
                              title={`Descarcă toate extrasele din ${group.monthLabel} într-un ZIP`}
                            >
                              <Package className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                              <span>ZIP lună</span>
                            </button>

                            <ChevronDown
                              className={`w-4 h-4 text-[#6e6e73] dark:text-[#98989d] transition-transform duration-200 ${
                                isCollapsed ? "-rotate-90" : "rotate-0"
                              }`}
                            />
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-[#fafafa]/50 dark:bg-white/[0.015] border-b border-black/[0.05] dark:border-white/[0.07]">
                                <tr>
                                  <th className="px-3 py-2.5 w-10 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                                    Nr.
                                  </th>
                                  <th className="px-3.5 py-2.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                                    Dată / Perioadă
                                  </th>
                                  <th className="px-3.5 py-2.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                                    Bancă & Cont IBAN
                                  </th>
                                  <th className="px-3.5 py-2.5 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                                    Fișier
                                  </th>
                                  <th className="px-3.5 py-2.5 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                                    Sold inițial
                                  </th>
                                  <th className="px-3.5 py-2.5 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                                    Sold final
                                  </th>
                                  <th className="px-3.5 py-2.5 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                                    Document
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                                {group.items.map((st: any, idx: number) => {
                                  const isPdf = String(st.fileType || "").toLowerCase() === "pdf";
                                  return (
                                    <tr
                                      key={st.id}
                                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                                    >
                                      <td className="px-3 py-3 text-center tabular-nums text-[12px] text-[#8e8e93]">
                                        {idx + 1}
                                      </td>
                                      <td className="px-3.5 py-3 whitespace-nowrap tabular-nums">
                                        <div className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                                          {formatStatementPeriodLabel(
                                            st.periodStart,
                                            st.periodEnd,
                                            st.statementMonth
                                          )}
                                        </div>
                                        {st.statementNumber && (
                                          <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
                                            Extras #{st.statementNumber}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-3.5 py-3 max-w-[235px]">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                                            {st.bankName}
                                          </span>
                                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] shrink-0">
                                            {st.currency}
                                          </span>
                                        </div>
                                        {st.iban && (
                                          <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums truncate mt-0.5">
                                            {st.iban}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-3.5 py-3 max-w-[215px]">
                                        <div
                                          className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate"
                                          title={st.fileName}
                                        >
                                          {st.fileName}
                                        </div>
                                        {st.notes && (
                                          <div className="text-[11px] text-[#8e8e93] truncate mt-0.5">
                                            {st.notes}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-3.5 py-3 text-right tabular-nums text-[13px] text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                                        {st.openingBalance !== null &&
                                        st.openingBalance !== undefined
                                          ? formatCurrency(st.openingBalance, st.currency)
                                          : "—"}
                                      </td>
                                      <td className="px-3.5 py-3 text-right tabular-nums text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                                        {st.closingBalance !== null &&
                                        st.closingBalance !== undefined
                                          ? formatCurrency(st.closingBalance, st.currency)
                                          : "—"}
                                      </td>
                                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center justify-end gap-1.5">
                                          {isPdf && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPreviewDoc({
                                                  isOpen: true,
                                                  title: `Extras ${st.bankName} — ${formatStatementPeriodLabel(
                                                    st.periodStart,
                                                    st.periodEnd,
                                                    group.monthLabel
                                                  )}`,
                                                  pdfUrl: getAuthenticatedPdfUrl(st.downloadUrl),
                                                  filename: st.fileName,
                                                  type: "invoice",
                                                })
                                              }
                                              title="Previzualizează PDF"
                                              className="w-8 h-8 rounded-full apple-btn-glass inline-flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleDirectStatementDownload(st)}
                                            title="Descarcă fișierul original"
                                            className="w-8 h-8 rounded-full apple-btn-glass inline-flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* MODAL UNIVERSAL PENTRU PREVIZUALIZARE PDF ÎN FEREASTRĂ (FĂRĂ TAB NOU) */}
      <DocumentModalPreview
        isOpen={previewDoc.isOpen}
        onClose={() =>
          setPreviewDoc(prev => ({ ...prev, isOpen: false, pdfUrl: null }))
        }
        title={previewDoc.title}
        pdfUrl={previewDoc.pdfUrl}
        filename={previewDoc.filename}
        type={previewDoc.type}
      />
    </div>
  );
}
