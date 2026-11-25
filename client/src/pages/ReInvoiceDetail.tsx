import {
  ArrowLeft,
  FileText,
  Building2,
  Hash,
  Coins,
  Loader2,
  Download,
  Mail,
  Send,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle2,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  invoiceStatusLabels,
  invoiceStatusColors,
} from "@/lib/store";
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
    onError: err => {
      toast.error(err.message || "Eroare la trimiterea în SPV");
    },
  });

  const checkSpvStatus = trpc.reinvoice.checkSpvStatus.useMutation({
    onSuccess: res => {
      if (res.status === "validat") {
        toast.success("Factura a fost validată cu succes în SPV!");
      } else if (res.status === "eroare") {
        toast.error(
          `ANAF a respins factura: ${res.errors?.join("; ") || res.stare}`
        );
      } else {
        toast.info(`Status ANAF: ${res.stare || "în prelucrare"}`);
      }
      utils.reinvoice.getById.invalidate({ id: invoiceId });
    },
    onError: err => {
      toast.error(err.message || "Eroare la verificarea statusului SPV");
    },
  });

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiat în clipboard`);
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#6e6e73]" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <div className="apple-surface p-8 text-center space-y-4">
          <FileText className="w-10 h-10 text-[#8e8e93] mx-auto" />
          <p className="text-[14px] font-medium text-[#6e6e73] dark:text-[#98989d]">
            Re-factura nu a fost găsită.
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

  const total = parseFloat(String(invoice.total || "0"));
  const totalVAT = parseFloat(String(invoice.totalVAT || "0"));
  const subtotal = parseFloat(String(invoice.subtotal || "0"));
  const currency = (invoice.currency || "RON") as any;
  const status = (invoice.status || "pending") as any;
  const pdfUrl = `/api/pdf/reinvoice/${invoiceId}`;
  const needsSpvSend =
    !invoice.spvStatus ||
    invoice.spvStatus === "nesincronizat" ||
    invoice.spvStatus === "eroare";

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4">
      {/* Top Floating Apple Glass Action Bar */}
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
              <span>Re-Factură emisă</span>
              <span>·</span>
              <span className="truncate max-w-[240px]">{invoice.clientName || "—"}</span>
              <span>·</span>
              <span className="tabular-nums">{formatDate(invoice.issueDate || "")}</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
              <h1 className="text-[20px] sm:text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.024em] leading-tight tabular-nums">
                Re-Factură {invoice.number}
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
          <a
            href={`${pdfUrl}?download=1`}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descarcă PDF</span>
          </a>

          {(invoice.spvStatus === "in_procesare" ||
            invoice.spvStatus === "eroare") && (
            <button
              type="button"
              onClick={() => checkSpvStatus.mutate({ id: invoiceId })}
              disabled={checkSpvStatus.isPending}
              className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold cursor-pointer"
            >
              {checkSpvStatus.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Verifică Status ANAF</span>
            </button>
          )}

          {invoice.spvStatus === "validat" && (
            <span className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 text-[12px] font-semibold border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Validată SPV</span>
            </span>
          )}

          {needsSpvSend ? (
            <>
              <a
                href={`mailto:${invoice.clientEmail || ""}?subject=Factura ${invoice.number}&body=Regăsiți atașată re-factura ${invoice.number}.`}
                className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Trimite pe Email</span>
              </a>
              <button
                type="button"
                onClick={() => sendToSpv.mutate({ id: invoiceId })}
                disabled={sendToSpv.isPending}
                className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-white text-[12.5px] font-semibold disabled:opacity-60 cursor-pointer"
              >
                {sendToSpv.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Trimite în SPV</span>
              </button>
            </>
          ) : (
            <a
              href={`mailto:${invoice.clientEmail || ""}?subject=Factura ${invoice.number}&body=Regăsiți atașată re-factura ${invoice.number}.`}
              className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-[12.5px] font-semibold text-white"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Trimite pe Email</span>
            </a>
          )}
        </div>
      </div>

      {/* SPV Error Callout */}
      {invoice.spvStatus === "eroare" && invoice.spvError && (
        <div className="apple-surface border-[#ff3b30]/25 bg-[#ff3b30]/[0.05] p-4 flex gap-3 text-[#d70015] dark:text-[#ff6961]">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-[13px] min-w-0">
            <h4 className="font-semibold mb-1">Eroare validare SPV ANAF</h4>
            <p className="whitespace-pre-wrap tabular-nums text-[12px] opacity-90 break-words">
              {invoice.spvError}
            </p>
          </div>
        </div>
      )}

      {/* 3 Apple Inspector Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Card 1: Hero Financial Summary */}
        <div className="apple-surface p-5 flex flex-col justify-between tabular-nums">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                Total re-facturat
              </span>
              <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                <Coins className="w-3.5 h-3.5 text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </span>
            </div>
            <div
              className={`text-[26px] sm:text-[28px] font-bold tracking-[-0.03em] leading-none mt-2 ${
                total < 0
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
                Subtotal (fără TVA)
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

        {/* Card 2: Client */}
        <div className="apple-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                Client / Destinatar
              </span>
              <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
              </span>
            </div>
            <div className="text-[15.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] leading-snug">
              {invoice.clientName || "—"}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
            <div className="apple-inspector-row text-[12.5px] tabular-nums">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Cod fiscal (CUI)</span>
              {invoice.clientCUI ? (
                <button
                  type="button"
                  onClick={() => copyToClipboard(String(invoice.clientCUI), "CUI")}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] cursor-pointer"
                >
                  <span>{invoice.clientCUI}</span>
                  <Copy className="w-3 h-3 text-[#8e8e93]" />
                </button>
              ) : (
                <span className="text-[#8e8e93]">—</span>
              )}
            </div>
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Adresă</span>
              <span className="text-[#1d1d1f] dark:text-[#ebebf5] font-medium text-right truncate max-w-[200px]">
                {invoice.clientAddress
                  ? `${invoice.clientAddress}${invoice.clientCity ? `, ${invoice.clientCity}` : ""}`
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Detalii & Factură Sursă */}
        <div className="apple-surface p-5 flex flex-col justify-between tabular-nums">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
              Detalii & Sursă
            </span>
            <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Hash className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
            </span>
          </div>

          <div>
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Număr</span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {invoice.number || "—"}
              </span>
            </div>
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Emitere / Scadență</span>
              <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatDate(invoice.issueDate || "")}
                {invoice.dueDate ? ` · ${formatDate(invoice.dueDate)}` : ""}
              </span>
            </div>
            {invoice.sourceInvoiceNumber && (
              <div className="apple-inspector-row text-[12.5px]">
                <span className="text-[#6e6e73] dark:text-[#98989d] shrink-0">
                  Din factura
                </span>
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7] text-right truncate max-w-[190px]">
                  {invoice.sourceInvoiceNumber}
                  {invoice.sourceSupplierName ? ` (${invoice.sourceSupplierName})` : ""}
                </span>
              </div>
            )}
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Stare RO e-Factura</span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {invoice.spvStatus === "validat"
                  ? "Validată"
                  : invoice.spvStatus === "in_procesare"
                    ? "În procesare"
                    : invoice.spvStatus === "eroare"
                      ? "Eroare"
                      : "Netrimisă"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* macOS Quick Look Document Stage */}
      <div className="apple-surface overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa]/90 dark:bg-white/[0.025] flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5 text-[#1d1d1f] dark:text-[#f5f5f7]" />
            </span>
            <h2 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Previzualizare Re-Factură PDF
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Tab nou</span>
            </a>
            <a
              href={`${pdfUrl}?download=1`}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descarcă</span>
            </a>
            <a
              href={`mailto:${invoice.clientEmail || ""}?subject=Factura ${invoice.number}&body=Regăsiți atașată re-factura ${invoice.number}.`}
              className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Trimite pe Email</span>
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
              className="w-full min-w-[780px] sm:min-w-full h-[78vh] min-h-[680px] border-0 bg-white"
              title={`Re-Factură ${invoice.number}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
