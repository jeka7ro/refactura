import { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Download,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  Loader2,
  FolderArchive,
  BookOpen,
  Printer,
  RotateCcw,
  Sparkles,
  Folder,
  X as CloseIcon,
  LogOut,
  SlidersHorizontal,
  Globe,
  AlertTriangle,
  RefreshCw,
  XCircle,
  CheckCircle,
  Building2,
  Users,
  ArrowLeft,
  ChevronRight,
  Landmark,
  Eye,
  Wifi,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SagaClassicPortalViewProps {
  portalData: any;
  token: string;
  sessionToken: string;
  activeTab: "received" | "emitted";
  setActiveTab: (tab: any) => void;

  // Filtre facturi primite
  search: string;
  setSearch: (v: string) => void;
  period: string;
  setPeriod: (v: any) => void;
  nirFilter: "all" | "cu_nir" | "fara_nir";
  setNirFilter: (v: "all" | "cu_nir" | "fara_nir") => void;
  supplierFilter: string;
  setSupplierFilter: (v: string) => void;
  allSuppliers: string[];
  filteredInvoices: any[];
  currentKpis: {
    totalCount: number;
    totalBase: number;
    totalVat: number;
    totalGross: number;
    withNirCount: number;
    withoutNirCount: number;
    nirCoveragePercent: number;
  };

  // Filtre facturi emise
  searchEmitted: string;
  setSearchEmitted: (v: string) => void;
  periodEmitted: string;
  setPeriodEmitted: (v: any) => void;
  filteredEmittedInvoices: any[];
  currentEmittedKpis: {
    totalCount: number;
    totalBase: number;
    totalVat: number;
    totalGross: number;
  };

  // Acțiuni
  onViewInvoicePdf: (inv: any) => void;
  onViewNirPdf: (inv: any) => void;
  onDownloadSagaXml: () => void;
  onExportExcel: () => void;
  onExportEmittedExcel: () => void;
  onDownloadZip: () => void;
  onLockSession: () => void;

  // Comutator Mod
  onSwitchToModern: () => void;

  // Extrase de cont bancare
  onViewStatementPdf?: (stmt: any) => void;
  onDownloadStatement?: (stmt: any) => void;
  onDownloadStatementsZip?: () => void;
}

function formatSagaCurrency(val: number): string {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);
}

function formatSagaUnitPrice(val: number): string {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(val || 0);
}

function formatSagaQty(val: number): string {
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(val || 0);
}

function formatSagaDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateStr;
  }
}

function getSagaInternalNumber(inv: any): string {
  const d = inv.issueDate ? new Date(inv.issueDate) : new Date();
  const yearSuffix = !isNaN(d.getTime())
    ? String(d.getFullYear()).slice(-2)
    : "26";
  const numPad = String(inv.id || 1).padStart(6, "0");
  return `${yearSuffix}${numPad}`;
}

function getSagaPartnerCode(
  partnerCui?: string | null,
  partnerId?: number | null
): string {
  if (!partnerCui && !partnerId) return "00001";
  const str = String(partnerCui || partnerId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const code = (Math.abs(hash) % 9000) + 1000;
  return `0${code}`.slice(-5);
}

export default function SagaClassicPortalView({
  portalData,
  token,
  sessionToken,
  activeTab,
  setActiveTab,
  search,
  setSearch,
  period,
  setPeriod,
  nirFilter,
  setNirFilter,
  filteredInvoices,
  currentKpis,
  searchEmitted,
  setSearchEmitted,
  periodEmitted,
  setPeriodEmitted,
  filteredEmittedInvoices,
  currentEmittedKpis,
  onViewInvoicePdf,
  onViewNirPdf,
  onDownloadSagaXml,
  onExportExcel,
  onExportEmittedExcel,
  onDownloadZip,
  onLockSession,
  onSwitchToModern,
  onViewStatementPdf,
  onDownloadStatement,
  onDownloadStatementsZip,
}: SagaClassicPortalViewProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
  const [copiedCui, setCopiedCui] = useState<string | null>(null);

  const [showSpvModal, setShowSpvModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showStatementsModal, setShowStatementsModal] = useState(false);
  const [stmtMonthFilter, setStmtMonthFilter] = useState("all");
  const [spvTabFilter, setSpvTabFilter] = useState<"all" | "in" | "out">("all");
  const [spvSearchQuery, setSpvSearchQuery] = useState("");

  const trpcUtils = trpc.useUtils ? trpc.useUtils() : (trpc as any).useContext();

  const syncSpvMutation = trpc.accountantPortal.syncSpv.useMutation({
    onSuccess: res => {
      toast.success(
        `Sincronizare SPV ANAF finalizată cu succes! S-au descărcat ${res.imported} facturi noi.`
      );
      trpcUtils.accountantPortal.getData.invalidate();
    },
    onError: err => {
      toast.error(`Eroare comunicare SPV ANAF: ${err.message}`);
    },
  });

  const [spvTestResult, setSpvTestResult] = useState<any>(null);
  const testSpvMutation = trpc.accountantPortal.testSpvConnection.useMutation({
    onSuccess: res => {
      setSpvTestResult(res);
      if (res.connected) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    },
    onError: err => {
      toast.error(`Eroare la testarea conexiunii SPV: ${err.message}`);
    },
  });

  const [subView, setSubView] = useState<"all_invoices" | "partners_list">(
    "all_invoices"
  );
  const [selectedPartnerKey, setSelectedPartnerKey] = useState<string | null>(
    null
  );
  const [selectedPartnerIdInList, setSelectedPartnerIdInList] = useState<
    string | null
  >(null);
  const [partnerSearch, setPartnerSearch] = useState<string>("");
  const [partnerSort, setPartnerSort] = useState<
    "count_desc" | "total_desc" | "name_asc"
  >("count_desc");

  useEffect(() => {
    setSelectedPartnerKey(null);
    setSelectedPartnerIdInList(null);
    setPartnerSearch("");
  }, [activeTab]);

  // Agregare Furnizori din facturile primite
  const suppliersSummary = useMemo(() => {
    const rawList = portalData?.invoices || [];
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        cui: string;
        code: string;
        invoiceCount: number;
        totalBase: number;
        totalVat: number;
        totalGross: number;
        nirCount: number;
        latestInvoiceDate: string;
        invoices: any[];
      }
    >();

    rawList.forEach((inv: any) => {
      const name = (inv.supplierName || "Furnizor necunoscut").trim();
      const cui = (inv.supplierCUI || "").trim();
      const key = cui || name.toLowerCase();

      let existing = map.get(key);
      if (!existing) {
        existing = {
          key,
          name,
          cui,
          code: getSagaPartnerCode(cui, inv.id),
          invoiceCount: 0,
          totalBase: 0,
          totalVat: 0,
          totalGross: 0,
          nirCount: 0,
          latestInvoiceDate: "",
          invoices: [],
        };
        map.set(key, existing);
      }

      existing.invoiceCount += 1;
      existing.totalBase += Number(inv.totalBase || 0);
      existing.totalVat += Number(inv.totalVAT || 0);
      existing.totalGross += Number(inv.total || 0);
      if (inv.hasNir) existing.nirCount += 1;
      if (
        inv.issueDate &&
        (!existing.latestInvoiceDate || inv.issueDate > existing.latestInvoiceDate)
      ) {
        existing.latestInvoiceDate = inv.issueDate;
      }
      existing.invoices.push(inv);
    });

    const list = Array.from(map.values());
    list.sort(
      (a, b) => b.invoiceCount - a.invoiceCount || b.totalGross - a.totalGross
    );
    return list;
  }, [portalData?.invoices]);

  // Agregare Clienți din facturile emise
  const clientsSummary = useMemo(() => {
    const rawList = portalData?.emittedInvoices || [];
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        cui: string;
        code: string;
        invoiceCount: number;
        totalBase: number;
        totalVat: number;
        totalGross: number;
        nirCount: number;
        latestInvoiceDate: string;
        invoices: any[];
      }
    >();

    rawList.forEach((inv: any) => {
      const name = (inv.clientName || "Client necunoscut").trim();
      const cui = (inv.clientCUI || "").trim();
      const key = cui || name.toLowerCase();

      let existing = map.get(key);
      if (!existing) {
        existing = {
          key,
          name,
          cui,
          code: getSagaPartnerCode(cui, inv.id),
          invoiceCount: 0,
          totalBase: 0,
          totalVat: 0,
          totalGross: 0,
          nirCount: 0,
          latestInvoiceDate: "",
          invoices: [],
        };
        map.set(key, existing);
      }

      existing.invoiceCount += 1;
      existing.totalBase += Number(inv.totalBase || 0);
      existing.totalVat += Number(inv.totalVAT || 0);
      existing.totalGross += Number(inv.total || 0);
      if (
        inv.issueDate &&
        (!existing.latestInvoiceDate || inv.issueDate > existing.latestInvoiceDate)
      ) {
        existing.latestInvoiceDate = inv.issueDate;
      }
      existing.invoices.push(inv);
    });

    const list = Array.from(map.values());
    list.sort(
      (a, b) => b.invoiceCount - a.invoiceCount || b.totalGross - a.totalGross
    );
    return list;
  }, [portalData?.emittedInvoices]);

  const displayedPartners = useMemo(() => {
    const baseList =
      activeTab === "received" ? suppliersSummary : clientsSummary;
    let list = baseList;

    if (partnerSearch.trim()) {
      const q = partnerSearch.trim().toLowerCase();
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.cui.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    if (partnerSort === "count_desc") {
      sorted.sort(
        (a, b) => b.invoiceCount - a.invoiceCount || b.totalGross - a.totalGross
      );
    } else if (partnerSort === "total_desc") {
      sorted.sort(
        (a, b) => b.totalGross - a.totalGross || b.invoiceCount - a.invoiceCount
      );
    } else if (partnerSort === "name_asc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "ro"));
    }
    return sorted;
  }, [activeTab, suppliersSummary, clientsSummary, partnerSearch, partnerSort]);

  const selectedPartnerObj = useMemo(() => {
    if (!selectedPartnerKey) return null;
    const list = activeTab === "received" ? suppliersSummary : clientsSummary;
    return list.find(p => p.key === selectedPartnerKey) || null;
  }, [activeTab, suppliersSummary, clientsSummary, selectedPartnerKey]);

  const activeInvoices = useMemo(() => {
    const base =
      activeTab === "received" ? filteredInvoices : filteredEmittedInvoices;
    if (!selectedPartnerKey) return base;

    return base.filter(inv => {
      const cui =
        (activeTab === "received" ? inv.supplierCUI : inv.clientCUI) || "";
      const name =
        (activeTab === "received" ? inv.supplierName : inv.clientName) || "";
      const key = cui.trim() || name.trim().toLowerCase();
      return key === selectedPartnerKey;
    });
  }, [activeTab, filteredInvoices, filteredEmittedInvoices, selectedPartnerKey]);

  useEffect(() => {
    if (activeInvoices.length > 0) {
      if (
        !selectedInvoiceId ||
        !activeInvoices.some(i => i.id === selectedInvoiceId)
      ) {
        setSelectedInvoiceId(activeInvoices[0].id);
      }
    } else {
      setSelectedInvoiceId(null);
    }
  }, [activeInvoices, selectedInvoiceId]);

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return activeInvoices[0] || null;
    return (
      activeInvoices.find(i => i.id === selectedInvoiceId) ||
      activeInvoices[0] ||
      null
    );
  }, [activeInvoices, selectedInvoiceId]);

  useEffect(() => {
    if (displayedPartners.length > 0) {
      if (
        !selectedPartnerIdInList ||
        !displayedPartners.some(p => p.key === selectedPartnerIdInList)
      ) {
        setSelectedPartnerIdInList(displayedPartners[0].key);
      }
    } else {
      setSelectedPartnerIdInList(null);
    }
  }, [displayedPartners, selectedPartnerIdInList]);

  const highlightedPartnerInList = useMemo(() => {
    if (!selectedPartnerIdInList) return displayedPartners[0] || null;
    return (
      displayedPartners.find(p => p.key === selectedPartnerIdInList) ||
      displayedPartners[0] ||
      null
    );
  }, [displayedPartners, selectedPartnerIdInList]);

  const { data: documentLines = [], isLoading: isLinesLoading } =
    trpc.accountantPortal.getDocumentLines.useQuery(
      {
        token,
        sessionToken,
        docType: activeTab,
        docId: selectedInvoice?.id || 0,
        nirId: selectedInvoice?.nirId || null,
      },
      {
        enabled: Boolean(token && sessionToken && selectedInvoice?.id),
        staleTime: 30_000,
      }
    );

  const handleCopyCui = (cui: string) => {
    if (!cui) return;
    navigator.clipboard.writeText(cui.replace(/^RO/i, "").trim());
    setCopiedCui(cui);
    toast.success(`CUI ${cui} copiat în clipboard!`);
    setTimeout(() => setCopiedCui(null), 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          (e.target as HTMLElement)?.tagName
        )
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (selectedPartnerKey) {
          e.preventDefault();
          setSelectedPartnerKey(null);
          return;
        }
        if (subView === "partners_list") {
          e.preventDefault();
          setSubView("all_invoices");
          return;
        }
      }

      if (subView === "partners_list") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const idx = displayedPartners.findIndex(
            p => p.key === selectedPartnerIdInList
          );
          if (idx >= 0 && idx < displayedPartners.length - 1) {
            setSelectedPartnerIdInList(displayedPartners[idx + 1].key);
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const idx = displayedPartners.findIndex(
            p => p.key === selectedPartnerIdInList
          );
          if (idx > 0) {
            setSelectedPartnerIdInList(displayedPartners[idx - 1].key);
          }
        } else if (e.key === "Enter" && selectedPartnerIdInList) {
          e.preventDefault();
          setSelectedPartnerKey(selectedPartnerIdInList);
          setSubView("all_invoices");
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = activeInvoices.findIndex(i => i.id === selectedInvoiceId);
        if (idx >= 0 && idx < activeInvoices.length - 1) {
          setSelectedInvoiceId(activeInvoices[idx + 1].id);
          setSelectedLineIdx(0);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = activeInvoices.findIndex(i => i.id === selectedInvoiceId);
        if (idx > 0) {
          setSelectedInvoiceId(activeInvoices[idx - 1].id);
          setSelectedLineIdx(0);
        }
      } else if (e.key === "Enter" && selectedInvoice) {
        e.preventDefault();
        onViewInvoicePdf(selectedInvoice);
      } else if ((e.key === "n" || e.key === "N") && selectedInvoice?.hasNir) {
        e.preventDefault();
        onViewNirPdf(selectedInvoice);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    subView,
    displayedPartners,
    selectedPartnerIdInList,
    selectedPartnerKey,
    activeInvoices,
    selectedInvoiceId,
    selectedInvoice,
    onViewInvoicePdf,
    onViewNirPdf,
  ]);

  const company = portalData?.company || {};
  const currentKpiData =
    activeTab === "received" ? currentKpis : currentEmittedKpis;

  const spvStats = portalData?.spvStats;
  const realSpvCount =
    spvStats?.totalReceived ??
    portalData?.invoices?.filter(
      (i: any) => i.source === "spv_anaf" || Boolean(i.spvIndex)
    ).length ??
    0;
  const realAlertsCount = spvStats?.alertsCount ?? (spvStats?.errorsCount || 0);
  const realAlerts = spvStats?.alerts || [];
  const spvMessages = spvStats?.messages || [];
  const bankStatements: any[] = portalData?.bankStatements || [];
  const stmtMonths = useMemo(() => {
    const s = new Set<string>();
    bankStatements.forEach((b: any) => {
      if (b.statementMonth) s.add(b.statementMonth);
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [bankStatements]);
  const filteredSagaStatements = useMemo(() => {
    if (stmtMonthFilter === "all") return bankStatements;
    return bankStatements.filter((b: any) => b.statementMonth === stmtMonthFilter);
  }, [bankStatements, stmtMonthFilter]);

  const filteredSpvMessages = useMemo(() => {
    return spvMessages.filter((m: any) => {
      if (spvTabFilter === "in" && m.direction !== "in") return false;
      if (spvTabFilter === "out" && m.direction !== "out") return false;
      if (spvSearchQuery.trim()) {
        const q = spvSearchQuery.toLowerCase();
        return (
          m.invoiceNumber?.toLowerCase().includes(q) ||
          m.partnerName?.toLowerCase().includes(q) ||
          m.partnerCui?.toLowerCase().includes(q) ||
          m.spvIndex?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [spvMessages, spvTabFilter, spvSearchQuery]);

  const selectedNrInt = selectedInvoice
    ? getSagaInternalNumber(selectedInvoice)
    : "";
  const selectedNrDoc = selectedInvoice?.invoiceNumber || "";
  const selectedCod = selectedInvoice
    ? getSagaPartnerCode(
        activeTab === "received"
          ? selectedInvoice.supplierCUI
          : selectedInvoice.clientCUI,
        selectedInvoice.id
      )
    : "";
  const selectedPartner =
    (activeTab === "received"
      ? selectedInvoice?.supplierName
      : selectedInvoice?.clientName) || "";

  return (
    <div className="min-h-screen apple-canvas text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col select-none antialiased font-sans">
      {/* 1. TOP APPLICATION MENU BAR */}
      <div className="bg-white/90 dark:bg-[#18181a] backdrop-blur-xl px-3 py-2 flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] text-[12px] shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
            SAGA C.3.0.605 · {company.name ? company.name.toUpperCase() : "FIRMA"} ·{" "}
            <span className="text-[#6e6e73] dark:text-[#98989d] font-medium tabular-nums">
              {company.cui || "CUI"}
            </span>
          </span>

          <span className="hidden md:inline w-px h-3.5 bg-black/10 dark:bg-white/10" />

          <div className="hidden md:flex items-center gap-1 text-[12px] text-[#3a3a3c] dark:text-[#ebebf5]">
            <button
              type="button"
              onClick={() => {
                setActiveTab("received");
                setSubView("partners_list");
                setSelectedPartnerKey(null);
              }}
              className="px-2.5 h-7 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Deschide lista și situația centralizată a furnizorilor"
            >
              Fișiere: Furnizori
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("emitted");
                setSubView("partners_list");
                setSelectedPartnerKey(null);
              }}
              className="px-2.5 h-7 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Deschide lista și situația centralizată a clienților"
            >
              Fișiere: Clienți
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("received");
                setSubView("all_invoices");
                setSelectedPartnerKey(null);
              }}
              className="px-2.5 h-7 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Deschide ecranul clasic de Intrări (facturi & recepții NIR)"
            >
              Operații: Intrări
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("emitted");
                setSubView("all_invoices");
                setSelectedPartnerKey(null);
              }}
              className="px-2.5 h-7 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Deschide ecranul clasic de Ieșiri (facturi emise către clienți)"
            >
              Operații: Ieșiri
            </button>
            <button
              type="button"
              onClick={() => setShowStatementsModal(true)}
              className="px-2.5 h-7 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="Deschide arhiva cu extrasele de cont bancare încărcate de firmă"
            >
              Operații: Extrase Cont ({bankStatements.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setSubView("partners_list");
                setSelectedPartnerKey(null);
              }}
              className="px-2.5 h-7 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors cursor-pointer"
              title="Deschide Situația pe parteneri"
            >
              Situații: {activeTab === "received" ? "Furnizori" : "Clienți"}
            </button>
          </div>
        </div>

        {/* Zona Dreapta: Extrase, e-Facturi, Alerte, Comutator Mod Modern & Ieșire */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowStatementsModal(true)}
            className="apple-btn-glass inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums cursor-pointer"
            title="Deschide extrasele de cont bancare puse la dispoziție de administrator"
          >
            <Landmark className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Extrase ({bankStatements.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSpvModal(true)}
            className="apple-btn-glass inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums cursor-pointer"
            title="Deschide ecranul e-Factura SPV ANAF cu mesajele descărcate și sincronizare live"
          >
            <Globe className="w-3 h-3 text-[#0071e3] dark:text-[#0a84ff]" />
            <span>e-Facturi ({realSpvCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAlertsModal(true)}
            className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[11.5px] font-semibold tabular-nums cursor-pointer ${
              (spvStats?.errorsCount || 0) > 0
                ? "apple-btn-destructive-soft"
                : "apple-btn-glass text-[#1d1d1f] dark:text-[#f5f5f7]"
            }`}
            title="Deschide ecranul cu alerte contabile și erori reale de validare din SPV ANAF"
          >
            <span>Alerte ({realAlertsCount})</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToModern}
            className="apple-btn-prominent flex items-center gap-1.5 px-3 h-7 rounded-full text-white text-[11.5px] font-semibold cursor-pointer"
            title="Comută la vederea modernă web (cu carduri KPI și meniu lateral)"
          >
            <Sparkles className="w-3 h-3" />
            <span>Comută la Mod Modern</span>
          </button>

          <button
            type="button"
            onClick={onLockSession}
            className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#ff3b30] dark:hover:text-[#ff453a] text-[11.5px] font-semibold cursor-pointer"
            title="Închide sesiunea de acces contabil"
          >
            <LogOut className="w-3 h-3" />
            <span>Ieșire</span>
          </button>
        </div>
      </div>

      {/* 2. SPAȚIUL DE LUCRU SPLIT-SCREEN (2 GRILE) */}
      <div className="flex-1 p-2 sm:p-3 flex flex-col min-h-0 overflow-hidden">
        <div className="apple-surface flex-1 flex flex-col overflow-hidden min-h-0">
          {/* BARA DE TITLU A FERESTREI */}
          <div className="bg-[#fafafa] dark:bg-white/[0.03] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-[7px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                <Folder className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
              </span>
              <span className="font-semibold text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                {subView === "partners_list"
                  ? activeTab === "received"
                    ? "Situație furnizori (listă parteneri)"
                    : "Situație clienți (listă parteneri)"
                  : selectedPartnerKey
                    ? `${
                        activeTab === "received"
                          ? "Intrări furnizor"
                          : "Ieșiri client"
                      }: ${selectedPartnerObj?.name || selectedPartnerKey}`
                    : activeTab === "received"
                      ? "Intrări (facturi, bonuri & avize)"
                      : "Ieșiri (facturi, bonuri & avize)"}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="apple-segmented">
                <button
                  type="button"
                  data-active={activeTab === "received"}
                  onClick={() => {
                    setActiveTab("received");
                    setSelectedPartnerKey(null);
                  }}
                  className="apple-segmented-item px-2.5 text-[11.5px] tabular-nums"
                >
                  Furnizori (Intrări) ({portalData?.invoices?.length || 0})
                </button>
                <button
                  type="button"
                  data-active={activeTab === "emitted"}
                  onClick={() => {
                    setActiveTab("emitted");
                    setSelectedPartnerKey(null);
                  }}
                  className="apple-segmented-item px-2.5 text-[11.5px] tabular-nums"
                >
                  Clienți (Ieșiri) ({portalData?.emittedInvoices?.length || 0})
                </button>
              </div>

              <div className="apple-segmented">
                <button
                  type="button"
                  data-active={subView === "all_invoices" && !selectedPartnerKey}
                  onClick={() => {
                    setSubView("all_invoices");
                    setSelectedPartnerKey(null);
                  }}
                  className="apple-segmented-item px-2.5 text-[11.5px]"
                >
                  Toate facturile
                </button>
                <button
                  type="button"
                  data-active={
                    subView === "partners_list" || Boolean(selectedPartnerKey)
                  }
                  onClick={() => {
                    setSubView("partners_list");
                    setSelectedPartnerKey(null);
                  }}
                  className="apple-segmented-item px-2.5 text-[11.5px] tabular-nums"
                >
                  {activeTab === "received"
                    ? `Situație furnizori (${suppliersSummary.length})`
                    : `Situație clienți (${clientsSummary.length})`}
                </button>
              </div>
            </div>
          </div>

          {/* BARA DE INSTRUMENTE A FERESTREI */}
          <div className="bg-[#fafafa]/80 dark:bg-white/[0.02] px-3 py-2 flex flex-wrap items-center justify-between gap-1.5 border-b border-black/[0.05] dark:border-white/[0.07] shrink-0 text-[12px]">
            {subView === "partners_list" ? (
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <button
                  type="button"
                  className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  Adaug
                </button>
                <button
                  type="button"
                  className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  Modific
                </button>
                <button
                  type="button"
                  className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  Sterg
                </button>

                <span className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5" />

                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={partnerSearch}
                    onChange={e => setPartnerSearch(e.target.value)}
                    placeholder={`Caută ${
                      activeTab === "received" ? "furnizor" : "client"
                    } (nume, CUI, cod)...`}
                    style={{
                      paddingLeft: 30,
                      paddingRight: partnerSearch ? 26 : 12,
                    }}
                    className="apple-pill-control rounded-full h-[30px] w-52 md:w-64 text-[12px] outline-none"
                  />
                  {partnerSearch && (
                    <button
                      type="button"
                      onClick={() => setPartnerSearch("")}
                      className="absolute right-1.5 text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-white text-xs px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <Select
                  value={partnerSort}
                  onValueChange={val => setPartnerSort(val as any)}
                >
                  <SelectTrigger className="apple-pill-control h-[30px] w-auto px-3 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count_desc">
                      Sortare: Cele mai multe facturi
                    </SelectItem>
                    <SelectItem value="total_desc">
                      Sortare: Total sumă descrescător
                    </SelectItem>
                    <SelectItem value="name_asc">
                      Sortare: Denumire partener (A-Z)
                    </SelectItem>
                  </SelectContent>
                </Select>

                <button
                  type="button"
                  onClick={() => {
                    setSubView("all_invoices");
                    setSelectedPartnerKey(null);
                  }}
                  className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  <FileText className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                  <span>Vezi toate facturile</span>
                </button>

                <button
                  type="button"
                  onClick={
                    activeTab === "received" ? onExportExcel : onExportEmittedExcel
                  }
                  className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  title="Export Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSpvModal(true)}
                  className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums cursor-pointer"
                >
                  <Globe className="w-3 h-3 text-[#0071e3] dark:text-[#0a84ff]" />
                  <span>e-Factura SPV ({realSpvCount})</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <button
                  type="button"
                  className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  title="Adăugare înregistrare nouă"
                >
                  Adaug
                </button>
                <button
                  type="button"
                  className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  title="Modificare înregistrare"
                >
                  Modific
                </button>
                <button
                  type="button"
                  className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  title="Ștergere înregistrare"
                >
                  Sterg
                </button>

                <span className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5" />

                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={activeTab === "received" ? search : searchEmitted}
                    onChange={e =>
                      activeTab === "received"
                        ? setSearch(e.target.value)
                        : setSearchEmitted(e.target.value)
                    }
                    placeholder="Caută în tabel..."
                    style={{ paddingLeft: 30, paddingRight: 10 }}
                    className="apple-pill-control rounded-full h-[30px] w-36 md:w-44 text-[12px] outline-none"
                  />
                </div>

                <Select
                  value={activeTab === "received" ? period : periodEmitted}
                  onValueChange={val =>
                    activeTab === "received"
                      ? setPeriod(val as any)
                      : setPeriodEmitted(val as any)
                  }
                >
                  <SelectTrigger
                    data-filtered={
                      (activeTab === "received" ? period : periodEmitted) !== "all"
                    }
                    className="apple-pill-control h-[30px] w-auto px-3 text-[12px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate perioadele</SelectItem>
                    <SelectItem value="current_month">Luna curentă</SelectItem>
                    <SelectItem value="last_month">Luna trecută</SelectItem>
                    <SelectItem value="last_3_months">Ultimele 3 luni</SelectItem>
                    <SelectItem value="current_year">Anul 2026</SelectItem>
                  </SelectContent>
                </Select>

                {activeTab === "received" && (
                  <Select
                    value={nirFilter}
                    onValueChange={val => setNirFilter(val as any)}
                  >
                    <SelectTrigger
                      data-filtered={nirFilter !== "all"}
                      className="apple-pill-control h-[30px] w-auto px-3 text-[12px]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">NIR: Toate</SelectItem>
                      <SelectItem value="cu_nir">Doar cu NIR</SelectItem>
                      <SelectItem value="fara_nir">Fără NIR</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Select
                  value={selectedPartnerKey || "all"}
                  onValueChange={val => {
                    setSelectedPartnerKey(val === "all" ? null : val);
                    setSubView("all_invoices");
                  }}
                >
                  <SelectTrigger
                    data-filtered={Boolean(selectedPartnerKey)}
                    className="apple-pill-control h-[30px] w-auto max-w-[210px] px-3 text-[12px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {activeTab === "received"
                        ? `Toți furnizorii (${suppliersSummary.length})`
                        : `Toți clienții (${clientsSummary.length})`}
                    </SelectItem>
                    {(activeTab === "received"
                      ? suppliersSummary
                      : clientsSummary
                    ).map(p => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.code ? `${p.code} - ` : ""}
                        {p.name} ({p.invoiceCount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <button
                  type="button"
                  onClick={() => {
                    setSubView("partners_list");
                    setSelectedPartnerKey(null);
                  }}
                  className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  {activeTab === "received" ? (
                    <Building2 className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                  ) : (
                    <Users className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                  )}
                  <span className="hidden sm:inline">
                    {activeTab === "received"
                      ? "Situație furnizori"
                      : "Situație clienți"}
                  </span>
                </button>

                <span className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5" />

                <button
                  type="button"
                  onClick={
                    activeTab === "received" ? onExportExcel : onExportEmittedExcel
                  }
                  className="apple-btn-glass flex items-center gap-1.5 px-2.5 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  title="Export Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Excel</span>
                </button>

                {selectedInvoice && (
                  <button
                    type="button"
                    onClick={() => onViewInvoicePdf(selectedInvoice)}
                    className="apple-btn-glass flex items-center gap-1.5 px-2.5 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    title="Tipărește factura PDF (sau apăsați Enter)"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d]" />
                    <span>Tipărire</span>
                  </button>
                )}

                <button
                  type="button"
                  className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#8e8e93] opacity-60 cursor-default"
                  disabled
                >
                  Salvare
                </button>

                <button
                  type="button"
                  className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#8e8e93] opacity-60 cursor-default"
                  disabled
                >
                  <RotateCcw className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowSpvModal(true)}
                  className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums cursor-pointer"
                >
                  <Globe className="w-3 h-3 text-[#0071e3] dark:text-[#0a84ff]" />
                  <span>e-Factura SPV ({realSpvCount})</span>
                </button>

                <button
                  type="button"
                  onClick={onDownloadSagaXml}
                  className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  title="Descarcă fișier XML 100% conform importului SAGA C"
                >
                  <Download className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                  <span className="hidden sm:inline">Export XML</span>
                </button>

                <button
                  type="button"
                  onClick={onDownloadZip}
                  className="apple-btn-prominent flex items-center gap-1.5 px-3 h-7 text-white text-[11.5px] font-semibold cursor-pointer"
                  title="Descarcă toate documentele selectate într-o arhivă ZIP"
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pachet ZIP</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums hidden md:inline">
                {subView === "partners_list"
                  ? `${displayedPartners.length} parteneri`
                  : `${activeInvoices.length} doc. găsite`}
              </span>
              <button
                type="button"
                className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              >
                &lt;&lt; Detalii
              </button>
            </div>
          </div>

          {/* 3. ZONA DE CONȚINUT MDI */}
          {subView === "partners_list" ? (
            <>
              {/* GRILA SUPERIOARĂ: DIRECTORUL CENTRALIZAT AL PARTENERILOR */}
              <div className="flex-1 min-h-[170px] max-h-[48vh] bg-white dark:bg-[#1c1c1e] overflow-auto border-b border-black/[0.06] dark:border-white/[0.08] relative">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-[#fafafa] dark:bg-[#242426] text-[#6e6e73] dark:text-[#98989d] font-medium text-[11.5px] border-b border-black/[0.06] dark:border-white/[0.08] z-10 select-none">
                    <tr>
                      <th className="py-2 px-2 text-center w-10 font-medium">Tip</th>
                      <th className="py-2 px-2 text-center w-16 font-medium">Cod</th>
                      <th className="py-2 px-3 text-left font-medium">
                        {activeTab === "received"
                          ? "Denumire furnizor"
                          : "Denumire client"}
                      </th>
                      <th className="py-2 px-3 text-left w-32 font-medium">
                        Cod fiscal / CUI
                      </th>
                      <th className="py-2 px-2 text-center w-24 font-medium">
                        Nr. facturi
                      </th>
                      <th className="py-2 px-3 text-right w-32 font-medium">
                        Valoare fără TVA
                      </th>
                      <th className="py-2 px-3 text-right w-28 font-medium">TVA</th>
                      <th className="py-2 px-3 text-right w-32 font-medium">
                        Total rulaj
                      </th>
                      {activeTab === "received" && (
                        <th className="py-2 px-2 text-center w-24 font-medium">
                          NIR-uri
                        </th>
                      )}
                      <th className="py-2 px-2 text-center w-28 font-medium">
                        Ultima factură
                      </th>
                      <th className="py-2 px-3 text-center w-36 font-medium">
                        Acțiune
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {displayedPartners.length === 0 ? (
                      <tr>
                        <td
                          colSpan={activeTab === "received" ? 11 : 10}
                          className="py-10 text-center text-[#6e6e73] dark:text-[#98989d]"
                        >
                          Nu s-au găsit parteneri conform criteriilor de căutare.
                        </td>
                      </tr>
                    ) : (
                      displayedPartners.map(partner => {
                        const isSelected = selectedPartnerIdInList === partner.key;

                        return (
                          <tr
                            key={partner.key}
                            onClick={() => setSelectedPartnerIdInList(partner.key)}
                            onDoubleClick={() => {
                              setSelectedPartnerKey(partner.key);
                              setSubView("all_invoices");
                            }}
                            className={`cursor-pointer transition-colors select-none ${
                              isSelected
                                ? "bg-[#0071e3]/[0.10] dark:bg-[#0a84ff]/[0.20] text-[#1d1d1f] dark:text-white font-medium"
                                : "hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.04] text-[#1d1d1f] dark:text-[#f5f5f7]"
                            }`}
                          >
                            <td className="py-1.5 px-2 text-center text-[#6e6e73] dark:text-[#98989d]">
                              {activeTab === "received" ? (
                                <Building2 className="w-3.5 h-3.5 mx-auto" />
                              ) : (
                                <Users className="w-3.5 h-3.5 mx-auto" />
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {partner.code}
                            </td>
                            <td
                              className="py-1.5 px-3 truncate max-w-[280px] font-semibold"
                              title={partner.name}
                            >
                              {partner.name}
                            </td>
                            <td className="py-1.5 px-3 tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              <div className="flex items-center justify-between gap-1">
                                <span>{partner.cui || "—"}</span>
                                {partner.cui && (
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleCopyCui(partner.cui);
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                                    title={`Copiază CUI: ${partner.cui}`}
                                  >
                                    {copiedCui === partner.cui ? "✓" : "CUI"}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]">
                                {partner.invoiceCount}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaCurrency(partner.totalBase)}
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaCurrency(partner.totalVat)}
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums font-semibold">
                              {formatSagaCurrency(partner.totalGross)}
                            </td>
                            {activeTab === "received" && (
                              <td className="py-1.5 px-2 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full tabular-nums text-[11px] font-medium ${
                                    partner.nirCount > 0
                                      ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                                      : "text-[#8e8e93]"
                                  }`}
                                >
                                  {partner.nirCount} / {partner.invoiceCount}
                                </span>
                              </td>
                            )}
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {partner.latestInvoiceDate
                                ? formatSagaDate(partner.latestInvoiceDate)
                                : "—"}
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedPartnerKey(partner.key);
                                  setSubView("all_invoices");
                                }}
                                className="apple-btn-glass px-2.5 h-6 text-[11px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                              >
                                Vezi facturi ({partner.invoiceCount}) →
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* BANDA INTERMEDIARĂ: PARTENER EVIDENȚIAT */}
              <div className="bg-[#f2f2f7]/75 dark:bg-[#2c2c2e]/65 px-3 py-2 flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0 text-[12px] flex-wrap">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <span className="text-[#6e6e73] dark:text-[#98989d] font-medium hidden sm:inline">
                    {activeTab === "received"
                      ? "Furnizor selectat:"
                      : "Client selectat:"}
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={highlightedPartnerInList?.code || ""}
                    title="Cod partener"
                    className="apple-input w-20 h-7 px-2 text-[12px] tabular-nums text-center"
                  />
                  <input
                    type="text"
                    readOnly
                    value={
                      highlightedPartnerInList?.name || "Niciun partener selectat"
                    }
                    title="Denumire partener"
                    className="apple-input w-56 md:w-80 h-7 px-2.5 text-[12px] font-semibold truncate"
                  />
                  {highlightedPartnerInList?.cui && (
                    <span className="tabular-nums text-[#6e6e73] dark:text-[#98989d] bg-white dark:bg-[#1c1c1e] px-2.5 py-1 border border-black/[0.06] dark:border-white/[0.08] text-[11.5px] rounded-full">
                      CUI {highlightedPartnerInList.cui}
                    </span>
                  )}
                  {highlightedPartnerInList && (
                    <span className="text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums hidden md:inline">
                      {highlightedPartnerInList.invoiceCount} facturi · Total:{" "}
                      <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {formatSagaCurrency(highlightedPartnerInList.totalGross)}{" "}
                        RON
                      </strong>
                    </span>
                  )}
                </div>

                {highlightedPartnerInList && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPartnerKey(highlightedPartnerInList.key);
                      setSubView("all_invoices");
                    }}
                    className="apple-btn-prominent flex items-center gap-1.5 px-3.5 h-8 text-white font-semibold text-[12px] rounded-full cursor-pointer shrink-0"
                  >
                    <span>Deschide dosar facturi & detalii linii</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* GRILA INFERIOARĂ: FACTURILE PARTENERULUI EVIDENȚIAT */}
              <div className="h-[210px] xl:h-[240px] bg-white dark:bg-[#1c1c1e] overflow-auto shrink-0 border-b border-black/[0.06] dark:border-white/[0.08] relative">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-[#fafafa] dark:bg-[#242426] text-[#6e6e73] dark:text-[#98989d] font-medium text-[11.5px] border-b border-black/[0.06] dark:border-white/[0.08] z-10 select-none">
                    <tr>
                      <th className="py-2 px-2 text-center w-10 font-medium">Tip</th>
                      <th className="py-2 px-2 text-center w-24 font-medium">
                        Nr. int.
                      </th>
                      <th className="py-2 px-3 text-left w-36 font-medium">
                        Nr. doc.
                      </th>
                      <th className="py-2 px-2 text-center w-24 font-medium">Data</th>
                      <th className="py-2 px-2 text-center w-24 font-medium">
                        Scadent
                      </th>
                      <th className="py-2 px-3 text-right w-28 font-medium">
                        Valoare
                      </th>
                      <th className="py-2 px-3 text-right w-24 font-medium">TVA</th>
                      <th className="py-2 px-3 text-right w-28 font-medium">Total</th>
                      <th className="py-2 px-2 text-center w-32 font-medium">
                        ID încărcare SPV
                      </th>
                      <th className="py-2 px-3 text-left font-medium">Note / NIR</th>
                      <th className="py-2 px-2 text-center w-24 font-medium">
                        Doc. atașat
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {!highlightedPartnerInList ||
                    highlightedPartnerInList.invoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          className="py-10 text-center text-[#6e6e73] dark:text-[#98989d]"
                        >
                          Selectați un partener din tabelul de mai sus pentru a-i vedea facturile.
                        </td>
                      </tr>
                    ) : (
                      highlightedPartnerInList.invoices.map((inv: any) => {
                        const internalNr = getSagaInternalNumber(inv);
                        return (
                          <tr
                            key={inv.id}
                            onDoubleClick={() => onViewInvoicePdf(inv)}
                            className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.04] transition-colors select-none text-[#1d1d1f] dark:text-[#f5f5f7]"
                          >
                            <td className="py-1.5 px-2 text-center text-amber-600 dark:text-amber-400">
                              <Lock className="w-3.5 h-3.5 mx-auto" />
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {internalNr}
                            </td>
                            <td className="py-1.5 px-3 tabular-nums font-semibold truncate max-w-[150px]">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaDate(inv.issueDate)}
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaDate(inv.dueDate || inv.issueDate)}
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaCurrency(inv.totalBase)}
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaCurrency(inv.totalVAT)}
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums font-semibold">
                              {formatSagaCurrency(inv.total)}
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums">
                              {inv.spvIndex ? (
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setShowSpvModal(true);
                                    setSpvSearchQuery(inv.spvIndex);
                                  }}
                                  className="underline cursor-pointer text-[#1d1d1f] dark:text-[#f5f5f7] font-medium tabular-nums"
                                >
                                  {inv.spvIndex}
                                </button>
                              ) : (
                                <span className="text-[#8e8e93]">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 truncate max-w-[220px] text-[#6e6e73] dark:text-[#98989d]">
                              {inv.notes ||
                                (inv.hasNir
                                  ? `NIR: ${inv.nirNumber}`
                                  : "Factură validată")}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    onViewInvoicePdf(inv);
                                  }}
                                  className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                                  title="Vizualizează factura PDF"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                {inv.hasNir && (
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      onViewNirPdf(inv);
                                    }}
                                    className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                    title={`Vizualizează Nota de Recepție (NIR: ${inv.nirNumber})`}
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* BARA DE ACȚIUNI PENTRU MOD SITUAȚIE PARTENERI */}
              <div className="bg-[#fafafa] dark:bg-white/[0.02] px-3 py-2 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.08] shrink-0 text-[12px] flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSubView("all_invoices");
                      setSelectedPartnerKey(null);
                    }}
                    className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    <span>◄</span>
                    <span>Toate facturile</span>
                  </button>

                  {highlightedPartnerInList && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPartnerKey(highlightedPartnerInList.key);
                        setSubView("all_invoices");
                      }}
                      className="apple-btn-prominent flex items-center gap-1.5 px-3.5 h-7 text-white text-[11.5px] font-semibold cursor-pointer"
                    >
                      <span>Intră în dosar: {highlightedPartnerInList.name}</span>
                      <span>→</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={
                      activeTab === "received" ? onExportExcel : onExportEmittedExcel
                    }
                    className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Export Excel parteneri</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onLockSession}
                  className="apple-btn-destructive-soft px-3.5 h-7 text-[11.5px] font-semibold cursor-pointer"
                  title="Ieșire din ecran"
                >
                  Ieșire
                </button>
              </div>
            </>
          ) : (
            <>
              {/* BARA FIȘĂ PARTENER */}
              {selectedPartnerKey && selectedPartnerObj && (
                <div className="bg-[#f2f2f7]/80 dark:bg-[#2c2c2e]/70 border-b border-black/[0.06] dark:border-white/[0.08] px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 text-[12px] select-none">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPartnerKey(null);
                        setSubView("partners_list");
                      }}
                      className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                      title="Revenire la lista centralizată de parteneri (tasta Esc)"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Înapoi la listă (Esc)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="tabular-nums font-semibold bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] px-2 py-0.5 border border-black/[0.06] dark:border-white/[0.08] rounded-full text-[11px]">
                        {selectedPartnerObj.code}
                      </span>
                      <span className="font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13px]">
                        {selectedPartnerObj.name}
                      </span>
                      {selectedPartnerObj.cui && (
                        <span className="tabular-nums text-[#6e6e73] dark:text-[#98989d] text-[11.5px]">
                          CUI {selectedPartnerObj.cui}
                        </span>
                      )}
                    </div>

                    <span className="w-px h-4 bg-black/10 dark:bg-white/10" />

                    <div className="flex items-center gap-2.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                      <span className="px-2 py-0.5 rounded-full bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[11px]">
                        {activeInvoices.length} factur
                        {activeInvoices.length === 1 ? "ă" : "i"}
                      </span>
                      <span>
                        Bază:{" "}
                        <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {formatSagaCurrency(selectedPartnerObj.totalBase)}
                        </strong>{" "}
                        lei
                      </span>
                      <span>
                        TVA:{" "}
                        <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {formatSagaCurrency(selectedPartnerObj.totalVat)}
                        </strong>{" "}
                        lei
                      </span>
                      <span>
                        Total:{" "}
                        <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {formatSagaCurrency(selectedPartnerObj.totalGross)}
                        </strong>{" "}
                        lei
                      </span>

                      {activeTab === "received" &&
                        selectedPartnerObj.nirCount > 0 && (
                          <span className="bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium text-[11px]">
                            ✓ {selectedPartnerObj.nirCount} NIR-uri recepționate
                          </span>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <Select
                      value={selectedPartnerKey}
                      onValueChange={val => {
                        setSelectedPartnerKey(val === "all" ? null : val);
                      }}
                    >
                      <SelectTrigger className="apple-pill-control h-7 w-auto max-w-[200px] px-2.5 text-[11.5px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(activeTab === "received"
                          ? suppliersSummary
                          : clientsSummary
                        ).map(p => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.name} ({p.invoiceCount})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <button
                      type="button"
                      onClick={() => setSelectedPartnerKey(null)}
                      className="apple-btn-glass px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                    >
                      ✕ Toate facturile
                    </button>
                  </div>
                </div>
              )}

              {/* 1. GRILA SUPERIOARĂ: ANTET FACTURI */}
              <div className="flex-1 min-h-[160px] max-h-[46vh] bg-white dark:bg-[#1c1c1e] overflow-auto border-b border-black/[0.06] dark:border-white/[0.08] relative">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-[#fafafa] dark:bg-[#242426] text-[#6e6e73] dark:text-[#98989d] font-medium text-[11.5px] border-b border-black/[0.06] dark:border-white/[0.08] z-10 select-none">
                    <tr>
                      <th className="py-2 px-1.5 text-center w-8 font-medium">Tip</th>
                      <th className="py-2 px-2 text-center w-20 font-medium">
                        Nr. int.
                      </th>
                      <th className="py-2 px-2.5 text-left w-32 font-medium">
                        Nr. doc.
                      </th>
                      <th className="py-2 px-1.5 text-center w-14 font-medium">
                        Cod
                      </th>
                      <th className="py-2 px-2.5 text-left font-medium">
                        {activeTab === "received" ? "Furnizor" : "Client"}
                      </th>
                      <th className="py-2 px-1 text-center w-12 font-medium">
                        TVA I
                      </th>
                      <th className="py-2 px-2 text-center w-20 font-medium">Data</th>
                      <th className="py-2 px-2 text-center w-20 font-medium">
                        Scadent
                      </th>
                      <th className="py-2 px-2.5 text-right w-24 font-medium">
                        Valoare
                      </th>
                      <th className="py-2 px-2 text-right w-16 font-medium">
                        Repartizat
                      </th>
                      <th className="py-2 px-2.5 text-right w-20 font-medium">TVA</th>
                      <th className="py-2 px-2.5 text-right w-24 font-medium">
                        Total
                      </th>
                      <th className="py-2 px-2 text-right w-20 font-medium">
                        Neachitat
                      </th>
                      <th className="py-2 px-2 text-center w-24 font-medium">
                        Data document
                      </th>
                      <th className="py-2 px-2.5 text-left w-48 font-medium">
                        Informații suplimentare
                      </th>
                      <th className="py-2 px-2 text-center w-28 font-medium">
                        ID încărcare SPV
                      </th>
                      <th className="py-2 px-2 text-center w-24 font-medium">
                        Doc. atașat
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                    {activeInvoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={17}
                          className="py-10 text-center text-[#6e6e73] dark:text-[#98989d]"
                        >
                          Nu există documente pentru filtrele selectate.
                        </td>
                      </tr>
                    ) : (
                      activeInvoices.map(inv => {
                        const isSelected = selectedInvoice?.id === inv.id;
                        const partnerName =
                          activeTab === "received"
                            ? inv.supplierName
                            : inv.clientName;
                        const partnerCui =
                          activeTab === "received"
                            ? inv.supplierCUI
                            : inv.clientCUI;
                        const internalNr = getSagaInternalNumber(inv);
                        const partnerCode = getSagaPartnerCode(partnerCui, inv.id);

                        return (
                          <tr
                            key={inv.id}
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setSelectedLineIdx(0);
                            }}
                            onDoubleClick={() => onViewInvoicePdf(inv)}
                            className={`cursor-pointer transition-colors select-none ${
                              isSelected
                                ? "bg-[#0071e3]/[0.10] dark:bg-[#0a84ff]/[0.20] text-[#1d1d1f] dark:text-white font-medium"
                                : "hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.04] text-[#1d1d1f] dark:text-[#f5f5f7]"
                            }`}
                          >
                            <td className="py-1.5 px-1.5 text-center text-amber-600 dark:text-amber-400">
                              <Lock className="w-3 h-3 mx-auto" />
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {internalNr}
                            </td>
                            <td className="py-1.5 px-2.5 tabular-nums font-semibold truncate max-w-[140px]">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-1.5 px-1.5 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {partnerCode}
                            </td>
                            <td
                              className="py-1.5 px-2.5 truncate max-w-[240px]"
                              title={`Click pentru a deschide dosarul partenerului: ${partnerName}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    const cui = partnerCui || "";
                                    const name = partnerName || "";
                                    const key =
                                      cui.trim() || name.trim().toLowerCase();
                                    setSelectedPartnerKey(key);
                                    setSubView("all_invoices");
                                  }}
                                  className="truncate text-left font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline cursor-pointer"
                                >
                                  {partnerName}
                                </button>
                                {partnerCui && (
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleCopyCui(partnerCui);
                                    }}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] shrink-0 cursor-pointer"
                                    title={`Copiază CUI: ${partnerCui}`}
                                  >
                                    {copiedCui === partnerCui ? "✓" : "CUI"}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-1.5 px-1 text-center text-[#8e8e93]">
                              ☐
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaDate(inv.issueDate)}
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaDate(inv.dueDate || inv.issueDate)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaCurrency(inv.totalBase)}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-[#8e8e93]">
                              0,00
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaCurrency(inv.totalVAT)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums font-semibold">
                              {formatSagaCurrency(inv.total)}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-[#8e8e93]">
                              0,00
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaDate(inv.issueDate)}
                            </td>
                            <td
                              className="py-1.5 px-2.5 truncate max-w-[200px] text-[#6e6e73] dark:text-[#98989d]"
                              title={
                                inv.notes ||
                                (inv.hasNir ? `NIR: ${inv.nirNumber}` : "")
                              }
                            >
                              {inv.notes ||
                                (inv.hasNir
                                  ? `NIR recepție: ${inv.nirNumber}`
                                  : "Se va achita cu OP")}
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums">
                              {inv.spvIndex ? (
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setShowSpvModal(true);
                                    setSpvSearchQuery(inv.spvIndex);
                                  }}
                                  className="underline cursor-pointer text-[#1d1d1f] dark:text-[#f5f5f7] font-medium tabular-nums"
                                >
                                  {inv.spvIndex}
                                </button>
                              ) : (
                                <span className="text-[#8e8e93]">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    onViewInvoicePdf(inv);
                                  }}
                                  className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                                  title="Vizualizează factura PDF"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>

                                {inv.hasNir && (
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      onViewNirPdf(inv);
                                    }}
                                    className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                    title={`Vizualizează Nota de Recepție (NIR: ${inv.nirNumber})`}
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* 2. BANDA INTERMEDIARĂ: DOCUMENT SELECTAT */}
              <div className="bg-[#f2f2f7]/75 dark:bg-[#2c2c2e]/65 px-3 py-1.5 flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0 text-[12px] flex-wrap">
                <input
                  type="text"
                  readOnly
                  value={selectedNrInt}
                  title="Număr intern"
                  className="apple-input w-24 h-7 px-2 text-[12px] tabular-nums"
                />
                <input
                  type="text"
                  readOnly
                  value={selectedNrDoc}
                  title="Număr document furnizor"
                  className="apple-input w-36 h-7 px-2.5 text-[12px] tabular-nums font-semibold"
                />
                <input
                  type="text"
                  readOnly
                  value={selectedCod}
                  title="Cod partener SAGA"
                  className="apple-input w-20 h-7 px-2 text-[12px] tabular-nums text-center"
                />
                <input
                  type="text"
                  readOnly
                  value={selectedPartner}
                  title="Denumire partener"
                  className="apple-input flex-1 min-w-[160px] max-w-[380px] h-7 px-2.5 text-[12px] truncate"
                />

                {selectedInvoice && (
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onViewInvoicePdf(selectedInvoice)}
                      className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                      title="Deschide factura fiscală PDF (Enter)"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
                      <span>Factură PDF</span>
                    </button>

                    {selectedInvoice.hasNir && (
                      <button
                        type="button"
                        onClick={() => onViewNirPdf(selectedInvoice)}
                        className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                        title={`Deschide fișa NIR atașată (${selectedInvoice.nirNumber}) (tasta N)`}
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>NIR: {selectedInvoice.nirNumber}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 3. BARA DE INSTRUMENTE POZIȚII */}
              <div className="bg-[#fafafa]/80 dark:bg-white/[0.02] px-3 py-1.5 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.07] shrink-0 text-[12px] flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Adaug
                  </button>
                  <button
                    type="button"
                    className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Modific
                  </button>
                  <button
                    type="button"
                    className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Sterg
                  </button>

                  <span className="w-px h-4 bg-black/10 dark:bg-white/10 mx-0.5" />

                  <button
                    type="button"
                    className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                    title="Caută în poziții"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                    title="Filtru linii"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="apple-btn-glass px-2.5 h-7 tabular-nums font-bold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer text-[11.5px]"
                    title="Calculator"
                  >
                    fx
                  </button>

                  <button
                    type="button"
                    className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Serii &gt;&gt;
                  </button>
                  <button
                    type="button"
                    className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Prețuri vânzare &gt;&gt;
                  </button>

                  {selectedInvoice?.hasNir && (
                    <button
                      type="button"
                      onClick={() => onViewNirPdf(selectedInvoice)}
                      className="apple-btn-glass px-3 h-7 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                    >
                      Bon de consum...
                    </button>
                  )}

                  <button
                    type="button"
                    className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Facturi asociate (transport)...
                  </button>
                </div>

                <button
                  type="button"
                  className="apple-btn-glass px-2.5 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                >
                  Detalii
                </button>
              </div>

              {/* 4. GRILA INFERIOARĂ: POZIȚII / LINII ARTICOLE */}
              <div className="h-[210px] xl:h-[240px] bg-white dark:bg-[#1c1c1e] overflow-auto shrink-0 border-b border-black/[0.06] dark:border-white/[0.08] relative">
                {isLinesLoading ? (
                  <div className="h-full flex items-center justify-center gap-2 text-[#6e6e73] dark:text-[#98989d] text-[13px] py-8">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Se încarcă articolele facturii...</span>
                  </div>
                ) : documentLines.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#6e6e73] dark:text-[#98989d] text-[12.5px] py-6">
                    <BookOpen className="w-5 h-5 mb-1.5 text-[#8e8e93]" />
                    <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      Factura este centralizată la nivel de antet fiscal.
                    </span>
                    <span className="text-[11.5px] mt-0.5">
                      Liniile detaliate sunt disponibile în fișierul PDF oficial (apăsați Tipărire / Enter) sau exportați XML SAGA.
                    </span>
                  </div>
                ) : (
                  <table className="w-full text-[12px]">
                    <thead className="sticky top-0 bg-[#fafafa] dark:bg-[#242426] text-[#6e6e73] dark:text-[#98989d] font-medium text-[11.5px] border-b border-black/[0.06] dark:border-white/[0.08] z-10 select-none">
                      <tr>
                        <th className="py-2 px-2.5 text-left w-28 font-medium">
                          Tip
                        </th>
                        <th className="py-2 px-2.5 text-left w-36 font-medium">
                          Gestiune
                        </th>
                        <th className="py-2 px-2.5 text-left font-medium">
                          Denumire articol / serviciu
                        </th>
                        <th className="py-2 px-2 text-center w-20 font-medium">
                          Cod
                        </th>
                        <th className="py-2 px-1.5 text-center w-12 font-medium">
                          UM
                        </th>
                        <th className="py-2 px-1.5 text-center w-12 font-medium">
                          TVA
                        </th>
                        <th className="py-2 px-2 text-right w-20 font-medium">
                          Cantitate
                        </th>
                        <th className="py-2 px-2 text-right w-24 font-medium">
                          Preț unitar
                        </th>
                        <th className="py-2 px-2.5 text-right w-24 font-medium">
                          Valoare
                        </th>
                        <th className="py-2 px-2.5 text-right w-24 font-medium">
                          Total
                        </th>
                        <th className="py-2 px-2 text-right w-20 font-medium">TVA</th>
                        <th className="py-2 px-2 text-right w-20 font-medium">
                          Nedeductibil
                        </th>
                        <th className="py-2 px-2 text-center w-16 font-medium">
                          Cont
                        </th>
                        <th className="py-2 px-2 text-right w-24 font-medium">
                          Preț vânzare
                        </th>
                        <th className="py-2 px-2 text-right w-20 font-medium">
                          Adaos unitar
                        </th>
                        <th className="py-2 px-1.5 text-center w-10 font-medium">
                          %
                        </th>
                        <th className="py-2 px-2.5 text-left w-36 font-medium">
                          Informații suplimentare
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                      {documentLines.map((line: any, idx: number) => {
                        const isSelectedLine = selectedLineIdx === idx;

                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedLineIdx(idx)}
                            className={`cursor-pointer transition-colors select-none ${
                              isSelectedLine
                                ? "bg-[#0071e3]/[0.10] dark:bg-[#0a84ff]/[0.20] text-[#1d1d1f] dark:text-white font-medium"
                                : "hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.04] text-[#1d1d1f] dark:text-[#f5f5f7]"
                            }`}
                          >
                            <td className="py-1.5 px-2.5 truncate max-w-[120px] text-[#6e6e73] dark:text-[#98989d]">
                              {line.type || "Materiale auxiliare"}
                            </td>
                            <td className="py-1.5 px-2.5 truncate max-w-[150px] text-[#6e6e73] dark:text-[#98989d]">
                              {line.gestiune || "Gestiune"}
                            </td>
                            <td
                              className="py-1.5 px-2.5 truncate max-w-[320px] font-medium"
                              title={line.description}
                            >
                              {line.description}
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {line.code || String(idx + 1).padStart(8, "0")}
                            </td>
                            <td className="py-1.5 px-1.5 text-center tabular-nums uppercase text-[#6e6e73] dark:text-[#98989d]">
                              {line.unit || "BUC"}
                            </td>
                            <td className="py-1.5 px-1.5 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {line.vatRate ? Math.round(line.vatRate) : "21"}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums">
                              {formatSagaQty(line.quantity)}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums">
                              {formatSagaUnitPrice(line.unitPrice)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaCurrency(
                                line.valoare ?? line.quantity * line.unitPrice
                              )}
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums font-semibold">
                              {formatSagaCurrency(line.total)}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                              {formatSagaCurrency(
                                line.tva ?? line.total - line.quantity * line.unitPrice
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-[#8e8e93]">
                              0,00
                            </td>
                            <td className="py-1.5 px-2 text-center tabular-nums font-semibold">
                              {line.account || "3028"}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-[#8e8e93]">
                              0,0000
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums text-[#8e8e93]">
                              0,00
                            </td>
                            <td className="py-1.5 px-1.5 text-center tabular-nums text-[#8e8e93]">
                              0
                            </td>
                            <td className="py-1.5 px-2.5 truncate max-w-[140px] text-[#6e6e73] dark:text-[#98989d]">
                              {line.infoSuplimentare || ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 5. BARA DE ACȚIUNI DIN SUBSOLUL FERESTREI */}
              <div className="bg-[#fafafa] dark:bg-white/[0.02] px-3 py-2 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.08] shrink-0 text-[12px] flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    className="apple-btn-glass flex items-center gap-1.5 px-3 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Validez</span>
                  </button>

                  <button
                    type="button"
                    className="apple-btn-glass px-3 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Plată...
                  </button>

                  <button
                    type="button"
                    className="apple-btn-glass px-3 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Stornez
                  </button>

                  <button
                    type="button"
                    className="apple-btn-glass px-3 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    N.C...
                  </button>

                  {selectedInvoice && (
                    <button
                      type="button"
                      onClick={() => onViewInvoicePdf(selectedInvoice)}
                      className="apple-btn-glass px-3 h-7 text-[11.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                      title="Tipărire document"
                    >
                      Tipărire...
                    </button>
                  )}

                  <button
                    type="button"
                    className="apple-btn-glass px-3 h-7 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  >
                    Devalidez
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onLockSession}
                  className="apple-btn-destructive-soft px-3.5 h-7 text-[11.5px] font-semibold cursor-pointer"
                  title="Ieșire din ecran"
                >
                  Ieșire
                </button>
              </div>
            </>
          )}
        </div>

        {/* STATUS BAR */}
        <div className="mt-2 px-1 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6e6e73] dark:text-[#98989d] select-none tabular-nums">
          <div className="flex items-center gap-2.5 flex-wrap">
            {subView === "partners_list" ? (
              <>
                <span>
                  Total {activeTab === "received" ? "furnizori" : "clienți"}:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {displayedPartners.length}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Bază:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {formatSagaCurrency(currentKpiData.totalBase)} RON
                  </strong>
                </span>
                <span>·</span>
                <span>
                  TVA:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {formatSagaCurrency(currentKpiData.totalVat)} RON
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Total rulaj:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {formatSagaCurrency(currentKpiData.totalGross)} RON
                  </strong>
                </span>
              </>
            ) : selectedPartnerKey && selectedPartnerObj ? (
              <>
                <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Dosar {activeTab === "received" ? "furnizor" : "client"}:{" "}
                  {selectedPartnerObj.name}
                </span>
                <span>·</span>
                <span>
                  Documente:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {activeInvoices.length}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Bază:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {formatSagaCurrency(selectedPartnerObj.totalBase)} RON
                  </strong>
                </span>
                <span>·</span>
                <span>
                  TVA:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {formatSagaCurrency(selectedPartnerObj.totalVat)} RON
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Total:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {formatSagaCurrency(selectedPartnerObj.totalGross)} RON
                  </strong>
                </span>
              </>
            ) : (
              <>
                <span>
                  Total documente:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {currentKpiData.totalCount}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Bază:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {formatSagaCurrency(currentKpiData.totalBase)} RON
                  </strong>
                </span>
                <span>·</span>
                <span>
                  TVA:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {formatSagaCurrency(currentKpiData.totalVat)} RON
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Total general:{" "}
                  <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {formatSagaCurrency(currentKpiData.totalGross)} RON
                  </strong>
                </span>
                {activeTab === "received" && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      NIR-uri:{" "}
                      <strong>
                        {currentKpis.withNirCount} / {currentKpis.totalCount} (
                        {currentKpis.nirCoveragePercent}%)
                      </strong>
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#8e8e93]">
            <span className="hidden lg:inline">
              {subView === "partners_list"
                ? "[↑]/[↓] navigare · [Enter] intră în dosar · [Esc] revenire"
                : selectedPartnerKey
                  ? "[Esc] listă parteneri · [Enter] factură · [N] NIR"
                  : "[↑]/[↓] navigare · [Enter] factură · [N] NIR"}
            </span>
          </div>
        </div>
      </div>

      {/* MODAL e-FACTURA SPV ANAF */}
      {showSpvModal && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-3 backdrop-blur-sm overscroll-contain">
          <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] shadow-2xl rounded-[20px] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-[#1d1d1f] dark:text-[#f5f5f7] font-sans text-[12.5px]">
            {/* Header Modal SPV */}
            <div className="bg-[#fafafa] dark:bg-white/[0.02] px-5 py-3.5 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-[10px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-[#0071e3] dark:text-[#0a84ff]" />
                </span>
                <span className="font-bold text-[15px] truncate">
                  e-Factura SPV — Preluare și management mesaje ANAF (
                  {company.name || "Societate"})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSpvModal(false)}
                aria-label="Închide fereastra"
                className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer shrink-0"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Bara de status conexiune SPV & Buton Sincronizare Live */}
            <div className="bg-[#f2f2f7]/65 dark:bg-[#2c2c2e]/50 border-b border-black/[0.06] dark:border-white/[0.08] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Conexiune SPV ANAF activă
                  </span>
                  {spvStats?.tokenExpiresAt && (
                    <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                      (expiră {formatSagaDate(spvStats.tokenExpiresAt)})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                  <span>
                    Primite:{" "}
                    <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {spvStats?.totalReceived || 0}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Validate:{" "}
                    <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {spvStats?.validatedEmitted || 0}
                    </strong>
                  </span>
                  {(spvStats?.errorsCount || 0) > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-[#ff3b30] dark:text-[#ff453a] font-semibold">
                        Erori: <strong>{spvStats?.errorsCount}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={testSpvMutation.isPending}
                  onClick={() => testSpvMutation.mutate({ token, sessionToken })}
                  className="apple-btn-glass flex items-center gap-1.5 px-3.5 h-8 text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] disabled:opacity-50 cursor-pointer"
                >
                  <Wifi
                    className={`w-3.5 h-3.5 ${
                      testSpvMutation.isPending
                        ? "animate-pulse text-amber-500"
                        : spvTestResult?.connected
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-[#6e6e73] dark:text-[#98989d]"
                    }`}
                  />
                  <span>
                    {testSpvMutation.isPending
                      ? "Testare conexiune..."
                      : "Testează conexiunea SPV"}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={syncSpvMutation.isPending}
                  onClick={() =>
                    syncSpvMutation.mutate({ token, sessionToken, zile: 60 })
                  }
                  className="apple-btn-prominent flex items-center gap-1.5 px-3.5 h-8 text-white font-semibold text-[12px] disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      syncSpvMutation.isPending ? "animate-spin" : ""
                    }`}
                  />
                  <span>
                    {syncSpvMutation.isPending
                      ? "Se descarcă din SPV..."
                      : "Sincronizează cu SPV ANAF acum"}
                  </span>
                </button>
              </div>
            </div>

            {spvTestResult && (
              <div
                className={`px-4 py-2 text-[12px] flex items-center justify-between border-b ${
                  spvTestResult.connected
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : "bg-[#ff3b30]/10 text-[#d70015] dark:text-[#ff6961] border-[#ff3b30]/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">
                    {spvTestResult.connected
                      ? "✓ Conexiune SPV activă"
                      : "✕ Eroare conexiune SPV"}
                    :
                  </span>
                  <span>{spvTestResult.message}</span>
                </div>
                <div className="flex items-center gap-3 text-[11.5px] tabular-nums">
                  {spvTestResult.cui && (
                    <span>
                      CUI: <strong>{spvTestResult.cui}</strong>
                    </span>
                  )}
                  {spvTestResult.latencyMs != null && (
                    <span>
                      Latență: <strong>{spvTestResult.latencyMs} ms</strong>
                    </span>
                  )}
                  {spvTestResult.tokenDaysRemaining != null && (
                    <span>
                      Token valid:{" "}
                      <strong>{spvTestResult.tokenDaysRemaining} zile</strong>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSpvTestResult(null)}
                    className="opacity-70 hover:opacity-100 font-bold ml-2 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Filtre și căutare în mesajele SPV */}
            <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <div className="apple-segmented">
                <button
                  type="button"
                  data-active={spvTabFilter === "all"}
                  onClick={() => setSpvTabFilter("all")}
                  className="apple-segmented-item px-3 tabular-nums"
                >
                  Toate mesajele ({spvMessages.length})
                </button>
                <button
                  type="button"
                  data-active={spvTabFilter === "in"}
                  onClick={() => setSpvTabFilter("in")}
                  className="apple-segmented-item px-3 tabular-nums"
                >
                  Primite din SPV ({spvStats?.totalReceived || 0})
                </button>
                <button
                  type="button"
                  data-active={spvTabFilter === "out"}
                  onClick={() => setSpvTabFilter("out")}
                  className="apple-segmented-item px-3 tabular-nums"
                >
                  Emise în SPV ({spvStats?.totalEmitted || 0})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={spvSearchQuery}
                  onChange={e => setSpvSearchQuery(e.target.value)}
                  placeholder="Caută index, CUI, partener, număr..."
                  style={{ paddingLeft: 32, paddingRight: 12 }}
                  className="apple-pill-control rounded-full h-[32px] w-64 text-[12.5px] outline-none"
                />
              </div>
            </div>

            {/* Tabelul de Mesaje SPV */}
            <div className="flex-1 overflow-auto min-h-[280px] overscroll-contain">
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 bg-[#fafafa] dark:bg-[#242426] text-[#6e6e73] dark:text-[#98989d] border-b border-black/[0.06] dark:border-white/[0.08] font-medium z-10 select-none">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-20 font-medium">Tip</th>
                    <th className="py-2.5 px-3 text-center w-32 font-medium">
                      ID încărcare SPV
                    </th>
                    <th className="py-2.5 px-3 text-left w-36 font-medium">
                      Număr document
                    </th>
                    <th className="py-2.5 px-3 text-left font-medium">Partener</th>
                    <th className="py-2.5 px-3 text-left w-28 font-medium">
                      CUI / CIF
                    </th>
                    <th className="py-2.5 px-3 text-center w-24 font-medium">
                      Dată
                    </th>
                    <th className="py-2.5 px-3 text-right w-28 font-medium">
                      Valoare
                    </th>
                    <th className="py-2.5 px-3 text-center w-28 font-medium">
                      Stare ANAF
                    </th>
                    <th className="py-2.5 px-3 text-center w-24 font-medium">
                      Doc. atașat
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
                  {filteredSpvMessages.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-12 text-center text-[#6e6e73] dark:text-[#98989d]"
                      >
                        Nu s-au găsit mesaje SPV conform criteriilor selectate.
                      </td>
                    </tr>
                  ) : (
                    filteredSpvMessages.map((msg: any) => (
                      <tr
                        key={msg.id}
                        className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                      >
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10.5px] font-medium rounded-full ${
                              msg.direction === "in"
                                ? "bg-amber-500/10 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300"
                                : "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300"
                            }`}
                          >
                            {msg.direction === "in" ? "Intrare" : "Ieșire"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center tabular-nums font-medium text-[#6e6e73] dark:text-[#98989d]">
                          {msg.spvIndex || "—"}
                        </td>
                        <td className="py-2 px-3 tabular-nums font-semibold truncate max-w-[140px]">
                          {msg.invoiceNumber}
                        </td>
                        <td
                          className="py-2 px-3 truncate max-w-[260px]"
                          title={msg.partnerName}
                        >
                          {msg.partnerName}
                        </td>
                        <td className="py-2 px-3 tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                          {msg.partnerCui || "—"}
                        </td>
                        <td className="py-2 px-3 text-center tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                          {formatSagaDate(msg.issueDate)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-semibold">
                          {formatSagaCurrency(msg.total)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {msg.status === "eroare" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ff3b30]/10 text-[#d70015] dark:bg-[#ff453a]/18 dark:text-[#ff6961] font-medium text-[11px]">
                              <XCircle className="w-3 h-3" />
                              <span>Eroare</span>
                            </span>
                          ) : msg.status === "in_procesare" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300 font-medium text-[11px]">
                              <span>În procesare</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 font-medium text-[11px]">
                              <CheckCircle className="w-3 h-3" />
                              <span>Validat</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {msg.pdfUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowSpvModal(false);
                                  onViewInvoicePdf({
                                    id: msg.originalId,
                                    invoiceNumber: msg.invoiceNumber,
                                    supplierName: msg.partnerName,
                                    clientName: msg.partnerName,
                                    pdfUrl: msg.pdfUrl,
                                  });
                                }}
                                className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                                title="Vizualizează factura fiscală PDF"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {msg.hasNir && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowSpvModal(false);
                                  onViewNirPdf({
                                    id: msg.originalId,
                                    nirId: msg.nirId,
                                    nirNumber: msg.nirNumber,
                                    supplierName: msg.partnerName,
                                  });
                                }}
                                className="w-7 h-7 rounded-full apple-btn-glass flex items-center justify-center text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                title={`Vizualizează Nota de Recepție (NIR: ${msg.nirNumber})`}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Modal SPV */}
            <div className="bg-[#fafafa] dark:bg-white/[0.02] px-5 py-3 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.08] shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={onDownloadSagaXml}
                className="apple-btn-glass flex items-center gap-1.5 px-3.5 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[12.5px] rounded-full cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportă fișierul XML compatibil SAGA C v3.0</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSpvModal(false)}
                className="apple-btn-glass px-4 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[12.5px] rounded-full cursor-pointer"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALERTE ACTIVE SPV ANAF & CONTABILITATE */}
      {showAlertsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 flex items-center justify-center p-3 backdrop-blur-sm overscroll-contain">
          <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] shadow-2xl rounded-[20px] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-[#1d1d1f] dark:text-[#f5f5f7] font-sans text-[12.5px]">
            <div className="bg-[#fafafa] dark:bg-white/[0.02] px-5 py-3.5 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-[10px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </span>
                <span className="font-bold text-[15px]">
                  Alerte active — SPV ANAF & Contabilitate ({realAlerts.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAlertsModal(false)}
                aria-label="Închide fereastra"
                className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2.5 overscroll-contain">
              {realAlerts.length === 0 ? (
                <div className="p-8 text-center text-[#6e6e73] dark:text-[#98989d] bg-[#f2f2f7]/50 dark:bg-[#2c2c2e]/40 rounded-2xl border border-black/[0.05] dark:border-white/[0.07]">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                  <div className="font-bold text-[14px] text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Nu există erori sau alerte active
                  </div>
                  <div className="text-[12.5px] mt-1">
                    Toate facturile transmise sunt validate în SPV ANAF, iar recepțiile NIR sunt conforme.
                  </div>
                </div>
              ) : (
                realAlerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-2xl border text-[12.5px] leading-relaxed ${
                      alert.severity === "error"
                        ? "bg-[#ff3b30]/10 border-[#ff3b30]/20 text-[#1d1d1f] dark:text-[#f5f5f7]"
                        : "bg-amber-500/10 border-amber-500/20 text-[#1d1d1f] dark:text-[#f5f5f7]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        {alert.severity === "error" ? (
                          <XCircle className="w-4 h-4 text-[#ff3b30] dark:text-[#ff453a] shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold text-[13px]">{alert.title}</div>
                          <div className="mt-1 text-[#6e6e73] dark:text-[#98989d] whitespace-pre-wrap text-[12px]">
                            {alert.description}
                          </div>

                          <div className="mt-2 flex items-center gap-3 tabular-nums text-[11.5px] text-[#6e6e73] dark:text-[#98989d] flex-wrap">
                            <span>
                              Document:{" "}
                              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                                {alert.docNumber}
                              </strong>
                            </span>
                            {alert.spvIndex && (
                              <span>
                                Index SPV:{" "}
                                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                                  {alert.spvIndex}
                                </strong>
                              </span>
                            )}
                            {alert.amount !== undefined && (
                              <span>
                                Valoare:{" "}
                                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">
                                  {formatSagaCurrency(alert.amount)} RON
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {alert.type === "spv_error" && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAlertsModal(false);
                            setShowSpvModal(true);
                          }}
                          className="apple-btn-destructive-soft px-3 h-7 font-semibold text-[11.5px] shrink-0 cursor-pointer"
                        >
                          Verifică în SPV
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-[#fafafa] dark:bg-white/[0.02] px-5 py-3 flex items-center justify-end border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <button
                type="button"
                onClick={() => setShowAlertsModal(false)}
                className="apple-btn-glass px-4 h-9 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[12.5px] rounded-full cursor-pointer"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXTRASE DE CONT BANCARE (SAGA CLASIC) */}
      {showStatementsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overscroll-contain"
          onClick={e => {
            if (e.target === e.currentTarget) setShowStatementsModal(false);
          }}
        >
          <div className="bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[22px] shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden overscroll-contain">
            <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-[10px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
                  <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </span>
                <div>
                  <h3 className="text-[15.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Extrase de cont bancare ({filteredSagaStatements.length})
                  </h3>
                  <p className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d]">
                    Fișiere originale încărcate de administrator pentru înregistrare contabilă
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select value={stmtMonthFilter} onValueChange={setStmtMonthFilter}>
                  <SelectTrigger className="apple-pill-control h-8 w-auto min-w-[140px] px-3 text-[12px]">
                    <SelectValue placeholder="Toate lunile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toate lunile</SelectItem>
                    {stmtMonths.map(m => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {onDownloadStatementsZip && filteredSagaStatements.length > 0 && (
                  <button
                    type="button"
                    onClick={onDownloadStatementsZip}
                    className="apple-btn-prominent h-8 px-3.5 rounded-full text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>Descarcă ZIP</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowStatementsModal(false)}
                  className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] cursor-pointer"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {filteredSagaStatements.length === 0 ? (
                <div className="py-14 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                  Nu există extrase de cont încărcate pentru această selecție.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-[12.5px]">
                  <thead className="bg-[#fafafa] dark:bg-white/[0.03] border-b border-black/[0.06] dark:border-white/[0.08]">
                    <tr>
                      <th className="px-4 py-2.5 font-medium text-[#6e6e73] dark:text-[#98989d]">Lună</th>
                      <th className="px-4 py-2.5 font-medium text-[#6e6e73] dark:text-[#98989d]">Bancă / IBAN</th>
                      <th className="px-4 py-2.5 font-medium text-[#6e6e73] dark:text-[#98989d]">Fișier</th>
                      <th className="px-4 py-2.5 text-right font-medium text-[#6e6e73] dark:text-[#98989d]">Sold final</th>
                      <th className="px-4 py-2.5 text-right font-medium text-[#6e6e73] dark:text-[#98989d]">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                    {filteredSagaStatements.map((st: any) => {
                      const isPdf = String(st.fileType || "").toLowerCase() === "pdf";
                      return (
                        <tr key={st.id} className="hover:bg-[#f5f5f7] dark:hover:bg-white/[0.04]">
                          <td className="px-4 py-2.5 font-semibold tabular-nums whitespace-nowrap">
                            {st.statementMonth}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                              {st.bankName} ({st.currency})
                            </div>
                            {st.iban && (
                              <div className="text-[11px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
                                {st.iban}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 max-w-[240px] truncate" title={st.fileName}>
                            {st.fileName}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
                            {st.closingBalance !== null && st.closingBalance !== undefined
                              ? `${formatSagaCurrency(st.closingBalance)} ${st.currency}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {isPdf && onViewStatementPdf && (
                                <button
                                  type="button"
                                  onClick={() => onViewStatementPdf(st)}
                                  className="apple-btn-glass w-7 h-7 rounded-full inline-flex items-center justify-center cursor-pointer"
                                  title="Previzualizează PDF"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDownloadStatement && (
                                <button
                                  type="button"
                                  onClick={() => onDownloadStatement(st)}
                                  className="apple-btn-glass w-7 h-7 rounded-full inline-flex items-center justify-center cursor-pointer"
                                  title="Descarcă fișier"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
