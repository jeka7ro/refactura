// NIRList — Lista NIR-urilor (Nota de Intrare-Recepție)
// UI Rules: Nr. Crt., total records, pagination, rounded-lg buttons

import { useState } from "react";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTableSort } from "@/hooks/useTableSort";
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

export default function NIRList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: nirList = [], isLoading, refetch } = trpc.nir.list.useQuery();

  const deleteNir = trpc.nir.delete.useMutation({
    onSuccess: () => {
      toast.success("NIR șters!");
      refetch();
      setDeleteTarget(null);
    },
    onError: e => toast.error("Eroare: " + e.message),
  });

  const filtered = nirList.filter(
    n =>
      !search ||
      n.nirNumber?.toLowerCase().includes(search.toLowerCase()) ||
      n.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
      n.invoiceNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const { sortedData, handleSort, getSortIcon } = useTableSort(
    filtered,
    "nir_list"
  );

  const totalPages = Math.max(1, Math.ceil(sortedData.length / rowsPerPage));
  const paginated = sortedData.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const STATUS_CLS: Record<string, string> = {
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    finalizat: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
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
        <button
          onClick={() => navigate("/nir/nou")}
          className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> NIR Nou
        </button>
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
            value: nirList.filter(n => n.status === "finalizat").length,
            cls: "text-emerald-600",
          },
          {
            label: "Ciorne",
            value: nirList.filter(n => n.status === "draft").length,
            cls: "text-amber-600",
          },
        ].map(k => (
          <div
            key={k.label}
            className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {k.label}
            </p>
            <p className={`text-xl font-black ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search + counter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            className="w-3.5 h-3.5 text-slate-400"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          />
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Caută NIR, furnizor, factură..."
            className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            style={{ paddingLeft: 32, paddingRight: 12 }}
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Total înregistrări: <strong>{filtered.length}</strong>
        </span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-10 whitespace-nowrap">
                  #
                </th>
                <th
                  className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("nirNumber")}
                >
                  <div className="flex items-center gap-1">
                    Nr. NIR{" "}
                    <span className="text-blue-500">
                      {getSortIcon("nirNumber")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700"
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
                  className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("invoiceNumber")}
                >
                  <div className="flex items-center gap-1">
                    Factură sursă{" "}
                    <span className="text-blue-500">
                      {getSortIcon("invoiceNumber")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("receiptDate")}
                >
                  <div className="flex items-center gap-1">
                    Dată recepție{" "}
                    <span className="text-blue-500">
                      {getSortIcon("receiptDate")}
                    </span>
                  </div>
                </th>
                <th
                  className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Status{" "}
                    <span className="text-blue-500">
                      {getSortIcon("status")}
                    </span>
                  </div>
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Acțiuni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-600 mx-auto" />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-xs text-slate-400"
                  >
                    {search
                      ? "Niciun NIR găsit."
                      : "Niciun NIR creat. Apasă butonul NIR Nou sau iconița din tabelul Facturi."}
                  </td>
                </tr>
              ) : (
                paginated.map((row, i) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/nir/${row.id}`)}
                  >
                    <td className="px-3 py-2.5 text-[11px] text-slate-400">
                      {(page - 1) * rowsPerPage + i + 1}.
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/nir/${row.id}`);
                        }}
                        className="text-xs font-bold text-teal-600 hover:underline"
                      >
                        {row.nirNumber}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                      {row.supplierName || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-500">
                      {row.invoiceNumber || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-400">
                      {formatDate(row.receiptDate)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${STATUS_CLS[row.status || "draft"]}`}
                      >
                        {row.status === "finalizat" ? "Finalizat" : "Draft"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <div
                        className="flex items-center gap-1 justify-end"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => navigate(`/nir/${row.id}`)}
                          title="Vizualizează / Editează"
                          className="flex items-center justify-center w-6 h-6 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <a
                          href={`/api/pdf/nir/${row.id}?download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Descarcă PDF NIR"
                          className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors"
                        >
                          <FileDown className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => setDeleteTarget(row.id)}
                          title="Șterge NIR"
                          className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer paginare */}
      <div className="flex items-center justify-between gap-4 px-1 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Afișează</span>
          <select
            value={rowsPerPage}
            onChange={e => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 9999,
              padding: "1px 6px",
              fontSize: 12,
            }}
            className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:border-slate-700"
          >
            {[10, 15, 25, 50].map(n => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>
            Total înregistrări: <strong>{filtered.length}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            Pg. {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Delete dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi NIR-ul?</AlertDialogTitle>
            <AlertDialogDescription>
              Acțiunea este ireversibilă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteNir.mutate({ id: deleteTarget })
              }
              className="bg-red-600 hover:bg-red-700"
            >
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
