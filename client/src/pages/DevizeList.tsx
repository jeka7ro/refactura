// DevizeList.tsx — Lista Devizelor de lucrări
import { useState } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { useLocation, Link } from "wouter";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  FileText,
  FileDown,
  Pencil,
  CheckCircle2,
  Coins,
  Calculator,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EditDevizModal } from "@/components/EditDevizModal";
import { useTableSort } from "@/hooks/useTableSort";
import { toast } from "sonner";
import { formatDate } from "@/lib/store";
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

export default function DevizeList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "final" | "draft">("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("devize_list", 15);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [editDevizId, setEditDevizId] = useState<number | null>(null);

  const { data: list = [], isLoading, refetch } = trpc.devize.list.useQuery();

  const deleteMutation = trpc.devize.delete.useMutation({
    onSuccess: () => {
      toast.success("Deviz șters!");
      refetch();
      setDeleteTarget(null);
    },
    onError: e => toast.error("Eroare: " + e.message),
  });

  const finalCount = list.filter((n: any) => n.status === "final").length;
  const draftCount = list.filter((n: any) => (n.status || "draft") === "draft").length;

  const filtered = list.filter((n: any) => {
    if (statusFilter === "final" && n.status !== "final") return false;
    if (statusFilter === "draft" && (n.status || "draft") !== "draft") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.number?.toLowerCase().includes(q) ||
      n.invoiceNumber?.toLowerCase().includes(q) ||
      n.clientName?.toLowerCase().includes(q) ||
      n.clientCUI?.toLowerCase().includes(q) ||
      (n.invoiceId && n.invoiceId.toString().includes(q))
    );
  });

  const { sortedData, handleSort, getSortIcon } = useTableSort(
    filtered,
    "devize_list"
  );

  const effectivePerPage = rowsPerPage === 9999 ? Math.max(1, sortedData.length) : rowsPerPage;
  const totalPages = Math.max(1, Math.ceil(sortedData.length / effectivePerPage));
  const safePage = Math.min(page, totalPages);
  const paginated =
    rowsPerPage === 9999
      ? sortedData
      : sortedData.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const STATUS_CLS: Record<string, string> = {
    draft:
      "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/18 dark:text-amber-300 dark:border-amber-500/25",
    final:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/18 dark:text-emerald-300 dark:border-emerald-500/25",
  };

  const STATUS_LABEL: Record<string, string> = {
    draft: "Ciornă",
    final: "Finalizat",
  };

  const totalNetAll = list.reduce(
    (s: number, r: any) => s + (Number(r.subtotal || r.total) || 0),
    0
  );
  const totalGrossAll = list.reduce(
    (s: number, r: any) => s + (Number(r.totalWithVAT || r.total) || 0),
    0
  );

  const hasActiveFilters = Boolean(search) || statusFilter !== "all";

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Devize de lucrări
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Evidență devize (materiale și manoperă) asociate facturilor ·{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {list.length}
            </strong>{" "}
            documente
            {filtered.length !== list.length && (
              <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                ({filtered.length} afișate)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
          onKeyDown={e => {
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
              Total devize
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none">
              {list.length}
            </span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "final" ? "all" : "final");
            setPage(1);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setStatusFilter(statusFilter === "final" ? "all" : "final");
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
            <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none">
              {finalCount}
            </span>
            {list.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 leading-none">
                {Math.round((finalCount / list.length) * 100)}%
              </span>
            )}
          </div>
        </div>

        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Valoare fără TVA
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
              <Calculator className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </span>
          </div>
          <div className="tabular-nums min-w-0">
            <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none truncate block">
              {totalNetAll.toLocaleString("ro-RO", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              RON
            </span>
          </div>
        </div>

        <div className="apple-surface px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Valoare totală (cu TVA)
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div className="tabular-nums min-w-0">
            <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none truncate block">
              {totalGrossAll.toLocaleString("ro-RO", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              RON
            </span>
          </div>
        </div>
      </div>

      {/* Unified Single-Row Filter & Search Toolbar */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full min-w-0">
          <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              data-active={statusFilter === "all"}
              onClick={() => {
                setStatusFilter("all");
                setPage(1);
              }}
              className="apple-segmented-item px-2.5 tabular-nums shrink-0"
            >
              <span>Toate</span>
              <span className="opacity-75">{list.length}</span>
            </button>
            <button
              type="button"
              data-active={statusFilter === "final"}
              onClick={() => {
                setStatusFilter(statusFilter === "final" ? "all" : "final");
                setPage(1);
              }}
              className="apple-segmented-item px-2.5 tabular-nums shrink-0"
            >
              <span>Finalizate</span>
              <span className="opacity-75">{finalCount}</span>
            </button>
            <button
              type="button"
              data-active={statusFilter === "draft"}
              onClick={() => {
                setStatusFilter(statusFilter === "draft" ? "all" : "draft");
                setPage(1);
              }}
              className="apple-segmented-item px-2.5 tabular-nums shrink-0"
            >
              <span>Ciorne</span>
              <span className="opacity-75">{draftCount}</span>
            </button>
          </div>

          <div className="sm:ml-auto flex items-center gap-1.5 w-full sm:w-auto sm:flex-1 justify-end min-w-0">
            <div className="relative flex-1 min-w-[140px] max-w-full sm:max-w-[320px]">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Caută nr. deviz, client, CUI, factură..."
                style={{ paddingLeft: 34, paddingRight: search ? 74 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
              />
              {search && (
                <>
                  <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {filtered.length}/{list.length}
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
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPage(1);
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
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="px-2.5 py-3 w-10 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Nr.
                </th>
                <th
                  className="px-3 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("number")}
                >
                  <div className="flex items-center gap-1">
                    <span>Nr. deviz</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("number")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    <span>Dată</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("date")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("clientName")}
                >
                  <div className="flex items-center gap-1">
                    <span>Client / Beneficiar</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("clientName")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("invoiceNumber")}
                >
                  <div className="flex items-center gap-1">
                    <span>Factură</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("invoiceNumber")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("total")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Fără TVA</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("total")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("totalVAT")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>TVA (21%)</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("totalVAT")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("totalWithVAT")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total cu TVA</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("totalWithVAT")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("status")}
                    </span>
                  </div>
                </th>
                <th className="px-3 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73] mx-auto" />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-12 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]"
                  >
                    Niciun deviz găsit. Devizele sunt generate automat la facturare.
                  </td>
                </tr>
              ) : (
                paginated.map((row: any, i: number) => {
                  const netVal = Number(row.subtotal || row.total) || 0;
                  const vatVal = Number(row.totalVAT) || 0;
                  const grossVal = Number(row.totalWithVAT || row.total) || 0;
                  const curr = row.currency || "RON";
                  const stKey = row.status || "draft";

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                    >
                      <td className="px-2.5 py-3 text-center text-[12px] font-medium text-[#8e8e93] tabular-nums whitespace-nowrap">
                        {(safePage - 1) * effectivePerPage + i + 1}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/devize/${row.id}`)}
                          className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums cursor-pointer"
                        >
                          {row.number}
                        </button>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#ebebf5] whitespace-nowrap">
                        {formatDate(String(row.date))}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[185px] truncate" title={row.clientName || undefined}>
                          {row.clientName || "—"}
                        </div>
                        {row.clientCUI && row.clientCUI !== "—" && (
                          <div className="text-[11px] tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                            CUI {row.clientCUI}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {row.invoiceId ? (
                          <Link
                            href={`/facturi-emise-nou/view/${row.invoiceId}`}
                            className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums cursor-pointer"
                            title="Deschide factura"
                          >
                            {row.invoiceNumber}
                          </Link>
                        ) : (
                          <span className="text-[#8e8e93]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[12.5px] text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                        {netVal.toLocaleString("ro-RO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[12.5px] text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                        {vatVal.toLocaleString("ro-RO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-nowrap">
                        {grossVal.toLocaleString("ro-RO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {curr}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border leading-none ${
                            STATUS_CLS[stKey] ||
                            "bg-[#f2f2f7] text-[#3a3a3c] border-black/[0.08] dark:bg-[#2c2c2e] dark:text-[#ebebf5] dark:border-white/[0.10]"
                          }`}
                        >
                          {STATUS_LABEL[stKey] || stKey}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setEditDevizId(row.id)}
                            title="Editează deviz"
                            aria-label="Editează deviz"
                            className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/devize/${row.id}`)}
                            title="Vizualizează"
                            aria-label="Vizualizează"
                            className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`/api/pdf/deviz/${row.id}?download=1`}
                            target="_blank"
                            rel="noreferrer"
                            title="Descarcă PDF"
                            aria-label="Descarcă PDF"
                            className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row.id)}
                            title="Șterge"
                            aria-label="Șterge"
                            className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#ff3b30] dark:hover:text-[#ff453a] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#fafafa] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.07] tabular-nums flex-wrap gap-2">
          <div className="flex items-center gap-3 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span>Rânduri:</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 px-2.5 text-xs border-black/[0.08] bg-white dark:bg-[#2c2c2e] dark:border-white/[0.10] w-[68px] rounded-full tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="9999">Toate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="hidden sm:inline tabular-nums">
              Afișare{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {filtered.length === 0 ? 0 : (safePage - 1) * effectivePerPage + 1}
              </strong>
              –
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {Math.min(safePage * effectivePerPage, filtered.length)}
              </strong>{" "}
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {filtered.length}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            <span className="mr-1.5">
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
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Pagina anterioară"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Pagina următoare"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1d1d1f] dark:text-[#f5f5f7]">
              Confirmați ștergerea
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e6e73] dark:text-[#98989d]">
              Această acțiune este ireversibilă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Renunță</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate({ id: deleteTarget })
              }
              className="rounded-full bg-[#ff3b30] hover:bg-[#d70015] text-white"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Șterge"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editDevizId && (
        <EditDevizModal
          isOpen={!!editDevizId}
          onClose={() => setEditDevizId(null)}
          devizId={editDevizId}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
