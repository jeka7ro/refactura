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
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");

  // Filtre Coloane Specifice Portal ANAF SPV (exact ca in www.anaf.ro)
  const [filterCif, setFilterCif] = useState<string>("");
  const [filterTipDoc, setFilterTipDoc] = useState<string>("-TOATE-");
  const [filterIdSolicitare, setFilterIdSolicitare] = useState<string>("");
  const [filterDataAfisare, setFilterDataAfisare] = useState<string>("");
  const [filterDetalii, setFilterDetalii] = useState<string>("");
  const [filterDataArhivare, setFilterDataArhivare] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const resetFilters = () => {
    setFilterCif("");
    setFilterTipDoc("-TOATE-");
    setFilterIdSolicitare("");
    setFilterDataAfisare("");
    setFilterDetalii("");
    setFilterDataArhivare("");
    setPortalFilter("all");
    setReadFilter("all");
    setPortalSearchQuery("");
    setPage(1);
  };

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

  // Mutație Marcare Document Citit / Necitit
  const markReadMutation = (trpc as any).spvMessages.markPortalDocumentRead.useMutation({
    onSuccess: () => {
      refetchPortalDocs();
    },
    onError: (err: any) => {
      toast.error(`Eroare la actualizarea stării: ${err.message}`);
    },
  });

  // Mutație Marcare Toate Documentele ca Citite
  const markAllReadMutation = (trpc as any).spvMessages.markAllPortalDocumentsRead.useMutation({
    onSuccess: () => {
      toast.success("Toate mesajele din SPV au fost marcate ca citite.");
      refetchPortalDocs();
    },
    onError: (err: any) => {
      toast.error(`Eroare: ${err.message}`);
    },
  });

  // Deschidere și vizualizare document oficial SPV
  const openDocument = (doc: any) => {
    if (!doc.isRead) {
      markReadMutation.mutate({ id: doc.id, isRead: true });
    }
    setPreviewDoc({
      isOpen: true,
      title: `${doc.titlu} — ${doc.numarInregistrare || doc.cif}`,
      pdfUrl: doc.pdfUrl,
      filename: doc.fileName || `Recipisa_${doc.tip}_${doc.numarInregistrare}.pdf`,
      type: "invoice",
    });
  };

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

  // Filtrare Recipise & Documente SPV ANAF
  const filteredPortalDocs = portalDocs?.filter((doc: any) => {
    // Filtrare stare citit / necitit (nou / vechi)
    if (readFilter === "unread" && doc.isRead) return false;
    if (readFilter === "read" && !doc.isRead) return false;

    if (portalFilter === "declaratie" && doc.tip !== "RECIPISA") return false;
    if (portalFilter === "notificare" && doc.tip !== "CERTIFICAT FISCAL" && doc.tip !== "NOTIFICARE") return false;
    if (portalFilter === "decizie" && doc.tip !== "RASPUNS SOLICITARE" && doc.categorie !== "decizie_impunere") return false;

    // Filtre specifice pe coloanele din portalul ANAF SPV
    if (filterCif.trim() && !doc.cif?.toLowerCase().includes(filterCif.toLowerCase().trim())) {
      return false;
    }
    if (filterTipDoc && filterTipDoc !== "-TOATE-" && doc.tip !== filterTipDoc) {
      return false;
    }
    if (filterIdSolicitare.trim() && !doc.idSolicitare?.toLowerCase().includes(filterIdSolicitare.toLowerCase().trim())) {
      return false;
    }
    if (filterDataAfisare.trim() && !doc.dataDepunere?.toLowerCase().includes(filterDataAfisare.toLowerCase().trim())) {
      return false;
    }
    if (filterDetalii.trim() && !doc.detalii?.toLowerCase().includes(filterDetalii.toLowerCase().trim())) {
      return false;
    }
    if (filterDataArhivare.trim() && !doc.dataArhivare?.toLowerCase().includes(filterDataArhivare.toLowerCase().trim())) {
      return false;
    }

    if (portalSearchQuery.trim()) {
      const q = portalSearchQuery.toLowerCase().trim();
      const tipMatch = doc.tip?.toLowerCase().includes(q);
      const nrMatch = doc.numarInregistrare?.toLowerCase().includes(q);
      const titluMatch = doc.titlu?.toLowerCase().includes(q);
      const perMatch = doc.perioadaFiscala?.toLowerCase().includes(q);
      const detMatch = doc.detalii?.toLowerCase().includes(q);
      const solMatch = doc.idSolicitare?.toLowerCase().includes(q);
      const arhMatch = doc.dataArhivare?.toLowerCase().includes(q);
      if (!tipMatch && !nrMatch && !titluMatch && !perMatch && !detMatch && !solMatch && !arhMatch) {
        return false;
      }
    }
    return true;
  });

  // Statistici Recipise & Documente SPV
  const portalStats = {
    total: portalDocs?.length || 0,
    unread: portalDocs?.filter((d: any) => !d.isRead).length || 0,
    read: portalDocs?.filter((d: any) => d.isRead).length || 0,
    recipise: portalDocs?.filter((d: any) => d.tip === "RECIPISA").length || 0,
    certificate: portalDocs?.filter((d: any) => d.tip === "CERTIFICAT FISCAL").length || 0,
    solicitari: portalDocs?.filter((d: any) => d.tip === "RASPUNS SOLICITARE").length || 0,
    notificari: portalDocs?.filter((d: any) => d.tip === "NOTIFICARE" || d.categorie === "notificare_anaf").length || 0,
  };

  // Paginare documente SPV
  const totalPages = Math.max(1, Math.ceil((filteredPortalDocs?.length || 0) / pageSize));
  const paginatedPortalDocs = filteredPortalDocs?.slice((page - 1) * pageSize, page * pageSize) || [];

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

        {/* ─── TAB 1: MESAJE & RECIPISE DECLARAȚII SPV (EXACT CA ÎN PORTALUL ANAF SPV) ─── */}
        {activeHubTab === "declaratii" && (
          <div className="space-y-4">
            {/* Carduri Statistici */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card 
                className={`shadow-2xs cursor-pointer transition-colors ${readFilter === "all" ? "ring-2 ring-blue-600/30" : ""}`}
                onClick={() => { setReadFilter("all"); setPage(1); }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Toate Mesajele SPV</CardTitle>
                  <Inbox className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {portalStats.total}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Disponibile în portalul ANAF</p>
                </CardContent>
              </Card>

              <Card 
                className={`shadow-2xs cursor-pointer transition-colors ${readFilter === "unread" ? "ring-2 ring-red-600/50 bg-red-50/20" : ""}`}
                onClick={() => { setReadFilter("unread"); setPage(1); }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-red-600 dark:text-red-400">Mesaje Noi (Necitite)</CardTitle>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    {portalStats.unread}
                  </div>
                  <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">Evidențiate cu roșu în tabel</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Recipise Declarații</CardTitle>
                  <FileCheck className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
                    {portalStats.recipise}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">D101, D112, D300, D394, D100, D390</p>
                </CardContent>
              </Card>

              <Card className="shadow-2xs">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                  <CardTitle className="text-xs font-medium text-slate-500">Certificate & Solicitări</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-bold tabular-nums text-purple-700 dark:text-purple-300">
                    {portalStats.certificate + portalStats.solicitari}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Atestare fiscală, vector fiscal, fișă rol</p>
                </CardContent>
              </Card>
            </div>

            {/* Avertisment Oficial ANAF SPV */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[12px]">Informații documente electronice disponibile</p>
                <p className="mt-0.5 text-slate-700 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  <strong>ATENȚIE!</strong> — Documentele electronice afișate sunt disponibile pentru descărcare doar până la data arhivării. Pentru a nu le pierde, recomandăm descărcarea și păstrarea lor pe stațiile proprii.
                </p>
              </div>
            </div>

            {/* Bara de Comenzi & Filtre */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3264] hover:bg-[#16254a] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Resetează toate filtrele aplicate pe tabel"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Elimină Filtre</span>
                </button>

                {/* Filtre Stare: Toate / Noi (Necitite) / Citite */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => { setReadFilter("all"); setPage(1); }}
                    className={`px-2.5 py-1 font-bold rounded transition-colors cursor-pointer ${
                      readFilter === "all"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Toate ({portalStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReadFilter("unread"); setPage(1); }}
                    className={`px-2.5 py-1 font-bold rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                      readFilter === "unread"
                        ? "bg-red-600 text-white shadow-2xs"
                        : "text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${readFilter === "unread" ? "bg-white" : "bg-red-500 animate-pulse"}`} />
                    <span>Noi ({portalStats.unread})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReadFilter("read"); setPage(1); }}
                    className={`px-2.5 py-1 font-bold rounded transition-colors cursor-pointer ${
                      readFilter === "read"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Citite ({portalStats.read})
                  </button>
                </div>

                {portalStats.unread > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    title="Marchează toate mesajele ca citite"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Marchează toate ca citite</span>
                  </button>
                )}

                {(filterCif || (filterTipDoc && filterTipDoc !== "-TOATE-") || filterIdSolicitare || filterDataAfisare || filterDetalii || filterDataArhivare || portalSearchQuery) && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                    Afișate {filteredPortalDocs?.length || 0} din {portalDocs?.length || 0} documente
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    value={portalSearchQuery}
                    onChange={(e) => {
                      setPortalSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Caută în toate coloanele..."
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </div>
            </div>

            {/* Tabelul Oficial ANAF SPV */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
              {isLoadingPortalDocs ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : filteredPortalDocs?.length === 0 ? (
                <div className="p-16 text-center text-slate-500">
                  <FileCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-sm">Nu există documente electronice care să corespundă filtrelor.</p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3264] text-white text-xs font-semibold rounded-lg"
                  >
                    <span>Resetează filtrele</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    {/* Antet Oficial SPV ANAF cu fundal albastru închis */}
                    <thead>
                      <tr className="bg-[#1e3264] text-white text-[11px] font-bold select-none border-b border-[#16254a]">
                        <th className="py-2.5 px-3 w-28">CIF</th>
                        <th className="py-2.5 px-3 w-44">Tip Document</th>
                        <th className="py-2.5 px-3 w-32">Id Solicitare</th>
                        <th className="py-2.5 px-3 w-36">Data Afisare</th>
                        <th className="py-2.5 px-3 w-28 text-center">Descarcare document</th>
                        <th className="py-2.5 px-3">Detalii</th>
                        <th className="py-2.5 px-3 w-44">Data Arhivare/Data afisare SPV</th>
                      </tr>

                      {/* Rândul de Filtrare Direct sub Antet (exact ca în portalul ANAF) */}
                      <tr className="bg-[#243d78] border-b border-[#1b2e5a] p-1">
                        <th className="p-1.5">
                          <input
                            type="text"
                            value={filterCif}
                            onChange={(e) => {
                              setFilterCif(e.target.value);
                              setPage(1);
                            }}
                            placeholder="Filtru CIF..."
                            className="w-full h-6 text-[11px] bg-white text-slate-900 px-1.5 rounded border-none outline-none font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <select
                            value={filterTipDoc}
                            onChange={(e) => {
                              setFilterTipDoc(e.target.value);
                              setPage(1);
                            }}
                            className="w-full h-6 text-[11px] bg-white text-slate-900 px-1 rounded border-none outline-none font-normal"
                          >
                            <option value="-TOATE-">-TOATE-</option>
                            <option value="RECIPISA">RECIPISA</option>
                            <option value="CERTIFICAT FISCAL">CERTIFICAT FISCAL</option>
                            <option value="RASPUNS SOLICITARE">RASPUNS SOLICITARE</option>
                            <option value="NOTIFICARE">NOTIFICARE</option>
                          </select>
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            value={filterIdSolicitare}
                            onChange={(e) => {
                              setFilterIdSolicitare(e.target.value);
                              setPage(1);
                            }}
                            placeholder="Filtru ID..."
                            className="w-full h-6 text-[11px] bg-white text-slate-900 px-1.5 rounded border-none outline-none font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            value={filterDataAfisare}
                            onChange={(e) => {
                              setFilterDataAfisare(e.target.value);
                              setPage(1);
                            }}
                            placeholder="Filtru Dată..."
                            className="w-full h-6 text-[11px] bg-white text-slate-900 px-1.5 rounded border-none outline-none font-normal"
                          />
                        </th>
                        <th className="p-1.5 text-center">
                          <div className="text-[10px] text-slate-200 font-normal">PDF</div>
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            value={filterDetalii}
                            onChange={(e) => {
                              setFilterDetalii(e.target.value);
                              setPage(1);
                            }}
                            placeholder="Filtru D101, D394, Vector..."
                            className="w-full h-6 text-[11px] bg-white text-slate-900 px-1.5 rounded border-none outline-none font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            value={filterDataArhivare}
                            onChange={(e) => {
                              setFilterDataArhivare(e.target.value);
                              setPage(1);
                            }}
                            placeholder="Filtru Arhivare..."
                            className="w-full h-6 text-[11px] bg-white text-slate-900 px-1.5 rounded border-none outline-none font-normal"
                          />
                        </th>
                      </tr>
                    </thead>

                    {/* Corp Tabel */}
                    <tbody>
                      {paginatedPortalDocs.map((doc: any, idx: number) => {
                        // Mesajele necitite/noi sunt afișate cu text ROȘU, exact ca în portalul oficial ANAF SPV!
                        const isUnread = !doc.isRead;
                        const rowTextColor = isUnread
                          ? "text-[#dc2626] font-semibold"
                          : "text-slate-800 dark:text-slate-200 font-normal";

                        return (
                          <tr
                            key={doc.id}
                            onClick={() => openDocument(doc)}
                            className={`border-b border-slate-200 dark:border-slate-800 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 cursor-pointer transition-colors ${
                              isUnread ? "bg-red-50/30 dark:bg-red-950/20" : (idx % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-900/30" : "bg-white dark:bg-slate-900")
                            }`}
                          >
                            {/* CIF */}
                            <td className={`py-3 px-3 tabular-nums whitespace-nowrap ${rowTextColor}`}>
                              {doc.cif}
                            </td>

                            {/* Tip Document */}
                            <td className={`py-3 px-3 uppercase whitespace-nowrap font-bold tracking-tight ${rowTextColor}`}>
                              <div className="flex items-center gap-1.5">
                                <span>{doc.tip}</span>
                                {isUnread && (
                                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
                                    NOU
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Id Solicitare */}
                            <td className={`py-3 px-3 tabular-nums whitespace-nowrap ${isUnread ? "text-[#dc2626] font-semibold" : "text-slate-600 dark:text-slate-400"}`}>
                              {doc.idSolicitare || "-"}
                            </td>

                            {/* Data Afisare */}
                            <td className={`py-3 px-3 tabular-nums whitespace-nowrap ${rowTextColor}`}>
                              {doc.dataDepunere}
                            </td>

                            {/* Descarcare document — Butonul oficial albastru [PDF] ca în ANAF + Toggle citit */}
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="inline-flex items-center gap-1.5 justify-center">
                                <button
                                  type="button"
                                  onClick={() => openDocument(doc)}
                                  className="inline-flex items-center justify-center px-3 py-1 bg-[#1e40af] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded shadow-2xs transition-colors cursor-pointer"
                                  title="Deschide documentul PDF oficial ANAF"
                                >
                                  PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => markReadMutation.mutate({ id: doc.id, isRead: !doc.isRead })}
                                  disabled={markReadMutation.isPending}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                  title={doc.isRead ? "Marchează ca necitit (va fi afișat cu text roșu ca nou)" : "Marchează ca citit (va deveni negru)"}
                                >
                                  <Eye className={`w-3.5 h-3.5 ${doc.isRead ? "opacity-35" : "text-red-600 font-bold"}`} />
                                </button>
                              </div>
                            </td>

                            {/* Detalii */}
                            <td className={`py-3 px-3 leading-relaxed ${rowTextColor}`}>
                              <p className="line-clamp-2">{doc.detalii}</p>
                            </td>

                            {/* Data Arhivare/Data afisare SPV */}
                            <td className={`py-3 px-3 tabular-nums whitespace-nowrap ${rowTextColor}`}>
                              {doc.dataArhivare || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bara de Paginare Oficială SPV */}
              {filteredPortalDocs && filteredPortalDocs.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-xs">
                  <div className="text-slate-500">
                    Afișate {(page - 1) * pageSize + 1} – {Math.min(page * pageSize, filteredPortalDocs.length)} din {filteredPortalDocs.length} mesaje
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-bold"
                      title="Prima pagină"
                    >
                      |&lt;
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-bold"
                      title="Pagina precedentă"
                    >
                      &lt;
                    </button>

                    <span className="px-3 py-1 font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {page} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-bold"
                      title="Pagina următoare"
                    >
                      &gt;
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-bold"
                      title="Ultima pagină"
                    >
                      &gt;|
                    </button>
                  </div>
                </div>
              )}
            </div>
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
