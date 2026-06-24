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
    <div className="p-3 sm:p-5 max-w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">Re-Facturi Emise</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Total: <strong>{reInvoices.length}</strong> înregistrări</p>
        </div>
        <Link href="/facturi-primite">
          <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            Re-Factură nouă
          </button>
        </Link>
      </div>

      {/* Filtre tip — matching AllInvoices style */}
      <div className="flex flex-wrap gap-1.5">
        {([
          { id: "all",     label: "Toate",    count: reInvoices.length, cls: "bg-slate-100 text-slate-700 border-slate-300" },
          { id: "paid",    label: "Achitate", count: reInvoices.filter((r) => r.status === "paid").length, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { id: "sent",    label: "Trimise",  count: reInvoices.filter((r) => r.status === "sent").length, cls: "bg-blue-50 text-blue-700 border-blue-200" },
          { id: "draft",   label: "Ciornă",   count: reInvoices.filter((r) => r.status === "draft").length, cls: "bg-slate-50 text-slate-600 border-slate-200" },
          { id: "overdue", label: "Restanțe", count: reInvoices.filter((r) => r.status === "overdue").length, cls: "bg-rose-50 text-rose-700 border-rose-200" },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id as any)}
            className={`flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-semibold border transition-all ${
              statusFilter === f.id ? f.cls + " ring-1 ring-offset-1 ring-current" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
            }`}
          >
            {f.label} <span className="font-bold">{f.count}</span>
          </button>
        ))}
      </div>

      <DataTable 
        columns={columns} 
        data={filtered} 
        rowKey="id" 
        searchable={true} 
        isLoading={isLoading}
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            <a
              href={`/api/pdf/reinvoice/${row.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-6 h-6 rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"
              title="Previzualizare PDF"
            >
              <Eye className="w-3 h-3" />
            </a>
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
