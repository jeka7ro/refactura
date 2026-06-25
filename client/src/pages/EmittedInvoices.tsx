// EmittedInvoices.tsx — Lista Facturilor Emise Direct din Platformă
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Eye, Download, Pencil, Trash2, Send, Loader2, Search, ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/store";
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

const STATUS_LABELS: Record<string, string> = {
  draft: "Ciornă", sent: "Emisă", paid: "Achitată", overdue: "Restanță", cancelled: "Anulată",
};
const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-600 border-slate-200",
  sent:      "bg-blue-50 text-blue-700 border-blue-200",
  paid:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  overdue:   "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};
const SPV_LABELS: Record<string, string> = {
  nesincronizat: "Netrimisă", in_procesare: "Procesare", validat: "Validată", eroare: "Eroare",
};
const SPV_COLORS: Record<string, string> = {
  nesincronizat: "text-slate-400",
  in_procesare:  "text-blue-500",
  validat:       "text-emerald-500 font-bold",
  eroare:        "text-rose-500",
};

export default function EmittedInvoices() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [stornoTarget, setStornoTarget] = useState<{ id: number; number: string } | null>(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const { data = [], isLoading, refetch } = trpc.emittedInvoice.list.useQuery();
  const deleteMutation = trpc.emittedInvoice.delete.useMutation({
    onSuccess: () => { toast.success("Factura ștearsă"); refetch(); setDeleteId(null); },
    onError: (e) => { toast.error("Eroare: " + e.message); setDeleteId(null); },
  });
  const sendToSpv = trpc.emittedInvoice.sendToSpv.useMutation({
    onSuccess: (res) => {
      if (res.success) toast.success("Trimisă în SPV! Index: " + res.index_incarcare);
      else toast.error("Eroare SPV: " + res.error);
      refetch();
    },
    onError: (e) => toast.error("Eroare SPV: " + e.message),
  });

  const filtered = useMemo(() => {
    let rows = data;
    if (statusFilter !== "all") rows = rows.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.number.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.clientCUI || "").includes(q)
      );
    }
    return rows;
  }, [data, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const paged = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const totalValue = useMemo(() => filtered.reduce((s, r) => s + parseFloat(String(r.total || 0)), 0), [filtered]);

  const counts = useMemo(() => ({
    all: data.length,
    draft: data.filter(r => r.status === "draft").length,
    sent: data.filter(r => r.status === "sent").length,
    paid: data.filter(r => r.status === "paid").length,
    overdue: data.filter(r => r.status === "overdue").length,
  }), [data]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Facturi Emise
          </h1>
          <p className="text-sm text-slate-500 font-medium">Facturi emise direct din platformă</p>
        </div>
        <Link href="/facturi-emise-nou/new">
          <button className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
            <Plus className="w-4 h-4" />
            Emite Factură Nouă
          </button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Facturi", value: data.length, cls: "text-slate-900 dark:text-white" },
          { label: "Achitate", value: counts.paid, cls: "text-emerald-600" },
          { label: "Restanțe", value: counts.overdue, cls: "text-rose-600" },
          { label: "Valoare Totală", value: formatCurrency(totalValue, "RON"), cls: "text-blue-600" },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{k.label}</p>
            <p className={`text-xl font-black ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
          {/* Status Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "all",     label: "Toate",     count: counts.all },
              { id: "draft",   label: "Ciornă",    count: counts.draft },
              { id: "sent",    label: "Emise",   count: counts.sent },
              { id: "paid",    label: "Achitate",  count: counts.paid },
              { id: "overdue", label: "Restanțe",  count: counts.overdue },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { setStatusFilter(f.id); setPage(1); }}
                className={`flex items-center gap-1 px-3 h-7 rounded-lg text-xs font-semibold border transition-all ${
                  statusFilter === f.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                {f.label} <span className="font-bold">{f.count}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
            <input
              type="text"
              placeholder="Caută factură, client..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-8 !pl-10 pr-10 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-full text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full px-2 text-[10px] font-bold">
                {filtered.length}/{data.length}
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="text-center w-12 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nr.</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Număr Factură</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Client</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">Dată</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">Scadență</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden lg:table-cell">SPV</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                    {data.length === 0 ? "Nicio factură emisă încă. Apasă pe «Emite Factură Nouă»." : "Niciun rezultat pentru filtrele selectate."}
                  </td>
                </tr>
              ) : (
                paged.map((row, idx) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/facturi-emise-nou/view/${row.id}`)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="text-center px-4 py-3 text-slate-400 text-xs">
                      {(page - 1) * rowsPerPage + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white text-xs">{row.number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white text-xs leading-tight">{row.clientName}</div>
                      {row.clientCUI && <div className="text-[10px] text-slate-400">CUI: {row.clientCUI}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{formatDate(row.issueDate)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{formatDate(row.dueDate || "")}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white text-xs">
                      {formatCurrency(parseFloat(String(row.total)), (row.currency || "RON") as any)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[row.status || "draft"]}`}>
                        {STATUS_LABELS[row.status || "draft"]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className={`text-[10px] font-semibold ${SPV_COLORS[row.spvStatus || "nesincronizat"]}`}>
                        {SPV_LABELS[row.spvStatus || "nesincronizat"]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setStornoTarget({ id: row.id, number: `${row.series || ''} ${row.number}`.trim() })}
                          className="w-7 h-7 rounded-lg border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 flex items-center justify-center transition-colors"
                          title="Storno Factură"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = `/api/pdf/emitted/${row.id}?download=1`;
                            a.download = `${row.series || ''}${row.number}.pdf`;
                            a.target = "_blank";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                          title="Descarcă PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {(!row.spvStatus || row.spvStatus === "nesincronizat" || row.spvStatus === "eroare") && (
                          <button
                            onClick={() => sendToSpv.mutate({ id: row.id })}
                            disabled={sendToSpv.isPending}
                            className="w-7 h-7 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                            title="Trimite în SPV"
                          >
                            {sendToSpv.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(row.id)}
                          className="w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors"
                          title="Șterge"
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

        {/* Footer — Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
          <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <span>
              Afișează&nbsp;
              <select
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 text-xs"
              >
                {[10, 15, 25, 50, 9999].map(n => <option key={n} value={n}>{n === 9999 ? "Toți" : n}</option>)}
              </select>
            </span>
            <span>Total înregistrări: <strong>{filtered.length}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Pagina {page} din {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge Factura?</AlertDialogTitle>
            <AlertDialogDescription>Acțiunea este ireversibilă. Factura și toate liniile sale vor fi șterse definitiv.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Storno confirm */}
      <AlertDialog open={stornoTarget !== null} onOpenChange={() => setStornoTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emite factură de Storno?</AlertDialogTitle>
            <AlertDialogDescription>
              Vei emite o factură de storno (cu valori negative) pentru factura <strong>{stornoTarget?.number}</strong>.
              Factura originală nu va fi modificată. Ești sigur că vrei să continui?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => { if (stornoTarget) { navigate(`/facturi-emise-nou/storno/${stornoTarget.id}`); setStornoTarget(null); } }}
            >
              Da, emite Storno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
