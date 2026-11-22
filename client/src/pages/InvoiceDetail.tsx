// InvoiceDetail — date reale din DB (zero mock-uri)
import { useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
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
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const invoiceId = parseInt(id || "0");

  const { data: invoice, isLoading: isArchiveLoading } = trpc.invoiceArchive.getById.useQuery(
    { id: invoiceId },
    { enabled: !!id && !isNaN(invoiceId) }
  );

  const { data: nirList = [] } = trpc.nir.list.useQuery();

  const { data: emittedInv, isLoading: isEmittedLoading } = trpc.emittedInvoice.getById.useQuery(
    { id: invoiceId },
    { enabled: !!id && !isNaN(invoiceId) && !invoice && !isArchiveLoading }
  );

  // Dacă ID-ul aparține unei facturi emise direct în aplicație, redirecționăm către vizualizarea dedicată
  useEffect(() => {
    if (!isArchiveLoading && !invoice && emittedInv) {
      navigate(`/facturi-emise-nou/view/${invoiceId}`, { replace: true });
    }
  }, [isArchiveLoading, invoice, emittedInv, invoiceId, navigate]);

  const markAsRead = trpc.invoiceArchive.markAsRead.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (invoice && !(invoice as any).isRead) {
      markAsRead.mutate(
        { id: invoiceId },
        {
          onSuccess: () => {
            utils.invoiceArchive.list.invalidate();
          },
        }
      );
    }
  }, [invoice?.id, (invoice as any)?.isRead]);

  if (isArchiveLoading || (isEmittedLoading && !invoice)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!invoice && !emittedInv) {
    return (
      <div className="p-8 text-center">
        <div className="text-slate-500">Factura nu a fost găsită.</div>
        <button
          onClick={() => window.history.back()}
          className="mt-4 px-5 h-10 rounded-full bg-blue-600 text-white text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors"
        >
          ← Înapoi
        </button>
      </div>
    );
  }

  if (!invoice) return null;

  const isEmitted = invoice.direction === "out";
  const total = parseFloat(String(invoice.total || "0"));
  const totalVAT = parseFloat(String(invoice.totalVAT || "0"));
  const subtotal = total - totalVAT;
  const currency = (invoice.currency || "RON") as any;
  const isStorno = total < 0;
  const status = isStorno ? "storno" : ((invoice.status || "pending") as any);
  const source = (invoice.source || "other") as any;
  const spvIndex =
    (invoice as any).spvIndex ||
    (invoice.fileName ? invoice.fileName.match(/SPV_(\d+)/i)?.[1] : null) ||
    (invoice.notes ? invoice.notes.match(/index\s*(?:incarcare|spv)?[:\s]+(\d+)/i)?.[1] : null);

  const existingNir = (Array.isArray(nirList) ? nirList : []).find(
    (n: any) =>
      Number(n.invoiceArchiveId) === invoiceId ||
      (invoice?.invoiceNumber &&
        n.invoiceNumber &&
        String(n.invoiceNumber).trim().toLowerCase() === String(invoice.invoiceNumber).trim().toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center justify-center w-8 h-8 rounded-full apple-btn-glass border border-black/[0.06] dark:border-white/[0.09] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#3a3a3c] dark:text-[#ebebf5]" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#1d1d1f] dark:text-white tracking-tight tabular-nums">
              Factură {isEmitted ? "emisă " : ""}{invoice.invoiceNumber || `#${invoice.id}`}
            </h1>
            <p className="text-sm text-[#636366] dark:text-[#98989d] mt-0.5 tabular-nums">
              {isEmitted ? "Client: " : "Furnizor: "}
              {invoice.supplierName || "—"} ·{" "}
              {formatDate(invoice.issueDate || "")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-3 h-8 flex items-center rounded-full text-xs font-bold border ${(invoiceStatusColors as any)[status] || "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"}`}
          >
            {(invoiceStatusLabels as any)[status] || status}
          </span>
          {isEmitted ? (
            <div className="flex items-center gap-1.5">
              <span className="px-3 h-8 flex items-center rounded-full text-xs font-bold bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                Factură Emisă (SPV)
              </span>
              {spvIndex && (
                <span className="px-3 h-8 flex items-center rounded-full text-xs tabular-nums font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Index SPV: {spvIndex}
                </span>
              )}
            </div>
          ) : (
            <>
              {existingNir ? (
                <Link href={`/nir/edit/${existingNir.id}`}>
                  <button
                    type="button"
                    style={{ backgroundColor: "var(--tenant-theme-color, #16a34a)" }}
                    className="flex items-center gap-1.5 px-3.5 h-8 rounded-full text-white text-xs font-bold shadow-sm transition-all hover:brightness-90 active:scale-[0.97] cursor-pointer tabular-nums"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Vezi NIR ({existingNir.nirNumber})</span>
                  </button>
                </Link>
              ) : (
                <Link href={`/nir/nou/${invoice.id}`}>
                  <button
                    type="button"
                    style={{ backgroundColor: "var(--tenant-theme-color, #16a34a)" }}
                    className="flex items-center gap-1.5 px-3.5 h-8 rounded-full text-white text-xs font-bold shadow-sm transition-all hover:brightness-90 active:scale-[0.97] cursor-pointer"
                  >
                    Creează NIR
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              )}
              <Link href={`/re-facturare/${invoice.id}`}>
                <button
                  type="button"
                  style={{ backgroundColor: "var(--tenant-theme-color, #16a34a)" }}
                  className="flex items-center gap-1.5 px-3.5 h-8 rounded-full text-white text-xs font-bold shadow-sm transition-all hover:brightness-90 active:scale-[0.97] cursor-pointer"
                >
                  Re-facturează
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Informatii unificate intr-un singur card */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] shadow-sm border border-black/[0.06] dark:border-white/[0.09] p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.06] dark:divide-white/[0.08]">
          
          <div className="pt-0 sm:px-4 first:px-0 flex flex-col gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">
              {isEmitted ? "Client / Cumpărător" : "Furnizor"}
            </span>
            <div className="text-sm font-bold text-[#1d1d1f] dark:text-white mt-1">
              {invoice.supplierName || "—"}
            </div>
            {invoice.supplierCUI && (
              <div className="text-xs text-[#636366] dark:text-[#98989d] tabular-nums">CUI: {invoice.supplierCUI}</div>
            )}
            <div className="mt-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-block ${(sourceColors as any)[source] || "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"}`}>
                {isEmitted ? "Tip: Emisă SPV" : `Sursă: ${source}`}
              </span>
            </div>
          </div>

          <div className="pt-4 sm:pt-0 sm:px-4 flex flex-col gap-1 tabular-nums">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">Date Factură</span>
            <div className="text-xs space-y-1.5 mt-1">
              <div className="flex justify-between sm:block sm:mb-1"><span className="text-[#636366] dark:text-[#98989d] sm:hidden">Număr:</span> <span className="font-semibold text-[#1d1d1f] dark:text-white">#{invoice.invoiceNumber || invoice.id}</span></div>
              <div className="flex justify-between sm:block sm:mb-1"><span className="text-[#636366] dark:text-[#98989d] sm:hidden">Emisă:</span> <span className="text-[#3a3a3c] dark:text-[#ebebf5]"><span className="hidden sm:inline">Emisă: </span>{formatDate(invoice.issueDate || "")}</span></div>
              <div className="flex justify-between sm:block sm:mb-1"><span className="text-[#636366] dark:text-[#98989d] sm:hidden">Scadență:</span> <span className="text-[#3a3a3c] dark:text-[#ebebf5]"><span className="hidden sm:inline">Scad: </span>{formatDate(invoice.dueDate || "")}</span></div>
              {spvIndex && (
                <div className="flex justify-between sm:block sm:mb-1">
                  <span className="text-[#636366] dark:text-[#98989d] sm:hidden">Index SPV:</span>{" "}
                  <span className="text-[#3a3a3c] dark:text-[#ebebf5] tabular-nums">
                    <span className="hidden sm:inline">Index SPV: </span>{spvIndex}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 sm:pt-0 sm:px-4 flex flex-col gap-1 tabular-nums">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">Totaluri</span>
            <div className="text-xs space-y-2 mt-1">
              <div className="flex justify-between"><span className="text-[#636366] dark:text-[#98989d]">Subtotal:</span> <span className="text-[#1d1d1f] dark:text-white font-medium">{formatCurrency(subtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-[#636366] dark:text-[#98989d]">TVA:</span> <span className="text-[#1d1d1f] dark:text-white font-medium">{formatCurrency(totalVAT, currency)}</span></div>
              <div className="flex justify-between border-t border-black/[0.06] dark:border-white/[0.08] pt-2"><span className="font-bold text-[#1d1d1f] dark:text-white uppercase text-[10.5px] tracking-wider">Total:</span> <span className="font-black text-blue-600 dark:text-blue-400 text-sm">{formatCurrency(total, currency)}</span></div>
            </div>
          </div>

        </div>
      </div>

      {/* PDF View / Actions */}
      {(() => {
        // Determine PDF URL — either stored file or on-demand ANAF conversion
        const isSpv = invoice.source === "spv_anaf";
        const hasPdf =
          isSpv || (invoice.fileUrl && invoice.fileUrl !== "spv_import") || !!invoice.rawXml;
        const pdfUrl = (isSpv || invoice.rawXml)
          ? `/api/pdf/archive/${invoiceId}`
          : invoice.fileUrl;

        if (pdfUrl) {
          return (
            <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] shadow-sm border border-black/[0.06] dark:border-white/[0.09] flex flex-col h-[85vh] md:h-[800px] overflow-hidden">
              <div className="flex items-center justify-between p-3.5 border-b border-black/[0.06] dark:border-white/[0.08] bg-[#f8f9fc]/85 dark:bg-white/[0.02] flex-wrap gap-2">
                <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#636366] dark:text-[#98989d]" />
                  <span className="hidden sm:inline">Vizualizare Factură PDF</span>
                  <span className="inline sm:hidden">Factură PDF</span>
                  {!hasPdf && (
                    <span className="text-[10px] font-medium text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 whitespace-nowrap">
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
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 h-8 rounded-full apple-btn-glass text-[#3a3a3c] dark:text-[#ebebf5] text-xs font-bold transition-colors"
                  >
                    Descarcă
                  </a>
                  <a
                    href={`mailto:?subject=Factura ${invoice.invoiceNumber}&body=Regăsiți atașată factura ${invoice.invoiceNumber}.`}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
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
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] shadow-sm border border-black/[0.06] dark:border-white/[0.09] p-8 text-center">
            <FileText className="w-10 h-10 text-[#636366]/50 dark:text-[#98989d]/50 mx-auto mb-3" />
            <p className="text-sm font-semibold text-[#636366] dark:text-[#98989d]">
              Fișierul PDF nu este disponibil pentru această factură.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
