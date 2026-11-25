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
  AlertCircle,
  X,
  Coins,
  Copy,
  ExternalLink,
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
  { code: "ro", name: "Română", flag: "" },
  { code: "en", name: "English", flag: "" },
  { code: "fr", name: "Français", flag: "" },
  { code: "nl", name: "Nederlands", flag: "" },
  { code: "de", name: "Deutsch", flag: "" },
  { code: "hu", name: "Magyar", flag: "" },
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
        toast.success("Factura a fost validată de ANAF!");
      } else if (res.status === "in_procesare") {
        toast.info("ANAF procesează în continuare factura. Mai încearcă peste câteva minute.");
      } else if (res.status === "eroare") {
        toast.error("ANAF a respins factura: " + (res.errors?.join(", ") || "eroare necunoscută"));
      } else {
        toast.info("Status ANAF: " + (res.stare || "necunoscut"));
      }
    },
    onError: e => toast.error("Eroare verificare: " + e.message),
  });

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(true);
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
  const totalVal = parseFloat(String(invoice.total || "0"));
  const subtotalVal = parseFloat(String(invoice.subtotal || "0"));
  const vatVal = parseFloat(String(invoice.totalVAT || "0"));
  const isStorno = totalVal < 0;
  const isExternal = isExternalInvoice(invoice);
  const needsSpvSend =
    !isExternal &&
    (!invoice.spvStatus ||
      invoice.spvStatus === "nesincronizat" ||
      invoice.spvStatus === "eroare");

  const openSendEmailModal = (prefillRecipient?: string) => {
    setEmailRecipient(prefillRecipient ?? (invoice.clientEmail || ""));
    const match = (invoice.notes || "").match(
      /(?:delegat|reprezentant|persoan[aă] de contact)\s*:\s*([^\n\r(]+)/i
    );
    setRepresentativeName(match && match[1] ? match[1].trim() : "");
    setShowEmailModal(true);
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiat în clipboard`);
  };

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4">
      {/* Top Floating Apple Glass Action Bar (1 Prominent CTA + Monochrome Glass Secondary Capsules) */}
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
              <span>Factură emisă</span>
              <span>·</span>
              <span className="truncate max-w-[240px]">{invoice.clientName || "—"}</span>
              <span>·</span>
              <span className="tabular-nums">{formatDate(invoice.issueDate || "")}</span>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
              <h1 className="text-[20px] sm:text-[22px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.024em] leading-tight tabular-nums">
                Factură {formatInvoiceNumber(invoice.series, invoice.number)}
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
          {isSpvValidated ? (
            <>
              <div
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-black/[0.045] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.10] text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium select-none cursor-default"
                title="Conform legislației fiscale (OUG 120/2021 și Codul Fiscal art. 330), documentul a fost validat în SPV și nu mai poate fi modificat. Pentru corecții, emiteți o factură de stornare."
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Înregistrată SPV · Nemodificabilă</span>
              </div>
              <Link href={`/facturi-emise-nou/storno/${invoice.id}`}>
                <button
                  type="button"
                  className="apple-btn-destructive-soft inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[12.5px] font-semibold cursor-pointer"
                  title="Emite o factură de stornare (cu valori negative) conform legii fiscale"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Stornează</span>
                </button>
              </Link>
            </>
          ) : (
            <>
              <Link href={`/facturi-emise-nou/${invoice.id}`}>
                <button
                  type="button"
                  className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editează Factura</span>
                </button>
              </Link>
              {linkedDeviz && (
                <button
                  type="button"
                  onClick={() => setIsEditDevizOpen(true)}
                  className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editează Deviz</span>
                </button>
              )}
            </>
          )}

          {needsSpvSend ? (
            <>
              <button
                type="button"
                onClick={() => openSendEmailModal()}
                className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Trimite pe Email</span>
              </button>
              <button
                type="button"
                onClick={() => sendToSpv.mutate({ id: invoice.id })}
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
            <button
              type="button"
              onClick={() => openSendEmailModal()}
              className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-white text-[12.5px] font-semibold cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Trimite pe Email</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Apple Inspector Cards (Opaque Content Layer) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Card 1: Hero Financial Summary */}
        <div className="apple-surface p-5 flex flex-col justify-between tabular-nums">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                Total facturat
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
              {formatCurrency(totalVal, invoice.currency as any)}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">Subtotal</span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatCurrency(subtotalVal, invoice.currency as any)}
              </span>
            </div>
            <div className="apple-inspector-row text-[12.5px]">
              <span className="text-[#6e6e73] dark:text-[#98989d]">TVA</span>
              <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                {formatCurrency(vatVal, invoice.currency as any)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Client Info */}
        <div className="apple-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                Client / Cumpărător
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
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] dark:hover:text-[#0a84ff] cursor-pointer"
                  title="Copiază CUI"
                >
                  <span>{invoice.clientCUI}</span>
                  <Copy className="w-3 h-3 text-[#8e8e93]" />
                </button>
              ) : (
                <span className="text-[#8e8e93]">—</span>
              )}
            </div>
            {invoice.clientCode ? (
              <div className="apple-inspector-row text-[12.5px] tabular-nums">
                <span className="text-[#6e6e73] dark:text-[#98989d]">Cod SAGA</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300 text-[11px] font-semibold">
                  {invoice.clientCode}
                </span>
              </div>
            ) : (
              <div className="apple-inspector-row text-[12.5px]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">Țară</span>
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {invoice.clientCountry || "RO"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Fiscal & SPV Inspector */}
        <div className="apple-surface p-5 flex flex-col justify-between tabular-nums">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                Detalii & RO e-Factura
              </span>
              <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                <Hash className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
              </span>
            </div>

            <div>
              <div className="apple-inspector-row text-[12.5px]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">Data / Scadență</span>
                <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {formatDate(invoice.issueDate || "")}
                  {invoice.dueDate ? ` · ${formatDate(invoice.dueDate)}` : ""}
                </span>
              </div>
              <div className="apple-inspector-row text-[12.5px]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">Stare SPV</span>
                <span>
                  {isExternal ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300">
                      Extern (D390)
                    </span>
                  ) : invoice.spvStatus === "validat" ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                      Validată ANAF
                    </span>
                  ) : invoice.spvStatus === "eroare" ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ff3b30]/10 text-[#d70015] dark:text-[#ff6961]">
                      Eroare ANAF
                    </span>
                  ) : invoice.spvStatus === "in_procesare" ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0071e3]/10 text-[#0071e3] dark:text-[#64d2ff]">
                      În procesare
                    </span>
                  ) : (
                    <span className="text-[#8e8e93] font-medium">
                      {invoice.spvStatus || "Netrimisă"}
                    </span>
                  )}
                </span>
              </div>

              {(invoice.spvSentAt ||
                (invoice.spvIndex && (invoice.updatedAt || invoice.createdAt))) && (
                <div className="apple-inspector-row text-[12.5px]">
                  <span className="text-[#6e6e73] dark:text-[#98989d]">Transmisă la</span>
                  {(() => {
                    const d = invoice.spvSentAt || invoice.updatedAt || invoice.createdAt;
                    const inTermen = isTransmittedInDeadline(invoice.issueDate, d);
                    const dObj = d instanceof Date ? d : d ? new Date(d) : null;
                    const timeStr =
                      dObj && !isNaN(dObj.getTime())
                        ? dObj.toLocaleTimeString("ro-RO", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";
                    return (
                      <span
                        className={`font-medium ${
                          inTermen
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-[#1d1d1f] dark:text-white"
                        }`}
                      >
                        {formatDate(d)} {timeStr}
                      </span>
                    );
                  })()}
                </div>
              )}

              {invoice.spvIndex && (
                <div className="apple-inspector-row text-[12.5px]">
                  <span className="text-[#6e6e73] dark:text-[#98989d]">Index SPV</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(String(invoice.spvIndex), "Index SPV")}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] cursor-pointer"
                    title="Copiază Index SPV"
                  >
                    <span>{invoice.spvIndex}</span>
                    <Copy className="w-3 h-3 text-[#8e8e93]" />
                  </button>
                </div>
              )}
            </div>

            {!isExternal &&
              !isSpvTransmitted(
                invoice.spvStatus,
                invoice.spvIndex,
                invoice.spvSentAt
              ) && (
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

            {isExternal && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Factură externă ({invoice.clientCountry || "UE"}) — se raportează prin{" "}
                <strong>D390 VIES</strong> și se transmite pe e-mail în format PDF.
              </div>
            )}

            {invoice.spvStatus === "eroare" && invoice.spvError && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-[#ff3b30]/[0.07] border border-[#ff3b30]/20 text-[11px] text-[#d70015] dark:text-[#ff6961] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Eroare validare ANAF:</span>
                </div>
                <p className="tabular-nums leading-relaxed break-words opacity-90">
                  {invoice.spvError}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Email Delivery Inspector */}
        <div className="apple-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                Transmitere Email
              </span>
              {latestEmailLog?.status === "trimis" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Trimis</span>
                </span>
              ) : latestEmailLog?.status === "eroare" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ff3b30]/10 text-[#d70015] dark:text-[#ff6961]">
                  <AlertCircle className="w-3 h-3" />
                  <span>Eroare</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]">
                  Netrimis
                </span>
              )}
            </div>

            {latestEmailLog ? (
              <div className="tabular-nums">
                <div className="apple-inspector-row text-[12.5px]">
                  <span className="text-[#6e6e73] dark:text-[#98989d] shrink-0">
                    Destinatar
                  </span>
                  <span
                    className="text-[#1d1d1f] dark:text-white font-medium text-right truncate max-w-[165px]"
                    title={latestEmailLog.recipientEmail}
                  >
                    {latestEmailLog.recipientEmail}
                  </span>
                </div>
                <div className="apple-inspector-row text-[12.5px]">
                  <span className="text-[#6e6e73] dark:text-[#98989d]">
                    {latestEmailLog.status === "eroare" ? "Încercare" : "Expediat"}
                  </span>
                  <span className="text-[#1d1d1f] dark:text-white font-medium">
                    {formatDate(latestEmailLog.sentAt)}{" "}
                    {(() => {
                      const s = latestEmailLog.sentAt;
                      const d = s instanceof Date ? s : s ? new Date(s) : null;
                      return d && !isNaN(d.getTime())
                        ? d.toLocaleTimeString("ro-RO", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";
                    })()}
                  </span>
                </div>
                {latestEmailLog.status === "eroare" && latestEmailLog.error && (
                  <div className="mt-2 p-2 rounded-xl bg-[#ff3b30]/[0.07] border border-[#ff3b30]/20 text-[11px] text-[#d70015] dark:text-[#ff6961] break-all">
                    {latestEmailLog.error}
                  </div>
                )}
                {invoiceEmailLogs &&
                  invoiceEmailLogs.length > 1 &&
                  (() => {
                    const successCount = invoiceEmailLogs.filter(
                      l => l.status === "trimis"
                    ).length;
                    const errorCount = invoiceEmailLogs.filter(
                      l => l.status === "eroare"
                    ).length;
                    return (
                      <div className="apple-inspector-row text-[12px]">
                        <span className="text-[#6e6e73] dark:text-[#98989d]">
                          Istoric
                        </span>
                        <span className="font-medium text-[#1d1d1f] dark:text-[#ebebf5]">
                          {successCount > 0 && `${successCount} trimise`}
                          {successCount > 0 && errorCount > 0 && " · "}
                          {errorCount > 0 && `${errorCount} eșuate`}
                        </span>
                      </div>
                    );
                  })()}
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                <div className="apple-inspector-row text-[12.5px]">
                  <span className="text-[#6e6e73] dark:text-[#98989d]">
                    Email client
                  </span>
                  <span className="text-[#1d1d1f] dark:text-[#ebebf5] font-medium truncate max-w-[160px]">
                    {invoice.clientEmail || "—"}
                  </span>
                </div>
                <p className="text-[11.5px] text-[#8e8e93] pt-1">
                  Factura nu a fost încă expediată pe email.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center gap-2">
            {latestEmailLog ? (
              <>
                <button
                  type="button"
                  onClick={() => setViewSentEmailModal(true)}
                  className="apple-btn-glass flex-1 flex items-center justify-center gap-1.5 px-3.5 h-8 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Previzualizează Email</span>
                </button>
                <button
                  type="button"
                  aria-label="Retrimite factura pe email"
                  onClick={() =>
                    openSendEmailModal(
                      latestEmailLog.recipientEmail || invoice.clientEmail || ""
                    )
                  }
                  title="Retrimite factura pe email"
                  className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#1d1d1f] dark:text-[#f5f5f7] shrink-0 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => openSendEmailModal()}
                className="apple-btn-glass w-full flex items-center justify-center gap-1.5 px-3.5 h-8 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Configurează & Trimite</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* macOS Quick Look Document Stage: Factură PDF + Deviz PDF */}
      <div
        className={`flex gap-4 ${
          linkedDeviz ? "flex-col xl:flex-row items-stretch" : "flex-col"
        }`}
      >
        {/* Factură PDF */}
        <div
          className={`apple-surface overflow-hidden flex flex-col ${
            linkedDeviz ? "flex-1 min-w-0" : "w-full"
          }`}
        >
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa]/90 dark:bg-white/[0.025] flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5 text-[#1d1d1f] dark:text-[#f5f5f7]" />
              </span>
              <h2 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Previzualizare Factură PDF
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`/api/pdf/emitted/${invoice.id}`}
                target="_blank"
                rel="noreferrer"
                className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Tab nou</span>
              </a>
              <button
                type="button"
                onClick={() =>
                  window.open(`/api/pdf/emitted/${invoice.id}?download=1`, "_blank")
                }
                className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descarcă</span>
              </button>

              {isExternal ? (
                <span className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-medium rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Client Extern (Non-SPV)</span>
                </span>
              ) : (
                <>
                  {needsSpvSend && (
                    <button
                      type="button"
                      onClick={() => sendToSpv.mutate({ id: invoice.id })}
                      disabled={sendToSpv.isPending}
                      className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 text-[12px] font-semibold rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    >
                      {sendToSpv.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Trimite SPV</span>
                    </button>
                  )}
                  {(invoice.spvStatus === "in_procesare" ||
                    invoice.spvStatus === "eroare") && (
                    <button
                      type="button"
                      onClick={() => checkSpvStatus.mutate({ id: invoice.id })}
                      disabled={checkSpvStatus.isPending}
                      className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 text-[12px] font-semibold rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    >
                      {checkSpvStatus.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Verifică Status ANAF</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div
            className="apple-doc-stage p-3 sm:p-5 overflow-x-auto flex-1"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className={`apple-doc-paper overflow-hidden ${linkedDeviz ? "" : "max-w-5xl mx-auto"}`}>
              <iframe
                key={`pdf-${invoice.id}-${invoice.spvIndex || "0"}`}
                src={`/api/pdf/emitted/${invoice.id}?v=${
                  invoice.spvIndex ||
                  (invoice.updatedAt
                    ? new Date(invoice.updatedAt).getTime()
                    : Date.now())
                }`}
                className="w-full min-w-[780px] sm:min-w-full h-[680px] border-0 bg-white"
                title="PDF Viewer"
              />
            </div>
          </div>
        </div>

        {/* Deviz PDF (dacă există) */}
        {linkedDeviz && (
          <div className="flex-1 min-w-0 apple-surface overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa]/90 dark:bg-white/[0.025] flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#0071e3]/10 dark:bg-[#0a84ff]/18 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#64d2ff]" />
                </span>
                <h2 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                  Deviz {linkedDeviz.deviz.number}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] tabular-nums">
                  {Number(linkedDeviz.deviz.total).toFixed(2)} RON
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!isSpvValidated && (
                  <button
                    type="button"
                    onClick={() => setIsEditDevizOpen(true)}
                    className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 text-[12px] font-semibold rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editează Deviz</span>
                  </button>
                )}
                <a
                  href={`/api/pdf/deviz/${linkedDeviz.deviz.id}?download=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 text-[12px] font-semibold rounded-full text-[#1d1d1f] dark:text-[#f5f5f7]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descarcă</span>
                </a>
                <a
                  href={`/api/pdf/deviz/${linkedDeviz.deviz.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-8 text-[12px] font-semibold rounded-full text-[#1d1d1f] dark:text-[#f5f5f7]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Tab nou</span>
                </a>
              </div>
            </div>
            <div
              className="apple-doc-stage p-3 sm:p-5 overflow-x-auto flex-1"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="apple-doc-paper overflow-hidden">
                <iframe
                  src={`/api/pdf/deviz/${linkedDeviz.deviz.id}?t=${devizTimestamp}`}
                  className="w-full min-w-[780px] sm:min-w-full h-[680px] border-0 bg-white"
                  title="Deviz PDF Viewer"
                />
              </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 lg:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className={`bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[22px] shadow-2xl w-full ${
              showEmailPreview ? "max-w-5xl" : "max-w-xl"
            } max-h-[92vh] flex flex-col overflow-hidden transition-all duration-200`}
          >
            {/* Header Modal */}
            <div className="px-5 sm:px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-[#f8f9fc]/85 dark:bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-[#1d1d1f] dark:text-white truncate">
                      Trimite Factura pe Email
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        selectedLanguages.length > 1
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {selectedLanguages.length > 1
                        ? `Bilingv (${selectedLanguages.map(c => c.toUpperCase()).join(" + ")})`
                        : selectedLanguages[0].toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-[#636366] dark:text-[#98989d] truncate tabular-nums">
                    {formatInvoiceNumber(invoice.series, invoice.number)} • {invoice.clientName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEmailPreview(!showEmailPreview)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full apple-btn-glass text-xs font-semibold text-[#3a3a3c] dark:text-[#ebebf5] transition-colors cursor-pointer"
                  title={showEmailPreview ? "Ascunde panoul de previzualizare" : "Afișează previzualizarea emailului"}
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{showEmailPreview ? "Ascunde previzualizarea" : "Previzualizează email"}</span>
                </button>
                <button
                  type="button"
                  aria-label="Închide fereastra"
                  onClick={() => setShowEmailModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#636366] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition-colors cursor-pointer"
                  title="Închide fereastra"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
              {/* Panou Stânga: Formular Configurare (Apple Sheet Style) */}
              <div
                className={`w-full ${
                  showEmailPreview
                    ? "lg:w-[410px] xl:w-[440px] shrink-0 border-b lg:border-b-0 lg:border-r border-black/[0.06] dark:border-white/[0.08]"
                    : ""
                } p-5 sm:p-6 overflow-y-auto space-y-4 bg-white dark:bg-[#1c1c1e]`}
              >
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center justify-between">
                    <span>Adresă Email Destinatar</span>
                    {invoice.clientEmail && invoice.clientEmail !== emailRecipient && (
                      <button
                        type="button"
                        onClick={() => setEmailRecipient(invoice.clientEmail || "")}
                        className="text-[11px] font-medium text-[#0071e3] dark:text-[#64d2ff] hover:underline cursor-pointer"
                      >
                        Folosește email client
                      </button>
                    )}
                  </label>
                  <input
                    type="email"
                    value={emailRecipient}
                    onChange={e => setEmailRecipient(e.target.value)}
                    placeholder="client@exemplu.ro"
                    className="apple-input w-full h-10 px-3.5 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Nume Reprezentant (opțional)
                  </label>
                  <input
                    type="text"
                    value={representativeName}
                    onChange={e => setRepresentativeName(e.target.value)}
                    placeholder={
                      selectedLanguages.includes("en")
                        ? "ex: John Doe (gol pentru 'Bună ziua / Dear Sir or Madam,')"
                        : selectedLanguages.includes("fr")
                        ? "ex: Jean Dupont (gol pentru 'Bună ziua / Madame, Monsieur,')"
                        : selectedLanguages.includes("de")
                        ? "ex: Hans Schmidt (gol pentru 'Bună ziua / Sehr geehrte...')"
                        : selectedLanguages.includes("nl")
                        ? "ex: Jan Jansen (gol pentru 'Bună ziua / Geachte heer,')"
                        : selectedLanguages.includes("hu")
                        ? "ex: Kovács János (gol pentru 'Bună ziua / Tisztelt...')"
                        : "ex: Ion Popescu (lăsați gol pentru 'Bună ziua,')"
                    }
                    className="apple-input w-full h-10 px-3.5 outline-none"
                  />
                  <p className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] leading-normal">
                    {selectedLanguages.length > 1
                      ? `Email bilingv (${selectedLanguages.map(c => c.toUpperCase()).join(" + ")}). Va începe cu formula de adresare nominală în ambele limbi.`
                      : "Dacă este specificat, emailul va începe cu formula de adresare nominală."}
                  </p>
                </div>

                {/* Selector Limbi Email (maxim 2 limbi — Apple Squircle Tiles) */}
                <div className="space-y-2.5 p-3.5 bg-[#f5f5f7] dark:bg-[#2c2c2e]/70 rounded-2xl border border-black/[0.05] dark:border-white/[0.08]">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Limbi email <span className="font-normal text-[#6e6e73] dark:text-[#98989d]">(1 sau 2)</span>
                    </label>
                    <span className="text-[11px] font-semibold text-[#1d1d1f] dark:text-white bg-white dark:bg-[#3a3a3c] px-2.5 py-0.5 rounded-full shadow-2xs">
                      {selectedLanguages.length === 1
                        ? AVAILABLE_LANGUAGES.find(l => l.code === selectedLanguages[0])?.name
                        : selectedLanguages
                            .map(c => AVAILABLE_LANGUAGES.find(l => l.code === c)?.name)
                            .join(" + ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5 pt-0.5">
                    {AVAILABLE_LANGUAGES.map(lang => {
                      const isSelected = selectedLanguages.includes(lang.code);
                      const order = isSelected ? selectedLanguages.indexOf(lang.code) + 1 : null;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => toggleLanguage(lang.code)}
                          title={`${lang.name} (${lang.code.toUpperCase()})`}
                          className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "bg-primary text-white border-transparent shadow-xs font-bold"
                              : "bg-transparent border-black/[0.06] dark:border-white/[0.08] text-[#6e6e73] dark:text-[#98989d] hover:bg-white/60 dark:hover:bg-white/[0.06] font-medium"
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-[#1d1d1f] shadow-xs text-[10px] tabular-nums flex items-center justify-center font-bold">
                              {order}
                            </span>
                          )}
                          <span className="text-[11px] uppercase font-bold">{lang.code}</span>
                          <span className="text-[10.5px] truncate max-w-full opacity-75">
                            {lang.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-[#6e6e73] dark:text-[#98989d]">
                    {selectedLanguages.length === 1
                      ? "Emailul va fi expediat în limba selectată."
                      : "Emailul va fi expediat bilingv, cu toate detaliile traduse."}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 text-[11.5px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Factura fiscală PDF cu siglă, cod QR SPV și detalii de plată este atașată automat.
                </div>

                {!showEmailPreview && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowEmailPreview(true)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0071e3] dark:text-[#64d2ff] hover:underline cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Previzualizează emailul clientului</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Panou Dreapta: Previzualizare Live Email */}
              {showEmailPreview && (
                <div className="flex-1 p-4 sm:p-5 apple-doc-stage flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-2.5 shrink-0 px-1">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#6e6e73] dark:text-[#98989d]" />
                      <span className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        Previzualizare Email Live
                      </span>
                    </div>
                    <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                      Aspectul recepționat în inbox de client
                    </span>
                  </div>

                  <div className="flex-1 w-full flex justify-center items-start overflow-y-auto min-h-[460px]">
                    {isEmailPreviewLoading ? (
                      <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#6e6e73]">
                        <Loader2 className="w-7 h-7 animate-spin" />
                        <span className="text-xs font-medium">
                          Se generează previzualizarea emailului...
                        </span>
                      </div>
                    ) : emailPreviewData?.html ? (
                      <iframe
                        srcDoc={emailPreviewData.html}
                        title="Previzualizare Email"
                        className="w-full max-w-[620px] min-h-[520px] apple-doc-paper border-0"
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <div className="py-20 text-center text-xs text-[#6e6e73]">
                        Previzualizarea nu a putut fi încărcată.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-[#fafafa]/90 dark:bg-white/[0.025] shrink-0">
              <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d] hidden sm:inline truncate max-w-[280px]">
                Către:{" "}
                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {emailRecipient || "fără destinatar"}
                </strong>
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  disabled={sendEmailMutation.isPending}
                  className="px-4 h-9 rounded-full apple-btn-glass text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors cursor-pointer"
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
                  className="apple-btn-prominent flex items-center gap-1.5 px-5 h-9 rounded-full text-white text-[12.5px] font-semibold transition-all disabled:opacity-60 cursor-pointer"
                >
                  {sendEmailMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Se trimite...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Trimite Factura</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Previzualizare Email Transmis */}
      {viewSentEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[22px] shadow-2xl max-w-3xl w-full max-h-[94vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-[#f8f9fc]/85 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#1d1d1f] dark:text-white">
                      Previzualizare Email Transmis
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 tabular-nums">
                      {formatInvoiceNumber(invoice.series, invoice.number)}
                    </span>
                  </div>
                  <p className="text-xs text-[#636366] dark:text-[#98989d]">
                    Aspectul exact recepționat de client, incluzând logo-ul, detaliile și textul expediat
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Închide fereastra"
                onClick={() => setViewSentEmailModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#636366] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Meta Bar */}
            <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-slate-950/70 border-b border-black/[0.06] dark:border-white/[0.08] text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-slate-400 font-medium">Către:</span>{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {latestEmailLog?.recipientName || latestEmailLog?.recipientEmail || invoice.clientName}
                  </strong>{" "}
                  <span className="text-slate-500 tabular-nums text-[11px]">
                    &lt;{latestEmailLog?.recipientEmail || invoice.clientEmail}&gt;
                  </span>
                </div>
                {latestEmailLog?.sentAt && (
                  <div className="text-[11px] text-slate-500 font-medium tabular-nums">
                    Data trimiterii: {formatDate(latestEmailLog.sentAt)} {(() => {
                      const s = latestEmailLog.sentAt;
                      const d = s instanceof Date ? s : s ? new Date(s) : null;
                      return d && !isNaN(d.getTime())
                        ? d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
                        : "";
                    })()}
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 apple-doc-stage flex justify-center min-h-[380px]">
              {isSentEmailLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#6e6e73]">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span className="text-sm font-medium">Se încarcă emailul expediat...</span>
                </div>
              ) : sentEmailPreviewData?.html ? (
                <iframe
                  srcDoc={sentEmailPreviewData.html}
                  title="Conținut Email Transmis"
                  className="w-full max-w-[580px] h-[520px] apple-doc-paper border-0"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="py-24 text-center text-xs text-[#6e6e73]">
                  Nu s-a putut încărca conținutul emailului.
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between bg-[#fafafa]/90 dark:bg-white/[0.025]">
              <span className="text-xs text-[#6e6e73] dark:text-[#98989d]">
                Document fiscal expediat prin platformă
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewSentEmailModal(false)}
                  className="px-4 h-9 rounded-full apple-btn-glass text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors cursor-pointer"
                >
                  Închide
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewSentEmailModal(false);
                    openSendEmailModal(
                      latestEmailLog?.recipientEmail || invoice.clientEmail || ""
                    );
                  }}
                  className="apple-btn-prominent flex items-center gap-1.5 px-4 h-9 rounded-full text-white text-[12.5px] font-semibold transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Retrimite Factura</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
