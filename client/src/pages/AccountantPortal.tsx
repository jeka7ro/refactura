import { useState, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import {
  FileText,
  Calendar,
  Search,
  Filter,
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
  Tag,
  ClipboardCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import AccountantPinLock from "@/components/AccountantPinLock";

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

  const [copiedCui, setCopiedCui] = useState<string | null>(null);

  // Filtre
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"current_month" | "last_month" | "last_3_months" | "current_year" | "all" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [nirFilter, setNirFilter] = useState<"all" | "cu_nir" | "fara_nir">("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

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

  const handleUnlockSuccess = (newToken: string) => {
    try {
      sessionStorage.setItem(storageKey, newToken);
    } catch {}
    setSessionToken(newToken);
    toast.success("Acces autorizat cu succes!");
  };

  const handleLockPortal = () => {
    try {
      sessionStorage.removeItem(storageKey);
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

  // Calcul interval de date activ pentru filtrare
  const activeDateRange = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed

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

  // Lista completă a furnizorilor din date
  const allSuppliers = useMemo(() => {
    if (!portalData?.invoices) return [];
    const set = new Set<string>();
    portalData.invoices.forEach((i) => {
      if (i.supplierName) set.add(i.supplierName.trim());
    });
    return Array.from(set).sort();
  }, [portalData?.invoices]);

  // Filtrare locală rapidă
  const filteredInvoices = useMemo(() => {
    if (!portalData?.invoices) return [];
    let list = portalData.invoices;

    // Filtru dată
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

    // Filtru NIR
    if (nirFilter === "cu_nir") {
      list = list.filter((inv) => inv.hasNir);
    } else if (nirFilter === "fara_nir") {
      list = list.filter((inv) => !inv.hasNir);
    }

    // Filtru Furnizor
    if (supplierFilter !== "all") {
      list = list.filter((inv) => inv.supplierName === supplierFilter);
    }

    // Căutare liberă
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((inv) => {
        return (
          inv.supplierName.toLowerCase().includes(q) ||
          inv.supplierCUI.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          (inv.nirNumber && inv.nirNumber.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [portalData?.invoices, activeDateRange, nirFilter, supplierFilter, search]);

  // Calcul statistici pentru selecția curentă filtrată (KPI-uri Dashboard)
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

  // Paginare
  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, page, pageSize]);

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

  // Export Excel (.xlsx)
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturi & NIR");

    const companyCui = portalData?.company?.cui ? `_${portalData.company.cui}` : "";
    const filename = `Documente_Contabilitate${companyCui}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success(`Fișierul ${filename} a fost exportat cu succes!`);
  };

  // Descarcă fișierul XML SAGA pentru luna selectată
  const handleDownloadSagaXml = async () => {
    const now = new Date();
    let month = now.getMonth() + 1;
    let year = now.getFullYear();

    if (period === "last_month") {
      month = month === 1 ? 12 : month - 1;
      year = month === 12 ? year - 1 : year;
    } else if (period === "current_year" || period === "all") {
      month = 0; // tot anul
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

  // Descarcă Arhivă ZIP cu toate PDF-urile și NIR-urile
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

        // 1. Descărcare PDF Factură
        if (inv.pdfUrl) {
          try {
            const pdfRes = await fetch(inv.pdfUrl);
            if (pdfRes.ok) {
              const blob = await pdfRes.blob();
              const safeNum = (inv.invoiceNumber || String(inv.id)).replace(/[^a-zA-Z0-9-_]/g, "_");
              const safeSupp = (inv.supplierName || "FURNIZ").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 20);
              invoicesFolder?.file(`Factura_${safeSupp}_${safeNum}.pdf`, blob);
            }
          } catch {}
        }

        // 2. Descărcare PDF NIR (dacă există)
        if (inv.hasNir && inv.nirId) {
          try {
            const nirRes = await fetch(`/api/pdf/nir/${inv.nirId}?download=1`);
            if (nirRes.ok) {
              const blob = await nirRes.blob();
              const safeNirNum = (inv.nirNumber || String(inv.nirId)).replace(/[^a-zA-Z0-9-_]/g, "_");
              nirFolder?.file(`NIR_${safeNirNum}.pdf`, blob);
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
        companyName={publicInfo.companyName}
        cui={publicInfo.cui}
        companyLogo={publicInfo.logoUrl}
        logoBgColor={publicInfo.logoBgColor}
        logoHasBackground={publicInfo.logoHasBackground}
        themeColor={publicInfo.themeColor}
        onUnlocked={handleUnlockSuccess}
      />
    );
  }

  // 4. Spațiul de lucru principal — DESIGN SYSTEM IDENTIC CU APLICAȚIA
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Header Superior Navigație — Clean White / Dark Slate */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Informații Firmă */}
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
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  {publicInfo.companyName}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
                  <ShieldCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Portal Contabil
                </span>
              </div>
              {publicInfo.cui && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  CUI: {publicInfo.cui}
                </p>
              )}
            </div>
          </div>

          {/* Acțiuni Header */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchData()}
              disabled={isFetching}
              title="Reîmprospătează datele"
              className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-600" : ""}`} />
            </button>
            <button
              onClick={handleLockPortal}
              title="Blochează ecranul / Închide sesiunea"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 hover:border-rose-200 text-slate-700 dark:text-slate-300 transition text-xs font-semibold shadow-2xs"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Închide sesiunea</span>
            </button>
          </div>
        </div>
      </header>

      {/* Corpul Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-5">
        {/* Dashboard Top: 5 Carduri Sintetice KPI — Stil identic cu AllInvoices / Dashboard */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
          {/* Card 1: Total Facturi */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Facturi Primite
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 leading-tight">
                {currentKpis.totalCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">în selecția activă</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Bază Impozabilă */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Bază Impozabilă
              </span>
              <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 leading-tight">
                {formatCurrency(currentKpis.totalBase)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">valoare fără TVA</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-600 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Total TVA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                TVA Deductibil
              </span>
              <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-1 leading-tight">
                {formatCurrency(currentKpis.totalVat)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">sumă totală TVA</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-amber-600 flex items-center justify-center shrink-0">
              <Percent className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Total de Plată */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total de Plată
              </span>
              <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1 leading-tight">
                {formatCurrency(currentKpis.totalGross)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">valoare brută cu TVA</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 text-indigo-600 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
          </div>

          {/* Card 5: Acoperire NIR */}
          <div className="col-span-2 lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="flex-1 mr-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recepții NIR
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  {currentKpis.withNirCount}
                </span>
                <span className="text-xs text-slate-500">/ {currentKpis.totalCount}</span>
                <span className="text-xs font-bold text-teal-600 ml-auto">
                  {currentKpis.nirCoveragePercent}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-teal-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${currentKpis.nirCoveragePercent}%` }}
                />
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-900/40 text-teal-600 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Card Filtre, Căutare & Exporturi — Stil identic cu AllInvoices */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-3.5 space-y-3">
          {/* Rândul 1: Căutare + Perioadă + Filtre */}
          <div className="flex items-center gap-2.5 w-full flex-wrap xl:flex-nowrap">
            {/* Căutare */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Caută furnizor, CUI, număr factură..."
                className="w-full h-8 pl-9 pr-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Perioadă */}
            <div className="w-[160px] sm:w-[180px] flex-shrink-0 relative">
              <Calendar className="w-3.5 h-3.5 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={period}
                onChange={(e: any) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
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

            {/* Filtru NIR */}
            <div className="w-[145px] sm:w-[165px] flex-shrink-0 relative">
              <ClipboardCheck className="w-3.5 h-3.5 text-teal-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={nirFilter}
                onChange={(e: any) => {
                  setNirFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 pl-8 pr-4 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">NIR: Toate</option>
                <option value="cu_nir">✓ Cu NIR generat</option>
                <option value="fara_nir">○ Fără NIR</option>
              </select>
            </div>

            {/* Filtru Furnizor */}
            <div className="w-[150px] sm:w-[180px] flex-shrink-0 relative">
              <Building2 className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 pl-8 pr-4 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer truncate"
              >
                <option value="all">Furnizor: Toți ({allSuppliers.length})</option>
                {allSuppliers.map((supp) => (
                  <option key={supp} value={supp}>
                    {supp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rândul opțional: Interval Personalizat */}
          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-500">De la:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-500">Până la:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Rândul 2: Contor Rezultate + Butoane Export */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500">
              Afișare{" "}
              <span className="font-bold text-slate-900 dark:text-white">{filteredInvoices.length}</span>{" "}
              facturi găsite
              {selectedIds.size > 0 && (
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                  {selectedIds.size} selectate
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Buton Export Excel */}
              <button
                onClick={handleExportExcel}
                disabled={filteredInvoices.length === 0}
                className="h-8 px-3.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel (.xlsx)</span>
              </button>

              {/* Buton Descărcare Pachet ZIP */}
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

              {/* Buton Export XML SAGA */}
              <button
                onClick={handleDownloadSagaXml}
                disabled={downloadSagaXmlMutation.isPending}
                className="h-8 px-3.5 rounded-full text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
              >
                {downloadSagaXmlMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCode className="w-3.5 h-3.5" />
                )}
                <span>Export XML SAGA</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabel Documente Contabile — Stil identic cu AllInvoices */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide select-none">
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === filteredInvoices.length &&
                        filteredInvoices.length > 0
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3 w-12 text-center">Nr.</th>
                  <th className="px-4 py-3">Dată / Scadență</th>
                  <th className="px-4 py-3">Furnizor & CUI</th>
                  <th className="px-4 py-3">Nr. Factură</th>
                  <th className="px-4 py-3 text-right">Bază (fără TVA)</th>
                  <th className="px-4 py-3 text-right">TVA</th>
                  <th className="px-4 py-3 text-right">Total Factură</th>
                  <th className="px-4 py-3">Status NIR</th>
                  <th className="px-4 py-3 text-right">Documente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoadingData ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                    </td>
                  </tr>
                ) : paginatedInvoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-10 text-center text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/20"
                    >
                      Nu a fost găsită nicio factură conform filtrelor selectate.
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((inv, idx) => {
                    const rowNumber = (page - 1) * pageSize + idx + 1;
                    const isSelected = selectedIds.has(inv.id);

                    return (
                      <tr
                        key={inv.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isSelected ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(inv.id)}
                            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* Nr. Crt */}
                        <td className="px-3 py-2.5 text-center font-bold text-xs text-slate-500">
                          {rowNumber}
                        </td>

                        {/* Dată & Scadență */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {formatDate(inv.issueDate)}
                          </div>
                          {inv.dueDate && (
                            <div className="text-[10px] text-slate-400">
                              Scadent: {formatDate(inv.dueDate)}
                            </div>
                          )}
                        </td>

                        {/* Furnizor & CUI */}
                        <td className="px-4 py-2.5 max-w-[220px]">
                          <div
                            className="font-bold text-slate-900 dark:text-white truncate"
                            title={inv.supplierName}
                          >
                            {inv.supplierName}
                          </div>
                          {inv.supplierCUI && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {inv.supplierCUI}
                              </span>
                              <button
                                onClick={(e) => handleCopyCui(inv.supplierCUI, e)}
                                title="Copiază CUI"
                                className="text-slate-400 hover:text-blue-600 transition"
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

                        {/* Număr Factură */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {inv.invoiceNumber}
                          </span>
                        </td>

                        {/* Bază fără TVA */}
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(inv.totalBase, inv.currency)}
                        </td>

                        {/* TVA */}
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                          {formatCurrency(inv.totalVAT, inv.currency)}
                        </td>

                        {/* Total Factură */}
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(inv.total, inv.currency)}
                        </td>

                        {/* Status NIR */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {inv.hasNir ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800">
                              <ClipboardCheck className="w-3 h-3 text-teal-600 shrink-0" />
                              <span>
                                {inv.nirNumber ? `NIR #${inv.nirNumber}` : "Recepționat"}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                              <span>Fără NIR</span>
                            </span>
                          )}
                        </td>

                        {/* Acțiuni Documente */}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Buton Factură PDF */}
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Vizualizează factura PDF"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Factură</span>
                            </a>

                            {/* Buton NIR PDF */}
                            {inv.hasNir && inv.nirId ? (
                              <a
                                href={`/api/pdf/nir/${inv.nirId}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Vizualizează fișa de recepție NIR"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800 transition-colors"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                <span>NIR</span>
                              </a>
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

          {/* Footer Paginare — Identic cu AllInvoices */}
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <span>Rânduri pe pagină:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none cursor-pointer text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-400 ml-2">
                Afișare {filteredInvoices.length > 0 ? (page - 1) * pageSize + 1 : 0}-
                {Math.min(page * pageSize, filteredInvoices.length)} din{" "}
                {filteredInvoices.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition font-medium"
              >
                Anterior
              </button>
              <span className="font-bold text-slate-700 dark:text-slate-300 px-1">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition font-medium"
              >
                Următor
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
