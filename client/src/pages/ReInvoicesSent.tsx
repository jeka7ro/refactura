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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">TOTAL EMISE</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{mockReInvoices.length}</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">ACHITATE</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{mockReInvoices.filter((r) => r.status === "paid").length}</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">TRIMISE</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{mockReInvoices.filter((r) => r.status === "sent").length}</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">CIORNĂ</p>
          <p className="text-3xl font-bold text-slate-500 mt-2">{mockReInvoices.filter((r) => r.status === "draft").length}</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        >
          <option value="all">Toate statusurile</option>
          <option value="draft">Ciornă</option>
          <option value="sent">Trimisă</option>
          <option value="paid">Achitată</option>
          <option value="overdue">Restantă</option>
        </select>
        <div className="ml-auto text-sm text-slate-600 dark:text-slate-400">
          {filtered.length} re-facturi · {formatCurrency(totalValue, "RON")}
        </div>
      </div>

      {/* Data Table */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <FileOutput className="w-10 h-10 mx-auto mb-3 opacity-50" />
          Nicio re-factură găsită
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey="id"
          actions={(row) => (
            <div className="flex gap-2 justify-end">
              <button className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors" title="Previzualizare">
                <Eye className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors" title="Descarca">
                <Download className="w-4 h-4" />
              </button>
            </div>
          )}
        />
      )}
    </div>
  );
}
