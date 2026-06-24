import { useState } from "react";
import { Link } from "wouter";
import { Plus, Loader2, Eye, Download, Trash2, Mail, Send } from "lucide-react";
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

export default function ReInvoicesSent() {
  const [statusFilter, setStatusFilter] = useState<ReInvoiceStatus | "all">("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
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

  const filtered = reInvoices.filter((ri) => {
    const matchStatus = statusFilter === "all" || ri.status === statusFilter;
    return matchStatus;
  });

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
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Re-Facturi Emise</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Facturi generate către clienții finali</p>
        </div>
        <Link href="/facturi-primite">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Re-Factură nouă
          </Button>
        </Link>
      </div>

      {/* Micro KPI Headers */}
      <div className="flex flex-wrap items-center gap-3 mt-2 mb-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/80 border border-slate-200/60 backdrop-blur-sm text-sm">
          <span className="text-slate-600 font-medium">TOTAL EMISE:</span>
          <span className="font-bold text-slate-800">{reInvoices.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-100/60 backdrop-blur-sm text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span className="text-slate-600 font-medium">ACHITATE:</span>
          <span className="font-bold text-emerald-700">{reInvoices.filter((r) => r.status === "paid").length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/80 border border-blue-100/60 backdrop-blur-sm text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          <span className="text-slate-600 font-medium">TRIMISE:</span>
          <span className="font-bold text-blue-700">{reInvoices.filter((r) => r.status === "sent").length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50/80 border border-slate-200/60 backdrop-blur-sm text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          <span className="text-slate-600 font-medium">CIORNĂ:</span>
          <span className="font-bold text-slate-700">{reInvoices.filter((r) => r.status === "draft").length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50/80 border border-rose-100/60 backdrop-blur-sm text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          <span className="text-slate-600 font-medium">RESTANȚE:</span>
          <span className="font-bold text-rose-700">{reInvoices.filter((r) => r.status === "overdue").length}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Filtrare:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toate statusurile</option>
              <option value="draft">Ciorne</option>
              <option value="sent">Trimise</option>
              <option value="paid">Achitate</option>
              <option value="overdue">Restanțe</option>
            </select>
          </div>
        </div>

        <DataTable 
          columns={columns} 
          data={filtered} 
          rowKey="id" 
          searchable={true} 
          isLoading={isLoading}
          actions={(row) => (
            <div className="flex items-center justify-end gap-2">
              {/* Ochi = previzualizare PDF în tab nou (inline) */}
              <a
                href={`/api/pdf/reinvoice/${row.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
                title="Previzualizare PDF"
              >
                <Eye className="w-4 h-4" />
              </a>
              {/* Download = descarcă PDF ca fișier */}
              <a
                href={`/api/pdf/reinvoice/${row.id}?download=1`}
                download
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
                title="Descarcă PDF"
              >
                <Download className="w-4 h-4" />
              </a>
              <a
                href={`mailto:${row.clientEmail || ''}?subject=Factura ${row.number}&body=Regăsiți atașată factura ${row.number}.%0D%0A%0D%0ALink: ${encodeURIComponent(window.location.origin + '/api/pdf/reinvoice/' + row.id)}`}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center"
                title="Trimite pe Email"
              >
                <Mail className="w-4 h-4" />
              </a>
              <button
                onClick={handleSPV}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center"
                title="Trimite în SPV"
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteId(row.id)}
                disabled={deleteReInvoice.isPending && deleteId === row.id}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center disabled:opacity-50"
                title="Șterge"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        />
        
        {/* Footer Totals */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Afișat</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(totalValue, "RON")}
            </span>
          </div>
        </div>
      </div>

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
