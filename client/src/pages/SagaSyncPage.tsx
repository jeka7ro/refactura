import { useState, useMemo, useRef } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { Link } from "wouter";
import {
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Package,
  Users,
  Building2,
  Search,
  ExternalLink,
  HelpCircle,
  Sparkles,
  Info,
  X,
  FileText,
  ChevronRight,
  Sliders,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type SyncType = "articles" | "furnizori" | "clienti";

export default function SagaSyncPage() {
  const [activeTab, setActiveTab] = useState<SyncType>("articles");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentRowsPerPage("saga_sync", 15);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    imported: number;
    skipped: number;
    total: number;
    timestamp: string;
  } | null>(null);

  // User / Tenant
  const { data: me } = trpc.auth.me.useQuery();
  const tenantId = me?.tenantId || 1;

  // Real data queries
  const {
    data: articles = [],
    refetch: refetchArticles,
    isLoading: loadingArticles,
  } = trpc.saga.articles.list.useQuery();

  const {
    data: furnizori = [],
    refetch: refetchFurnizori,
    isLoading: loadingFurnizori,
  } = trpc.saga.furnizori.list.useQuery();

  const {
    data: clienti = [],
    refetch: refetchClienti,
    isLoading: loadingClienti,
  } = trpc.clients.list.useQuery();

  // Active dataset according to tab
  const currentDataset = useMemo(() => {
    if (activeTab === "articles") {
      return articles.map((a: any) => ({
        id: a.id,
        code: a.code || a.sagaCode || "—",
        name: a.name || "",
        category: a.category || "Marfuri",
        account: a.accountingAccount || "371",
        unit: a.unit || "buc",
        vat: `${a.vatRate ?? 21}%`,
      }));
    } else if (activeTab === "furnizori") {
      return furnizori.map((f: any) => ({
        id: f.id,
        code: f.cod || "—",
        name: f.denumire || "",
        category: f.cui ? `CUI: ${f.cui}` : "Fără CUI",
        account: f.contFurnizor || "401",
        unit: f.localitate || "—",
        vat: f.judet || "—",
      }));
    } else {
      return clienti.map((c: any) => ({
        id: c.id,
        code: c.sagaCode || "-",
        name: c.name || "",
        category: c.cui ? `CUI: ${c.cui}` : "Fără CUI",
        account: c.contClient || "4111",
        unit: c.city || "—",
        vat: c.regCom || "—",
      }));
    }
  }, [activeTab, articles, furnizori, clienti]);

  // Filtered dataset
  const filteredDataset = useMemo(() => {
    if (!searchFilter.trim()) return currentDataset;
    const q = searchFilter.toLowerCase();
    return currentDataset.filter(
      (item: any) =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.account.toLowerCase().includes(q)
    );
  }, [currentDataset, searchFilter]);

  const totalPages = Math.ceil(filteredDataset.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDataset.slice(start, start + pageSize);
  }, [filteredDataset, page, pageSize]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validExtensions = [".xlsx", ".xls", ".csv", ".txt"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      toast.error(
        `Formatul fișierului nu este acceptat (${fileExt}). Te rugăm să încarci un fișier Excel (.xlsx, .xls) sau CSV exportat din SAGA.`
      );
      return;
    }

    setSelectedFile(file);
    toast.success(`Fișier selectat: ${file.name}`);
  };

  // Perform upload
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Selectează mai întâi un fișier de export din SAGA.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Se sincronizează datele cu baza de date...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("tenantId", String(tenantId));

      let endpoint = "/api/saga/import-articles";
      if (activeTab === "furnizori") endpoint = "/api/saga/import-furnizori";
      if (activeTab === "clienti") endpoint = "/api/saga/import-clienti";

      const token = localStorage.getItem("authToken");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Eroare server la import (${res.status})`);
      }

      const result = await res.json();
      const importedCount = result.imported ?? 0;
      const skippedCount = result.skipped ?? 0;
      const totalCount = result.total ?? (importedCount + skippedCount);

      setLastSyncResult({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        total: totalCount,
        timestamp: new Date().toLocaleTimeString("ro-RO", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });

      toast.success(
        `Sincronizare reușită: ${importedCount} înregistrări sincronizate din total ${totalCount}.`,
        { id: toastId }
      );

      // Refresh data
      if (activeTab === "articles") refetchArticles();
      if (activeTab === "furnizori") refetchFurnizori();
      if (activeTab === "clienti") refetchClienti();

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("[SagaSyncPage] Upload error:", err);
      toast.error(err.message || "Eroare necunoscută la sincronizare", {
        id: toastId,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getTabLabel = (tab: SyncType) => {
    switch (tab) {
      case "articles":
        return "Articole & Nomenclator";
      case "furnizori":
        return "Furnizori";
      case "clienti":
        return "Clienți";
    }
  };

  const getSagaPathHelp = (tab: SyncType) => {
    switch (tab) {
      case "articles":
        return {
          menu: "Fișiere Articole",
          button: "Tipărire... Export în Excel (.xlsx)",
          fields: "COD, DENUMIRE, UM, TVA, DEN_TIP, TIP, COD_BARE",
        };
      case "furnizori":
        return {
          menu: "Fișiere Furnizori",
          button: "Tipărire... Export în Excel (.xlsx)",
          fields: "COD, DENUMIRE, COD_FISCAL (CUI), REG_COM, ADRESA, CONT_ANALITIC",
        };
      case "clienti":
        return {
          menu: "Fișiere Clienți",
          button: "Tipărire... Export în Excel (.xlsx)",
          fields: "COD, DENUMIRE, COD_FISCAL (CUI), REG_COM, ADRESA, CONT_ANALITIC",
        };
    }
  };

  const helpPath = getSagaPathHelp(activeTab);

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] font-medium">
          <Link href="/dashboard" className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors">
            Acasă
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#8e8e93]" />
          <Link href="/saga" className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors">
            Modul SAGA
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#8e8e93]" />
          <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
            Sincronizare Nomenclator
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/saga"
            className="apple-btn-glass inline-flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            <Database className="w-3.5 h-3.5" />
            Deschide Modul SAGA
          </Link>
          <Link
            href="/nir"
            className="apple-btn-prominent inline-flex items-center gap-1.5 h-9 px-4 text-[12.5px] font-semibold"
          >
            <Package className="w-3.5 h-3.5" />
            Mergi la Gestiune NIR
          </Link>
        </div>
      </div>

      {/* Window Header */}
      <div className="min-w-0">
        <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
          Actualizare Nomenclator din SAGA
        </h1>
        <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 max-w-3xl">
          Păstrează biblioteca de articole, furnizori și clienți sincronizată 1:1 cu contabilitatea din SAGA C.3.0 pentru a preveni dublurile de stoc și nepotrivirile XML.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Articole SAGA
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
            {loadingArticles ? "..." : articles.length}
          </span>
        </div>

        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Furnizori SAGA
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
            {loadingFurnizori ? "..." : furnizori.length}
          </span>
        </div>

        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Clienți SAGA
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </span>
          </div>
          <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
            {loadingClienti ? "..." : clienti.length}
          </span>
        </div>
      </div>

      {/* Tabs Toolbar for Articole / Furnizori / Clienți */}
      <div className="apple-surface px-3 py-2.5">
        <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar">
          <button
            type="button"
            data-active={activeTab === "articles"}
            onClick={() => {
              setActiveTab("articles");
              setSelectedFile(null);
              setPage(1);
            }}
            className="apple-segmented-item px-3.5 shrink-0 tabular-nums"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Nomenclator Articole</span>
            <span className="opacity-75">({articles.length})</span>
          </button>

          <button
            type="button"
            data-active={activeTab === "furnizori"}
            onClick={() => {
              setActiveTab("furnizori");
              setSelectedFile(null);
              setPage(1);
            }}
            className="apple-segmented-item px-3.5 shrink-0 tabular-nums"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Nomenclator Furnizori</span>
            <span className="opacity-75">({furnizori.length})</span>
          </button>

          <button
            type="button"
            data-active={activeTab === "clienti"}
            onClick={() => {
              setActiveTab("clienti");
              setSelectedFile(null);
              setPage(1);
            }}
            className="apple-segmented-item px-3.5 shrink-0 tabular-nums"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Nomenclator Clienți</span>
            <span className="opacity-75">({loadingClienti ? "..." : clienti.length})</span>
          </button>
        </div>
      </div>

      {/* Visual Step-by-Step Guidance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
            Ghid simplu în 3 pași pentru {getTabLabel(activeTab)}
          </h2>
          <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            Timp estimat: 1 minut
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Pasul 1 */}
          <div className="apple-surface p-4 sm:p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] text-[#0071e3] dark:text-[#0a84ff] font-bold text-xs flex items-center justify-center tabular-nums">
                  1
                </span>
                <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2.5 py-0.5 rounded-full">
                  În SAGA Desktop
                </span>
              </div>
              <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Exportă lista din SAGA
              </h3>
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
                Deschide programul SAGA pe calculatorul tău. Mergi în meniul de sus la:
              </p>
              <div className="p-2.5 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] tabular-nums text-[12px] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {helpPath.menu}
              </div>
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                Apasă butonul de jos:
              </p>
              <div className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-[11.5px] text-amber-800 dark:text-amber-300 font-medium">
                {helpPath.button}
              </div>
            </div>
          </div>

          {/* Pasul 2 */}
          <div className="apple-surface p-4 sm:p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] text-[#0071e3] dark:text-[#0a84ff] font-bold text-xs flex items-center justify-center tabular-nums">
                  2
                </span>
                <span className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2.5 py-0.5 rounded-full">
                  În Smart Invoice
                </span>
              </div>
              <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Încarcă fișierul aici
              </h3>
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
                Trage fișierul Excel descărcat din SAGA în chenarul de mai jos sau apasă pentru a-l
                alege din fișierele tale.
              </p>
              <div className="p-2.5 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] text-[11.5px]">
                <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">
                  Coloane recunoscute automat:
                </div>
                <div className="tabular-nums text-[11px] text-[#6e6e73] dark:text-[#98989d] break-words">
                  {helpPath.fields}
                </div>
              </div>
            </div>
          </div>

          {/* Pasul 3 */}
          <div className="apple-surface p-4 sm:p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center tabular-nums">
                  3
                </span>
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/18 px-2.5 py-0.5 rounded-full">
                  Automat & Sigur
                </span>
              </div>
              <h3 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Sincronizare 1:1
              </h3>
              <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
                Aplicația adaugă automat noile coduri și actualizează denumirile fără să creeze
                dubluri.
              </p>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-[11.5px] text-emerald-800 dark:text-emerald-300 font-medium space-y-1">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Nu se șterge niciun istoric sau NIR vechi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Fără coliziuni de coduri sau denumiri</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Container */}
      <div className="apple-surface p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Zona de încărcare & sincronizare
            </h2>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5">
              Selectează fișierul exportat din SAGA pentru {getTabLabel(activeTab).toLowerCase()}.
            </p>
          </div>
          {selectedFile && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="apple-btn-glass px-3 h-8 text-[12px] text-rose-600 dark:text-rose-400 font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Anulează selecția
            </button>
          )}
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 md:p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-[#0071e3] bg-[#0071e3]/[0.05] dark:bg-[#0a84ff]/[0.10] scale-[0.99]"
              : selectedFile
              ? "border-emerald-500/50 bg-emerald-500/[0.05] dark:bg-emerald-500/[0.08]"
              : "border-black/[0.12] dark:border-white/[0.14] hover:border-[#0071e3] hover:bg-[#f5f5f7]/60 dark:hover:bg-white/[0.03]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
                selectedFile
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : isDragging
                  ? "bg-[#0071e3]/15 text-[#0071e3] dark:text-[#0a84ff] scale-110"
                  : "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]"
              }`}
            >
              {selectedFile ? (
                <FileSpreadsheet className="w-7 h-7" />
              ) : (
                <UploadCloud className="w-7 h-7" />
              )}
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <div className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {selectedFile.name}
                </div>
                <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                  Dimensiune: {(selectedFile.size / 1024).toFixed(1)} KB • Gata pentru sincronizare
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-[14px] md:text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Trage fișierul SAGA aici sau{" "}
                  <span className="text-[#0071e3] dark:text-[#64d2ff] hover:underline">
                    răsfoiește calculatorul
                  </span>
                </div>
                <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                  Acceptă fișiere Excel (.xlsx, .xls) sau CSV exportate direct din SAGA C.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          <div className="text-[12px] text-[#6e6e73] dark:text-[#98989d] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Actualizarea rescrie doar informațiile de catalog și nu afectează facturile existente.
            </span>
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className={`w-full sm:w-auto px-5 h-10 rounded-full font-semibold text-[13px] flex items-center justify-center gap-2 transition-all ${
              !selectedFile || isUploading
                ? "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#8e8e93] cursor-not-allowed"
                : "apple-btn-prominent cursor-pointer"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isUploading ? "animate-spin" : ""}`} />
            {isUploading ? "Se sincronizează..." : `Sincronizează ${getTabLabel(activeTab)} acum`}
          </button>
        </div>

        {/* Feedback / Results banner if just synced */}
        {lastSyncResult && (
          <div className="mt-2 p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-900 dark:text-emerald-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[13.5px] font-semibold tabular-nums">
                  Sincronizare finalizată cu succes la ora {lastSyncResult.timestamp}
                </div>
                <div className="text-[12px] opacity-90 tabular-nums">
                  {lastSyncResult.imported} înregistrări importate/actualizate,{" "}
                  {lastSyncResult.skipped} rânduri omise din total {lastSyncResult.total}.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLastSyncResult(null)}
              className="text-[12px] font-medium text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
            >
              Închide mesajul
            </button>
          </div>
        )}
      </div>

      {/* Explorer / Verification Toolbar + Table */}
      <div className="apple-surface px-3 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0 px-1">
          <Database className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate tabular-nums">
              Catalog sincronizat ({filteredDataset.length}{" "}
              {activeTab === "articles" ? "articole" : "înregistrări"})
            </h2>
          </div>
        </div>

        <div className="apple-pill-control relative flex items-center w-full md:w-80 px-3">
          <Search className="w-3.5 h-3.5 text-[#8e8e93] shrink-0 mr-2" />
          <input
            type="text"
            placeholder="Caută după cod SAGA, denumire..."
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              setPage(1);
            }}
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchFilter("");
                setPage(1);
              }}
              className="text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] ml-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="py-3 px-4 w-28 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Cod SAGA
                </th>
                <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Denumire înregistrare
                </th>
                <th className="py-3 px-4 w-40 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  {activeTab === "articles" ? "Categorie / Tip" : "Identificator"}
                </th>
                <th className="py-3 px-4 w-24 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Cont
                </th>
                <th className="py-3 px-4 w-20 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  U/M
                </th>
                <th className="py-3 px-4 w-24 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  TVA / Reg
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]"
                  >
                    {searchFilter
                      ? `Niciun rezultat găsit pentru „${searchFilter}”.`
                      : "Nu există încă date sincronizate. Încarcă un fișier exportat din SAGA mai sus."}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row: any) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                  >
                    <td className="py-3 px-4 text-[13px] tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {row.code}
                    </td>
                    <td className="py-3 px-4 text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {row.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5]">
                        {row.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[13px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                      {row.account}
                    </td>
                    <td className="py-3 px-4 text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                      {row.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-[13px] font-medium tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {row.vat}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredDataset.length > 0 && (
          <div className="flex items-center justify-between text-[12px] text-[#6e6e73] dark:text-[#98989d] px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-2">
                Afișează
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="apple-pill-control !h-7 px-2.5 text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] outline-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={9999}>Toți</option>
                </select>
              </span>
              <span className="tabular-nums">
                Afișare {(page - 1) * pageSize + 1} –{" "}
                {Math.min(page * pageSize, filteredDataset.length)} din {filteredDataset.length}{" "}
                înregistrări
              </span>
            </div>
            <div className="flex items-center gap-1.5 tabular-nums">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="apple-btn-glass px-3 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <span className="px-2.5 py-1 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="apple-btn-glass px-3 h-8 text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer"
              >
                Următor
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FAQ & Explanations */}
      <div className="apple-surface p-5 sm:p-6 space-y-4">
        <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
          Întrebări frecvente & reguli de funcționare
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12.5px]">
          <div className="p-4 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] space-y-1.5">
            <h4 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Ce se întâmplă dacă un articol de pe o factură nu există încă în SAGA?
            </h4>
            <p className="text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
              La crearea NIR-ului, articolul nou rămâne fără cod alocat. Când importați fișierul XML
              în SAGA, programul SAGA îi alocă automat următorul cod disponibil din gestiunea
              contabilei. Ulterior, când veți face un nou export din SAGA, codul va fi preluat și
              aici.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] space-y-1.5">
            <h4 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Cât de des este recomandat să sincronizez datele?
            </h4>
            <p className="text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
              Este recomandat să faceți o sincronizare o dată pe lună sau de fiecare dată când
              contabila introduce o listă nouă de articole / coduri de stoc în SAGA Desktop.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] space-y-1.5">
            <h4 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Se pot strica NIR-urile sau facturile deja salvate?
            </h4>
            <p className="text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
              Nu. Sincronizarea actualizează doar nomenclatorul de referință (numele și conturile).
              Documentele deja emise și validate rămân nemodificate și conforme cu evidența
              contabilă.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#f2f2f7] dark:bg-[#2c2c2e] border border-black/[0.04] dark:border-white/[0.06] space-y-1.5">
            <h4 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Cum previne această sincronizare erorile de denumire?
            </h4>
            <p className="text-[#6e6e73] dark:text-[#98989d] leading-relaxed">
              Când generați un NIR, aplicația caută mai întâi denumirea în biblioteca SAGA. Dacă
              găsește articolul existent, trimite exact codul lui oficial către SAGA, împiedicând
              crearea de dubluri în gestiune.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
