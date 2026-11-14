import React, { useState, useRef } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  Upload,
  Download,
  FileText,
  FileCheck,
  Bell,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import DocumentModalPreview from "@/components/DocumentModalPreview";

export default function SpvHub() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: integrationsList, refetch: refetchIntegrations } = trpc.integrations.list.useQuery();
  const { data: oauthInfo } = trpc.integrations.getSpvOAuthUrl.useQuery();

  // Tab Principal: Recipise Declaratii SPV vs Mesaje e-Factura
  const [activeHubTab, setActiveHubTab] = useState<"declaratii" | "efactura">("declaratii");

  // 1. Recipise & Documente din Portalul ANAF SPV
  const {
    data: portalDocs,
    isLoading: isLoadingPortalDocs,
    refetch: refetchPortalDocs,
  } = (trpc as any).spvMessages.listPortalDocuments.useQuery();

  // 2. Mesaje e-Factura din API ANAF (listaMesajeFactura)
  const {
    data: rawMessages,
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
    isFetching: isFetchingMessages,
  } = (trpc as any).spvMessages.list.useQuery({ zile: 60 });

  // Filtre Recipise Declaratii SPV
  const [portalFilter, setPortalFilter] = useState<"all" | "declaratie" | "notificare" | "decizie">("all");
  const [portalSearchQuery, setPortalSearchQuery] = useState<string>("");

  // Filtre Mesaje e-Factura
  const [messageFilter, setMessageFilter] = useState<"all" | "primita" | "trimisa" | "eroare">("all");
  const [searchMessageQuery, setSearchMessageQuery] = useState<string>("");

  // Stare Diagnostic & Copiere
  const [testResult, setTestResult] = useState<any>(null);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Stare Modal Upload Recipisă SPV
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Previzualizare modal PDF
  const [selectedSpvMessage, setSelectedSpvMessage] = useState<any | null>(null);
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

  // Mutație Sincronizare Recipise din API SPVWS2 ANAF
  const syncPortalMutation = (trpc as any).spvMessages.syncPortalFromAnaf.useMutation({
    onSuccess: (data: any) => {
      if (data.needsSpvRole) {
        setApiNotice(data.message);
        toast.error("Rolul SPV nu este încă activat pe token-ul OAuth.");
      } else if (data.success) {
        toast.success(data.message || "Mesajele din SPV au fost sincronizate cu succes.");
        setApiNotice(null);
        refetchPortalDocs();
      } else {
        toast.error(data.message || "Eroare la interogarea SPV ANAF.");
      }
    },
    onError: (err: any) => {
      toast.error(`Eroare la sincronizarea cu SPV: ${err.message}`);
    },
  });

  // Mutație Ștergere Document Portal SPV
  const deletePortalMutation = (trpc as any).spvMessages.deletePortalDocument.useMutation({
    onSuccess: () => {
      toast.success("Documentul a fost șters din arhivă.");
      refetchPortalDocs();
    },
    onError: (err: any) => {
      toast.error(`Eroare la ștergere: ${err.message}`);
    },
  });

  // Mutație Sincronizare Mesaje e-Factura
  const syncMessagesMutation = (trpc as any).spvMessages.syncFromAnaf.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Mesaje e-Factura actualizate cu succes (${data.total} înregistrate).`);
      refetchMessages();
      utils.spvLogs.list.invalidate();
      refetchIntegrations();
    },
    onError: (err: any) => {
      toast.error(`Eroare la preluarea mesajelor: ${err.message}`);
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

  // Upload Manual Recipisă sau Document SPV
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch("/api/upload-spv-document", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Eroare HTTP ${res.status}`);
      }

      const resData = await res.json();
      toast.success(`S-au salvat ${resData.count || 1} documente SPV în arhivă.`);
      setIsUploadOpen(false);
      refetchPortalDocs();
    } catch (err: any) {
      toast.error(`Eroare la încărcare: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Filtrare Recipise Declaratii SPV
  const filteredPortalDocs = portalDocs?.filter((doc: any) => {
    if (portalFilter === "declaratie" && doc.categorie !== "recipisa_declaratie") return false;
    if (portalFilter === "notificare" && doc.categorie !== "notificare_anaf") return false;
    if (portalFilter === "decizie" && doc.categorie !== "decizie_impunere" && doc.categorie !== "somatie") return false;

    if (portalSearchQuery.trim()) {
      const q = portalSearchQuery.toLowerCase().trim();
      const tipMatch = doc.tip?.toLowerCase().includes(q);
      const nrMatch = doc.numarInregistrare?.toLowerCase().includes(q);
      const titluMatch = doc.titlu?.toLowerCase().includes(q);
      const perMatch = doc.perioadaFiscala?.toLowerCase().includes(q);
      const detMatch = doc.detalii?.toLowerCase().includes(q);
      if (!tipMatch && !nrMatch && !titluMatch && !perMatch && !detMatch) {
        return false;
      }
    }
    return true;
  });

  // Statistici Recipise Declaratii SPV
  const portalStats = {
    total: portalDocs?.length || 0,
    declaratii: portalDocs?.filter((d: any) => d.categorie === "recipisa_declaratie").length || 0,
    notificari: portalDocs?.filter((d: any) => d.categorie === "notificare_anaf").length || 0,
    decizii: portalDocs?.filter((d: any) => d.categorie === "decizie_impunere" || d.categorie === "somatie").length || 0,
  };

  // Filtrare Mesaje e-Factura
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
                SPV ANAF — Mesaje Portal, Declarații & e-Factura
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
              Recipise declarații fiscale (D112, D300, D394), notificări oficiale ANAF, decizii și stream de mesaje e-Factura.
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
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Încarcă o recipisă sau notificare PDF/ZIP descărcată din SPV"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Încarcă Recipisă SPV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeHubTab === "declaratii") {
                  syncPortalMutation.mutate();
                } else {
                  syncMessagesMutation.mutate();
                }
              }}
              disabled={syncPortalMutation.isPending || syncMessagesMutation.isPending || isFetchingMessages}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Interoghează ANAF și actualizează lista mesajelor"
            >
              {syncPortalMutation.isPending || syncMessagesMutation.isPending || isFetchingMessages ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Se actualizează...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualizează din SPV</span>
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

        {/* Diagnostic Conexiune SPV */}
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

        {/* Notificare Explicativă Roluri SPV */}
        {apiNotice && (
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Activare Sincronizare Automată Recipise SPV</p>
                <p className="opacity-90 leading-relaxed">
                  {apiNotice}
                </p>
                <p className="text-[11px] opacity-80 pt-0.5">
                  Până la bifarea rolului SPV în portalul ANAF, puteți folosi oricând butonul de mai sus <strong>„Încarcă Recipisă SPV”</strong> pentru a adăuga instantaneu orice recipisă PDF sau ZIP descărcată.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setApiNotice(null)}
              className="text-amber-700 hover:text-amber-950 p-1 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Taburi Navigare Principală */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
          <button
            type="button"
            onClick={() => setActiveHubTab("declaratii")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
              activeHubTab === "declaratii"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Mesaje & Recipise Declarații SPV</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold tabular-nums">
              {portalStats.total}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveHubTab("efactura")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
              activeHubTab === "efactura"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Mesaje e-Factura SPV</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold tabular-nums">
              {msgStats.total}
            </Badge>
          </button>
        </div>

        {/* ─── TAB 1: MESAJE & RECIPISE DECLARAȚII SPV (D112, D300, D394, NOTIFICĂRI) ─── */}
        {activeHubTab === "declaratii" && (
          <div className="space-y-4">
            {/* Carduri Statistici */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Toate Mesajele SPV</CardTitle>
                  <Inbox className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {portalStats.total}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Înregistrate din portalul ANAF</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Recipise Declarații</CardTitle>
                  <FileCheck className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
                    {portalStats.declaratii}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">D112, D300, D394, D100</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Notificări de Conformare</CardTitle>
                  <Bell className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-purple-700 dark:text-purple-300">
                    {portalStats.notificari}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Comunicări oficiale ANAF</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Decizii & Extrase</CardTitle>
                  <FileText className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {portalStats.decizii}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Fișe sintetice de rol</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabel Recipise & Declarații SPV */}
            <Card className="shadow-2xs border-slate-200 dark:border-slate-800">
              <CardHeader className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Filtre Rapide */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setPortalFilter("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      portalFilter === "all"
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    Toate ({portalStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalFilter("declaratie")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      portalFilter === "declaratie"
                        ? "bg-blue-600 text-white"
                        : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    }`}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Recipise Declarații ({portalStats.declaratii})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalFilter("notificare")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      portalFilter === "notificare"
                        ? "bg-purple-600 text-white"
                        : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Notificări ANAF ({portalStats.notificari})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalFilter("decizie")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      portalFilter === "decizie"
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Decizii & Extrase ({portalStats.decizii})</span>
                  </button>
                </div>

                {/* Căutare în declarații */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={portalSearchQuery}
                    onChange={(e) => setPortalSearchQuery(e.target.value)}
                    placeholder="Caută D112, D300, index, perioadă..."
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isLoadingPortalDocs ? (
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ) : filteredPortalDocs?.length === 0 ? (
                  <div className="p-16 text-center text-slate-500">
                    <FileCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm">Nu există documente sau recipise care să corespundă căutării.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Puteți adăuga oricând o recipisă descărcată din SPV prin butonul „Încarcă Recipisă SPV”.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/70 dark:bg-slate-900/70 text-[11px]">
                          <TableHead className="w-32">Data Înregistrare</TableHead>
                          <TableHead className="w-28">Tip Document</TableHead>
                          <TableHead className="w-32">Index SPV / Nr.</TableHead>
                          <TableHead className="w-32">Perioadă</TableHead>
                          <TableHead>Titlu & Detalii Oficiale ANAF</TableHead>
                          <TableHead className="w-36">Stare Prelucrare</TableHead>
                          <TableHead className="w-36 text-center">Acțiuni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {filteredPortalDocs?.map((doc: any) => {
                          const isD112 = doc.tip === "D112";
                          const isD300 = doc.tip === "D300";
                          const isD394 = doc.tip === "D394";
                          const isNotif = doc.categorie === "notificare_anaf";

                          return (
                            <TableRow
                              key={doc.id}
                              onClick={() =>
                                setPreviewDoc({
                                  isOpen: true,
                                  title: `${doc.titlu} — Index ${doc.numarInregistrare}`,
                                  pdfUrl: doc.pdfUrl,
                                  filename: doc.fileName || `Recipisa_${doc.tip}_${doc.numarInregistrare}.pdf`,
                                  type: "invoice",
                                })
                              }
                              className="hover:bg-blue-50/60 dark:hover:bg-blue-950/30 cursor-pointer transition-colors"
                            >
                              {/* Data Inregistrare */}
                              <TableCell className="font-semibold tabular-nums whitespace-nowrap py-3">
                                {doc.dataDepunere}
                              </TableCell>

                              {/* Tip Document */}
                              <TableCell className="py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                                    isD112
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200"
                                      : isD300
                                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200"
                                      : isD394
                                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200"
                                      : isNotif
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200"
                                  }`}
                                >
                                  {doc.tip}
                                </span>
                              </TableCell>

                              {/* Index SPV */}
                              <TableCell className="py-3">
                                <div className="flex items-center gap-1">
                                  <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">
                                    {doc.numarInregistrare}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopy(doc.numarInregistrare, e);
                                    }}
                                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                    title="Copiază număr înregistrare"
                                  >
                                    {copiedId === doc.numarInregistrare ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              </TableCell>

                              {/* Perioada */}
                              <TableCell className="py-3">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">
                                  {doc.perioadaFiscala || "-"}
                                </span>
                              </TableCell>

                              {/* Titlu & Detalii */}
                              <TableCell className="py-3">
                                <div className="flex flex-col max-w-lg">
                                  <span className="font-bold text-slate-900 dark:text-white truncate">
                                    {doc.titlu}
                                  </span>
                                  {doc.detalii && (
                                    <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                      {doc.detalii}
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Stare Prelucrare */}
                              <TableCell className="py-3">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>{doc.stare === "validat" ? "Validată fără erori" : doc.stare?.toUpperCase()}</span>
                                </span>
                              </TableCell>

                              {/* Actiuni */}
                              <TableCell className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewDoc({
                                        isOpen: true,
                                        title: `${doc.titlu} — Index ${doc.numarInregistrare}`,
                                        pdfUrl: doc.pdfUrl,
                                        filename: doc.fileName || `Recipisa_${doc.tip}_${doc.numarInregistrare}.pdf`,
                                        type: "invoice",
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold transition-colors cursor-pointer"
                                    title="Deschide și previzualizează PDF Recipisă"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Deschide</span>
                                  </button>

                                  <a
                                    href={`${doc.pdfUrl}?download=true`}
                                    download={doc.fileName || `Recipisa_${doc.tip}_${doc.numarInregistrare}.pdf`}
                                    className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center justify-center transition-colors"
                                    title="Descarcă PDF Recipisă"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>

                                  {doc.sursa === "incarcat_manual" && (
                                    <button
                                      type="button"
                                      onClick={() => deletePortalMutation.mutate({ id: doc.id })}
                                      className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 inline-flex items-center justify-center transition-colors cursor-pointer"
                                      title="Șterge documentul din arhivă"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
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
          </div>
        )}

        {/* ─── TAB 2: MESAJE E-FACTURA SPV (FACTURI PRIMITE, TRIMISE, ERORI) ─── */}
        {activeHubTab === "efactura" && (
          <div className="space-y-4">
            {/* Carduri Statistici Mesaje e-Factura */}
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

            {/* Tabel Mesaje e-Factura */}
            <Card className="shadow-2xs border-slate-200 dark:border-slate-800">
              <CardHeader className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    <p className="font-semibold text-sm">Nu există mesaje e-Factura care să corespundă căutării.</p>
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
                          <TableHead className="w-32 text-center">Acțiune</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {filteredMessages?.map((msg: any) => {
                          const isReceived = msg.tip === "FACTURA PRIMITA";
                          const isSent = msg.tip === "FACTURA TRIMISA";
                          const isError = msg.tip === "ERORI FACTURA";

                          return (
                            <TableRow
                              key={msg.id}
                              onClick={() => {
                                if (msg.pdfUrl) {
                                  setPreviewDoc({
                                    isOpen: true,
                                    title: `Factura ${msg.invoiceNumber || ""} — ${msg.partnerName || ""}`,
                                    pdfUrl: msg.pdfUrl,
                                    filename: `Factura_${msg.invoiceNumber || msg.id}.pdf`,
                                    type: isReceived ? "invoice" : "emitted",
                                  });
                                } else {
                                  setSelectedSpvMessage(msg);
                                }
                              }}
                              className="hover:bg-blue-50/60 dark:hover:bg-blue-950/30 cursor-pointer transition-colors"
                            >
                              <TableCell className="font-semibold tabular-nums whitespace-nowrap py-2.5">
                                {msg.dataCreare}
                              </TableCell>
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
                              <TableCell className="py-2.5">
                                <span className="tabular-nums text-slate-700 dark:text-slate-300">{msg.cifEmitent || "-"}</span>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <span className="tabular-nums text-slate-700 dark:text-slate-300">{msg.cifBeneficiar || "-"}</span>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Badge variant="outline" className="text-[10.5px] tabular-nums">
                                  {msg.idSolicitare || "-"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <span className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                                  {msg.id}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <span className="font-bold text-slate-900 dark:text-white truncate">
                                  {msg.invoiceNumber || msg.partnerName || "În așteptare descărcare"}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
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
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold transition-colors cursor-pointer"
                                    title="Vizualizează PDF Factură"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Deschide</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSpvMessage(msg)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold transition-colors cursor-pointer"
                                    title="Vizualizează detalii mesaj ANAF"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Detalii</span>
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

      {/* Modal Upload Recipisă / Notificare SPV */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Încarcă Recipisă sau Mesaj din SPV ANAF
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Selectați fișierul PDF sau arhiva ZIP descărcată direct din portalul ANAF (recipisă D112, D300, D394, notificare sau decizie).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50"
            >
              <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Apasă aici sau trage fișierul PDF / ZIP descărcat din SPV
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Recunoaște automat tipul declarației (D112, D300, D394 etc.) și numărul de înregistrare ANAF.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xml,.zip"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />

            {isUploading && (
              <div className="flex items-center justify-center gap-2 text-xs text-blue-600 font-semibold py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Se încarcă și se prelucrează documentul...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Detalii Mesaj Oficial ANAF */}
      {selectedSpvMessage && (
        <Dialog open={Boolean(selectedSpvMessage)} onOpenChange={(open) => { if (!open) setSelectedSpvMessage(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Detalii Mesaj Oficial ANAF SPV</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Informații oficiale recepționate direct de pe serverele Ministerului Finanțelor
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 text-xs pt-2">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Tip Mesaj:</span>
                <span className="font-bold">{selectedSpvMessage.tip}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Data SPV:</span>
                <span className="font-semibold tabular-nums">{selectedSpvMessage.dataCreare}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">CIF Emitent:</span>
                <span className="font-semibold tabular-nums">{selectedSpvMessage.cifEmitent || "-"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">CIF Beneficiar:</span>
                <span className="font-semibold tabular-nums">{selectedSpvMessage.cifBeneficiar || "-"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Index Încărcare SPV:</span>
                <div className="flex items-center gap-1 font-bold tabular-nums">
                  <span>{selectedSpvMessage.idSolicitare || "-"}</span>
                  {selectedSpvMessage.idSolicitare && (
                    <button
                      type="button"
                      onClick={(e) => handleCopy(selectedSpvMessage.idSolicitare, e)}
                      className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                      title="Copiază index"
                    >
                      {copiedId === selectedSpvMessage.idSolicitare ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">ID Descărcare ANAF:</span>
                <div className="flex items-center gap-1 font-bold tabular-nums">
                  <span>{selectedSpvMessage.id}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(selectedSpvMessage.id, e)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                    title="Copiază ID descărcare"
                  >
                    {copiedId === selectedSpvMessage.id ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Factură / Stare:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedSpvMessage.invoiceNumber
                    ? `Factură înregistrată: ${selectedSpvMessage.invoiceNumber}`
                    : selectedSpvMessage.partnerName || "Recepționat din ANAF SPV"}
                </span>
              </div>
              {selectedSpvMessage.detalii && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <p className="font-bold mb-1">Atenționare / Notă ANAF:</p>
                  <p>{selectedSpvMessage.detalii}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setSelectedSpvMessage(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Închide
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Previzualizare PDF Oficial ANAF */}
      {previewDoc.isOpen && (
        <DocumentModalPreview
          isOpen={previewDoc.isOpen}
          onClose={() => setPreviewDoc({ isOpen: false, title: "", pdfUrl: null, type: "invoice" })}
          title={previewDoc.title}
          pdfUrl={previewDoc.pdfUrl}
          filename={previewDoc.filename}
          type={previewDoc.type}
        />
      )}
    </>
  );
}
