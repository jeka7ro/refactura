// NIRList — Lista NIR-urilor (Nota de Intrare-Recepție)
// UI Rules: Nr. Crt., total records, pagination, rounded-full filters & buttons, select-all & bulk operations

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Loader2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  ClipboardCheck,
  FileDown,
  FileCode,
  FileSpreadsheet,
  Edit,
  Calendar,
  Tag,
  Layers,
  Building2,
  X,
  RotateCcw,
} from "lucide-react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTableSort } from "@/hooks/useTableSort";
import { formatDate } from "@/lib/store";
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
  const [rowsPerPage, setRowsPerPage] = useState(15);
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

  const exportNirMut = trpc.saga.exportNir.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.xml], { type: "text/xml;charset=windows-1250" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "FACTURI.XML";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Fișierul ${data.filename} a fost descărcat pentru import în SAGA C!`);
    },
    onError: (e) => toast.error("Eroare export: " + e.message),
  });

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
  const handleExportExcel = (items = filtered) => {
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
      { wch: 14 }, // Data
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
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `Receptii_NIR_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(
        `Fișierul Excel (.xlsx) cu ${rows.length} NIR-uri a fost generat și descărcat cu succes!`
      );
    } catch (err: any) {
      toast.error(
        "Eroare la generarea fișierului Excel: " + (err?.message || err)
      );
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header Pagina */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-teal-600" />
            NIR — Note de Intrare-Recepție
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestionează recepția mărfurilor de la furnizori
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Buton Distinct: Export Excel (.xlsx) */}
          <button
            onClick={() => handleExportExcel(filtered)}
            title="Exportă lista de NIR-uri în format nativ Microsoft Excel (.xlsx)"
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-[#107c41] hover:bg-[#0b5c30] text-white text-sm font-bold transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel (.xlsx)
          </button>

          {/* Buton Distinct: Export SAGA (XML) */}
          <button
            onClick={() => exportNirMut.mutate({})}
            disabled={exportNirMut.isPending}
            title="Exportă recepțiile în format SAGA C (FACTURI.XML)"
            className="flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold transition-all shadow-sm disabled:opacity-50"
          >
            {exportNirMut.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileCode className="w-4 h-4 text-emerald-400" />
            )}
            Export SAGA (XML)
          </button>

          {/* Buton Creare NIR */}
          <button
            onClick={() => navigate("/nir/nou")}
            style={{ backgroundColor: "var(--tenant-theme-color, #16a34a)" }}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-white text-sm font-bold transition-all shadow-sm hover:brightness-90 active:brightness-75"
          >
            <Plus className="w-4 h-4" /> NIR Nou
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: "Total NIR-uri",
            value: nirList.length,
            cls: "text-slate-900 dark:text-white",
          },
          {
            label: "Finalizate",
            value: statusCounts.finalizat,
            style: { color: "var(--tenant-theme-color, #16a34a)" },
          },
          {
            label: "Ciorne",
            value: statusCounts.draft,
            cls: "text-amber-600",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {k.label}
            </p>
            <p className={`text-xl font-black ${k.cls || ""}`} style={k.style}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Banner selecție multiplă (Bulk Operations) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl shadow-md border bg-slate-900 text-white dark:bg-slate-800 dark:border-slate-700 animate-in fade-in duration-200 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-xs font-bold">
              {selectedIds.size}
            </span>
            <span className="text-sm font-semibold">
              NIR-uri selectate
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
            >
              Deselectează
            </button>
            <button
              onClick={() => {
                setBulkStatus("keep");
                setBulkGestiune("");
                setBulkAccount("");
                setBulkEditOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <Edit className="w-3.5 h-3.5" />
              Bulk Edit
            </button>
            <button
              onClick={() =>
                handleExportExcel(nirList.filter((n) => selectedIds.has(n.id)))
              }
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[#107c41] hover:bg-[#0b5c30] text-white text-xs font-bold transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Excel .xlsx ({selectedIds.size})
            </button>
            <button
              onClick={() =>
                exportNirMut.mutate({ nirIds: Array.from(selectedIds) })
              }
              disabled={exportNirMut.isPending}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
            >
              {exportNirMut.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              )}
              Export SAGA .xml ({selectedIds.size})
            </button>
            <button
              onClick={() => setBulkDeleteOpen(true)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Șterge ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Card tabel cu filtre integrate sus și paginare jos (ca în AllInvoices / Screenshot 1 & 2) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-2">
        {/* Search & Filtre afarente pe un singur rând compact */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800/50 flex flex-col gap-2 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 w-full flex-wrap xl:flex-nowrap">
            {/* Cautare Pill */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                style={{ paddingLeft: 34, paddingRight: search ? 68 : 14 }}
                className="rounded-full w-full h-8 border border-slate-200 dark:border-slate-700 outline-none text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 transition-all shadow-none"
                placeholder="Caută NIR, furnizor, factură, cont, articol..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <>
                  <div className="absolute right-7 top-1/2 -translate-y-1/2 bg-teal-600 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                    {filtered.length}/{nirList.length}
                  </div>
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
                  </button>
                </>
              )}
            </div>

            {/* Filtru Perioadă */}
            <div className="w-[140px] sm:w-[150px] flex-shrink-0">
              <Select
                value={period}
                onValueChange={(val) => {
                  setPeriod(val);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className={`h-8 w-full rounded-full text-xs font-bold border ${
                    period !== "all"
                      ? "border-blue-500 bg-blue-50/70 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700"
                      : "border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  } hover:bg-slate-50 focus:ring-2 focus:ring-teal-500 shadow-none flex items-center gap-1.5 px-3`}
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <SelectValue placeholder="Perioadă" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate dățile</SelectItem>
                  <SelectItem value="today">Azi</SelectItem>
                  <SelectItem value="week">Săpt. curentă</SelectItem>
                  <SelectItem value="month">Luna curentă</SelectItem>
                  <SelectItem value="lastMonth">Luna trecută</SelectItem>
                  <SelectItem value="year">Anul curent</SelectItem>
                  <SelectItem value="lastYear">Anul trecut</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtru Status */}
            <div className="w-[125px] sm:w-[140px] flex-shrink-0">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className={`h-8 w-full rounded-full text-xs font-bold border ${
                    statusFilter !== "all"
                      ? "border-indigo-500 bg-indigo-50/70 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-700"
                      : "border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  } hover:bg-slate-50 focus:ring-2 focus:ring-teal-500 shadow-none flex items-center gap-1.5 px-3`}
                >
                  <Tag className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Status: Toate ({nirList.length})
                  </SelectItem>
                  <SelectItem value="finalizat">
                    ✓ Finalizate ({statusCounts.finalizat})
                  </SelectItem>
                  <SelectItem value="draft">
                    ○ Ciorne ({statusCounts.draft})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtru Cont Contabil */}
            <div className="w-[130px] sm:w-[150px] flex-shrink-0">
              <Select
                value={accountFilter}
                onValueChange={(val) => {
                  setAccountFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className={`h-8 w-full rounded-full text-xs font-bold border ${
                    accountFilter !== "all"
                      ? "border-emerald-500 bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700"
                      : "border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  } hover:bg-slate-50 focus:ring-2 focus:ring-teal-500 shadow-none flex items-center gap-1.5 px-3`}
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
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
            </div>

            {/* Filtru Furnizor (dacă există) */}
            {availableSuppliers.length > 0 && (
              <div className="w-[140px] sm:w-[165px] flex-shrink-0">
                <Select
                  value={supplierFilter}
                  onValueChange={(val) => {
                    setSupplierFilter(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className={`h-8 w-full rounded-full text-xs font-bold border ${
                      supplierFilter !== "all"
                        ? "border-purple-500 bg-purple-50/70 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-700"
                        : "border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    } hover:bg-slate-50 focus:ring-2 focus:ring-teal-500 shadow-none flex items-center gap-1.5 px-3`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
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
              </div>
            )}

            {/* Resetare filtre active */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="h-8 px-3 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1 transition-colors flex-shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                Resetează
              </button>
            )}
          </div>
        </div>

        {/* Tabelul NIR (Stilizat exact conform Screenshot 1) */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                {/* Checkbox Select All */}
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-teal-600 focus:ring-teal-500 cursor-pointer"
                    checked={
                      paginated.length > 0 &&
                      paginated.every((r) => selectedIds.has(r.id))
                    }
                    onChange={toggleSelectAll}
                    title="Selectează / Deselectează toate de pe pagină"
                  />
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 w-10 whitespace-nowrap">
                  #
                </th>
                <th
                  className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("nirNumber")}
                >
                  <div className="flex items-center gap-1">
                    NR. NIR / DATĂ{" "}
                    <span className="text-blue-500">
                      {getSortIcon("nirNumber")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("supplierName")}
                >
                  <div className="flex items-center gap-1">
                    FURNIZOR / FACTURĂ{" "}
                    <span className="text-blue-500">
                      {getSortIcon("supplierName")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("totalWithVat")}
                >
                  <div className="flex items-center justify-end gap-1">
                    SUMĂ CU TVA{" "}
                    <span className="text-blue-500">
                      {getSortIcon("totalWithVat")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center justify-center gap-1">
                    STATUS{" "}
                    <span className="text-blue-500">
                      {getSortIcon("status")}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  ACȚIUNI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2
                      className="w-6 h-6 animate-spin mx-auto"
                      style={{ color: "var(--tenant-theme-color, #16a34a)" }}
                    />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-xs text-slate-400"
                  >
                    {hasActiveFilters
                      ? "Niciun NIR găsit pentru filtrele aplicate."
                      : "Niciun NIR creat. Apasă butonul NIR Nou sau iconița din tabelul Facturi."}
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${
                      selectedIds.has(row.id)
                        ? "bg-teal-50/50 dark:bg-teal-950/20"
                        : ""
                    }`}
                    onClick={() => navigate(`/nir/${row.id}`)}
                  >
                    {/* Checkbox rând */}
                    <td
                      className="px-3 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                      />
                    </td>
                    {/* # */}
                    <td className="px-3 py-3 text-center text-[11px] text-slate-400 font-medium">
                      {(page - 1) * rowsPerPage + i + 1}.
                    </td>
                    {/* NR. NIR + Dată recepție dedesubt */}
                    <td className="px-3 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/nir/${row.id}`);
                        }}
                        style={{ color: "var(--tenant-theme-color, #16a34a)" }}
                        className="text-xs font-bold hover:underline block"
                      >
                        {row.nirNumber}
                      </button>
                      <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                        {formatDate(row.receiptDate)}
                      </div>
                      {/* Evidențiere dacă termenul căutat a potrivit un cod de articol sau descriere din NIR */}
                      {search.trim() && (
                        <div className="mt-1 space-y-0.5">
                          {row.articleCodes
                            ?.filter((c: string) =>
                              c.toLowerCase().includes(search.toLowerCase().trim())
                            )
                            .map((c: string) => (
                              <span
                                key={c}
                                className="inline-block text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800 mr-1"
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
                                className="text-[10px] text-slate-500 truncate max-w-[200px]"
                                title={d}
                              >
                                {d}
                              </div>
                            ))}
                        </div>
                      )}
                    </td>
                    {/* FURNIZOR + Factură sursă și dată factură dedesubt */}
                    <td className="px-3 py-3">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[320px] truncate" title={row.supplierName || ""}>
                        {row.supplierName || "—"}
                      </div>
                      {row.invoiceNumber || (row as any).invoiceDate || (row as any).spvIndex ? (
                        <div
                          className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 max-w-[320px] flex items-center gap-1.5 flex-wrap"
                          title={`Factură: ${row.invoiceNumber || ""}${(row as any).invoiceDate ? ` din ${formatDate((row as any).invoiceDate)}` : ""}${(row as any).spvIndex ? ` | SPV: ${(row as any).spvIndex}` : ""}`}
                        >
                          <span className="text-slate-500 dark:text-slate-400 font-medium">{row.invoiceNumber || "Factură"}</span>
                          {(row as any).invoiceDate && (
                            <span className="text-slate-400 dark:text-slate-500 font-normal">
                              din {formatDate((row as any).invoiceDate)}
                            </span>
                          )}
                          {(row as any).spvIndex && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded px-1.5 py-0.2"
                              title={`ID Încărcare SPV: ${(row as any).spvIndex}`}
                            >
                              SPV: {(row as any).spvIndex}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 mt-0.5">—</div>
                      )}
                    </td>
                    {/* SUMĂ CU TVA + Articole dedesubt (fără bulină) */}
                    <td className="px-3 py-3 text-right">
                      <div className="font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {(row.totalWithVat || 0).toLocaleString("ro-RO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-[11px] font-normal text-slate-400">
                          RON
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5 whitespace-nowrap">
                        {row.linesCount ?? 0}{" "}
                        {row.linesCount === 1 ? "articol" : "articole"}
                      </div>
                    </td>
                    {/* STATUS (Pill rotunjit ca în Screenshot 1) */}
                    <td className="px-3 py-3 text-center">
                      {row.status === "finalizat" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Finalizat
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                          Draft
                        </span>
                      )}
                    </td>
                    {/* ACȚIUNI (4 butoane circulare ca în Screenshot 1) */}
                    <td className="px-3 py-3">
                      <div
                        className="flex items-center gap-1.5 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`/api/pdf/nir/${row.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Vizualizează PDF"
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`/api/pdf/nir/${row.id}?download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Descarcă PDF NIR"
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-colors"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => exportNirMut.mutate({ nirId: row.id })}
                          title={`Exportă NIR ${row.nirNumber} în SAGA C (FACTURI.XML)`}
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-teal-50 hover:bg-teal-100 text-teal-600 border border-teal-200 transition-colors"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row.id)}
                          title="Șterge NIR"
                          className="w-7 h-7 rounded-full flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
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

        {/* Footer paginare (Interiorul cardului conform Screenshot 1) */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap text-xs text-slate-500 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <span>Afișează</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 text-xs font-bold outline-none cursor-pointer"
            >
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>
              Total înregistrări: <strong>{filtered.length}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>
              Pg. {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Single Delete Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi NIR-ul?</AlertDialogTitle>
            <AlertDialogDescription>
              Acțiunea este ireversibilă și va șterge NIR-ul și articolele asociate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteNir.mutate({ id: deleteTarget })
              }
              className="bg-red-600 hover:bg-red-700 text-white"
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ștergi {selectedIds.size} NIR-uri selectate?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune va șterge definitiv cele {selectedIds.size} NIR-uri selectate împreună cu toate articolele asociate acestora. Acțiunea este ireversibilă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                bulkDeleteMut.mutate({ ids: Array.from(selectedIds) })
              }
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={bulkDeleteMut.isPending}
            >
              {bulkDeleteMut.isPending ? "Se șterge..." : `Șterge ${selectedIds.size} NIR-uri`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-amber-500" />
              Modificare în masă ({selectedIds.size} NIR-uri)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="keep">— Păstrează neschimbat —</option>
                <option value="finalizat">Finalizat</option>
                <option value="draft">Draft (Ciornă)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Gestiune (opțional)
              </label>
              <input
                value={bulkGestiune}
                onChange={(e) => setBulkGestiune(e.target.value)}
                placeholder="Lasă gol pentru a nu schimba"
                className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cont Contabil Implicit (opțional)
              </label>
              <input
                value={bulkAccount}
                onChange={(e) => setBulkAccount(e.target.value)}
                placeholder="Ex: 371, 301, 3028 (lasă gol pentru a nu schimba)"
                className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setBulkEditOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-sm"
            >
              {bulkUpdateMut.isPending ? "Se salvează..." : "Aplică modificările"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
