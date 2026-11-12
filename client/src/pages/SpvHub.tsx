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
  Building2,
  KeyRound,
  Gavel,
  HandCoins,
  Video,
  Calendar,
  AlertTriangle,
  PlusCircle,
  FileCheck,
  Printer,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

  // Tab Principal de Navigare — Implicit pe FACTURI pentru claritate maximă
  const [mainModuleTab, setMainModuleTab] = useState<"efactura_invoices" | "inbox_messages" | "fiscal_mediation" | "tax_loan">("efactura_invoices");

  // Filtre Facturi e-Factura
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<"all" | "primita" | "trimisa" | "eroare">("all");
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState<string>("all");
  const [searchInvoiceQuery, setSearchInvoiceQuery] = useState<string>("");

  // Filtre Mesaje Administrative SPV
  const [adminMessageTypeFilter, setAdminMessageTypeFilter] = useState<string>("all");
  const [searchAdminMessage, setSearchAdminMessage] = useState<string>("");

  // Stare Diagnostic & Copiere
  const [testResult, setTestResult] = useState<any>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [copiedCui, setCopiedCui] = useState<string | null>(null);

  // Modale interactive
  const [isAddMessageOpen, setIsAddMessageOpen] = useState(false);

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
      toast.success("Mesajul / recipisa a fost salvată!");
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
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
        {/* Antet Pagina SPV ANAF — Curat și compact */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                SPV ANAF
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Conectat
              </span>
              {daysUntilExpiration != null && (
                <span className="text-xs text-slate-500 tabular-nums">
                  Token: <strong>{daysUntilExpiration} zile</strong>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Sincronizare automată zilnic la 09:00 • Facturi e-Factura, recipise oficiale și asistență fiscală
            </p>
          </div>

          {/* Butoane Acțiuni Principale Conexiune */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => testSpvMutation.mutate()}
              disabled={testSpvMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Trimite un ping către ANAF și verifică starea token-ului"
            >
              {testSpvMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Se testează...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Testează Conexiunea SPV</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => syncSpvMutation.mutate()}
              disabled={syncSpvMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1F4E79] hover:bg-[#102A43] disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Descarcă facturi noi din SPV"
            >
              {syncSpvMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Se descarcă...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sincronizează Acum</span>
                </>
              )}
            </button>

            {oauthInfo?.url && (
              <a
                href={oauthInfo.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                title="Reautorizează token-ul ANAF"
              >
                <KeyRound className="w-3 h-3 text-slate-500" />
                <span>Reautorizare</span>
              </a>
            )}
          </div>
        </div>

        {/* Card Diagnostic Conexiune SPV (apare doar când dai click pe Testează) */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              testResult.connected
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100"
                : "bg-red-50/90 border-red-200 text-red-950 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {testResult.connected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-bold">
                    {testResult.connected ? "Conexiune SPV Activă" : "Conexiune Eșuată"}
                  </span>
                  {testResult.latencyMs != null && (
                    <span className="px-2 py-0.5 rounded font-mono font-semibold bg-white/80 dark:bg-slate-900/80 border">
                      Latență: {testResult.latencyMs} ms
                    </span>
                  )}
                  {testResult.cui && (
                    <span className="px-2 py-0.5 rounded font-mono font-semibold bg-white/80 dark:bg-slate-900/80 border">
                      CUI: {testResult.cui}
                    </span>
                  )}
                  {testResult.tokenDaysRemaining != null && (
                    <span className="px-2 py-0.5 rounded font-semibold bg-white/80 dark:bg-slate-900/80 border">
                      Token valid: {testResult.tokenDaysRemaining} zile
                    </span>
                  )}
                  <span className="opacity-90">{testResult.message}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-xs p-1 hover:opacity-100 opacity-60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TABURI PRINCIPALE CURATE */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMainModuleTab("efactura_invoices")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              mainModuleTab === "efactura_invoices"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Facturi e-Factura</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {logs?.length || 0}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setMainModuleTab("inbox_messages")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              mainModuleTab === "inbox_messages"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Mesaje & Recipise SPV</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {adminMessages?.length || 0}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setMainModuleTab("fiscal_mediation")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              mainModuleTab === "fiscal_mediation"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Gavel className="w-4 h-4 text-red-500" />
            <span>Mediere Fiscală Online</span>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
              Ord. 992/2026
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMainModuleTab("tax_loan")}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 shrink-0 ${
              mainModuleTab === "tax_loan"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <HandCoins className="w-4 h-4 text-teal-500" />
            <span>Contract Împrumut Taxe</span>
          </button>
        </div>

        {/* ─── TAB 1: FACTURI e-FACTURA (IMPLICIT) ─── */}
        {mainModuleTab === "efactura_invoices" && (
          <div className="space-y-4">
            {/* Carduri Statistici e-Factura */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Facturi Trimise</CardTitle>
                  <UploadCloud className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums">{invoiceStats.trimise}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Emise către clienți</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Facturi Primite</CardTitle>
                  <DownloadCloud className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums">{invoiceStats.primite}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Descărcate din SPV</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Validate la ANAF</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-emerald-600">{invoiceStats.validate}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Semnătură oficială MF</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Erori / Atenționări</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-red-600">{invoiceStats.erori}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Respinse sau atenționări</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabel Facturi e-Factura */}
            <Card className="shadow-2xs border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveInvoiceTab("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeInvoiceTab === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Toate ({logs?.length || 0})
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
                    <span>Primite ({invoiceStats.primite})</span>
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
                    <span>Trimise ({invoiceStats.trimise})</span>
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
                      <span>Erori ({invoiceStats.erori})</span>
                    </button>
                  )}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={searchInvoiceQuery}
                    onChange={(e) => setSearchInvoiceQuery(e.target.value)}
                    placeholder="Caută nr. factură, partener, CUI..."
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isLoadingLogs ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
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
                          <TableHead className="w-36">Index SPV</TableHead>
                          <TableHead className="w-36">Număr Factură</TableHead>
                          <TableHead>Partener & CUI</TableHead>
                          <TableHead className="text-right w-28">Valoare Totală</TableHead>
                          <TableHead className="w-24">Stare ANAF</TableHead>
                          <TableHead className="w-20 text-center">PDF</TableHead>
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
                                  className={`w-6 h-6 rounded-md inline-flex items-center justify-center ${
                                    isReceived
                                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                      : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                  }`}
                                  title={isReceived ? "Factură Primită" : "Factură Trimisă"}
                                >
                                  {isReceived ? <DownloadCloud className="w-3.5 h-3.5" /> : <UploadCloud className="w-3.5 h-3.5" />}
                                </span>
                              </TableCell>

                              <TableCell className="py-2.5 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                                    {format(new Date(log.date), "dd.MM.yyyy", { locale: ro })}
                                  </span>
                                  <span className="text-[10px] tabular-nums text-slate-500">
                                    {format(new Date(log.date), "HH:mm")}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="py-2.5">
                                {log.spvIndex ? (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="tabular-nums font-mono text-[10.5px]">
                                      {log.spvIndex}
                                    </Badge>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopyIndex(log.spvIndex!, e)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                      title="Copiază ID"
                                    >
                                      {copiedIndex === log.spvIndex ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">-</span>
                                )}
                              </TableCell>

                              <TableCell className="py-2.5">
                                <span className="font-bold text-slate-900 dark:text-white">{log.invoiceNumber}</span>
                              </TableCell>

                              <TableCell className="py-2.5">
                                <div className="flex flex-col max-w-[220px]">
                                  <span className="font-medium text-slate-900 dark:text-white truncate">{log.partnerName}</span>
                                  {partnerCui && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-slate-500 tabular-nums font-mono">CUI: {partnerCui}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => handleCopyCui(partnerCui, e)}
                                        className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
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
                                    className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 inline-flex items-center justify-center transition-colors cursor-pointer"
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

        {/* ─── TAB 2: MESAJE & RECIPISE SPV (FORMAT TABELAR CURAT) ─── */}
        {mainModuleTab === "inbox_messages" && (
          <div className="space-y-4">
            <Card className="shadow-2xs border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAdminMessageTypeFilter("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      adminMessageTypeFilter === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
                        : "bg-purple-50 text-purple-700 border border-purple-200"
                    }`}
                  >
                    Recipise (D112/D300/D394)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminMessageTypeFilter("notificare_conformare")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      adminMessageTypeFilter === "notificare_conformare"
                        ? "bg-blue-600 text-white"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}
                  >
                    Notificări Conformare
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminMessageTypeFilter("somatie")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      adminMessageTypeFilter === "somatie"
                        ? "bg-red-600 text-white"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    Somații
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      value={searchAdminMessage}
                      onChange={(e) => setSearchAdminMessage(e.target.value)}
                      placeholder="Caută recipisă..."
                      className="pl-8 text-xs h-8"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddMessageOpen(true)}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Adaugă</span>
                  </button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isLoadingAdminMessages ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ) : filteredAdminMessages?.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm">Nu există mesaje înregistrate.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/70 dark:bg-slate-900/70 text-[11px]">
                          <TableHead className="w-28">Data SPV</TableHead>
                          <TableHead className="w-28">Tip</TableHead>
                          <TableHead className="w-32">Index SPV</TableHead>
                          <TableHead>Titlu & Descriere Mesaj</TableHead>
                          <TableHead className="w-24">Stare</TableHead>
                          <TableHead className="w-32 text-center">Acțiune</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {filteredAdminMessages?.map((msg: any) => {
                          const isSomatie = msg.type === "somatie";
                          return (
                            <TableRow key={msg.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60">
                              <TableCell className="font-semibold tabular-nums whitespace-nowrap">
                                {msg.receivedDate}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                  {msg.declarationType || msg.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-slate-600 dark:text-slate-400">
                                {msg.spvIndex || "-"}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-900 dark:text-white">{msg.title}</div>
                                  <div className="text-[11px] text-slate-500 line-clamp-1">{msg.details}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] font-bold ${getStatusColor(msg.status)}`}>
                                  {msg.status?.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {isSomatie ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMediationForm((prev) => ({
                                        ...prev,
                                        somatieNr: msg.docNumber || prev.somatieNr,
                                        somatieDate: msg.receivedDate || prev.somatieDate,
                                      }));
                                      setMainModuleTab("fiscal_mediation");
                                    }}
                                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-md shadow-2xs transition-colors cursor-pointer"
                                  >
                                    Cere Mediere
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {msg.fileName || "Validat SPV"}
                                  </span>
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

        {/* ─── TAB 3: MEDIERE FISCALĂ ONLINE (ORDIN ANAF 992/2026) ─── */}
        {mainModuleTab === "fiscal_mediation" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Formular Mediere (Coloana Stângă) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="shadow-2xs border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Gavel className="w-4 h-4 text-red-600" />
                      <span>Notificare Mediere Online</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                      Ord. 992/2026
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Cerere de mediere prin videoconferință (termen legal 15 zile de la primirea somației).
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3.5">
                  {/* Contor Zile */}
                  <div className="p-3 bg-red-50/70 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-red-700 dark:text-red-300">Termen de depunere</div>
                      <div className="text-xl font-extrabold text-red-600 tabular-nums">
                        {mediationDaysRemaining.isExpired ? "Termen depășit" : `${mediationDaysRemaining.days} zile rămase`}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-600 dark:text-slate-400">
                      Dată limită:<br />
                      <strong className="text-slate-900 dark:text-white">{mediationDaysRemaining.deadlineDateStr}</strong>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Număr Somație de Plată</Label>
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
                      placeholder="ex: 15.420"
                      className="text-xs mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Email pentru Link Videoconferință ANAF</Label>
                    <Input
                      type="email"
                      value={mediationForm.videoconferenceEmail}
                      onChange={(e) => setMediationForm({ ...mediationForm, videoconferenceEmail: e.target.value })}
                      placeholder="office@firma.ro"
                      className="text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Obiectul Medierii / Clarificării</Label>
                    <textarea
                      value={mediationForm.reason}
                      onChange={(e) => setMediationForm({ ...mediationForm, reason: e.target.value })}
                      rows={3}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 mt-1 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Printează / Descarcă Notificarea</span>
                  </button>
                </CardContent>
              </Card>
            </div>

            {/* Previzualizare Document Oficial (Coloana Dreaptă) */}
            <div className="lg:col-span-7">
              <Card className="shadow-2xs border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800">
                  <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Previzualizare Formular Oficial ANAF (Conform art. 230 Cod Proc. Fiscală)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 font-serif text-xs leading-relaxed text-slate-800 dark:text-slate-200 space-y-4 bg-white dark:bg-slate-900 m-4 rounded-xl border">
                  <div className="text-center border-b pb-3 space-y-1">
                    <h3 className="font-bold text-sm text-red-700">NOTIFICARE PRIVIND INTENȚIA DE MEDIERE</h3>
                    <p className="text-[10px] text-slate-500">Conform art. 230 din Legea 207/2015 și Ordinului ANAF nr. 992/2026</p>
                  </div>

                  <p className="text-right text-[11px]">
                    <strong>Către: DIRECȚIA GENERALĂ REGIONALĂ A FINANȚELOR PUBLICE</strong>
                  </p>

                  <p>
                    Subscrisa <strong>{currentTenant?.name || "SOCIETATE"}</strong>, CUI <strong>{currentTenant?.cui || "-"}</strong>, reprezentată legal, formulează prezenta notificare de mediere:
                  </p>

                  <p>
                    1. <strong>Termen legal:</strong> Prezenta este depusă în termenul de 15 zile de la comunicarea Somației nr. <strong>{mediationForm.somatieNr}</strong> din data de <strong>{mediationForm.somatieDate}</strong> în valoare de <strong>{mediationForm.amount} RON</strong>.
                  </p>

                  <p>
                    2. <strong>Opțiune videoconferință (Ordin ANAF 992/2026):</strong> Solicităm desfășurarea ședinței de mediere <strong>online prin platforma de videoconferință</strong> a Ministerului Finanțelor, cu transmiterea link-ului la adresa: <strong>{mediationForm.videoconferenceEmail || "emailul societății"}</strong>.
                  </p>

                  <p>
                    3. <strong>Obiectul medierii:</strong> {mediationForm.reason}
                  </p>

                  <p className="text-[11px] text-slate-500 italic pt-2">
                    * Măsurile de executare silită se suspendă de drept de la data transmiterii acestei notificări prin SPV.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ─── TAB 4: CONTRACT ÎMPRUMUT ASOCIAT PENTRU TAXE ─── */}
        {mainModuleTab === "tax_loan" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Formular Contract (Coloana Stângă) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="shadow-2xs border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <HandCoins className="w-4 h-4 text-teal-600" />
                      <span>Împrumut Asociat Plată Taxe</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-700 border-teal-200">
                      Art. 165 C.P.F.
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Contract justificativ când administratorul plătește taxele firmei la Trezorerie.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Număr Contract</Label>
                      <Input
                        value={taxLoanForm.contractNumber}
                        onChange={(e) => setTaxLoanForm({ ...taxLoanForm, contractNumber: e.target.value })}
                        className="text-xs mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Data Acordării</Label>
                      <Input
                        type="date"
                        value={taxLoanForm.contractDate}
                        onChange={(e) => setTaxLoanForm({ ...taxLoanForm, contractDate: e.target.value })}
                        className="text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Suma Plătită la Trezorerie (RON)</Label>
                    <Input
                      value={taxLoanForm.amount}
                      onChange={(e) => setTaxLoanForm({ ...taxLoanForm, amount: e.target.value })}
                      placeholder="ex: 25.000"
                      className="text-xs mt-1 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Nume Asociat / Administrator Plătitor</Label>
                    <Input
                      value={taxLoanForm.shareholderName}
                      onChange={(e) => setTaxLoanForm({ ...taxLoanForm, shareholderName: e.target.value })}
                      placeholder="Nume Prenume"
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
                    <Label className="text-xs font-semibold">Destinație Specială</Label>
                    <Input
                      value={taxLoanForm.purpose}
                      onChange={(e) => setTaxLoanForm({ ...taxLoanForm, purpose: e.target.value })}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        createContractMutation.mutate({
                          number: taxLoanForm.contractNumber,
                          title: `Împrumut Asociat - Plată Taxe Bugetare (${taxLoanForm.amount} RON)`,
                          type: "tax_loan",
                          partnerId: 0,
                          startDate: taxLoanForm.contractDate,
                          validUntil: taxLoanForm.validUntil,
                          value: taxLoanForm.amount,
                          currency: "RON",
                          status: "active",
                          contentHtml: `<p>Contract împrumut asociat pentru stingerea obligațiilor fiscale către Trezoreria Statului în valoare de ${taxLoanForm.amount} RON.</p>`,
                        })
                      }
                      disabled={createContractMutation.isPending}
                      className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {createContractMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Se salvează...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Salvează în Bibliotecă</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                      title="Printează contractul"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Previzualizare Clauze Contract (Coloana Dreaptă) */}
            <div className="lg:col-span-7">
              <Card className="shadow-2xs border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800">
                  <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Previzualizare Clauze de Justificare Fiscală (Cont 4551 Asociați)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 font-serif text-xs leading-relaxed text-slate-800 dark:text-slate-200 space-y-4 bg-white dark:bg-slate-900 m-4 rounded-xl border">
                  <div className="text-center border-b pb-3 space-y-1">
                    <h3 className="font-bold text-sm text-teal-700">CONTRACT DE ÎMPRUMUT ASOCIAT</h3>
                    <p className="text-[10px] text-slate-500">Pentru plata obligațiilor fiscale către Bugetul General Consolidat (Trezoreria Statului)</p>
                  </div>

                  <p>
                    Încheiat la data de <strong>{taxLoanForm.contractDate}</strong> între:
                  </p>

                  <p>
                    <strong>1. {taxLoanForm.shareholderName || "[Nume Asociat]"}</strong>, CNP <strong>{taxLoanForm.shareholderCnp || "[CNP]"}</strong>, în calitate de <strong>Împrumutător</strong>, și
                  </p>

                  <p>
                    <strong>2. {currentTenant?.name || "[Societate]"}</strong>, CUI <strong>{currentTenant?.cui || "[CUI]"}</strong>, în calitate de <strong>Împrumutat</strong>.
                  </p>

                  <p>
                    <strong>Art. 1. Destinație:</strong> Suma de <strong>{taxLoanForm.amount} RON</strong> este destinată exclusiv plății obligațiilor fiscale (TVA, impozit pe venit, CAS/CASS) direct la Trezorerie, conform art. 165 Cod procedură fiscală.
                  </p>

                  <p>
                    <strong>Art. 2. Dobândă:</strong> Împrumutul este acordat cu dobândă 0% în scopul exclusiv de sprijin financiar temporar și evitare popriri.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Modal Adăugare Recipisă SPV */}
      <Dialog open={isAddMessageOpen} onOpenChange={setIsAddMessageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Înregistrează Recipisă / Notificare SPV</DialogTitle>
            <DialogDescription className="text-xs">
              Adaugă recipisa sau notificarea primită de la ANAF în dosarul electronic.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              addAdminMessageMutation.mutate({
                title: fd.get("title") as string,
                type: (fd.get("type") as any) || "recipisa",
                declarationType: (fd.get("declarationType") as string) || undefined,
                spvIndex: (fd.get("spvIndex") as string) || undefined,
                docNumber: (fd.get("docNumber") as string) || undefined,
                receivedDate: (fd.get("receivedDate") as string) || new Date().toISOString().split("T")[0],
                details: (fd.get("details") as string) || undefined,
                fileName: (fd.get("fileName") as string) || undefined,
                status: "validat",
              });
            }}
            className="space-y-3 pt-2"
          >
            <div>
              <Label className="text-xs">Titlu Document</Label>
              <Input name="title" required placeholder="ex: Recipisă Declarația 112 Octombrie" className="text-xs mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tip Document</Label>
                <select name="type" className="w-full text-xs p-2 rounded-lg border bg-white dark:bg-slate-900 mt-1">
                  <option value="recipisa">Recipisă Declarație</option>
                  <option value="notificare_conformare">Notificare Conformare</option>
                  <option value="somatie">Somație</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Declarație (ex: D112, D300)</Label>
                <Input name="declarationType" placeholder="D112" className="text-xs mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Index SPV</Label>
                <Input name="spvIndex" placeholder="84729104" className="text-xs mt-1 font-mono" />
              </div>

              <div>
                <Label className="text-xs">Data Primirii</Label>
                <Input name="receivedDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="text-xs mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Detalii / Mențiuni</Label>
              <Input name="details" placeholder="Validat fără erori de calcul" className="text-xs mt-1" />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsAddMessageOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={addAdminMessageMutation.isPending}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer"
              >
                Salvează
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Previzualizare PDF Facturi */}
      {previewDoc.isOpen && (
        <DocumentModalPreview
          isOpen={previewDoc.isOpen}
          onClose={() => setPreviewDoc({ isOpen: false, title: "", pdfUrl: null, type: "invoice" })}
          title={previewDoc.title}
          pdfUrl={previewDoc.pdfUrl}
          filename={previewDoc.filename}
          documentType={previewDoc.type}
        />
      )}
    </DashboardLayout>
  );
}
