import { useState } from "react";
import { Link } from "wouter";
import { Plus, Loader2, Eye, Download } from "lucide-react";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { formatCurrency, formatDate, reInvoiceStatusLabels, reInvoiceStatusColors, type ReInvoiceStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function ReInvoicesSent() {
  const [statusFilter, setStatusFilter] = useState<ReInvoiceStatus | "all">("all");
  
  const { data: dbReInvoices, isLoading } = trpc.reinvoice.list.useQuery();
  const reInvoices = dbReInvoices || [];

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

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Filtrare:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
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
              <button className="w-8 h-8 rounded-full border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center" title="Previzualizare">
                <Eye className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-full border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center" title="Descarca">
                <Download className="w-4 h-4" />
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
    </div>
  );
}
