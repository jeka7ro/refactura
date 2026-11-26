// BonuriConsumList.tsx — Lista Bonurilor de consum
import { useState, useMemo } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { useLocation } from "wouter";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileDown,
  PackageOpen,
  Plus,
  CheckCircle2,
  Edit,
  X,
} from "lucide-react";
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

export default function BonuriConsumList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "finalizat" | "draft">("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("bonuri_consum_list", 15);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const {
    data: list = [],
    isLoading,
    refetch,
  } = trpc.bonuriConsum.list.useQuery();

  const deleteMutation = trpc.bonuriConsum.delete.useMutation({
    onSuccess: () => {
      toast.success("Bon de consum șters!");
      refetch();
      setDeleteTarget(null);
    },
    onError: e => toast.error("Eroare: " + e.message),
  });

  const counts = useMemo(() => {
    let finalizat = 0;
    let draft = 0;
    list.forEach((n: any) => {
      if (n.status === "draft") draft++;
      else finalizat++;
    });
    return { finalizat, draft };
  }, [list]);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all";

  const filtered = list.filter((n: any) => {
    if (statusFilter === "draft" && n.status !== "draft") return false;
    if (statusFilter === "finalizat" && n.status === "draft") return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      n.number?.toLowerCase().includes(q) ||
      n.gestiune?.toLowerCase().includes(q) ||
      (n.devizId && n.devizId.toString().includes(q))
    );
  });

  const { sortedData, handleSort, getSortIcon } = useTableSort(
    filtered,
    "bonuri_consum_list"
  );

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const paginated = sortedData.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      {/* Header — Apple macOS Window Title & Action */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Bonuri de Consum
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Gestionează eliberarea materialelor din gestiune ·{" "}
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
        <button
          type="button"
          onClick={() => navigate("/bonuri-consum/new")}
          className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Adaugă Bon Consum</span>
        </button>
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
              Total bonuri de consum
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <PackageOpen className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {list.length}
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "finalizat" ? "all" : "finalizat");
            setPage(1);
          }}
          onKeyDown={e => {
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
          <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {counts.finalizat}
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setStatusFilter(statusFilter === "draft" ? "all" : "draft");
            setPage(1);
          }}
          onKeyDown={e => {
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
          <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {counts.draft}
          </span>
        </div>
      </div>

      {/* Unified Filter & Search Toolbar */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 w-full min-w-0">
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
              data-active={statusFilter === "finalizat"}
              onClick={() => {
                setStatusFilter(statusFilter === "finalizat" ? "all" : "finalizat");
                setPage(1);
              }}
              className="apple-segmented-item px-2.5 tabular-nums shrink-0"
            >
              <span>Finalizate</span>
              <span className="opacity-75">{counts.finalizat}</span>
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
              <span className="opacity-75">{counts.draft}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto sm:flex-1 justify-end min-w-0">
            <div className="relative flex-1 min-w-[160px] max-w-full sm:max-w-[280px]">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Caută nr. bon, gestiune, ID deviz..."
                style={{ paddingLeft: 34, paddingRight: search ? 72 : 14 }}
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
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="px-3 py-3 w-12 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Nr.
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("number")}
                >
                  <div className="flex items-center gap-1">
                    <span>Nr. Bon</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("number")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    <span>Dată eliberare</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("date")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("gestiune")}
                >
                  <div className="flex items-center gap-1">
                    <span>Gestiune</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("gestiune")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white whitespace-nowrap select-none transition-colors"
                  onClick={() => handleSort("devizId")}
                >
                  <div className="flex items-center gap-1">
                    <span>Deviz asociat</span>
                    <span className="text-[#1d1d1f] dark:text-white opacity-60">
                      {getSortIcon("devizId")}
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
                    Niciun bon de consum găsit.
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors cursor-pointer"
                    onClick={() => navigate(`/bonuri-consum/${row.id}`)}
                  >
                    <td className="px-3 py-3 text-center tabular-nums text-[#8e8e93] text-[12px] font-medium">
                      {(page - 1) * rowsPerPage + i + 1}
                    </td>
                    <td className="px-4 py-3 text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums whitespace-nowrap">
                      {row.number}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[13px] text-[#1d1d1f] dark:text-[#ebebf5] whitespace-nowrap">
                      {formatDate(String(row.date))}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                      {row.gestiune || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                      {row.devizId ? `#${row.devizId}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium leading-none ${
                          row.status === "draft"
                            ? "bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300"
                            : "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                        }`}
                      >
                        {row.status === "draft" ? "Draft" : "Finalizat"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/api/pdf/bon-consum/${row.id}?download=1`}
                          target="_blank"
                          rel="noreferrer"
                          title="Descarcă PDF"
                          aria-label="Descarcă PDF"
                          className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row.id)}
                          title="Șterge"
                          aria-label="Șterge"
                          className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#ff3b30] dark:hover:text-[#ff453a] transition-all cursor-pointer"
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

        {/* Pagination — Apple HIG Capsule Controls */}
        <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between bg-[#fafafa]/85 dark:bg-white/[0.02] flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span className="flex items-center whitespace-nowrap">
              Afișează
              <Select
                value={rowsPerPage.toString()}
                onValueChange={val => {
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
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Pagina anterioară"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Pagina următoare"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
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
        <AlertDialogContent className="rounded-[22px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmați ștergerea</AlertDialogTitle>
            <AlertDialogDescription>
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
    </div>
  );
}
