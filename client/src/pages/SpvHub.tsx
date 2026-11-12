import React, { useState } from "react";
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
  Wifi,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Search,
  Eye,
  Copy,
  Check,
  FileText,
  KeyRound,
  X,
  Inbox,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import DocumentModalPreview from "@/components/DocumentModalPreview";

export default function SpvHub() {
  const utils = trpc.useUtils();
  const { data: logs, isLoading: isLoadingLogs, refetch: refetchLogs } = trpc.spvLogs.list.useQuery();
  const { data: integrationsList, refetch: refetchIntegrations } = trpc.integrations.list.useQuery();
  const { data: oauthInfo } = trpc.integrations.getSpvOAuthUrl.useQuery();
  const { data: currentTenant } = trpc.tenants.current.useQuery();

  // Mesaje Reale din ANAF SPV
  const {
    data: rawMessages,
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
    isFetching: isFetchingMessages,
  } = (trpc as any).spvMessages.list.useQuery({ zile: 60 });

  // Tab Principal de Navigare — Mesaje SPV vs Facturi Sincronizate
  const [mainTab, setMainTab] = useState<"spv_messages" | "efactura_invoices">("spv_messages");

  // Filtre Mesaje Reale SPV
  const [messageFilter, setMessageFilter] = useState<"all" | "primita" | "trimisa" | "eroare">("all");
  const [searchMessageQuery, setSearchMessageQuery] = useState<string>("");

  // Filtre Facturi e-Factura
  const [invoiceTab, setInvoiceTab] = useState<"all" | "primita" | "trimisa" | "eroare">("all");
  const [searchInvoiceQuery, setSearchInvoiceQuery] = useState<string>("");

  // Stare Diagnostic & Copiere
  const [testResult, setTestResult] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  // Mutație Sincronizare / Descărcare Mesaje Noi Direct din ANAF SPV
  const syncMessagesMutation = (trpc as any).spvMessages.syncFromAnaf.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Mesaje SPV actualizate cu succes! S-au preluat ${data.total} mesaje de la ANAF.`);
      refetchMessages();
      utils.spvLogs.list.invalidate();
      refetchLogs();
      refetchIntegrations();
    },
    onError: (err: any) => {
      toast.error(`Eroare la preluarea mesajelor din SPV: ${err.message}`);
    },
  });

  // Mutație Sincronizare Manuală cu SPV ANAF (facturi)
  const syncSpvMutation = trpc.integrations.syncSpvManual.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Sincronizare SPV finalizată! S-au importat ${data.imported} facturi noi de la ANAF.`
      );
      utils.spvLogs.list.invalidate();
      refetchLogs();
      refetchMessages();
      refetchIntegrations();
    },
    onError: (err) => {
      toast.error(`Eroare la sincronizarea cu SPV: ${err.message}`);
    },
  });

  const spvIntegration = integrationsList?.find((i) => i.provider === "spv");

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1800);
    toast.success(`Copiat: ${text}`);
  };

  const handleCopyCuiText = (cui: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cui);
    setCopiedCui(cui);
    setTimeout(() => setCopiedCui(null), 1800);
    toast.success(`CUI copiat: ${cui}`);
  };

  // Filtrare Mesaje Reale SPV
  const filteredMessages = rawMessages?.filter((msg: any) => {
    if (messageFilter === "primita" && msg.tip !== "FACTURA PRIMITA") return false;
    if (messageFilter === "trimisa" && msg.tip !== "FACTURA TRIMISA") return false;
    if (messageFilter === "eroare" && msg.tip !== "ERORI FACTURA") return false;

    if (searchMessageQuery.trim()) {
      const q = searchMessageQuery.toLowerCase().trim();
      const numMatch = msg.invoiceNumber?.toLowerCase().includes(q);
      const nameMatch = msg.partnerName?.toLowerCase().includes(q);
      const emitMatch = msg.cifEmitent?.toLowerCase().includes(q);
      const benMatch = msg.cifBeneficiar?.toLowerCase().includes(q);
      const solMatch = msg.idSolicitare?.toLowerCase().includes(q);
      const idMatch = msg.id?.toLowerCase().includes(q);
      const detMatch = msg.detalii?.toLowerCase().includes(q);
      if (!numMatch && !nameMatch && !emitMatch && !benMatch && !solMatch && !idMatch && !detMatch) {
        return false;
      }
    }
    return true;
  });

  // Statistici Mesaje Reale SPV
  const msgStats = {
    total: rawMessages?.length || 0,
    primite: rawMessages?.filter((m: any) => m.tip === "FACTURA PRIMITA").length || 0,
    trimise: rawMessages?.filter((m: any) => m.tip === "FACTURA TRIMISA").length || 0,
    erori: rawMessages?.filter((m: any) => m.tip === "ERORI FACTURA").length || 0,
  };

  // Filtrare Facturi e-Factura
  const filteredInvoiceLogs = logs?.filter((log) => {
    if (invoiceTab === "primita" && log.type !== "primita") return false;
    if (invoiceTab === "trimisa" && log.type !== "trimisa") return false;
    if (invoiceTab === "eroare" && log.spvStatus !== "eroare") return false;

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
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        {/* Antet Pagina SPV ANAF */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Mesaje & Facturi SPV ANAF
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
              Stream-ul oficial de mesaje și facturi descărcate direct de pe serverele ANAF (listaMesajeFactura)
            </p>
          </div>

          {/* Butoane Acțiuni Principale */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => testSpvMutation.mutate()}
              disabled={testSpvMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Trimite un ping către serverul ANAF și testează token-ul"
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
              onClick={() => syncMessagesMutation.mutate()}
              disabled={syncMessagesMutation.isPending || isFetchingMessages}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Interoghează ANAF și actualizează lista mesajelor din SPV"
            >
              {syncMessagesMutation.isPending || isFetchingMessages ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Preluare mesaje ANAF...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizează Mesaje SPV</span>
                </>
              )}
            </button>

            {oauthInfo?.url && (
              <a
                href={oauthInfo.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                title="Reautorizare certificat cu token OAuth ANAF"
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
            className={`p-3 rounded-xl border transition-all ${
              testResult.connected
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100"
                : "bg-red-50/90 border-red-200 text-red-950 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs">
                {testResult.connected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-bold">
                  {testResult.connected ? "Conexiune SPV ANAF Activă" : "Conexiune Eșuată"}
                </span>
                {testResult.latencyMs != null && (
                  <span className="px-2 py-0.5 rounded font-semibold bg-white/80 dark:bg-slate-900/80 border">
                    Latență: {testResult.latencyMs} ms
                  </span>
                )}
                {testResult.cui && (
                  <span className="px-2 py-0.5 rounded font-semibold bg-white/80 dark:bg-slate-900/80 border">
                    CUI: {testResult.cui}
                  </span>
                )}
                {testResult.tokenDaysRemaining != null && (
                  <span className="px-2 py-0.5 rounded font-semibold bg-white/80 dark:bg-slate-900/80 border">
                    Token: {testResult.tokenDaysRemaining} zile
                  </span>
                )}
                <span className="opacity-90">{testResult.message}</span>
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

        {/* TABURI PRINCIPALE: MESAJE REALE SPV vs FACTURI */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
          <button
            type="button"
            onClick={() => setMainTab("spv_messages")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
              mainTab === "spv_messages"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Mesaje Oficiale SPV ANAF</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
              {msgStats.total}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setMainTab("efactura_invoices")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
              mainTab === "efactura_invoices"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Facturi Prelucrate & Validate</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
              {logs?.length || 0}
            </Badge>
          </button>
        </div>

        {/* ─── TAB 1: MESAJE REALE SPV ANAF (STREAM DIRECT DIN API ANAF) ─── */}
        {mainTab === "spv_messages" && (
          <div className="space-y-3">
            <Card className="shadow-2xs border-slate-200 dark:border-slate-800">
              <CardHeader className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Filtre Mesaje */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMessageFilter("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      messageFilter === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Toate Mesajele ({msgStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageFilter("primita")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      messageFilter === "primita"
                        ? "bg-purple-600 text-white"
                        : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Facturi Primite ({msgStats.primite})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageFilter("trimisa")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      messageFilter === "trimisa"
                        ? "bg-blue-600 text-white"
                        : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Facturi Trimise ({msgStats.trimise})</span>
                  </button>
                  {msgStats.erori > 0 && (
                    <button
                      type="button"
                      onClick={() => setMessageFilter("eroare")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                        messageFilter === "eroare"
                          ? "bg-red-600 text-white"
                          : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Erori ANAF ({msgStats.erori})</span>
                    </button>
                  )}
                </div>

                {/* Căutare în mesaje */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={searchMessageQuery}
                    onChange={(e) => setSearchMessageQuery(e.target.value)}
                    placeholder="Caută nr. factură, partener, CUI, index..."
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isLoadingMessages ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ) : filteredMessages?.length === 0 ? (
                  <div className="p-16 text-center text-slate-500">
                    <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm">Nu există mesaje SPV care să corespundă filtrului.</p>
                    <p className="text-xs text-slate-400 mt-1">Apasă pe „Actualizează Mesaje SPV” pentru a prelua mesajele recente de la ANAF.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/70 dark:bg-slate-900/70 text-[11px]">
                          <TableHead className="w-32">Data SPV</TableHead>
                          <TableHead className="w-36">Tip Mesaj ANAF</TableHead>
                          <TableHead className="w-32">Emitent</TableHead>
                          <TableHead className="w-32">Beneficiar</TableHead>
                          <TableHead className="w-36">Index Încărcare SPV</TableHead>
                          <TableHead className="w-32">ID Descărcare</TableHead>
                          <TableHead>Factură / Partener în Sistem</TableHead>
                          <TableHead className="w-24 text-center">Acțiune</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {filteredMessages?.map((msg: any) => {
                          const isReceived = msg.tip === "FACTURA PRIMITA";
                          const isSent = msg.tip === "FACTURA TRIMISA";
                          const isError = msg.tip === "ERORI FACTURA";

                          return (
                            <TableRow key={msg.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60">
                              {/* Data SPV */}
                              <TableCell className="font-semibold tabular-nums whitespace-nowrap py-2.5">
                                {msg.dataCreare}
                              </TableCell>

                              {/* Tip Mesaj */}
                              <TableCell className="py-2.5">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                                    isReceived
                                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200"
                                      : isSent
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200"
                                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200"
                                  }`}
                                >
                                  {isReceived ? (
                                    <ArrowDownLeft className="w-3 h-3" />
                                  ) : isSent ? (
                                    <ArrowUpRight className="w-3 h-3" />
                                  ) : (
                                    <AlertCircle className="w-3 h-3" />
                                  )}
                                  <span>{msg.tip}</span>
                                </span>
                              </TableCell>

                              {/* CUI Emitent */}
                              <TableCell className="py-2.5">
                                {msg.cifEmitent ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[11px] font-semibold">{msg.cifEmitent}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopyCuiText(msg.cifEmitent, e)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                      title="Copiază CUI Emitent"
                                    >
                                      {copiedCui === msg.cifEmitent ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </TableCell>

                              {/* CUI Beneficiar */}
                              <TableCell className="py-2.5">
                                {msg.cifBeneficiar ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[11px]">{msg.cifBeneficiar}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopyCuiText(msg.cifBeneficiar, e)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                      title="Copiază CUI Beneficiar"
                                    >
                                      {copiedCui === msg.cifBeneficiar ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </TableCell>

                              {/* Index Încărcare SPV */}
                              <TableCell className="py-2.5">
                                {msg.idSolicitare ? (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-[10.5px]">
                                      {msg.idSolicitare}
                                    </Badge>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopy(msg.idSolicitare, e)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                      title="Copiază index"
                                    >
                                      {copiedId === msg.idSolicitare ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">-</span>
                                )}
                              </TableCell>

                              {/* ID Descărcare ANAF */}
                              <TableCell className="py-2.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] text-slate-600 dark:text-slate-400">{msg.id}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopy(msg.id, e)}
                                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                    title="Copiază ID ANAF"
                                  >
                                    {copiedId === msg.id ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                                  </button>
                                </div>
                              </TableCell>

                              {/* Factură / Partener Identificat */}
                              <TableCell className="py-2.5">
                                {msg.invoiceNumber || msg.partnerName ? (
                                  <div className="flex flex-col max-w-[220px]">
                                    <span className="font-bold text-slate-900 dark:text-white truncate">
                                      {msg.invoiceNumber || "Factură"}
                                    </span>
                                    {msg.partnerName && (
                                      <span className="text-[10.5px] text-slate-500 truncate">{msg.partnerName}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">În așteptare descărcare</span>
                                )}
                              </TableCell>

                              {/* Acțiune */}
                              <TableCell className="py-2.5 text-center">
                                {msg.pdfUrl ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewDoc({
                                        isOpen: true,
                                        title: `Factura ${msg.invoiceNumber || ""} — ${msg.partnerName || ""}`,
                                        pdfUrl: msg.pdfUrl,
                                        filename: `Factura_${msg.invoiceNumber || msg.id}.pdf`,
                                        type: isReceived ? "invoice" : "emitted",
                                      })
                                    }
                                    className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 inline-flex items-center justify-center transition-colors cursor-pointer"
                                    title="Vizualizează PDF Factură"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Înregistrat</span>
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

        {/* ─── TAB 2: FACTURI PRELUCRATE & VALIDATE ─── */}
        {mainTab === "efactura_invoices" && (
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

            {/* Tabel Facturi */}
            <Card className="shadow-2xs border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setInvoiceTab("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      invoiceTab === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Toate Facturile ({logs?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceTab("primita")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      invoiceTab === "primita"
                        ? "bg-purple-600 text-white"
                        : "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200"
                    }`}
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Primite ({invoiceStats.primite})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceTab("trimisa")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      invoiceTab === "trimisa"
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
                      onClick={() => setInvoiceTab("eroare")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                        invoiceTab === "eroare"
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
                                    <Badge variant="outline" className="tabular-nums text-[10.5px]">
                                      {log.spvIndex}
                                    </Badge>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopy(log.spvIndex!, e)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                      title="Copiază ID"
                                    >
                                      {copiedId === log.spvIndex ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
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
                                      <span className="text-[10px] text-slate-500 tabular-nums">CUI: {partnerCui}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => handleCopyCuiText(partnerCui, e)}
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
                                <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
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
      </div>

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
    </>
  );
}
