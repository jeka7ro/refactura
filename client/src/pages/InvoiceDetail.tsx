// InvoiceDetail — Apple HIG Inspector & Quick Look Document Stage (date reale din DB, zero mock-uri)
import { useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  FileText,
  Building2,
  Hash,
  Coins,
  Loader2,
  Download,
  ExternalLink,
  Mail,
  Send,
  Copy,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  invoiceStatusLabels,
  invoiceStatusColors,
  sourceColors,
} from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiat în clipboard`);
  };

  if (isArchiveLoading || (isEmittedLoading && !invoice)) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#6e6e73]" />
      </div>
    );
  }

  if (!invoice && !emittedInv) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <div className="apple-surface p-8 text-center space-y-4">
          <FileText className="w-10 h-10 text-[#8e8e93] mx-auto" />
          <p className="text-[14px] font-medium text-[#6e6e73] dark:text-[#98989d]">
            Factura nu a fost găsită.
          </p>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="apple-btn-prominent px-5 h-9 rounded-full text-white text-[13px] font-semibold cursor-pointer"
          >
            ← Înapoi
          </button>
        </div>
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

  const isSpv = invoice.source === "spv_anaf";
  const hasPdf =
    isSpv || (invoice.fileUrl && invoice.fileUrl !== "spv_import") || !!invoice.rawXml;
  const pdfUrl =
    isSpv || invoice.rawXml ? `/api/pdf/archive/${invoiceId}` : invoice.fileUrl;

  const sourceLabel =
    source === "spv_anaf"
      ? "SPV ANAF"
      : source === "oblio"
        ? "Oblio"
        : source === "smartbill"
          ? "SmartBill"
          : source === "manual"
            ? "Manual"
            : String(source);

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4">
      {/* Top Floating Apple Glass Action Bar (Functional Layer — 1 Prominent CTA, Monochrome Secondary Capsules) */}
      <div className="apple-glass rounded-[22px] px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Înapoi"
            onClick={() => window.history.back()}
            className="apple-btn-glass flex items-center justify-center w-9 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
              <span>{isEmitted ? "Factură emisă · Arhivă SPV" : "Factură primită"}</span>
              <span>·</span>
              <span>{sourceLabel}</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
              <h1 className="text-[20px] sm:text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.024em] leading-tight tabular-nums">
                Factură {invoice.invoiceNumber || `#${invoice.id}`}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border leading-tight ${
                  (invoiceStatusColors as any)[status] ||
                  "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                {(invoiceStatusLabels as any)[status] || status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pdfUrl && (
            <a
              href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descarcă PDF</span>
            </a>
          )}

          {isEmitted ? (
            <div className="flex items-center gap-2">
              <span className="px-3 h-9 inline-flex items-center rounded-full text-[12px] font-medium bg-violet-500/10 text-violet-700 dark:bg-violet-500/18 dark:text-violet-300 border border-violet-500/20">
                Factură Emisă (SPV)
              </span>
              {spvIndex && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(String(spvIndex), "Index SPV")}
                  className="apple-btn-glass px-3 h-9 inline-flex items-center gap-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums cursor-pointer"
                  title="Copiază Indexul SPV"
                >
                  <span>SPV #{spvIndex}</span>
                  <Copy className="w-3 h-3 text-[#8e8e93]" />
                </button>
              )}
            </div>
          ) : (
            <>
              <Link href={`/re-facturare/${invoice.id}`}>
                <button
                  type="button"
                  className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Re-facturează</span>
                </button>
              </Link>

              {existingNir ? (
                <Link href={`/nir/edit/${existingNir.id}`}>
                  <button
                    type="button"
                    className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-white text-[12.5px] font-semibold cursor-pointer tabular-nums"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Vezi NIR ({existingNir.nirNumber})</span>
                  </button>
                </Link>
              ) : (
                <Link href={`/nir/nou/${invoice.id}`}>
                  <button
                    type="button"
                    className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-white text-[12.5px] font-semibold cursor-pointer"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Creează NIR</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Apple Inspector 3-Card Summary Strip (Opaque Content Layer) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Card 1: Hero Financial Summary (Apple Wallet Style) */}
        <div className="apple-surface p-5 flex flex-col justify-between tabular-nums">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                {isEmitted ? "Total facturat" : "Total de plată"}
              </span>
              <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                <Coins className="w-3.5 h-3.5 text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </span>
            </div>
            <div
              className={`text-[26px] sm:text-[28px] font-bold tracking-[-0.03em] leading-none mt-2 ${
                isStorno
                  ? "text-[#ff3b30] dark:text-[#ff453a]"
                  : "text-[#1d1d1f] dark:text-[#f5f5f7]"
              }`}
            >
              {formatCurrency(total, currency)}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">
                Bază impozabilă (fără TVA)
              </span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">TVA</span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatCurrency(totalVAT, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Partner Inspector */}
        <div className="apple-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                {isEmitted ? "Client / Cumpărător" : "Furnizor / Emitent"}
              </span>
              <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
              </span>
            </div>
            <div className="text-[15.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] leading-snug">
              {invoice.supplierName || "—"}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
            <div className="apple-inspector-row text-[12.5px] tabular-nums">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Cod fiscal (CUI)</span>
              {invoice.supplierCUI ? (
                <button
                  type="button"
                  onClick={() => copyToClipboard(String(invoice.supplierCUI), "CUI")}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] dark:hover:text-[#0a84ff] cursor-pointer"
                  title="Copiază CUI"
                >
                  <span>{invoice.supplierCUI}</span>
                  <Copy className="w-3 h-3 text-[#8e8e93]" />
                </button>
              ) : (
                <span className="text-[#8e8e93]">—</span>
              )}
            </div>
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Canal recepție</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border leading-none ${
                  (sourceColors as any)[source] ||
                  "bg-[#f2f2f7] text-[#3a3a3c] border-black/[0.06] dark:bg-[#2c2c2e] dark:text-[#ebebf5] dark:border-white/[0.08]"
                }`}
              >
                {isEmitted ? "Emisă SPV" : sourceLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Fiscal Metadata & SPV Traceability */}
        <div className="apple-surface p-5 flex flex-col justify-between tabular-nums">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
              Detalii & Trasabilitate
            </span>
            <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Hash className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
            </span>
          </div>

          <div>
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Număr factură</span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {invoice.invoiceNumber || `#${invoice.id}`}
              </span>
            </div>
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Data emiterii</span>
              <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatDate(invoice.issueDate || "")}
              </span>
            </div>
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Data scadenței</span>
              <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
              </span>
            </div>
            {spvIndex && (
              <div className="apple-inspector-row text-[12.5px]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">Index SPV ANAF</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(String(spvIndex), "Index SPV")}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] dark:hover:text-[#0a84ff] cursor-pointer"
                  title="Copiază Index SPV"
                >
                  <span>{spvIndex}</span>
                  <Copy className="w-3 h-3 text-[#8e8e93]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* macOS Quick Look / Preview Document Stage */}
      {pdfUrl ? (
        <div className="apple-surface overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa]/90 dark:bg-white/[0.025] flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5 text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </span>
              <h2 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Previzualizare Factură PDF
              </h2>
              {!hasPdf && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-700 dark:bg-violet-500/18 dark:text-violet-300">
                  Generat din XML ANAF
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Deschide în tab nou</span>
              </a>
              <a
                href={`${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descarcă</span>
              </a>
              <a
                href={`mailto:?subject=Factura ${invoice.invoiceNumber}&body=Regăsiți atașată factura ${invoice.invoiceNumber}.`}
                className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Trimite</span>
              </a>
            </div>
          </div>

          <div
            className="apple-doc-stage p-3 sm:p-5 overflow-x-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="apple-doc-paper overflow-hidden max-w-5xl mx-auto">
              <iframe
                src={`${pdfUrl}#view=FitH`}
                className="border-0 bg-white w-full min-w-[780px] sm:min-w-full h-[78vh] min-h-[680px]"
                title="Factura PDF"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="apple-surface p-10 text-center space-y-2">
          <FileText className="w-9 h-9 text-[#8e8e93] mx-auto" />
          <p className="text-[13.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
            Fișierul PDF nu este disponibil pentru această factură.
          </p>
        </div>
      )}
    </div>
  );
}
