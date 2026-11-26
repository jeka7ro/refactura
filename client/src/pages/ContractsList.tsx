import { useState, useMemo, useRef } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  FileText,
  Plus,
  Upload,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSignature,
  FileCheck,
  Tag,
  History,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ContractsList() {
  const [, setLocation] = useLocation();

  // Filters & Pagination (SmartDevize Rules)
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("toate");
  const [filterPartnerType, setFilterPartnerType] = useState<string>("toate"); // 'toate' | 'client' | 'supplier'
  const [filterStatus, setFilterStatus] = useState<string>("toate");
  const [page, setPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("contracts_list", 15);

  // Queries
  const { data: stats, isLoading: loadingStats } = trpc.contracts.getStats.useQuery();
  const {
    data: rawContracts = [],
    isLoading: loadingList,
    refetch,
  } = trpc.contracts.list.useQuery({
    type: filterType !== "toate" ? filterType : undefined,
    status: filterStatus !== "toate" ? filterStatus : undefined,
    isSupplier:
      filterPartnerType === "client" ? 0 : filterPartnerType === "supplier" ? 1 : undefined,
  });

  const { data: partners = [] } = trpc.clients.list.useQuery();

  // Search & Filter in memory for instant responsiveness and exact filtered / total counts
  const filteredContracts = useMemo(() => {
    if (!search.trim()) return rawContracts;
    const s = search.toLowerCase().trim();
    return rawContracts.filter((c: any) =>
      (c.number && c.number.toLowerCase().includes(s)) ||
      (c.title && c.title.toLowerCase().includes(s)) ||
      (c.partnerName && c.partnerName.toLowerCase().includes(s)) ||
      (c.partnerCui && c.partnerCui.toLowerCase().includes(s)) ||
      (c.partnerSagaCode && c.partnerSagaCode.toLowerCase().includes(s))
    );
  }, [rawContracts, search]);

  const totalCount = filteredContracts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / (rowsPerPage === 9999 ? 1 : rowsPerPage)));
  const safePage = Math.min(page, totalPages);
  const paginatedContracts = rowsPerPage === 9999
    ? filteredContracts
    : filteredContracts.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  // Audit Log Drawer / Modal state
  const [activeLogContractId, setActiveLogContractId] = useState<number | null>(null);
  const { data: activeContractData } = trpc.contracts.getById.useQuery(
    { id: activeLogContractId || 0 },
    { enabled: !!activeLogContractId }
  );

  // New log form inside drawer
  const [newLogExplanation, setNewLogExplanation] = useState("");
  const [newLogActionType, setNewLogActionType] = useState("modificare_termeni");
  const [logError, setLogError] = useState("");

  const addLogMutation = trpc.contracts.addLog.useMutation({
    onSuccess: () => {
      setNewLogExplanation("");
      setLogError("");
      refetch();
    },
    onError: (err) => {
      setLogError("Eroare salvare notă: " + err.message);
    },
  });

  // Bulk Import Modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importingFiles, setImportingFiles] = useState(false);
  const [isDraggingImport, setIsDraggingImport] = useState(false);
  const [uploadedQueue, setUploadedQueue] = useState<any[]>([]);
  const [globalExplanation, setGlobalExplanation] = useState("Preluare și arhivare contracte existente");
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkImportMutation = trpc.contracts.bulkImport.useMutation({
    onSuccess: (res) => {
      setImportingFiles(false);
      setShowImportModal(false);
      setUploadedQueue([]);
      toast.success(`${res.count} contract(e) importate cu succes în bibliotecă!`);
      refetch();
    },
    onError: (err) => {
      setImportingFiles(false);
      setImportError("Eroare la import: " + err.message);
      toast.error("Eroare la import: " + err.message);
    },
  });

  const processImportFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setImportingFiles(true);
    setImportError("");

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch("/api/upload-contract", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Eroare server (${res.status}) la încărcarea documentului`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Eroare la încărcare pe server");
      }

      // Map detected files with partners in memory
      const cleanCui = (v: any) =>
        String(v || "")
          .toUpperCase()
          .replace(/\s+/g, "")
          .replace(/^RO/i, "")
          .trim();

      const items = (data.files || []).map((f: any) => {
        let matchedPartnerId = null;
        if (f.detectedCui) {
          const match = partners.find(
            (p: any) => cleanCui(p.cui) && cleanCui(p.cui) === cleanCui(f.detectedCui)
          );
          if (match) matchedPartnerId = match.id;
        }
        if (!matchedPartnerId && f.detectedPartnerName) {
          const normDetected = f.detectedPartnerName.toLowerCase().trim();
          const match = partners.find(
            (p: any) =>
              p.name &&
              (p.name.toLowerCase().includes(normDetected) ||
                normDetected.includes(p.name.toLowerCase()))
          );
          if (match) matchedPartnerId = match.id;
        }
        if (!matchedPartnerId) {
          // Fuzzy match on filename
          const normFile = f.fileName.toLowerCase();
          const match = partners.find(
            (p: any) => p.name && p.name.length >= 4 && normFile.includes(p.name.toLowerCase().slice(0, 8))
          );
          if (match) matchedPartnerId = match.id;
        }

        const extractedNum = f.detectedNumber || `CTR-${Date.now().toString().slice(-5)}`;
        const partnerLabel =
          partners.find((p: any) => p.id === matchedPartnerId)?.name ||
          f.detectedPartnerName ||
          "";

        return {
          fileName: f.fileName,
          fileUrl: f.fileUrl,
          fileSize: f.fileSize,
          partnerId: matchedPartnerId,
          partnerName: f.detectedPartnerName || null,
          cui: f.detectedCui || null,
          number: extractedNum,
          date: f.detectedDate || new Date().toISOString().split("T")[0],
          value: f.detectedValue || "0.00",
          currency: f.detectedCurrency || "EUR",
          contentHtml: f.extractedHtml || null,
          type: "contract",
          title: partnerLabel
            ? `Contract Nr. ${extractedNum} — ${partnerLabel}`
            : `Contract ${f.fileName.replace(/\.(pdf|docx|doc)$/i, "")}`,
        };
      });

      setUploadedQueue((prev) => [...prev, ...items]);
      toast.success(`${items.length} document(e) analizate și pregătite pentru import`);
    } catch (err: any) {
      setImportError(err.message || "Eroare upload fișiere");
      toast.error(err.message || "Eroare upload fișiere");
    } finally {
      setImportingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processImportFiles(e.target.files);
    }
  };

  const handleFinishBulkImport = () => {
    if (uploadedQueue.length === 0) return;
    setImportingFiles(true);
    bulkImportMutation.mutate({
      files: uploadedQueue.map((item) => ({
        ...item,
        explanation: globalExplanation,
      })),
    });
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    filterType !== "toate" ||
    filterPartnerType !== "toate" ||
    filterStatus !== "toate";

  const resetFilters = () => {
    setSearch("");
    setFilterType("toate");
    setFilterPartnerType("toate");
    setFilterStatus("toate");
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "activ":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/18 px-2.5 py-0.5 rounded-full leading-none">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Activ</span>
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/12 dark:bg-amber-500/18 px-2.5 py-0.5 rounded-full leading-none">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Draft</span>
          </span>
        );
      case "expirat":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#ff3b30] dark:text-[#ff6961] bg-[#ff3b30]/12 dark:bg-[#ff453a]/18 px-2.5 py-0.5 rounded-full leading-none">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff3b30] dark:bg-[#ff453a]" />
            <span>Expirat</span>
          </span>
        );
      case "reziliat":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2.5 py-0.5 rounded-full leading-none">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8e8e93]" />
            <span>Reziliat</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-3 sm:p-5 w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
      {/* Header — Apple macOS Window Title & Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight truncate">
            Bibliotecă Documente & Contracte
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Contracte cadru, acte adiționale și procese verbale ·{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {rawContracts.length}
            </strong>{" "}
            documente
            {totalCount !== rawContracts.length && (
              <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                ({totalCount} afișate)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all cursor-pointer shrink-0"
          >
            <Upload className="h-3.5 w-3.5 text-[#0071e3] dark:text-[#0a84ff] shrink-0" />
            <span>Importă Arhivă / Folder</span>
          </button>

          <Link
            href="/contracte/new"
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold transition-all shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Contract Nou</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards — Clean Rectangular 16px Apple Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setFilterStatus(filterStatus === "activ" ? "toate" : "activ");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFilterStatus(filterStatus === "activ" ? "toate" : "activ");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Contracte active
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <FileCheck className="h-3.5 w-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {loadingStats ? "…" : stats?.totalActive || 0}
            </span>
            <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] truncate">
              În derulare
            </span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setFilterType(filterType === "act_aditional" ? "toate" : "act_aditional");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFilterType(filterType === "act_aditional" ? "toate" : "act_aditional");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Acte adiționale
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <RefreshCw className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d]" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {loadingStats ? "…" : stats?.totalAddendums || 0}
            </span>
            <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] truncate">
              Termene & prețuri
            </span>
          </div>
        </div>

        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Expiră în 30 zile
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span
              className={`text-[22px] sm:text-[24px] font-bold tracking-[-0.026em] leading-none tabular-nums ${
                (stats?.expiringSoon || 0) > 0
                  ? "text-[#ff3b30] dark:text-[#ff453a]"
                  : "text-[#1d1d1f] dark:text-[#f5f5f7]"
              }`}
            >
              {loadingStats ? "…" : stats?.expiringSoon || 0}
            </span>
            <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] truncate">
              {(stats?.expiringSoon || 0) > 0 ? "Necesită atenție" : "La zi"}
            </span>
          </div>
        </div>

        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Fișiere arhivate
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {loadingStats ? "…" : stats?.totalFiles || 0}
            </span>
            <span className="text-[11px] text-[#6e6e73] dark:text-[#98989d] truncate">
              PDF-uri indexate
            </span>
          </div>
        </div>
      </div>

      {/* Unified Filter & Search Toolbar */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full min-w-0">
          {/* Status Segmented Track */}
          <div className="apple-segmented flex-wrap sm:flex-nowrap !rounded-2xl sm:!rounded-full max-w-full shrink-0">
            {[
              { id: "toate", label: "Toate" },
              { id: "activ", label: "Active" },
              { id: "draft", label: "Draft" },
              { id: "expirat", label: "Expirate" },
              { id: "reziliat", label: "Reziliate" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={filterStatus === item.id}
                onClick={() => {
                  setFilterStatus(item.id);
                  setPage(1);
                }}
                className="apple-segmented-item px-2 2xl:px-2.5 shrink-0"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right Side Controls: Type Select + Partner Type Select + Search + Reset */}
          <div className="xl:ml-auto flex flex-wrap sm:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full xl:w-auto xl:flex-1 justify-end min-w-0">
            <Select
              value={filterType}
              onValueChange={(val) => {
                setFilterType(val);
                setPage(1);
              }}
            >
              <SelectTrigger
                data-filtered={filterType !== "toate"}
                className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 2xl:px-3"
              >
                <FileText className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                <SelectValue placeholder="Tip document" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toate">Tip: Toate</SelectItem>
                <SelectItem value="contract">Contract Cadru</SelectItem>
                <SelectItem value="act_aditional">Act Adițional</SelectItem>
                <SelectItem value="pv_receptie">Proces Verbal Recepție</SelectItem>
                <SelectItem value="anexa">Anexă Tehnică</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterPartnerType}
              onValueChange={(val) => {
                setFilterPartnerType(val);
                setPage(1);
              }}
            >
              <SelectTrigger
                data-filtered={filterPartnerType !== "toate"}
                className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 2xl:px-3"
              >
                <Tag className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                <SelectValue placeholder="Parteneri" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toate">Parteneri: Toți</SelectItem>
                <SelectItem value="client">Clienți (Beneficiari)</SelectItem>
                <SelectItem value="supplier">Furnizori (Prestatori)</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[140px] max-w-full sm:max-w-[260px]">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Caută număr, partener, CUI..."
                style={{ paddingLeft: 34, paddingRight: search ? 72 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
              />
              {search && (
                <>
                  <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {filteredContracts.length}/{rawContracts.length}
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

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
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

      {/* Main Table Surface */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="py-3 px-3 text-center w-12 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Nr.
                </th>
                <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Document & Număr
                </th>
                <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Partener contractual
                </th>
                <th className="py-3 px-4 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Perioadă
                </th>
                <th className="py-3 px-4 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Valoare
                </th>
                <th className="py-3 px-4 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Status
                </th>
                <th className="py-3 px-4 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {loadingList ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#6e6e73]" />
                  </td>
                </tr>
              ) : paginatedContracts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]"
                  >
                    <div className="flex flex-col items-center gap-2.5">
                      <span>Nu a fost găsit niciun document conform filtrelor selectate.</span>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="apple-btn-glass px-4 h-8 text-[12px] font-semibold text-[#1d1d1f] dark:text-white cursor-pointer"
                        >
                          Resetează filtrele
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedContracts.map((c: any, index: number) => (
                  <tr
                    key={c.id}
                    className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                  >
                    <td className="py-3 px-3 text-center tabular-nums text-[12px] font-medium text-[#8e8e93]">
                      {(safePage - 1) * (rowsPerPage === 9999 ? 1 : rowsPerPage) + index + 1}
                    </td>

                    {/* Document / Numar & Data */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/contracte/${c.id}`}
                          className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums"
                        >
                          {c.number}
                        </Link>
                        {c.type === "act_aditional" && (
                          <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300 leading-none">
                            Act Adițional
                          </span>
                        )}
                        {c.type === "pv_receptie" && (
                          <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 leading-none">
                            PV
                          </span>
                        )}
                        {c.childCount > 0 && (
                          <span className="text-[10.5px] font-medium tabular-nums text-[#3a3a3c] dark:text-[#ebebf5] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2 py-0.5 rounded-full leading-none">
                            +{c.childCount} acte
                          </span>
                        )}
                        {c.language === "en" ? (
                          <span className="text-[10px] font-semibold text-[#3a3a3c] dark:text-[#ebebf5] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2 py-0.5 rounded-full leading-none">
                            EN
                          </span>
                        ) : c.language === "ro_en" ? (
                          <span className="text-[10px] font-semibold text-[#3a3a3c] dark:text-[#ebebf5] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2 py-0.5 rounded-full leading-none">
                            RO-EN
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] flex items-center gap-1.5 mt-0.5 tabular-nums">
                        <span>{c.date}</span>
                        {c.title && (
                          <span className="text-[#8e8e93] truncate max-w-[220px]" title={c.title}>
                            · {c.title}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Partener */}
                    <td className="py-3 px-4">
                      <Link
                        href={`/contracte/${c.id}`}
                        className="text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline cursor-pointer block truncate max-w-[240px]"
                        title={c.partnerName || "Nespecificat"}
                      >
                        {c.partnerName || "Nespecificat"}
                      </Link>
                      <div className="flex items-center gap-1.5 text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums flex-wrap">
                        {c.partnerCui && <span>CUI {c.partnerCui}</span>}
                        {c.partnerSagaCode && (
                          <span className="text-[10.5px] bg-[#f2f2f7] dark:bg-[#2c2c2e] px-2 py-0.5 rounded-full text-[#3a3a3c] dark:text-[#ebebf5] tabular-nums leading-none">
                            SAGA {c.partnerSagaCode}
                          </span>
                        )}
                        {c.partnerIsSupplier !== undefined && (
                          <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] leading-none">
                            {c.partnerIsSupplier === 1 ? "Furnizor" : "Client"}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Perioada */}
                    <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                      <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#ebebf5]">
                        {c.validFrom || c.date}
                      </div>
                      <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                        {c.validUntil ? `până la ${c.validUntil}` : "nedeterminat"}
                      </div>
                    </td>

                    {/* Valoare */}
                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                      {Number(c.value || 0) > 0 ? (
                        <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {Number(c.value).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}{" "}
                          {c.currency || "RON"}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#8e8e93]">Conform comenzi</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </td>

                    {/* Actiuni */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveLogContractId(c.id)}
                          aria-label="Jurnal modificări și explicații"
                          className="h-8 w-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer"
                          title="Jurnal modificări și explicații"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>

                        <a
                          href={`/api/pdf/contract/${c.id}?download=1`}
                          download
                          aria-label="Descarcă PDF"
                          title="Descarcă PDF"
                          className="h-8 w-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>

                        <a
                          href={`/api/pdf/contract/${c.id}?download=1&format=word`}
                          download
                          aria-label="Descarcă Word (.docx)"
                          title="Descarcă Word (.docx)"
                          className="h-8 w-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Paginare — Apple HIG Capsule Controls */}
        <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa]/85 dark:bg-white/[0.02] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span className="flex items-center whitespace-nowrap">
              Afișează
              <Select
                value={rowsPerPage.toString()}
                onValueChange={(val) => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="apple-pill-control h-7 px-2.5 text-[12px] w-[66px] mx-1.5 bg-white dark:bg-[#2c2c2e]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="9999">Toți</SelectItem>
                </SelectContent>
              </Select>
            </span>
            <span className="whitespace-nowrap ml-1">
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {totalCount}
              </strong>{" "}
              documente
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span className="whitespace-nowrap mr-1.5">
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
              aria-label="Pagina anterioară"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Pagina următoare"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Drawer / Modal: Jurnal Modificari & Explicatii cu Timestamp */}
      <Dialog
        open={!!activeLogContractId}
        onOpenChange={(open) => !open && setActiveLogContractId(null)}
      >
        <DialogContent className="max-w-2xl rounded-[22px] p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold flex items-center gap-2 text-[#1d1d1f] dark:text-[#f5f5f7]">
              <History className="h-4 w-4 text-[#6e6e73] dark:text-[#98989d]" />
              Jurnal Modificări & Explicații — {activeContractData?.number}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#6e6e73] dark:text-[#98989d]">
              Istoric complet al deciziilor, schimbărilor de clauze, prețuri și solicitări de la partener, salvate cu dată și oră exactă.
            </DialogDescription>
          </DialogHeader>

          {/* Formular adaugare nota / explicatie noua */}
          <div className="bg-[#f2f2f7] dark:bg-[#2c2c2e] p-4 rounded-2xl space-y-3 mt-2">
            <h4 className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Înregistrează o notă sau modificare nouă
            </h4>

            {logError && (
              <div className="text-xs text-[#ff3b30] dark:text-[#ff6961] bg-[#ff3b30]/10 p-2.5 rounded-xl">
                {logError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-1">
                <Select value={newLogActionType} onValueChange={setNewLogActionType}>
                  <SelectTrigger className="apple-input h-9 text-xs bg-white dark:bg-[#1c1c1e]">
                    <SelectValue placeholder="Tip Acțiune" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    <SelectItem value="modificare_termeni">Modificare Termeni</SelectItem>
                    <SelectItem value="modificare_pret">Schimbare Preț / Valoare</SelectItem>
                    <SelectItem value="prelungire">Prelungire Valabilitate</SelectItem>
                    <SelectItem value="act_aditional">Act Adițional Nou</SelectItem>
                    <SelectItem value="notificare">Notă Negociere / Apel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <input
                  value={newLogExplanation}
                  onChange={(e) => setNewLogExplanation(e.target.value)}
                  placeholder="Ex: Clientul a solicitat prelungirea scadenței la 30 zile..."
                  className="apple-input w-full h-9 px-3 text-xs bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!newLogExplanation.trim() || addLogMutation.isPending}
                onClick={() => {
                  if (!activeLogContractId) return;
                  addLogMutation.mutate({
                    contractId: activeLogContractId,
                    actionType: newLogActionType,
                    explanation: newLogExplanation,
                  });
                }}
                className="apple-btn-prominent rounded-full text-white text-[12px] font-semibold h-8 px-4 disabled:opacity-50 cursor-pointer"
              >
                {addLogMutation.isPending ? "Se salvează..." : "Salvează în Jurnal"}
              </button>
            </div>
          </div>

          {/* Timeline-ul evenimentelor */}
          <div className="space-y-3 mt-4">
            <h4 className="text-[12.5px] font-semibold text-[#6e6e73] dark:text-[#98989d]">
              Cronologie evenimente
            </h4>

            {(!activeContractData?.logs || activeContractData.logs.length === 0) ? (
              <div className="text-center py-6 text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                Nu există note înregistrate pentru acest contract.
              </div>
            ) : (
              <div className="relative pl-6 space-y-3.5 border-l border-black/[0.08] dark:border-white/[0.1]">
                {activeContractData.logs.map((l: any) => (
                  <div key={l.id} className="relative group">
                    <div className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full bg-[#8e8e93] border-2 border-white dark:border-[#1c1c1e]" />

                    <div className="apple-surface p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium py-0.5 px-2.5 rounded-full text-[#3a3a3c] dark:text-[#ebebf5] bg-[#f2f2f7] dark:bg-[#2c2c2e]">
                          {l.actionType.replace("_", " ")}
                        </span>
                        <span className="text-[11.5px] text-[#8e8e93] flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" />
                          {new Date(l.createdAt).toLocaleString("ro-RO", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {l.explanation}
                      </p>

                      <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] flex items-center justify-between pt-0.5">
                        <span>
                          Înregistrat de:{" "}
                          <strong className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            {l.userName || "Utilizator"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Import in masa din folder existent */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-3xl rounded-[22px] p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold flex items-center gap-2 text-[#1d1d1f] dark:text-[#f5f5f7]">
              <Upload className="h-4 w-4 text-[#0071e3] dark:text-[#0a84ff]" />
              Import în Masă din Folderul Existent de Contracte
            </DialogTitle>
            <DialogDescription className="text-[13px] text-[#6e6e73] dark:text-[#98989d]">
              Selectează sau trage fișierele PDF din folderul tău de contracte. Sistemul va detecta automat partenerii existenți din baza de date și va genera evidența fără introducere manuală.
            </DialogDescription>
          </DialogHeader>

          {importError && (
            <div className="text-xs text-[#ff3b30] dark:text-[#ff6961] bg-[#ff3b30]/10 p-3 rounded-xl">
              {importError}
            </div>
          )}

          {/* Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingImport(true);
            }}
            onDragLeave={() => setIsDraggingImport(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingImport(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processImportFiles(e.dataTransfer.files);
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
              isDraggingImport
                ? "border-primary bg-primary/5"
                : "border-black/[0.12] dark:border-white/[0.14] hover:border-primary bg-[#f2f2f7]/60 dark:bg-[#2c2c2e]/60"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,.docx,.doc"
              onChange={handleFileUpload}
              className="hidden"
            />
            {importingFiles ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#6e6e73] mb-2" />
                <span className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Se încarcă și se analizează fișierele...
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-2xl bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center text-[#0071e3] dark:text-[#0a84ff] mb-3">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Apasă pentru a alege fișiere sau trage fișierele PDF / Word aici
                </span>
                <span className="text-xs text-[#6e6e73] dark:text-[#98989d] mt-1">
                  Format acceptat: PDF sau Word (până la 100 fișiere dintr-o dată)
                </span>
              </div>
            )}
          </div>

          {/* Coada de fisiere incarcate */}
          {uploadedQueue.length > 0 && (
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Fișiere pregătite pentru import ({uploadedQueue.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setUploadedQueue([])}
                  className="text-xs font-semibold text-[#ff3b30] dark:text-[#ff453a] hover:underline cursor-pointer"
                >
                  Golește lista
                </button>
              </div>

              <div className="apple-surface overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#fafafa] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] font-medium sticky top-0 border-b border-black/[0.05] dark:border-white/[0.07]">
                    <tr>
                      <th className="p-2.5">Fișier</th>
                      <th className="p-2.5">Nr. / Dată</th>
                      <th className="p-2.5">Valoare extrasă</th>
                      <th className="p-2.5">Partener extras / asociat</th>
                      <th className="p-2.5 text-right">Șterge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {uploadedQueue.map((item, idx) => {
                      const partner = partners.find((p: any) => p.id === item.partnerId);
                      return (
                        <tr key={idx} className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035]">
                          <td className="p-2.5 font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate max-w-[180px]" title={item.fileName}>
                            {item.fileName}
                          </td>
                          <td className="p-2.5 tabular-nums">
                            <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{item.number}</div>
                            <div className="text-[10.5px] text-[#6e6e73] dark:text-[#98989d]">{item.date}</div>
                          </td>
                          <td className="p-2.5 tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            {Number(item.value || 0) > 0
                              ? `${Number(item.value).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ${item.currency}`
                              : "—"}
                          </td>
                          <td className="p-2.5">
                            {partner ? (
                              <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[180px]">{partner.name}</span>
                              </span>
                            ) : item.partnerName ? (
                              <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 shrink-0 text-[#0071e3] dark:text-[#0a84ff]" />
                                <span className="truncate max-w-[180px]">
                                  {item.partnerName} (se creează automat)
                                </span>
                              </span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-300">
                                Partener general (se poate edita ulterior)
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setUploadedQueue((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label="Elimină fișier"
                              className="apple-btn-destructive-soft w-7 h-7 rounded-full inline-flex items-center justify-center cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Explicatie colectiva */}
              <div className="pt-2">
                <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1">
                  Explicație / Justificare comună pentru Jurnalul de Audit:
                </label>
                <input
                  value={globalExplanation}
                  onChange={(e) => setGlobalExplanation(e.target.value)}
                  className="apple-input w-full h-9 px-3 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] outline-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <button
              type="button"
              onClick={() => setShowImportModal(false)}
              className="apple-btn-glass rounded-full px-5 h-9 text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
            >
              Anulează
            </button>
            <button
              type="button"
              disabled={uploadedQueue.length === 0 || importingFiles || bulkImportMutation.isPending}
              onClick={handleFinishBulkImport}
              className="apple-btn-prominent rounded-full text-white px-5 h-9 text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
            >
              {bulkImportMutation.isPending
                ? "Se importă..."
                : `Finalizează Importul (${uploadedQueue.length} documente)`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
