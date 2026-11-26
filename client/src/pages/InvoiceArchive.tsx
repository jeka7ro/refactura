import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  FolderOpen,
  Globe,
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

const STATUS_LABELS: Record<string, { label: string; pill: string }> = {
  pending: {
    label: "Neîncasate",
    pill: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/18 dark:text-amber-300 dark:border-amber-500/25",
  },
  processed: {
    label: "Încasate",
    pill: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/18 dark:text-emerald-300 dark:border-emerald-500/25",
  },
  refactured: {
    label: "Re-facturată",
    pill: "bg-teal-500/10 text-teal-700 border-teal-500/20 dark:bg-teal-500/18 dark:text-teal-300 dark:border-teal-500/25",
  },
  archived: {
    label: "Arhivată",
    pill: "bg-[#f2f2f7] text-[#3a3a3c] border-black/[0.08] dark:bg-[#2c2c2e] dark:text-[#ebebf5] dark:border-white/[0.10]",
  },
};

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
  const [limit, setLimit] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [metaForm, setMetaForm] = useState<any>({});
  const [singleDeleteItem, setSingleDeleteItem] = useState<any | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = trpc.invoiceArchive.list.useQuery({
    source: filterSource !== "all" ? filterSource : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    search: search || undefined,
    limit,
    offset: page * limit,
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

  const itemsRaw = data?.items ?? [];
  const {
    sortedData: items,
    handleSort,
    getSortIcon,
  } = useTableSort(itemsRaw, "invoice_archive");
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasActiveFilters =
    Boolean(search) || filterSource !== "all" || filterStatus !== "all";

  return (
    <div
      className="p-3 sm:p-5 max-w-full space-y-4"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Arhivă facturi
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Evidență și păstrare facturi din orice sursă ·{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {stats?.total ?? total}
            </strong>{" "}
            documente
            {hasActiveFilters && (
              <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                ({total} afișate)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => refetch()}
            className="apple-btn-glass flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Reîncarcă</span>
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-60 cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{uploading ? "Se încarcă..." : "Încarcă facturi"}</span>
          </button>
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

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            id: "all",
            label: "Total arhivă",
            value: stats?.total ?? 0,
            icon: Archive,
            badgeCls:
              "bg-[#f2f4f7] dark:bg-[#2c2c2e] text-[#0071e3] dark:text-[#0a84ff]",
          },
          {
            id: "pending",
            label: "Neîncasate",
            value: stats?.pending ?? 0,
            icon: Clock,
            badgeCls:
              "bg-[#fff6eb] dark:bg-amber-500/18 text-amber-600 dark:text-amber-400",
          },
          {
            id: "processed",
            label: "Încasate",
            value: stats?.processed ?? 0,
            icon: CheckCircle,
            badgeCls:
              "bg-[#eefbf3] dark:bg-emerald-500/18 text-emerald-600 dark:text-emerald-400",
          },
          {
            id: "refactured",
            label: "Re-facturate",
            value: stats?.refactured ?? 0,
            icon: RefreshCw,
            badgeCls:
              "bg-[#f2f4f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]",
          },
        ].map(s => (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              setFilterStatus(
                s.id === "all" ? "all" : filterStatus === s.id ? "all" : s.id
              );
              setPage(0);
            }}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFilterStatus(
                  s.id === "all" ? "all" : filterStatus === s.id ? "all" : s.id
                );
                setPage(0);
              }
            }}
            className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                {s.label}
              </span>
              <span
                className={`w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 ${s.badgeCls}`}
              >
                <s.icon className="w-3.5 h-3.5" />
              </span>
            </div>
            <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Unified Single-Row Filter & Search Toolbar */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full min-w-0">
          <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: "all", label: "Toate" },
              { id: "pending", label: "Neîncasate" },
              { id: "processed", label: "Încasate" },
              { id: "refactured", label: "Re-facturate" },
              { id: "archived", label: "Arhivate" },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                data-active={filterStatus === tab.id}
                onClick={() => {
                  setFilterStatus(
                    tab.id === "all"
                      ? "all"
                      : filterStatus === tab.id
                        ? "all"
                        : tab.id
                  );
                  setPage(0);
                }}
                className="apple-segmented-item px-2.5 shrink-0"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="xl:ml-auto flex flex-wrap sm:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full xl:w-auto xl:flex-1 justify-end min-w-0">
            <Select
              value={filterSource}
              onValueChange={v => {
                setFilterSource(v);
                setPage(0);
              }}
            >
              <SelectTrigger
                data-filtered={filterSource !== "all"}
                className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 2xl:px-3"
              >
                <Globe className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
                <SelectValue placeholder="Toate sursele" />
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

            <div className="relative flex-1 min-w-[140px] max-w-full sm:max-w-[280px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8e8e93] pointer-events-none" />
              <input
                placeholder="Caută furnizor, număr factură..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                style={{ paddingLeft: 34, paddingRight: search ? 34 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(0);
                  }}
                  aria-label="Șterge căutarea"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.12] cursor-pointer"
                >
                  <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilterSource("all");
                  setFilterStatus("all");
                  setPage(0);
                }}
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

      {/* Table Surface */}
      <div className="apple-surface overflow-hidden">
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#f2f2f7]/90 dark:bg-[#2c2c2e]/85 border-b border-black/[0.06] dark:border-white/[0.08]">
            <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
              {selectedIds.size} facturi selectate
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="apple-btn-glass px-3.5 h-7 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDeleteDialog(true)}
                className="apple-btn-destructive-soft px-3.5 h-7 rounded-full text-[12px] font-semibold cursor-pointer"
              >
                Șterge selectate
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-14 text-[#6e6e73] dark:text-[#98989d] text-[13px]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Se încarcă...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-[#6e6e73] dark:text-[#98989d]">
              <FolderOpen className="w-9 h-9 mb-2.5 opacity-40" />
              <p className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Nicio factură în arhivă
              </p>
              <p className="text-[12.5px] mt-0.5">
                Încarcă primul fișier PDF sau XML
              </p>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                <tr>
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
                      className="w-4 h-4 rounded border-black/20 dark:border-white/25 text-primary cursor-pointer"
                    />
                  </th>
                  <th className="text-center px-3 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-14 whitespace-nowrap">
                    Nr.
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white select-none transition-colors"
                    onClick={() => handleSort("supplierName")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Furnizor</span>
                      <span className="text-[#1d1d1f] dark:text-white opacity-60">
                        {getSortIcon("supplierName")}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                    onClick={() => handleSort("invoiceNumber")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Nr. factură</span>
                      <span className="text-[#1d1d1f] dark:text-white opacity-60">
                        {getSortIcon("invoiceNumber")}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                    onClick={() => handleSort("issueDate")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Dată</span>
                      <span className="text-[#1d1d1f] dark:text-white opacity-60">
                        {getSortIcon("issueDate")}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                    onClick={() => handleSort("total")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total</span>
                      <span className="text-[#1d1d1f] dark:text-white opacity-60">
                        {getSortIcon("total")}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                    onClick={() => handleSort("source")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Sursă</span>
                      <span className="text-[#1d1d1f] dark:text-white opacity-60">
                        {getSortIcon("source")}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <span className="text-[#1d1d1f] dark:text-white opacity-60">
                        {getSortIcon("status")}
                      </span>
                    </div>
                  </th>
                  <th className="text-right px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                    Acțiuni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                {items.map((item: any, index: number) => {
                  const st =
                    STATUS_LABELS[item.status] ?? STATUS_LABELS.pending;
                  const isUnread = !item.isRead;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors group ${
                        selectedIds.has(item.id)
                          ? "bg-[#0071e3]/[0.05] dark:bg-[#0a84ff]/[0.12]"
                          : isUnread
                            ? "bg-[#0071e3]/[0.025] dark:bg-[#0a84ff]/[0.06]"
                            : ""
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
                          className="w-4 h-4 rounded border-black/20 dark:border-white/25 text-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3 text-center text-[12px] font-medium tabular-nums text-[#8e8e93]">
                        {page * limit + index + 1}
                      </td>
                      <td className="px-4 py-3">
                        {item.supplierName ? (
                          <div
                            className={`text-[13.5px] max-w-[210px] truncate ${
                              isUnread
                                ? "font-bold text-[#1d1d1f] dark:text-white"
                                : "font-medium text-[#1d1d1f] dark:text-[#f5f5f7]"
                            }`}
                            title={item.supplierName}
                          >
                            {item.supplierName}
                          </div>
                        ) : (
                          <span className="text-[#8e8e93]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.invoiceNumber ? (
                          <div className="flex items-center gap-2">
                            {isUnread && (
                              <span
                                className="w-2 h-2 rounded-full bg-[#0071e3] dark:bg-[#0a84ff] shrink-0"
                                title="Factură nouă (necitită)"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (isUnread) markAsRead.mutate({ id: item.id });
                                setLocation(`/facturi-primite/${item.id}`);
                              }}
                              className={`text-[13.5px] tabular-nums hover:underline cursor-pointer text-left ${
                                isUnread
                                  ? "font-bold text-[#1d1d1f] dark:text-white"
                                  : "font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                              }`}
                            >
                              {item.invoiceNumber}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#8e8e93]">—</span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 tabular-nums whitespace-nowrap text-[13px] ${
                          isUnread
                            ? "font-semibold text-[#1d1d1f] dark:text-white"
                            : "font-medium text-[#1d1d1f] dark:text-[#ebebf5]"
                        }`}
                      >
                        {formatDate(item.issueDate)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums whitespace-nowrap text-[13.5px] ${
                          isUnread
                            ? "font-bold text-[#1d1d1f] dark:text-white"
                            : "font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                        }`}
                      >
                        {formatAmount(item.total, item.currency)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5]">
                          {SOURCE_LABELS[item.source] ?? item.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border leading-none ${st.pill}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {(item.fileUrl || item.source === "spv_anaf") && (
                            <a
                              href={
                                item.source === "spv_anaf" ||
                                item.fileUrl === "spv_import"
                                  ? `/api/pdf/archive/${item.id}`
                                  : item.fileUrl
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
                              title="Descarcă"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setSingleDeleteItem(item)}
                            className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#ff3b30] dark:hover:text-[#ff453a] transition-colors cursor-pointer"
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

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-[#fafafa] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between flex-wrap gap-2 tabular-nums">
          <div className="flex items-center gap-3 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span>Afișează</span>
              <Select
                value={String(limit)}
                onValueChange={val => {
                  setLimit(Number(val));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-7 px-2.5 text-xs border-black/[0.08] bg-white dark:bg-[#2c2c2e] dark:border-white/[0.10] w-[68px] rounded-full tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span>
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {total === 0 ? 0 : page * limit + 1}–
                {Math.min((page + 1) * limit, total)}
              </strong>{" "}
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {total}
              </strong>{" "}
              înregistrări
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            <span className="mr-1.5">
              Pagina{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {page + 1}
              </strong>{" "}
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {totalPages}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Pagina anterioară"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Pagina următoare"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Single Delete Confirmation */}
      <AlertDialog
        open={!!singleDeleteItem}
        onOpenChange={open => !open && setSingleDeleteItem(null)}
      >
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              Ștergi această factură din arhivă?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
              Înregistrarea{" "}
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
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
              className="rounded-full bg-[#ff3b30] hover:bg-[#d70015] text-white"
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
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              Ștergi {selectedIds.size} facturi selectate?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
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
              className="rounded-full bg-[#ff3b30] hover:bg-[#d70015] text-white"
            >
              {bulkDeleting ? "Se șterg..." : "Șterge selectate"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Meta Edit Modal */}
      {showMetaModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/65 backdrop-blur-sm overscroll-contain">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[20px] shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto overscroll-contain border border-black/[0.08] dark:border-white/[0.10]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <h2 className="text-[16px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Editează metadate
              </h2>
              <button
                type="button"
                onClick={() => setShowMetaModal(false)}
                aria-label="Închide fereastra"
                className="w-7 h-7 rounded-full apple-btn-glass text-[#3a3a3c] dark:text-[#ebebf5] flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                  Furnizor
                </label>
                <input
                  value={metaForm.supplierName}
                  onChange={e =>
                    setMetaForm({ ...metaForm, supplierName: e.target.value })
                  }
                  placeholder="Denumire furnizor"
                  className="apple-input w-full h-9 px-3 text-[13.5px] outline-none"
                  autoComplete="organization"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                  CUI furnizor
                </label>
                <input
                  value={metaForm.supplierCUI}
                  onChange={e =>
                    setMetaForm({ ...metaForm, supplierCUI: e.target.value })
                  }
                  placeholder="RO12345678"
                  className="apple-input w-full h-9 px-3 text-[13.5px] tabular-nums outline-none"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                  Nr. factură
                </label>
                <input
                  value={metaForm.invoiceNumber}
                  onChange={e =>
                    setMetaForm({ ...metaForm, invoiceNumber: e.target.value })
                  }
                  placeholder="FAC-2024-001"
                  className="apple-input w-full h-9 px-3 text-[13.5px] tabular-nums outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Dată emitere
                  </label>
                  <input
                    type="date"
                    value={metaForm.issueDate}
                    onChange={e =>
                      setMetaForm({ ...metaForm, issueDate: e.target.value })
                    }
                    className="apple-input w-full h-9 px-3 text-[13px] tabular-nums outline-none"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Dată scadență
                  </label>
                  <input
                    type="date"
                    value={metaForm.dueDate}
                    onChange={e =>
                      setMetaForm({ ...metaForm, dueDate: e.target.value })
                    }
                    className="apple-input w-full h-9 px-3 text-[13px] tabular-nums outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Total (cu TVA)
                  </label>
                  <input
                    value={metaForm.total}
                    onChange={e =>
                      setMetaForm({ ...metaForm, total: e.target.value })
                    }
                    placeholder="1250.00"
                    className="apple-input w-full h-9 px-3 text-[13.5px] tabular-nums outline-none"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    TVA
                  </label>
                  <input
                    value={metaForm.totalVAT}
                    onChange={e =>
                      setMetaForm({ ...metaForm, totalVAT: e.target.value })
                    }
                    placeholder="237.50"
                    className="apple-input w-full h-9 px-3 text-[13.5px] tabular-nums outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Valută
                  </label>
                  <Select
                    value={metaForm.currency}
                    onValueChange={v =>
                      setMetaForm({ ...metaForm, currency: v })
                    }
                  >
                    <SelectTrigger className="apple-input h-9 text-[13px] w-full">
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
                  <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                    Status
                  </label>
                  <Select
                    value={metaForm.status}
                    onValueChange={v => setMetaForm({ ...metaForm, status: v })}
                  >
                    <SelectTrigger className="apple-input h-9 text-[13px] w-full">
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
                <label className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1 block">
                  Note
                </label>
                <textarea
                  value={metaForm.notes}
                  onChange={e =>
                    setMetaForm({ ...metaForm, notes: e.target.value })
                  }
                  placeholder="Note interne..."
                  rows={2}
                  className="apple-input w-full px-3 py-2 text-[13px] outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowMetaModal(false)}
                className="flex-1 apple-btn-glass h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() =>
                  updateMutation.mutate({ id: selectedEntry.id, ...metaForm })
                }
                disabled={updateMutation.isPending}
                className="flex-1 apple-btn-prominent flex items-center justify-center h-9 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-60 cursor-pointer"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Salvează"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
