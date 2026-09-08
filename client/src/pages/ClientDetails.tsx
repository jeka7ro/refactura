import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  ArrowLeft,
  Building2,
  MapPin,
  Mail,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ExternalLink,
} from "lucide-react";
import { DataTable, DataTableColumn } from "@/components/DataTable";

export default function ClientDetails() {
  const params = useParams();
  const id = Number(params.id);

  const { data, isLoading, error } = trpc.clients.getDetails.useQuery(
    { id },
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-red-500 bg-red-50 p-4 rounded-lg border border-red-200">
          Eroare la încărcarea datelor clientului.
        </div>
      </div>
    );
  }

  const { client, sentInvoices, receivedInvoices } = data;

  const sentColumns: DataTableColumn<any>[] = [
    {
      key: "number",
      label: "NUMĂR",
      sortable: true,
      render: (val: string, row: any) => (
        <Link
          href={row.type === "reinvoice" ? `/re-facturi/${row.id}` : `/facturi-emise-nou/view/${row.id}`}
          className="text-blue-600 dark:text-blue-400 hover:underline font-bold inline-flex items-center gap-1"
        >
          {val}
          <ExternalLink className="w-3 h-3 opacity-60" />
        </Link>
      ),
    },
    { key: "issueDate", label: "DATA EMITERII", sortable: true },
    { key: "dueDate", label: "SCADENȚĂ", sortable: true },
    {
      key: "total",
      label: "TOTAL",
      sortable: true,
      render: (val: string) => <span className="font-bold">{val}</span>,
    },
    { key: "currency", label: "MONEDĂ" },
    {
      key: "status",
      label: "STATUS",
      render: (val: string) => {
        const isPaid = val === "paid";
        const isSent = val === "sent";
        const isStorno = val === "storno";
        const colorClass = isPaid
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
          : isSent
          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
          : isStorno
          ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        const label = isPaid ? "PLĂTITĂ" : isSent ? "TRIMISĂ" : isStorno ? "STORNATĂ" : (val || "EMISĂ").toUpperCase();
        return (
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider ${colorClass}`}>
            {label}
          </span>
        );
      },
    },
  ];

  const receivedColumns: DataTableColumn<any>[] = [
    {
      key: "invoiceNumber",
      label: "NUMĂR",
      sortable: true,
      render: (val: string, row: any) => (
        <Link
          href={`/facturi-primite/${row.id}`}
          className="text-purple-600 dark:text-purple-400 hover:underline font-bold inline-flex items-center gap-1"
        >
          {val}
          <ExternalLink className="w-3 h-3 opacity-60" />
        </Link>
      ),
    },
    { key: "issueDate", label: "DATA EMITERII", sortable: true },
    {
      key: "total",
      label: "TOTAL",
      sortable: true,
      render: (val: string) => <span className="font-bold">{val}</span>,
    },
    { key: "currency", label: "MONEDĂ" },
    {
      key: "status",
      label: "STATUS",
      render: (val: string) => (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 uppercase tracking-wider">
          {val || "PROCESAT"}
        </span>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/clienti"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Înapoi la clienți
        </Link>
        <Link
          href="/facturi-emise-nou/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Emite Factură
        </Link>
      </div>

      {/* Client Profile Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        <div className="ml-2">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            {client.name}
          </h1>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-6 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider w-16">
                CUI
              </span>
              {client.cui || "-"}
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider w-16">
                Reg. Com
              </span>
              {client.regCom || "-"}
            </div>
            <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400">
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
              <span
                className="truncate"
                title={`${client.address || "-"}, ${client.city || "-"}, ${client.country || "-"}`}
              >
                {client.address || "-"}, {client.city || "-"},{" "}
                {client.country || "-"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{client.email || "-"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{client.phone || "-"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="space-y-4">
        {/* Sent Invoices */}
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-2">
            Facturi Emise Către Client
          </h2>
          {sentInvoices.length > 0 ? (
            <DataTable
              columns={sentColumns}
              data={sentInvoices}
              rowKey="id"
              isLoading={false}
            />
          ) : (
            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 border-dashed dark:border-slate-700 rounded-lg text-slate-400 text-xs font-medium">
              Nicio factură emisă către acest client.
            </div>
          )}
        </div>

        {/* Received Invoices */}
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-2">
            Facturi Primite De La Client (Furnizor)
          </h2>
          {receivedInvoices.length > 0 ? (
            <DataTable
              columns={receivedColumns}
              data={receivedInvoices}
              rowKey="id"
              isLoading={false}
            />
          ) : (
            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 border-dashed dark:border-slate-700 rounded-lg text-slate-400 text-xs font-medium">
              Nicio factură primită de la acest CUI.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
