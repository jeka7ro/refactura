import { Link, useParams } from "wouter";
import { ArrowLeft, FileText, Building2, Calendar, Hash, Globe, Loader2, Download, Mail, Send, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate, invoiceStatusLabels, invoiceStatusColors } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { toast } from "react-hot-toast";

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
        <Link href="/re-facturi">
          <button className="mt-4 px-5 h-10 rounded-full bg-blue-600 text-white text-sm font-bold">← Înapoi</button>
        </Link>
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
          <Link href="/re-facturi">
            <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Detalii Re-Factură
            </h1>
            <p className="text-sm text-slate-500 font-medium">Re-Factura #{invoice.number}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {(!invoice.spvStatus || invoice.spvStatus === "nesincronizat" || invoice.spvStatus === "eroare") && (
            <button
              onClick={() => sendToSpv.mutate({ id: invoiceId })}
              disabled={sendToSpv.isLoading}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors border border-indigo-200"
            >
              {sendToSpv.isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Trimite în SPV
            </button>
          )}
          {invoice.spvStatus === "in_procesare" && (
            <div className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Procesare SPV
            </div>
          )}
          {invoice.spvStatus === "validat" && (
            <div className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <FileText className="w-3.5 h-3.5" />
              Validat SPV
            </div>
          )}
          <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${(invoiceStatusColors as any)[status] || "bg-slate-100 text-slate-600"}`}>
            {(invoiceStatusLabels as any)[status] || status}
          </div>
        </div>
      </div>

      {invoice.spvStatus === "eroare" && invoice.spvError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex gap-3 text-rose-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-bold mb-1">Eroare validare SPV ANAF</h4>
            <p className="whitespace-pre-wrap font-mono text-xs opacity-90">{invoice.spvError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col - Details */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Client (Către)</span>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{invoice.clientName || "—"}</div>
              {invoice.clientCUI && <div className="text-xs text-slate-500">CUI: {invoice.clientCUI}</div>}
              {invoice.clientAddress && <div className="text-xs text-slate-500">{invoice.clientAddress}, {invoice.clientCity}</div>}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Detalii Re-Factură</span>
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
                  <span className="text-slate-900 dark:text-white font-mono">{invoice.sourceInvoiceNumber} ({invoice.sourceSupplierName})</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Fișier/Link public:</span>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                  Deschide PDF
                </a>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Totaluri</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TVA:</span>
                <span className="text-slate-900 dark:text-white">{formatCurrency(totalVAT, currency)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                <span className="font-semibold text-slate-900 dark:text-white">Total:</span>
                <span className="font-bold text-blue-600">{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col - PDF Viewer */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[700px] overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Vizualizare Re-Factură PDF
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={`${pdfUrl}?download=1`}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Descarcă
                </a>
                <a
                  href={`mailto:${invoice.clientEmail || ''}?subject=Factura ${invoice.number}&body=Regăsiți atașată re-factura ${invoice.number}.`}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Trimite pe Email
                </a>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 relative">
              <iframe
                src={`${pdfUrl}#view=FitH`}
                className="w-full h-full border-0 absolute inset-0"
                title={`Re-Factură ${invoice.number}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
