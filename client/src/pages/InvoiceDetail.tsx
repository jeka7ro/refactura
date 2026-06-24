// InvoiceDetail — date reale din DB (zero mock-uri)
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, FileText, Building2, Calendar, Hash, Globe, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, invoiceStatusLabels, invoiceStatusColors, sourceColors } from "@/lib/store";
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
          <button className="mt-4 px-5 h-10 rounded-full bg-blue-600 text-white text-sm font-bold">← Înapoi</button>
        </Link>
      </div>
    );
  }

  const total = parseFloat(String(invoice.total || "0"));
  const totalVAT = parseFloat(String(invoice.totalVAT || "0"));
  const subtotal = total - totalVAT;
  const currency = (invoice.currency || "RON") as any;
  const isStorno = total < 0;
  const status = isStorno ? "storno" : (invoice.status || "pending") as any;
  const source = (invoice.source || "other") as any;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/facturi-primite">
            <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Factură {invoice.invoiceNumber || `#${invoice.id}`}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {invoice.supplierName || "—"} · {formatDate(invoice.issueDate || "")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 h-8 flex items-center rounded-lg text-xs font-bold border ${invoiceStatusColors[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
            {invoiceStatusLabels[status] || status}
          </span>
          <Link href={`/re-facturare/${invoice.id}`}>
            <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.97]">
              Re-facturează
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supplier Info */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Furnizor</span>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{invoice.supplierName || "—"}</div>
            {invoice.supplierCUI && <div className="text-xs text-slate-500">CUI: {invoice.supplierCUI}</div>}
          </div>
        </div>

        {/* Invoice Info */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Detalii Factură</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Număr:</span>
              <span className="text-slate-900 dark:text-white font-mono">{invoice.invoiceNumber || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dată:</span>
              <span className="text-slate-900 dark:text-white">{formatDate(invoice.issueDate || "")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Scadență:</span>
              <span className="text-slate-900 dark:text-white">{formatDate(invoice.dueDate || "")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sursă:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${(sourceColors as any)[source] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                {source}
              </span>
            </div>
            {invoice.fileUrl && invoice.fileUrl !== "spv_import" && (
              <div className="flex justify-between">
                <span className="text-slate-500">Fișier:</span>
                <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                  Descarcă PDF
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
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

      {/* PDF View / Actions */}
      {(() => {
        // Determine PDF URL — either stored file or on-demand ANAF conversion
        const isSpv = invoice.source === "spv_anaf";
        const hasPdf = isSpv || (invoice.fileUrl && invoice.fileUrl !== "spv_import");
        const pdfUrl = isSpv ? `/api/pdf/archive/${invoiceId}` : invoice.fileUrl;

        if (pdfUrl) {
          return (
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col h-[700px] overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Vizualizare Factură PDF
                  {!hasPdf && <span className="text-[10px] font-normal text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">via ANAF</span>}
                </h3>
                <div className="flex items-center gap-2">
                  <a
                    href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors"
                  >
                    Descarcă
                  </a>
                  <a
                    href={`mailto:?subject=Factura ${invoice.invoiceNumber}&body=Regăsiți atașată factura ${invoice.invoiceNumber}.`}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                  >
                    Trimite pe Email
                  </a>
                </div>
              </div>
              <iframe
                src={pdfUrl}
                className="w-full flex-1 bg-slate-100 dark:bg-slate-900/50"
                title="Factura PDF"
              />
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
