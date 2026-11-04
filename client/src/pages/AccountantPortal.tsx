import { useState, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import {
  FileText,
  Download,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Package,
  Layers,
  Building2,
  Lock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Coins,
  Receipt,
  Percent,
  RefreshCw,
  FileCode,
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
  const [period, setPeriod] = useState<"current_month" | "last_month" | "last_3_months" | "current_year" | "all" | "custom">("current_month");
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-sm text-slate-300">Se încarcă portalul de contabilitate...</p>
      </div>
    );
  }

  // 2. Portal negăsit sau dezactivat
  if (!publicInfo?.found || !publicInfo.isEnabled) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-white shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">Portal Contabil Indisponibil</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Acest portal nu este activ sau link-ul accesat este invalid. Vă rugăm să contactați
            administratorul firmei pentru a primi link-ul corect sau pentru a activa accesul.
          </p>
        </div>
      </div>
    );
  }

  // 3. Ecran de blocare PIN
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

  // 4. Spațiul de lucru principal (Portalul Contabilului)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header Superior Navigație */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Informații Firmă */}
          <div className="flex items-center gap-3">
            {publicInfo.logoUrl ? (
              <div
                className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-white/10 shrink-0"
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
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight leading-none">
                  {publicInfo.companyName}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  Portal Contabil
                </span>
              </div>
              {publicInfo.cui && (
                <p className="text-xs text-slate-400 font-mono mt-0.5">
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
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition border border-slate-700/60 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLockPortal}
              title="Blochează ecranul / Închide sesiunea"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 transition border border-slate-700/60 hover:border-rose-500/30 text-xs font-medium"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Închide sesiunea</span>
            </button>
          </div>
        </div>
      </header>

      {/* Corpul Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Dashboard Top: Carduri Sintetice KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Total Facturi */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Facturi Primite</span>
              <FileText className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {currentKpis.totalCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">în perioada selectată</div>
          </div>

          {/* Card 2: Bază fără TVA */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Bază Impozabilă</span>
              <Coins className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">
              {formatCurrency(currentKpis.totalBase)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">valoare fără TVA</div>
          </div>

          {/* Card 3: TVA Total */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">TVA Deductibil</span>
              <Percent className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 tracking-tight">
              {formatCurrency(currentKpis.totalVat)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">sumă totală TVA</div>
          </div>

          {/* Card 4: Total General */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total de Plată</span>
              <Receipt className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-violet-300 tracking-tight">
              {formatCurrency(currentKpis.totalGross)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">valoare brută cu TVA</div>
          </div>

          {/* Card 5: Acoperire NIR */}
          <div className="col-span-2 lg:col-span-1 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Recepții NIR</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-white tracking-tight">
                  {currentKpis.withNirCount}
                </div>
                <span className="text-xs text-slate-400">din {currentKpis.totalCount}</span>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Rată recepție</span>
                <span className="font-semibold text-emerald-400">
                  {currentKpis.nirCoveragePercent}%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${currentKpis.nirCoveragePercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bara de Filtre, Căutare și Instrumente Export */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-sm">
          {/* Rândul 1: Căutare + Perioadă + Filtre */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Căutare */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Caută furnizor, CUI, nr. factură..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 text-xs text-white placeholder-slate-500 transition outline-none"
              />
            </div>

            {/* Perioadă */}
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={period}
                onChange={(e: any) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 text-xs text-white appearance-none cursor-pointer transition outline-none"
              >
                <option value="current_month">Luna curentă</option>
                <option value="last_month">Luna anterioară</option>
                <option value="last_3_months">Ultimele 3 luni</option>
                <option value="current_year">Anul curent</option>
                <option value="all">Toate facturile</option>
                <option value="custom">Interval personalizat...</option>
              </select>
            </div>

            {/* Filtru NIR */}
            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={nirFilter}
                onChange={(e: any) => {
                  setNirFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 text-xs text-white appearance-none cursor-pointer transition outline-none"
              >
                <option value="all">Status NIR: Toate</option>
                <option value="cu_nir">Doar cu NIR generat</option>
                <option value="fara_nir">Doar fără NIR</option>
              </select>
            </div>

            {/* Filtru Furnizor */}
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 text-xs text-white appearance-none cursor-pointer transition outline-none"
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
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-800/60">
              <span className="text-xs text-slate-400">De la:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-slate-400">Până la:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Rândul 2: Contor Rezultate + Butoane Export */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
            <div className="text-xs text-slate-400">
              Afișare{" "}
              <span className="font-semibold text-white">{filteredInvoices.length}</span>{" "}
              facturi găsite
              {selectedIds.size > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  {selectedIds.size} selectate
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Buton Export Excel */}
              <button
                onClick={handleExportExcel}
                disabled={filteredInvoices.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition disabled:opacity-40"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel (.xlsx)</span>
              </button>

              {/* Buton Descărcare Pachet ZIP */}
              <button
                onClick={handleDownloadZipBundle}
                disabled={filteredInvoices.length === 0 || isDownloadingZip}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition disabled:opacity-40"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-xs font-semibold transition disabled:opacity-40"
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

        {/* Tabel Documente Contabile */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[11px] tracking-wider select-none font-semibold">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === filteredInvoices.length &&
                        filteredInvoices.length > 0
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 w-12 text-center">Nr.</th>
                  <th className="p-3">Dată / Scadență</th>
                  <th className="p-3">Furnizor & CUI</th>
                  <th className="p-3">Nr. Factură</th>
                  <th className="p-3 text-right">Bază (fără TVA)</th>
                  <th className="p-3 text-right">TVA</th>
                  <th className="p-3 text-right">Total Factură</th>
                  <th className="p-3">Status NIR</th>
                  <th className="p-3 text-right">Documente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-slate-500">
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
                        className={`transition hover:bg-slate-800/40 ${
                          isSelected ? "bg-emerald-950/20" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(inv.id)}
                            className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                          />
                        </td>

                        {/* Nr. Crt */}
                        <td className="p-3 text-center text-slate-500 font-mono">
                          {rowNumber}
                        </td>

                        {/* Dată & Scadență */}
                        <td className="p-3">
                          <div className="font-medium text-slate-200">
                            {formatDate(inv.issueDate)}
                          </div>
                          {inv.dueDate && (
                            <div className="text-[10px] text-slate-500">
                              Scadent: {formatDate(inv.dueDate)}
                            </div>
                          )}
                        </td>

                        {/* Furnizor & CUI */}
                        <td className="p-3 max-w-[200px]">
                          <div
                            className="font-semibold text-white truncate"
                            title={inv.supplierName}
                          >
                            {inv.supplierName}
                          </div>
                          {inv.supplierCUI && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-slate-400">
                                {inv.supplierCUI}
                              </span>
                              <button
                                onClick={(e) => handleCopyCui(inv.supplierCUI, e)}
                                title="Copiază CUI"
                                className="text-slate-500 hover:text-emerald-400 transition"
                              >
                                {copiedCui === inv.supplierCUI ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Număr Factură */}
                        <td className="p-3">
                          <span className="font-mono font-medium text-slate-200 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">
                            {inv.invoiceNumber}
                          </span>
                        </td>

                        {/* Bază fără TVA */}
                        <td className="p-3 text-right font-mono text-slate-300">
                          {formatCurrency(inv.totalBase, inv.currency)}
                        </td>

                        {/* TVA */}
                        <td className="p-3 text-right font-mono text-amber-400/90">
                          {formatCurrency(inv.totalVAT, inv.currency)}
                        </td>

                        {/* Total Factură */}
                        <td className="p-3 text-right font-mono font-bold text-white">
                          {formatCurrency(inv.total, inv.currency)}
                        </td>

                        {/* Status NIR */}
                        <td className="p-3">
                          {inv.hasNir ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {inv.nirNumber ? `NIR #${inv.nirNumber}` : "Recepționat"}
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700/60 text-[11px]">
                              <span>Fără NIR</span>
                            </div>
                          )}
                        </td>

                        {/* Acțiuni Documente */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Buton Factură PDF */}
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Vizualizează factura PDF originală"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition text-[11px] font-medium"
                            >
                              <FileText className="w-3.5 h-3.5 text-sky-400" />
                              <span>Factură</span>
                            </a>

                            {/* Buton NIR PDF */}
                            {inv.hasNir && inv.nirId ? (
                              <a
                                href={`/api/pdf/nir/${inv.nirId}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Vizualizează fișa de recepție NIR"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 transition text-[11px] font-medium"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
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

          {/* Footer Paginare */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rânduri pe pagină:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-white outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-500 ml-2">
                Afișare {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, filteredInvoices.length)} din{" "}
                {filteredInvoices.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-slate-300 px-2">
                Pagina {page} din {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

