// AllInvoices — pagina unificată (import XML e-Factura mutat în pagina Integrări)
// UI Rules: Nr. Crt., search+counter, footer paginare, rounded-lg butoane

import { useState, useMemo } from "react";
import JSZip from "jszip";
import { Link, useLocation } from "wouter";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Loader2,
  Send,
  FileDown,
  X,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  Download,
  CheckCircle,
  ClipboardList,
  MoreVertical,
} from "lucide-react";
import { formatCurrency, formatDate, type Currency } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { normalizeText } from "@/lib/utils";
import { useTableSort } from "@/hooks/useTableSort";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InvoiceType = "primit" | "emis" | "refacturat";

interface UnifiedRow {
  id: number;
  type: InvoiceType;
  number: string;
  partnerName: string;
  partnerCui?: string;
  date: string;
  dueDate: string;
  total: number;
  currency: string;
  status: string;
  fileUrl?: string | null;
  source: string;
  itemsText?: string;
  spvStatus?: string | null;
}

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  spv_anaf: { label: "SPV", cls: "text-blue-900 dark:text-blue-400" },
  oblio: { label: "Oblio", cls: "text-orange-600 dark:text-orange-400" },
  smartbill: { label: "SmartBill", cls: "text-cyan-600 dark:text-cyan-400" },
  manual: { label: "Manual", cls: "text-slate-500 dark:text-slate-400" },
  refactura: { label: "Re-fact", cls: "text-blue-600 dark:text-blue-400" },
};

const TYPE_BADGE: Record<InvoiceType, { label: string; cls: string }> = {
  primit: { label: "Primit", cls: "text-red-600 dark:text-red-400" },
  emis: { label: "Emis", cls: "text-emerald-600 dark:text-emerald-400" },
  refacturat: { label: "Re-facturat", cls: "text-blue-600 dark:text-blue-400" },
};
const STATUS_CLS: Record<string, string> = {
  pending: "text-amber-600 dark:text-amber-500",
  processed: "text-emerald-600 dark:text-emerald-400",
  paid: "text-emerald-600 dark:text-emerald-400",
  draft: "text-slate-500 dark:text-slate-400",
  sent: "text-amber-600 dark:text-amber-500",
  archived: "text-slate-400 dark:text-slate-500",
  overdue: "text-rose-600 dark:text-rose-500",
  storno: "text-rose-600 dark:text-rose-500",
};
const STATUS_LBL: Record<string, string> = {
  pending: "Neîncasat",
  processed: "Încasat",
  paid: "Încasat",
  draft: "Ciornă",
  sent: "Neîncasat",
  archived: "Arhivat",
  overdue: "Restanță",
  storno: "Storno",
};
// Pentru facturi PRIMITE: pending = Neachitat (tu trebuie să plătești)
const STATUS_LBL_PRIMIT: Record<string, string> = {
  pending: "Neachitat",
  processed: "Achitat",
  paid: "Achitat",
  draft: "Ciornă",
  sent: "Neachitat",
  archived: "Arhivat",
  overdue: "Restanță",
  storno: "Storno",
};
const getStatusLabel = (status: string, type: string) =>
  type === "primit"
    ? STATUS_LBL_PRIMIT[status] || status
    : STATUS_LBL[status] || status;

export default function AllInvoices() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  // Helper: forțează download în loc de preview în browser
  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [typeFilter, setTypeFilter] = useState<InvoiceType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<UnifiedRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleCardFilterClick = (type: InvoiceType, status: string) => {
    if (typeFilter === type && filterStatus === status) {
      setTypeFilter("all");
      setFilterStatus("all");
    } else {
      setTypeFilter(type);
      setFilterStatus(status);
      setPage(1);
    }
  };

  const handleDownloadSelectedZip = async () => {
    const selectedRows = allRows.filter((r) =>
      selectedIds.has(`${r.type}-${r.id}`)
    );
    if (selectedRows.length === 0) {
      toast.error("Nu ai selectat nicio factură!");
      return;
    }

    toast.loading("Pregătesc arhiva ZIP...", { id: "zip" });
    try {
      const zip = new JSZip();
      let added = 0;

      for (const row of selectedRows) {
        if (row.fileUrl) {
          try {
            const token = localStorage.getItem("authToken");
            const response = await fetch(row.fileUrl, {
              headers: {
                Authorization: token ? `Bearer ${token}` : "",
              },
            });
            
            const contentType = response.headers.get("content-type");
            if (!response.ok || (contentType && contentType.includes("text/html"))) {
              console.error("Eroare la fetch sau PDF lipsă (fallback HTML) pentru", row.fileUrl, response.statusText);
              continue;
            }
            
            const blob = await response.blob();
            const safeNumber = row.number.replace(/[^a-z0-9]/gi, "_");
            const filename = `Factura_${row.type.toUpperCase()}_${safeNumber}.pdf`;
            zip.file(filename, blob);
            added++;
          } catch (e) {
            console.error("Eroare de rețea la fetch pentru", row.fileUrl, e);
          }
        }
      }

      if (added === 0) {
        toast.error("Nicio factură selectată nu are PDF disponibil pe server.", {
          id: "zip",
        });
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Facturi_Selectate_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Arhiva conține ${added} facturi descărcate.`, {
        id: "zip",
      });
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error("Eroare la crearea arhivei.", { id: "zip" });
    }
  };
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });

  // Period date range helper
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
      case "custom":
        return customFrom && customTo ? [customFrom, customTo] : null;
      default:
        return null;
    }
  };

  const toggleSelect = (rowKey: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(rowKey) ? next.delete(rowKey) : next.add(rowKey);
      return next;
    });
  };

  const toggleSelectAll = (pageRows: UnifiedRow[]) => {
    const pageKeys = pageRows.map(r => `${r.type}-${r.id}`);
    const allSelected = pageKeys.every(k => selectedIds.has(k));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        pageKeys.forEach(k => next.delete(k));
      } else {
        pageKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const getSelectedPrimitRows = () =>
    allRows.filter(
      r => r.type === "primit" && selectedIds.has(`primit-${r.id}`)
    );

  const {
    data: archiveData,
    isLoading: l1,
    refetch: r1,
  } = trpc.invoiceArchive.list.useQuery({});
  const {
    data: reInvoices = [],
    isLoading: l2,
    refetch: r2,
  } = trpc.reinvoice.list.useQuery();
  const {
    data: emittedInvoices = [],
    isLoading: l3,
    refetch: r3,
  } = trpc.emittedInvoice.list.useQuery();

  const { data: tenantsData = [] } = trpc.tenants.list.useQuery();
  const tenant = (tenantsData as any[])[0];
  const tenantSettings = useMemo(() => {
    try {
      return JSON.parse(tenant?.settings || "{}");
    } catch {
      return {};
    }
  }, [tenant]);

  const downloadPDF = trpc.reinvoice.downloadPDF.useMutation();
  const syncOblio = trpc.integrations.syncOblio.useMutation({
    onSuccess: () => {
      r1();
      r2();
      r3();
    },
  });
  const syncSpvManual = trpc.integrations.syncSpvManual.useMutation({
    onSuccess: () => {
      r1();
      r2();
      r3();
    },
  });
  const { data: dbIntegrations = [] } = trpc.integrations.list.useQuery();

  const deleteArchive = trpc.invoiceArchive.delete.useMutation({
    onSuccess: () => r1(),
  });
  const deleteReinvoice = trpc.reinvoice.delete.useMutation({
    onSuccess: () => r2(),
  });
  const deleteEmitted = trpc.emittedInvoice.delete.useMutation({
    onSuccess: () => r3(),
  });

  const markEmittedPaid = trpc.emittedInvoice.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Factură marcată ca Încasată!");
      r3();
    },
    onError: e => toast.error("Eroare: " + e.message),
  });
  const markArchivePaid = trpc.invoiceArchive.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Factură marcată ca Achitată!");
      r1();
    },
    onError: e => toast.error("Eroare: " + e.message),
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    toast.loading("Ștergere în curs...", { id: "delete" });
    try {
      if (deleteTarget.type === "refacturat") {
        await deleteReinvoice.mutateAsync({ id: deleteTarget.id });
      } else if (
        deleteTarget.type === "emis" &&
        deleteTarget.source === "manual"
      ) {
        await deleteEmitted.mutateAsync({ id: deleteTarget.id });
      } else {
        await deleteArchive.mutateAsync({ id: deleteTarget.id });
      }
      toast.success("Factură ștearsă cu succes!", { id: "delete" });
    } catch (e: any) {
      toast.error("Eroare la ștergere", {
        id: "delete",
        description: e?.message,
      });
    }
    setDeleteTarget(null);
  };

  const isLoading = l1 || l2 || l3;

  const archiveItems = useMemo(() => {
    const raw = archiveData as unknown as { items: any[]; metadata: any };
    if (raw?.items) return raw.items;
    return [];
  }, [archiveData]);

  const allRows: UnifiedRow[] = useMemo(() => {
    const rows: UnifiedRow[] = [];
    archiveItems.forEach((i: any) => {
      const t = parseFloat(i.total || "0");
      rows.push({
        id: i.id,
        type: i.direction === "in" ? "primit" : "emis",
        number: i.invoiceNumber || `#${i.id}`,
        partnerName: i.supplierName || "—",
        date: i.issueDate || i.createdAt || "",
        dueDate: i.dueDate || "",
        total: t,
        currency: i.currency || "RON",
        status: t < 0 ? "storno" : i.status || "pending",
        fileUrl: i.source === "spv_anaf" || i.fileUrl === "spv_import" ? `/api/pdf/archive/${i.id}` : i.fileUrl,
        source: i.source || "spv_anaf",
        itemsText: i.itemsText || "",
      });
    });
    (Array.isArray(reInvoices) ? reInvoices : []).forEach((i: any) => {
      const t = parseFloat(i.total || "0");
      rows.push({
        id: i.id,
        type: "refacturat",
        number: i.number || `RF-${i.id}`,
        partnerName: i.clientName || "—",
        date: i.issueDate || i.createdAt || "",
        dueDate: i.dueDate || "",
        total: t,
        currency: i.currency || "RON",
        status: t < 0 ? "storno" : i.status || "draft",
        fileUrl: i.pdfUrl && i.pdfUrl !== "spv_import" ? i.pdfUrl : `/api/pdf/reinvoice/${i.id}`,
        source: "refactura",
        itemsText: i.itemsText || "",
      });
    });
    (Array.isArray(emittedInvoices) ? emittedInvoices : []).forEach(
      (i: any) => {
        const t = parseFloat(i.total || "0");
        rows.push({
          id: i.id,
          type: "emis",
          number: i.number || `FACT-${i.id}`,
          partnerName: i.clientName || "—",
          date: i.issueDate || i.createdAt || "",
          dueDate: i.dueDate || "",
          total: t,
          currency: i.currency || "RON",
          status:
            t < 0
              ? "storno"
              : i.status === "sent"
                ? "sent"
                : i.status || "draft",
          fileUrl: i.pdfUrl && i.pdfUrl !== "spv_import" ? i.pdfUrl : `/api/pdf/emitted/${i.id}`,
          source: "manual",
          itemsText: i.itemsText || "",
          spvStatus: i.spvStatus,
        });
      }
    );
    return rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [archiveItems, reInvoices, emittedInvoices]);

  const filtered = useMemo(() => {
    let rows =
      typeFilter === "all"
        ? allRows
        : allRows.filter(r => r.type === typeFilter);
    if (filterStatus !== "all") {
      if (filterStatus === "paid" || filterStatus === "processed") {
        rows = rows.filter(
          r => r.status === "paid" || r.status === "processed"
        );
      } else if (filterStatus === "pending") {
        rows = rows.filter(
          r => r.status !== "paid" && r.status !== "processed"
        );
      }
    }
    // Period filter
    const range = getDateRange(period);
    if (range) {
      const [from, to] = range;
      rows = rows.filter(r => {
        const d = (r.date || "").slice(0, 10);
        return d >= from && d <= to;
      });
    }
    if (sourceFilter !== "all") {
      rows = rows.filter(r => r.source === sourceFilter);
    }
    if (search.trim()) {
      const q = normalizeText(search.trim());
      rows = rows.filter(
        r =>
          normalizeText(r.number).includes(q) ||
          normalizeText(r.partnerName).includes(q) ||
          normalizeText(STATUS_LBL[r.status] || r.status).includes(q) ||
          r.total.toString().includes(q) ||
          normalizeText(SOURCE_BADGE[r.source]?.label || r.source).includes(
            q
          ) ||
          normalizeText(r.source).includes(q) ||
          (r.itemsText && normalizeText(r.itemsText).includes(q))
      );
    }
    return rows;
  }, [
    allRows,
    search,
    typeFilter,
    filterStatus,
    sourceFilter,
    period,
    customFrom,
    customTo,
  ]);

  const { sortedData, handleSort, getSortIcon } = useTableSort(
    filtered,
    "all_invoices"
  );

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const paginated = sortedData.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );
  const counts = {
    all: allRows.length,
    primit: allRows.filter(r => r.type === "primit").length,
    emis: allRows.filter(r => r.type === "emis").length,
    refacturat: allRows.filter(r => r.type === "refacturat").length,
  };

  // Import XML e-Factura: mutat în pagina Integrări → cardul „SPV ANAF".

  // ── Download PDF re-factură ──

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-3">
      {/* Header cu Titlu + Export/Sync (Top Row) si Filtre Perioada (Bottom Row) */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Top Row: Title & Action Buttons */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Facturi
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total: <strong>{allRows.length}</strong> înregistrări
            </p>
          </div>
        </div>

      {/* KPI Cards (Swipeable on mobile) */}
        <div className="flex overflow-x-auto sm:grid sm:grid-cols-4 gap-4 pb-2 snap-x hide-scrollbar">
          {/* TOTAL */}
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between h-20 shadow-sm transition-all hover:shadow-md min-w-[85vw] sm:min-w-0 snap-center cursor-pointer"
            onClick={() => { setTypeFilter("all"); setPage(1); }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Total Facturi
              </p>
              <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                {allRows.length}
              </p>
            </div>
          </div>

          {/* EMISE */}
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between h-20 shadow-sm transition-all hover:shadow-md min-w-[85vw] sm:min-w-0 snap-center cursor-pointer"
            onClick={() => { setTypeFilter("emis"); setPage(1); }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Emise
              </p>
              <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                {allRows.filter(r => r.type === "emis").length}
              </p>
            </div>
          </div>

          {/* PRIMITE */}
          <div
             className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between h-20 shadow-sm transition-all hover:shadow-md min-w-[85vw] sm:min-w-0 snap-center cursor-pointer"
             onClick={() => { setTypeFilter("primit"); setPage(1); }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Primite
              </p>
              <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                {allRows.filter(r => r.type === "primit").length}
              </p>
            </div>
          </div>

          {/* RE-FACTURATE */}
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between h-20 shadow-sm transition-all hover:shadow-md min-w-[85vw] sm:min-w-0 snap-center cursor-pointer"
            onClick={() => { setTypeFilter("refacturat"); setPage(1); }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Re-facturate
              </p>
              <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
                {allRows.filter(r => r.type === "refacturat").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Banner selectie multipla */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow-md">
          <span className="text-sm font-semibold">
            {selectedIds.size} factură/facturi selectate pentru Re-Facturare
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
            >
              Anulează
            </button>
            <button
              onClick={async () => {
                if (
                  !window.confirm(
                    `Ștergi ${selectedIds.size} facturi selectate?`
                  )
                )
                  return;
                toast.loading("Ștergere în curs...", { id: "bulk-del" });
                let ok = 0;
                for (const key of Array.from(selectedIds)) {
                  const [type, idStr] = key.split("-");
                  const id = Number(idStr);
                  try {
                    if (type === "refacturat")
                      await deleteReinvoice.mutateAsync({ id });
                    else await deleteArchive.mutateAsync({ id });
                    ok++;
                  } catch {}
                }
                setSelectedIds(new Set());
                toast.success(`${ok} facturi șterse`, { id: "bulk-del" });
              }}
              className="px-3 h-7 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs font-bold transition-colors shadow-sm"
            >
              Șterge selectate
            </button>
            <button
              onClick={() => {
                const ids = getSelectedPrimitRows()
                  .map(r => r.id)
                  .join(",");
                navigate(`/re-facturare/multiplu?ids=${ids}`);
              }}
              className="px-3 h-7 rounded-lg bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold transition-colors shadow-sm"
            >
              Re-Facturare Multiplă →
            </button>
          </div>
        </div>
      )}

      {/* Card tabel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-6">
        {/* Search & Filtre */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800/50 flex flex-col gap-3 bg-white dark:bg-slate-900">
          
          {/* Randul 1: Cautare si Buton Sync (Mobile-first layout) */}
          <div className="flex items-center gap-3 w-full">
            <div style={{ position: "relative" }} className="flex-1 flex-shrink-0">
              <Search
                className="w-3.5 h-3.5 text-slate-400"
                style={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
              <input
                style={{
                  paddingLeft: 26,
                  paddingRight: search ? 60 : 10,
                  borderRadius: 9999,
                  width: "100%",
                  height: 32,
                  border: "1px solid #e2e8f0",
                  outline: "none",
                  fontSize: 12,
                }}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white dark:border-slate-700"
                placeholder="Caută factură..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      right: 22,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "#2563eb",
                      color: "white",
                      borderRadius: 9999,
                      padding: "1px 6px",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {filtered.length}/{allRows.length}
                  </div>
                  <button
                    onClick={() => setSearch("")}
                    style={{
                      position: "absolute",
                      right: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-slate-700" />
                  </button>
                </>
              )}
            </div>
            
            <button
              onClick={async () => {
                const hasOblio = (dbIntegrations as any[]).some(
                  i => i.provider === "oblio" && i.status === "active"
                );
                const hasSpv = (dbIntegrations as any[]).some(
                  i => i.provider === "spv" && i.status === "active"
                );
                let syncedAny = false;

                if (hasOblio || hasSpv) {
                  toast.loading("Sincronizare date în curs...", { id: "sync" });
                  let spvResult: any = null;
                  const tasks = [];
                  if (hasOblio)
                    tasks.push(syncOblio.mutateAsync().catch(() => {}));
                  if (hasSpv)
                    tasks.push(
                      syncSpvManual.mutateAsync().then(r => { spvResult = r; }).catch(() => {})
                    );
                  await Promise.all(tasks);
                  syncedAny = true;

                  // Refetch tables after sync
                  r1();
                  r2();
                  r3();

                  // Show result message
                  if (spvResult?.limitHit > 0) {
                    const facturiNoi = spvResult.imported === 1 ? "1 factură nouă importată" : `${spvResult.imported} facturi noi importate`;
                    const facturiLimita = spvResult.limitHit === 1 ? "1 factură" : `${spvResult.limitHit} facturi`;
                    toast.warning(
                      `Sync complet: ${facturiNoi}.\n⚠️ ${facturiLimita} nu ${spvResult.limitHit === 1 ? "a putut" : "au putut"} fi descărcată azi — ANAF permite maxim 10 descărcări/zi per fișier. Va fi importată automat mâine.`,
                      { id: "sync", duration: 8000 }
                    );
                  } else if (spvResult?.imported > 0) {
                    const facturiNoi = spvResult.imported === 1 ? "1 factură nouă importată" : `${spvResult.imported} facturi noi importate`;
                    toast.success(`Sync complet: ${facturiNoi} din SPV!`, { id: "sync" });
                  } else {
                    toast.success("SPV sincronizat! Nicio factură nouă de importat.", { id: "sync" });
                  }
                }

                if (!syncedAny) {
                  toast.error(
                    "Nicio integrare activă de sincronizat. Verificați Setările."
                  );
                }
              }}
              disabled={syncOblio.isPending || syncSpvManual.isPending}
              className="flex items-center justify-center gap-1.5 px-4 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all disabled:opacity-60 flex-shrink-0 shadow-sm"
              title="Sincronizează din sursele configurate (Oblio / SPV)"
            >
              {syncOblio.isPending || syncSpvManual.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Sync</span>
            </button>
          </div>

          {/* Randul 2: Restul filtrelor (wrap inteligent) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Filter */}
            <Select
              value={period}
              onValueChange={val => {
                setPeriod(val as any);
                const range = getDateRange(val);
                if (range && val !== "custom") {
                  setCustomFrom(range[0]);
                  setCustomTo(range[1]);
                }
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-fit min-w-[110px] rounded-full text-xs font-bold border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 flex-shrink-0">
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
                <SelectItem value="custom">Personalizat...</SelectItem>
              </SelectContent>
            </Select>

            {/* Arată input-urile doar dacă este pe "custom" */}
            {period === "custom" && (
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => {
                    setCustomFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-6 px-1.5 text-xs bg-transparent text-slate-600 dark:text-slate-300 outline-none w-[100px]"
                />
                <span className="text-[10px] text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => {
                    setCustomTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-6 px-1.5 text-xs bg-transparent text-slate-600 dark:text-slate-300 outline-none w-[100px]"
                />
              </div>
            )}

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

            {/* Type Filter */}
            <Select
              value={typeFilter}
              onValueChange={val => {
                setTypeFilter(val as any);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-fit min-w-[100px] rounded-full text-xs font-bold border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 flex-shrink-0">
                <SelectValue placeholder="Tip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate {counts["all"]}</SelectItem>
                <SelectItem value="primit">
                  Primite {counts["primit"]}
                </SelectItem>
                <SelectItem value="emis">Emise {counts["emis"]}</SelectItem>
                <SelectItem value="refacturat">
                  Re-fact. {counts["refacturat"]}
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

            {/* Source Filter */}
            <Select
              value={sourceFilter}
              onValueChange={val => {
                setSourceFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-fit min-w-[100px] rounded-full text-xs font-bold border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 flex-shrink-0">
                <SelectValue placeholder="Sursă" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate sursele</SelectItem>
                <SelectItem value="spv_anaf">SPV ANAF</SelectItem>
                <SelectItem value="oblio">Oblio</SelectItem>
                <SelectItem value="smartbill">SmartBill</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="refactura">Re-Facturat</SelectItem>
              </SelectContent>
            </Select>

          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={
                      paginated.length > 0 &&
                      paginated.every(r => selectedIds.has(`${r.type}-${r.id}`))
                    }
                    onChange={() => toggleSelectAll(paginated)}
                    title="Selectează/Deselectează toate de pe această pagină"
                  />
                </th>
                <th className="px-4 py-3 w-16 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Nr. Crt.
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("number")}
                >
                  <div className="flex items-center gap-1">
                    Număr & Partener{" "}
                    <span className="text-blue-500">
                      {getSortIcon("number")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("type")}
                >
                  <div className="flex items-center gap-1">
                    Tip & Status{" "}
                    <span className="text-blue-500">{getSortIcon("type")}</span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    Dată{" "}
                    <span className="text-blue-500">{getSortIcon("date")}</span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("dueDate")}
                >
                  <div className="flex items-center gap-1">
                    Scadență{" "}
                    <span className="text-blue-500">
                      {getSortIcon("dueDate")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("total")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Total{" "}
                    <span className="text-blue-500">
                      {getSortIcon("total")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("source")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Sursă{" "}
                    <span className="text-blue-500">
                      {getSortIcon("source")}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-4 text-center text-slate-400 text-[11px] bg-slate-50/50 dark:bg-slate-800/20 border-b border-dashed border-slate-200 dark:border-slate-800"
                  >
                    {search || typeFilter !== "all"
                      ? "Nicio factură pentru filtrele aplicate."
                      : "Nu există facturi. Apasă Sync sau importă XML din pagina Integrări."}
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => {
                  const tb = TYPE_BADGE[row.type];
                  return (
                    <tr
                      key={`${row.source}-${row.type}-${row.id}`}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedIds.has(`${row.type}-${row.id}`) ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={selectedIds.has(`${row.type}-${row.id}`)}
                          onChange={() => toggleSelect(`${row.type}-${row.id}`)}
                        />
                      </td>
                      <td className="px-4 py-3 text-center text-[11px] font-medium text-slate-500">
                        {(page - 1) * rowsPerPage + i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => {
                              if (row.type === "refacturat")
                                navigate(`/re-facturi/${row.id}`);
                              else if (
                                row.type === "emis" &&
                                row.source === "manual"
                              )
                                navigate(`/facturi-emise-nou/view/${row.id}`);
                              else navigate(`/facturi-primite/${row.id}`);
                            }}
                            className="text-sm font-bold text-blue-600 hover:underline text-left"
                          >
                            {row.number}
                          </button>
                          <span
                            className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-[180px] truncate"
                            title={row.partnerName}
                          >
                            {row.partnerName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className={`text-sm font-bold ${tb.cls}`}>
                            {tb.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-sm font-bold ${STATUS_CLS[row.status] || STATUS_CLS.pending}`}
                            >
                              {getStatusLabel(row.status, row.type)}
                            </span>
                            {row.spvStatus && (row.spvStatus.toLowerCase() === "validat" || row.spvStatus.toLowerCase() === "trimisa") && (
                              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                {row.spvStatus.toLowerCase() === "validat" ? "Validată SPV" : "Trimisă SPV"}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(row.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(row.total, row.currency as Currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const sb =
                            SOURCE_BADGE[row.source] || SOURCE_BADGE.manual;
                          if (row.source === "spv_anaf") {
                            return (
                              <div
                                className={`flex flex-col items-center leading-tight text-xs font-bold ${sb.cls}`}
                              >
                                <span>SPV</span>
                                <span>ANAF</span>
                              </div>
                            );
                          }
                          return (
                            <span className={`text-xs font-bold ${sb.cls}`}>
                              {sb.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {row.status !== "paid" &&
                                row.status !== "processed" &&
                                row.status !== "storno" &&
                                row.type !== "refacturat" && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (row.source === "manual") {
                                        markEmittedPaid.mutate({
                                          id: row.id,
                                          status: "paid",
                                        });
                                      } else if (
                                        row.source === "spv_anaf" ||
                                        row.source === "spv_import"
                                      ) {
                                        markArchivePaid.mutate({
                                          id: row.id,
                                          status: "processed",
                                        });
                                      }
                                    }}
                                    className="cursor-pointer text-emerald-600 focus:text-emerald-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    <span>
                                      {row.type === "primit" ||
                                      (row.type === "emis" &&
                                        row.source !== "manual")
                                        ? "Marchează Achitat"
                                        : "Marchează Încasat"}
                                    </span>
                                  </DropdownMenuItem>
                                )}

                              {(row.type === "primit" ||
                                (row.type === "emis" &&
                                  row.source === "spv_anaf")) && (
                                <Link href={`/re-facturare/${row.id}`}>
                                  <DropdownMenuItem className="cursor-pointer text-blue-600 focus:text-blue-700">
                                    <Send className="w-4 h-4 mr-2" />
                                    <span>Re-facturează</span>
                                  </DropdownMenuItem>
                                </Link>
                              )}

                              {row.type === "primit" && (
                                <Link href={`/nir/nou/${row.id}`}>
                                  <DropdownMenuItem className="cursor-pointer text-teal-600 focus:text-teal-700">
                                    <ClipboardList className="w-4 h-4 mr-2" />
                                    <span>Creează NIR</span>
                                  </DropdownMenuItem>
                                </Link>
                              )}

                              <DropdownMenuSeparator />

                              {row.type === "refacturat" ? (
                                <DropdownMenuItem
                                  onClick={() => handleDownloadReInvoicePDF(row)}
                                  disabled={downloadPDF.isPending}
                                  className="cursor-pointer"
                                >
                                  <FileDown className="w-4 h-4 mr-2" />
                                  <span>Descarcă PDF</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (
                                      row.type === "emis" &&
                                      row.source === "manual"
                                    ) {
                                      downloadFile(
                                        `/api/pdf/emitted/${row.id}?download=1`,
                                        `${row.number}.pdf`
                                      );
                                    } else if (
                                      row.fileUrl &&
                                      row.fileUrl !== "spv_import"
                                    ) {
                                      downloadFile(
                                        row.fileUrl,
                                        `${row.number}.pdf`
                                      );
                                    } else if (
                                      row.type === "primit" ||
                                      (row.type === "emis" &&
                                        row.source === "spv_anaf")
                                    ) {
                                      downloadFile(
                                        `/api/pdf/archive/${row.id}?download=1`,
                                        `${row.number}.pdf`
                                      );
                                    } else {
                                      toast.error("PDF-ul nu este disponibil.");
                                    }
                                  }}
                                  className="cursor-pointer"
                                >
                                  <FileDown className="w-4 h-4 mr-2" />
                                  <span>Descarcă PDF</span>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(row)}
                                className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                <span>Șterge</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Nicio factură.
            </div>
          ) : (
            paginated.map((row, i) => {
              const tb = TYPE_BADGE[row.type];
              return (
                <div
                  key={`${row.source}-${row.type}-${row.id}`}
                  className="px-3 py-2.5"
                >
                  {/* LINIA 1: Numar, Nume, Total, Meniu */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {(page - 1) * rowsPerPage + i + 1}.
                      </span>
                      <button
                        onClick={() =>
                          navigate(
                            row.type === "refacturat"
                              ? `/re-facturare/${row.id}`
                              : `/facturi-primite/${row.id}`
                          )
                        }
                        className="text-[11px] font-bold text-blue-600 hover:underline flex-shrink-0"
                      >
                        {row.number}
                      </button>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate font-medium">
                        {row.partnerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">
                        {formatCurrency(row.total, row.currency as Currency)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {row.status !== "paid" &&
                            row.status !== "processed" &&
                            row.status !== "storno" &&
                            row.type !== "refacturat" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (row.source === "manual") {
                                    markEmittedPaid.mutate({
                                      id: row.id,
                                      status: "paid",
                                    });
                                  } else if (
                                    row.source === "spv_anaf" ||
                                    row.source === "spv_import"
                                  ) {
                                    markArchivePaid.mutate({
                                      id: row.id,
                                      status: "processed",
                                    });
                                  }
                                }}
                                className="cursor-pointer text-emerald-600 focus:text-emerald-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                <span>
                                  {row.type === "primit" ||
                                  (row.type === "emis" &&
                                    row.source !== "manual")
                                    ? "Marchează Achitat"
                                    : "Marchează Încasat"}
                                </span>
                              </DropdownMenuItem>
                            )}

                          {(row.type === "primit" ||
                            (row.type === "emis" &&
                              row.source === "spv_anaf")) && (
                            <Link href={`/re-facturare/${row.id}`}>
                              <DropdownMenuItem className="cursor-pointer text-blue-600 focus:text-blue-700">
                                <Send className="w-4 h-4 mr-2" />
                                <span>Re-facturează</span>
                              </DropdownMenuItem>
                            </Link>
                          )}

                          {row.type === "primit" && (
                            <Link href={`/nir/nou/${row.id}`}>
                              <DropdownMenuItem className="cursor-pointer text-teal-600 focus:text-teal-700">
                                <ClipboardList className="w-4 h-4 mr-2" />
                                <span>Creează NIR</span>
                              </DropdownMenuItem>
                            </Link>
                          )}

                          <DropdownMenuSeparator />

                          {row.type === "refacturat" ? (
                            <DropdownMenuItem
                              onClick={() => handleDownloadReInvoicePDF(row)}
                              disabled={downloadPDF.isPending}
                              className="cursor-pointer"
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              <span>Descarcă PDF</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                if (
                                  row.type === "emis" &&
                                  row.source === "manual"
                                ) {
                                  downloadFile(
                                    `/api/pdf/emitted/${row.id}?download=1`,
                                    `${row.number}.pdf`
                                  );
                                } else if (
                                  row.fileUrl &&
                                  row.fileUrl !== "spv_import"
                                ) {
                                  downloadFile(
                                    row.fileUrl,
                                    `${row.number}.pdf`
                                  );
                                } else if (
                                  row.type === "primit" ||
                                  (row.type === "emis" &&
                                    row.source === "spv_anaf")
                                ) {
                                  downloadFile(
                                    `/api/pdf/archive/${row.id}?download=1`,
                                    `${row.number}.pdf`
                                  );
                                } else {
                                  toast.error("PDF-ul nu este disponibil.");
                                }
                              }}
                              className="cursor-pointer"
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              <span>Descarcă PDF</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(row)}
                            className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            <span>Șterge</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* LINIA 2: Badge tip, Date, Badge status */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                      <span
                        className={`px-1 py-0.5 rounded text-[8px] font-bold border ${tb.cls}`}
                      >
                        {tb.label}
                      </span>
                      <span>{formatDate(row.date)}</span>
                      {row.dueDate && (
                        <>
                          <span>·</span>
                          <span>Scad. {formatDate(row.dueDate)}</span>
                        </>
                      )}
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${STATUS_CLS[row.status] || STATUS_CLS.pending}`}
                    >
                      {STATUS_LBL[row.status] || row.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer paginare — obligatoriu */}
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-b-lg flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center whitespace-nowrap">
              Afișează
              <Select
                value={rowsPerPage.toString()}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-6 px-2 text-xs border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 w-[60px] rounded-lg focus:ring-1 focus:ring-blue-500 mx-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="9999">Toți</SelectItem>
                </SelectContent>
              </Select>
            </span>
            <span className="whitespace-nowrap ml-2">
              Total înregistrări: <strong>{filtered.length}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="whitespace-nowrap">
              Pg. {page}/{totalPages}
            </span>
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmă ștergerea</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să ștergi factura{" "}
              <strong>{deleteTarget?.number}</strong>? Această acțiune este
              definitivă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Șterge definitiv
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
