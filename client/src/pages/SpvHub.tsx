import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DownloadCloud,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wifi,
  Activity,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Search,
  Eye,
  Copy,
  Check,
  ExternalLink,
  FileText,
  HelpCircle,
  Building2,
  KeyRound,
  Gavel,
  HandCoins,
  Video,
  Calendar,
  AlertTriangle,
  PlusCircle,
  FileCheck,
  Sparkles,
  Printer,
  Download,
  Info,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { isTransmittedInDeadline } from "@/lib/spvDeadline";
import { toast } from "sonner";
import DocumentModalPreview from "@/components/DocumentModalPreview";

export default function SpvHub() {
  const utils = trpc.useUtils();
  const { data: logs, isLoading: isLoadingLogs, refetch: refetchLogs } = trpc.spvLogs.list.useQuery();
  const { data: integrationsList, refetch: refetchIntegrations } = trpc.integrations.list.useQuery();
  const { data: oauthInfo } = trpc.integrations.getSpvOAuthUrl.useQuery();
  const { data: currentTenant } = trpc.tenants.current.useQuery();
  const { data: adminMessages, isLoading: isLoadingAdminMessages, refetch: refetchAdminMessages } =
    (trpc as any).spvMessages.list.useQuery();

  // Tab Principal de Navigare în SPV Hub
  const [mainModuleTab, setMainModuleTab] = useState<"inbox_messages" | "efactura_invoices" | "fiscal_mediation" | "tax_loan">("inbox_messages");

  // Filtre Facturi e-Factura
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<"all" | "primita" | "trimisa" | "eroare">("all");
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<string>("all");
  const [searchInvoiceQuery, setSearchInvoiceQuery] = useState<string>("" );

  // Filtre Mesaje Administrative SPV
  const [adminMessageTypeFilter, setAdminMessageTypeFilter] = useState<string>("all");
  const [searchAdminMessage, setSearchAdminMessage] = useState<string>("");

  // Stare Diagnostic & Copiere
  const [testResult, setTestResult] = useState<any>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [copiedCui, setCopiedCui] = useState<string | null>(null);

  // Modale interactive
  const [isAddMessageOpen, setIsAddMessageOpen] = useState(false);
  const [isMediationModalOpen, setIsMediationModalOpen] = useState(false);
  const [isTaxLoanModalOpen, setIsTaxLoanModalOpen] = useState(false);

  // Formular Notificare Mediere Fiscală Online (Ordin 992/2026)
  const [mediationForm, setMediationForm] = useState({
    somatieNr: "SOM-2026-992",
    somatieDate: new Date().toISOString().split("T")[0],
    amount: "15.420,00",
    reason: "Clarificarea diferențelor dintre decontul D300 și facturile din RO e-Factura, respectiv solicitarea unui plan de eșalonare.",
    videoconferenceEmail: "",
    contactPhone: "",
    representativeName: "",
  });

  // Formular Contract Împrumut Asociat pentru Plata Taxelor
  const [taxLoanForm, setTaxLoanForm] = useState({
    contractNumber: `IMP-TAX-${new Date().getFullYear()}-01`,
    contractDate: new Date().toISOString().split("T")[0],
    shareholderName: "",
    shareholderCnp: "",
    shareholderAddress: "",
    amount: "25.000",
    currency: "RON",
    validUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
    purpose: "Plata obligațiilor fiscale bugetare (TVA, impozit pe venit, CAS/CASS) la Trezoreria Statului",
  });

  // Previzualizare modal PDF
  const [previewDoc, setPreviewDoc] = useState<{
    isOpen: boolean;
    title: string;
    pdfUrl: string | null;
    filename?: string;
    type: "invoice" | "nir" | "emitted";
  }>({
    isOpen: false,
    title: "",
    pdfUrl: null,
    type: "invoice",
  });

  // Mutație adăugare mesaj administrativ SPV (Recipisă / Notificare)
  const addAdminMessageMutation = (trpc as any).spvMessages.addMessage.useMutation({
    onSuccess: () => {
      toast.success("Mesajul / recipisa a fost înregistrată cu succes în dosarul SPV!");
      setIsAddMessageOpen(false);
      refetchAdminMessages();
    },
    onError: (err: any) => {
      toast.error(`Eroare la salvare: ${err.message}`);
    },
  });

  // Mutație salvare contract în biblioteca de contracte
  const createContractMutation = trpc.contracts.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Contractul de împrumut asociat a fost generat și salvat cu succes (ID: ${data.id})!`);
      setIsTaxLoanModalOpen(false);
      utils.contracts.getStats.invalidate();
    },
    onError: (err) => {
      toast.error(`Eroare la generarea contractului: ${err.message}`);
    },
  });

  // Mutație Testare Conexiune SPV ANAF
  const testSpvMutation = trpc.integrations.testSpvConnection.useMutation({
    onSuccess: (data) => {
      setTestResult(data);
      if (data.connected) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      refetchIntegrations();
    },
    onError: (err) => {
      toast.error(`Eroare la testarea conexiunii: ${err.message}`);
    },
  });

  // Mutație Sincronizare Manuală cu SPV ANAF
  const syncSpvMutation = trpc.integrations.syncSpvManual.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Sincronizare SPV finalizată! S-au importat ${data.imported} facturi noi direct de la ANAF.`
      );
      utils.spvLogs.list.invalidate();
      refetchLogs();
      refetchIntegrations();
    },
    onError: (err) => {
      toast.error(`Eroare la sincronizarea cu SPV: ${err.message}`);
    },
  });

  const spvIntegration = integrationsList?.find((i) => i.provider === "spv");

  // Calculează zile rămase până la expirarea termenului de 15 zile pentru mediere
  const mediationDaysRemaining = useMemo(() => {
    try {
      const somatieDateObj = parseISO(mediationForm.somatieDate);
      const deadlineDate = addDays(somatieDateObj, 15);
      const remaining = differenceInCalendarDays(deadlineDate, new Date());
      return {
        deadlineDateStr: format(deadlineDate, "dd.MM.yyyy"),
        days: remaining,
        isExpired: remaining < 0,
      };
    } catch {
      return { deadlineDateStr: "-", days: 0, isExpired: false };
    }
  }, [mediationForm.somatieDate]);

  const handleCopyIndex = (index: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(index);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
    toast.success(`Index SPV copiat: ${index}`);
  };

  const handleCopyCui = (cui: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cui);
    setCopiedCui(cui);
    setTimeout(() => setCopiedCui(null), 1800);
    toast.success(`CUI copiat: ${cui}`);
  };

  // Filtrare Facturi e-Factura
  const filteredInvoiceLogs = logs?.filter((log) => {
    if (activeInvoiceTab === "primita" && log.type !== "primita") return false;
    if (activeInvoiceTab === "trimisa" && log.type !== "trimisa") return false;
    if (activeInvoiceTab === "eroare" && log.spvStatus !== "eroare") return false;
    if (filterInvoiceStatus !== "all" && log.spvStatus !== filterInvoiceStatus) return false;

    if (searchInvoiceQuery.trim()) {
      const q = searchInvoiceQuery.toLowerCase().trim();
      const numMatch = log.invoiceNumber?.toLowerCase().includes(q);
      const nameMatch = log.partnerName?.toLowerCase().includes(q);
      const cuiMatch = (log as any).partnerCui?.toLowerCase().includes(q);
      const idxMatch = log.spvIndex?.toLowerCase().includes(q);
      if (!numMatch && !nameMatch && !cuiMatch && !idxMatch) return false;
    }
    return true;
  });

  // Filtrare Mesaje Administrative SPV
  const filteredAdminMessages = adminMessages?.filter((msg: any) => {
    if (adminMessageTypeFilter !== "all" && msg.type !== adminMessageTypeFilter) return false;
    if (searchAdminMessage.trim()) {
      const q = searchAdminMessage.toLowerCase().trim();
      const titleMatch = msg.title?.toLowerCase().includes(q);
      const docMatch = msg.docNumber?.toLowerCase().includes(q);
      const declMatch = msg.declarationType?.toLowerCase().includes(q);
      const indexMatch = msg.spvIndex?.toLowerCase().includes(q);
      if (!titleMatch && !docMatch && !declMatch && !indexMatch) return false;
    }
    return true;
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "validat":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300";
      case "eroare":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300";
      case "in_procesare":
      case "avertisment":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const invoiceStats = {
    trimise: logs?.filter((l) => l.type === "trimisa").length || 0,
    primite: logs?.filter((l) => l.type === "primita").length || 0,
    validate: logs?.filter((l) => l.spvStatus === "validat").length || 0,
    erori: logs?.filter((l) => l.spvStatus === "eroare").length || 0,
  };

  const tokenExpiresAt = spvIntegration?.tokenExpiresAt
    ? new Date(spvIntegration.tokenExpiresAt)
    : null;
  const daysUntilExpiration = tokenExpiresAt
    ? Math.ceil((tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Antet Pagina SPV ANAF */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                SPV ANAF — Conexiune Live & Modul Integrat
              </h1>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                e-Factura & Legislație 2026
              </Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Centrul complet SPV: mesaje zilnice, recipise declarații, mediere fiscală online (Ord. 992/2026), contracte împrumut taxe și e-Factura.
            </p>
          </div>

          {/* Butoane Acțiuni Principale Conexiune */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => testSpvMutation.mutate()}
              disabled={testSpvMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Trimite un ping de 1 zi la serverele ANAF și verifică starea token-ului"
            >
              {testSpvMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Se testează conexiunea...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  <span>Testează Conexiunea SPV ANAF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => syncSpvMutation.mutate()}
              disabled={syncSpvMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1F4E79] hover:bg-[#102A43] disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Descarcă ultimele facturi și mesaje din ultimele 60 de zile din SPV"
            >
              {syncSpvMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Se descarcă din SPV...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Sincronizează cu SPV acum</span>
                </>
              )}
            </button>

            {oauthInfo?.url && (
              <a
                href={oauthInfo.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition-colors"
                title="Deschide pagina ANAF pentru autorizarea certificatului digital cu token OAuth"
              >
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Reautorizare Token</span>
              </a>
            )}
          </div>
        </div>

        {/* BANNER LEGISLATIV: NOUTĂȚI FISCALE DIN ARTICOL */}
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-blue-500/10 to-emerald-500/10 border border-amber-300/60 dark:border-amber-700/60 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Instrumente Fiscale 2026: Mediere Online & Plată Taxe de Terți
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                  Ordin ANAF 992/2026
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 max-w-2xl">
                1. <strong>Medierea fiscală</strong> se poate cere acum online prin videoconferință (în 15 zile de la somație).
                2. <strong>Plata obligațiilor fiscale de către administrator/asociat</strong> necesită contract legal de împrumut pentru a evita sancțiunile ANAF.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setMainModuleTab("fiscal_mediation");
                setIsMediationModalOpen(true);
              }}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Gavel className="w-3.5 h-3.5" />
              <span>Notificare Mediere (15 zile)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMainModuleTab("tax_loan");
                setIsTaxLoanModalOpen(true);
              }}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <HandCoins className="w-3.5 h-3.5" />
              <span>Contract Împrumut Taxe</span>
            </button>
          </div>
        </div>

        {/* Card Diagnostic Conexiune SPV (Dacă a fost rulat) */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border transition-all ${
              testResult.connected
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100"
                : "bg-red-50/90 border-red-200 text-red-950 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    testResult.connected
                      ? "bg-emerald-200/60 text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-200"
                      : "bg-red-200/60 text-red-800 dark:bg-red-800/50 dark:text-red-200"
                  }`}
                >
                  {testResult.connected ? <ShieldCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">
                      {testResult.connected ? "✓ Conexiune SPV Activă și Validată" : "✕ Conexiune SPV Eșuată"}
                    </span>
                    {testResult.latencyMs != null && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] tabular-nums font-semibold bg-white/80 dark:bg-slate-900/80 border border-current">
                        Latență ANAF: {testResult.latencyMs} ms
                      </span>
                    )}
                    {testResult.cui && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] tabular-nums font-semibold bg-white/80 dark:bg-slate-900/80 border border-current">
                        CUI Firmă: {testResult.cui}
                      </span>
                    )}
                    {testResult.tokenDaysRemaining != null && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] tabular-nums font-medium bg-white/80 dark:bg-slate-900/80 border border-current">
                        Token valid: {testResult.tokenDaysRemaining} zile
                      </span>
                    )}
                  </div>
                  <p className="text-xs">{testResult.message}</p>
                  {testResult.detail && <p className="text-[11px] opacity-80 font-mono">{testResult.detail}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-xs opacity-60 hover:opacity-100 p-1 cursor-pointer font-bold"
                title="Închide raportul de diagnostic"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* TABURI MARI DE NAVIGARE PE MODULE SPV */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMainModuleTab("inbox_messages")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainModuleTab === "inbox_messages"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Mesaje & Recipise SPV ({adminMessages?.length || 0})</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </button>

          <button
            type="button"
            onClick={() => setMainModuleTab("efactura_invoices")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainModuleTab === "efactura_invoices"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Facturi e-Factura ({logs?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setMainModuleTab("fiscal_mediation")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainModuleTab === "fiscal_mediation"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <Gavel className="w-4 h-4 text-red-500" />
            <span>Mediere Fiscală Online (Ord. 992/2026)</span>
            <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded-full font-extrabold">
              15 zile
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMainModuleTab("tax_loan")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              mainModuleTab === "tax_loan"
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <HandCoins className="w-4 h-4 text-teal-500" />
            <span>Contract Împrumut Taxe Terț / Asociat</span>
          </button>
        </div>

        {/* ─── MODUL 1: MESAJE ȘI RECIPISE ADMINISTRATIVE SPV ─── */}
        {mainModuleTab === "inbox_messages" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-blue-600" />
                  <span>Inbox Mesaje Oficiale & Recipise Declarații SPV</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Mesaje administrative primite de la ANAF: confirmări recipise (D112, D300, D394), notificări de conformare, decizii și somații.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMessageOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Înregistrează Recipisă / Notificare SPV</span>
                </button>
              </div>
            </div>

            {/* Filtre și Căutare Mesaje SPV */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setAdminMessageTypeFilter("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    adminMessageTypeFilter === "all"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  Toate ({adminMessages?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminMessageTypeFilter("recipisa")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    adminMessageTypeFilter === "recipisa"
                      ? "bg-purple-600 text-white"
                      : "bg-white text-purple-700 border border-purple-200"
                  }`}
                >
                  📑 Recipise Declarații (D112/D300/D394)
                </button>
                <button
                  type="button"
                  onClick={() => setAdminMessageTypeFilter("notificare_conformare")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    adminMessageTypeFilter === "notificare_conformare"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-blue-700 border border-blue-200"
                  }`}
                >
                  ⚠️ Notificări Conformare
                </button>
                <button
                  type="button"
                  onClick={() => setAdminMessageTypeFilter("somatie")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    adminMessageTypeFilter === "somatie"
                      ? "bg-red-600 text-white"
                      : "bg-white text-red-700 border border-red-200"
                  }`}
                >
                  🚨 Somații & Mediere
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  value={searchAdminMessage}
                  onChange={(e) => setSearchAdminMessage(e.target.value)}
                  placeholder="Caută în mesaje..."
                  className="pl-8 text-xs h-8"
                />
              </div>
            </div>

            {/* Lista Mesajelor SPV */}
            <div className="grid grid-cols-1 gap-3">
              {isLoadingAdminMessages ? (
                <div className="p-8 space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : filteredAdminMessages?.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-sm">Nu există mesaje administrative care să corespundă filtrului.</p>
                </div>
              ) : (
                filteredAdminMessages?.map((msg: any) => {
                  const isRecipisa = msg.type === "recipisa";
                  const isSomatie = msg.type === "somatie";
                  const isNotif = msg.type === "notificare_conformare";

                  return (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isSomatie
                          ? "bg-red-50/50 border-red-200 dark:bg-red-950/20"
                          : isNotif
                          ? "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                      } hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isSomatie
                              ? "bg-red-100 text-red-700"
                              : isNotif
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {isSomatie ? (
                            <Gavel className="w-5 h-5" />
                          ) : isNotif ? (
                            <AlertCircle className="w-5 h-5" />
                          ) : (
                            <FileCheck className="w-5 h-5" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {msg.title}
                            </span>
                            {msg.declarationType && (
                              <Badge variant="outline" className="text-[10px] font-bold bg-white/80">
                                {msg.declarationType}
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-[10px] font-bold ${getStatusColor(msg.status)}`}>
                              {msg.status?.toUpperCase()}
                            </Badge>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                            {msg.details}
                          </p>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 tabular-nums flex-wrap pt-0.5">
                            <span>Data SPV: <strong>{msg.receivedDate}</strong></span>
                            {msg.spvIndex && (
                              <span>ID / Index: <strong className="font-mono">{msg.spvIndex}</strong></span>
                            )}
                            {msg.docNumber && (
                              <span>Doc: <strong>{msg.docNumber}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Acțiuni Mesaj SPV */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        {isSomatie && (
                          <button
                            type="button"
                            onClick={() => {
                              setMediationForm((prev) => ({
                                ...prev,
                                somatieNr: msg.docNumber || prev.somatieNr,
                                somatieDate: msg.receivedDate || prev.somatieDate,
                              }));
                              setMainModuleTab("fiscal_mediation");
                              setIsMediationModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Gavel className="w-3.5 h-3.5" />
                            <span>Inițiază Mediere (15 zile)</span>
                          </button>
                        )}

                        {msg.fileName && (
                          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 text-xs rounded-md border font-mono">
                            {msg.fileName}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ─── MODUL 2: FACTURI e-FACTURA & CONEXIUNE LIVE ─── */}
        {mainModuleTab === "efactura_invoices" && (
          <div className="space-y-4">
            {/* Carduri Statistici e-Factura */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Facturi Trimise (Clienți)
                  </CardTitle>
                  <UploadCloud className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {invoiceStats.trimise}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Emise și transmise către ANAF</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Facturi Primite (Furnizori)
                  </CardTitle>
                  <DownloadCloud className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {invoiceStats.primite}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Descărcate automat din SPV</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Validate la ANAF
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums text-emerald-600">
                    {invoiceStats.validate}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Semnătură oficială MF confirmată</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Erori / Respingeri ANAF
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold tabular-nums ${invoiceStats.erori > 0 ? "text-red-600" : "text-slate-700"}`}>
                    {invoiceStats.erori}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Facturi cu atenționări de structură</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabelul de Facturi SPV */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                      Documente RO e-Factura
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Toate facturile primite și emise sincronizate prin API-ul oficial ANAF FCTEL.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 max-w-sm w-full">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="text"
                        value={searchInvoiceQuery}
                        onChange={(e) => setSearchInvoiceQuery(e.target.value)}
                        placeholder="Caută nr. factură, partener, CUI sau index..."
                        className="pl-8 text-xs h-8"
                      />
                    </div>

                    <Select value={filterInvoiceStatus} onValueChange={setFilterInvoiceStatus}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toate Statusurile</SelectItem>
                        <SelectItem value="validat">Validat</SelectItem>
                        <SelectItem value="eroare">Eroare</SelectItem>
                        <SelectItem value="in_procesare">În procesare</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Butoane rapide de filtru */}
                <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveInvoiceTab("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeInvoiceTab === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Toate Facturile ({logs?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveInvoiceTab("primita")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeInvoiceTab === "primita"
                        ? "bg-purple-600 text-white"
                        : "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200"
                    }`}
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Facturi Primite ({invoiceStats.primite})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveInvoiceTab("trimisa")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      activeInvoiceTab === "trimisa"
                        ? "bg-blue-600 text-white"
                        : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                    }`}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Facturi Trimise ({invoiceStats.trimise})</span>
                  </button>
                  {invoiceStats.erori > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveInvoiceTab("eroare")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeInvoiceTab === "eroare"
                          ? "bg-red-600 text-white"
                          : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Erori ANAF ({invoiceStats.erori})</span>
                    </button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isLoadingLogs ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : filteredInvoiceLogs?.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm">Nu există facturi care să corespundă căutării.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/70 dark:bg-slate-900/70 text-[11px]">
                          <TableHead className="w-10 text-center">Tip</TableHead>
                          <TableHead className="w-28">Data SPV</TableHead>
                          <TableHead className="w-36">Index Încărcare SPV</TableHead>
                          <TableHead className="w-36">Număr Factură</TableHead>
                          <TableHead>Partener & CUI</TableHead>
                          <TableHead className="text-right w-28">Valoare Totală</TableHead>
                          <TableHead className="w-24">Stare ANAF</TableHead>
                          <TableHead className="w-24 text-center">Acțiuni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {filteredInvoiceLogs?.map((log) => {
                          const isReceived = log.type === "primita";
                          const partnerCui = (log as any).partnerCui || "";

                          return (
                            <TableRow key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60">
                              <TableCell className="text-center py-2.5">
                                <span
                                  className={`w-7 h-7 rounded-lg inline-flex items-center justify-center ${
                                    isReceived
                                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                      : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  }`}
                                  title={isReceived ? "Factură Primită (Furnizor)" : "Factură Trimisă (Client)"}
                                >
                                  {isReceived ? <DownloadCloud className="w-4 h-4" /> : <UploadCloud className="w-4 h-4" />}
                                </span>
                              </TableCell>

                              <TableCell className="py-2.5 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                                    {format(new Date(log.date), "dd.MM.yyyy", { locale: ro })}
                                  </span>
                                  <span className="text-[10.5px] tabular-nums text-slate-500">
                                    {format(new Date(log.date), "HH:mm")}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="py-2.5">
                                {log.spvIndex ? (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="tabular-nums font-mono text-[10.5px] bg-slate-50 dark:bg-slate-800">
                                      {log.spvIndex}
                                    </Badge>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopyIndex(log.spvIndex!, e)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                      title="Copiază ID încărcare SPV"
                                    >
                                      {copiedIndex === log.spvIndex ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">Fără Index</span>
                                )}
                              </TableCell>

                              <TableCell className="py-2.5">
                                <span className="font-bold text-slate-900 dark:text-white">{log.invoiceNumber}</span>
                              </TableCell>

                              <TableCell className="py-2.5">
                                <div className="flex flex-col max-w-[240px]">
                                  <span className="font-medium text-slate-900 dark:text-white truncate">{log.partnerName}</span>
                                  {partnerCui && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span className="text-[10.5px] text-slate-500 tabular-nums font-mono">CUI: {partnerCui}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => handleCopyCui(partnerCui, e)}
                                        className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                        title="Copiază CUI"
                                      >
                                        {copiedCui === partnerCui ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="py-2.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                                {Number(log.total).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} {log.currency}
                              </TableCell>

                              <TableCell className="py-2.5">
                                <Badge variant="outline" className={`text-[10px] font-bold ${getStatusColor(log.spvStatus)}`}>
                                  {log.spvStatus?.toUpperCase()}
                                </Badge>
                              </TableCell>

                              <TableCell className="py-2.5 text-center">
                                {(log as any).pdfUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewDoc({
                                        isOpen: true,
                                        title: `Factura ${log.invoiceNumber} — ${log.partnerName}`,
                                        pdfUrl: (log as any).pdfUrl,
                                        filename: `Factura_${log.invoiceNumber}.pdf`,
                                        type: isReceived ? "invoice" : "emitted",
                                      })
                                    }
                                    className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 inline-flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                                    title="Previzualizează factura PDF"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── MODUL 3: MEDIERE FISCALĂ ONLINE (ORDIN ANAF 992/2026) ─── */}
        {mainModuleTab === "fiscal_mediation" && (
          <div className="space-y-5">
            <div className="p-5 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border border-red-200 dark:border-red-900 rounded-2xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Gavel className="w-6 h-6 text-red-600" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Procedură de Mediere Fiscală Online (Ordin ANAF 992/2026)
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                    Conform <strong>Ordinului ANAF nr. 992/2026</strong> publicat în Monitorul Oficial, contribuabilii pot solicita desfășurarea procedurii de mediere <strong>online prin videoconferință</strong> fără a mai fi necesară deplasarea fizică la sediul ANAF.
                  </p>
                </div>

                {/* Contor Zile Termen 15 Zile */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-red-300 shadow-xs text-center shrink-0 min-w-[200px]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Termen Legal de Depunere</span>
                  <div className="text-2xl font-extrabold tabular-nums text-red-600 mt-0.5">
                    {mediationDaysRemaining.isExpired ? "TERMEN EXPIRAT" : `${mediationDaysRemaining.days} ZILE RĂMASE`}
                  </div>
                  <span className="text-[10.5px] text-slate-500">
                    Limită depunere: <strong>{mediationDaysRemaining.deadlineDateStr}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Formular Notificare Mediere */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-600" />
                  <span>Generator Notificare de Mediere Fiscală prin Videoconferință</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Completează datele somației pentru a genera documentul oficial gata de semnat și transmis prin SPV la ANAF.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Număr Somație de Plată ANAF</Label>
                    <Input
                      value={mediationForm.somatieNr}
                      onChange={(e) => setMediationForm({ ...mediationForm, somatieNr: e.target.value })}
                      placeholder="ex: SOM-2026-0041"
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Data Comunicării Somației în SPV</Label>
                    <Input
                      type="date"
                      value={mediationForm.somatieDate}
                      onChange={(e) => setMediationForm({ ...mediationForm, somatieDate: e.target.value })}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Suma Înscrisă în Somație (RON)</Label>
                    <Input
                      value={mediationForm.amount}
                      onChange={(e) => setMediationForm({ ...mediationForm, amount: e.target.value })}
                      placeholder="ex: 15.420,00"
                      className="text-xs mt-1 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Motivul / Obiectul Medierii</Label>
                  <Input
                    value={mediationForm.reason}
                    onChange={(e) => setMediationForm({ ...mediationForm, reason: e.target.value })}
                    placeholder="ex: Clarificarea obligațiilor și corelarea plăților efectuate cu evidența ANAF"
                    className="text-xs mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Email pentru Primirea Link-ului de Videoconferință</Label>
                    <Input
                      value={mediationForm.videoconferenceEmail || currentTenant?.email || ""}
                      onChange={(e) => setMediationForm({ ...mediationForm, videoconferenceEmail: e.target.value })}
                      placeholder="email@firma.ro"
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Reprezentant Legal / Administrator</Label>
                    <Input
                      value={mediationForm.representativeName || currentTenant?.name || ""}
                      onChange={(e) => setMediationForm({ ...mediationForm, representativeName: e.target.value })}
                      placeholder="Nume Prenume Administrator"
                      className="text-xs mt-1"
                    />
                  </div>
                </div>

                {/* Previzualizare & Print Document */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      📄 Textul oficial conform Ordinului ANAF nr. 992/2026:
                    </span>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1 bg-white hover:bg-slate-100 border text-slate-700 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Printează / Salvează PDF</span>
                    </button>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-950 border rounded-lg text-xs leading-relaxed font-sans text-slate-800 dark:text-slate-200">
                    <p className="text-center font-bold text-sm text-red-700 uppercase mb-3">
                      NOTIFICARE PRIVIND INTENȚIA DE MEDIERE FISCALĂ PRIN VIDEOCONFERINȚĂ
                    </p>
                    <p className="text-right text-[11px] mb-2">
                      Către: <strong>D.G.R.F.P. / Administrația Finanțelor Publice competentă</strong>
                    </p>
                    <p className="mb-2">
                      Subscrisa, <strong>{currentTenant?.name || "S.C. COMPANIE S.R.L."}</strong>, CUI: <strong>{currentTenant?.cui || "RO..."}</strong>, cu sediul în {currentTenant?.address || "..."}, reprezentată legal de {mediationForm.representativeName || "Administrator"},
                    </p>
                    <p className="mb-2">
                      în temeiul art. 230 din Legea nr. 207/2015 privind Codul de procedură fiscală și al <strong>Ordinului ANAF nr. 992/2026</strong>, formulează prezenta <strong>NOTIFICARE PRIVIND INTENȚIA DE MEDIERE</strong> cu privire la Somația nr. <strong>{mediationForm.somatieNr}</strong> din data de {mediationForm.somatieDate}.
                    </p>
                    <p className="mb-2 font-semibold text-blue-900 dark:text-blue-400">
                      • Solicităm în mod expres desfășurarea ședinței de mediere online, prin platforma de videoconferință a Ministerului Finanțelor / ANAF, link-ul urmând a fi transmis la adresa de email: <u>{mediationForm.videoconferenceEmail || currentTenant?.email || "email@firma.ro"}</u>.
                    </p>
                    <p className="mb-2">
                      • Obiectul medierii: {mediationForm.reason}.
                    </p>
                    <p className="text-[11px] text-slate-500 italic mt-3">
                      * Măsurile de executare silită se suspendă de drept de la data înregistrării acestei notificări în SPV.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── MODUL 4: CONTRACT ÎMPRUMUT ASOCIAT PENTRU TAXE ─── */}
        {mainModuleTab === "tax_loan" && (
          <div className="space-y-5">
            <div className="p-5 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20 border border-teal-200 dark:border-teal-900 rounded-2xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-6 h-6 text-teal-600" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Contract de Împrumut Asociat pentru Plata Obligațiilor Fiscale
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                    Soluție legală analizată în articol: Când administratorul sau asociatul plătește taxele firmei din contul propriu către Trezoreria Statului, <strong>ANAF cere obligatoriu contract de împrumut justificativ</strong> pentru a nu recalifica sumele ca venituri nejustificate.
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-teal-300 shadow-xs text-center shrink-0 min-w-[200px]">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Temei Legal Fiscal</span>
                  <div className="text-sm font-extrabold text-teal-700 mt-0.5">Art. 165 Cod Proc. Fiscală</div>
                  <span className="text-[10.5px] text-slate-500">Cont contabil: <strong>4551 Asociați</strong></span>
                </div>
              </div>
            </div>

            {/* Generator Formular Contract */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <HandCoins className="w-4 h-4 text-teal-600" />
                  <span>Generează Contractul Legal de Împrumut Asociat</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Completează datele asociatului creditor pentru a genera contractul justificativ gata de semnat și atașat la contabilitate.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Număr Contract</Label>
                    <Input
                      value={taxLoanForm.contractNumber}
                      onChange={(e) => setTaxLoanForm({ ...taxLoanForm, contractNumber: e.target.value })}
                      className="text-xs mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Data Acordării Împrumutului</Label>
                    <Input
                      type="date"
                      value={taxLoanForm.contractDate}
                      onChange={(e) => setTaxLoanForm({ ...taxLoanForm, contractDate: e.target.value })}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Suma Plătită / Împrumutată (RON)</Label>
                    <Input
                      value={taxLoanForm.amount}
                      onChange={(e) => setTaxLoanForm({ ...taxLoanForm, amount: e.target.value })}
                      placeholder="ex: 25.000"
                      className="text-xs mt-1 font-bold font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold">Nume Asociat / Administrator Plătitor</Label>
                    <Input
                      value={taxLoanForm.shareholderName}
                      onChange={(e) => setTaxLoanForm({ ...taxLoanForm, shareholderName: e.target.value })}
                      placeholder="Nume Prenume Asociat"
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">CNP Asociat</Label>
                    <Input
                      value={taxLoanForm.shareholderCnp}
                      onChange={(e) => setTaxLoanForm({ ...taxLoanForm, shareholderCnp: e.target.value })}
                      placeholder="180..."
                      className="text-xs mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Domiciliu / Adresă Asociat</Label>
                    <Input
                      value={taxLoanForm.shareholderAddress}
                      onChange={(e) => setTaxLoanForm({ ...taxLoanForm, shareholderAddress: e.target.value })}
                      placeholder="Oraș, Str. ..., Jud. ..."
                      className="text-xs mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Destinația Specială a Sumei</Label>
                  <Input
                    value={taxLoanForm.purpose}
                    onChange={(e) => setTaxLoanForm({ ...taxLoanForm, purpose: e.target.value })}
                    className="text-xs mt-1"
                  />
                </div>

                {/* Previzualizare și Salvare în Contracte */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      📄 Previzualizare Clauze Contractuale de Justificare Fiscală:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1 bg-white hover:bg-slate-100 border text-slate-700 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Printează</span>
                      </button>

                      <button
                        type="button"
                        disabled={createContractMutation.isPending}
                        onClick={() => {
                          createContractMutation.mutate({
                            title: `Contract Împrumut Asociat Taxe - ${taxLoanForm.contractNumber}`,
                            number: taxLoanForm.contractNumber,
                            type: "imprumut_asociat",
                            status: "activ",
                            startDate: taxLoanForm.contractDate,
                            validUntil: taxLoanForm.validUntil,
                            value: taxLoanForm.amount,
                            currency: taxLoanForm.currency,
                            contentHtml: `<p>Contract împrumut asociat ${taxLoanForm.shareholderName} pentru stingere obligații fiscale în valoare de ${taxLoanForm.amount} ${taxLoanForm.currency}.</p>`,
                          });
                        }}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-md shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Salvează în Bibliotecă Contracte</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-950 border rounded-lg text-xs leading-relaxed font-sans text-slate-800 dark:text-slate-200">
                    <p className="text-center font-bold text-sm text-teal-800 uppercase mb-3">
                      CONTRACT DE ÎMPRUMUT ASOCIAT PENTRU STINGERE OBLIGAȚII FISCALE
                    </p>
                    <p className="mb-2">
                      Între <strong>{taxLoanForm.shareholderName || "[Nume Asociat]"}</strong> (Împrumutător) și <strong>{currentTenant?.name || "Societate Comercială"}</strong>, CUI {currentTenant?.cui || "..."}, (Împrumutat).
                    </p>
                    <p className="mb-2">
                      <strong>Art. 1 Obiect:</strong> Împrumutătorul acordă Împrumutatului un împrumut financiar în sumă de <strong>{taxLoanForm.amount} {taxLoanForm.currency}</strong> cu destinația strictă și exclusivă de plată directă a obligațiilor fiscale datorate de societate către Bugetul de Stat (Trezorerie).
                    </p>
                    <p className="mb-2">
                      <strong>Art. 2 Dobândă:</strong> Împrumutul este acordat cu <strong>dobândă 0%</strong> în scopul evitării blocării activității economice și a executării silite.
                    </p>
                    <p className="text-[11px] text-slate-500 italic mt-3">
                      * Document justificativ pentru înregistrare în contul 4551 conform Codului Fiscal.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ghid practic ANAF SPV */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>Ghid de utilizare și funcționare SPV ANAF (e-Factura & Mesaje Fiscale)</span>
          </div>
          <p>
            • <strong>Sincronizare automată:</strong> Cron-ul securizat interoghează serverele ANAF o singură dată pe zi, dimineața la ora <strong>09:00</strong>. Sincronizarea manuală poate fi declanșată oricând din butonul dedicat.
          </p>
          <p>
            • <strong>Mediere Fiscală Online (Ord. 992/2026):</strong> Dacă primiți o somație de plată prin SPV, aveți dreptul legal ca în termen de <strong>15 zile</strong> să solicitați medierea online prin videoconferință, suspendând automat executarea silită.
          </p>
          <p>
            • <strong>Plata obligațiilor fiscale de către terți/administratori:</strong> Se poate efectua direct în Trezorerie, fiind însă obligatoriu contractul de împrumut asociat pentru justificarea la inspecția fiscală.
          </p>
        </div>
      </div>

      {/* Modal Adăugare Recipisă / Notificare SPV */}
      <Dialog open={isAddMessageOpen} onOpenChange={setIsAddMessageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-blue-600" />
              <span>Înregistrează Recipisă / Notificare SPV</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adaugă o recipisă de declarație (D112, D300) sau o notificare primită în SPV pentru a fi păstrată în dosarul fiscal al firmei.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e: any) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              addAdminMessageMutation.mutate({
                type: fd.get("type") as any,
                title: String(fd.get("title")),
                declarationType: String(fd.get("declarationType")),
                docNumber: String(fd.get("docNumber")),
                spvIndex: String(fd.get("spvIndex")),
                status: fd.get("status") as any,
                receivedDate: String(fd.get("receivedDate")),
                details: String(fd.get("details")),
                fileName: String(fd.get("fileName")),
              });
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <Label className="text-xs">Tip Mesaj SPV</Label>
              <select name="type" className="w-full mt-1 border rounded-md p-1.5 bg-white dark:bg-slate-900 text-xs">
                <option value="recipisa">📑 Recipisă Declarație Fiscală (D112, D300, D394)</option>
                <option value="notificare_conformare">⚠️ Notificare de Conformare ANAF</option>
                <option value="somatie">🚨 Somație de Plată & Titlu Executoriu</option>
                <option value="extras_trezorerie">📄 Extras Cont Trezorerie</option>
                <option value="altul">ℹ️ Alt document oficial SPV</option>
              </select>
            </div>

            <div>
              <Label className="text-xs">Titlu Mesaj / Notificare</Label>
              <Input name="title" required placeholder="ex: Recipisă Declarația 112 luna curentă" className="text-xs mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tip Declarație</Label>
                <Input name="declarationType" placeholder="ex: D112 / D300" className="text-xs mt-1" />
              </div>
              <div>
                <Label className="text-xs">Data SPV</Label>
                <Input name="receivedDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required className="text-xs mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Index Încărcare SPV</Label>
                <Input name="spvIndex" placeholder="ex: 84920192" className="text-xs mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-xs">Nr. Document / Înregistrare</Label>
                <Input name="docNumber" placeholder="ex: REC-112-2026" className="text-xs mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Status Procesare ANAF</Label>
              <select name="status" className="w-full mt-1 border rounded-md p-1.5 bg-white dark:bg-slate-900 text-xs">
                <option value="validat">✓ Validat fără erori de calcul</option>
                <option value="avertisment">⚠️ Atenționare / În termen</option>
                <option value="eroare">✕ Eroare / Respins de ANAF</option>
              </select>
            </div>

            <div>
              <Label className="text-xs">Detalii / Observații ANAF</Label>
              <Input name="details" placeholder="ex: Declarație prelucrată cu succes în SPV" className="text-xs mt-1" />
            </div>

            <div>
              <Label className="text-xs">Nume Fișier Recipisă (PDF/ZIP)</Label>
              <Input name="fileName" placeholder="ex: Recipisa_D112.pdf" className="text-xs mt-1 font-mono" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsAddMessageOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={addAdminMessageMutation.isPending}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {addAdminMessageMutation.isPending ? "Se salvează..." : "Salvează în Dosar"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Universal Previzualizare PDF */}
      <DocumentModalPreview
        isOpen={previewDoc.isOpen}
        onClose={() => setPreviewDoc((prev) => ({ ...prev, isOpen: false, pdfUrl: null }))}
        title={previewDoc.title}
        pdfUrl={previewDoc.pdfUrl}
        filename={previewDoc.filename}
        type={previewDoc.type}
      />
    </>
  );
}
