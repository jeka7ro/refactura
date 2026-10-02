import { useState, useMemo, useRef } from "react";
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
  const pageSize = 15;
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
  } = trpc.saga.clienti.list.useQuery();

  // Active dataset according to tab
  const currentDataset = useMemo(() => {
    if (activeTab === "articles") {
      return articles.map((a: any) => ({
        id: a.id,
        code: a.code || a.sagaCode || "—",
        name: a.name,
        category: a.category || "Marfuri",
        account: a.accountingAccount || "371",
        unit: a.unit || "buc",
        vat: `${a.vatRate || 19}%`,
      }));
    } else if (activeTab === "furnizori") {
      return furnizori.map((f: any) => ({
        id: f.id,
        code: f.cod || "—",
        name: f.denumire,
        category: f.cui ? `CUI: ${f.cui}` : "Fără CUI",
        account: f.contFurnizor || "401",
        unit: f.localitate || "—",
        vat: f.judet || "—",
      }));
    } else {
      return clienti.map((c: any) => ({
        id: c.id,
        code: c.cod || "—",
        name: c.denumire,
        category: c.cui ? `CUI: ${c.cui}` : "Fără CUI",
        account: c.contClient || "4111",
        unit: c.localitate || "—",
        vat: c.judet || "—",
      }));
    }
  }, [activeTab, articles, furnizori, clienti]);

  // Filtered dataset
  const filteredDataset = useMemo(() => {
    if (!searchFilter.trim()) return currentDataset;
    const q = searchFilter.toLowerCase();
    return currentDataset.filter(
      (item) =>
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

      const res = await fetch(endpoint, {
        method: "POST",
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
          menu: "Fișiere ➔ Articole",
          button: "Tipărire... ➔ Export în Excel (.xlsx)",
          fields: "COD, DENUMIRE, UM, TVA, DEN_TIP, TIP, COD_BARE",
        };
      case "furnizori":
        return {
          menu: "Fișiere ➔ Furnizori",
          button: "Tipărire... ➔ Export în Excel (.xlsx)",
          fields: "COD, DENUMIRE, COD_FISCAL (CUI), REG_COM, ADRESA, CONT_ANALITIC",
        };
      case "clienti":
        return {
          menu: "Fișiere ➔ Clienți",
          button: "Tipărire... ➔ Export în Excel (.xlsx)",
          fields: "COD, DENUMIRE, COD_FISCAL (CUI), REG_COM, ADRESA, CONT_ANALITIC",
        };
    }
  };

  const helpPath = getSagaPathHelp(activeTab);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <Link href="/dashboard" className="hover:text-blue-600 transition-colors">
            Acasă
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/saga" className="hover:text-blue-600 transition-colors">
            Modul SAGA
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 dark:text-slate-200 font-semibold">
            Sincronizare Nomenclator
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/saga"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            Deschide Modul SAGA
          </Link>
          <Link
            href="/nir"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 transition-colors"
          >
            <Package className="w-3.5 h-3.5" />
            Mergi la Gestiune NIR
          </Link>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Sincronizare Date SAGA C.3.0
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Actualizare Nomenclator din SAGA
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Păstrează biblioteca de articole și coduri sincronizată 1:1 cu contabilitatea din
              SAGA. Încarcă fișierul exportat din SAGA pentru a preveni coliziunile de denumiri,
              dublurile de stoc și nepotrivirile la importul fișierelor XML.
            </p>
          </div>

          <div className="flex md:flex-col gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center min-w-[130px]">
              <div className="text-2xl font-bold text-white">
                {loadingArticles ? "..." : articles.length}
              </div>
              <div className="text-[11px] text-blue-200 uppercase tracking-wider font-medium">
                Articole SAGA
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-center min-w-[130px]">
              <div className="text-2xl font-bold text-emerald-400">
                {loadingFurnizori ? "..." : furnizori.length}
              </div>
              <div className="text-[11px] text-blue-200 uppercase tracking-wider font-medium">
                Furnizori SAGA
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Articole / Furnizori / Clienti */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => {
            setActiveTab("articles");
            setSelectedFile(null);
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "articles"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Package className="w-4 h-4" />
          Nomenclator Articole
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "articles"
                ? "bg-blue-700 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            {articles.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("furnizori");
            setSelectedFile(null);
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "furnizori"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Nomenclator Furnizori
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "furnizori"
                ? "bg-blue-700 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            {furnizori.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("clienti");
            setSelectedFile(null);
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "clienti"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          Nomenclator Clienți
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === "clienti"
                ? "bg-blue-700 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            {clienti.length}
          </span>
        </button>
      </div>

      {/* Visual Step-by-Step Guidance */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" />
            Ghid simplu în 3 pași pentru {getTabLabel(activeTab)}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Timp estimat: 1 minut
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pasul 1 */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  În SAGA Desktop
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Exportă lista din SAGA
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Deschide programul SAGA pe calculatorul tău. Mergi în meniul de sus la:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 font-mono text-xs text-blue-700 dark:text-blue-300 font-semibold">
                {helpPath.menu}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Apasă butonul de jos:
              </p>
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                👉 {helpPath.button}
              </div>
            </div>
          </div>

          {/* Pasul 2 */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                  În Smart Invoice
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Încarcă fișierul aici
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Trage fișierul Excel descărcat din SAGA în chenarul de mai jos sau apasă pentru a-l
                alege din fișierele tale.
              </p>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="font-semibold text-slate-800 dark:text-white mb-1">
                  Coloane recunoscute automat:
                </div>
                <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 break-words">
                  {helpPath.fields}
                </div>
              </div>
            </div>
          </div>

          {/* Pasul 3 */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                  Automat & Sigur
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Sincronizare 1:1
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Aplicația adaugă automat noile coduri și actualizează denumirile fără să creeze
                dubluri.
              </p>
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium space-y-1">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Nu se șterge niciun istoric sau NIR vechi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Fără coliziuni de coduri sau denumiri</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Container */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Zona de Încărcare & Sincronizare
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Selectează fișierul exportat din SAGA pentru {getTabLabel(activeTab).toLowerCase()}.
            </p>
          </div>
          {selectedFile && (
            <button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
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
          className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]"
              : selectedFile
              ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10"
              : "border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
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
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform ${
                selectedFile
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                  : isDragging
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 scale-110"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {selectedFile ? (
                <FileSpreadsheet className="w-8 h-8" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <div className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  {selectedFile.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Dimensiune: {(selectedFile.size / 1024).toFixed(1)} KB • Gata pentru sincronizare
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-200">
                  Trage fișierul SAGA aici sau{" "}
                  <span className="text-blue-600 dark:text-blue-400 hover:underline">
                    răsfoiește calculatorul
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Acceptă fișiere Excel (.xlsx, .xls) sau CSV exportate direct din SAGA C.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Actualizarea rescrie doar informațiile de catalog și nu afectează facturile existente.
            </span>
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
              !selectedFile || isUploading
                ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25 active:scale-95"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isUploading ? "animate-spin" : ""}`} />
            {isUploading ? "Se sincronizează..." : `Sincronizează ${getTabLabel(activeTab)} Acum`}
          </button>
        </div>

        {/* Feedback / Results banner if just synced */}
        {lastSyncResult && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold">
                  Sincronizare finalizată cu succes la ora {lastSyncResult.timestamp}
                </div>
                <div className="text-xs opacity-90">
                  {lastSyncResult.imported} înregistrări importate/actualizate,{" "}
                  {lastSyncResult.skipped} rânduri omise din total {lastSyncResult.total}.
                </div>
              </div>
            </div>
            <button
              onClick={() => setLastSyncResult(null)}
              className="text-xs text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Închide mesajul
            </button>
          </div>
        )}
      </div>

      {/* Explorer / Verification Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              Catalog Sincronizat ({filteredDataset.length}{" "}
              {activeTab === "articles" ? "articole" : "înregistrări"})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verifică instantaneu dacă articolele și codurile din SAGA se regăsesc în baza de date.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Caută după cod SAGA, denumire..."
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-28">Cod SAGA</th>
                <th className="py-3 px-4">Denumire Înregistrare</th>
                <th className="py-3 px-4 w-40">
                  {activeTab === "articles" ? "Categorie / Tip" : "Identificator"}
                </th>
                <th className="py-3 px-4 w-24">Cont</th>
                <th className="py-3 px-4 w-20">U/M</th>
                <th className="py-3 px-4 w-20 text-right">TVA / Reg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {searchFilter
                      ? `Niciun rezultat găsit pentru „${searchFilter}”.`
                      : "Nu există încă date sincronizate. Încarcă un fișier exportat din SAGA mai sus."}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {row.code}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                      {row.name}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {row.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {row.account}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">{row.unit}</td>
                    <td className="py-2.5 px-4 text-right font-medium">{row.vat}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <div>
              Afișare {(page - 1) * pageSize + 1} -{" "}
              {Math.min(page * pageSize, filteredDataset.length)} din {filteredDataset.length}{" "}
              înregistrări
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Anterior
              </button>
              <span className="px-3 py-1 font-semibold text-slate-700 dark:text-slate-300">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Următor
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FAQ & Explanations */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          Întrebări Frecvente & Reguli de Funcționare
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white">
              Ce se întâmplă dacă un articol de pe o factură nu există încă în SAGA?
            </h4>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              La crearea NIR-ului, articolul nou rămâne fără cod alocat. Când importați fișierul XML
              în SAGA, programul SAGA îi alocă automat următorul cod disponibil din gestiunea
              contabilei. Ulterior, când veți face un nou export din SAGA, codul va fi preluat și
              aici.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white">
              Cât de des este recomandat să sincronizez datele?
            </h4>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Este recomandat să faceți o sincronizare o dată pe lună sau de fiecare dată când
              contabila introduce o listă nouă de articole / coduri de stoc în SAGA Desktop.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white">
              Se pot strica NIR-urile sau facturile deja salvate?
            </h4>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Nu. Sincronizarea actualizează doar nomenclatorul de referință (numele și conturile).
              Documentele deja emise și validate rămân nemodificate și conforme cu evidența
              contabilă.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white">
              Cum previne această sincronizare erorile de denumire?
            </h4>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
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
