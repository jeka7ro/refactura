// NIRList — Lista NIR-urilor (Nota de Intrare-Recepție)
// UI Rules: Nr. Crt., total records, pagination, rounded-full filters & buttons, select-all & bulk operations

import { useState, useMemo } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { useLocation } from "wouter";
import {
  Loader2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  FileCode,
  FileSpreadsheet,
  Edit,
  Layers,
  Building2,
  X,
  Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";
import NirPdfViewerDialog from "@/components/NirPdfViewerDialog";
import { LiveAutoSyncControl } from "@/components/LiveAutoSyncControl";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTableSort } from "@/hooks/useTableSort";
import { formatDate } from "@/lib/store";
import {
  saveWithFilePicker,
  getNirPdfFilename,
  getNirXmlFilename,
  encodeWindows1250Blob,
} from "@/lib/fileSave";
import {
  SagaImportSimulatorModal,
  type SagaSimulationResult,
} from "@/components/SagaImportSimulatorModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function NIRList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("nir_list", 15);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // Filtre afarente (ca în AllInvoices / Screenshot 2)
  const [period, setPeriod] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  // Selecție multiplă (Select All / Bulk Actions)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>("keep");
  const [bulkGestiune, setBulkGestiune] = useState<string>("");
  const [bulkAccount, setBulkAccount] = useState<string>("");

  const { data: nirList = [], isLoading, refetch } = trpc.nir.list.useQuery();
  const { data: currentTenant } = trpc.tenants.current.useQuery();

  const exportNirMut = trpc.saga.exportNir.useMutation();
  const simulateNirImportMut = trpc.saga.simulateNirImport.useMutation();
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulationData, setSimulationData] = useState<SagaSimulationResult | null>(null);

  const handleSimulateSaga = async (params: {
    nirId?: number;
    nirIds?: number[];
  }) => {
    setSimulatorOpen(true);
    setSimulationData(null);
    try {
      const res = await simulateNirImportMut.mutateAsync(params);
      setSimulationData(res as SagaSimulationResult);
    } catch (e: any) {
      toast.error("Eroare la simularea importului SAGA: " + (e?.message || e));
      setSimulatorOpen(false);
    }
  };

  const handleSaveSagaXml = async (params: {
    nirId?: number;
    nirNumber?: string;
    nirIds?: number[];
  }) => {
    try {
      const rawCui =
        currentTenant?.cui || (currentTenant as any)?.tenants?.cui || "";
      const safeCui = rawCui.replace(/^RO/i, "").trim() || "EXPORT";
      const suggestedName = params.nirId
        ? getNirXmlFilename(safeCui, params.nirNumber, params.nirId)
        : `F_${safeCui}_NIR_SEL_${params.nirIds?.length || "ALL"}.xml`;

      const savedName = await saveWithFilePicker(
        {
          suggestedName,
          acceptMimeType: "text/xml",
          description: "Fișier XML SAGA C (.xml)",
          extensions: [".xml"],
          pickerId: "nir_saga_xml",
        },
        async () => {
          const data = await exportNirMut.mutateAsync(
            params.nirId ? { nirId: params.nirId } : { nirIds: params.nirIds }
          );
          return encodeWindows1250Blob(data.xml);
        }
      );
      if (savedName) {
        toast.success(
          `Fișierul ${savedName} a fost salvat cu succes pentru import în SAGA C!`
        );
      }
    } catch (e: any) {
      toast.error("Eroare export SAGA XML: " + (e?.message || e));
    }
  };

  const [pdfViewer, setPdfViewer] = useState<{ id: number; nirNumber?: string } | null>(null);

  const handleSavePdfNir = async (rowId: number, rowNirNumber?: string) => {
    try {
      const suggestedName = getNirPdfFilename(rowNirNumber, rowId);
      const savedName = await saveWithFilePicker(
        {
          suggestedName,
          acceptMimeType: "application/pdf",
          description: "Document PDF NIR (.pdf)",
          extensions: [".pdf"],
          pickerId: "nir_pdf",
        },
        async () => {
          const res = await fetch(`/api/pdf/nir/${rowId}?download=1`, {
            credentials: "include",
          });
          if (!res.ok) {
            throw new Error(`Eroare la generarea PDF-ului (${res.status})`);
          }
          return await res.blob();
        }
      );
      if (savedName) {
        toast.success(`Documentul ${savedName} a fost salvat cu succes!`);
      }
    } catch (e: any) {
      toast.error("Eroare salvare PDF NIR: " + (e?.message || e));
    }
  };

  const deleteNir = trpc.nir.delete.useMutation({
    onSuccess: () => {
      toast.success("NIR șters!");
      refetch();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const bulkDeleteMut = trpc.nir.bulkDelete.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.count} NIR-uri au fost șterse cu succes!`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      refetch();
    },
    onError: (e) => toast.error("Eroare la ștergerea în masă: " + e.message),
  });

  const bulkUpdateMut = trpc.nir.bulkUpdate.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.count} NIR-uri au fost actualizate!`);
      setSelectedIds(new Set());
      setBulkEditOpen(false);
      refetch();
    },
    onError: (e) => toast.error("Eroare la actualizarea în masă: " + e.message),
  });

  // Helper filtrare dată
  const getDateRange = (p: string): [string, string] | null => {
    const now = new Date();
    const fmt = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${yr}-${mo}-${da}`;
    };
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    switch (p) {
      case "today": {
        const t = fmt(now);
        return [t, t];
      }
      case "yesterday": {
        const y = startOfDay(now);
        y.setDate(y.getDate() - 1);
        const ys = fmt(y);
        return [ys, ys];
      }
      case "week": {
        const d = startOfDay(now);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        return [fmt(d), fmt(end)];
      }
      case "month": {
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return [fmt(s), fmt(e)];
      }
      case "lastMonth": {
        const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const e = new Date(now.getFullYear(), now.getMonth(), 0);
        return [fmt(s), fmt(e)];
      }
      case "year":
        return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
      case "lastYear":
        return [
          `${now.getFullYear() - 1}-01-01`,
          `${now.getFullYear() - 1}-12-31`,
        ];
      default:
        return null;
    }
  };

  // Contoare și liste unice pentru dropdown-uri
  const statusCounts = useMemo(() => {
    let finalizat = 0;
    let draft = 0;
    nirList.forEach((n: any) => {
      if (n.status === "finalizat") finalizat++;
      else draft++;
    });
    return { finalizat, draft };
  }, [nirList]);

  const availableAccounts = useMemo(() => {
    const accMap = new Map<string, number>();
    nirList.forEach((n: any) => {
      if (n.accounts && Array.isArray(n.accounts)) {
        n.accounts.forEach((a: string) => {
          if (a) accMap.set(a, (accMap.get(a) || 0) + 1);
        });
      } else if (n.accountingAccount) {
        accMap.set(
          n.accountingAccount,
          (accMap.get(n.accountingAccount) || 0) + 1
        );
      }
    });
    return Array.from(accMap.entries())
      .map(([acc, count]) => ({ acc, count }))
      .sort((a, b) => a.acc.localeCompare(b.acc));
  }, [nirList]);

  const availableSuppliers = useMemo(() => {
    const supMap = new Map<string, number>();
    nirList.forEach((n: any) => {
      if (n.supplierName) {
        supMap.set(n.supplierName, (supMap.get(n.supplierName) || 0) + 1);
      }
    });
    return Array.from(supMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [nirList]);

  const hasActiveFilters =
    search.trim() !== "" ||
    period !== "all" ||
    statusFilter !== "all" ||
    accountFilter !== "all" ||
    supplierFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setPeriod("all");
    setStatusFilter("all");
    setAccountFilter("all");
    setSupplierFilter("all");
    setPage(1);
  };

  // Filtrare tabel
  const filtered = nirList.filter((n: any) => {
    // 1. Filtru perioadă
    if (period !== "all") {
      const range = getDateRange(period);
      if (range) {
        const [from, to] = range;
        const recDate = n.receiptDate ? n.receiptDate.split("T")[0] : "";
        if (recDate && (recDate < from || recDate > to)) return false;
      }
    }

    // 2. Filtru status
    if (statusFilter !== "all" && n.status !== statusFilter) return false;

    // 3. Filtru cont contabil
    if (accountFilter !== "all") {
      const hasAcc =
        n.accounts?.includes(accountFilter) ||
        n.accountingAccount === accountFilter;
      if (!hasAcc) return false;
    }

    // 4. Filtru furnizor
    if (supplierFilter !== "all" && n.supplierName !== supplierFilter)
      return false;

    // 5. Căutare text (universală)
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();

    // Verifică searchContent agregat de server
    if (n.searchContent && n.searchContent.includes(q)) return true;

    // Verificări directe
    if (n.nirNumber?.toLowerCase().includes(q)) return true;
    if (n.supplierName?.toLowerCase().includes(q)) return true;
    if (n.supplierCUI?.toLowerCase().includes(q)) return true;
    if (n.invoiceNumber?.toLowerCase().includes(q)) return true;
    if (n.avizNumber?.toLowerCase().includes(q)) return true;
    if (n.gestiune?.toLowerCase().includes(q)) return true;
    if (n.accountingAccount?.toLowerCase().includes(q)) return true;
    if (n.accountingType?.toLowerCase().includes(q)) return true;
    if (n.notes?.toLowerCase().includes(q)) return true;
    if (n.accounts?.some((a: string) => a?.toLowerCase().includes(q))) return true;
    if (n.articleCodes?.some((c: string) => c?.toLowerCase().includes(q))) return true;
    if (n.lineDescriptions?.some((d: string) => d?.toLowerCase().includes(q))) return true;

    return false;
  });

  const { sortedData, handleSort, getSortIcon } = useTableSort(
    filtered,
    "nir_list"
  );

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const paginated = sortedData.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  // Funcții selecție
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (paginated.length === 0) return;
    const allOnPageSelected = paginated.every((r) => selectedIds.has(r.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginated.forEach((r) => next.delete(r.id));
      } else {
        paginated.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  // Funcție export Excel (.xlsx)
  const handleExportExcel = async (items = filtered) => {
    if (!items || items.length === 0) {
      toast.error("Nu există înregistrări de exportat.");
      return;
    }

    const rows = items.map((n: any, idx) => ({
      "Nr. Crt.": idx + 1,
      "Nr. NIR": n.nirNumber || "",
      "Furnizor": n.supplierName || "",
      "CUI Furnizor": n.supplierCUI || "",
      "Factură Sursă": n.invoiceNumber || "",
      "Dată Factură": n.invoiceDate
        ? n.invoiceDate.includes("T")
          ? n.invoiceDate.split("T")[0]
          : n.invoiceDate
        : "",
      "Dată Recepție": n.receiptDate
        ? n.receiptDate.includes("T")
          ? n.receiptDate.split("T")[0]
          : n.receiptDate
        : "",
      "Gestiune": n.gestiune || "",
      "Nr. Articole": n.linesCount ?? 0,
      "Conturi": (n.accounts || []).join(", ") || n.accountingAccount || "371",
      "Coduri Articole": (n.articleCodes || []).join(", "),
      "Valoare Netă (RON)": Number((n.totalNet || 0).toFixed(2)),
      "Valoare TVA (RON)": Number((n.totalVat || 0).toFixed(2)),
      "Total cu TVA (RON)": Number((n.totalWithVat || 0).toFixed(2)),
      "Status": n.status === "finalizat" ? "Finalizat" : "Draft",
      "Tip Contabil": n.accountingType || "Marfuri",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 8 },  // Nr Crt
      { wch: 16 }, // Nr NIR
      { wch: 30 }, // Furnizor
      { wch: 16 }, // CUI
      { wch: 18 }, // Factura
      { wch: 14 }, // Data Factura
      { wch: 14 }, // Data Receptie
      { wch: 18 }, // Gestiune
      { wch: 12 }, // Articole
      { wch: 16 }, // Conturi
      { wch: 20 }, // Coduri Articole
      { wch: 18 }, // Neta
      { wch: 16 }, // TVA
      { wch: 18 }, // Cu TVA
      { wch: 12 }, // Status
      { wch: 16 }, // Tip
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recepții NIR");

    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const suggestedName = `Receptii_NIR_${dateStr}.xlsx`;
      const savedName = await saveWithFilePicker(
        {
          suggestedName,
          acceptMimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          description: "Fișier Microsoft Excel (.xlsx)",
          extensions: [".xlsx"],
          pickerId: "nir_excel",
        },
        async () => {
          const excelBuffer = XLSX.write(wb, {
            bookType: "xlsx",
            type: "array",
          });
          return new Blob([excelBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
        }
      );
      if (savedName) {
        toast.success(
          `Fișierul ${savedName} cu ${rows.length} NIR-uri a fost salvat cu succes!`
        );
      }
    } catch (err: any) {
      toast.error(
        "Eroare la generarea fișierului Excel: " + (err?.message || err)
      );
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      {/* Header — Apple macOS Window Title & Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
              NIR — Note de Intrare-Recepție
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </span>
          </div>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Gestionează recepția mărfurilor de la furnizori ·{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {nirList.length}
            </strong>{" "}
            documente
            {filtered.length !== nirList.length && (
              <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                ({filtered.length} afișate)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <LiveAutoSyncControl
            onRefresh={() => refetch()}
            isRefreshing={isLoading}
            storageKey="nir_list_auto_sync"
            compact
          />
          {/* Buton Secundar: Export Excel (.xlsx) */}
          <button
            type="button"
            onClick={() => handleExportExcel(filtered)}
            title="Exportă lista de NIR-uri în format nativ Microsoft Excel (.xlsx)"
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Export Excel (.xlsx)</span>
          </button>

          {/* Buton Secundar: Simulează Import SAGA C */}
          <button
            type="button"
            onClick={() => {
              if (selectedIds.size > 0) {
                handleSimulateSaga({ nirIds: Array.from(selectedIds) });
              } else if (filtered.length > 0) {
                handleSimulateSaga({ nirIds: filtered.map((n: any) => n.id) });
              } else {
                toast.error("Nu există NIR-uri de simulat.");
              }
            }}
            disabled={simulateNirImportMut.isPending || (selectedIds.size === 0 && filtered.length === 0)}
            title={
              selectedIds.size > 0
                ? `Simulează și verifică importul în SAGA C pentru cele ${selectedIds.size} NIR-uri selectate`
                : `Simulează și verifică importul în SAGA C pentru cele ${filtered.length} NIR-uri filtrate`
            }
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all disabled:opacity-50 cursor-pointer tabular-nums"
          >
            {simulateNirImportMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff] shrink-0" />
            )}
            <span>
              Simulează SAGA {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filtered.length})`}
            </span>
          </button>

          {/* Buton Secundar: Export SAGA (XML) */}
          <button
            type="button"
            onClick={() => {
              if (selectedIds.size > 0) {
                handleSaveSagaXml({ nirIds: Array.from(selectedIds) });
              } else if (filtered.length > 0) {
                handleSaveSagaXml({ nirIds: filtered.map((n: any) => n.id) });
              } else {
                toast.error("Nu există NIR-uri de exportat.");
              }
            }}
            disabled={exportNirMut.isPending || (selectedIds.size === 0 && filtered.length === 0)}
            title={
              selectedIds.size > 0
                ? `Exportă cele ${selectedIds.size} recepții selectate în format SAGA C (FACTURI.XML)`
                : `Exportă cele ${filtered.length} recepții filtrate în format SAGA C (FACTURI.XML)`
            }
            className="apple-btn-glass flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold transition-all disabled:opacity-50 cursor-pointer tabular-nums"
          >
            {exportNirMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span>
              Export SAGA (XML) {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${filtered.length})`}
            </span>
          </button>

          {/* Buton Primar: Creare NIR */}
          <button
            type="button"
            onClick={() => navigate("/nir/nou")}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>NIR Nou</span>
          </button>
        </div>
      </div>

      {/* KPI Cards — Clean Rectangular 16px Apple Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setStatusFilter("all");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Total NIR-uri
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {nirList.length}
            </span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "finalizat" ? "all" : "finalizat");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setStatusFilter(statusFilter === "finalizat" ? "all" : "finalizat");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Finalizate
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {statusCounts.finalizat}
            </span>
            {nirList.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 leading-none">
                {Math.round((statusCounts.finalizat / nirList.length) * 100)}%
              </span>
            )}
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "draft" ? "all" : "draft");
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setStatusFilter(statusFilter === "draft" ? "all" : "draft");
              setPage(1);
            }
          }}
          className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Ciorne
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
              <Edit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {statusCounts.draft}
            </span>
          </div>
        </div>
      </div>

      {/* Banner selecție multiplă (Bulk Operations) */}
      {selectedIds.size > 0 && (
        <div className="apple-surface px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] text-xs font-bold tabular-nums">
              {selectedIds.size}
            </span>
            <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              NIR-uri selectate
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="apple-btn-glass px-3.5 h-8 rounded-full text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] text-[12px] font-semibold transition-colors cursor-pointer"
            >
              Deselectează
            </button>
            <button
              type="button"
              onClick={() => {
                setBulkStatus("keep");
                setBulkGestiune("");
                setBulkAccount("");
                setBulkEditOpen(true);
              }}
              className="apple-btn-glass flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold transition-colors cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Bulk Edit</span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleExportExcel(nirList.filter((n) => selectedIds.has(n.id)))
              }
              className="apple-btn-glass flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold transition-colors cursor-pointer tabular-nums"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel .xlsx ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleSaveSagaXml({ nirIds: Array.from(selectedIds) })
              }
              disabled={exportNirMut.isPending}
              className="apple-btn-glass flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold transition-colors disabled:opacity-50 cursor-pointer tabular-nums"
            >
              {exportNirMut.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>Export SAGA .xml ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="apple-btn-destructive-soft flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold cursor-pointer tabular-nums"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Șterge ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Unified Filter & Search Toolbar */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full min-w-0">
          {/* 1. Segmente Perioadă */}
          <div className="apple-segmented flex-wrap sm:flex-nowrap !rounded-2xl sm:!rounded-full max-w-full shrink-0">
            {[
              { id: "all", label: "Toate" },
              { id: "today", label: "Azi" },
              { id: "month", label: "Lună" },
              { id: "lastMonth", label: "Luna trec." },
              { id: "year", label: "An" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={period === item.id}
                onClick={() => {
                  setPeriod(item.id);
                  setPage(1);
                }}
                className="apple-segmented-item px-2 2xl:px-2.5 shrink-0"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* 2. Segmente Status */}
          <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              data-active={statusFilter === "finalizat"}
              onClick={() => {
                setStatusFilter(statusFilter === "finalizat" ? "all" : "finalizat");
                setPage(1);
              }}
              className="apple-segmented-item px-2 2xl:px-2.5 tabular-nums shrink-0"
            >
              <span>Finalizate</span>
              <span className="opacity-75">{statusCounts.finalizat}</span>
            </button>
            <button
              type="button"
              data-active={statusFilter === "draft"}
              onClick={() => {
                setStatusFilter(statusFilter === "draft" ? "all" : "draft");
                setPage(1);
              }}
              className="apple-segmented-item px-2 2xl:px-2.5 tabular-nums shrink-0"
            >
              <span>Ciorne</span>
              <span className="opacity-75">{statusCounts.draft}</span>
            </button>
          </div>

          {/* 3. Right Side: Cont + Furnizor + Căutare + Reset */}
          <div className="xl:ml-auto flex flex-wrap sm:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full xl:w-auto xl:flex-1 justify-end min-w-0">
            <Select
              value={accountFilter}
              onValueChange={(val) => {
                setAccountFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger
                data-filtered={accountFilter !== "all"}
                className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 2xl:px-3"
              >
                <Layers className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                <SelectValue placeholder="Cont" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cont: Toate</SelectItem>
                {availableAccounts.map(({ acc, count }) => (
                  <SelectItem key={acc} value={acc}>
                    Cont {acc} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {availableSuppliers.length > 0 && (
              <Select
                value={supplierFilter}
                onValueChange={(val) => {
                  setSupplierFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  data-filtered={supplierFilter !== "all"}
                  className="apple-pill-control h-[34px] w-auto max-w-[175px] shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 2xl:px-3"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                  <SelectValue placeholder="Furnizor" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">Furnizor: Toți</SelectItem>
                  {availableSuppliers.map(({ name, count }) => (
                    <SelectItem key={name} value={name}>
                      {name} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative flex-1 min-w-[140px] max-w-full sm:max-w-[260px]">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                style={{ paddingLeft: 34, paddingRight: search ? 72 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
                placeholder="Caută NIR, furnizor, factură..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <>
                  <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {filtered.length}/{nirList.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearch("")}
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

      {/* Table Surface — Clean Apple macOS Finder / Mail Table */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-black/20 dark:border-white/20 dark:bg-[#2c2c2e] text-primary cursor-pointer"
                    checked={
                      paginated.length > 0 &&
                      paginated.every((r) => selectedIds.has(r.id))
                    }
                    onChange={toggleSelectAll}
                    title="Selectează / Deselectează toate de pe pagină"
                  />
                </th>
                <th className="px-3 py-3 w-12 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Nr.
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("nirNumber")}
                >
                  <div className="flex items-center gap-1">
                    <span>Nr. NIR & Dată</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("nirNumber")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("supplierName")}
                >
                  <div className="flex items-center gap-1">
                    <span>Furnizor & Factură</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("supplierName")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("totalWithVat")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Fără TVA + TVA = Total</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("totalWithVat")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("status")}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73] mx-auto" />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]"
                  >
                    <div className="flex flex-col items-center gap-2.5">
                      <span>
                        {hasActiveFilters
                          ? "Niciun NIR găsit pentru filtrele aplicate."
                          : "Niciun NIR creat. Apasă butonul NIR Nou sau iconița din tabelul Facturi."}
                      </span>
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
                paginated.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] cursor-pointer ${
                      selectedIds.has(row.id)
                        ? "bg-[#0071e3]/[0.05] dark:bg-[#0a84ff]/[0.12]"
                        : ""
                    }`}
                    onClick={() => navigate(`/nir/${row.id}`)}
                  >
                    {/* Checkbox rând */}
                    <td
                      className="px-4 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-black/20 dark:border-white/20 dark:bg-[#2c2c2e] text-primary cursor-pointer"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                      />
                    </td>
                    {/* Nr. */}
                    <td className="px-3 py-3 text-center text-[12px] text-[#8e8e93] font-medium tabular-nums whitespace-nowrap">
                      {(page - 1) * rowsPerPage + i + 1}
                    </td>
                    {/* NR. NIR + Dată recepție dedesubt */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/nir/${row.id}`);
                        }}
                        className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums block text-left cursor-pointer"
                      >
                        {row.nirNumber}
                      </button>
                      <div className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 whitespace-nowrap tabular-nums">
                        {formatDate(row.receiptDate)}
                      </div>
                      {search.trim() && (
                        <div className="mt-1 space-y-0.5">
                          {row.articleCodes
                            ?.filter((c: string) =>
                              c.toLowerCase().includes(search.toLowerCase().trim())
                            )
                            .map((c: string) => (
                              <span
                                key={c}
                                className="inline-block text-[10.5px] tabular-nums font-semibold bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 px-2 py-0.5 rounded-full mr-1"
                              >
                                Cod: {c}
                              </span>
                            ))}
                          {row.lineDescriptions
                            ?.filter((d: string) =>
                              d.toLowerCase().includes(search.toLowerCase().trim())
                            )
                            .slice(0, 1)
                            .map((d: string) => (
                              <div
                                key={d}
                                className="text-[11px] text-[#6e6e73] dark:text-[#98989d] truncate max-w-[200px]"
                                title={d}
                              >
                                {d}
                              </div>
                            ))}
                        </div>
                      )}
                    </td>
                    {/* FURNIZOR + Factură sursă și dată factură dedesubt */}
                    <td className="px-4 py-3">
                      <div
                        className="text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[320px] truncate"
                        title={row.supplierName || ""}
                      >
                        {row.supplierName || "—"}
                      </div>
                      {row.invoiceNumber || (row as any).invoiceDate || (row as any).spvIndex ? (
                        <div
                          className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 max-w-[320px] flex items-center gap-1.5 flex-wrap tabular-nums"
                          title={`Factură: ${row.invoiceNumber || ""}${(row as any).invoiceDate ? ` din ${formatDate((row as any).invoiceDate)}` : ""}${(row as any).spvIndex ? ` | SPV: ${(row as any).spvIndex}` : ""}`}
                        >
                          <span className="font-medium">{row.invoiceNumber || "Factură"}</span>
                          {(row as any).invoiceDate && (
                            <span className="text-[#8e8e93]">
                              · {formatDate((row as any).invoiceDate)}
                            </span>
                          )}
                          {(row as any).spvIndex && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10.5px] tabular-nums font-medium text-[#3a3a3c] dark:text-[#ebebf5] bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-full px-2 py-0.5 leading-none"
                              title={`ID Încărcare SPV: ${(row as any).spvIndex}`}
                            >
                              SPV #{(row as any).spvIndex}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11.5px] text-[#8e8e93] mt-0.5">—</div>
                      )}
                    </td>
                    {/* FĂRĂ TVA + TVA = TOTAL */}
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      <div className="text-[12.5px]">
                        <span className="font-medium text-[#6e6e73] dark:text-[#98989d]">
                          {(row.totalNet || 0).toLocaleString("ro-RO", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[#8e8e93] mx-1">+</span>
                        <span className="font-medium text-[#6e6e73] dark:text-[#98989d]">
                          {(row.totalVat || 0).toLocaleString("ro-RO", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[#8e8e93] mx-1">=</span>
                        <span className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {(row.totalWithVat || 0).toLocaleString("ro-RO", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>{" "}
                        <span className="text-[11px] font-medium text-[#8e8e93]">
                          RON
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8e8e93] mt-0.5">
                        {row.linesCount ?? 0}{" "}
                        {row.linesCount === 1 ? "articol" : "articole"}
                      </div>
                    </td>
                    {/* STATUS */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.status === "finalizat" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 leading-none">
                          Finalizat
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300 leading-none">
                          Draft
                        </span>
                      )}
                    </td>
                    {/* ACȚIUNI */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div
                        className="flex items-center gap-1.5 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setPdfViewer({ id: row.id, nirNumber: row.nirNumber })}
                          title="Vizualizează PDF"
                          aria-label="Vizualizează PDF"
                          className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePdfNir(row.id, row.nirNumber)}
                          title="Salvează PDF NIR (alege calea de salvare)"
                          aria-label="Salvează PDF NIR"
                          className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateSaga({ nirId: row.id })}
                          title={`Simulează și verifică NIR ${row.nirNumber} pentru SAGA C`}
                          aria-label="Simulează SAGA"
                          className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveSagaXml({
                              nirId: row.id,
                              nirNumber: row.nirNumber,
                            })
                          }
                          title={`Salvează NIR ${row.nirNumber} în SAGA C (.xml)`}
                          aria-label="Salvează SAGA XML"
                          className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row.id)}
                          title="Șterge NIR"
                          aria-label="Șterge NIR"
                          className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#ff3b30] dark:hover:text-[#ff453a] transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer paginare — Apple HIG Capsule Controls */}
        <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between bg-[#fafafa]/85 dark:bg-white/[0.02] flex-wrap gap-2">
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
                {filtered.length}
              </strong>{" "}
              documente
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span className="whitespace-nowrap mr-1.5">
              Pagina{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {page}
              </strong>{" "}
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {totalPages}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Pagina anterioară"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Pagina următoare"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <NirPdfViewerDialog
        nirId={pdfViewer?.id ?? null}
        nirNumber={pdfViewer?.nirNumber}
        onClose={() => setPdfViewer(null)}
      />

      {/* Single Delete Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi NIR-ul?</AlertDialogTitle>
            <AlertDialogDescription>
              Acțiunea este ireversibilă și va șterge NIR-ul și articolele asociate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteNir.mutate({ id: deleteTarget })
              }
              className="rounded-full bg-[#ff3b30] hover:bg-[#d70015] text-white"
            >
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
      >
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ștergi {selectedIds.size} NIR-uri selectate?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune va șterge definitiv cele {selectedIds.size} NIR-uri selectate împreună cu toate articolele asociate acestora. Acțiunea este ireversibilă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                bulkDeleteMut.mutate({ ids: Array.from(selectedIds) })
              }
              className="rounded-full bg-[#ff3b30] hover:bg-[#d70015] text-white"
              disabled={bulkDeleteMut.isPending}
            >
              {bulkDeleteMut.isPending ? "Se șterge..." : `Șterge ${selectedIds.size} NIR-uri`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="sm:max-w-md rounded-[22px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1d1d1f] dark:text-[#f5f5f7]">
              <Edit className="w-4 h-4 text-amber-500" />
              Modificare în masă ({selectedIds.size} NIR-uri)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">
                Status
              </label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="apple-input w-full h-10 px-3 text-[13.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">— Păstrează neschimbat —</SelectItem>
                  <SelectItem value="finalizat">Finalizat</SelectItem>
                  <SelectItem value="draft">Draft (Ciornă)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">
                Gestiune (opțional)
              </label>
              <input
                value={bulkGestiune}
                onChange={(e) => setBulkGestiune(e.target.value)}
                placeholder="Lasă gol pentru a nu schimba"
                className="apple-input w-full h-10 px-3.5 text-[13.5px] outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">
                Cont contabil implicit (opțional)
              </label>
              <input
                value={bulkAccount}
                onChange={(e) => setBulkAccount(e.target.value)}
                placeholder="Ex: 371, 301, 3028 (lasă gol pentru a nu schimba)"
                className="apple-input w-full h-10 px-3.5 text-[13.5px] outline-none tabular-nums"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setBulkEditOpen(false)}
              className="apple-btn-glass px-4 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={() => {
                const payload: any = { ids: Array.from(selectedIds) };
                if (bulkStatus !== "keep") payload.status = bulkStatus;
                if (bulkGestiune.trim()) payload.gestiune = bulkGestiune.trim();
                if (bulkAccount.trim()) payload.accountingAccount = bulkAccount.trim();
                bulkUpdateMut.mutate(payload);
              }}
              disabled={
                bulkUpdateMut.isPending ||
                (bulkStatus === "keep" &&
                  !bulkGestiune.trim() &&
                  !bulkAccount.trim())
              }
              className="apple-btn-prominent px-4 h-9 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-50 cursor-pointer"
            >
              {bulkUpdateMut.isPending ? "Se salvează..." : "Aplică modificările"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SagaImportSimulatorModal
        open={simulatorOpen}
        onOpenChange={setSimulatorOpen}
        loading={simulateNirImportMut.isPending}
        data={simulationData}
      />
    </div>
  );
}
