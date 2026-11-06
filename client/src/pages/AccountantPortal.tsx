import { useState, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import {
  FileText,
  FileOutput,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Package,
  Building2,
  Lock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
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
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import AccountantPinLock from "@/components/AccountantPinLock";
import DocumentModalPreview from "@/components/DocumentModalPreview";
import SagaClassicPortalView from "@/components/SagaClassicPortalView";

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

  // Navigare Sidebar: "received" (Facturi Primite) sau "emitted" (Facturi Emise)
  const [activeTab, setActiveTab] = useState<"received" | "emitted">("received");

  // Mod afișare: "modern" sau "saga" (implicit SAGA C Clasic pentru contabili)
  const [viewMode, setViewMode] = useState<"modern" | "saga">(() => {
    try {
      const saved = localStorage.getItem("smart_invoice_accountant_view_mode");
      if (saved === "modern" || saved === "saga") return saved;
      return "saga";
    } catch {
      return "saga";
    }
  });

  const handleToggleViewMode = () => {
    const next = viewMode === "modern" ? "saga" : "modern";
    setViewMode(next);
    try {
      localStorage.setItem("smart_invoice_accountant_view_mode", next);
    } catch {}
    toast.success(`Ați comutat pe ${next === "saga" ? "Modul SAGA C Clasic" : "Modul Modern"}`);
  };

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
  const [period, setPeriod] = useState<"current_month" | "last_month" | "last_3_months" | "current_year" | "all" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [nirFilter, setNirFilter] = useState<"all" | "cu_nir" | "fara_nir">("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  // Filtre Facturi Emise
  const [searchEmitted, setSearchEmitted] = useState("");
  const [periodEmitted, setPeriodEmitted] = useState<"current_month" | "last_month" | "last_3_months" | "current_year" | "all" | "custom">("all");
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
    refetch: refetchPublic,
  } = trpc.accountantPortal.getPublicInfo.useQuery(
    { token },
    { enabled: Boolean(token), retry: 1 }
  );

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
    const sep = url.includes("?") ? "&" : "?";
    return sessionToken ? `${url}${sep}accountantToken=${encodeURIComponent(sessionToken)}` : url;
  };

  const handleUnlockSuccess = (newToken: string) => {
    try {
      sessionStorage.setItem(storageKey, newToken);
      document.cookie = `accountantSession=${encodeURIComponent(newToken)}; path=/; max-age=604800; SameSite=Lax`;
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
    portalData.invoices.forEach((i) => {
      if (i.supplierName) set.add(i.supplierName.trim());
    });
    return Array.from(set).sort();
  }, [portalData?.invoices]);

  // Filtrare locală facturi primite
  const filteredInvoices = useMemo(() => {
    if (!portalData?.invoices) return [];
    let list = portalData.invoices;

    if (activeDateRange.start || activeDateRange.end) {
      list = list.filter((inv) => {
        if (!inv.issueDate) return false;
        const d = new Date(inv.issueDate);
        if (isNaN(d.getTime())) return true;
        if (activeDateRange.start && d < activeDateRange.start) return false;
        if (activeDateRange.end && d > activeDateRange.end) return false;
        return true;
      });
    }

    if (nirFilter === "cu_nir") {
      list = list.filter((inv) => inv.hasNir);
    } else if (nirFilter === "fara_nir") {
      list = list.filter((inv) => !inv.hasNir);
    }

    if (supplierFilter !== "all") {
      list = list.filter((inv) => inv.supplierName === supplierFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((inv) => {
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
      list = list.filter((inv) => {
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
      list = list.filter((inv) => {
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

  // KPI-uri Facturi Primite
  const currentKpis = useMemo(() => {
    let totalCount = filteredInvoices.length;
    let totalBase = 0;
    let totalVat = 0;
    let totalGross = 0;
    let withNirCount = 0;
    let withoutNirCount = 0;

    for (const inv of filteredInvoices) {
      totalBase += inv.totalBase;
      totalVat += inv.totalVAT;
      totalGross += inv.total;
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
      nirCoveragePercent: totalCount > 0 ? Math.round((withNirCount / totalCount) * 100) : 0,
    };
  }, [filteredInvoices]);

  // KPI-uri Facturi Emise
  const currentEmittedKpis = useMemo(() => {
    let totalCount = filteredEmittedInvoices.length;
    let totalBase = 0;
    let totalVat = 0;
    let totalGross = 0;

    for (const inv of filteredEmittedInvoices) {
      totalBase += inv.totalBase;
      totalVat += inv.totalVAT;
      totalGross += inv.total;
    }

    return {
      totalCount,
      totalBase: Math.round(totalBase * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalGross: Math.round(totalGross * 100) / 100,
    };
  }, [filteredEmittedInvoices]);

  // Paginare
  const activeList = activeTab === "received" ? filteredInvoices : filteredEmittedInvoices;
  const totalPages = Math.ceil(activeList.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return activeList.slice(start, start + pageSize);
  }, [activeList, page, pageSize]);

  // Reset paginare la schimbare tab
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [activeTab]);

  // Gestionare selecție multiplă
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((i) => i.id)));
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
        ? filteredInvoices.filter((i) => selectedIds.has(i.id))
        : filteredInvoices;

    const rows = itemsToExport.map((inv, idx) => ({
      "Nr. Crt.": idx + 1,
      "Dată Factură": formatDate(inv.issueDate),
      "Dată Scadență": formatDate(inv.dueDate),
      "Furnizor": inv.supplierName,
      "CUI Furnizor": inv.supplierCUI || "",
      "Număr Factură": inv.invoiceNumber,
      "Valoare Bază (fără TVA)": inv.totalBase,
      "TVA": inv.totalVAT,
      "Total General": inv.total,
      "Monedă": inv.currency,
      "Status NIR": inv.hasNir ? "Generat" : "Fără NIR",
      "Număr NIR": inv.nirNumber || "",
      "Dată NIR": formatDate(inv.nirDate),
      "Gestiune": inv.gestiune || "",
      "Index SPV": inv.spvIndex || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturi Primite & NIR");

    const companyCui = portalData?.company?.cui ? `_${portalData.company.cui}` : "";
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
      "Client": inv.clientName,
      "CUI Client": inv.clientCUI || "",
      "Număr Factură": inv.invoiceNumber,
      "Valoare Bază (fără TVA)": inv.totalBase,
      "TVA": inv.totalVAT,
      "Total Factură": inv.total,
      "Monedă": inv.currency,
      "Stare": inv.status,
      "Index SPV": inv.spvIndex || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturi Emise");

    const companyCui = portalData?.company?.cui ? `_${portalData.company.cui}` : "";
    const filename = `Facturi_Emise${companyCui}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success(`Fișierul ${filename} a fost exportat cu succes!`);
  };

  // Descarcă XML SAGA
  const handleDownloadSagaXml = async () => {
    const now = new Date();
    let month = now.getMonth() + 1;
    let year = now.getFullYear();

    if (period === "last_month") {
      month = month === 1 ? 12 : month - 1;
      year = month === 12 ? year - 1 : year;
    } else if (period === "current_year" || period === "all") {
      month = 0;
    }

    toast.loading("Generare fișier XML pentru SAGA C...", { id: "saga-export" });
    try {
      const res = await downloadSagaXmlMutation.mutateAsync({
        token,
        sessionToken,
        month,
        year,
      });

      const blob = new Blob([res.xml], { type: "application/xml;charset=windows-1250" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Fișierul ${res.filename} a fost descărcat!`, { id: "saga-export" });
    } catch (err: any) {
      toast.error(err?.message || "Eroare la generarea fișierului XML SAGA.", { id: "saga-export" });
    }
  };

  // Descarcă Pachet ZIP
  const handleDownloadZipBundle = async () => {
    const targets =
      selectedIds.size > 0
        ? filteredInvoices.filter((i) => selectedIds.has(i.id))
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
    const total = targets.length;

    try {
      for (const inv of targets) {
        count++;
        setZipProgress(`Descărcare documente (${count}/${total})...`);

        const invPdfUrl = getAuthenticatedPdfUrl(inv.pdfUrl);
        if (invPdfUrl) {
          try {
            const pdfRes = await fetch(invPdfUrl, { credentials: "include" });
            if (pdfRes.ok) {
              const blob = await pdfRes.blob();
              const safeNum = (inv.invoiceNumber || String(inv.id)).replace(/[^a-zA-Z0-9-_]/g, "_");
              const safeSupp = (inv.supplierName || "FURNIZ").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 20);
              invoicesFolder?.file(`Factura_${safeSupp}_${safeNum}.pdf`, blob);
            }
          } catch {}
        }

        if (inv.hasNir && inv.nirId) {
          try {
            const nirUrl = getAuthenticatedPdfUrl(`/api/pdf/nir/${inv.nirId}?download=1`);
            if (nirUrl) {
              const nirRes = await fetch(nirUrl, { credentials: "include" });
              if (nirRes.ok) {
                const blob = await nirRes.blob();
                const safeNirNum = (inv.nirNumber || String(inv.nirId)).replace(/[^a-zA-Z0-9-_]/g, "_");
                nirFolder?.file(`NIR_${safeNirNum}.pdf`, blob);
              }
            }
          } catch {}
        }
      }

      setZipProgress("Comprimare arhivă ZIP...");
      const content = await zip.generateAsync({ type: "blob" });
      const companyName = portalData?.company?.name?.replace(/[^a-zA-Z0-9-_]/g, "_") || "Firma";
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
    } catch (err: any) {
      toast.error("Eroare la împachetarea arhivei ZIP.");
    } finally {
      setIsDownloadingZip(false);
      setZipProgress("");
    }
  };

  const handleDownloadZip = handleDownloadZipBundle;

  // 1. Ecran de încărcare inițială
  if (isLoadingPublic || (Boolean(sessionToken) && isCheckingSession)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-700 dark:text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm font-medium">Se încarcă portalul contabil...</p>
      </div>
    );
  }

  // 2. Portal negăsit sau dezactivat
  if (!publicInfo?.found || !publicInfo.isEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-800 dark:text-white shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold mb-2">Portal Contabil Indisponibil</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
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

  // 4. Randare Mod SAGA C Clasic (Split-screen 2 grile identic cu SAGA C)
  if (viewMode === "saga") {
    return (
      <>
        <SagaClassicPortalView
          portalData={portalData}
          token={token}
          sessionToken={sessionToken}
          activeTab={activeTab}
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
          onViewInvoicePdf={(inv) =>
            setPreviewDoc({
              isOpen: true,
              title: `Factura ${inv.invoiceNumber} - ${activeTab === "received" ? inv.supplierName : inv.clientName}`,
              pdfUrl: inv.pdfUrl,
              filename: `Factura_${inv.invoiceNumber}.pdf`,
              type: activeTab === "received" ? "invoice" : "emitted",
            })
          }
          onViewNirPdf={(inv) =>
            setPreviewDoc({
              isOpen: true,
              title: `NIR ${inv.nirNumber} - ${inv.supplierName}`,
              pdfUrl: `/api/pdf/nir/${inv.nirId}`,
              filename: `NIR_${inv.nirNumber}.pdf`,
              type: "nir",
            })
          }
          onDownloadSagaXml={handleDownloadSagaXml}
          onExportExcel={handleExportExcel}
          onExportEmittedExcel={handleExportEmittedExcel}
          onDownloadZip={handleDownloadZip}
          onLockSession={handleLockPortal}
          onSwitchToModern={handleToggleViewMode}
        />

        {/* Modal Universal Previzualizare PDF în fereastră SAGA */}
        <DocumentModalPreview
          isOpen={previewDoc.isOpen}
          onClose={() => setPreviewDoc((prev) => ({ ...prev, isOpen: false, pdfUrl: null }))}
          title={previewDoc.title}
          pdfUrl={previewDoc.pdfUrl}
          filename={previewDoc.filename}
          type={previewDoc.type}
          theme="saga"
        />
      </>
    );
  }

  // 5. Spațiul de lucru principal MOD MODERN cu SIDEBAR și PREVIZUALIZARE ÎN MODAL
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans">
      {/* SIDEBAR DEDICAT PENTRU CONTABIL */}
      <aside className="w-56 xl:w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 min-h-screen sticky top-0 h-screen z-20">
        {/* Antet Sidebar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {publicInfo.logoUrl ? (
              <div
                className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-slate-200 dark:border-slate-700 bg-white shrink-0 shadow-2xs"
                style={{
                  backgroundColor: publicInfo.logoBgColor || (publicInfo.logoHasBackground ? "#0f172a" : "#ffffff"),
                }}
              >
                <img
                  src={publicInfo.logoUrl}
                  alt={publicInfo.companyName}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-600 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={publicInfo.companyName}>
                {publicInfo.companyName}
              </h1>
              {publicInfo.cui && (
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  CUI: {publicInfo.cui}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Portal Contabilitate</span>
          </div>
        </div>

        {/* Meniu Sidebar — Facturi Primite & Facturi Emise */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
            Documente Contabile
          </div>

          {/* Buton Facturi Primite */}
          <button
            type="button"
            onClick={() => setActiveTab("received")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === "received"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className={`w-4 h-4 ${activeTab === "received" ? "text-white" : "text-blue-600"}`} />
              <span>Facturi Primite</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "received"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
              }`}
            >
              {incomingCount}
            </span>
          </button>

          {/* Buton Facturi Emise */}
          <button
            type="button"
            onClick={() => setActiveTab("emitted")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === "emitted"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileOutput className={`w-4 h-4 ${activeTab === "emitted" ? "text-white" : "text-emerald-600"}`} />
              <span>Facturi Emise</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "emitted"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
              }`}
            >
              {emittedCount}
            </span>
          </button>
        </nav>

        {/* Footer Sidebar: Buton Închide Sesiunea */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button
            type="button"
            onClick={handleLockPortal}
            className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Închide sesiunea</span>
          </button>
        </div>
      </aside>

      {/* ZONA PRINCIPALĂ DE CONȚINUT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Antet Pagină */}
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {activeTab === "received" ? "Facturi Primite & NIR-uri" : "Facturi Emise (Vânzări)"}
            </h2>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {activeTab === "received" ? "Intrări de la furnizori" : "Ieșiri către clienți"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Buton Comutator la Mod SAGA C Clasic */}
            <button
              type="button"
              onClick={handleToggleViewMode}
              className="h-8 px-3 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-[#1F4E79] dark:text-blue-300 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              title="Comută la vederea clasică de lucru SAGA C (ecran împărțit pe 2 tabele dense)"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Mod SAGA Clasic</span>
            </button>

            <button
              onClick={() => refetchData()}
              disabled={isFetching}
              title="Reîmprospătează datele"
              className="h-8 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-600" : ""}`} />
              <span className="hidden sm:inline">Actualizează</span>
            </button>
          </div>
        </header>

        <main className="p-3.5 sm:p-4 lg:p-5 space-y-4 flex-1 min-w-0">
          {/* TAB 1: FACTURI PRIMITE */}
          {activeTab === "received" && (
            <>
              {/* Top KPI Cards Primite */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Facturi Primite</span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 leading-tight">{currentKpis.totalCount}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">în selecția activă</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bază Impozabilă</span>
                    <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 leading-tight">{formatCurrency(currentKpis.totalBase)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">valoare fără TVA</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">TVA Deductibil</span>
                    <div className="text-lg sm:text-xl font-black text-amber-600 mt-1 leading-tight">{formatCurrency(currentKpis.totalVat)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">sumă totală TVA</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 text-amber-600 flex items-center justify-center shrink-0">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total de Plată</span>
                    <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 leading-tight">{formatCurrency(currentKpis.totalGross)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">valoare brută cu TVA</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 text-indigo-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>

                <div className="col-span-2 lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div className="flex-1 mr-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recepții NIR</span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">{currentKpis.withNirCount}</span>
                      <span className="text-xs text-slate-500">/ {currentKpis.totalCount}</span>
                      <span className="text-xs font-bold text-teal-600 ml-auto">{currentKpis.nirCoveragePercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div className="bg-teal-500 h-full rounded-full transition-all duration-300" style={{ width: `${currentKpis.nirCoveragePercent}%` }} />
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/60 text-teal-600 flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Filtre Primite */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-3.5 space-y-3">
                <div className="flex items-center gap-2.5 w-full flex-wrap xl:flex-nowrap">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Caută furnizor, CUI, număr factură..."
                      className="w-full h-8 pl-9 pr-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="w-[160px] sm:w-[180px] flex-shrink-0 relative">
                    <Calendar className="w-3.5 h-3.5 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={period}
                      onChange={(e: any) => { setPeriod(e.target.value); setPage(1); }}
                      className="w-full h-8 pl-8 pr-4 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="all">Perioadă: Toate</option>
                      <option value="current_month">Luna curentă</option>
                      <option value="last_month">Luna anterioară</option>
                      <option value="last_3_months">Ultimele 3 luni</option>
                      <option value="current_year">Anul curent</option>
                      <option value="custom">Personalizat...</option>
                    </select>
                  </div>

                  <div className="w-[145px] sm:w-[165px] flex-shrink-0 relative">
                    <ClipboardCheck className="w-3.5 h-3.5 text-teal-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={nirFilter}
                      onChange={(e: any) => { setNirFilter(e.target.value); setPage(1); }}
                      className="w-full h-8 pl-8 pr-4 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="all">NIR: Toate</option>
                      <option value="cu_nir">✓ Cu NIR generat</option>
                      <option value="fara_nir">○ Fără NIR</option>
                    </select>
                  </div>

                  <div className="w-[150px] sm:w-[180px] flex-shrink-0 relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={supplierFilter}
                      onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
                      className="w-full h-8 pl-8 pr-4 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
                    >
                      <option value="all">Furnizor: Toți ({allSuppliers.length})</option>
                      {allSuppliers.map((supp) => (
                        <option key={supp} value={supp}>{supp}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {period === "custom" && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-medium text-slate-500">De la:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                    />
                    <span className="text-xs font-medium text-slate-500">Până la:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500">
                    Afișare <span className="font-bold text-slate-900 dark:text-white">{filteredInvoices.length}</span> facturi găsite
                    {selectedIds.size > 0 && (
                      <span className="ml-2 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold border border-blue-200">
                        {selectedIds.size} selectate
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleExportExcel}
                      disabled={filteredInvoices.length === 0}
                      className="h-8 px-3.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Export Excel (.xlsx)</span>
                    </button>

                    <button
                      onClick={handleDownloadZipBundle}
                      disabled={filteredInvoices.length === 0 || isDownloadingZip}
                      className="h-8 px-3.5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
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

                    <button
                      onClick={handleDownloadSagaXml}
                      disabled={downloadSagaXmlMutation.isPending}
                      className="h-8 px-3.5 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                    >
                      {downloadSagaXmlMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5" />}
                      <span>Export XML SAGA</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabel Facturi Primite */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wide select-none">
                        <th className="px-2.5 py-2.5 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                            onChange={handleToggleSelectAll}
                            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-1.5 py-2.5 w-8 text-center text-slate-400">#</th>
                        <th className="px-2.5 py-2.5 whitespace-nowrap">Dată / Scad.</th>
                        <th className="px-2.5 py-2.5">Furnizor & CUI</th>
                        <th className="px-2.5 py-2.5 whitespace-nowrap">Nr. Factură</th>
                        <th className="px-2 py-2.5 text-right whitespace-nowrap">Bază</th>
                        <th className="px-2 py-2.5 text-right whitespace-nowrap">TVA</th>
                        <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Total</th>
                        <th className="px-2 py-2.5 text-center whitespace-nowrap">Status NIR</th>
                        <th className="px-2 py-2.5 text-center w-16 whitespace-nowrap">Doc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={10} className="py-12 text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                          </td>
                        </tr>
                      ) : paginatedItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-10 text-center text-slate-500 bg-slate-50/50">
                            Nu a fost găsită nicio factură conform filtrelor selectate.
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((inv: any, idx) => {
                          const rowNumber = (page - 1) * pageSize + idx + 1;
                          const isSelected = selectedIds.has(inv.id);

                          return (
                            <tr
                              key={inv.id}
                              className={`hover:bg-slate-50/80 transition-colors ${isSelected ? "bg-blue-50/50" : ""}`}
                            >
                              <td className="px-2.5 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelect(inv.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-1.5 py-2 text-center font-bold text-xs text-slate-400">{rowNumber}</td>
                              <td className="px-2.5 py-2 whitespace-nowrap">
                                <div className="font-semibold text-slate-900 dark:text-white leading-tight">{formatDate(inv.issueDate)}</div>
                                {inv.dueDate && <div className="text-[10px] text-slate-400 mt-0.5">Scad: {formatDate(inv.dueDate)}</div>}
                              </td>
                              <td className="px-2.5 py-2 max-w-[170px] xl:max-w-[220px]">
                                <div className="font-bold text-slate-900 dark:text-white truncate" title={inv.supplierName}>{inv.supplierName}</div>
                                {inv.supplierCUI && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] font-mono text-slate-500">{inv.supplierCUI}</span>
                                    <button onClick={(e) => handleCopyCui(inv.supplierCUI, e)} title="Copiază CUI" className="text-slate-400 hover:text-blue-600 transition">
                                      {copiedCui === inv.supplierCUI ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-2.5 py-2 whitespace-nowrap">
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
                                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline text-left block"
                                >
                                  {inv.invoiceNumber}
                                </button>
                                {inv.spvIndex ? (
                                  <div
                                    className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5"
                                    title={`Index încărcare SPV: ${inv.spvIndex}`}
                                  >
                                    <span className="text-[9px] uppercase font-bold text-slate-400">SPV:</span>
                                    <span>{inv.spvIndex}</span>
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatCurrency(inv.totalBase, inv.currency)}</td>
                              <td className="px-2 py-2 text-right font-mono text-slate-500 whitespace-nowrap">{formatCurrency(inv.totalVAT, inv.currency)}</td>
                              <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatCurrency(inv.total, inv.currency)}</td>
                              <td className="px-2 py-2 text-center whitespace-nowrap">
                                {inv.hasNir ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewDoc({
                                        isOpen: true,
                                        title: `NIR #${inv.nirNumber || inv.nirId} — ${inv.supplierName}`,
                                        pdfUrl: getAuthenticatedPdfUrl(`/api/pdf/nir/${inv.nirId}`),
                                        filename: `NIR_${inv.nirNumber || inv.nirId}.pdf`,
                                        type: "nir",
                                      })
                                    }
                                    title="Deschide NIR în fereastră"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer"
                                  >
                                    <ClipboardCheck className="w-3 h-3 text-teal-600 shrink-0" />
                                    <span>{inv.nirNumber ? `NIR #${inv.nirNumber}` : "Recepție"}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-xs">Fără NIR</span>
                                )}
                              </td>
                              {/* Butoane Documente — Iconițe compacte */}
                              <td className="px-2 py-2 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
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
                                    className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center justify-center transition-colors shadow-2xs"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>

                                  {inv.hasNir && inv.nirId ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewDoc({
                                          isOpen: true,
                                          title: `NIR #${inv.nirNumber || inv.nirId} — ${inv.supplierName}`,
                                          pdfUrl: getAuthenticatedPdfUrl(`/api/pdf/nir/${inv.nirId}`),
                                          filename: `NIR_${inv.nirNumber || inv.nirId}.pdf`,
                                          type: "nir",
                                        })
                                      }
                                      title="Deschide NIR în fereastră"
                                      className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 flex items-center justify-center transition-colors shadow-2xs"
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

                {/* Paginare Footer */}
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <span>Rânduri pe pagină:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer text-xs"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-slate-400 ml-2">
                      Afișare {filteredInvoices.length > 0 ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, filteredInvoices.length)} din {filteredInvoices.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="h-7 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition font-medium"
                    >
                      Anterior
                    </button>
                    <span className="font-bold text-slate-700 px-1">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="h-7 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition font-medium"
                    >
                      Următor
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: FACTURI EMISE */}
          {activeTab === "emitted" && (
            <>
              {/* Top KPI Cards Emise */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Facturi Emise</span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 leading-tight">{currentEmittedKpis.totalCount}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">vânzări către clienți</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileOutput className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bază Facturată</span>
                    <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 leading-tight">{formatCurrency(currentEmittedKpis.totalBase)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">venituri nete (fără TVA)</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 text-blue-600 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">TVA Colectat</span>
                    <div className="text-lg sm:text-xl font-black text-amber-600 mt-1 leading-tight">{formatCurrency(currentEmittedKpis.totalVat)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">sumă totală TVA emis</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 text-amber-600 flex items-center justify-center shrink-0">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total General Emis</span>
                    <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 leading-tight">{formatCurrency(currentEmittedKpis.totalGross)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">total de încasat</div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 text-indigo-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Filtre Emise */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-3.5 space-y-3">
                <div className="flex items-center gap-2.5 w-full flex-wrap xl:flex-nowrap">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchEmitted}
                      onChange={(e) => { setSearchEmitted(e.target.value); setPage(1); }}
                      placeholder="Caută client, CUI, număr factură emisă..."
                      className="w-full h-8 pl-9 pr-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="w-[160px] sm:w-[180px] flex-shrink-0 relative">
                    <Calendar className="w-3.5 h-3.5 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={periodEmitted}
                      onChange={(e: any) => { setPeriodEmitted(e.target.value); setPage(1); }}
                      className="w-full h-8 pl-8 pr-4 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="all">Perioadă: Toate</option>
                      <option value="current_month">Luna curentă</option>
                      <option value="last_month">Luna anterioară</option>
                      <option value="last_3_months">Ultimele 3 luni</option>
                      <option value="current_year">Anul curent</option>
                      <option value="custom">Personalizat...</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500">
                    Afișare <span className="font-bold text-slate-900 dark:text-white">{filteredEmittedInvoices.length}</span> facturi emise găsite
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportEmittedExcel}
                      disabled={filteredEmittedInvoices.length === 0}
                      className="h-8 px-3.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Export Excel (.xlsx)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabel Facturi Emise */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wide select-none">
                        <th className="px-1.5 py-2.5 w-8 text-center text-slate-400">#</th>
                        <th className="px-2.5 py-2.5 whitespace-nowrap">Dată / Scad.</th>
                        <th className="px-2.5 py-2.5">Client & CUI</th>
                        <th className="px-2.5 py-2.5 whitespace-nowrap">Nr. Factură</th>
                        <th className="px-2 py-2.5 text-right whitespace-nowrap">Bază</th>
                        <th className="px-2 py-2.5 text-right whitespace-nowrap">TVA</th>
                        <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Total</th>
                        <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Stare</th>
                        <th className="px-2 py-2.5 text-center w-14 whitespace-nowrap">Doc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                          </td>
                        </tr>
                      ) : paginatedItems.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-slate-500 bg-slate-50/50">
                            Nu a fost găsită nicio factură emisă conform filtrelor.
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((inv: any, idx) => {
                          const rowNumber = (page - 1) * pageSize + idx + 1;

                          return (
                            <tr key={`${inv.source}-${inv.id}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-1.5 py-2 text-center font-bold text-xs text-slate-400">{rowNumber}</td>
                              <td className="px-2.5 py-2 whitespace-nowrap">
                                <div className="font-semibold text-slate-900 dark:text-white leading-tight">{formatDate(inv.issueDate)}</div>
                                {inv.dueDate && <div className="text-[10px] text-slate-400 mt-0.5">Scad: {formatDate(inv.dueDate)}</div>}
                              </td>
                              <td className="px-2.5 py-2 max-w-[170px] xl:max-w-[220px]">
                                <div className="font-bold text-slate-900 dark:text-white truncate" title={inv.clientName}>{inv.clientName}</div>
                                {inv.clientCUI && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] font-mono text-slate-500">{inv.clientCUI}</span>
                                    <button onClick={(e) => handleCopyCui(inv.clientCUI, e)} title="Copiază CUI" className="text-slate-400 hover:text-blue-600 transition">
                                      {copiedCui === inv.clientCUI ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="px-2.5 py-2 whitespace-nowrap">
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
                                  className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline text-left block"
                                >
                                  {inv.invoiceNumber}
                                </button>
                                {inv.spvIndex ? (
                                  <div
                                    className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5"
                                    title={`Index încărcare SPV: ${inv.spvIndex}`}
                                  >
                                    <span className="text-[9px] uppercase font-bold text-slate-400">SPV:</span>
                                    <span>{inv.spvIndex}</span>
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-2 py-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatCurrency(inv.totalBase, inv.currency)}</td>
                              <td className="px-2 py-2 text-right font-mono text-slate-500 whitespace-nowrap">{formatCurrency(inv.totalVAT, inv.currency)}</td>
                              <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatCurrency(inv.total, inv.currency)}</td>
                              <td className="px-2.5 py-2 text-center whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {inv.status || "emis"}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center whitespace-nowrap">
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
                                  className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 inline-flex items-center justify-center transition-colors shadow-2xs"
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
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <span>Rânduri pe pagină:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer text-xs"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-slate-400 ml-2">
                      Afișare {filteredEmittedInvoices.length > 0 ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, filteredEmittedInvoices.length)} din {filteredEmittedInvoices.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="h-7 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition font-medium"
                    >
                      Anterior
                    </button>
                    <span className="font-bold text-slate-700 px-1">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="h-7 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition font-medium"
                    >
                      Următor
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* MODAL UNIVERSAL PENTRU PREVIZUALIZARE PDF ÎN FEREASTRĂ (FĂRĂ TAB NOU) */}
      <DocumentModalPreview
        isOpen={previewDoc.isOpen}
        onClose={() => setPreviewDoc((prev) => ({ ...prev, isOpen: false, pdfUrl: null }))}
        title={previewDoc.title}
        pdfUrl={previewDoc.pdfUrl}
        filename={previewDoc.filename}
        type={previewDoc.type}
      />
    </div>
  );
}
