import { useState, useEffect } from "react";
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
  Pencil,
  Mail,
  Eye,
  Lock,
  RotateCcw,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  invoiceStatusLabels,
  invoiceStatusColors,
} from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import SpvDeadlineBadge, { isSpvTransmitted } from "@/components/SpvDeadlineBadge";
import { isTransmittedInDeadline } from "@/lib/spvDeadline";
import { EditDevizModal } from "@/components/EditDevizModal";

function formatInvoiceNumber(series?: string | null, num?: string | null) {
  if (!num) return series || "";
  if (!series) return num;
  const s = series.trim();
  const n = num.trim();
  if (n.toUpperCase().startsWith(s.toUpperCase())) {
    return n;
  }
  return `${s} ${n}`;
}

function isExternalInvoice(inv: any) {
  if (inv?.spvStatus === "extern") return true;
  const country = (inv?.clientCountry || "").trim().toUpperCase();
  if (country && country !== "RO") return true;
  const cui = (inv?.clientCUI || "").trim().toUpperCase();
  if (cui && /^[A-Z]{2}/.test(cui) && !cui.startsWith("RO")) return true;
  const curr = (inv?.currency || "").trim().toUpperCase();
  if (curr && curr !== "RON" && curr !== "LEI") return true;
  return false;
}

export type SupportedLanguage = "ro" | "en" | "fr" | "nl" | "de" | "hu";

export const AVAILABLE_LANGUAGES: Array<{
  code: SupportedLanguage;
  name: string;
  flag: string;
}> = [
  { code: "ro", name: "Română", flag: "🇷🇴" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "hu", name: "Magyar", flag: "🇭🇺" },
];

export default function EmittedInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = parseInt(id || "0");

  const { data: invoice, isLoading } = trpc.emittedInvoice.getById.useQuery(
    { id: invoiceId },
    { enabled: !!id && !isNaN(invoiceId) }
  );

  // Deviz legat de aceasta factura (daca exista)
  const [isEditDevizOpen, setIsEditDevizOpen] = useState(false);
  const [devizTimestamp, setDevizTimestamp] = useState(Date.now());
  const { data: linkedDeviz, refetch: refetchDeviz } = trpc.devize.getByInvoiceId.useQuery(
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

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<SupportedLanguage[]>(["ro"]);

  // Set default languages when invoice loads
  useEffect(() => {
    if (invoice) {
      if (isExternalInvoice(invoice)) {
        const country = (invoice.clientCountry || "").toUpperCase().trim();
        if (country === "FR") setSelectedLanguages(["ro", "fr"]);
        else if (country === "BE") setSelectedLanguages(["ro", "nl"]);
        else if (country === "DE" || country === "AT" || country === "CH") setSelectedLanguages(["ro", "de"]);
        else if (country === "HU") setSelectedLanguages(["ro", "hu"]);
        else if (country === "NL") setSelectedLanguages(["ro", "nl"]);
        else setSelectedLanguages(["ro", "en"]);
      } else {
        setSelectedLanguages(["ro"]);
      }
    }
  }, [invoice?.id, invoice?.clientCountry, invoice?.spvStatus]);

  const toggleLanguage = (code: SupportedLanguage) => {
    setSelectedLanguages(prev => {
      if (prev.includes(code)) {
        // Dacă este deja selectată și sunt 2, o deselectăm lăsând 1 singură
        if (prev.length > 1) {
          return prev.filter(c => c !== code);
        }
        // Dacă e singura selectată, nu permitem deselectarea la 0 limbi
        return prev;
      }
      // Dacă sunt mai puțin de 2 selectate, o adăugăm
      if (prev.length < 2) {
        return [...prev, code];
      }
      // Dacă sunt deja 2 selectate, o înlocuim pe a doua
      return [prev[0], code];
    });
  };

  // Email logs & previzualizare email expediat
  const [viewSentEmailModal, setViewSentEmailModal] = useState(false);
  const { data: invoiceEmailLogs, refetch: refetchEmailLogs } = trpc.emailLogs.getByInvoiceId.useQuery(
    { invoiceId },
    { enabled: !!invoiceId && !isNaN(invoiceId) }
  );
  const latestEmailLog = invoiceEmailLogs?.[0];

  const { data: sentEmailPreviewData, isLoading: isSentEmailLoading } = trpc.emailLogs.getPreview.useQuery(
    {
      logId: latestEmailLog?.id,
      invoiceId,
    },
    { enabled: Boolean(viewSentEmailModal && (latestEmailLog?.id || invoiceId)) }
  );

  const { data: emailPreviewData, isLoading: isEmailPreviewLoading } = trpc.emailLogs.getPreview.useQuery(
    {
      invoiceId: invoice?.id,
      representativeName: representativeName.trim() || undefined,
      languages: selectedLanguages,
    },
    { enabled: Boolean(showEmailModal && showEmailPreview && invoice?.id) }
  );

  const sendEmailMutation = trpc.emittedInvoice.sendEmail.useMutation({
    onSuccess: res => {
      toast.success(`Factura a fost trimisă cu succes pe email la ${res.recipient}!`);
      setShowEmailModal(false);
      setShowEmailPreview(false);
      refetchEmailLogs();
    },
    onError: e => toast.error("Eroare trimitere email: " + e.message),
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
  const isSpvValidated = invoice.spvStatus === "validat" || Boolean(invoice.spvIndex);

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
              Factură {formatInvoiceNumber(invoice.series, invoice.number)}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {invoice.clientName || "—"} ·{" "}
              {formatDate(invoice.issueDate || "")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2.5 h-8 flex items-center rounded-lg text-xs font-bold border ${(invoiceStatusColors as any)[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}
          >
            {(invoiceStatusLabels as any)[status] || status}
          </span>
          <button
            onClick={() => {
              setEmailRecipient(invoice.clientEmail || "");
              const match = (invoice.notes || "").match(/(?:delegat|reprezentant|persoan[aă] de contact)\s*:\s*([^\n\r(]+)/i);
              setRepresentativeName(match && match[1] ? match[1].trim() : "");
              setShowEmailModal(true);
            }}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.97]"
          >
            <Mail className="w-3.5 h-3.5" />
            Trimite pe Email
          </button>
          {isSpvValidated ? (
            <>
              <div
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold select-none shadow-sm cursor-default"
                title="Conform legislației fiscale (OUG 120/2021 și Codul Fiscal art. 330), documentul a fost validat în SPV și nu mai poate fi modificat. Pentru corecții, emiteți o factură de stornare."
              >
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>🔒 Blocată la editare (Document oficial înregistrat în SPV)</span>
              </div>
              <Link href={`/facturi-emise-nou/storno/${invoice.id}`}>
                <button
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.97]"
                  title="Emite o factură de stornare (cu valori negative) conform legii fiscale"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Stornează Factura
                </button>
              </Link>
            </>
          ) : (
            <Link href={`/facturi-emise-nou/${invoice.id}`}>
              <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.97]">
                Editează Factura
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          )}
          {linkedDeviz && !isSpvValidated && (
            <button
              onClick={() => setIsEditDevizOpen(true)}
              className="flex items-center gap-1.5 px-3.5 h-8 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.97]"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editează Deviz
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Client Info */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Client
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between gap-2">
              <span>{invoice.clientName || "—"}</span>
              {invoice.clientCode && (
                <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-mono font-bold">
                  Cod SAGA: {invoice.clientCode}
                </span>
              )}
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
              <span className="text-slate-900 dark:text-white font-medium">
                {formatInvoiceNumber(invoice.series, invoice.number)}
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
                {isExternalInvoice(invoice) ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    Extern (D390)
                  </span>
                ) : invoice.spvStatus === "validat" ? (
                  <span className="text-emerald-600 font-bold">Validată</span>
                ) : invoice.spvStatus === "eroare" ? (
                  <span className="text-rose-600 font-bold">Eroare</span>
                ) : invoice.spvStatus === "in_procesare" ? (
                  <span className="text-blue-600 font-bold">Trimisă</span>
                ) : (
                  invoice.spvStatus || "Netrimisă"
                )}
              </span>
            </div>
            {(invoice.spvSentAt || (invoice.spvIndex && (invoice.updatedAt || invoice.createdAt))) && (
              <div className="flex justify-between">
                <span className="text-slate-500">Data Transmisă:</span>
                {(() => {
                  const d = invoice.spvSentAt || invoice.updatedAt || invoice.createdAt;
                  const inTermen = isTransmittedInDeadline(invoice.issueDate, d);
                  return (
                    <span className={`font-medium ${inTermen ? "text-emerald-600 dark:text-emerald-500" : "text-slate-900 dark:text-white"}`}>
                      {formatDate(d)} {new Date(d as any).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  );
                })()}
              </div>
            )}
            {invoice.spvIndex && (
              <div className="flex justify-between">
                <span className="text-slate-500">Index SPV:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {invoice.spvIndex}
                </span>
              </div>
            )}
            {!isExternalInvoice(invoice) && !isSpvTransmitted(invoice.spvStatus, invoice.spvIndex, invoice.spvSentAt) && (
              <div className="mt-2.5">
                <SpvDeadlineBadge
                  detailed={true}
                  issueDate={invoice.issueDate || invoice.createdAt}
                  clientCountry={invoice.clientCountry}
                  clientCUI={invoice.clientCUI}
                  spvStatus={invoice.spvStatus}
                  spvIndex={invoice.spvIndex}
                  spvSentAt={invoice.spvSentAt}
                />
              </div>
            )}
            {isExternalInvoice(invoice) && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Factură externă ({invoice.clientCountry || "UE"}). Conform legislației fiscale, operațiunile externe nu se transmit în RO e-Factura, ci se raportează în <strong>Declarația 390 VIES</strong> și se transmit clientului în format PDF pe e-mail.
              </div>
            )}
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

        {/* Transmitere Email & Previzualizare */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Transmitere Email
                </span>
              </div>
              {latestEmailLog ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Trimis
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                  Netrimis
                </span>
              )}
            </div>

            {latestEmailLog ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-slate-500 shrink-0">Destinatar:</span>
                  <span className="text-slate-900 dark:text-white font-medium text-right truncate max-w-[170px]" title={latestEmailLog.recipientEmail}>
                    {latestEmailLog.recipientEmail}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data expedierii:</span>
                  <span className="text-slate-900 dark:text-white font-medium">
                    {formatDate(latestEmailLog.sentAt || "")} {new Date(latestEmailLog.sentAt as any).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {invoiceEmailLogs && invoiceEmailLogs.length > 1 && (
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Istoric expedieri:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {invoiceEmailLogs.length} trimiteri
                    </span>
                  </div>
                )}
                {latestEmailLog.messageId && (
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Message ID:</span>
                    <span className="font-mono text-[10px] truncate max-w-[120px]" title={latestEmailLog.messageId}>
                      {latestEmailLog.messageId}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 space-y-1.5 py-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Email client:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[160px]">
                    {invoice.clientEmail || "—"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Factura nu a fost încă expediată pe email către client.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            {latestEmailLog ? (
              <>
                <button
                  type="button"
                  onClick={() => setViewSentEmailModal(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition-colors border border-blue-200 dark:border-blue-800 shadow-2xs cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Previzualizează Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailRecipient(latestEmailLog.recipientEmail || invoice.clientEmail || "");
                    const match = (invoice.notes || "").match(/(?:delegat|reprezentant|persoan[aă] de contact)\s*:\s*([^\n\r(]+)/i);
                    setRepresentativeName(match && match[1] ? match[1].trim() : "");
                    setShowEmailModal(true);
                  }}
                  title="Retrimite factura pe email"
                  className="px-2.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEmailRecipient(invoice.clientEmail || "");
                  const match = (invoice.notes || "").match(/(?:delegat|reprezentant|persoan[aă] de contact)\s*:\s*([^\n\r(]+)/i);
                  setRepresentativeName(match && match[1] ? match[1].trim() : "");
                  setShowEmailModal(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                Trimite pe Email
              </button>
            )}
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
              {isExternalInvoice(invoice) ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 h-7 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Globe className="w-3.5 h-3.5" /> Client Extern (Non-SPV)
                </span>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <iframe
              key={`pdf-${invoice.id}-${invoice.spvIndex || "0"}`}
              src={`/api/pdf/emitted/${invoice.id}?v=${invoice.spvIndex || (invoice.updatedAt ? new Date(invoice.updatedAt).getTime() : Date.now())}`}
              className="w-full min-w-[800px] sm:min-w-full h-[550px] border border-slate-200 dark:border-slate-700 bg-white"
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
                {!isSpvValidated && (
                  <button
                    type="button"
                    onClick={() => setIsEditDevizOpen(true)}
                    className="flex items-center gap-1.5 px-3 h-7 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editează Deviz
                  </button>
                )}
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
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <iframe
                src={`/api/pdf/deviz/${linkedDeviz.deviz.id}?t=${devizTimestamp}`}
                className="w-full min-w-[800px] sm:min-w-full h-[550px] border border-slate-200 dark:border-slate-700 bg-white"
                title="Deviz PDF Viewer"
              />
            </div>
          </div>
        )}
      </div>

      {linkedDeviz && (
        <EditDevizModal
          isOpen={isEditDevizOpen}
          onClose={() => setIsEditDevizOpen(false)}
          devizId={linkedDeviz.deviz.id}
          onSuccess={() => {
            refetchDeviz();
            setDevizTimestamp(Date.now());
          }}
        />
      )}

      {/* Modal Trimite pe Email */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Trimite Factura pe Email
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    selectedLanguages.length > 1
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    {selectedLanguages.length > 1
                      ? `🌍 Bilingv (${selectedLanguages.map(c => c.toUpperCase()).join(" + ")})`
                      : `📄 ${selectedLanguages[0].toUpperCase()}`}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {formatInvoiceNumber(invoice.series, invoice.number)} • {invoice.clientName}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Adresă Email Destinatar
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={e => setEmailRecipient(e.target.value)}
                placeholder="client@exemplu.ro"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nume Reprezentant (opțional)
              </label>
              <input
                type="text"
                value={representativeName}
                onChange={e => setRepresentativeName(e.target.value)}
                placeholder={
                  selectedLanguages.includes("en")
                    ? "ex: John Doe (lăsați gol pentru 'Bună ziua / Dear Sir or Madam,')"
                    : selectedLanguages.includes("fr")
                    ? "ex: Jean Dupont (lăsați gol pentru 'Bună ziua / Madame, Monsieur,')"
                    : selectedLanguages.includes("de")
                    ? "ex: Hans Schmidt (lăsați gol pentru 'Bună ziua / Sehr geehrte Damen und Herren,')"
                    : selectedLanguages.includes("nl")
                    ? "ex: Jan Jansen (lăsați gol pentru 'Bună ziua / Geachte heer,')"
                    : selectedLanguages.includes("hu")
                    ? "ex: Kovács János (lăsați gol pentru 'Bună ziua / Tisztelt Hölgyem / Uram,')"
                    : "ex: Ion Popescu (lăsați gol pentru 'Bună ziua,')"
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                {selectedLanguages.length > 1
                  ? `Email bilingv (${selectedLanguages.map(c => c.toUpperCase()).join(" + ")}). Dacă specificați numele, va fi adresat nominal în ambele limbi.`
                  : "Dacă este specificat, emailul va începe cu formula de adresare nominală a persoanei."}
              </p>
            </div>

            {/* Selector Limbi Email (maxim 2 limbi) */}
            <div className="space-y-1.5 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>Limbi email</span>
                  <span className="text-[10px] font-normal text-slate-500">
                    (alege 1 sau maxim 2)
                  </span>
                </label>
                <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  {selectedLanguages.length === 1
                    ? `1 limbă: ${AVAILABLE_LANGUAGES.find(l => l.code === selectedLanguages[0])?.name}`
                    : `Bilingv: ${selectedLanguages.map(c => AVAILABLE_LANGUAGES.find(l => l.code === c)?.name).join(" + ")}`}
                </span>
              </div>

              <div className="grid grid-cols-6 gap-1 pt-0.5">
                {AVAILABLE_LANGUAGES.map(lang => {
                  const isSelected = selectedLanguages.includes(lang.code);
                  const order = isSelected ? selectedLanguages.indexOf(lang.code) + 1 : null;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => toggleLanguage(lang.code)}
                      title={`${lang.name} (${lang.code.toUpperCase()})`}
                      className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-xs transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/30 font-bold scale-[1.02]"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 font-medium"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-slate-900 text-white text-[8px] flex items-center justify-center font-extrabold border border-white">
                          {order}
                        </span>
                      )}
                      <span className="text-sm leading-none mb-0.5">{lang.flag}</span>
                      <span className="text-[10.5px] uppercase tracking-wider font-bold">{lang.code}</span>
                      <span className={`text-[8px] truncate max-w-full ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                        {lang.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-slate-500 pt-0.5">
                {selectedLanguages.length === 1
                  ? "Emailul va fi expediat exclusiv în limba selectată."
                  : "Emailul va fi expediat bilingv (în ambele limbi selectate, cu toate detaliile traduse)."}
              </p>
            </div>

            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowEmailPreview(!showEmailPreview)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                {showEmailPreview ? "Ascunde previzualizarea emailului" : "Previzualizează cum va arăta emailul clientului (cu logo și detalii)"}
              </button>
            </div>

            {showEmailPreview && (
              <div className="p-2 sm:p-3 bg-slate-100/80 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 max-h-[360px] overflow-y-auto flex justify-center">
                {isEmailPreviewLoading ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    Se generează previzualizarea emailului...
                  </div>
                ) : emailPreviewData?.html ? (
                  <iframe
                    srcDoc={emailPreviewData.html}
                    title="Previzualizare Email"
                    className="w-full max-w-[540px] h-[340px] bg-white rounded-lg shadow-sm border border-slate-200 dark:border-slate-800"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Previzualizarea nu a putut fi încărcată.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                disabled={sendEmailMutation.isPending}
                className="px-4 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!emailRecipient || !emailRecipient.includes("@")) {
                    toast.error("Vă rugăm să introduceți o adresă de email validă");
                    return;
                  }
                  sendEmailMutation.mutate({
                    invoiceId: invoice.id,
                    recipientEmail: emailRecipient.trim(),
                    representativeName: representativeName.trim() || undefined,
                    languages: selectedLanguages,
                  });
                }}
                disabled={sendEmailMutation.isPending}
                className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-60"
              >
                {sendEmailMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Se trimite...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Trimite Factura
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Previzualizare Email Transmis */}
      {viewSentEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[94vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Previzualizare Email Transmis
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                      {formatInvoiceNumber(invoice.series, invoice.number)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Aspectul exact recepționat de client, incluzând logo-ul, detaliile și textul expediat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewSentEmailModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Meta Bar */}
            <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-slate-400 font-medium">Către:</span>{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {latestEmailLog?.recipientName || latestEmailLog?.recipientEmail || invoice.clientName}
                  </strong>{" "}
                  <span className="text-slate-500 font-mono text-[11px]">
                    &lt;{latestEmailLog?.recipientEmail || invoice.clientEmail}&gt;
                  </span>
                </div>
                {latestEmailLog?.sentAt && (
                  <div className="text-[11px] text-slate-500 font-medium">
                    Data trimiterii: {formatDate(latestEmailLog.sentAt)} {new Date(latestEmailLog.sentAt as any).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
              {latestEmailLog?.subject && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Subiect:</span>{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{latestEmailLog.subject}</span>
                </div>
              )}
            </div>

            {/* Preview Iframe */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70 dark:bg-slate-950/80 flex justify-center min-h-[380px]">
              {isSentEmailLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="text-sm font-medium">Se încarcă emailul expediat...</span>
                </div>
              ) : sentEmailPreviewData?.html ? (
                <iframe
                  srcDoc={sentEmailPreviewData.html}
                  title="Conținut Email Transmis"
                  className="w-full max-w-[580px] h-[520px] bg-white rounded-xl shadow-md border border-slate-200 dark:border-slate-800"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="py-24 text-center text-xs text-slate-500">
                  Nu s-a putut încărca conținutul emailului.
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
              <span className="text-xs text-slate-400">
                Document fiscal expediat prin platformă
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewSentEmailModal(false)}
                  className="px-4 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Închide
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewSentEmailModal(false);
                    setEmailRecipient(latestEmailLog?.recipientEmail || invoice.clientEmail || "");
                    const match = (invoice.notes || "").match(/(?:delegat|reprezentant|persoan[aă] de contact)\s*:\s*([^\n\r(]+)/i);
                    setRepresentativeName(match && match[1] ? match[1].trim() : "");
                    setShowEmailModal(true);
                  }}
                  className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  Retrimite Factura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
