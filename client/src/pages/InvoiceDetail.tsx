// InvoiceDetail — date reale din DB (zero mock-uri)
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
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  invoiceStatusLabels,
  invoiceStatusColors,
  sourceColors,
} from "@/lib/store";
import { trpc } from "@/lib/trpc";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = parseInt(id || "0");

  const { data: invoice, isLoading } = trpc.invoiceArchive.getById.useQuery(
    { id: invoiceId },
    { enabled: !!id && !isNaN(invoiceId) }
  );

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
        <Link href="/facturi-primite">
          <button className="mt-4 px-5 h-10 rounded-full bg-blue-600 text-white text-sm font-bold">
            ← Înapoi
          </button>
        </Link>
      </div>
    );
  }

  const total = parseFloat(String(invoice.total || "0"));
  const totalVAT = parseFloat(String(invoice.totalVAT || "0"));
  const subtotal = total - totalVAT;
  const currency = (invoice.currency || "RON") as any;
  const isStorno = total < 0;
  const status = isStorno ? "storno" : ((invoice.status || "pending") as any);
  const source = (invoice.source || "other") as any;

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
              Factură {invoice.invoiceNumber || `#${invoice.id}`}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {invoice.supplierName || "—"} ·{" "}
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
          <Link href={`/re-facturare/${invoice.id}`}>
            <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.97]">
              Re-facturează
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </div>

      {/* Informatii unificate intr-un singur card */}
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          
          <div className="pt-0 sm:px-4 first:px-0 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Furnizor</span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              {invoice.supplierName || "—"}
            </div>
            {invoice.supplierCUI && (
              <div className="text-xs text-slate-500">CUI: {invoice.supplierCUI}</div>
            )}
            <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-800/50">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${(sourceColors as any)[source] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                Sursă: {source}
              </span>
            </div>
          </div>

          <div className="pt-4 sm:pt-0 sm:px-4 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date Factură</span>
            <div className="text-xs space-y-1.5 mt-1">
              <div className="flex justify-between sm:block sm:mb-1"><span className="text-slate-500 sm:hidden">Număr:</span> <span className="font-mono font-semibold text-slate-900 dark:text-white">#{invoice.invoiceNumber || invoice.id}</span></div>
              <div className="flex justify-between sm:block sm:mb-1"><span className="text-slate-500 sm:hidden">Emisă:</span> <span className="text-slate-600 dark:text-slate-300"><span className="hidden sm:inline">Emisă: </span>{formatDate(invoice.issueDate || "")}</span></div>
              <div className="flex justify-between sm:block sm:mb-1"><span className="text-slate-500 sm:hidden">Scadență:</span> <span className="text-slate-600 dark:text-slate-300"><span className="hidden sm:inline">Scad: </span>{formatDate(invoice.dueDate || "")}</span></div>
            </div>
          </div>

          <div className="pt-4 sm:pt-0 sm:px-4 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Totaluri</span>
            <div className="text-xs space-y-2 mt-1">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal:</span> <span className="text-slate-900 dark:text-white font-medium">{formatCurrency(subtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">TVA:</span> <span className="text-slate-900 dark:text-white font-medium">{formatCurrency(totalVAT, currency)}</span></div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2"><span className="font-bold text-slate-900 dark:text-white uppercase text-[10px] tracking-wider">Total:</span> <span className="font-black text-blue-600 text-sm">{formatCurrency(total, currency)}</span></div>
            </div>
          </div>

        </div>
      </div>

      {/* PDF View / Actions */}
      {(() => {
        // Determine PDF URL — either stored file or on-demand ANAF conversion
        const isSpv = invoice.source === "spv_anaf";
        const hasPdf =
          isSpv || (invoice.fileUrl && invoice.fileUrl !== "spv_import");
        const pdfUrl = isSpv
          ? `/api/pdf/archive/${invoiceId}`
          : invoice.fileUrl;

        if (pdfUrl) {
          return (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[85vh] md:h-[800px] overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-wrap gap-2">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Vizualizare Factură PDF</span>
                  <span className="inline sm:hidden">Factură PDF</span>
                  {!hasPdf && (
                    <span className="text-[10px] font-normal text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 whitespace-nowrap">
                      via ANAF
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors"
                  >
                    Descarcă
                  </a>
                  <a
                    href={`mailto:?subject=Factura ${invoice.invoiceNumber}&body=Regăsiți atașată factura ${invoice.invoiceNumber}.`}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                  >
                    Trimite
                  </a>
                </div>
              </div>
              {/* PDF Viewer (Mobile & Desktop) */}
              <div 
                className="w-full flex-1 bg-slate-100 dark:bg-slate-900/50 overflow-x-auto"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <iframe
                  src={`${pdfUrl}#view=FitH`}
                  className="border-0 bg-transparent w-full min-w-[800px] sm:min-w-full"
                  style={{ height: "100%", minHeight: "75vh" }}
                  title="Factura PDF"
                />
              </div>
            </div>
          );
        }

        return (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Fișierul PDF nu este disponibil pentru această factură.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
