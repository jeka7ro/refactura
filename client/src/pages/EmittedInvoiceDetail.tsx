import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Building2,
  Calendar,
  Hash,
  Globe,
  Loader2,
  Download,
  Send,
  RefreshCw,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  invoiceStatusLabels,
  invoiceStatusColors,
} from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function EmittedInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = parseInt(id || "0");

  const { data: invoice, isLoading } = trpc.emittedInvoice.getById.useQuery(
    { id: invoiceId },
    { enabled: !!id && !isNaN(invoiceId) }
  );

  // Deviz legat de aceasta factura (daca exista)
  const { data: linkedDeviz } = trpc.devize.getByInvoiceId.useQuery(
    { invoiceId },
    { enabled: !!invoiceId && !isNaN(invoiceId) }
  );

  const utils = trpc.useUtils();

  const sendToSpv = trpc.emittedInvoice.sendToSpv.useMutation({
    onSuccess: res => {
      if (res.success) {
        toast.success("Trimisă în SPV! Index: " + res.index_incarcare);
        utils.emittedInvoice.getById.invalidate({ id: invoiceId });
      } else {
        toast.error("Eroare SPV: " + res.error);
      }
    },
    onError: e => toast.error("Eroare SPV: " + e.message),
  });

  const checkSpvStatus = trpc.emittedInvoice.checkSpvStatus.useMutation({
    onSuccess: res => {
      utils.emittedInvoice.getById.invalidate({ id: invoiceId });
      if (res.status === "validat") {
        toast.success("✅ Factura a fost validată de ANAF!");
      } else if (res.status === "in_procesare") {
        toast.info("⏳ ANAF procesează în continuare factura. Mai încearcă peste câteva minute.");
      } else if (res.status === "eroare") {
        toast.error("❌ ANAF a respins factura: " + (res.errors?.join(", ") || "eroare necunoscută"));
      } else {
        toast.info("Status ANAF: " + (res.stare || "necunoscut"));
      }
    },
    onError: e => toast.error("Eroare verificare: " + e.message),
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
        <div className="text-slate-500">Factura nu a fost găsită.</div>
        <Link href="/facturi">
          <button className="mt-4 px-5 h-10 rounded-full bg-blue-600 text-white text-sm font-bold">
            ← Înapoi la Facturi
          </button>
        </Link>
      </div>
    );
  }

  const status = (invoice.status || "draft") as any;

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
              Factură {invoice.series} {invoice.number}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {invoice.clientName || "—"} ·{" "}
              {formatDate(invoice.issueDate || "")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 h-8 flex items-center rounded-lg text-xs font-bold border ${(invoiceStatusColors as any)[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}
          >
            {(invoiceStatusLabels as any)[status] || status}
          </span>
          <Link href={`/facturi-emise-nou/${invoice.id}`}>
            <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.97]">
              Editează
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Client Info */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Client
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {invoice.clientName || "—"}
            </div>
            {invoice.clientCUI && (
              <div className="text-xs text-slate-500">
                CUI: {invoice.clientCUI}
              </div>
            )}
          </div>
        </div>

        {/* Invoice Info */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Detalii Factură
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Număr:</span>
              <span className="text-slate-900 dark:text-white font-mono">
                {invoice.series} {invoice.number}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dată:</span>
              <span className="text-slate-900 dark:text-white font-medium">
                {formatDate(invoice.issueDate || "")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Scadență:</span>
              <span className="text-slate-900 dark:text-white font-medium">
                {formatDate(invoice.dueDate || "")}
              </span>
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 font-bold">Stare SPV:</span>
              <span className="text-slate-900 dark:text-white font-bold">
                {invoice.spvStatus || "Netrimisă"}
              </span>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Totaluri
            </span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal:</span>
              <span className="text-slate-900 dark:text-white font-medium">
                {formatCurrency(
                  parseFloat(String(invoice.subtotal)),
                  invoice.currency as any
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TVA:</span>
              <span className="text-slate-900 dark:text-white font-medium">
                {formatCurrency(
                  parseFloat(String(invoice.totalVAT)),
                  invoice.currency as any
                )}
              </span>
            </div>
            <div className="flex justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">
                Total:
              </span>
              <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                {formatCurrency(
                  parseFloat(String(invoice.total)),
                  invoice.currency as any
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PDF-uri: Factură + Deviz unul lângă celălalt */}
      <div
        className={`flex gap-4 ${linkedDeviz ? "flex-row items-start" : "flex-col"}`}
      >
        {/* Factură PDF */}
        <div
          className={`bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col ${linkedDeviz ? "flex-1 min-w-0" : "w-full"}`}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Factură PDF
              </h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  window.open(
                    `/api/pdf/emitted/${invoice.id}?download=1`,
                    "_blank"
                  )
                }
                className="px-3 h-7 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50"
              >
                Descarcă
              </button>
              {(!invoice.spvStatus ||
                invoice.spvStatus === "nesincronizat" ||
                invoice.spvStatus === "eroare") && (
                <button
                  onClick={() => sendToSpv.mutate({ id: invoice.id })}
                  disabled={sendToSpv.isPending}
                  className="flex items-center gap-1.5 px-3 h-7 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  {sendToSpv.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Trimite SPV
                </button>
              )}
              {(invoice.spvStatus === "in_procesare" || invoice.spvStatus === "eroare") && (
                <button
                  onClick={() => checkSpvStatus.mutate({ id: invoice.id })}
                  disabled={checkSpvStatus.isPending}
                  className={`flex items-center gap-1.5 px-3 h-7 text-xs font-bold rounded-lg text-white transition-colors ${
                    invoice.spvStatus === "eroare"
                      ? "bg-rose-500 hover:bg-rose-600"
                      : "bg-amber-500 hover:bg-amber-600"
                  }`}
                >
                  {checkSpvStatus.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Verifică Status ANAF
                </button>
              )}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3">
            <iframe
              src={`/api/pdf/emitted/${invoice.id}`}
              className="w-full h-[550px] border border-slate-200 dark:border-slate-700 bg-white"
              title="PDF Viewer"
            />
          </div>
        </div>

        {/* Deviz PDF (dacă există) */}
        {linkedDeviz && (
          <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-sky-200 dark:border-sky-800 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-sky-100 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-500" />
                <h2 className="text-sm font-bold text-sky-900 dark:text-sky-300">
                  Deviz {linkedDeviz.deviz.number}
                </h2>
                <span className="text-xs text-sky-600 dark:text-sky-400">
                  {Number(linkedDeviz.deviz.total).toFixed(2)} RON
                </span>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/api/pdf/deviz/${linkedDeviz.deviz.id}?download=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 h-7 text-xs font-bold rounded-lg border border-sky-200 dark:border-sky-700 bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descarcă
                </a>
                <a
                  href={`/api/pdf/deviz/${linkedDeviz.deviz.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 h-7 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Tab nou
                </a>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3">
              <iframe
                src={`/api/pdf/deviz/${linkedDeviz.deviz.id}`}
                className="w-full h-[550px] border border-slate-200 dark:border-slate-700 bg-white"
                title="Deviz PDF Viewer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
