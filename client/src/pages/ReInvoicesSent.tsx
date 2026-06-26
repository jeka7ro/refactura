import { useState } from "react";
import { Link } from "wouter";
import { Plus, Loader2, Eye, Download, Trash2, Mail, Send, Calendar } from "lucide-react";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { formatCurrency, formatDate, reInvoiceStatusLabels, reInvoiceStatusColors, type ReInvoiceStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

export default function ReInvoicesSent() {
  const [statusFilter, setStatusFilter] = useState<ReInvoiceStatus | "all">("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [customTo, setCustomTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  
  const { data: dbReInvoices, isLoading } = trpc.reinvoice.list.useQuery();
  const reInvoices = dbReInvoices || [];
  
  const deleteReInvoice = trpc.reinvoice.delete.useMutation();
  const utils = trpc.useUtils();

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteReInvoice.mutateAsync({ id: deleteId });
      await utils.reinvoice.list.invalidate();
      toast.success("Re-factură ștearsă cu succes");
    } catch (error: any) {
      toast.error("Eroare la ștergere", { description: error.message });
    } finally {
      setDeleteId(null);
    }
  };

  const handleSPV = () => {
    toast.error("Funcționalitate în lucru", { description: "Trimiterea directă din aplicație în SPV necesită generarea formatului standard UBL XML. Momentan se generează doar formatul PDF." });
  };

  const getDateRange = (p: string): [string, string] | null => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    switch (p) {
      case "today": { const t = fmt(now); return [t, t]; }
      case "week": {
        const d = startOfDay(now);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        const end = new Date(d); end.setDate(end.getDate() + 6);
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
      case "year": return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
      case "lastYear": return [`${now.getFullYear() - 1}-01-01`, `${now.getFullYear() - 1}-12-31`];
      case "custom": return customFrom && customTo ? [customFrom, customTo] : null;
      default: return null;
    }
  };

  const filtered = reInvoices.filter((ri) => {
    const matchStatus = statusFilter === "all" || ri.status === statusFilter;
    if (!matchStatus) return false;
    
    const range = getDateRange(period);
    if (range && ri.issueDate) {
      const rowDate = ri.issueDate.substring(0, 10);
      if (rowDate < range[0] || rowDate > range[1]) return false;
    }
    return true;
  });

  const exportToExcel = () => {
    if (!filtered.length) {
      toast.error("Nu există date de exportat.");
      return;
    }
    const header = ["NR. RE-FACTURĂ", "CLIENT", "FACTURĂ SURSĂ", "DATĂ", "SCADENȚĂ", "TOTAL", "MONEDĂ", "STATUS"];
    const rows = filtered.map(r => [
      r.number,
      r.clientName || "",
      r.sourceInvoiceNumber || "",
      r.issueDate ? formatDate(r.issueDate) : "",
      r.dueDate ? formatDate(r.dueDate) : "",
      r.total,
      r.currency || "RON",
      reInvoiceStatusLabels[r.status as ReInvoiceStatus] || r.status
    ]);
    const csvContent = [header, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Re-Facturi_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export Excel generat cu succes!");
  };

  const totalValue = filtered.reduce((s, r) => s + Number(r.total), 0);

  const columns: DataTableColumn<any>[] = [
    {
      key: "number",
      label: "NR. RE-FACTURĂ",
      sortable: true,
      render: (value: string) => <span>{value}</span>,
    },
    {
      key: "clientName",
      label: "CLIENT",
      sortable: true,
    },
    {
      key: "sourceInvoiceNumber",
      label: "FACTURĂ SURSĂ",
      sortable: true,
      render: (value: string) => <span>{value}</span>,
    },
    {
      key: "date",
      label: "DATĂ",
      sortable: true,
      render: (value: any) => formatDate(value),
    },
    {
      key: "dueDate",
      label: "SCADENȚĂ",
      sortable: true,
      render: (value: any) => formatDate(value),
    },
    {
      key: "total",
      label: "TOTAL",
      sortable: true,
      render: (value: number, row: any) => <span>{formatCurrency(value, row.currency)}</span>,
    },
    {
      key: "status",
      label: "STATUS",
      sortable: true,
      render: (value: string) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${reInvoiceStatusColors[value as ReInvoiceStatus]}`}>
          {reInvoiceStatusLabels[value as ReInvoiceStatus]}
        </span>
      ),
    },
    {
      key: "spvStatus",
      label: "SPV",
      sortable: true,
      render: (value: string) => {
        if (!value || value === "nesincronizat") return <span className="text-[10px] font-bold text-slate-400">Nesincronizat</span>;
        if (value === "in_procesare") return <span className="text-[10px] font-bold text-blue-500">În Procesare</span>;
        if (value === "validat") return <span className="text-[10px] font-bold text-emerald-500">Validat</span>;
        if (value === "eroare") return <span className="text-[10px] font-bold text-rose-500">Eroare</span>;
        return <span>{value}</span>;
      }
    }
  ];

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-3">
      {/* Header cu Titlu + Export/Sync (Top Row) si Filtre Perioada (Bottom Row) */}
      <div className="flex flex-col gap-3 mb-4">
        
        {/* Top Row: Title & Action Buttons */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Re-Facturi Emise</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total: <strong>{reInvoices.length}</strong> înregistrări</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 px-3 h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-all"
              title="Exportă tabelul curent în format Excel (CSV)"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
            <Link href="/facturi-primite">
              <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm">
                <Plus className="w-3.5 h-3.5" />
                Re-Factură nouă
              </button>
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Re-Facturi", value: reInvoices.length, cls: "text-slate-900 dark:text-white" },
            { label: "Achitate", value: reInvoices.filter(r => r.status === "paid").length, cls: "text-emerald-600" },
            { label: "Restanțe", value: reInvoices.filter(r => r.status === "overdue").length, cls: "text-rose-600" },
            { label: "Valoare Totală", value: `${totalValue.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON`, cls: "text-blue-600" },
          ].map(k => (
            <div key={k.label} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{k.label}</p>
              <p className={`text-xl font-black ${k.cls}`}>{k.value}</p>
            </div>
          ))}
        </div>


      </div>

      <DataTable 
        columns={columns} 
        data={filtered} 
        rowKey="id" 
        searchable={true} 
        onRowClick={(row) => { window.location.href = `/re-facturi/${row.id}` }}
        headerContent={
          <div className="flex flex-wrap gap-2 items-center justify-end w-full">
            {/* Period Filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400 hidden sm:block" />
              <Select value={period} onValueChange={(val) => setPeriod(val as any)}>
                <SelectTrigger className="h-8 w-fit min-w-[130px] rounded-full text-xs font-bold border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                  <SelectValue placeholder="Selectează perioada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate</SelectItem>
                  <SelectItem value="today">Azi</SelectItem>
                  <SelectItem value="week">Săpt. curentă</SelectItem>
                  <SelectItem value="month">Luna curentă</SelectItem>
                  <SelectItem value="lastMonth">Luna trecută</SelectItem>
                  <SelectItem value="year">Anul curent</SelectItem>
                  <SelectItem value="lastYear">Anul trecut</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-1 ml-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-2 h-8">
                <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">De la:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => { setCustomFrom(e.target.value); setPeriod("custom"); }}
                  className="text-xs bg-transparent outline-none text-slate-700 dark:text-slate-300 w-24 sm:w-auto"
                />
                <span className="text-xs text-slate-300 dark:text-slate-600 px-1">-</span>
                <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">Până la:</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => { setCustomTo(e.target.value); setPeriod("custom"); }}
                  className="text-xs bg-transparent outline-none text-slate-700 dark:text-slate-300 w-24 sm:w-auto"
                />
              </div>
            </div>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:block" />

            {/* Type Filters */}
            {([
              { id: "all",     label: "Toate",    count: reInvoices.length, cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300" },
              { id: "paid",    label: "Achitate", count: reInvoices.filter((r) => r.status === "paid").length, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
              { id: "sent",    label: "Trimise",  count: reInvoices.filter((r) => r.status === "sent").length, cls: "bg-blue-50 text-blue-700 border-blue-200" },
              { id: "draft",   label: "Ciornă",   count: reInvoices.filter((r) => r.status === "draft").length, cls: "bg-slate-50 text-slate-600 border-slate-200" },
              { id: "overdue", label: "Restanțe", count: reInvoices.filter((r) => r.status === "overdue").length, cls: "bg-rose-50 text-rose-700 border-rose-200" },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold border transition-all ${
                  statusFilter === f.id ? f.cls + " ring-1 ring-offset-1 ring-current" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                {f.label} <span className="font-bold">{f.count}</span>
              </button>
            ))}
          </>
        }
        isLoading={isLoading}
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => window.location.href = `/re-facturi/${row.id}`}
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
              title="Vizualizare Detaliată"
            >
              <Eye className="w-3 h-3" />
            </button>
            <a
              href={`/api/pdf/reinvoice/${row.id}?download=1`}
              download
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
              title="Descarcă PDF"
            >
              <Download className="w-3 h-3" />
            </a>
            <a
              href={`mailto:${row.clientEmail || ''}?subject=Factura ${row.number}&body=Regăsiți atașată factura ${row.number}.`}
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center"
              title="Trimite pe Email"
            >
              <Mail className="w-3 h-3" />
            </a>
            <button
              onClick={handleSPV}
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center"
              title="Trimite în SPV"
            >
              <Send className="w-3 h-3" />
            </button>
            <button
              onClick={() => setDeleteId(row.id)}
              disabled={deleteReInvoice.isPending && deleteId === row.id}
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center disabled:opacity-50"
              title="Șterge"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergere Re-Factură</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să ștergi această re-factură? Acțiunea este ireversibilă și va elimina complet documentul din sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteReInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Șterge definitiv
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
