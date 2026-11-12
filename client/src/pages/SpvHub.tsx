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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
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
  const { data: integrationsList, refetch: refetchIntegrations } = trpc.integrations.list.useQuery();
  const { data: oauthInfo } = trpc.integrations.getSpvOAuthUrl.useQuery();

  // Mesaje Reale din ANAF SPV (listaMesajeFactura)
  const {
    data: rawMessages,
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
    isFetching: isFetchingMessages,
  } = (trpc as any).spvMessages.list.useQuery({ zile: 60 });

  // Filtre Mesaje Reale SPV
  const [messageFilter, setMessageFilter] = useState<"all" | "primita" | "trimisa" | "eroare">("all");
  const [searchMessageQuery, setSearchMessageQuery] = useState<string>("");

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
      refetchIntegrations();
    },
    onError: (err: any) => {
      toast.error(`Eroare la preluarea mesajelor din SPV: ${err.message}`);
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
                SPV ANAF — Mesaje Oficiale & Conexiune Live
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
              Stream-ul oficial de mesaje descărcate direct de pe serverele ANAF (listaMesajeFactura) și verificare conexiune în timp real.
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
                  <span>Se testează conexiunea...</span>
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

        {/* Card Diagnostic Conexiune SPV (apare doar când se rulează testul) */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border transition-all ${
              testResult.connected
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100"
                : "bg-red-50/90 border-red-200 text-red-950 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs flex-wrap">
                {testResult.connected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-bold">
                  {testResult.connected ? "Conexiune SPV ANAF Activă" : "Conexiune Eșuată"}
                </span>
                {testResult.latencyMs != null && (
                  <span className="px-2 py-0.5 rounded font-semibold bg-white/80 dark:bg-slate-900/80 border tabular-nums">
                    Latență: {testResult.latencyMs} ms
                  </span>
                )}
                {testResult.cui && (
                  <span className="px-2 py-0.5 rounded font-semibold bg-white/80 dark:bg-slate-900/80 border tabular-nums">
                    CUI: {testResult.cui}
                  </span>
                )}
                {testResult.tokenDaysRemaining != null && (
                  <span className="px-2 py-0.5 rounded font-semibold bg-white/80 dark:bg-slate-900/80 border tabular-nums">
                    Token: {testResult.tokenDaysRemaining} zile
                  </span>
                )}
                <span className="opacity-90">{testResult.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-xs p-1 hover:opacity-100 opacity-60 cursor-pointer"
                title="Închide panoul de diagnostic"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Carduri Statistici Mesaje SPV ANAF */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
              <CardTitle className="text-xs font-medium text-slate-500">Toate Mesajele</CardTitle>
              <Inbox className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {msgStats.total}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Ultimele 60 de zile din SPV</p>
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
              <CardTitle className="text-xs font-medium text-slate-500">Facturi Primite</CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold tabular-nums text-purple-700 dark:text-purple-300">
                {msgStats.primite}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">De la furnizori în SPV</p>
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
              <CardTitle className="text-xs font-medium text-slate-500">Facturi Trimise</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
                {msgStats.trimise}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Transmise către clienți</p>
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
              <CardTitle className="text-xs font-medium text-slate-500">Erori ANAF</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {msgStats.erori}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Pachete cu atenționări/erori</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabelul Principal: Mesaje Oficiale SPV ANAF */}
        <Card className="shadow-2xs border-slate-200 dark:border-slate-800">
          <CardHeader className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filtre Rapide */}
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
                <p className="font-semibold text-sm">Nu există mesaje SPV care să corespundă căutării.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Apasă pe butonul „Actualizează Mesaje SPV” pentru a prelua mesajele recente de la ANAF.
                </p>
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
                              {isReceived && <ArrowDownLeft className="w-3 h-3 text-purple-600" />}
                              {isSent && <ArrowUpRight className="w-3 h-3 text-blue-600" />}
                              {isError && <AlertCircle className="w-3 h-3 text-red-600" />}
                              <span>{msg.tip}</span>
                            </span>
                          </TableCell>

                          {/* CUI Emitent */}
                          <TableCell className="py-2.5">
                            {msg.cifEmitent ? (
                              <div className="flex items-center gap-1">
                                <span className="tabular-nums text-slate-700 dark:text-slate-300">{msg.cifEmitent}</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyCuiText(msg.cifEmitent, e)}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                  title="Copiază CUI Emitent"
                                >
                                  {copiedCui === msg.cifEmitent ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
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
                                <span className="tabular-nums text-slate-700 dark:text-slate-300">{msg.cifBeneficiar}</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyCuiText(msg.cifBeneficiar, e)}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                  title="Copiază CUI Beneficiar"
                                >
                                  {copiedCui === msg.cifBeneficiar ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
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
                                <Badge variant="outline" className="text-[10.5px] tabular-nums">
                                  {msg.idSolicitare}
                                </Badge>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopy(msg.idSolicitare, e)}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                  title="Copiază index încărcare"
                                >
                                  {copiedId === msg.idSolicitare ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">-</span>
                            )}
                          </TableCell>

                          {/* ID Descărcare ANAF */}
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                                {msg.id}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopy(msg.id, e)}
                                className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                title="Copiază ID ANAF"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
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
                                  <span className="text-[10.5px] text-slate-500 truncate">
                                    {msg.partnerName}
                                  </span>
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
                            ) : isError ? (
                              <span className="text-[10px] text-red-600 font-semibold" title={msg.detalii || "Eroare la validare"}>
                                Atenționare
                              </span>
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
