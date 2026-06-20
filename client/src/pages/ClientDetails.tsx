import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Building2, MapPin, Mail, Phone, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { DataTable, DataTableColumn } from "@/components/DataTable";

export default function ClientDetails() {
  const params = useParams();
  const id = Number(params.id);

  const { data, isLoading, error } = trpc.clients.getDetails.useQuery({ id }, { enabled: !!id });

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
        <div className="text-red-500 bg-red-50 p-4 rounded-xl border border-red-200">
          Eroare la încărcarea datelor clientului.
        </div>
      </div>
    );
  }

  const { client, sentInvoices, receivedInvoices } = data;

  const sentColumns: DataTableColumn<any>[] = [
    { key: "number", label: "NUMĂR", sortable: true },
    { key: "issueDate", label: "DATA EMITERII", sortable: true },
    { key: "dueDate", label: "SCADENȚĂ", sortable: true },
    { key: "total", label: "TOTAL", sortable: true, render: (val: string) => <span className="font-bold">{val}</span> },
    { key: "currency", label: "MONEDĂ" },
    { 
      key: "status", 
      label: "STATUS",
      render: (val: string) => (
        <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 uppercase tracking-wider">
          {val}
        </span>
      )
    }
  ];

  const receivedColumns: DataTableColumn<any>[] = [
    { key: "invoiceNumber", label: "NUMĂR", sortable: true },
    { key: "issueDate", label: "DATA EMITERII", sortable: true },
    { key: "total", label: "TOTAL", sortable: true, render: (val: string) => <span className="font-bold">{val}</span> },
    { key: "currency", label: "MONEDĂ" },
    { 
      key: "status", 
      label: "STATUS",
      render: (val: string) => (
        <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 uppercase tracking-wider">
          {val}
        </span>
      )
    }
  ];

  return (
    <div className="p-6 space-y-8">
      <Link href="/clienti" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Înapoi la clienți
      </Link>

      {/* Client Profile Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
        <div className="flex flex-col md:flex-row gap-6 justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Building2 className="w-6 h-6 text-blue-500" />
              {client.name}
            </h1>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 text-sm">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-xs w-20">CUI</span> 
                {client.cui || "-"}
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-xs w-20">Reg. Com</span> 
                {client.regCom || "-"}
              </div>
              <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                <span>{client.address || "-"}, {client.city || "-"}, {client.country || "-"}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Mail className="w-4 h-4 text-slate-400" />
                {client.email || "-"}
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Phone className="w-4 h-4 text-slate-400" />
                {client.phone || "-"}
              </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex flex-col gap-3 min-w-[220px]">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 flex items-center justify-between">
              <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4" /> Facturi Emise
              </div>
              <div className="text-2xl font-black text-blue-700 dark:text-blue-300">{sentInvoices.length}</div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800/50 flex items-center justify-between">
              <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4" /> Facturi Primite
              </div>
              <div className="text-2xl font-black text-purple-700 dark:text-purple-300">{receivedInvoices.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="space-y-8">
        {/* Sent Invoices */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Facturi Emise Către Client</h2>
          </div>
          {sentInvoices.length > 0 ? (
            <DataTable columns={sentColumns} data={sentInvoices} rowKey="id" isLoading={false} />
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium">
              Nu ai emis nicio factură către acest client.
            </div>
          )}
        </div>

        {/* Received Invoices */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Facturi Primite De La Client (Furnizor)</h2>
          </div>
          {receivedInvoices.length > 0 ? (
            <DataTable columns={receivedColumns} data={receivedInvoices} rowKey="id" isLoading={false} />
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium">
              Nu ai primit/arhivare nicio factură de la acest CUI.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
