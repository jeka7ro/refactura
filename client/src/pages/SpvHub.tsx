import React, { useState } from "react";
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
import { format } from "date-fns";
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
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isTransmittedInDeadline } from "@/lib/spvDeadline";
import { toast } from "sonner";
import DocumentModalPreview from "@/components/DocumentModalPreview";

export default function SpvHub() {
  const utils = trpc.useUtils();
  const { data: logs, isLoading, refetch: refetchLogs } = trpc.spvLogs.list.useQuery();
  const { data: integrationsList, refetch: refetchIntegrations } = trpc.integrations.list.useQuery();
  const { data: oauthInfo } = trpc.integrations.getSpvOAuthUrl.useQuery();

  const [activeTab, setActiveTab] = useState<"all" | "primita" | "trimisa" | "eroare">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [testResult, setTestResult] = useState<any>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [copiedCui, setCopiedCui] = useState<string | null>(null);

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

  const spvIntegration = integrationsList?.find((i) => i.provider === "spv");

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

  // Filtrare avansată
  const filteredLogs = logs?.filter((log) => {
    // Filtru Tab
    if (activeTab === "primita" && log.type !== "primita") return false;
    if (activeTab === "trimisa" && log.type !== "trimisa") return false;
    if (activeTab === "eroare" && log.spvStatus !== "eroare") return false;

    // Filtru Status selector
    if (filterStatus !== "all" && log.spvStatus !== filterStatus) return false;

    // Filtru Căutare
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const numMatch = log.invoiceNumber?.toLowerCase().includes(q);
      const nameMatch = log.partnerName?.toLowerCase().includes(q);
      const cuiMatch = (log as any).partnerCui?.toLowerCase().includes(q);
      const idxMatch = log.spvIndex?.toLowerCase().includes(q);
      if (!numMatch && !nameMatch && !cuiMatch && !idxMatch) return false;
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
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const stats = {
    trimise: logs?.filter((l) => l.type === "trimisa").length || 0,
    primite: logs?.filter((l) => l.type === "primita").length || 0,
    validate: logs?.filter((l) => l.spvStatus === "validat").length || 0,
    erori: logs?.filter((l) => l.spvStatus === "eroare").length || 0,
  };

  // Calculează zile rămase până la expirarea token-ului
  const tokenExpiresAt = spvIntegration?.tokenExpiresAt
    ? new Date(spvIntegration.tokenExpiresAt)
    : null;
  const daysUntilExpiration = tokenExpiresAt
    ? Math.ceil((tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Antet Pagina Dedicată SPV */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                SPV ANAF — Conexiune Live & e-Factura
              </h1>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                Modul Dedicat
              </Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Centrul de control SPV: testare conexiune live, diagnostic certificat ANAF, mesaje și facturi sincronizate.
            </p>
          </div>

          {/* Butoane Acțiuni Principale SPV */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Buton Testează Conexiunea SPV */}
            <button
              type="button"
              onClick={() => testSpvMutation.mutate()}
              disabled={testSpvMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Trimite un ping sigur de 1 zi la ANAF și verifică dacă token-ul este acceptat"
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

            {/* Buton Sincronizează SPV acum */}
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

            {/* Buton Autorizare / Reautorizare OAuth */}
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

        {/* Panou Stare Conexiune & Rezultat Diagnostic */}
        <div className="space-y-3">
          {testResult ? (
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
                    {testResult.connected ? (
                      <ShieldCheck className="w-6 h-6" />
                    ) : (
                      <AlertCircle className="w-6 h-6" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">
                        {testResult.connected
                          ? "✓ Conexiune SPV Activă și Validată"
                          : "✕ Conexiune SPV Eșuată"}
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
                    {testResult.detail && (
                      <p className="text-[11px] opacity-80 font-mono">{testResult.detail}</p>
                    )}
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
          ) : (
            /* Card informativ stare curentă înainte de rularea testului */
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    spvIntegration?.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span className="text-slate-700 dark:text-slate-300">
                  Stare integrare SPV în sistem:{" "}
                  <strong className="text-slate-900 dark:text-white capitalize">
                    {spvIntegration?.status === "active" ? "Activă (Token Configurat)" : "Neconfigurată / Necesară autorizare"}
                  </strong>
                </span>
                {daysUntilExpiration != null && (
                  <span className="text-slate-500">
                    · Valabilitate estimată: <strong className="tabular-nums">{daysUntilExpiration} zile</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Sincronizarea automată rulează periodic la fiecare 4 ore.</span>
              </div>
            </div>
          )}
        </div>

        {/* Carduri Statistici SPV */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Facturi Trimise (Clienți)
              </CardTitle>
              <UploadCloud className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{stats.trimise}</div>
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
              <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{stats.primite}</div>
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
              <div className="text-2xl font-bold tabular-nums text-emerald-600">{stats.validate}</div>
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
              <div className={`text-2xl font-bold tabular-nums ${stats.erori > 0 ? "text-red-600" : "text-slate-700"}`}>
                {stats.erori}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Facturi cu atenționări de structură</p>
            </CardContent>
          </Card>
        </div>

        {/* Secțiune Centrală: Inbox & Jurnal Documente SPV */}
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Jurnal Documente & Mesaje e-Factura
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Fiecare pachet XML descărcat sau transmis prin sistemul național ANAF.
                </CardDescription>
              </div>

              {/* Căutare liberă */}
              <div className="flex items-center gap-2 max-w-sm w-full">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Caută nr. factură, partener, CUI sau index SPV..."
                    className="pl-8 text-xs h-8"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
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

            {/* Tab-uri rapide de navigare */}
            <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "all"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Toate Mesajele ({logs?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("primita")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "primita"
                    ? "bg-purple-600 text-white"
                    : "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200"
                }`}
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Facturi Primite ({stats.primite})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("trimisa")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "trimisa"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Facturi Trimise ({stats.trimise})</span>
              </button>
              {stats.erori > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("eroare")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "eroare"
                      ? "bg-red-600 text-white"
                      : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Erori ANAF ({stats.erori})</span>
                </button>
              )}

              <span className="ml-auto text-[11px] text-slate-500 tabular-nums hidden sm:inline">
                {filteredLogs?.length || 0} documente afișate
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredLogs?.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-sm">Nu există documente SPV care să corespundă căutării.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Încercați să resetați filtrele sau apăsați butonul „Sincronizează cu SPV acum”.
                </p>
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
                    {filteredLogs?.map((log) => {
                      const isReceived = log.type === "primita";
                      const partnerCui = (log as any).partnerCui || "";
                      const inTermen =
                        !isReceived && (log as any).issueDate
                          ? isTransmittedInDeadline((log as any).issueDate, log.date)
                          : true;

                      return (
                        <TableRow key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60">
                          {/* Coloana Tip */}
                          <TableCell className="text-center py-2.5">
                            <span
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center ${
                                isReceived
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              }`}
                              title={isReceived ? "Factură Primită (Furnizor)" : "Factură Trimisă (Client)"}
                            >
                              {isReceived ? (
                                <DownloadCloud className="w-4 h-4" />
                              ) : (
                                <UploadCloud className="w-4 h-4" />
                              )}
                            </span>
                          </TableCell>

                          {/* Data Transmiterii / Primirii */}
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

                          {/* Index SPV */}
                          <TableCell className="py-2.5">
                            {log.spvIndex ? (
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className="tabular-nums font-mono text-[10.5px] bg-slate-50 dark:bg-slate-800"
                                >
                                  {log.spvIndex}
                                </Badge>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyIndex(log.spvIndex!, e)}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 transition-colors cursor-pointer"
                                  title="Copiază ID încărcare SPV"
                                >
                                  {copiedIndex === log.spvIndex ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Fără Index</span>
                            )}
                          </TableCell>

                          {/* Număr Factură */}
                          <TableCell className="py-2.5">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {log.invoiceNumber}
                              </span>
                              {(log as any).issueDate && (
                                <span className="text-[10px] text-slate-400 tabular-nums">
                                  Emisă: {(log as any).issueDate}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Partener & CUI */}
                          <TableCell className="py-2.5">
                            <div className="flex flex-col max-w-[240px]">
                              <span className="font-medium text-slate-900 dark:text-white truncate" title={log.partnerName}>
                                {log.partnerName}
                              </span>
                              {partnerCui && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[10.5px] text-slate-500 tabular-nums font-mono">
                                    CUI: {partnerCui}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyCui(partnerCui, e)}
                                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                    title="Copiază CUI"
                                  >
                                    {copiedCui === partnerCui ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </TableCell>

                          {/* Valoare Totală */}
                          <TableCell className="py-2.5 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                            {Number(log.total).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} {log.currency}
                          </TableCell>

                          {/* Stare ANAF */}
                          <TableCell className="py-2.5">
                            <div className="flex flex-col items-start gap-1">
                              <Badge variant="outline" className={`text-[10px] font-bold ${getStatusColor(log.spvStatus)}`}>
                                {log.spvStatus?.toUpperCase()}
                              </Badge>
                              {log.spvStatus === "eroare" && log.spvError && log.spvError.toLowerCase() !== "ok" && (
                                <span
                                  className="text-[10.5px] text-red-600 max-w-[200px] line-clamp-2 leading-tight"
                                  title={log.spvError}
                                >
                                  {log.spvError}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Acțiuni */}
                          <TableCell className="py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
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

                              {/* Link direct la resursă */}
                              {log.sourceType === "emittedInvoice" && (
                                <Link
                                  href={`/facturi-emise-nou/view/${log.originalId}`}
                                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center justify-center transition-colors shadow-2xs"
                                  title="Deschide detaliu factură emisă"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
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

        {/* Ghid practic ANAF SPV */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>Ghid de utilizare și funcționare SPV ANAF (e-Factura)</span>
          </div>
          <p>
            • <strong>Sincronizare automată:</strong> Sistemul interoghează serverele ANAF la fiecare 4 ore prin cron-ul securizat de fundal.
          </p>
          <p>
            • <strong>Termen legal de transmitere:</strong> Conform OUG 120/2021, facturile emise trebuie transmise în e-Factura în termen de <strong>5 zile calendaristice</strong> de la emitere.
          </p>
          <p>
            • <strong>Valabilitate autorizare:</strong> Token-ul OAuth emis de ANAF pe baza certificatului digital calificat este valabil <strong>90 de zile</strong>. Puteți reautoriza oricând conexiunea folosind butonul dedicat de reautorizare.
          </p>
        </div>
      </div>

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
