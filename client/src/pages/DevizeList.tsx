// DevizeList.tsx — Lista Devizelor de lucrări
import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Search, ChevronLeft, ChevronRight, Trash2, Eye, FileText, FileDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatDate } from "@/lib/store";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DevizeList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: list = [], isLoading, refetch } = trpc.devize.list.useQuery();

  const deleteMutation = trpc.devize.delete.useMutation({
    onSuccess: () => { toast.success("Deviz șters!"); refetch(); setDeleteTarget(null); },
    onError: (e) => toast.error("Eroare: " + e.message),
  });

  const filtered = list.filter(n =>
    !search ||
    n.number?.toLowerCase().includes(search.toLowerCase()) ||
    (n.invoiceId && n.invoiceId.toString().includes(search.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const STATUS_CLS: Record<string, string> = {
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    final: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" />
            Devize de Lucrări
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Gestionează devizele (materiale și manoperă)</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Devize", value: list.length, cls: "text-slate-900 dark:text-white" },
          { label: "Finalizate", value: list.filter(n => n.status === "final").length, cls: "text-emerald-600" },
          { label: "Ciorne", value: list.filter(n => n.status === "draft").length, cls: "text-amber-600" },
          { label: "Valoare Totală", value: `${list.reduce((s, r) => s + (Number(r.total) || 0), 0).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON`, cls: "text-sky-600" },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{k.label}</p>
            <p className={`text-xl font-black ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Caută nr. deviz, ID factură..."
            className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            style={{ paddingLeft: 32, paddingRight: 12 }}
          />
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Total înregistrări: <strong>{filtered.length}</strong>
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-10">#</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Nr. Deviz</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Dată</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Factură asociată</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Materiale</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Manoperă</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={9} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-sky-600 mx-auto" /></td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-xs text-slate-400">Niciun deviz găsit. Devizele sunt generate automat la facturare.</td></tr>
              ) : (
                paginated.map((row, i) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 py-2 text-slate-400 text-xs">{(page - 1) * rowsPerPage + i + 1}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => navigate(`/devize/${row.id}`)} className="text-xs font-bold text-sky-600 hover:underline">
                        {row.number}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(String(row.date))}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.invoiceId ? `#${row.invoiceId}` : "—"}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 text-right">{Number(row.totalMaterials).toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300 text-right">{Number(row.totalLabor).toFixed(2)}</td>
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-white text-right">{Number(row.total).toFixed(2)} RON</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${STATUS_CLS[row.status || "draft"] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/devize/${row.id}`)} title="Vizualizează" className="p-1.5 text-slate-400 hover:text-sky-600 rounded bg-slate-50 hover:bg-sky-50 transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a href={`/api/pdf/deviz/${row.id}?download=1`} target="_blank" rel="noreferrer" title="Descarcă PDF" className="p-1.5 text-slate-400 hover:text-sky-600 rounded bg-slate-50 hover:bg-sky-50 transition-colors">
                          <FileDown className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => setDeleteTarget(row.id)} title="Șterge" className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-slate-50 hover:bg-red-50 transition-colors">
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
        
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-2">
              Rânduri:
              <select
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                style={{ border: "1px solid #e2e8f0", borderRadius: 9999, padding: "1px 6px", fontSize: 12 }}
                className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:border-slate-700"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toate</option>
              </select>
            </span>
            <span className="hidden sm:inline">Afișare {Math.min((page - 1) * rowsPerPage + 1, filtered.length)} - {Math.min(page * rowsPerPage, filtered.length)} din {filtered.length}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded text-slate-400 hover:text-slate-900 disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 rounded text-slate-400 hover:text-slate-900 disabled:opacity-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmați ștergerea</AlertDialogTitle>
            <AlertDialogDescription>Această acțiune este ireversibilă.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Renunță</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget })} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Șterge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
