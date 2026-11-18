import React, { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { toast } from "sonner";
import DocumentModalPreview from "@/components/DocumentModalPreview";

export default function SpvHub() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: integrationsList, refetch: refetchIntegrations } =
    trpc.integrations.list.useQuery();
  const { data: oauthInfo } = trpc.integrations.getSpvOAuthUrl.useQuery();

  // Tab Principal: Mesaje & Recipise SPV vs Mesaje e-Factura
  const [activeHubTab, setActiveHubTab] = useState<"declaratii" | "efactura">(
    "declaratii"
  );

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

  const hasAutoSelectedTabRef = useRef(false);

  useEffect(() => {
    hasAutoSelectedTabRef.current = false;
  }, [oauthInfo?.tenantCui]);

  useEffect(() => {
    if (isLoadingPortalDocs || isLoadingMessages || hasAutoSelectedTabRef.current) {
      return;
    }
    if ((portalDocs?.length || 0) === 0 && (rawMessages?.length || 0) > 0) {
      hasAutoSelectedTabRef.current = true;
      setActiveHubTab("efactura");
    } else if ((portalDocs?.length || 0) > 0) {
      hasAutoSelectedTabRef.current = true;
    }
  }, [isLoadingPortalDocs, isLoadingMessages, portalDocs, rawMessages]);

  // Filtre Documente SPV
  const [portalFilter, setPortalFilter] = useState<
    "all" | "declaratie" | "cert_sol"
  >("all");
  const [portalSearchQuery, setPortalSearchQuery] = useState<string>("");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">(
    "all"
  );

  // Filtre Coloane Specifice Portal ANAF SPV
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
  const [messageFilter, setMessageFilter] = useState<
    "all" | "primita" | "trimisa" | "eroare"
  >("all");
  const [searchMessageQuery, setSearchMessageQuery] = useState<string>("");

  // Stare Diagnostic, Sincronizare & Copiere
  const [testResult, setTestResult] = useState<any>(null);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Stare Modal Upload Recipisă / Document original SPV
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Stare Conector Chrome Stick USB ANAF (webserviced.anaf.ro/SPVWS2)
  const [connectorReady, setConnectorReady] = useState<boolean>(
    () =>
      typeof document !== "undefined" &&
      Boolean(document.documentElement.dataset.spvConnectorInstalled)
  );
  const [isConnectorModalOpen, setIsConnectorModalOpen] = useState(false);
  const [isUsbSyncing, setIsUsbSyncing] = useState(false);
  const [usbSyncStatus, setUsbSyncStatus] = useState<string | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  useEffect(() => {
    const onReady = () => {
      setConnectorReady(true);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (
        event.data?.source === "smart-invoice-extension" &&
        event.data?.type === "SPV_CONNECTOR_PONG"
      ) {
        setConnectorReady(true);
      }
    };
    window.addEventListener("spv-connector-ready", onReady);
    window.addEventListener("message", onMessage);
    window.postMessage(
      { source: "smart-invoice-app", type: "SPV_CONNECTOR_PING" },
      "*"
    );
    return () => {
      window.removeEventListener("spv-connector-ready", onReady);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  // Previzualizare modal PDF
  const [selectedSpvMessage, setSelectedSpvMessage] = useState<any | null>(
    null
  );
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

  // Mutații Sincronizare (strict date reale din API-ul OAuth ANAF RO e-Factura)
  const syncMessagesMutation = (
    trpc as any
  ).spvMessages.syncFromAnaf.useMutation();
  const syncInvoicesMutation = trpc.integrations.syncSpv.useMutation();

  const handleSyncAll = async () => {
    if (isSyncingAll || isUsbSyncing) return;
    setIsSyncingAll(true);
    try {
      const [msgRes, invRes] = await Promise.allSettled([
        syncMessagesMutation.mutateAsync(),
        syncInvoicesMutation.mutateAsync({ zile: 60 }),
      ]);

      let usbOutcome: any = null;
      if (connectorReady && oauthInfo?.tenantCui) {
        usbOutcome = await runUsbSpvSync({ fromUnifiedSync: true });
      }

      await Promise.allSettled([
        refetchPortalDocs(),
        refetchMessages(),
        utils.spvLogs.list.invalidate(),
        utils.invoices.list.invalidate(),
        utils.invoiceArchive.list.invalidate(),
        refetchIntegrations(),
      ]);

      const msgTotal =
        msgRes.status === "fulfilled" ? msgRes.value?.total : undefined;
      if ((usbOutcome?.downloaded || 0) > 0 || (usbOutcome?.matchedTotal || 0) > 0) {
        setActiveHubTab("declaratii");
      } else if (
        (portalDocs?.length || 0) === 0 &&
        typeof msgTotal === "number" &&
        msgTotal > 0
      ) {
        setActiveHubTab("efactura");
      }

      const importedInvoices =
        invRes.status === "fulfilled" ? invRes.value?.imported || 0 : 0;
      const usbDownloaded = Number(usbOutcome?.downloaded || 0);

      if (msgRes.status === "rejected" && invRes.status === "rejected" && !usbOutcome?.ok) {
        if (!usbOutcome?.error) {
          toast.error(
            msgRes.reason?.message || "Eroare la sincronizarea cu ANAF."
          );
        }
      } else if (usbDownloaded > 0) {
        toast.success(`Actualizat din SPV (${usbDownloaded} documente noi).`);
      } else if (importedInvoices > 0) {
        toast.success(`Actualizat din SPV (${importedInvoices} facturi noi).`);
      } else if (!usbOutcome || usbOutcome.ok) {
        toast.success("Datele din SPV au fost actualizate.");
      }
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Mutație Marcare Document Citit / Necitit
  const markReadMutation = (
    trpc as any
  ).spvMessages.markPortalDocumentRead.useMutation({
    onSuccess: () => {
      refetchPortalDocs();
    },
    onError: (err: any) => {
      toast.error(`Eroare la actualizarea stării: ${err.message}`);
    },
  });

  // Mutație Marcare Toate Documentele ca Citite
  const markAllReadMutation = (
    trpc as any
  ).spvMessages.markAllPortalDocumentsRead.useMutation({
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
      filename:
        doc.fileName || `Recipisa_${doc.tip}_${doc.numarInregistrare}.pdf`,
      type: "invoice",
    });
  };

  const handleCheckConnector = () => {
    const installedVer = document.documentElement.dataset.spvConnectorInstalled;
    if (installedVer) {
      setConnectorReady(true);
      toast.success("Extensia Conector SPV USB este activă.");
      return;
    }
    window.postMessage(
      { source: "smart-invoice-app", type: "SPV_CONNECTOR_PING" },
      "*"
    );
    setTimeout(() => {
      const retryVer = document.documentElement.dataset.spvConnectorInstalled;
      if (retryVer) {
        setConnectorReady(true);
        toast.success("Extensia Conector SPV USB este activă.");
      } else {
        toast.info(
          "Extensia nu a fost detectată încă. Reîncarcă pagina după instalarea în chrome://extensions."
        );
      }
    }, 350);
  };

  const handleDownloadConnectorZip = async () => {
    if (isDownloadingZip) return;
    setIsDownloadingZip(true);
    try {
      const token = localStorage.getItem("authToken");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/spv-connector.zip", {
        method: "GET",
        credentials: "include",
        headers,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Eroare HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Conector_SPV_ANAF.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Arhiva Conector_SPV_ANAF.zip a fost descărcată.");
    } catch (err: any) {
      toast.error(`Nu s-a putut descărca arhiva: ${err.message}`);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const logUsbResultToServer = (payload: any) => {
    try {
      const token = localStorage.getItem("authToken");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      fetch("/api/spv/connector-log", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(payload || {}),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  };

  const runUsbSpvSync = async (options?: {
    fromUnifiedSync?: boolean;
  }): Promise<any> => {
    const fromUnifiedSync = Boolean(options?.fromUnifiedSync);
    if (!connectorReady) {
      if (!fromUnifiedSync) setIsConnectorModalOpen(true);
      return null;
    }
    if (!oauthInfo?.tenantCui) {
      if (!fromUnifiedSync) {
        toast.error("Profilul activ nu are CUI / CNP configurat în Setări.");
      }
      return null;
    }
    if (isUsbSyncing) return null;

    setIsUsbSyncing(true);
    setUsbSyncStatus(null);

    const requestId = `spv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const existingIds = (portalDocs || [])
      .map((d: any) => String(d.numarInregistrare || ""))
      .filter(Boolean);

    try {
      const result: any = await new Promise((resolve) => {
        const safetyTimer = window.setTimeout(() => {
          window.removeEventListener("message", onExtMessage);
          resolve({
            ok: false,
            error:
              "Timpul de așteptare pentru sincronizarea prin extensia Chrome a expirat.",
          });
        }, 150000);

        const onExtMessage = async (event: MessageEvent) => {
          if (event.source !== window) return;
          const data = event.data;
          if (!data || data.source !== "smart-invoice-extension") return;
          if (data.requestId !== requestId) return;

          if (data.type === "SPV_CONNECTOR_PROGRESS") {
            setUsbSyncStatus(`Se descarcă ${data.current}/${data.total}...`);
            return;
          }

          if (data.type === "SPV_CONNECTOR_DOCUMENT") {
            try {
              const token = localStorage.getItem("authToken");
              const headers: HeadersInit = {
                "Content-Type": "application/json",
              };
              if (token) headers["Authorization"] = `Bearer ${token}`;

              const saveRes = await fetch("/api/spv/import-real-document", {
                method: "POST",
                credentials: "include",
                headers,
                body: JSON.stringify(data.item),
              });
              const saveJson = await saveRes.json().catch(() => ({}));
              if (!saveRes.ok) {
                throw new Error(
                  saveJson.error || `Eroare HTTP ${saveRes.status}`
                );
              }
              window.postMessage(
                {
                  source: "smart-invoice-app",
                  type: "SPV_CONNECTOR_DOCUMENT_ACK",
                  requestId,
                  anafId: data.item?.anafId,
                  ok: true,
                  skippedDuplicate: Boolean(saveJson.skippedDuplicate),
                },
                "*"
              );
            } catch (err: any) {
              window.postMessage(
                {
                  source: "smart-invoice-app",
                  type: "SPV_CONNECTOR_DOCUMENT_ACK",
                  requestId,
                  anafId: data.item?.anafId,
                  ok: false,
                  error: err?.message || "Eroare la salvare",
                },
                "*"
              );
            }
            return;
          }

          if (data.type === "SPV_CONNECTOR_DONE") {
            window.clearTimeout(safetyTimer);
            window.removeEventListener("message", onExtMessage);
            resolve(data);
          }
        };

        window.addEventListener("message", onExtMessage);
        window.postMessage(
          {
            source: "smart-invoice-app",
            type: "SPV_CONNECTOR_SYNC",
            requestId,
            cif: oauthInfo.tenantCui,
            zile: 60,
            existingIds,
          },
          "*"
        );
      });

      logUsbResultToServer(result);
      await refetchPortalDocs();

      if (!result?.ok) {
        const errMsg =
          result?.error || "Eroare la citirea mesajelor SPV prin stick USB.";
        toast.error(errMsg);
        return result;
      }

      if ((result.downloaded || 0) > 0 || (result.matchedTotal || 0) > 0) {
        setActiveHubTab("declaratii");
      }

      if (!fromUnifiedSync) {
        if ((result.downloaded || 0) > 0) {
          toast.success(
            `S-au descărcat ${result.downloaded} documente noi din SPV.`
          );
        } else if ((result.matchedTotal || 0) > 0) {
          toast.info("Toate documentele disponibile sunt deja salvate.");
        } else {
          toast.info("Nu există documente noi în SPV.");
        }
      }

      if ((result.failed || 0) > 0 && result.lastError) {
        toast.error(
          `${result.failed} documente nu au putut fi salvate: ${result.lastError}`
        );
      }
      return result;
    } finally {
      setIsUsbSyncing(false);
      setUsbSyncStatus(null);
    }
  };

  const handleUsbSpvSync = async () => {
    await runUsbSpvSync({ fromUnifiedSync: false });
  };

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
      const token = localStorage.getItem("authToken");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/upload-spv-document", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Eroare HTTP ${res.status}`);
      }

      const resData = await res.json();
      toast.success(
        `S-au salvat ${resData.count || 1} documente SPV în arhivă.`
      );
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
    if (readFilter === "unread" && doc.isRead) return false;
    if (readFilter === "read" && !doc.isRead) return false;

    if (portalFilter === "declaratie" && doc.tip !== "RECIPISA") return false;
    if (
      portalFilter === "cert_sol" &&
      doc.tip !== "CERTIFICAT FISCAL" &&
      doc.tip !== "RASPUNS SOLICITARE" &&
      doc.tip !== "NOTIFICARE" &&
      doc.tip !== "DECIZIE" &&
      doc.tip !== "ADRESE" &&
      doc.categorie !== "decizie_impunere"
    ) {
      return false;
    }

    if (
      filterCif.trim() &&
      !doc.cif?.toLowerCase().includes(filterCif.toLowerCase().trim())
    ) {
      return false;
    }
    if (filterTipDoc && filterTipDoc !== "-TOATE-" && doc.tip !== filterTipDoc) {
      return false;
    }
    if (
      filterIdSolicitare.trim() &&
      !doc.idSolicitare
        ?.toLowerCase()
        .includes(filterIdSolicitare.toLowerCase().trim())
    ) {
      return false;
    }
    if (
      filterDataAfisare.trim() &&
      !doc.dataDepunere
        ?.toLowerCase()
        .includes(filterDataAfisare.toLowerCase().trim())
    ) {
      return false;
    }
    if (
      filterDetalii.trim() &&
      !doc.detalii?.toLowerCase().includes(filterDetalii.toLowerCase().trim())
    ) {
      return false;
    }
    if (
      filterDataArhivare.trim() &&
      !doc.dataArhivare
        ?.toLowerCase()
        .includes(filterDataArhivare.toLowerCase().trim())
    ) {
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
      if (
        !tipMatch &&
        !nrMatch &&
        !titluMatch &&
        !perMatch &&
        !detMatch &&
        !solMatch &&
        !arhMatch
      ) {
        return false;
      }
    }
    return true;
  });

  // Statistici Documente SPV
  const portalStats = {
    total: portalDocs?.length || 0,
    unread: portalDocs?.filter((d: any) => !d.isRead).length || 0,
    read: portalDocs?.filter((d: any) => d.isRead).length || 0,
    recipise:
      portalDocs?.filter((d: any) => d.tip === "RECIPISA").length || 0,
    certificate:
      portalDocs?.filter((d: any) => d.tip === "CERTIFICAT FISCAL").length || 0,
    solicitari:
      portalDocs?.filter((d: any) => d.tip === "RASPUNS SOLICITARE").length ||
      0,
    decizii:
      portalDocs?.filter(
        (d: any) =>
          d.tip === "DECIZIE" ||
          d.categorie === "decizie_impunere" ||
          d.tip === "NOTIFICARE" ||
          d.tip === "ADRESE"
      ).length || 0,
  };

  // Paginare documente SPV
  const totalPages = Math.max(
    1,
    Math.ceil((filteredPortalDocs?.length || 0) / pageSize)
  );
  const paginatedPortalDocs =
    filteredPortalDocs?.slice((page - 1) * pageSize, page * pageSize) || [];

  // Filtrare Mesaje e-Factura
  const filteredMessages = rawMessages?.filter((msg: any) => {
    if (messageFilter === "primita" && msg.tip !== "FACTURA PRIMITA")
      return false;
    if (messageFilter === "trimisa" && msg.tip !== "FACTURA TRIMISA")
      return false;
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
      if (
        !numMatch &&
        !nameMatch &&
        !emitMatch &&
        !benMatch &&
        !solMatch &&
        !idMatch &&
        !detMatch
      ) {
        return false;
      }
    }
    return true;
  });

  const msgStats = {
    total: rawMessages?.length || 0,
    primite:
      rawMessages?.filter((m: any) => m.tip === "FACTURA PRIMITA").length || 0,
    trimise:
      rawMessages?.filter((m: any) => m.tip === "FACTURA TRIMISA").length || 0,
    erori:
      rawMessages?.filter((m: any) => m.tip === "ERORI FACTURA").length || 0,
  };

  const tokenExpiresAt = spvIntegration?.tokenExpiresAt
    ? new Date(spvIntegration.tokenExpiresAt)
    : null;
  const daysUntilExpiration = tokenExpiresAt
    ? Math.ceil((tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isSyncBusy =
    isSyncingAll ||
    isUsbSyncing ||
    syncMessagesMutation.isPending ||
    syncInvoicesMutation.isPending ||
    isFetchingMessages;

  const hasActivePortalFilters = Boolean(
    filterCif ||
      (filterTipDoc && filterTipDoc !== "-TOATE-") ||
      filterIdSolicitare ||
      filterDataAfisare ||
      filterDetalii ||
      filterDataArhivare ||
      portalSearchQuery ||
      readFilter !== "all" ||
      portalFilter !== "all"
  );

  return (
    <>
      <div className="p-4 sm:p-6 max-w-full space-y-4">
        {/* Nivelul 1 — Antet Executiv Curat pe un singur rând */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 border border-blue-100 dark:border-blue-900 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                Mesaje &amp; Documente SPV ANAF
              </h1>
              {spvIntegration?.apiKey ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 whitespace-nowrap shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>
                    Conectat
                    {daysUntilExpiration != null
                      ? ` · Token ${daysUntilExpiration} zile`
                      : ""}
                  </span>
                </span>
              ) : (
                <Link href="/integrari">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 whitespace-nowrap shrink-0 cursor-pointer transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>OAuth SPV neconectat · Conectează în Integrări</span>
                  </span>
                </Link>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Recipise declarații fiscale, certificate de atestare, răspunsuri
              solicitări și flux RO e-Factura.
            </p>
          </div>

          {/* Bară de acțiuni aliniată pe un singur rând */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              type="button"
              onClick={() => testSpvMutation.mutate()}
              disabled={testSpvMutation.isPending}
              className="h-9 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors px-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-60"
              title="Trimite un ping către serverul ANAF și verifică token-ul"
            >
              {testSpvMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Se testează...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Testează conexiunea</span>
                </>
              )}
            </button>

            {oauthInfo?.url && (
              <a
                href={oauthInfo.url}
                target="_blank"
                rel="noreferrer"
                className="h-9 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors px-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                title="Reautorizare certificat cu token OAuth ANAF"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Reautorizare</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleUsbSpvSync}
              disabled={isUsbSyncing}
              className={`h-9 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors px-3 border cursor-pointer disabled:opacity-60 ${
                connectorReady
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
              title={
                connectorReady
                  ? "Descarcă direct din SPV ANAF documentele originale PDF/ZIP folosind stick-ul USB"
                  : "Instalează extensia Chrome Conector SPV pentru stick USB"
              }
            >
              {isUsbSyncing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{usbSyncStatus || "Se sincronizează USB..."}</span>
                </>
              ) : (
                <>
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${
                      connectorReady ? "text-emerald-600" : "text-slate-500"
                    }`}
                  />
                  <span>
                    {connectorReady
                      ? "Sincronizează Stick USB"
                      : "Instalează Conector USB"}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="h-9 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Încarcă o recipisă sau notificare PDF/ZIP originală descărcată din SPV"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Încarcă Recipisă</span>
            </button>

            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncBusy}
              className="h-9 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors px-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white shadow-2xs cursor-pointer"
              title="Interoghează ANAF și actualizează lista mesajelor"
            >
              {isSyncBusy ? (
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
          </div>
        </div>

        {/* Diagnostic Conexiune SPV (doar când utilizatorul testează explicit) */}
        {testResult && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border transition-all ${
              testResult.connected
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100"
                : "bg-red-50/90 border-red-200 text-red-950 dark:bg-red-950/40 dark:border-red-800 dark:text-red-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs flex-wrap">
                {testResult.connected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="font-bold">
                  {testResult.connected
                    ? "Conexiune SPV ANAF Activă"
                    : "Conexiune Eșuată"}
                </span>
                {testResult.latencyMs != null && (
                  <span className="px-2 py-0.5 rounded-md font-semibold bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 tabular-nums">
                    Latență: {testResult.latencyMs} ms
                  </span>
                )}
                {testResult.cui && (
                  <span className="px-2 py-0.5 rounded-md font-semibold bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 tabular-nums">
                    CUI: {testResult.cui}
                  </span>
                )}
                {(testResult.daysRemaining ?? testResult.tokenDaysRemaining) !=
                  null && (
                  <span className="px-2 py-0.5 rounded-md font-semibold bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 tabular-nums">
                    Token:{" "}
                    {testResult.daysRemaining ?? testResult.tokenDaysRemaining}{" "}
                    zile
                  </span>
                )}
                <span className="opacity-90">{testResult.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="rounded-lg p-1 hover:opacity-100 opacity-60 cursor-pointer"
                title="Închide panoul de diagnostic"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Nivelul 2 — Bandă KPI Orizontală Compactă */}
        {activeHubTab === "declaratii" ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => {
                setReadFilter("all");
                setPortalFilter("all");
                setFilterTipDoc("-TOATE-");
                setPage(1);
              }}
              className={`rounded-xl bg-white dark:bg-slate-900 border px-4 py-3 flex items-center gap-3.5 shadow-2xs text-left transition-all cursor-pointer ${
                readFilter === "all" && portalFilter === "all"
                  ? "border-blue-500 ring-1 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                <Inbox className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Toate Documentele
                </p>
                <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white leading-tight mt-0.5">
                  {portalStats.total}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setReadFilter("unread");
                setPortalFilter("all");
                setPage(1);
              }}
              className={`rounded-xl bg-white dark:bg-slate-900 border px-4 py-3 flex items-center gap-3.5 shadow-2xs text-left transition-all cursor-pointer ${
                readFilter === "unread"
                  ? "border-red-500 ring-1 ring-red-500/20 bg-red-50/30 dark:bg-red-950/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-900/60"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 relative">
                <AlertCircle className="w-5 h-5" />
                {portalStats.unread > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse absolute top-1.5 right-1.5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 truncate">
                  Mesaje Noi (Necitite)
                </p>
                <p
                  className={`text-xl font-bold tabular-nums leading-tight mt-0.5 ${
                    portalStats.unread > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {portalStats.unread}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setPortalFilter("declaratie");
                setReadFilter("all");
                setPage(1);
              }}
              className={`rounded-xl bg-white dark:bg-slate-900 border px-4 py-3 flex items-center gap-3.5 shadow-2xs text-left transition-all cursor-pointer ${
                portalFilter === "declaratie"
                  ? "border-blue-500 ring-1 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Recipise Declarații
                </p>
                <p className="text-xl font-bold tabular-nums text-blue-700 dark:text-blue-300 leading-tight mt-0.5">
                  {portalStats.recipise}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setPortalFilter("cert_sol");
                setReadFilter("all");
                setPage(1);
              }}
              className={`rounded-xl bg-white dark:bg-slate-900 border px-4 py-3 flex items-center gap-3.5 shadow-2xs text-left transition-all cursor-pointer ${
                portalFilter === "cert_sol"
                  ? "border-indigo-500 ring-1 ring-indigo-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Decizii, Certificate &amp; Solicitări
                </p>
                <p className="text-xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300 leading-tight mt-0.5">
                  {portalStats.certificate +
                    portalStats.solicitari +
                    portalStats.decizii}
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setMessageFilter("all")}
              className={`rounded-xl bg-white dark:bg-slate-900 border px-4 py-3 flex items-center gap-3.5 shadow-2xs text-left transition-all cursor-pointer ${
                messageFilter === "all"
                  ? "border-blue-500 ring-1 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                <Inbox className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Toate Mesajele
                </p>
                <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white leading-tight mt-0.5">
                  {msgStats.total}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMessageFilter("primita")}
              className={`rounded-xl bg-white dark:bg-slate-900 border px-4 py-3 flex items-center gap-3.5 shadow-2xs text-left transition-all cursor-pointer ${
                messageFilter === "primita"
                  ? "border-indigo-500 ring-1 ring-indigo-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Facturi Primite
                </p>
                <p className="text-xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300 leading-tight mt-0.5">
                  {msgStats.primite}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMessageFilter("trimisa")}
              className={`rounded-xl bg-white dark:bg-slate-900 border px-4 py-3 flex items-center gap-3.5 shadow-2xs text-left transition-all cursor-pointer ${
                messageFilter === "trimisa"
                  ? "border-blue-500 ring-1 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Facturi Trimise
                </p>
                <p className="text-xl font-bold tabular-nums text-blue-700 dark:text-blue-300 leading-tight mt-0.5">
                  {msgStats.trimise}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMessageFilter("eroare")}
              className={`rounded-xl bg-white dark:bg-slate-900 border px-4 py-3 flex items-center gap-3.5 shadow-2xs text-left transition-all cursor-pointer ${
                messageFilter === "eroare"
                  ? "border-red-500 ring-1 ring-red-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  Erori ANAF
                </p>
                <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400 leading-tight mt-0.5">
                  {msgStats.erori}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Nivelul 3 — Panou Principal Unificat (Tabs + Filtre + Tabel) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
          {/* Bara superioară integrată */}
          <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            {/* Stânga: Selector segmentat taburi */}
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 gap-1 self-start">
              <button
                type="button"
                onClick={() => setActiveHubTab("declaratii")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
                  activeHubTab === "declaratii"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Mesaje &amp; Recipise SPV</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {portalStats.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHubTab("efactura")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap ${
                  activeHubTab === "efactura"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Mesaje e-Factura</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {msgStats.total}
                </span>
              </button>
            </div>

            {/* Dreapta: Filtre și căutare */}
            {activeHubTab === "declaratii" ? (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filtru segmentat Citit / Necitit */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setReadFilter("all");
                      setPage(1);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      readFilter === "all"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Toate ({portalStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReadFilter("unread");
                      setPage(1);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap ${
                      readFilter === "unread"
                        ? "bg-red-600 text-white shadow-2xs"
                        : "text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        readFilter === "unread"
                          ? "bg-white"
                          : "bg-red-500 animate-pulse"
                      }`}
                    />
                    <span>Noi ({portalStats.unread})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReadFilter("read");
                      setPage(1);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
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
                    className="rounded-lg h-8 px-2.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    title="Marchează toate mesajele ca citite"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Marchează citite</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetFilters}
                  className={`rounded-lg h-8 px-2.5 text-xs font-medium border inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    hasActivePortalFilters
                      ? "bg-[#1e3264] text-white border-[#1e3264] hover:bg-[#16254a]"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                  title="Resetează toate filtrele aplicate pe tabel"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Elimină filtre</span>
                </button>

                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={portalSearchQuery}
                    onChange={(e) => {
                      setPortalSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Caută în toate coloanele..."
                    className="w-full h-8 !pl-8 !pr-3 !py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setMessageFilter("all")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      messageFilter === "all"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Toate ({msgStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageFilter("primita")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      messageFilter === "primita"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Primite ({msgStats.primite})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageFilter("trimisa")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      messageFilter === "trimisa"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Trimise ({msgStats.trimise})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageFilter("eroare")}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      messageFilter === "eroare"
                        ? "bg-red-600 text-white shadow-2xs"
                        : msgStats.erori > 0
                        ? "text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Erori ({msgStats.erori})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchMessageQuery}
                    onChange={(e) => setSearchMessageQuery(e.target.value)}
                    placeholder="Caută nr. factură, partener, CUI..."
                    className="w-full h-8 !pl-8 !pr-3 !py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Conținut Tab 1: Tabelul Oficial ANAF SPV */}
          {activeHubTab === "declaratii" ? (
            <>
              {isLoadingPortalDocs ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (portalDocs?.length || 0) === 0 ? (
                <div className="p-14 text-center text-slate-500">
                  <FileCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-sm">
                    Nu există documente în arhiva SPV.
                  </p>
                </div>
              ) : filteredPortalDocs?.length === 0 ? (
                <div className="p-14 text-center text-slate-500">
                  <FileCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-sm">
                    Nu există documente electronice care să corespundă
                    filtrelor.
                  </p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e3264] hover:bg-[#16254a] text-white text-xs font-semibold cursor-pointer"
                  >
                    <span>Resetează filtrele</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    {/* Antet Oficial SPV ANAF */}
                    <thead>
                      <tr className="bg-[#1e3264] text-white text-[11px] font-bold select-none border-b border-[#16254a]">
                        <th className="py-2.5 px-3 w-28 whitespace-nowrap">
                          {oauthInfo?.entityType === "pf" ? "CNP / CIF" : "CIF"}
                        </th>
                        <th className="py-2.5 px-3 w-44 whitespace-nowrap">
                          Tip Document
                        </th>
                        <th className="py-2.5 px-3 w-32 whitespace-nowrap">
                          Id Solicitare
                        </th>
                        <th className="py-2.5 px-3 w-36 whitespace-nowrap">
                          Data Afisare
                        </th>
                        <th className="py-2.5 px-3 w-28 text-center whitespace-nowrap">
                          Descarcare document
                        </th>
                        <th className="py-2.5 px-3">Detalii</th>
                        <th className="py-2.5 px-3 w-44 whitespace-nowrap">
                          Data Arhivare/Data afisare SPV
                        </th>
                      </tr>

                      {/* Rândul de Filtrare Direct sub Antet */}
                      <tr className="bg-[#243d78] border-b border-[#1b2e5a]">
                        <th className="p-1.5">
                          <input
                            type="text"
                            value={filterCif}
                            onChange={(e) => {
                              setFilterCif(e.target.value);
                              setPage(1);
                            }}
                            placeholder={
                              oauthInfo?.entityType === "pf"
                                ? "Filtru CNP / CIF..."
                                : "Filtru CIF..."
                            }
                            className="w-full !px-2 !py-0 h-7 text-[11px] rounded-md bg-white text-slate-900 border-none outline-none font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <select
                            value={filterTipDoc}
                            onChange={(e) => {
                              setFilterTipDoc(e.target.value);
                              setPage(1);
                            }}
                            className="w-full !px-2 !py-0 h-7 text-[11px] rounded-md bg-white text-slate-900 border-none outline-none font-normal"
                          >
                            <option value="-TOATE-">-TOATE-</option>
                            <option value="RECIPISA">RECIPISA</option>
                            <option value="CERTIFICAT FISCAL">
                              CERTIFICAT FISCAL
                            </option>
                            <option value="RASPUNS SOLICITARE">
                              RASPUNS SOLICITARE
                            </option>
                            <option value="DECIZIE">DECIZIE</option>
                            <option value="NOTIFICARE">NOTIFICARE</option>
                            <option value="ADRESE">ADRESE</option>
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
                            className="w-full !px-2 !py-0 h-7 text-[11px] rounded-md bg-white text-slate-900 border-none outline-none font-normal"
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
                            className="w-full !px-2 !py-0 h-7 text-[11px] rounded-md bg-white text-slate-900 border-none outline-none font-normal"
                          />
                        </th>
                        <th className="p-1.5 text-center">
                          <div className="text-[10px] text-slate-200 font-normal">
                            PDF
                          </div>
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
                            className="w-full !px-2 !py-0 h-7 text-[11px] rounded-md bg-white text-slate-900 border-none outline-none font-normal"
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
                            className="w-full !px-2 !py-0 h-7 text-[11px] rounded-md bg-white text-slate-900 border-none outline-none font-normal"
                          />
                        </th>
                      </tr>
                    </thead>

                    {/* Corp Tabel */}
                    <tbody>
                      {paginatedPortalDocs.map((doc: any, idx: number) => {
                        const isUnread = !doc.isRead;
                        const rowTextColor = isUnread
                          ? "text-[#dc2626] font-semibold"
                          : "text-slate-800 dark:text-slate-200 font-normal";

                        return (
                          <tr
                            key={doc.id}
                            onClick={() => openDocument(doc)}
                            className={`border-b border-slate-200 dark:border-slate-800 hover:bg-blue-50/70 dark:hover:bg-blue-950/40 cursor-pointer transition-colors ${
                              isUnread
                                ? "bg-red-50/30 dark:bg-red-950/20"
                                : idx % 2 === 1
                                ? "bg-slate-50/50 dark:bg-slate-900/30"
                                : "bg-white dark:bg-slate-900"
                            }`}
                          >
                            {/* CIF */}
                            <td
                              className={`py-2.5 px-3 tabular-nums whitespace-nowrap ${rowTextColor}`}
                            >
                              {doc.cif}
                            </td>

                            {/* Tip Document */}
                            <td
                              className={`py-2.5 px-3 uppercase whitespace-nowrap font-bold tracking-tight ${rowTextColor}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{doc.tip}</span>
                                {isUnread && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
                                    NOU
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Id Solicitare */}
                            <td
                              className={`py-2.5 px-3 tabular-nums whitespace-nowrap ${
                                isUnread
                                  ? "text-[#dc2626] font-semibold"
                                  : "text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {doc.idSolicitare || "-"}
                            </td>

                            {/* Data Afisare */}
                            <td
                              className={`py-2.5 px-3 tabular-nums whitespace-nowrap ${rowTextColor}`}
                            >
                              {doc.dataDepunere}
                            </td>

                            {/* Descarcare document — Buton [PDF] + Toggle citit */}
                            <td
                              className="py-2 px-3 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="inline-flex items-center gap-1.5 justify-center">
                                <button
                                  type="button"
                                  onClick={() => openDocument(doc)}
                                  className="rounded-md px-2.5 py-1 bg-[#1e40af] hover:bg-[#1d4ed8] text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
                                  title="Deschide documentul PDF oficial ANAF"
                                >
                                  PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    markReadMutation.mutate({
                                      id: doc.id,
                                      isRead: !doc.isRead,
                                    })
                                  }
                                  disabled={markReadMutation.isPending}
                                  className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                  title={
                                    doc.isRead
                                      ? "Marchează ca necitit (va fi afișat cu text roșu ca nou)"
                                      : "Marchează ca citit (va deveni negru)"
                                  }
                                >
                                  <Eye
                                    className={`w-3.5 h-3.5 ${
                                      doc.isRead
                                        ? "opacity-35"
                                        : "text-red-600"
                                    }`}
                                  />
                                </button>
                              </div>
                            </td>

                            {/* Detalii */}
                            <td
                              className={`py-2.5 px-3 leading-relaxed ${rowTextColor}`}
                            >
                              <p className="line-clamp-2">{doc.detalii}</p>
                            </td>

                            {/* Data Arhivare/Data afisare SPV */}
                            <td
                              className={`py-2.5 px-3 tabular-nums whitespace-nowrap ${rowTextColor}`}
                            >
                              {doc.dataArhivare || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Subsol panou: Paginare + Notă discretă de arhivare */}
              {filteredPortalDocs && filteredPortalDocs.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-xs">
                  <div className="text-slate-500 dark:text-slate-400">
                    Afișate {(page - 1) * pageSize + 1} –{" "}
                    {Math.min(page * pageSize, filteredPortalDocs.length)} din{" "}
                    {filteredPortalDocs.length} documente · Disponibile pentru
                    descărcare până la data arhivării SPV
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="rounded-md px-2 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-bold"
                      title="Prima pagină"
                    >
                      |&lt;
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-md px-2.5 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-bold"
                      title="Pagina precedentă"
                    >
                      &lt;
                    </button>

                    <span className="px-3 py-1 font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                      {page} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="rounded-md px-2.5 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-bold"
                      title="Pagina următoare"
                    >
                      &gt;
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="rounded-md px-2 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer font-bold"
                      title="Ultima pagină"
                    >
                      &gt;|
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Conținut Tab 2: Tabel Mesaje e-Factura */
            <>
              {isLoadingMessages ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : filteredMessages?.length === 0 ? (
                <div className="p-14 text-center text-slate-500">
                  <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-sm">
                    Nu există mesaje e-Factura care să corespundă căutării.
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
                        <TableHead className="w-36">
                          Index Încărcare SPV
                        </TableHead>
                        <TableHead className="w-32">ID Descărcare</TableHead>
                        <TableHead>Factură / Partener în Sistem</TableHead>
                        <TableHead className="w-32 text-center">
                          Acțiune
                        </TableHead>
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
                                  title: `Factura ${msg.invoiceNumber || ""} — ${
                                    msg.partnerName || ""
                                  }`,
                                  pdfUrl: msg.pdfUrl,
                                  filename: `Factura_${
                                    msg.invoiceNumber || msg.id
                                  }.pdf`,
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
                                {isReceived && (
                                  <ArrowDownLeft className="w-3 h-3 text-purple-600" />
                                )}
                                {isSent && (
                                  <ArrowUpRight className="w-3 h-3 text-blue-600" />
                                )}
                                {isError && (
                                  <AlertCircle className="w-3 h-3 text-red-600" />
                                )}
                                <span>{msg.tip}</span>
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="tabular-nums text-slate-700 dark:text-slate-300">
                                {msg.cifEmitent || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <span className="tabular-nums text-slate-700 dark:text-slate-300">
                                {msg.cifBeneficiar || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge
                                variant="outline"
                                className="text-[10.5px] tabular-nums"
                              >
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
                                {msg.invoiceNumber ||
                                  msg.partnerName ||
                                  "În așteptare descărcare"}
                              </span>
                            </TableCell>
                            <TableCell
                              className="py-2.5 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {msg.pdfUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDoc({
                                      isOpen: true,
                                      title: `Factura ${
                                        msg.invoiceNumber || ""
                                      } — ${msg.partnerName || ""}`,
                                      pdfUrl: msg.pdfUrl,
                                      filename: `Factura_${
                                        msg.invoiceNumber || msg.id
                                      }.pdf`,
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
            </>
          )}
        </div>
      </div>

      {/* Modal Instalare Conector Chrome Stick USB ANAF */}
      <Dialog
        open={isConnectorModalOpen}
        onOpenChange={setIsConnectorModalOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-blue-600" />
              <span>Conector Chrome pentru Stick USB ANAF (SPVWS2)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Serviciul ANAF SPV pentru decizii, recipise și declarații (webserviced.anaf.ro) cere autentificare directă mTLS cu stick-ul USB. Extensia Chrome citește stick-ul tău și urcă automat în aplicație documentele PDF originale semnate de Ministerul Finanțelor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-1 text-xs">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-3.5 space-y-2 text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">
                Instalare în 3 pași (20 secunde):
              </p>
              <p>
                1. Descarcă arhiva extensiei și dezarhivează-o (sau folosește direct folderul proiectului dacă ești pe localhost).
              </p>
              <p>
                2. Deschide în Chrome adresa{" "}
                <span className="font-semibold select-all">
                  chrome://extensions
                </span>{" "}
                și activează{" "}
                <span className="font-semibold">Developer mode</span> (dreapta-sus).
              </p>
              <p>
                3. Apasă{" "}
                <span className="font-semibold">Load unpacked</span> și selectează folderul{" "}
                <span className="font-semibold">chrome-spv-connector</span>.
              </p>
            </div>

            {typeof window !== "undefined" &&
              (window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1") && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-3 space-y-1.5">
                  <p className="text-[11px] font-semibold text-blue-900 dark:text-blue-200">
                    Calea folderului gata de încărcat în Chrome:
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-blue-950 dark:text-blue-100 break-all select-all">
                      /Users/eugeniucazmal/Downloads/dev_office/smart invoice/chrome-spv-connector
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          "/Users/eugeniucazmal/Downloads/dev_office/smart invoice/chrome-spv-connector"
                        );
                        setCopiedPath(true);
                        setTimeout(() => setCopiedPath(false), 1800);
                        toast.success("Calea a fost copiată.");
                      }}
                      className="rounded-md px-2.5 py-1 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedPath ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copiat</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiază</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadConnectorZip}
                disabled={isDownloadingZip}
                className="rounded-lg inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-semibold cursor-pointer disabled:opacity-60"
              >
                {isDownloadingZip ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Descarcă Conector_SPV_ANAF.zip</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckConnector}
                  className="rounded-lg inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Verifică extensia</span>
                </button>
                {connectorReady && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsConnectorModalOpen(false);
                      handleUsbSpvSync();
                    }}
                    className="rounded-lg inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Sincronizează acum</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Upload Recipisă / Document original SPV */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
              Încarcă Recipisă sau Mesaj Original SPV ANAF
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Selectați fișierul PDF sau arhiva ZIP originală descărcată din portalul ANAF (recipise, decizii D256, declarația D212, notificări).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50"
            >
              <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Apasă aici sau trage fișierul PDF / ZIP original descărcat din SPV
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Se salvează exclusiv fișierele reale semnate de Ministerul Finanțelor.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.zip"
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
        <Dialog
          open={Boolean(selectedSpvMessage)}
          onOpenChange={(open) => {
            if (!open) setSelectedSpvMessage(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Detalii Mesaj Oficial ANAF SPV</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Informații oficiale recepționate direct de pe serverele
                Ministerului Finanțelor
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 text-xs pt-2">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Tip Mesaj:</span>
                <span className="font-bold">{selectedSpvMessage.tip}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Data SPV:</span>
                <span className="font-semibold tabular-nums">
                  {selectedSpvMessage.dataCreare}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">CIF Emitent:</span>
                <span className="font-semibold tabular-nums">
                  {selectedSpvMessage.cifEmitent || "-"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">CIF Beneficiar:</span>
                <span className="font-semibold tabular-nums">
                  {selectedSpvMessage.cifBeneficiar || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Index Încărcare SPV:</span>
                <div className="flex items-center gap-1 font-bold tabular-nums">
                  <span>{selectedSpvMessage.idSolicitare || "-"}</span>
                  {selectedSpvMessage.idSolicitare && (
                    <button
                      type="button"
                      onClick={(e) =>
                        handleCopy(selectedSpvMessage.idSolicitare, e)
                      }
                      className="rounded-md text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
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
                    className="rounded-md text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
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
                    : selectedSpvMessage.partnerName ||
                      "Recepționat din ANAF SPV"}
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
          onClose={() =>
            setPreviewDoc({
              isOpen: false,
              title: "",
              pdfUrl: null,
              type: "invoice",
            })
          }
          title={previewDoc.title}
          pdfUrl={previewDoc.pdfUrl}
          filename={previewDoc.filename}
          type={previewDoc.type}
        />
      )}
    </>
  );
}
