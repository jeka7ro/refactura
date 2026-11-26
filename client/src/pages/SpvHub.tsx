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
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import DocumentModalPreview from "@/components/DocumentModalPreview";
import { LiveAutoSyncControl } from "@/components/LiveAutoSyncControl";

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

  // Selecție multiplă & Bulk Download PDF
  const [selectedPortalIds, setSelectedPortalIds] = useState<number[]>([]);
  const [selectedEfacturaIds, setSelectedEfacturaIds] = useState<string[]>([]);
  const [isBulkDownloading, setIsBulkDownloading] = useState<boolean>(false);
  const masterPortalCheckboxRef = useRef<HTMLInputElement>(null);
  const masterEfacturaCheckboxRef = useRef<HTMLInputElement>(null);

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
  const [connectorVersion, setConnectorVersion] = useState<string>(
    () =>
      (typeof document !== "undefined" &&
        document.documentElement.dataset.spvConnectorInstalled) ||
      ""
  );
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
  const [copiedExtUrl, setCopiedExtUrl] = useState(false);

  const isLegacyConnector = Boolean(
    connectorVersion && connectorVersion < "1.5.0"
  );

  const hasAutoReloadedExtRef = useRef(false);

  useEffect(() => {
    const syncVer = (ver?: string) => {
      const detected =
        ver || document.documentElement.dataset.spvConnectorInstalled || "";
      if (detected) {
        setConnectorVersion(detected);
        setConnectorReady(true);
        if (detected === "1.5.0" && !hasAutoReloadedExtRef.current) {
          hasAutoReloadedExtRef.current = true;
          window.postMessage(
            { source: "smart-invoice-app", type: "SPV_CONNECTOR_RELOAD" },
            window.location.origin
          );
        }
      }
    };
    const onReady = (e: Event) => {
      syncVer((e as CustomEvent)?.detail?.version);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (
        event.data?.source === "smart-invoice-extension" &&
        event.data?.type === "SPV_CONNECTOR_PONG"
      ) {
        syncVer(event.data?.version);
      }
    };
    window.addEventListener("spv-connector-ready", onReady);
    window.addEventListener("message", onMessage);
    window.postMessage(
      { source: "smart-invoice-app", type: "SPV_CONNECTOR_PING" },
      window.location.origin
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
      const currentExtVer =
        document.documentElement.dataset.spvConnectorInstalled ||
        connectorVersion;
      if (
        connectorReady &&
        oauthInfo?.tenantCui &&
        currentExtVer >= "1.5.0"
      ) {
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
    window.postMessage(
      { source: "smart-invoice-app", type: "SPV_CONNECTOR_PING" },
      window.location.origin
    );
    setTimeout(() => {
      const retryVer =
        document.documentElement.dataset.spvConnectorInstalled || "";
      if (retryVer) {
        setConnectorVersion(retryVer);
        setConnectorReady(true);
        if (retryVer < "1.5.0") {
          toast.warning(
            `În Chrome rulează încă versiunea veche v${retryVer}. Apasă Reload pe extensie în chrome://extensions pentru v1.5.0 (fără Incognito).`
          );
        } else {
          toast.success(`Extensia Conector SPV USB v${retryVer} este activă.`);
        }
      } else {
        toast.info(
          "Extensia nu a fost detectată încă. Reîncarcă pagina după instalarea în chrome://extensions."
        );
      }
    }, 300);
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
      const extVersion =
        document.documentElement.dataset.spvConnectorInstalled || "unknown";
      fetch("/api/spv/connector-log", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ ...(payload || {}), extVersion }),
      }).catch(() => { });
    } catch {
      /* ignore */
    }
  };

  const runUsbSpvSync = async (options?: {
    fromUnifiedSync?: boolean;
  }): Promise<any> => {
    const fromUnifiedSync = Boolean(options?.fromUnifiedSync);
    const currentVer =
      document.documentElement.dataset.spvConnectorInstalled || connectorVersion;
    if (!connectorReady) {
      if (!fromUnifiedSync) setIsConnectorModalOpen(true);
      return null;
    }
    if (currentVer && currentVer < "1.5.0") {
      if (!fromUnifiedSync) {
        setIsConnectorModalOpen(true);
        toast.warning(
          `În Chrome este încărcată copia veche v${currentVer} (care cerea Incognito). Apasă Reload pe extensie în chrome://extensions pentru v1.5.0.`
        );
      }
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
                window.location.origin
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
                window.location.origin
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
          window.location.origin
        );
      });

      logUsbResultToServer(result);
      await refetchPortalDocs();

      if (!result?.ok) {
        const errMsg =
          result?.error || "Eroare la citirea mesajelor SPV prin stick USB.";
        if (!fromUnifiedSync) {
          if (result?.needsIncognitoPermission) {
            setIsConnectorModalOpen(true);
          }
          toast.error(errMsg);
        }
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

    if (
      portalFilter === "declaratie" &&
      doc.tip !== "RECIPISA" &&
      doc.tip !== "DECLARATIE"
    )
      return false;
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
      const norm = (v: any) =>
        String(v || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      const haystack = norm(
        [
          doc.cif,
          doc.tip,
          doc.idSolicitare,
          doc.dataDepunere,
          doc.detalii,
          doc.dataArhivare,
          doc.numarInregistrare,
          doc.titlu,
          doc.perioadaFiscala,
          doc.fileName,
        ]
          .filter(Boolean)
          .join(" ")
      );
      const tokens = norm(portalSearchQuery).trim().split(/\s+/).filter(Boolean);
      if (!tokens.every((tok) => haystack.includes(tok))) {
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
      portalDocs?.filter(
        (d: any) => d.tip === "RECIPISA" || d.tip === "DECLARATIE"
      ).length || 0,
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
      const norm = (v: any) =>
        String(v || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      const haystack = norm(
        [
          msg.dataCreare,
          msg.tip,
          msg.cifEmitent,
          msg.cifBeneficiar,
          msg.idSolicitare,
          msg.id,
          msg.invoiceNumber,
          msg.partnerName,
          msg.detalii,
        ]
          .filter(Boolean)
          .join(" ")
      );
      const tokens = norm(searchMessageQuery).trim().split(/\s+/).filter(Boolean);
      if (!tokens.every((tok) => haystack.includes(tok))) {
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

  // Selecție filtrată Mesaje & Recipise SPV
  const filteredPortalIds: number[] = (filteredPortalDocs || []).map((d: any) => Number(d.id));
  const selectedPortalSet = new Set(selectedPortalIds);
  const allPortalSelected =
    filteredPortalIds.length > 0 &&
    filteredPortalIds.every((id) => selectedPortalSet.has(id));
  const somePortalSelected =
    !allPortalSelected &&
    filteredPortalIds.some((id) => selectedPortalSet.has(id));

  useEffect(() => {
    if (masterPortalCheckboxRef.current) {
      masterPortalCheckboxRef.current.indeterminate = somePortalSelected;
    }
  }, [somePortalSelected, allPortalSelected]);

  useEffect(() => {
    if (!portalDocs) return;
    const valid = new Set(portalDocs.map((d: any) => Number(d.id)));
    setSelectedPortalIds((prev) => prev.filter((id) => valid.has(id)));
  }, [portalDocs]);

  const toggleSelectAllPortal = () => {
    if (allPortalSelected) {
      const removeSet = new Set(filteredPortalIds);
      setSelectedPortalIds((prev) => prev.filter((id) => !removeSet.has(id)));
    } else {
      setSelectedPortalIds((prev) =>
        Array.from(new Set([...prev, ...filteredPortalIds]))
      );
    }
  };

  const togglePortalRow = (docId: number) => {
    setSelectedPortalIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // Selecție filtrată Mesaje e-Factura (doar cele cu PDF disponibil)
  const downloadableEfactura = (filteredMessages || []).filter((m: any) => Boolean(m.pdfUrl));
  const downloadableEfacturaIds: string[] = downloadableEfactura.map((m: any) => String(m.id));
  const selectedEfacturaSet = new Set(selectedEfacturaIds);
  const allEfacturaSelected =
    downloadableEfacturaIds.length > 0 &&
    downloadableEfacturaIds.every((id) => selectedEfacturaSet.has(id));
  const someEfacturaSelected =
    !allEfacturaSelected &&
    downloadableEfacturaIds.some((id) => selectedEfacturaSet.has(id));

  useEffect(() => {
    if (masterEfacturaCheckboxRef.current) {
      masterEfacturaCheckboxRef.current.indeterminate = someEfacturaSelected;
    }
  }, [someEfacturaSelected, allEfacturaSelected]);

  const toggleSelectAllEfactura = () => {
    if (allEfacturaSelected) {
      const removeSet = new Set(downloadableEfacturaIds);
      setSelectedEfacturaIds((prev) => prev.filter((id) => !removeSet.has(id)));
    } else {
      setSelectedEfacturaIds((prev) =>
        Array.from(new Set([...prev, ...downloadableEfacturaIds]))
      );
    }
  };

  const toggleEfacturaRow = (msgId: string) => {
    setSelectedEfacturaIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

  const handleDownloadPortalSelection = async (explicitIds?: number[]) => {
    if (isBulkDownloading) return;
    const targetIds =
      explicitIds && explicitIds.length > 0
        ? explicitIds
        : selectedPortalIds.length > 0
          ? selectedPortalIds
          : filteredPortalIds;

    if (targetIds.length === 0) {
      toast.info("Nu există documente disponibile pentru descărcare.");
      return;
    }

    setIsBulkDownloading(true);
    try {
      const token = localStorage.getItem("authToken");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/spv/bulk-download-pdf", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ ids: targetIds }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Eroare HTTP ${res.status}`);
      }

      const disp = res.headers.get("content-disposition") || "";
      const fnMatch = disp.match(/filename="?([^";]+)"?/i);
      const fallbackName =
        targetIds.length === 1
          ? `Document_SPV_${targetIds[0]}.pdf`
          : `Documente_SPV_${new Date().toISOString().slice(0, 10)}.zip`;
      const downloadName = fnMatch?.[1] || fallbackName;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        targetIds.length === 1
          ? "Documentul PDF a fost descărcat."
          : `S-au descărcat ${targetIds.length} documente SPV (${downloadName}).`
      );
    } catch (err: any) {
      toast.error(`Eroare la descărcare: ${err.message}`);
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handleDownloadEfacturaSelection = async () => {
    if (isBulkDownloading) return;
    const targetMsgs =
      selectedEfacturaIds.length > 0
        ? downloadableEfactura.filter((m: any) =>
            selectedEfacturaSet.has(String(m.id))
          )
        : downloadableEfactura;

    if (targetMsgs.length === 0) {
      toast.info("Nu există facturi PDF disponibile pentru descărcare.");
      return;
    }

    setIsBulkDownloading(true);
    try {
      const token = localStorage.getItem("authToken");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      if (targetMsgs.length === 1) {
        const single = targetMsgs[0];
        const res = await fetch(single.pdfUrl, {
          credentials: "include",
          headers,
        });
        if (!res.ok) throw new Error(`Eroare HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Factura_${(single.invoiceNumber || single.id).replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Factura PDF a fost descărcată.");
        return;
      }

      const JSZipMod = await import("jszip");
      const JSZip = JSZipMod.default || JSZipMod;
      const zip = new JSZip();
      const used = new Set<string>();
      let added = 0;

      for (const m of targetMsgs) {
        const res = await fetch(m.pdfUrl, {
          credentials: "include",
          headers,
        });
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const base = `Factura_${String(m.invoiceNumber || m.id).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        let fileName = `${base}.pdf`;
        let idx = 2;
        while (used.has(fileName.toLowerCase())) {
          fileName = `${base}_${idx}.pdf`;
          idx++;
        }
        used.add(fileName.toLowerCase());
        zip.file(fileName, buf);
        added++;
      }

      if (added === 0) {
        throw new Error("Nu s-au putut prelua PDF-urile selectate.");
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const archiveName = `Facturi_SPV_${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = archiveName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`S-au descărcat ${added} facturi PDF (${archiveName}).`);
    } catch (err: any) {
      toast.error(`Eroare la descărcarea PDF-urilor: ${err.message}`);
    } finally {
      setIsBulkDownloading(false);
    }
  };

  return (
    <>
      <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
        {/* Nivelul 1 — Window Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight truncate">
              Mesaje &amp; Documente SPV ANAF
            </h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {spvIntegration?.apiKey ? (
                <span className="w-fit inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 whitespace-nowrap tabular-nums">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>
                    Conectat ANAF SPV
                    {daysUntilExpiration != null
                      ? ` · Token ${daysUntilExpiration} zile`
                      : ""}
                  </span>
                </span>
              ) : (
                <Link href="/integrari" className="w-fit">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-amber-500/12 text-amber-800 hover:bg-amber-500/20 dark:bg-amber-500/18 dark:text-amber-300 whitespace-nowrap cursor-pointer transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>OAuth neconectat</span>
                  </span>
                </Link>
              )}
            </div>
          </div>

          {/* Bară de acțiuni */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <LiveAutoSyncControl
              onRefresh={handleSyncAll}
              isRefreshing={isSyncBusy}
              storageKey="spv_hub_auto_sync"
              compact
            />
            <button
              type="button"
              onClick={() => testSpvMutation.mutate()}
              disabled={testSpvMutation.isPending}
              className="apple-btn-glass h-8 rounded-full text-[12px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-all px-3 text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer disabled:opacity-60"
              title="Testează conexiunea cu serverul ANAF și verifică token-ul"
            >
              {testSpvMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Test...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Test</span>
                </>
              )}
            </button>

            {oauthInfo?.url && (
              <a
                href={oauthInfo.url}
                target="_blank"
                rel="noreferrer"
                className="apple-btn-glass h-8 rounded-full text-[12px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-all px-3 text-[#1d1d1f] dark:text-[#f5f5f7]"
                title="Reautorizare certificat cu token OAuth ANAF"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                <span>Reautorizare</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleUsbSpvSync}
              disabled={isUsbSyncing}
              className={`h-8 rounded-full text-[12px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-all px-3 cursor-pointer disabled:opacity-60 ${
                connectorReady
                  ? "bg-emerald-500/12 hover:bg-emerald-500/18 text-emerald-800 border border-emerald-500/25 dark:bg-emerald-500/18 dark:hover:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/30"
                  : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
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
                  <span>USB...</span>
                </>
              ) : (
                <>
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${
                      connectorReady ? "text-emerald-600 dark:text-emerald-400" : "text-[#6e6e73] dark:text-[#98989d]"
                    }`}
                  />
                  <span>Stick USB</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="apple-btn-glass h-8 rounded-full text-[12px] font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-all px-3 text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              title="Încarcă o recipisă sau notificare PDF/ZIP originală descărcată din SPV"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Încarcă</span>
            </button>

            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncBusy}
              className="apple-btn-prominent h-8 rounded-full text-[12.5px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-all px-3.5 disabled:opacity-60 text-white cursor-pointer"
              title="Interoghează ANAF și actualizează lista mesajelor"
            >
              {isSyncingAll ||
              syncMessagesMutation.isPending ||
              syncInvoicesMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sync...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync SPV</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Diagnostic Conexiune SPV */}
        {testResult && (
          <div
            className={`apple-surface px-4 py-3 transition-all ${
              testResult.connected
                ? "border-emerald-500/30"
                : "border-rose-500/30"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[12.5px] flex-wrap text-[#1d1d1f] dark:text-[#f5f5f7]">
                {testResult.connected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span className="font-semibold">
                  {testResult.connected
                    ? "Conexiune SPV ANAF activă"
                    : "Conexiune eșuată"}
                </span>
                {testResult.latencyMs != null && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                    Latență: {testResult.latencyMs} ms
                  </span>
                )}
                {testResult.cui && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                    CUI: {testResult.cui}
                  </span>
                )}
                {(testResult.daysRemaining ?? testResult.tokenDaysRemaining) !=
                  null && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                    Token:{" "}
                    {testResult.daysRemaining ?? testResult.tokenDaysRemaining}{" "}
                    zile
                  </span>
                )}
                <span className="text-[#6e6e73] dark:text-[#98989d]">
                  {testResult.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-[#f5f5f7] cursor-pointer"
                title="Închide panoul de diagnostic"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Nivelul 2 — KPI Cards */}
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
              className="apple-surface apple-card-btn outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 text-left transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Toate documentele
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                  <Inbox className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                </span>
              </div>
              <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                {portalStats.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReadFilter("unread");
                setPortalFilter("all");
                setPage(1);
              }}
              className="apple-surface apple-card-btn outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 text-left transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Mesaje noi (necitite)
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-rose-500/10 dark:bg-rose-500/18 flex items-center justify-center shrink-0 relative">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                </span>
              </div>
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="text-[24px] sm:text-[26px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                  {portalStats.unread}
                </span>
                {portalStats.unread > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    necitite
                  </span>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setPortalFilter("declaratie");
                setReadFilter("all");
                setPage(1);
              }}
              className="apple-surface apple-card-btn outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 text-left transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Recipise declarații
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </span>
              </div>
              <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                {portalStats.recipise}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPortalFilter("cert_sol");
                setReadFilter("all");
                setPage(1);
              }}
              className="apple-surface apple-card-btn outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 text-left transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Decizii, certificate &amp; solicitări
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </span>
              </div>
              <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                {portalStats.certificate +
                  portalStats.solicitari +
                  portalStats.decizii}
              </span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setMessageFilter("all")}
              className="apple-surface apple-card-btn outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 text-left transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Toate mesajele
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                  <Inbox className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                </span>
              </div>
              <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                {msgStats.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMessageFilter("primita")}
              className="apple-surface apple-card-btn outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 text-left transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Facturi primite
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </span>
              </div>
              <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                {msgStats.primite}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMessageFilter("trimisa")}
              className="apple-surface apple-card-btn outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 text-left transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Facturi trimise
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </span>
              </div>
              <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                {msgStats.trimise}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMessageFilter("eroare")}
              className="apple-surface apple-card-btn outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5 text-left transition-all hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.08)] cursor-pointer select-none"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
                  Erori ANAF
                </span>
                <span className="w-7 h-7 rounded-[8px] bg-rose-500/10 dark:bg-rose-500/18 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                </span>
              </div>
              <span className="text-[24px] sm:text-[26px] font-bold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.028em] leading-none">
                {msgStats.erori}
              </span>
            </button>
          </div>
        )}

        {/* Nivelul 3 — Toolbar Unificat */}
        <div className="apple-surface px-3 py-2.5">
          <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-2 w-full min-w-0">
            {/* Stânga: Selector segmentat taburi */}
            <div className="apple-segmented max-w-full overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                data-active={activeHubTab === "declaratii"}
                onClick={() => setActiveHubTab("declaratii")}
                className="apple-segmented-item px-3 shrink-0"
              >
                <FileCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Mesaje &amp; Recipise SPV</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                    activeHubTab === "declaratii"
                      ? "bg-white/20 text-white"
                      : "bg-black/[0.06] dark:bg-white/[0.1] text-[#3a3a3c] dark:text-[#ebebf5]"
                  }`}
                >
                  {portalStats.total}
                </span>
              </button>

              <button
                type="button"
                data-active={activeHubTab === "efactura"}
                onClick={() => setActiveHubTab("efactura")}
                className="apple-segmented-item px-3 shrink-0"
              >
                <Inbox className="w-3.5 h-3.5 shrink-0" />
                <span>Mesaje e-Factura</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                    activeHubTab === "efactura"
                      ? "bg-white/20 text-white"
                      : "bg-black/[0.06] dark:bg-white/[0.1] text-[#3a3a3c] dark:text-[#ebebf5]"
                  }`}
                >
                  {msgStats.total}
                </span>
              </button>
            </div>

            {/* Dreapta: Căutare + Filtre + Bulk PDF + Butoane Icon-Only */}
            {activeHubTab === "declaratii" ? (
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap min-w-0">
                <div className="apple-pill-control relative flex items-center w-48 xl:w-56 px-3 min-w-0">
                  <Search className="w-3.5 h-3.5 text-[#8e8e93] shrink-0 mr-2 pointer-events-none" />
                  <input
                    type="text"
                    value={portalSearchQuery}
                    onChange={(e) => {
                      setPortalSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Caută în toate coloanele..."
                    className="flex-1 min-w-0 bg-transparent text-[12.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
                  />
                  {portalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setPortalSearchQuery("");
                        setPage(1);
                      }}
                      aria-label="Șterge căutarea"
                      className="text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] ml-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filtru segmentat Citit / Necitit */}
                <div className="apple-segmented shrink-0">
                  <button
                    type="button"
                    data-active={readFilter === "all"}
                    onClick={() => {
                      setReadFilter("all");
                      setPage(1);
                    }}
                    className="apple-segmented-item px-2.5 tabular-nums"
                  >
                    Toate ({portalStats.total})
                  </button>
                  <button
                    type="button"
                    data-active={readFilter === "unread"}
                    onClick={() => {
                      setReadFilter("unread");
                      setPage(1);
                    }}
                    className="apple-segmented-item px-2.5 tabular-nums"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        readFilter === "unread" ? "bg-white" : "bg-[#0071e3]"
                      }`}
                    />
                    <span>Noi ({portalStats.unread})</span>
                  </button>
                  <button
                    type="button"
                    data-active={readFilter === "read"}
                    onClick={() => {
                      setReadFilter("read");
                      setPage(1);
                    }}
                    className="apple-segmented-item px-2.5 tabular-nums"
                  >
                    Citite ({portalStats.read})
                  </button>
                </div>

                {/* Bulk Download PDF */}
                {(portalDocs?.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDownloadPortalSelection()}
                    disabled={
                      isBulkDownloading ||
                      (selectedPortalIds.length === 0 && filteredPortalIds.length === 0)
                    }
                    className={`rounded-full h-8 px-3 text-[12px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                      selectedPortalIds.length > 0
                        ? "apple-btn-prominent"
                        : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
                    }`}
                    title={
                      selectedPortalIds.length > 0
                        ? `Descarcă cele ${selectedPortalIds.length} documente PDF selectate`
                        : `Descarcă toate cele ${filteredPortalIds.length} documente PDF afișate`
                    }
                  >
                    {isBulkDownloading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <Download className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="tabular-nums">
                      PDF ({selectedPortalIds.length > 0 ? selectedPortalIds.length : filteredPortalIds.length})
                    </span>
                  </button>
                )}

                {/* Marchează toate ca citite */}
                {portalStats.unread > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    aria-label="Marchează toate mesajele ca citite"
                    title="Marchează toate mesajele ca citite"
                    className="apple-btn-glass w-8 h-8 text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}

                {/* Elimină filtre */}
                <button
                  type="button"
                  onClick={resetFilters}
                  aria-label="Elimină filtrele"
                  title="Elimină filtrele"
                  className={`w-8 h-8 rounded-full inline-flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                    hasActivePortalFilters
                      ? "apple-btn-prominent"
                      : "apple-btn-glass text-[#6e6e73] dark:text-[#98989d]"
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap min-w-0">
                <div className="apple-pill-control relative flex items-center w-48 xl:w-56 px-3 min-w-0">
                  <Search className="w-3.5 h-3.5 text-[#8e8e93] shrink-0 mr-2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchMessageQuery}
                    onChange={(e) => setSearchMessageQuery(e.target.value)}
                    placeholder="Caută factură, partener, CUI..."
                    className="flex-1 min-w-0 bg-transparent text-[12.5px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] outline-none"
                  />
                  {searchMessageQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchMessageQuery("")}
                      aria-label="Șterge căutarea"
                      className="text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] ml-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="apple-segmented shrink-0">
                  <button
                    type="button"
                    data-active={messageFilter === "all"}
                    onClick={() => setMessageFilter("all")}
                    className="apple-segmented-item px-2.5 tabular-nums"
                  >
                    Toate ({msgStats.total})
                  </button>
                  <button
                    type="button"
                    data-active={messageFilter === "primita"}
                    onClick={() => setMessageFilter("primita")}
                    className="apple-segmented-item px-2.5 tabular-nums"
                  >
                    Primite ({msgStats.primite})
                  </button>
                  <button
                    type="button"
                    data-active={messageFilter === "trimisa"}
                    onClick={() => setMessageFilter("trimisa")}
                    className="apple-segmented-item px-2.5 tabular-nums"
                  >
                    Trimise ({msgStats.trimise})
                  </button>
                  <button
                    type="button"
                    data-active={messageFilter === "eroare"}
                    onClick={() => setMessageFilter("eroare")}
                    className="apple-segmented-item px-2.5 tabular-nums"
                  >
                    Erori ({msgStats.erori})
                  </button>
                </div>

                {downloadableEfacturaIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadEfacturaSelection}
                    disabled={isBulkDownloading}
                    className={`rounded-full h-8 px-3 text-[12px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 ${
                      selectedEfacturaIds.length > 0
                        ? "apple-btn-prominent"
                        : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
                    }`}
                    title={
                      selectedEfacturaIds.length > 0
                        ? `Descarcă cele ${selectedEfacturaIds.length} facturi PDF selectate`
                        : `Descarcă toate cele ${downloadableEfacturaIds.length} facturi PDF afișate`
                    }
                  >
                    {isBulkDownloading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <Download className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="tabular-nums">
                      PDF ({selectedEfacturaIds.length > 0 ? selectedEfacturaIds.length : downloadableEfacturaIds.length})
                    </span>
                  </button>
                )}

                {(messageFilter !== "all" || searchMessageQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessageFilter("all");
                      setSearchMessageQuery("");
                    }}
                    aria-label="Elimină filtrele"
                    title="Elimină filtrele"
                    className="apple-btn-prominent w-8 h-8 inline-flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Nivelul 4 — Table Surface */}
        <div className="apple-surface overflow-hidden">
          {activeHubTab === "declaratii" ? (
            <>
              {isLoadingPortalDocs ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : (portalDocs?.length || 0) === 0 ? (
                <div className="p-14 text-center text-[#6e6e73] dark:text-[#98989d]">
                  <FileCheck className="w-10 h-10 mx-auto opacity-30 mb-2" />
                  <p className="font-semibold text-[13.5px]">
                    Nu există documente în arhiva SPV.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                      <tr className="text-[#6e6e73] dark:text-[#98989d] text-[12px] font-medium select-none border-b border-black/[0.05] dark:border-white/[0.07]">
                        <th className="py-3 pl-4 pr-1.5 w-9 text-center font-medium">
                          <input
                            ref={masterPortalCheckboxRef}
                            type="checkbox"
                            checked={allPortalSelected}
                            disabled={filteredPortalIds.length === 0}
                            onChange={toggleSelectAllPortal}
                            aria-label="Selectează toate documentele SPV"
                            title="Selectează toate documentele filtrate"
                            className="w-4 h-4 rounded-[5px] accent-[#0071e3] cursor-pointer align-middle disabled:opacity-30"
                          />
                        </th>
                        <th className="py-3 px-3 w-28 whitespace-nowrap font-medium">
                          {oauthInfo?.entityType === "pf" ? "CNP / CIF" : "CIF"}
                        </th>
                        <th className="py-3 px-3 w-44 whitespace-nowrap font-medium">
                          Tip document
                        </th>
                        <th className="py-3 px-3 w-32 whitespace-nowrap font-medium">
                          Id solicitare
                        </th>
                        <th className="py-3 px-3 w-36 whitespace-nowrap font-medium">
                          Data afișare
                        </th>
                        <th className="py-3 px-3 w-32 text-center whitespace-nowrap font-medium">
                          Document
                        </th>
                        <th className="py-3 px-3 font-medium">Detalii</th>
                        <th className="py-3 px-3 w-40 whitespace-nowrap font-medium">
                          Data arhivare SPV
                        </th>
                      </tr>

                      {/* Rândul de Filtrare Apple Capsule */}
                      <tr className="bg-[#fafafa]/60 dark:bg-white/[0.015] border-b border-black/[0.05] dark:border-white/[0.07]">
                        <th className="py-1.5 pl-4 pr-1.5 text-center">
                          {selectedPortalIds.length > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#0071e3] text-white text-[10px] font-bold tabular-nums">
                              {selectedPortalIds.length}
                            </span>
                          )}
                        </th>
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
                                ? "CNP / CIF..."
                                : "CIF..."
                            }
                            className="w-full !px-2.5 !py-0 h-7 text-[11.5px] tabular-nums rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] border border-black/[0.06] dark:border-white/[0.08] outline-none font-normal transition-all"
                          />
                        </th>
                        <th className="p-1.5">
                          <select
                            value={filterTipDoc}
                            onChange={(e) => {
                              setFilterTipDoc(e.target.value);
                              setPage(1);
                            }}
                            className="w-full !px-2.5 !py-0 h-7 text-[11.5px] rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/[0.06] dark:border-white/[0.08] outline-none font-normal transition-all cursor-pointer"
                          >
                            <option value="-TOATE-">Toate tipurile</option>
                            <option value="RECIPISA">RECIPISA</option>
                            <option value="DECLARATIE">DECLARATIE</option>
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
                            placeholder="ID..."
                            className="w-full !px-2.5 !py-0 h-7 text-[11.5px] tabular-nums rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] border border-black/[0.06] dark:border-white/[0.08] outline-none font-normal transition-all"
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
                            placeholder="Dată..."
                            className="w-full !px-2.5 !py-0 h-7 text-[11.5px] tabular-nums rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] border border-black/[0.06] dark:border-white/[0.08] outline-none font-normal transition-all"
                          />
                        </th>
                        <th className="p-1.5 text-center">
                          <span className="text-[11px] text-[#8e8e93] font-medium">
                            PDF
                          </span>
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            value={filterDetalii}
                            onChange={(e) => {
                              setFilterDetalii(e.target.value);
                              setPage(1);
                            }}
                            placeholder="D101, D394, Vector..."
                            className="w-full !px-2.5 !py-0 h-7 text-[11.5px] rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] border border-black/[0.06] dark:border-white/[0.08] outline-none font-normal transition-all"
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
                            placeholder="Arhivare..."
                            className="w-full !px-2.5 !py-0 h-7 text-[11.5px] tabular-nums rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#8e8e93] border border-black/[0.06] dark:border-white/[0.08] outline-none font-normal transition-all"
                          />
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
                      {paginatedPortalDocs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-12 px-4 text-center text-[#6e6e73] dark:text-[#98989d]"
                          >
                            <p className="font-medium text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                              Niciun document nu corespunde căutării sau filtrelor active.
                            </p>
                            <button
                              type="button"
                              onClick={resetFilters}
                              className="apple-btn-glass mt-2.5 inline-flex items-center gap-1.5 px-4 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-xs font-semibold cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Resetează filtrele</span>
                            </button>
                          </td>
                        </tr>
                      ) : (
                        paginatedPortalDocs.map((doc: any) => {
                          const docNumId = Number(doc.id);
                          const isUnread = !doc.isRead;
                          const isSelected = selectedPortalSet.has(docNumId);
                          const primaryTextCls = isUnread
                            ? "text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold"
                            : "text-[#3a3a3c] dark:text-[#d1d1d6] font-normal";

                          return (
                            <tr
                              key={doc.id}
                              onClick={() => openDocument(doc)}
                              className={`cursor-pointer transition-colors hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] ${
                                isSelected
                                  ? "bg-[#0071e3]/[0.05] dark:bg-[#0a84ff]/[0.12]"
                                  : isUnread
                                    ? "bg-[#0071e3]/[0.025] dark:bg-[#0a84ff]/[0.06]"
                                    : ""
                              }`}
                            >
                              <td
                                className="py-3 pl-4 pr-1.5 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => togglePortalRow(docNumId)}
                                  aria-label={`Selectează documentul ${doc.tip}`}
                                  className="w-4 h-4 rounded-[5px] accent-[#0071e3] cursor-pointer align-middle"
                                />
                              </td>

                              <td
                                className={`py-3 px-3 tabular-nums whitespace-nowrap ${primaryTextCls}`}
                              >
                                <div className="inline-flex items-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      isUnread ? "bg-[#0071e3] dark:bg-[#0a84ff]" : "bg-transparent"
                                    }`}
                                  />
                                  <span>{doc.cif}</span>
                                </div>
                              </td>

                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[12.5px] ${
                                      isUnread
                                        ? "font-bold text-[#1d1d1f] dark:text-white"
                                        : "font-semibold text-[#3a3a3c] dark:text-[#ebebf5]"
                                    }`}
                                  >
                                    {doc.tip}
                                  </span>
                                  {isUnread && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff]">
                                      Nou
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3 tabular-nums whitespace-nowrap text-[#6e6e73] dark:text-[#98989d] text-[12.5px]">
                                {doc.idSolicitare || "-"}
                              </td>

                              <td
                                className={`py-3 px-3 tabular-nums whitespace-nowrap text-[12.5px] ${primaryTextCls}`}
                              >
                                {doc.dataDepunere}
                              </td>

                              <td
                                className="py-2.5 px-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-1 justify-center">
                                  <button
                                    type="button"
                                    onClick={() => openDocument(doc)}
                                    className="apple-btn-glass px-2.5 h-7 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[11.5px] inline-flex items-center justify-center cursor-pointer"
                                    title="Vizualizează documentul PDF oficial ANAF"
                                  >
                                    PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDownloadPortalSelection([docNumId])
                                    }
                                    className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.05] dark:text-[#98989d] dark:hover:text-[#f5f5f7] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                                    title="Descarcă direct fișierul PDF"
                                  >
                                    <Download className="w-3.5 h-3.5" />
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
                                    className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#8e8e93] hover:text-[#1d1d1f] hover:bg-black/[0.05] dark:hover:text-white dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                                    title={
                                      doc.isRead
                                        ? "Marchează ca necitit"
                                        : "Marchează ca citit"
                                    }
                                  >
                                    <Eye
                                      className={`w-3.5 h-3.5 ${
                                        doc.isRead ? "opacity-40" : "text-[#0071e3] dark:text-[#0a84ff]"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </td>

                              <td
                                className={`py-3 px-3 leading-snug text-[12.5px] ${primaryTextCls}`}
                              >
                                <p className="line-clamp-2">{doc.detalii}</p>
                              </td>

                              <td className="py-3 px-3 tabular-nums whitespace-nowrap text-[#6e6e73] dark:text-[#98989d] text-[12.5px]">
                                {doc.dataArhivare || "-"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Subsol panou: Paginare */}
              {filteredPortalDocs && filteredPortalDocs.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa] dark:bg-white/[0.02] text-[12px]">
                  <div className="text-[#6e6e73] dark:text-[#98989d] tabular-nums">
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
                      className="apple-btn-glass px-2.5 h-7 text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer font-semibold"
                      title="Prima pagină"
                    >
                      |&lt;
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="apple-btn-glass px-2.5 h-7 text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer font-semibold"
                      title="Pagina precedentă"
                    >
                      &lt;
                    </button>

                    <span className="px-2.5 py-1 font-semibold tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {page} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="apple-btn-glass px-2.5 h-7 text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer font-semibold"
                      title="Pagina următoare"
                    >
                      &gt;
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="apple-btn-glass px-2.5 h-7 text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-40 cursor-pointer font-semibold"
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
              ) : (rawMessages?.length || 0) === 0 ? (
                <div className="p-14 text-center text-[#6e6e73] dark:text-[#98989d]">
                  <Inbox className="w-10 h-10 mx-auto opacity-30 mb-2" />
                  <p className="font-semibold text-[13.5px]">
                    Nu există mesaje e-Factura în arhiva SPV.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
                        <TableHead className="w-9 pl-4 pr-1.5 text-center">
                          <input
                            ref={masterEfacturaCheckboxRef}
                            type="checkbox"
                            checked={allEfacturaSelected}
                            onChange={toggleSelectAllEfactura}
                            disabled={downloadableEfacturaIds.length === 0}
                            aria-label="Selectează toate facturile PDF"
                            title="Selectează toate facturile cu PDF disponibil"
                            className="w-4 h-4 rounded-[5px] accent-[#0071e3] cursor-pointer align-middle disabled:opacity-30"
                          />
                        </TableHead>
                        <TableHead className="w-32 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Data SPV
                        </TableHead>
                        <TableHead className="w-36 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Tip mesaj ANAF
                        </TableHead>
                        <TableHead className="w-32 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Emitent
                        </TableHead>
                        <TableHead className="w-32 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Beneficiar
                        </TableHead>
                        <TableHead className="w-36 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Index încărcare SPV
                        </TableHead>
                        <TableHead className="w-32 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          ID descărcare
                        </TableHead>
                        <TableHead className="text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Factură / Partener în sistem
                        </TableHead>
                        <TableHead className="w-32 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                          Acțiune
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] text-[13px]">
                      {!filteredMessages || filteredMessages.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="py-12 px-4 text-center text-[#6e6e73] dark:text-[#98989d]"
                          >
                            <p className="font-medium text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                              Niciun mesaj e-Factura nu corespunde căutării sau filtrului activ.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setMessageFilter("all");
                                setSearchMessageQuery("");
                              }}
                              className="apple-btn-glass mt-2.5 inline-flex items-center gap-1.5 px-4 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-xs font-semibold cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Resetează filtrele</span>
                            </button>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMessages.map((msg: any) => {
                          const isReceived = msg.tip === "FACTURA PRIMITA";
                          const isSent = msg.tip === "FACTURA TRIMISA";
                          const isError = msg.tip === "ERORI FACTURA";
                          const msgKey = String(msg.id);
                          const isRowSelected = selectedEfacturaSet.has(msgKey);

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
                              className={`cursor-pointer transition-colors hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] ${
                                isRowSelected
                                  ? "bg-[#0071e3]/[0.05] dark:bg-[#0a84ff]/[0.12]"
                                  : ""
                              }`}
                            >
                              <TableCell
                                className="pl-4 pr-1.5 py-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isRowSelected}
                                  disabled={!msg.pdfUrl}
                                  onChange={() => toggleEfacturaRow(msgKey)}
                                  aria-label={`Selectează factura ${msg.invoiceNumber || msg.id}`}
                                  className="w-4 h-4 rounded-[5px] accent-[#0071e3] cursor-pointer align-middle disabled:opacity-25"
                                />
                              </TableCell>
                              <TableCell className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums whitespace-nowrap py-3">
                                {msg.dataCreare}
                              </TableCell>
                              <TableCell className="py-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                                    isReceived
                                      ? "bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300"
                                      : isSent
                                        ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                                        : "bg-rose-500/10 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300"
                                  }`}
                                >
                                  {isReceived && (
                                    <ArrowDownLeft className="w-3 h-3" />
                                  )}
                                  {isSent && <ArrowUpRight className="w-3 h-3" />}
                                  {isError && <AlertCircle className="w-3 h-3" />}
                                  <span>{msg.tip}</span>
                                </span>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                                  {msg.cifEmitent || "-"}
                                </span>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                                  {msg.cifBeneficiar || "-"}
                                </span>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] tabular-nums">
                                  {msg.idSolicitare || "-"}
                                </span>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                                  {msg.id}
                                </span>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                                  {msg.invoiceNumber ||
                                    msg.partnerName ||
                                    "În așteptare descărcare"}
                                </span>
                              </TableCell>
                              <TableCell
                                className="py-3 text-center"
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
                                    className="apple-btn-glass inline-flex items-center gap-1 px-3 h-7 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium cursor-pointer"
                                    title="Vizualizează PDF Factură"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Deschide</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSpvMessage(msg)}
                                    className="apple-btn-glass inline-flex items-center gap-1 px-3 h-7 text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-medium cursor-pointer"
                                    title="Vizualizează detalii mesaj ANAF"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Detalii</span>
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
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
        <DialogContent className="sm:max-w-lg bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 px-2.5 rounded-xl bg-white border border-black/[0.08] shadow-2xs flex items-center justify-center shrink-0">
                <img
                  src="https://static.anaf.ro/static/10/Anaf/primapagina/anaf_ro.png"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/anaf-logo.png";
                  }}
                  alt="ANAF"
                  className="h-6 w-auto object-contain select-none"
                />
              </div>
              <DialogTitle className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] leading-snug">
                Conector Chrome pentru Stick USB ANAF (SPVWS2)
              </DialogTitle>
            </div>
            <DialogDescription className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
              Serviciul ANAF SPV pentru decizii, recipise și declarații (webserviced.anaf.ro) cere autentificare directă mTLS cu stick-ul USB. Extensia Chrome citește stick-ul tău și urcă automat în aplicație documentele PDF originale semnate de Ministerul Finanțelor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-1 text-[12.5px]">
            {isLegacyConnector && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 space-y-2 text-amber-900 dark:text-amber-200">
                <p className="font-semibold text-xs">
                  Actualizare rapidă în Chrome (rulează încă v{connectorVersion}, actuală este v1.5.0 — fără Incognito):
                </p>
                <p className="text-[11.5px] leading-relaxed">
                  Deschide <span className="font-semibold">chrome://extensions</span> și apasă iconița rotundă de <span className="font-semibold">Reîncărcare (Reload)</span> pe extensia <span className="font-semibold">Factura/SPV</span> (sau șterge copia veche și încarcă folderul de mai jos), apoi dă Refresh la pagină. Versiunea v1.5.0 citește direct tokenul USB fără modul Incognito.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("chrome://extensions");
                    setCopiedExtUrl(true);
                    setTimeout(() => setCopiedExtUrl(false), 1800);
                    toast.success("Adresa chrome://extensions a fost copiată — lipește-o într-un tab nou.");
                  }}
                  className="apple-btn-glass px-3 h-7 text-[#1d1d1f] dark:text-[#f5f5f7] text-[11.5px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedExtUrl ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copiat: chrome://extensions</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiază adresa chrome://extensions</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.07] bg-[#f2f2f7] dark:bg-[#2c2c2e] p-3.5 space-y-2 text-[#3a3a3c] dark:text-[#ebebf5]">
              <p className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Instalare / Reîncărcare în 3 pași (15 secunde, fără Incognito):
              </p>
              <p>
                1. Deschide în Chrome adresa{" "}
                <span className="font-semibold select-all">
                  chrome://extensions
                </span>{" "}
                și activează{" "}
                <span className="font-semibold">Developer mode</span> (dreapta-sus).
              </p>
              <p>
                2. Apasă{" "}
                <span className="font-semibold">Load unpacked</span> și selectează folderul{" "}
                <span className="font-semibold">chrome-spv-connector</span> de mai jos (sau apasă iconița <span className="font-semibold">Reload</span> pe extensie dacă este deja încărcată din acest folder).
              </p>
              <p>
                3. Reîncarcă pagina <span className="font-semibold">/spv</span> și apasă <span className="font-semibold">Sincronizează Stick USB</span> — fereastra ANAF se deschide direct cu tokenul USB conectat.
              </p>
            </div>

            {typeof window !== "undefined" &&
              (window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1") && (
                <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.07] bg-[#f2f2f7] dark:bg-[#2c2c2e] p-3.5 space-y-1.5">
                  <p className="text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Calea folderului gata de încărcat în Chrome:
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] break-all select-all">
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
                      className="apple-btn-glass px-3 h-7 text-[#1d1d1f] dark:text-[#f5f5f7] text-[11.5px] font-medium inline-flex items-center gap-1 shrink-0 cursor-pointer"
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
                className="apple-btn-glass inline-flex items-center gap-1.5 px-4 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium cursor-pointer disabled:opacity-60"
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
                  className="apple-btn-glass inline-flex items-center gap-1.5 px-3.5 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium cursor-pointer"
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
                    className="apple-btn-prominent inline-flex items-center gap-1.5 px-4 h-9 font-semibold cursor-pointer"
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
        <DialogContent className="sm:max-w-md bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Încarcă Recipisă sau Mesaj Original SPV ANAF
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
              Selectați fișierul PDF sau arhiva ZIP originală descărcată din portalul ANAF (recipise, decizii D256, declarația D212, notificări).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-black/[0.12] dark:border-white/[0.14] hover:border-[#0071e3] rounded-2xl p-8 text-center cursor-pointer transition-colors bg-[#f2f2f7]/60 dark:bg-[#2c2c2e]/60"
            >
              <Upload className="w-8 h-8 text-[#0071e3] dark:text-[#0a84ff] mx-auto mb-2" />
              <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Apasă aici sau trage fișierul PDF / ZIP original descărcat din SPV
              </p>
              <p className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] mt-1">
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
              <div className="flex items-center justify-center gap-2 text-[12.5px] text-[#0071e3] dark:text-[#64d2ff] font-semibold py-2">
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
          <DialogContent className="sm:max-w-md bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
                <span>Detalii mesaj oficial ANAF SPV</span>
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d]">
                Informații oficiale recepționate direct de pe serverele
                Ministerului Finanțelor
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 text-[12.5px] pt-2 text-[#1d1d1f] dark:text-[#f5f5f7]">
              <div className="flex justify-between py-1.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">Tip mesaj:</span>
                <span className="font-semibold">{selectedSpvMessage.tip}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">Data SPV:</span>
                <span className="font-semibold tabular-nums">
                  {selectedSpvMessage.dataCreare}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">CIF emitent:</span>
                <span className="font-semibold tabular-nums">
                  {selectedSpvMessage.cifEmitent || "-"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">CIF beneficiar:</span>
                <span className="font-semibold tabular-nums">
                  {selectedSpvMessage.cifBeneficiar || "-"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">Index încărcare SPV:</span>
                <div className="flex items-center gap-1 font-semibold tabular-nums">
                  <span>{selectedSpvMessage.idSolicitare || "-"}</span>
                  {selectedSpvMessage.idSolicitare && (
                    <button
                      type="button"
                      onClick={(e) =>
                        handleCopy(selectedSpvMessage.idSolicitare, e)
                      }
                      className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.05] dark:text-[#98989d] dark:hover:text-[#f5f5f7] dark:hover:bg-white/[0.08] cursor-pointer"
                      title="Copiază index"
                    >
                      {copiedId === selectedSpvMessage.idSolicitare ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">ID descărcare ANAF:</span>
                <div className="flex items-center gap-1 font-semibold tabular-nums">
                  <span>{selectedSpvMessage.id}</span>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(selectedSpvMessage.id, e)}
                    className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.05] dark:text-[#98989d] dark:hover:text-[#f5f5f7] dark:hover:bg-white/[0.08] cursor-pointer"
                    title="Copiază ID descărcare"
                  >
                    {copiedId === selectedSpvMessage.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-between py-1.5 border-b border-black/[0.05] dark:border-white/[0.07]">
                <span className="text-[#6e6e73] dark:text-[#98989d]">Factură / Stare:</span>
                <span className="font-medium">
                  {selectedSpvMessage.invoiceNumber
                    ? `Factură înregistrată: ${selectedSpvMessage.invoiceNumber}`
                    : selectedSpvMessage.partnerName ||
                      "Recepționat din ANAF SPV"}
                </span>
              </div>
              {selectedSpvMessage.detalii && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs">
                  <p className="font-semibold mb-1">Atenționare / Notă ANAF:</p>
                  <p>{selectedSpvMessage.detalii}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setSelectedSpvMessage(null)}
                className="apple-btn-glass px-4 h-8 text-[#1d1d1f] dark:text-[#f5f5f7] text-xs font-medium cursor-pointer"
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
