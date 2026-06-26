// InvoicesReceived — RefacturaRO
// List of imported invoices with DataTable (sorting, filtering, pagination, selection)

import { useState } from "react";
import { Link } from "wouter";
import { Upload, RefreshCw, Plus, Eye, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import {
  formatCurrency,
  formatDate,
  invoiceStatusLabels,
  invoiceStatusColors,
  sourceColors,
  type InvoiceStatus,
  type IntegrationSource,
} from "@/lib/store";
import { trpc } from "@/lib/trpc";

const ALL = "all";

interface InvoiceRow {
  id: number | string;
  number: string;
  supplierName: string;
  date: string;
  dueDate: string;
  total: number;
  totalVAT: number;
  currency: string;
  status: InvoiceStatus;
  source: IntegrationSource;
}

export default function InvoicesReceived() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | typeof ALL>(ALL);
  const [sourceFilter, setSourceFilter] = useState<IntegrationSource | typeof ALL>(ALL);
  const [syncing, setSyncing] = useState(false);
  const [selectedRows, setSelectedRows] = useState<InvoiceRow[]>([]);

  const { data: dbInvoices, isLoading } = trpc.invoices.list.useQuery();
  
  const invoicesList: InvoiceRow[] = (dbInvoices || []).map((inv: any) => ({
    id: inv.id,
    number: inv.invoiceNumber,
    supplierName: inv.supplierName,
    date: inv.issueDate,
    dueDate: inv.dueDate || inv.issueDate,
    total: parseFloat(inv.total),
    totalVAT: parseFloat(inv.totalVAT),
    currency: inv.currency,
    status: inv.status as InvoiceStatus,
    source: inv.source as IntegrationSource,
  }));

  const filtered = invoicesList.filter((inv) => {
    const matchStatus = statusFilter === ALL || inv.status === statusFilter;
    const matchSource = sourceFilter === ALL || inv.source === sourceFilter;
    return matchStatus && matchSource;
  });

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success("Sincronizare completă", { description: "3 facturi noi importate" });
    }, 2000);
  };

  const columns: DataTableColumn<InvoiceRow>[] = [
    {
      key: "supplierName",
      label: "Număr & Furnizor",
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-blue-600 hover:underline text-left cursor-pointer" onClick={() => window.location.href = `/facturi-primite/${row.id}`}>{row.number}</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={value}>{value}</span>
        </div>
      ),
    },
    {
      key: "source",
      label: "Sursă",
      sortable: true,
      render: (value: any) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${sourceColors[value as IntegrationSource]}`}>
          {value}
        </span>
      ),
    },
    {
      key: "date",
      label: "Dată",
      sortable: true,
      render: (value) => formatDate(value),
    },
    {
      key: "dueDate",
      label: "Scadență",
      sortable: true,
      render: (value) => formatDate(value),
    },
    {
      key: "total",
      label: "Total",
      sortable: true,
      className: "text-right",
      render: (value, row) => (
        <div className="text-right">
          <div className="text-slate-900 dark:text-white">{formatCurrency(value, row.currency as any)}</div>
          <div className="text-xs text-slate-400 mt-0.5">TVA: {formatCurrency(row.totalVAT, row.currency as any)}</div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value: any) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border ${invoiceStatusColors[value as InvoiceStatus]}`}>
          {invoiceStatusLabels[value as InvoiceStatus]}
        </span>
      ),
    },
    {
      key: "id",
      label: "Acțiuni",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/facturi-primite/${row.id}`}>
            <button className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center transition-colors">
              <Eye className="w-3.5 h-3.5" />
            </button>
          </Link>
          <Link href={`/re-facturare/${row.id}`}>
            <button className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-normal transition-all active:scale-[0.97]">
              Re-facturează
              <ArrowRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Facturi Primite</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Facturi importate din SmartBill, SPV, Oblio</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Sincronizează
          </button>
          <button
            onClick={() => toast.info("Import manual", { description: "Funcție disponibilă în curând" })}
            className="flex items-center gap-2 px-4 h-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import XML
          </button>
          <button
            onClick={() => toast.info("Factură manuală", { description: "Funcție disponibilă în curând" })}
            className="flex items-center gap-2 px-5 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all active:scale-[0.97]"
          >
            <Plus className="w-4 h-4" />
            Adaugă manual
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Facturi", value: invoicesList.length, cls: "text-slate-900 dark:text-white" },
          { label: "Re-facturate", value: invoicesList.filter(r => r.status === "re-invoiced").length, cls: "text-emerald-600" },
          { label: "În așteptare", value: invoicesList.filter(r => r.status === "pending" || r.status === "imported").length, cls: "text-amber-600" },
          { label: "Valoare Totală", value: `${invoicesList.reduce((s, r) => s + (r.total || 0), 0).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON`, cls: "text-blue-600" },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{k.label}</p>
            <p className={`text-xl font-black ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 px-4 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value={ALL}>Toate statusurile</option>
            <option value="imported">Importată</option>
            <option value="re-invoiced">Re-facturată</option>
            <option value="partial">Parțial</option>
            <option value="pending">În așteptare</option>
          </select>

          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="h-10 px-4 text-sm rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value={ALL}>Toate sursele</option>
            <option value="SmartBill">SmartBill</option>
            <option value="SPV">SPV ANAF</option>
            <option value="Oblio">Oblio</option>
            <option value="Manual">Manual</option>
          </select>

          {selectedRows.length > 0 && (
            <div className="ml-auto text-xs text-blue-600 font-semibold">
              {selectedRows.length} rânduri selectate
            </div>
          )}
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filtered}
        rowKey="id"
        selectable={true}
        onSelectionChange={setSelectedRows}
        isLoading={isLoading}
      />
    </div>
  );
}
