import { ArrowLeft, FileText, Building2, Hash, Globe, Loader2, Download, Mail, Send, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate, invoiceStatusLabels, invoiceStatusColors } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useParams } from "wouter";

export default function ReInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = parseInt(id || "0");
  const utils = trpc.useContext();

  const { data: invoice, isLoading } = trpc.reinvoice.getById.useQuery(
    { id: invoiceId },
    { enabled: !!id && !isNaN(invoiceId) }
  );

  const sendToSpv = trpc.reinvoice.sendToSpv.useMutation({
    onSuccess: () => {
      toast.success("Factura a fost trimisă în SPV cu succes!");
      utils.reinvoice.getById.invalidate({ id: invoiceId });
    },
    onError: (err) => {
      toast.error(err.message || "Eroare la trimiterea în SPV");
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-500">Re-factura nu a fost găsită.</div>
        <button onClick={() => window.history.back()} className="mt-4 px-5 h-10 rounded-full bg-blue-600 text-white text-sm font-bold">← Înapoi</button>
      </div>
    );
  }

  const total = parseFloat(String(invoice.total || "0"));
  const totalVAT = parseFloat(String(invoice.totalVAT || "0"));
  const subtotal = parseFloat(String(invoice.subtotal || "0"));
  const currency = (invoice.currency || "RON") as any;
  const status = (invoice.status || "pending") as any;
  const pdfUrl = `/api/pdf/reinvoice/${invoiceId}`;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Re-Factură {invoice.number}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {invoice.clientName || "—"} · {formatDate(invoice.issueDate || "")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(!invoice.spvStatus || invoice.spvStatus === "nesincronizat" || invoice.spvStatus === "eroare") && (
            <button
              onClick={() => sendToSpv.mutate({ id: invoiceId })}
              disabled={sendToSpv.isPending}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors border border-indigo-200"
            >
              {sendToSpv.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Trimite în SPV
            </button>
          )}
          {invoice.spvStatus === "in_procesare" && (
            <div className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Procesare SPV
            </div>
          )}
          {invoice.spvStatus === "validat" && (
            <div className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <FileText className="w-3.5 h-3.5" /> Validat SPV
            </div>
          )}
          <span className={`px-2.5 h-8 flex items-center rounded-lg text-xs font-bold border ${(invoiceStatusColors as any)[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
            {(invoiceStatusLabels as any)[status] || status}
          </span>
        </div>
      </div>

      {/* SPV Error banner */}
      {invoice.spvStatus === "eroare" && invoice.spvError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex gap-3 text-rose-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-bold mb-1">Eroare validare SPV ANAF</h4>
            <p className="whitespace-pre-wrap font-mono text-xs opacity-90">{invoice.spvError}</p>
          </div>
        </div>
      )}

      {/* 3 Cards — same layout as EmittedInvoiceDetail */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Client */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Client (Către)</span>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{invoice.clientName || "—"}</div>
            {invoice.clientCUI && <div className="text-xs text-slate-500">CUI: {invoice.clientCUI}</div>}
            {invoice.clientAddress && <div className="text-xs text-slate-500">{invoice.clientAddress}{invoice.clientCity ? `, ${invoice.clientCity}` : ''}</div>}
          </div>
        </div>

        {/* Detalii */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Detalii Factură</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Număr:</span>
              <span className="text-slate-900 dark:text-white font-mono">{invoice.number || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dată:</span>
              <span className="text-slate-900 dark:text-white">{formatDate(invoice.issueDate || "")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Scadență:</span>
              <span className="text-slate-900 dark:text-white">{formatDate(invoice.dueDate || "")}</span>
            </div>
            {invoice.sourceInvoiceNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">Din factura:</span>
                <span className="text-slate-900 dark:text-white font-mono text-right">{invoice.sourceInvoiceNumber} ({invoice.sourceSupplierName})</span>
              </div>
            )}
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-bold">Stare SPV:</span>
              <span className="text-slate-900 dark:text-white font-bold">{invoice.spvStatus === 'validat' ? 'Validată' : invoice.spvStatus === 'in_procesare' ? 'În procesare' : 'Netrimisă'}</span>
            </div>
          </div>
        </div>

        {/* Totaluri */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Totaluri</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal:</span>
              <span className="text-slate-900 dark:text-white font-medium">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TVA:</span>
              <span className="text-slate-900 dark:text-white font-medium">{formatCurrency(totalVAT, currency)}</span>
            </div>
            <div className="flex justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">Total:</span>
              <span className="font-black text-rose-600 dark:text-rose-400 text-sm">{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer — full width, same as EmittedInvoiceDetail */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Vizualizare Factură PDF</h2>
          </div>
          <div className="flex gap-2">
            <a
              href={`${pdfUrl}?download=1`}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 h-8 flex items-center gap-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              Descarcă
            </a>
            <a
              href={`mailto:${invoice.clientEmail || ''}?subject=Factura ${invoice.number}&body=Regăsiți atașată re-factura ${invoice.number}.`}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Trimite pe Email
            </a>
          </div>
        </div>
        <div className="flex-1 min-h-[800px] bg-slate-50 dark:bg-slate-900/50 p-4">
          <iframe
            src={`${pdfUrl}#view=FitH`}
            className="w-full h-[800px] rounded border border-slate-200 dark:border-slate-700 bg-white"
            title={`Re-Factură ${invoice.number}`}
          />
        </div>
      </div>
    </div>
  );
}
