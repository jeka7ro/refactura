import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
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
import {
  Upload,
  Search,
  FileText,
  Eye,
  Trash2,
  RefreshCw,
  Download,
  Archive,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  FileUp,
  FolderOpen,
  Tag,
  ArrowUpDown,
} from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { useLocation } from "wouter";

const SOURCE_LABELS: Record<string, string> = {
  smartbill: "SmartBill",
  oblio: "Oblio",
  fgo: "FGO",
  spv_anaf: "SPV ANAF",
  efactura: "e-Factura",
  pdf_manual: "PDF Manual",
  xml_manual: "XML Manual",
  other: "Altă sursă",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Neîncasate", color: "text-amber-600 dark:text-amber-500" },
  processed: { label: "Încasate", color: "text-blue-600 dark:text-blue-400" },
  refactured: {
    label: "Re-facturată",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  archived: { label: "Arhivată", color: "text-slate-500 dark:text-slate-400" },
};

function formatBytes(bytes: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(str: string | null | undefined) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("ro-RO");
}

function formatAmount(val: string | null | undefined, currency = "RON") {
  if (!val) return "-";
  const n = parseFloat(val);
  if (isNaN(n)) return "-";
  return (
    n.toLocaleString("ro-RO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    " " +
    currency
  );
}

export default function InvoiceArchive() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [metaForm, setMetaForm] = useState<any>({});
  const [singleDeleteItem, setSingleDeleteItem] = useState<any | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const LIMIT = 20;

  const { data, isLoading, refetch } = trpc.invoiceArchive.list.useQuery({
    source: filterSource !== "all" ? filterSource : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    search: search || undefined,
    limit: LIMIT,
    offset: page * LIMIT,
  });

  const { data: stats } = trpc.invoiceArchive.stats.useQuery();

  const deleteMutation = trpc.invoiceArchive.delete.useMutation();

  const handleConfirmSingleDelete = async () => {
    if (!singleDeleteItem) return;
    try {
      await deleteMutation.mutateAsync({ id: singleDeleteItem.id });
      toast.success("Factură ștearsă");
      setSingleDeleteItem(null);
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Eroare la ștergerea facturii");
    }
  };

  const handleConfirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let ok = 0;
    let failed = 0;
    let lastError = "";
    const failedIds = new Set<number>();
    for (const id of ids) {
      try {
        await deleteMutation.mutateAsync({ id });
        ok++;
      } catch (e: any) {
        failed++;
        failedIds.add(id);
        lastError = e?.message || "Eroare la ștergere";
      }
    }
    setBulkDeleting(false);
    setShowBulkDeleteDialog(false);
    setSelectedIds(failedIds);
    refetch();
    if (ok === 0) {
      toast.error(lastError || `Nu s-a putut șterge nicio factură (${failed} eșuate).`);
    } else if (failed > 0) {
      toast.warning(`${ok} facturi șterse, ${failed} nu au putut fi șterse.`);
    } else {
      toast.success(`${ok} facturi șterse`);
    }
  };

  const updateMutation = trpc.invoiceArchive.update.useMutation({
    onSuccess: () => {
      toast.success("Factură actualizată");
      refetch();
      setShowMetaModal(false);
    },
    onError: e => toast.error(e.message),
  });

  const createMutation = trpc.invoiceArchive.create.useMutation({
    onSuccess: () => {
      toast.success("Factură adăugată în arhivă");
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const markAsRead = trpc.invoiceArchive.markAsRead.useMutation({
    onSuccess: () => refetch(),
  });

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (!fileArray.length) return;
      setUploading(true);
      try {
        for (const file of fileArray) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/upload-invoice", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          if (!res.ok) {
            const err = await res.text();
            throw new Error(err || "Upload eșuat");
          }
          const { fileKey, fileUrl } = await res.json();
          const ext = file.name.split(".").pop()?.toLowerCase();
          const fileType =
            ext === "pdf" ? "pdf" : ext === "xml" ? "xml" : "other";
          await createMutation.mutateAsync({
            fileKey,
            fileUrl,
            fileName: file.name,
            fileType: fileType as any,
            fileSize: file.size,
            source: "pdf_manual",
          });
        }
        toast.success(`${fileArray.length} fișier(e) încărcat(e)`);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setUploading(false);
      }
    },
    [createMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const openMetaModal = (entry: any) => {
    setSelectedEntry(entry);
    setMetaForm({
      invoiceNumber: entry.invoiceNumber || "",
      supplierName: entry.supplierName || "",
      supplierCUI: entry.supplierCUI || "",
      issueDate: entry.issueDate || "",
      dueDate: entry.dueDate || "",
      total: entry.total || "",
      totalVAT: entry.totalVAT || "",
      currency: entry.currency || "RON",
      status: entry.status || "pending",
      notes: entry.notes || "",
    });
    setShowMetaModal(true);
  };

  const itemsRaw = data?.items ?? [];
  const {
    sortedData: items,
    handleSort,
    getSortIcon,
  } = useTableSort(itemsRaw, "invoice_archive");
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Arhivă Facturi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Evidență și păstrare facturi din orice sursă
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 rounded-full border-slate-200 dark:border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reîncarcă
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" /> Încarcă Facturi
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xml"
            className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          {
            label: "Total",
            value: stats?.total ?? 0,
            icon: Archive,
            color:
              "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300",
          },
          {
            label: "Neîncasate",
            value: stats?.pending ?? 0,
            icon: Clock,
            color:
              "text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400",
          },
          {
            label: "Încasate",
            value: stats?.processed ?? 0,
            icon: CheckCircle,
            color:
              "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400",
          },
          {
            label: "Re-facturate",
            value: stats?.refactured ?? 0,
            icon: RefreshCw,
            color:
              "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400",
          },
        ].map(s => (
          <div
            key={s.label}
            className="bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.09] rounded-2xl px-3.5 py-2.5 shadow-2xs flex items-center gap-3 transition-all hover:shadow-sm"
          >
            <div
              className={`w-8 h-8 flex items-center justify-center rounded-xl shrink-0 ${s.color}`}
            >
              <s.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-[#636366] dark:text-[#98989d] truncate">
                {s.label}
              </div>
              <div className="text-lg font-bold tabular-nums text-[#1d1d1f] dark:text-white leading-tight">
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Table in a single card */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] shadow-sm overflow-hidden mt-6">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Caută furnizor, număr factură..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="!pl-9 h-9 rounded-full text-sm border-slate-200 dark:border-slate-700 bg-transparent"
            />
          </div>
          <Select
            value={filterSource}
            onValueChange={v => {
              setFilterSource(v);
              setPage(0);
            }}
          >
            <SelectTrigger
              data-filtered={filterSource !== "all"}
              className="apple-pill-control w-auto h-9 px-3.5 rounded-full text-sm shrink-0"
            >
              <SelectValue placeholder="Sursă" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate sursele</SelectItem>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterStatus}
            onValueChange={v => {
              setFilterStatus(v);
              setPage(0);
            }}
          >
            <SelectTrigger
              data-filtered={filterStatus !== "all"}
              className="apple-pill-control w-auto h-9 px-3.5 rounded-full text-sm shrink-0"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate statusurile</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || filterSource !== "all" || filterStatus !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFilterSource("all");
                setFilterStatus("all");
                setPage(0);
              }}
              className="h-9 rounded-full gap-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" /> Resetează
            </Button>
          )}
        </div>

        {/* Table Content */}
        <div>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-blue-600 text-white shadow-md">
              <span className="text-sm font-semibold tabular-nums">
                {selectedIds.size} facturi selectate
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3.5 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
                >
                  Anulează
                </button>
                <button
                  onClick={() => setShowBulkDeleteDialog(true)}
                  className="px-3.5 h-7 rounded-full bg-red-600 text-white hover:bg-red-700 text-xs font-bold transition-colors shadow-sm"
                >
                  Șterge selectate
                </button>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Se încarcă...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nicio factură în arhivă</p>
              <p className="text-xs mt-1">Încarcă primul fișier PDF sau XML</p>
            </div>
          ) : (
            <table className="w-full text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        items.length > 0 && selectedIds.size === items.length
                      }
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(items.map((i: any) => i.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16">
                    Nr. Crt.
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                    onClick={() => handleSort("supplierName")}
                  >
                    <div className="flex items-center gap-1">
                      Furnizor{" "}
                      <span className="text-blue-500">
                        {getSortIcon("supplierName")}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                    onClick={() => handleSort("invoiceNumber")}
                  >
                    <div className="flex items-center gap-1">
                      Nr. Factură{" "}
                      <span className="text-blue-500">
                        {getSortIcon("invoiceNumber")}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                    onClick={() => handleSort("issueDate")}
                  >
                    <div className="flex items-center gap-1">
                      Dată{" "}
                      <span className="text-blue-500">
                        {getSortIcon("issueDate")}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-700"
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
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                    onClick={() => handleSort("source")}
                  >
                    <div className="flex items-center gap-1">
                      Sursă{" "}
                      <span className="text-blue-500">
                        {getSortIcon("source")}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-700"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status{" "}
                      <span className="text-blue-500">
                        {getSortIcon("status")}
                      </span>
                    </div>
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item: any, index: number) => {
                  const st =
                    STATUS_LABELS[item.status] ?? STATUS_LABELS.pending;
                  const isUnread = !item.isRead;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group ${
                        isUnread ? "bg-blue-50/20 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={e => {
                            const newIds = new Set(selectedIds);
                            if (e.target.checked) newIds.add(item.id);
                            else newIds.delete(item.id);
                            setSelectedIds(newIds);
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-4 py-3 text-[11px] font-medium tabular-nums text-slate-500">
                        {page * LIMIT + index + 1}
                      </td>
                      <td className="px-4 py-3">
                        {item.supplierName ? (
                          <div
                            className={`text-xs max-w-[180px] truncate ${
                              isUnread
                                ? "font-bold text-slate-900 dark:text-white"
                                : "font-normal text-slate-600 dark:text-slate-400"
                            }`}
                            title={item.supplierName}
                          >
                            {item.supplierName}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.invoiceNumber ? (
                          <div className="flex items-center gap-1.5">
                            {isUnread && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0 inline-block shadow-sm"
                                title="Factură nouă (necitită)"
                              />
                            )}
                            <span
                              onClick={() => {
                                if (isUnread) markAsRead.mutate({ id: item.id });
                                setLocation(`/facturi-primite/${item.id}`);
                              }}
                              className={`text-sm tabular-nums hover:underline cursor-pointer ${
                                isUnread
                                  ? "font-bold text-blue-700 dark:text-blue-400"
                                  : "font-normal text-blue-600 dark:text-blue-500"
                              }`}
                            >
                              {item.invoiceNumber}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 tabular-nums ${isUnread ? "font-bold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400 font-normal"}`}>
                        {formatDate(item.issueDate)}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${isUnread ? "font-bold text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300 font-normal"}`}>
                        {formatAmount(item.total, item.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {item.source === "spv_anaf" ? (
                            <div className="flex flex-col leading-tight">
                              <span>SPV</span>
                              <span>ANAF</span>
                            </div>
                          ) : (
                            (SOURCE_LABELS[item.source] ?? item.source)
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center text-xs font-bold ${st.color}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {(item.fileUrl || item.source === "spv_anaf") && (
                            <a
                              href={item.source === "spv_anaf" || item.fileUrl === "spv_import" ? `/api/pdf/archive/${item.id}` : item.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-slate-500 dark:text-slate-400"
                              title="Descarcă"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => setSingleDeleteItem(item)}
                            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-200 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400 transition-colors text-slate-500 dark:text-slate-400"
                            title="Șterge"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs tabular-nums text-slate-500">
            {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} din {total}{" "}
            înregistrări
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-8 w-8 p-0 rounded-full"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300 px-2">
              Pagina {page + 1} din {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-8 w-8 p-0 rounded-full"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation */}
      <AlertDialog
        open={!!singleDeleteItem}
        onOpenChange={open => !open && setSingleDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi această factură din arhivă?</AlertDialogTitle>
            <AlertDialogDescription>
              Înregistrarea{" "}
              <strong>
                {singleDeleteItem?.invoiceNumber ||
                  singleDeleteItem?.fileName ||
                  `#${singleDeleteItem?.id}`}
              </strong>{" "}
              va fi eliminată definitiv din arhivă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Anulează</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleConfirmSingleDelete}
              className="rounded-full bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "Se șterge..." : "Șterge"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={showBulkDeleteDialog}
        onOpenChange={open => !bulkDeleting && setShowBulkDeleteDialog(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ștergi {selectedIds.size} facturi selectate?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cele {selectedIds.size} înregistrări selectate vor fi șterse definitiv din arhivă. Această acțiune nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting} className="rounded-full">
              Anulează
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkDeleting}
              onClick={handleConfirmBulkDelete}
              className="rounded-full bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkDeleting ? "Se șterg..." : "Șterge selectate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Meta Edit Modal */}
      {showMetaModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto border border-black/[0.08] dark:border-white/[0.12]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                Editează Metadate
              </h2>
              <button
                onClick={() => setShowMetaModal(false)}
                className="w-7 h-7 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">
                  Furnizor
                </label>
                <Input
                  value={metaForm.supplierName}
                  onChange={e =>
                    setMetaForm({ ...metaForm, supplierName: e.target.value })
                  }
                  placeholder="Denumire furnizor"
                  className="h-9 text-sm"
                  autoComplete="organization"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">
                  CUI Furnizor
                </label>
                <Input
                  value={metaForm.supplierCUI}
                  onChange={e =>
                    setMetaForm({ ...metaForm, supplierCUI: e.target.value })
                  }
                  placeholder="RO12345678"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">
                  Nr. Factură
                </label>
                <Input
                  value={metaForm.invoiceNumber}
                  onChange={e =>
                    setMetaForm({ ...metaForm, invoiceNumber: e.target.value })
                  }
                  placeholder="FAC-2024-001"
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">
                    Dată emitere
                  </label>
                  <Input
                    type="date"
                    value={metaForm.issueDate}
                    onChange={e =>
                      setMetaForm({ ...metaForm, issueDate: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">
                    Dată scadență
                  </label>
                  <Input
                    type="date"
                    value={metaForm.dueDate}
                    onChange={e =>
                      setMetaForm({ ...metaForm, dueDate: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">
                    Total (fără TVA)
                  </label>
                  <Input
                    value={metaForm.total}
                    onChange={e =>
                      setMetaForm({ ...metaForm, total: e.target.value })
                    }
                    placeholder="1250.00"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">
                    TVA
                  </label>
                  <Input
                    value={metaForm.totalVAT}
                    onChange={e =>
                      setMetaForm({ ...metaForm, totalVAT: e.target.value })
                    }
                    placeholder="237.50"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">
                    Valută
                  </label>
                  <Select
                    value={metaForm.currency}
                    onValueChange={v =>
                      setMetaForm({ ...metaForm, currency: v })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RON">RON</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">
                    Status
                  </label>
                  <Select
                    value={metaForm.status}
                    onValueChange={v => setMetaForm({ ...metaForm, status: v })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block">
                  Note
                </label>
                <textarea
                  value={metaForm.notes}
                  onChange={e =>
                    setMetaForm({ ...metaForm, notes: e.target.value })
                  }
                  placeholder="Note interne..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <Button
                variant="outline"
                onClick={() => setShowMetaModal(false)}
                className="flex-1 rounded-full"
              >
                Anulează
              </Button>
              <Button
                onClick={() =>
                  updateMutation.mutate({ id: selectedEntry.id, ...metaForm })
                }
                disabled={updateMutation.isPending}
                className="flex-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Salvează"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
