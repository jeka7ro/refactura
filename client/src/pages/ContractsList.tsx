import { useState, useMemo, useRef } from "react";
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

export default function ContractsList() {
  const [, setLocation] = useLocation();

  // Filters & Pagination (SmartDevize Rules)
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("toate");
  const [filterPartnerType, setFilterPartnerType] = useState<string>("toate"); // 'toate' | 'client' | 'supplier'
  const [filterStatus, setFilterStatus] = useState<string>("toate");
  const [page, setPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(15);

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
  const [uploadedQueue, setUploadedQueue] = useState<any[]>([]);
  const [globalExplanation, setGlobalExplanation] = useState("Preluare și arhivare contracte existente Wood Glass");
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkImportMutation = trpc.contracts.bulkImport.useMutation({
    onSuccess: (res) => {
      setImportingFiles(false);
      setShowImportModal(false);
      setUploadedQueue([]);
      refetch();
    },
    onError: (err) => {
      setImportingFiles(false);
      setImportError("Eroare la import: " + err.message);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImportingFiles(true);
    setImportError("");

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch("/api/upload-contract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

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
          const match = partners.find((p: any) => cleanCui(p.cui) === cleanCui(f.detectedCui));
          if (match) matchedPartnerId = match.id;
        }
        if (!matchedPartnerId) {
          // Fuzzy match on filename
          const normFile = f.fileName.toLowerCase();
          const match = partners.find(
            (p: any) => p.name && normFile.includes(p.name.toLowerCase().slice(0, 8))
          );
          if (match) matchedPartnerId = match.id;
        }

        return {
          fileName: f.fileName,
          fileUrl: f.fileUrl,
          fileSize: f.fileSize,
          partnerId: matchedPartnerId,
          number: f.detectedNumber || `CTR-${Date.now().toString().slice(-5)}`,
          date: new Date().toISOString().split("T")[0],
          type: "contract",
          title: `Contract ${f.fileName.replace(/\.pdf$/i, "")}`,
        };
      });

      setUploadedQueue((prev) => [...prev, ...items]);
    } catch (err: any) {
      setImportError(err.message || "Eroare upload fișiere");
    } finally {
      setImportingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "act_aditional":
        return (
          <Badge variant="outline" className="border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 font-semibold px-2.5 py-0.5 rounded-full text-xs">
            Act Adițional
          </Badge>
        );
      case "pv_receptie":
        return (
          <Badge variant="outline" className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 font-semibold px-2.5 py-0.5 rounded-full text-xs">
            Proces Verbal
          </Badge>
        );
      case "anexa":
        return (
          <Badge variant="outline" className="border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 font-semibold px-2.5 py-0.5 rounded-full text-xs">
            Anexă Tehnică
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 font-semibold px-2.5 py-0.5 rounded-full text-xs">
            Contract Cadru
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "activ":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Activ
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            În Redactare
          </span>
        );
      case "expirat":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            Expirat
          </span>
        );
      case "reziliat":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-500/10 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
            Reziliat
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileSignature className="h-7 w-7 text-primary" />
            Bibliotecă Documente & Contracte
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestiune digitală contracte cadru, acte adiționale și procese verbale cu istoric timestampat și export PDF direct.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="h-10 px-5 inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold shadow-xs transition-colors box-border shrink-0"
          >
            <Upload className="h-4 w-4 text-primary shrink-0" />
            <span>Importă Arhivă / Folder</span>
          </button>

          <Link
            href="/contracte/new"
            className="h-10 px-5 inline-flex items-center justify-center gap-2 rounded-full border border-transparent bg-primary hover:bg-primary/90 text-white text-sm font-semibold shadow-sm transition-colors box-border shrink-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Contract Nou</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards - SmartDevize Rule 4: rounded-lg, inaltimi perfect egale si contur fin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <div className="h-full flex flex-col justify-between rounded-lg border border-slate-200/50 dark:border-slate-800/50 bg-card p-5 shadow-xs transition-all hover:border-primary/30">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Contracte Active
              </span>
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white">
              {loadingStats ? "..." : stats?.totalActive || 0}
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 min-h-[32px] flex items-center">
            Valabile și în derulare
          </div>
        </div>

        <div className="h-full flex flex-col justify-between rounded-lg border border-slate-200/50 dark:border-slate-800/50 bg-card p-5 shadow-xs transition-all hover:border-primary/30">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Acte Adiționale
              </span>
              <div className="h-9 w-9 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <RefreshCw className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white">
              {loadingStats ? "..." : stats?.totalAddendums || 0}
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 min-h-[32px] flex items-center">
            Modificări de termene & prețuri
          </div>
        </div>

        <div className="h-full flex flex-col justify-between rounded-lg border border-slate-200/50 dark:border-slate-800/50 bg-card p-5 shadow-xs transition-all hover:border-primary/30">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Expiră în 30 Zile
              </span>
              <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white">
              {loadingStats ? "..." : stats?.expiringSoon || 0}
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 min-h-[32px] flex items-center">
            Necesită reînnoire sau act adițional
          </div>
        </div>

        <div className="h-full flex flex-col justify-between rounded-lg border border-slate-200/50 dark:border-slate-800/50 bg-card p-5 shadow-xs transition-all hover:border-primary/30">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Fișiere Arhivate
              </span>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white">
              {loadingStats ? "..." : stats?.totalFiles || 0}
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 min-h-[32px] flex items-center">
            PDF-uri stocate și indexate
          </div>
        </div>
      </div>

      {/* Filter Bar - SmartDevize Rule 4: rounded-lg */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-card p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Căutare - SmartDevize Rule 1 */}
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 pointer-events-none"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 1,
              }}
            />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Caută după număr, partener, CUI..."
              style={{
                paddingLeft: 36,
                paddingRight: search ? 80 : 16,
                borderRadius: 9999,
              }}
              className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-full text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all shadow-sm"
            />
            {search && (
              <div
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "var(--accent, #2563eb)",
                  color: "white",
                  borderRadius: 9999,
                  padding: "2px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {filteredContracts.length} / {rawContracts.length}
              </div>
            )}
          </div>

          {/* Filtru Tip Document */}
          <Select
            value={filterType}
            onValueChange={(val) => {
              setFilterType(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-full border-slate-200 dark:border-slate-700 text-sm">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 truncate">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">
                  {filterType === "toate" && "Tip Document: Toate"}
                  {filterType === "contract" && "Doar Contracte Cadru"}
                  {filterType === "act_aditional" && "Doar Acte Adiționale"}
                  {filterType === "pv_receptie" && "Doar Procese Verbale"}
                  {filterType === "anexa" && "Doar Anexe Tehnice"}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="toate">Toate Tipurile</SelectItem>
              <SelectItem value="contract">Contract Cadru</SelectItem>
              <SelectItem value="act_aditional">Act Adițional</SelectItem>
              <SelectItem value="pv_receptie">Proces Verbal Recepție</SelectItem>
              <SelectItem value="anexa">Anexă Tehnică</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtru Partener */}
          <Select
            value={filterPartnerType}
            onValueChange={(val) => {
              setFilterPartnerType(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-full border-slate-200 dark:border-slate-700 text-sm">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 truncate">
                <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">
                  {filterPartnerType === "toate" && "Parteneri: Toți"}
                  {filterPartnerType === "client" && "Doar Clienți"}
                  {filterPartnerType === "supplier" && "Doar Furnizori"}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="toate">Toți Partenerii</SelectItem>
              <SelectItem value="client">Clienți (Beneficiari)</SelectItem>
              <SelectItem value="supplier">Furnizori (Prestatori)</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtru Status */}
          <Select
            value={filterStatus}
            onValueChange={(val) => {
              setFilterStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="rounded-full border-slate-200 dark:border-slate-700 text-sm">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 truncate">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">
                  {filterStatus === "toate" && "Status: Toate"}
                  {filterStatus === "activ" && "Doar Active"}
                  {filterStatus === "draft" && "Doar În Redactare"}
                  {filterStatus === "expirat" && "Doar Expirate"}
                  {filterStatus === "reziliat" && "Doar Reziliate"}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="toate">Toate Statusurile</SelectItem>
              <SelectItem value="activ">Active</SelectItem>
              <SelectItem value="draft">În Redactare (Draft)</SelectItem>
              <SelectItem value="expirat">Expirate</SelectItem>
              <SelectItem value="reziliat">Reziliate</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table - SmartDevize Rule 4: rounded-lg container */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-sm">
        {/* Table Header with Total Count - SmartDevize Rule 4 */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Total: <strong className="text-slate-900 dark:text-white font-bold">{totalCount}</strong>{" "}
            {totalCount === 1 ? "înregistrare" : "înregistrări"}
            {search.trim() && (
              <span className="text-slate-500 ml-1">
                (filtrat din {rawContracts.length} contracte)
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
              <tr>
                {/* SmartDevize Rule 2: Coloana Nr. */}
                <th style={{ width: 50, textAlign: "center" }} className="py-3.5 px-3 text-center w-[50px]">
                  Nr.
                </th>
                <th className="py-3.5 px-4">Tip</th>
                <th className="py-3.5 px-4">Număr & Dată</th>
                <th className="py-3.5 px-4">Partener Contractual</th>
                <th className="py-3.5 px-4">Perioadă</th>
                <th className="py-3.5 px-4 text-right">Valoare</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loadingList ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                    Se încarcă biblioteca de documente...
                  </td>
                </tr>
              ) : paginatedContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <FileText className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                    Nu a fost găsit niciun document conform filtrelor selectate.
                  </td>
                </tr>
              ) : (
                paginatedContracts.map((c: any, index: number) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* SmartDevize Rule 2: Nr. Crt. */}
                    <td
                      style={{ textAlign: "center", color: "var(--text-secondary, #64748b)", fontSize: 13 }}
                      className="py-3.5 px-3 text-center font-medium"
                    >
                      {(safePage - 1) * (rowsPerPage === 9999 ? 1 : rowsPerPage) + index + 1}
                    </td>

                    {/* Tip */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        {getTypeBadge(c.type)}
                        {c.childCount > 0 && (
                          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                            +{c.childCount} acte adiționale
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Numar & Data */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/contracte/${c.id}`}
                        className="font-bold text-slate-900 dark:text-white hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        {c.number}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">{c.date}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[220px]">{c.title}</div>
                    </td>

                    {/* Partener */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/contracte/${c.id}`}
                        className="font-semibold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors cursor-pointer block"
                        title="Deschide detaliile contractului"
                      >
                        {c.partnerName || "Nespecificat"}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        {c.partnerCui && <span>CUI: {c.partnerCui}</span>}
                        {c.partnerSagaCode && (
                          <span className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono">
                            SAGA: {c.partnerSagaCode}
                          </span>
                        )}
                        {c.partnerIsSupplier !== undefined && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 rounded-full">
                            {c.partnerIsSupplier === 1 ? "FURNIZOR" : "CLIENT"}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Perioada */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                      <div>De la: {c.validFrom || c.date}</div>
                      <div className="text-slate-400">
                        Până la: {c.validUntil || "Nedeterminat"}
                      </div>
                    </td>

                    {/* Valoare */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {Number(c.value || 0) > 0 ? (
                          `${Number(c.value).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ${c.currency || "RON"}`
                        ) : (
                          <span className="text-slate-400 font-normal">Conform comenzi</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </td>

                    {/* Actiuni - SmartDevize Rule 4: rounded-lg butoane */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Buton Jurnal Istoric & Explicatii */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setActiveLogContractId(c.id)}
                          className="h-8 w-8 rounded-full text-slate-600 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                          title="Jurnal modificări și explicații"
                        >
                          <History className="h-4 w-4" />
                        </Button>

                        {/* Buton Download PDF */}
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 rounded-full text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="Descarcă PDF"
                        >
                          <a href={`/api/pdf/contract/${c.id}?download=1`} download>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>

                        {/* Buton Download Word (.docx) */}
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 rounded-full text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          title="Descarcă Word (.docx)"
                        >
                          <a href={`/api/pdf/contract/${c.id}?download=1&format=word`} download>
                            <FileText className="h-4 w-4 text-blue-600" />
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SmartDevize Rule 3: Footer Paginare */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-color, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-secondary, #f8fafc)",
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          }}
          className="dark:bg-slate-900/60 dark:border-slate-800 flex-wrap gap-3"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="text-xs text-slate-600 dark:text-slate-400" style={{ whiteSpace: "nowrap" }}>
              Afișează&nbsp;
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  background: "var(--bg-primary, white)",
                  border: "1px solid var(--border-color, #e2e8f0)",
                  borderRadius: 9999,
                  padding: "2px 8px",
                }}
                className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 text-xs focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toți</option>
              </select>
              &nbsp;rânduri
            </span>
            <span className="text-xs text-slate-500" style={{ whiteSpace: "nowrap" }}>
              Total înregistrări: <strong>{totalCount}</strong>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="text-xs text-slate-500" style={{ whiteSpace: "nowrap" }}>
              Pagina {safePage} din {totalPages}
            </span>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Drawer / Modal: Jurnal Modificari & Explicatii cu Timestamp */}
      <Dialog
        open={!!activeLogContractId}
        onOpenChange={(open) => !open && setActiveLogContractId(null)}
      >
        <DialogContent className="max-w-2xl rounded-lg p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-purple-600" />
              Jurnal Modificări & Explicații — {activeContractData?.number}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Istoric complet al deciziilor, schimbărilor de clauze, prețuri și solicitări de la partener, salvate cu dată și oră exactă.
            </DialogDescription>
          </DialogHeader>

          {/* Formular adaugare nota / explicatie noua */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 mt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Înregistrează o Notă / Modificare Nouă
            </h4>

            {logError && (
              <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200">
                {logError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-1">
                <Select value={newLogActionType} onValueChange={setNewLogActionType}>
                  <SelectTrigger className="rounded-lg text-xs h-9">
                    <SelectValue placeholder="Tip Acțiune" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg text-xs">
                    <SelectItem value="modificare_termeni">Modificare Termeni</SelectItem>
                    <SelectItem value="modificare_pret">Schimbare Preț / Valoare</SelectItem>
                    <SelectItem value="prelungire">Prelungire Valabilitate</SelectItem>
                    <SelectItem value="act_aditional">Act Adițional Nou</SelectItem>
                    <SelectItem value="notificare">Notă Negociere / Apel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Input
                  value={newLogExplanation}
                  onChange={(e) => setNewLogExplanation(e.target.value)}
                  placeholder="Ex: Clientul a solicitat prelungirea scadenței la 30 zile..."
                  className="rounded-lg text-xs h-9"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!newLogExplanation.trim() || addLogMutation.isPending}
                onClick={() => {
                  if (!activeLogContractId) return;
                  addLogMutation.mutate({
                    contractId: activeLogContractId,
                    actionType: newLogActionType,
                    explanation: newLogExplanation,
                  });
                }}
                className="rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 px-4"
              >
                {addLogMutation.isPending ? "Se salvează..." : "Salvează în Jurnal"}
              </Button>
            </div>
          </div>

          {/* Timeline-ul evenimentelor */}
          <div className="space-y-4 mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Cronologie Evenimente
            </h4>

            {(!activeContractData?.logs || activeContractData.logs.length === 0) ? (
              <div className="text-center py-6 text-sm text-slate-400">
                Nu există note înregistrate pentru acest contract.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 dark:border-slate-800">
                {activeContractData.logs.map((l: any) => (
                  <div key={l.id} className="relative group">
                    {/* Punct pe linie */}
                    <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-purple-600 border-2 border-white dark:border-slate-900"></div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-card p-3.5 shadow-sm space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[11px] font-semibold py-0.5 px-2 rounded-full border-purple-300 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40">
                          {l.actionType.replace("_", " ").toUpperCase()}
                        </Badge>
                        <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
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

                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {l.explanation}
                      </p>

                      <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                        <span>Înregistrat de: <strong className="font-semibold text-slate-700 dark:text-slate-300">{l.userName || "Utilizator"}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Import in masa din folder existent Wood Glass */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-3xl rounded-lg p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Import în Masă din Folderul Existent Wood Glass
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Selectează sau trage fișierele PDF din folderul tău de contracte. Sistemul va detecta automat partenerii existenți din baza de date și va genera evidența fără introducere manuală.
            </DialogDescription>
          </DialogHeader>

          {importError && (
            <div className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg border border-rose-200">
              {importError}
            </div>
          )}

          {/* Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary rounded-lg p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/30"
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
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Se încarcă și se analizează fișierele...
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <Upload className="h-6 w-6" />
                </div>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  Apasă pentru a alege fișiere sau trage folderul aici
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Format acceptat: PDF sau Word (până la 100 fișiere dintr-o dată)
                </span>
              </div>
            )}
          </div>

          {/* Coada de fisiere incarcate */}
          {uploadedQueue.length > 0 && (
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Fișiere Pregătite pentru Import ({uploadedQueue.length})
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadedQueue([])}
                  className="h-7 text-xs text-rose-600 hover:text-rose-700"
                >
                  Golește lista
                </Button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5">Fișier</th>
                      <th className="p-2.5">Număr Extras</th>
                      <th className="p-2.5">Partener Asociat Automat</th>
                      <th className="p-2.5 text-right">Șterge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {uploadedQueue.map((item, idx) => {
                      const partner = partners.find((p: any) => p.id === item.partnerId);
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <td className="p-2.5 font-medium truncate max-w-[200px]">
                            {item.fileName}
                          </td>
                          <td className="p-2.5 font-mono">{item.number}</td>
                          <td className="p-2.5">
                            {partner ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {partner.name}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">
                                Partener general (se poate edita ulterior)
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              onClick={() =>
                                setUploadedQueue((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-slate-400 hover:text-rose-600"
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
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Explicație / Justificare comună pentru Jurnalul de Audit:
                </label>
                <Input
                  value={globalExplanation}
                  onChange={(e) => setGlobalExplanation(e.target.value)}
                  className="rounded-lg text-xs mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowImportModal(false)}
              className="rounded-full px-5"
            >
              Anulează
            </Button>
            <Button
              disabled={uploadedQueue.length === 0 || importingFiles || bulkImportMutation.isPending}
              onClick={handleFinishBulkImport}
              className="rounded-full bg-primary text-white px-5"
            >
              {bulkImportMutation.isPending
                ? "Se importă..."
                : `Finalizează Importul (${uploadedQueue.length} documente)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
