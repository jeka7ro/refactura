import { useState } from "react";
import { Link } from "wouter";
import { FileOutput, Plus, Eye, Download } from "lucide-react";
import { DataTable, DataTableColumn } from "@/components/DataTable";
import { mockReInvoices, formatCurrency, formatDate, reInvoiceStatusLabels, reInvoiceStatusColors, type ReInvoiceStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";

export default function ReInvoicesSent() {
  const [statusFilter, setStatusFilter] = useState<ReInvoiceStatus | "all">("all");

  const filtered = mockReInvoices.filter((ri) => {
    const matchStatus = statusFilter === "all" || ri.status === statusFilter;
    return matchStatus;
  });

  const totalValue = filtered.reduce((s, r) => s + r.total, 0);

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
          <span className="font-bold text-slate-800">{mockReInvoices.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-100/60 backdrop-blur-sm text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span className="text-slate-600 font-medium">ACHITATE:</span>
          <span className="font-bold text-emerald-700">{mockReInvoices.filter((r) => r.status === "paid").length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50/80 border border-blue-100/60 backdrop-blur-sm text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          <span className="text-slate-600 font-medium">TRIMISE:</span>
          <span className="font-bold text-blue-700">{mockReInvoices.filter((r) => r.status === "sent").length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50/80 border border-slate-200/60 backdrop-blur-sm text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          <span className="text-slate-600 font-medium">CIORNĂ:</span>
          <span className="font-bold text-slate-600">{mockReInvoices.filter((r) => r.status === "draft").length}</span>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 rounded-full border border-slate-200 bg-white/50 backdrop-blur-sm text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
        >
          <option value="all">Toate statusurile</option>
          <option value="draft">Ciornă</option>
          <option value="sent">Trimisă</option>
          <option value="paid">Achitată</option>
          <option value="overdue">Restantă</option>
        </select>
        <div className="ml-auto flex items-center px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-700">
          {filtered.length} re-facturi · {formatCurrency(totalValue, "RON")}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filtered}
        rowKey="id"
        isLoading={false}
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
    </div>
  );
}
