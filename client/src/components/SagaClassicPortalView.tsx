import { useState, useMemo, useEffect } from "react";
import {
  FileText,
  FileOutput,
  Download,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Package,
  Lock,
  Copy,
  Check,
  Loader2,
  Eye,
  FolderArchive,
  BookOpen,
  Printer,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Folder,
  Minus,
  Square,
  X as CloseIcon,
  LogOut,
  SlidersHorizontal,
  Calculator,
  Globe,
  AlertTriangle,
  RefreshCw,
  XCircle,
  CheckCircle,
  ShieldCheck,
  ExternalLink,
  Building2,
  Users,
  ArrowLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SagaClassicPortalViewProps {
  portalData: any;
  token: string;
  sessionToken: string;
  activeTab: "received" | "emitted";
  setActiveTab: (tab: "received" | "emitted") => void;

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
  const yearSuffix = !isNaN(d.getTime()) ? String(d.getFullYear()).slice(-2) : "26";
  const numPad = String(inv.id || 1).padStart(6, "0");
  return `${yearSuffix}${numPad}`;
}

function getSagaPartnerCode(partnerCui?: string | null, partnerId?: number | null): string {
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
  supplierFilter,
  setSupplierFilter,
  allSuppliers,
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
}: SagaClassicPortalViewProps) {
  // Factura selectată în grila de sus
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
  const [copiedCui, setCopiedCui] = useState<string | null>(null);

  // Modale SPV & Alerte (Date 100% reale, fără mock)
  const [showSpvModal, setShowSpvModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [spvTabFilter, setSpvTabFilter] = useState<"all" | "in" | "out">("all");
  const [spvSearchQuery, setSpvSearchQuery] = useState("");

  const trpcUtils = trpc.useUtils ? trpc.useUtils() : (trpc as any).useContext();

  // Mutație sincronizare live SPV ANAF
  const syncSpvMutation = trpc.accountantPortal.syncSpv.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Sincronizare SPV ANAF finalizată cu succes! S-au descărcat ${res.imported} facturi noi.`
      );
      trpcUtils.accountantPortal.getPortalData.invalidate();
    },
    onError: (err) => {
      toast.error(`Eroare comunicare SPV ANAF: ${err.message}`);
    },
  });

  // ─── NAVIGARE SEPARATĂ PE FURNIZORI ȘI CLIENȚI (SITUAȚIE PARTENERI) ───
  // Mod sub-vizualizare: "all_invoices" | "partners_list"
  const [subView, setSubView] = useState<"all_invoices" | "partners_list">("all_invoices");
  // Partener selectat curent pentru dosar/fișă (null = toți partenerii)
  const [selectedPartnerKey, setSelectedPartnerKey] = useState<string | null>(null);
  // Partener evidențiat în tabelul director de parteneri
  const [selectedPartnerIdInList, setSelectedPartnerIdInList] = useState<string | null>(null);
  // Căutare în lista de parteneri
  const [partnerSearch, setPartnerSearch] = useState<string>("");
  // Sortare în lista de parteneri: "count_desc" | "total_desc" | "name_asc"
  const [partnerSort, setPartnerSort] = useState<"count_desc" | "total_desc" | "name_asc">("count_desc");

  // Resetare selecție la comutarea tab-ului (Furnizori/Intrări <-> Clienți/Ieșiri)
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
      if (inv.issueDate && (!existing.latestInvoiceDate || inv.issueDate > existing.latestInvoiceDate)) {
        existing.latestInvoiceDate = inv.issueDate;
      }
      existing.invoices.push(inv);
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.invoiceCount - a.invoiceCount || b.totalGross - a.totalGross);
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
      if (inv.issueDate && (!existing.latestInvoiceDate || inv.issueDate > existing.latestInvoiceDate)) {
        existing.latestInvoiceDate = inv.issueDate;
      }
      existing.invoices.push(inv);
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.invoiceCount - a.invoiceCount || b.totalGross - a.totalGross);
    return list;
  }, [portalData?.emittedInvoices]);

  // Parteneri afișați în tabelul director (după căutare și sortare)
  const displayedPartners = useMemo(() => {
    const baseList = activeTab === "received" ? suppliersSummary : clientsSummary;
    let list = baseList;

    if (partnerSearch.trim()) {
      const q = partnerSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.cui.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    if (partnerSort === "count_desc") {
      sorted.sort((a, b) => b.invoiceCount - a.invoiceCount || b.totalGross - a.totalGross);
    } else if (partnerSort === "total_desc") {
      sorted.sort((a, b) => b.totalGross - a.totalGross || b.invoiceCount - a.invoiceCount);
    } else if (partnerSort === "name_asc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "ro"));
    }
    return sorted;
  }, [activeTab, suppliersSummary, clientsSummary, partnerSearch, partnerSort]);

  // Obiectul complet al partenerului selectat
  const selectedPartnerObj = useMemo(() => {
    if (!selectedPartnerKey) return null;
    const list = activeTab === "received" ? suppliersSummary : clientsSummary;
    return list.find((p) => p.key === selectedPartnerKey) || null;
  }, [activeTab, suppliersSummary, clientsSummary, selectedPartnerKey]);

  // Facturile active în tabel — filtrate după partener dacă s-a intrat pe un furnizor/client anume
  const activeInvoices = useMemo(() => {
    const base = activeTab === "received" ? filteredInvoices : filteredEmittedInvoices;
    if (!selectedPartnerKey) return base;

    return base.filter((inv) => {
      const cui = (activeTab === "received" ? inv.supplierCUI : inv.clientCUI) || "";
      const name = (activeTab === "received" ? inv.supplierName : inv.clientName) || "";
      const key = cui.trim() || name.trim().toLowerCase();
      return key === selectedPartnerKey;
    });
  }, [activeTab, filteredInvoices, filteredEmittedInvoices, selectedPartnerKey]);

  // Asigurăm că avem mereu o factură selectată
  useEffect(() => {
    if (activeInvoices.length > 0) {
      if (!selectedInvoiceId || !activeInvoices.some((i) => i.id === selectedInvoiceId)) {
        setSelectedInvoiceId(activeInvoices[0].id);
      }
    } else {
      setSelectedInvoiceId(null);
    }
  }, [activeInvoices, selectedInvoiceId]);

  // Factura selectată curent
  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return activeInvoices[0] || null;
    return activeInvoices.find((i) => i.id === selectedInvoiceId) || activeInvoices[0] || null;
  }, [activeInvoices, selectedInvoiceId]);

  // Menținem partenerul selectat în tabelul de situație
  useEffect(() => {
    if (displayedPartners.length > 0) {
      if (!selectedPartnerIdInList || !displayedPartners.some((p) => p.key === selectedPartnerIdInList)) {
        setSelectedPartnerIdInList(displayedPartners[0].key);
      }
    } else {
      setSelectedPartnerIdInList(null);
    }
  }, [displayedPartners, selectedPartnerIdInList]);

  // Partenerul evidențiat în modul Situație
  const highlightedPartnerInList = useMemo(() => {
    if (!selectedPartnerIdInList) return displayedPartners[0] || null;
    return displayedPartners.find((p) => p.key === selectedPartnerIdInList) || displayedPartners[0] || null;
  }, [displayedPartners, selectedPartnerIdInList]);

  // Query pentru liniile/pozițiile facturii selectate
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

  // Copiere CUI
  const handleCopyCui = (cui: string) => {
    if (!cui) return;
    navigator.clipboard.writeText(cui.replace(/^RO/i, "").trim());
    setCopiedCui(cui);
    toast.success(`CUI ${cui} copiat în clipboard!`);
    setTimeout(() => setCopiedCui(null), 2000);
  };

  // Navigare prin tastatură (Săgeți Sus/Jos pentru facturi/parteneri, Enter pentru deschidere, Esc pentru revenire, N pentru NIR)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Tasta Escape: ieșire din dosar partener sau din situația de parteneri
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

      // Navigare în lista de parteneri
      if (subView === "partners_list") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const idx = displayedPartners.findIndex((p) => p.key === selectedPartnerIdInList);
          if (idx >= 0 && idx < displayedPartners.length - 1) {
            setSelectedPartnerIdInList(displayedPartners[idx + 1].key);
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const idx = displayedPartners.findIndex((p) => p.key === selectedPartnerIdInList);
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

      // Navigare în lista de facturi
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = activeInvoices.findIndex((i) => i.id === selectedInvoiceId);
        if (idx >= 0 && idx < activeInvoices.length - 1) {
          setSelectedInvoiceId(activeInvoices[idx + 1].id);
          setSelectedLineIdx(0);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = activeInvoices.findIndex((i) => i.id === selectedInvoiceId);
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
  const currentKpiData = activeTab === "received" ? currentKpis : currentEmittedKpis;

  // Date REALE din SPV ANAF preluate direct din backend (fără niciun mock)
  const spvStats = portalData?.spvStats;
  const realSpvCount =
    spvStats?.totalReceived ??
    portalData?.invoices?.filter((i: any) => i.source === "spv_anaf" || Boolean(i.spvIndex)).length ??
    0;
  const realAlertsCount = spvStats?.alertsCount ?? (spvStats?.errorsCount || 0);
  const realAlerts = spvStats?.alerts || [];
  const spvMessages = spvStats?.messages || [];

  // Filtrare mesaje SPV în modal
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

  // Câmpuri document selectat pentru banda intermediară SAGA
  const selectedNrInt = selectedInvoice ? getSagaInternalNumber(selectedInvoice) : "";
  const selectedNrDoc = selectedInvoice?.invoiceNumber || "";
  const selectedCod = selectedInvoice
    ? getSagaPartnerCode(
        activeTab === "received" ? selectedInvoice.supplierCUI : selectedInvoice.clientCUI,
        selectedInvoice.id
      )
    : "";
  const selectedPartner =
    (activeTab === "received" ? selectedInvoice?.supplierName : selectedInvoice?.clientName) || "";

  return (
    <div
      className="min-h-screen bg-[#007897] text-black flex flex-col select-none antialiased"
      style={{
        fontFamily: "'Segoe UI', Tahoma, Verdana, Arial, sans-serif",
      }}
    >
      {/* ═════════════════════════════════════════════════════════════════════════
          1. BARA DE MENIU SAGA C (TOP APPLICATION MENU BAR)
      ═════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-[#ECE9D8] text-black px-2 py-0.5 flex items-center justify-between border-b border-[#999999] text-[11px] shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-tight text-slate-900">
            SAGA C.3.0.605 &nbsp; S.C. {company.name ? company.name.toUpperCase() : "FIRMA"} S.R.L. · {company.cui || "CUI"} (client)
          </span>

          <span className="w-px h-3.5 bg-[#B0B0B0]" />

          {/* Meniuri clasice SAGA */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-800">
            <span
              onClick={() => {
                setActiveTab("received");
                setSubView("partners_list");
                setSelectedPartnerKey(null);
              }}
              className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs transition-colors"
              title="Deschide lista și situația centralizată a furnizorilor"
            >
              Fișiere: Furnizori
            </span>
            <span
              onClick={() => {
                setActiveTab("emitted");
                setSubView("partners_list");
                setSelectedPartnerKey(null);
              }}
              className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs transition-colors"
              title="Deschide lista și situația centralizată a clienților"
            >
              Fișiere: Clienți
            </span>
            <span
              onClick={() => {
                setActiveTab("received");
                setSubView("all_invoices");
                setSelectedPartnerKey(null);
              }}
              className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs transition-colors"
              title="Deschide ecranul clasic de Intrări (facturi & recepții NIR)"
            >
              Operații: Intrări
            </span>
            <span
              onClick={() => {
                setActiveTab("emitted");
                setSubView("all_invoices");
                setSelectedPartnerKey(null);
              }}
              className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs transition-colors"
              title="Deschide ecranul clasic de Ieșiri (facturi emise către clienți)"
            >
              Operații: Ieșiri
            </span>
            <span
              onClick={() => {
                setSubView("partners_list");
                setSelectedPartnerKey(null);
              }}
              className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs transition-colors font-semibold text-blue-900"
              title="Deschide Situația pe parteneri"
            >
              Situații: {activeTab === "received" ? "Furnizori" : "Clienți"}
            </span>
          </div>

          <span className="hidden lg:inline text-[10.5px] text-slate-600 font-mono">
            Interval (01.01.2025 - 31.12.2026)
          </span>
        </div>

        {/* Zona Dreapta: e-Facturi și Alerte REALE DIN SPV ANAF (FĂRĂ MOCK) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSpvModal(true)}
            className="hidden sm:inline-flex items-center gap-1 text-blue-800 underline text-[11px] cursor-pointer hover:text-blue-950 font-medium bg-transparent border-0 p-0"
            title="Deschide ecranul e-Factura SPV ANAF cu mesajele descărcate și sincronizare live"
          >
            <span>e-Facturi ({realSpvCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAlertsModal(true)}
            className={`hidden sm:inline-flex items-center gap-1 underline text-[11px] cursor-pointer font-medium bg-transparent border-0 p-0 ${
              (spvStats?.errorsCount || 0) > 0
                ? "text-red-700 font-bold hover:text-red-900"
                : "text-blue-800 hover:text-blue-950"
            }`}
            title="Deschide ecranul cu alerte contabile și erori reale de validare din SPV ANAF"
          >
            <span>Alerte ({realAlertsCount})</span>
          </button>

          <span className="w-px h-3.5 bg-[#B0B0B0]" />

          <button
            type="button"
            onClick={onSwitchToModern}
            className="flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#FFF2B2] hover:bg-[#FFE580] text-slate-900 text-[10.5px] font-bold border border-[#C5A028] shadow-2xs cursor-pointer transition-colors"
            title="Comută la vederea modernă web (cu carduri și grafice)"
          >
            <Sparkles className="w-3 h-3 text-amber-700" />
            <span>Comută la Mod Modern</span>
          </button>

          <button
            type="button"
            onClick={onLockSession}
            className="flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[#E2E2E2] hover:bg-[#D5D5D5] text-slate-800 text-[10.5px] font-medium border border-[#999999] cursor-pointer"
            title="Închide sesiunea de acces contabil"
          >
            <LogOut className="w-3 h-3 text-red-600" />
            <span>Ieșire</span>
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          2. SPAȚIUL DE LUCRU DESKTOP SAGA CU FEREASTRĂ INTERIOARĂ (MDI CHILD)
      ═════════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 p-2 md:p-3 flex flex-col min-h-0 overflow-hidden">
        {/* Fereastra MDI: Intrări / Ieșiri */}
        <div className="flex-1 flex flex-col bg-[#ECE9D8] border border-[#0055EA] rounded-t-sm shadow-2xl overflow-hidden min-h-0">
          
          {/* ── BARA DE TITLU A FERESTREI SAGA C ── */}
          <div className="bg-gradient-to-r from-[#0055EA] via-[#103869] to-[#2B609E] text-white px-2 py-1 flex items-center justify-between border-b border-[#003B99] shrink-0">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-cyan-300 fill-cyan-400" />
              <span className="font-bold text-[11.5px] tracking-wide">
                {subView === "partners_list"
                  ? (activeTab === "received" ? "Situatie Furnizori (Lista parteneri)" : "Situatie Clienti (Lista parteneri)")
                  : selectedPartnerKey
                  ? `${activeTab === "received" ? "Intrari Furnizor" : "Iesiri Client"}: ${selectedPartnerObj?.name || selectedPartnerKey}`
                  : (activeTab === "received" ? "Intrari (facturi & bonuri de casa & avize)" : "Iesiri (facturi & bonuri de casa & avize)")}
              </span>
            </div>

            {/* Butoane comutare Furnizori / Clienți + Mod Situație */}
            <div className="flex items-center gap-2">
              {/* Secțiune: Furnizori (Intrări) vs Clienți (Ieșiri) */}
              <div className="flex items-center bg-black/25 p-0.5 rounded border border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("received");
                    setSelectedPartnerKey(null);
                  }}
                  className={`px-2 py-0.5 text-[10.5px] font-bold rounded-xs transition-all cursor-pointer ${
                    activeTab === "received"
                      ? "bg-[#FFFFEB] text-slate-950 shadow-xs"
                      : "text-white/80 hover:text-white"
                  }`}
                  title="Facturi primite de la furnizori și recepții NIR"
                >
                  Furnizori (Intrări) ({portalData?.invoices?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("emitted");
                    setSelectedPartnerKey(null);
                  }}
                  className={`px-2 py-0.5 text-[10.5px] font-bold rounded-xs transition-all cursor-pointer ${
                    activeTab === "emitted"
                      ? "bg-[#FFFFEB] text-slate-950 shadow-xs"
                      : "text-white/80 hover:text-white"
                  }`}
                  title="Facturi emise către clienți"
                >
                  Clienți (Ieșiri) ({portalData?.emittedInvoices?.length || 0})
                </button>
              </div>

              {/* Sub-mod: Toate Facturile vs Situație pe Furnizori/Clienți */}
              <div className="flex items-center bg-black/25 p-0.5 rounded border border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setSubView("all_invoices");
                    setSelectedPartnerKey(null);
                  }}
                  className={`px-2 py-0.5 text-[10.5px] font-semibold rounded-xs transition-all cursor-pointer ${
                    subView === "all_invoices" && !selectedPartnerKey
                      ? "bg-[#FFFFEB] text-slate-950 shadow-xs font-bold"
                      : "text-white/80 hover:text-white"
                  }`}
                  title="Vezi lista tabelară a tuturor facturilor"
                >
                  Toate Facturile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubView("partners_list");
                    setSelectedPartnerKey(null);
                  }}
                  className={`px-2 py-0.5 text-[10.5px] font-semibold rounded-xs transition-all cursor-pointer ${
                    subView === "partners_list" || Boolean(selectedPartnerKey)
                      ? "bg-[#E8F5E9] text-emerald-950 shadow-xs font-bold"
                      : "text-white/80 hover:text-white"
                  }`}
                  title={
                    activeTab === "received"
                      ? "Vezi situația grupată pe fiecare furnizor"
                      : "Vezi situația grupată pe fiecare client"
                  }
                >
                  {activeTab === "received"
                    ? `Situație pe Furnizori (${suppliersSummary.length})`
                    : `Situație pe Clienți (${clientsSummary.length})`}
                </button>
              </div>

              {/* Window Controls: Minimise, Maximise, Close */}
              <div className="flex items-center gap-0.5 ml-2">
                <button
                  type="button"
                  className="w-5 h-4 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-xs text-[10px]"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className="w-5 h-4 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-xs text-[10px]"
                >
                  <Square className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={onLockSession}
                  className="w-5 h-4 flex items-center justify-center bg-[#E81123] hover:bg-red-700 text-white rounded-xs text-[10px]"
                  title="Închide fereastra"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* ── BARA DE INSTRUMENTE A FERESTREI (TOOLBAR IDENTIC SAGA C) ── */}
          <div className="bg-[#ECE9D8] px-2 py-1 flex flex-wrap items-center justify-between gap-1 border-b border-[#999999] shrink-0 text-[11px]">
            {subView === "partners_list" ? (
              /* Toolbar Mod Situație Parteneri (Furnizori sau Clienți) */
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Butoane clasice SAGA */}
                <button
                  type="button"
                  className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                >
                  Adaug
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                >
                  Modific
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                >
                  Sterg
                </button>

                <span className="w-px h-4 bg-[#B0B0B0] mx-0.5" />

                {/* Căutare partener */}
                <div className="relative flex items-center">
                  <Search className="w-3 h-3 text-slate-500 absolute left-1.5 pointer-events-none" />
                  <input
                    type="text"
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    placeholder={`Caută ${activeTab === "received" ? "furnizor" : "client"} (nume, CUI, cod)...`}
                    className="pl-5 pr-1 py-0.5 w-52 md:w-64 bg-white border border-[#7F9DB9] text-[10.5px] rounded-none focus:outline-none focus:border-[#316AC5] shadow-inner font-sans"
                  />
                  {partnerSearch && (
                    <button
                      type="button"
                      onClick={() => setPartnerSearch("")}
                      className="absolute right-1 text-slate-400 hover:text-slate-700 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Sortare Parteneri */}
                <select
                  value={partnerSort}
                  onChange={(e) => setPartnerSort(e.target.value as any)}
                  className="px-1.5 py-0.5 bg-white border border-[#7F9DB9] text-[10.5px] rounded-none font-sans focus:outline-none focus:border-[#316AC5] shadow-inner"
                  title="Criteriu sortare parteneri"
                >
                  <option value="count_desc">Sortare: Cele mai multe facturi</option>
                  <option value="total_desc">Sortare: Total sumă descrescător</option>
                  <option value="name_asc">Sortare: Denumire partener (A-Z)</option>
                </select>

                <span className="w-px h-4 bg-[#B0B0B0] mx-0.5" />

                {/* Buton Înapoi la Toate Facturile */}
                <button
                  type="button"
                  onClick={() => {
                    setSubView("all_invoices");
                    setSelectedPartnerKey(null);
                  }}
                  className="flex items-center gap-1 px-2.5 py-0.5 bg-[#E4EBF2] hover:bg-[#D4E0EC] border-t border-l border-white border-b border-r border-[#808080] text-[#000080] font-bold cursor-pointer shadow-2xs text-[10.5px]"
                  title="Comută la vizualizarea tabelară cu toate facturile"
                >
                  <FileText className="w-3 h-3 text-[#1F4E79]" />
                  <span>Vezi Toate Facturile</span>
                </button>

                {/* Buton Excel Parteneri */}
                <button
                  type="button"
                  onClick={activeTab === "received" ? onExportExcel : onExportEmittedExcel}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  title="Export Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="hidden sm:inline">Excel</span>
                </button>

                {/* Buton SPV */}
                <button
                  type="button"
                  onClick={() => setShowSpvModal(true)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[#E4EBF2] hover:bg-[#D4E0EC] border-t border-l border-white border-b border-r border-[#808080] text-blue-900 font-bold cursor-pointer shadow-2xs text-[11px]"
                >
                  <Globe className="w-3 h-3 text-[#1F4E79]" />
                  <span>e-Factura SPV ({realSpvCount})</span>
                </button>
              </div>
            ) : (
              /* Toolbar normal All Invoices */
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  title="Adăugare înregistrare nouă"
                >
                  Adaug
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  title="Modificare înregistrare"
                >
                  Modific
                </button>
                <button
                  type="button"
                  className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  title="Ștergere înregistrare"
                >
                  Sterg
                </button>

                <span className="w-px h-4 bg-[#B0B0B0] mx-0.5" />

                {/* Căutare rapidă SAGA C */}
                <div className="relative flex items-center">
                  <Search className="w-3 h-3 text-slate-500 absolute left-1.5 pointer-events-none" />
                  <input
                    type="text"
                    value={activeTab === "received" ? search : searchEmitted}
                    onChange={(e) =>
                      activeTab === "received" ? setSearch(e.target.value) : setSearchEmitted(e.target.value)
                    }
                    placeholder="Caută în tabel..."
                    className="pl-5 pr-1 py-0.5 w-32 md:w-36 bg-white border border-[#7F9DB9] text-[10.5px] rounded-none focus:outline-none focus:border-[#316AC5] shadow-inner font-sans"
                  />
                </div>

                {/* Filtru Perioadă */}
                <select
                  value={activeTab === "received" ? period : periodEmitted}
                  onChange={(e) =>
                    activeTab === "received"
                      ? setPeriod(e.target.value as any)
                      : setPeriodEmitted(e.target.value as any)
                  }
                  className="px-1 py-0.5 bg-white border border-[#7F9DB9] text-[10.5px] rounded-none font-sans focus:outline-none focus:border-[#316AC5] shadow-inner"
                >
                  <option value="all">Toate</option>
                  <option value="current_month">Luna curentă</option>
                  <option value="last_month">Luna trecută</option>
                  <option value="last_3_months">Ultimele 3 luni</option>
                  <option value="current_year">Anul 2026</option>
                </select>

                {/* Filtru NIR */}
                {activeTab === "received" && (
                  <select
                    value={nirFilter}
                    onChange={(e) => setNirFilter(e.target.value as any)}
                    className="px-1 py-0.5 bg-white border border-[#7F9DB9] text-[10.5px] rounded-none font-sans focus:outline-none focus:border-[#316AC5] shadow-inner"
                  >
                    <option value="all">NIR: Toate</option>
                    <option value="cu_nir">Doar Cu NIR</option>
                    <option value="fara_nir">Fără NIR</option>
                  </select>
                )}

                <span className="w-px h-4 bg-[#B0B0B0] mx-0.5" />

                {/* Selector rapid Partener (Furnizor sau Client) */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-600 font-medium hidden xl:inline">
                    {activeTab === "received" ? "Furnizor:" : "Client:"}
                  </span>
                  <select
                    value={selectedPartnerKey || "all"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedPartnerKey(val === "all" ? null : val);
                      setSubView("all_invoices");
                    }}
                    className={`px-1.5 py-0.5 text-[10.5px] rounded-none font-sans focus:outline-none focus:border-[#316AC5] shadow-inner max-w-[210px] ${
                      selectedPartnerKey
                        ? "bg-amber-50 border-[#C5A028] font-bold text-slate-900"
                        : "bg-white border-[#7F9DB9] text-slate-800"
                    }`}
                    title={
                      activeTab === "received"
                        ? "Filtrează facturile după un anumit furnizor"
                        : "Filtrează facturile după un anumit client"
                    }
                  >
                    <option value="all">
                      {activeTab === "received"
                        ? `[Toți Furnizorii (${suppliersSummary.length})]`
                        : `[Toți Clienții (${clientsSummary.length})]`}
                    </option>
                    {(activeTab === "received" ? suppliersSummary : clientsSummary).map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.code ? `${p.code} - ` : ""}
                        {p.name} ({p.invoiceCount})
                      </option>
                    ))}
                  </select>

                  {/* Buton Situație Furnizori/Clienți */}
                  <button
                    type="button"
                    onClick={() => {
                      setSubView("partners_list");
                      setSelectedPartnerKey(null);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-semibold text-[10.5px] cursor-pointer shadow-2xs"
                    title={
                      activeTab === "received"
                        ? "Deschide tabelul situației centralizate pe fiecare furnizor"
                        : "Deschide tabelul situației centralizate pe fiecare client"
                    }
                  >
                    {activeTab === "received" ? (
                      <Building2 className="w-3.5 h-3.5 text-[#1F4E79]" />
                    ) : (
                      <Users className="w-3.5 h-3.5 text-[#1F4E79]" />
                    )}
                    <span className="hidden sm:inline">
                      {activeTab === "received" ? "Situație Furnizori" : "Situație Clienți"}
                    </span>
                  </button>
                </div>

                <span className="w-px h-4 bg-[#B0B0B0] mx-0.5" />

                {/* Buton Excel */}
                <button
                  type="button"
                  onClick={activeTab === "received" ? onExportExcel : onExportEmittedExcel}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  title="Export Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="hidden sm:inline">Excel</span>
                </button>

                {/* Buton Tipărire PDF */}
                {selectedInvoice && (
                  <button
                    type="button"
                    onClick={() => onViewInvoicePdf(selectedInvoice)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-bold cursor-pointer shadow-2xs text-[11px]"
                    title="Tipărește factura PDF (sau apăsați Enter)"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-700" />
                    <span>Tipărire</span>
                  </button>
                )}

                {/* Buton Salvare */}
                <button
                  type="button"
                  className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-slate-500 font-normal cursor-default shadow-2xs text-[11px]"
                  disabled
                >
                  Salvare
                </button>

                {/* Buton Undo */}
                <button
                  type="button"
                  className="px-1.5 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-slate-500 font-normal cursor-default shadow-2xs text-[11px]"
                  disabled
                >
                  <RotateCcw className="w-3 h-3" />
                </button>

                {/* Buton e-Factura SPV — Deschide Ecranul SPV Real */}
                <button
                  type="button"
                  onClick={() => setShowSpvModal(true)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[#E4EBF2] hover:bg-[#D4E0EC] border-t border-l border-white border-b border-r border-[#808080] text-blue-900 font-bold cursor-pointer shadow-2xs text-[11px]"
                  title="Deschide ecranul e-Factura SPV ANAF cu mesajele descărcate și sincronizare live"
                >
                  <Globe className="w-3 h-3 text-[#1F4E79]" />
                  <span>e-Factura SPV ({realSpvCount})</span>
                </button>

                {/* Buton Export XML SAGA */}
                <button
                  type="button"
                  onClick={onDownloadSagaXml}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  title="Descarcă fișier XML 100% conform importului SAGA C"
                >
                  <Download className="w-3 h-3 text-[#1F4E79]" />
                  <span className="hidden sm:inline">Export XML</span>
                </button>

                {/* Buton Pachet ZIP */}
                <button
                  type="button"
                  onClick={onDownloadZip}
                  className="flex items-center gap-1 px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] active:bg-[#DFDAC6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  title="Descarcă toate documentele selectate într-o arhivă ZIP"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">Pachet ZIP</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] text-slate-600 font-mono hidden md:inline">
                {subView === "partners_list"
                  ? `${displayedPartners.length} parteneri`
                  : `${activeInvoices.length} doc. găsite`}
              </span>
              <button
                type="button"
                className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
              >
                &lt;&lt; Detalii
              </button>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════
              3. ZONA DE CONȚINUT MDI: SITUAȚIE PARTENERI sau FACTURI DETALIATE
          ═════════════════════════════════════════════════════════════════════ */}
          {subView === "partners_list" ? (
            /* ─────────────────────────────────────────────────────────────────
               MODALITATE A: SITUAȚIE CENTRALIZATĂ PE FURNIZORI / CLIENȚI
               (SAGA C - FIȘIERE / SITUAȚII PARTENERI CU DOUĂ GRILE MDI)
            ───────────────────────────────────────────────────────────────── */
            <>
              {/* 1. GRILA SUPERIOARĂ: DIRECTORUL CENTRALIZAT AL PARTENERILOR */}
              <div className="flex-1 min-h-[170px] max-h-[48vh] bg-[#FFFFEB] overflow-auto border-b border-[#808080] relative">
                <table className="w-full border-collapse text-[11px] font-sans">
                  <thead className="sticky top-0 bg-[#ECE9D8] text-black font-normal text-[11px] border-b border-[#808080] shadow-xs z-10 select-none">
                    <tr className="border-b border-[#808080]">
                      <th className="py-0.5 px-1 text-center border-r border-[#B0B0B0] w-8 font-normal">Tip</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-16 font-normal">Cod</th>
                      <th className="py-0.5 px-2 text-left border-r border-[#B0B0B0] font-normal">
                        {activeTab === "received" ? "Denumire Furnizor" : "Denumire Client"}
                      </th>
                      <th className="py-0.5 px-2 text-left border-r border-[#B0B0B0] w-28 font-normal">Cod Fiscal / CUI</th>
                      <th className="py-0.5 px-2 text-center border-r border-[#B0B0B0] w-20 font-normal">Nr. Facturi</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-28 font-normal">Valoare fără TVA</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-24 font-normal">TVA</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-28 font-normal">Total Rulaj</th>
                      {activeTab === "received" && (
                        <th className="py-0.5 px-2 text-center border-r border-[#B0B0B0] w-24 font-normal" title="Număr NIR-uri întocmite din total facturi">
                          NIR-uri
                        </th>
                      )}
                      <th className="py-0.5 px-2 text-center border-r border-[#B0B0B0] w-24 font-normal">Ultima factură</th>
                      <th className="py-0.5 px-2 text-center w-36 font-normal">Acțiune</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPartners.length === 0 ? (
                      <tr>
                        <td colSpan={activeTab === "received" ? 11 : 10} className="py-10 text-center text-slate-500 italic bg-white">
                          Nu s-au găsit parteneri conform criteriilor de căutare.
                        </td>
                      </tr>
                    ) : (
                      displayedPartners.map((partner, idx) => {
                        const isSelected = selectedPartnerIdInList === partner.key;
                        const isEven = idx % 2 === 0;

                        return (
                          <tr
                            key={partner.key}
                            onClick={() => setSelectedPartnerIdInList(partner.key)}
                            onDoubleClick={() => {
                              setSelectedPartnerKey(partner.key);
                              setSubView("all_invoices");
                            }}
                            className={`cursor-pointer border-b border-[#D5DCE2] leading-tight select-none ${
                              isSelected
                                ? "bg-[#000080] text-white font-medium"
                                : isEven
                                ? "bg-[#FFFFEB] hover:bg-[#EBF3FB] text-black"
                                : "bg-white hover:bg-[#EBF3FB] text-black"
                            }`}
                            style={{ height: "22px" }}
                          >
                            {/* Tip: Icon partener */}
                            <td className="py-0.5 px-1 text-center border-r border-[#D3D3D3]">
                              <span className="text-[11px]">
                                {activeTab === "received" ? "🏢" : "👥"}
                              </span>
                            </td>

                            {/* Cod SAGA */}
                            <td className="py-0.5 px-1.5 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {partner.code}
                            </td>

                            {/* Denumire partener */}
                            <td
                              className="py-0.5 px-2 border-r border-[#D3D3D3] truncate max-w-[280px] font-semibold"
                              title={partner.name}
                            >
                              {partner.name}
                            </td>

                            {/* CUI / CIF */}
                            <td className="py-0.5 px-2 font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              <div className="flex items-center justify-between gap-1">
                                <span>{partner.cui || "—"}</span>
                                {partner.cui && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyCui(partner.cui);
                                    }}
                                    className={`text-[9px] px-1 rounded opacity-70 hover:opacity-100 ${
                                      isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"
                                    }`}
                                    title={`Copiază CUI: ${partner.cui}`}
                                  >
                                    {copiedCui === partner.cui ? "✓" : "CUI"}
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Nr. Facturi */}
                            <td className="py-0.5 px-2 text-center font-mono font-bold border-r border-[#D3D3D3]">
                              <span
                                className={`px-1.5 py-0.2 rounded-xs text-[10px] ${
                                  isSelected
                                    ? "bg-white/25 text-white"
                                    : "bg-blue-100 text-blue-900 border border-blue-200"
                                }`}
                              >
                                {partner.invoiceCount}
                              </span>
                            </td>

                            {/* Valoare fără TVA */}
                            <td className="py-0.5 px-2 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaCurrency(partner.totalBase)}
                            </td>

                            {/* TVA */}
                            <td className="py-0.5 px-2 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaCurrency(partner.totalVat)}
                            </td>

                            {/* Total General */}
                            <td className="py-0.5 px-2 text-right font-mono font-bold border-r border-[#D3D3D3]">
                              {formatSagaCurrency(partner.totalGross)}
                            </td>

                            {/* NIR-uri (doar pentru furnizori) */}
                            {activeTab === "received" && (
                              <td className="py-0.5 px-2 text-center border-r border-[#D3D3D3]">
                                <span
                                  className={`px-1.5 py-0.2 rounded-xs font-mono text-[10px] ${
                                    isSelected
                                      ? "bg-emerald-400 text-slate-950 font-bold"
                                      : partner.nirCount > 0
                                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {partner.nirCount} / {partner.invoiceCount}
                                </span>
                              </td>
                            )}

                            {/* Ultima factură */}
                            <td className="py-0.5 px-2 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {partner.latestInvoiceDate ? formatSagaDate(partner.latestInvoiceDate) : "—"}
                            </td>

                            {/* Acțiuni: Buton SAGA intră în facturi */}
                            <td className="py-0.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPartnerKey(partner.key);
                                  setSubView("all_invoices");
                                }}
                                className={`px-2 py-0.5 text-[10.5px] rounded-xs font-bold cursor-pointer transition-colors ${
                                  isSelected
                                    ? "bg-amber-300 hover:bg-amber-200 text-slate-950 shadow-xs"
                                    : "bg-[#1F4E79] hover:bg-[#102A43] text-white shadow-2xs"
                                }`}
                                title={`Vezi toate cele ${partner.invoiceCount} facturi ale ${partner.name}`}
                              >
                                Vezi Facturi ({partner.invoiceCount}) ➔
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* 2. BANDA INTERMEDIARĂ: PARTENER EVIDENȚIAT */}
              <div className="bg-[#ECE9D8] px-2 py-1 flex items-center justify-between gap-1.5 border-b border-[#999999] shrink-0 text-[11px] shadow-2xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-slate-700 font-semibold hidden sm:inline">
                    {activeTab === "received" ? "Furnizor selectat:" : "Client selectat:"}
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={highlightedPartnerInList?.code || ""}
                    title="Cod partener"
                    className="w-16 bg-white border border-[#7F9DB9] px-1.5 py-0.5 text-[10.5px] font-mono text-center text-slate-900 rounded-none shadow-inner focus:outline-none"
                  />
                  <input
                    type="text"
                    readOnly
                    value={highlightedPartnerInList?.name || "Niciun partener selectat"}
                    title="Denumire partener"
                    className="w-56 md:w-80 bg-white border border-[#7F9DB9] px-1.5 py-0.5 text-[10.5px] font-bold text-slate-900 rounded-none shadow-inner focus:outline-none truncate"
                  />
                  {highlightedPartnerInList?.cui && (
                    <span className="font-mono text-slate-600 bg-white px-1.5 py-0.5 border border-[#7F9DB9] text-[10.5px] rounded-none">
                      CUI: {highlightedPartnerInList.cui}
                    </span>
                  )}
                  {highlightedPartnerInList && (
                    <span className="text-[10.5px] text-slate-700 font-mono hidden md:inline">
                      {highlightedPartnerInList.invoiceCount} facturi · Total:{" "}
                      <strong>{formatSagaCurrency(highlightedPartnerInList.totalGross)} RON</strong>
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
                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#0055EA] to-[#103869] hover:from-[#0043BA] hover:to-[#0B2545] text-white font-bold text-[11px] rounded-xs cursor-pointer shadow-xs shrink-0"
                    title={`Deschide dosarul complet cu facturi și linii articole pentru ${highlightedPartnerInList.name}`}
                  >
                    <span>Deschide Dosar Facturi & Detalii Linii</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 3. GRILA INFERIOARĂ: FACTURILE PARTENERULUI EVIDENȚIAT */}
              <div className="h-[210px] xl:h-[240px] bg-[#FFFFEB] overflow-auto shrink-0 border-b border-[#808080] relative">
                <table className="w-full border-collapse text-[11px] font-sans">
                  <thead className="sticky top-0 bg-[#ECE9D8] text-black font-normal text-[10.5px] border-b border-[#808080] shadow-xs z-10 select-none">
                    <tr>
                      <th className="py-0.5 px-1 text-center border-r border-[#B0B0B0] w-8 font-normal">Tip</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-20 font-normal">Nr. int.</th>
                      <th className="py-0.5 px-1.5 text-left border-r border-[#B0B0B0] w-32 font-normal">Nr. doc.</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-20 font-normal">Data</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-20 font-normal">Scadent</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-24 font-normal">Valoare</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-20 font-normal">TVA</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-24 font-normal">Total</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-28 font-normal">ID incarcare SPV</th>
                      <th className="py-0.5 px-2 text-left border-r border-[#B0B0B0] font-normal">Note / NIR</th>
                      <th className="py-0.5 px-1.5 text-center w-24 font-normal" title="Documente atașate (Factură PDF și Recepție NIR)">Doc. atașat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!highlightedPartnerInList || highlightedPartnerInList.invoices.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-slate-500 italic bg-white">
                          Selectați un partener din tabelul de mai sus pentru a-i vedea facturile.
                        </td>
                      </tr>
                    ) : (
                      highlightedPartnerInList.invoices.map((inv: any, idx: number) => {
                        const isEven = idx % 2 === 0;
                        const internalNr = getSagaInternalNumber(inv);
                        return (
                          <tr
                            key={inv.id}
                            onDoubleClick={() => onViewInvoicePdf(inv)}
                            className={`border-b border-[#D5DCE2] hover:bg-[#EBF3FB] leading-tight select-none ${
                              isEven ? "bg-[#FFFFEB]" : "bg-white"
                            }`}
                            style={{ height: "20px" }}
                          >
                            <td className="py-0.5 px-1 text-center border-r border-[#D3D3D3]">
                              <span className="text-[11px] text-amber-800">🔒</span>
                            </td>
                            <td className="py-0.5 px-1.5 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {internalNr}
                            </td>
                            <td className="py-0.5 px-1.5 font-mono font-bold border-r border-[#D3D3D3] truncate max-w-[140px]">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-0.5 px-1.5 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {formatSagaDate(inv.issueDate)}
                            </td>
                            <td className="py-0.5 px-1.5 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {formatSagaDate(inv.dueDate || inv.issueDate)}
                            </td>
                            <td className="py-0.5 px-2 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaCurrency(inv.totalBase)}
                            </td>
                            <td className="py-0.5 px-2 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaCurrency(inv.totalVAT)}
                            </td>
                            <td className="py-0.5 px-2 text-right font-mono font-bold border-r border-[#D3D3D3]">
                              {formatSagaCurrency(inv.total)}
                            </td>
                            <td className="py-0.5 px-1.5 text-center font-mono text-[10.5px] border-r border-[#D3D3D3]">
                              {inv.spvIndex ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSpvModal(true);
                                    setSpvSearchQuery(inv.spvIndex);
                                  }}
                                  className="underline cursor-pointer bg-transparent border-0 p-0 font-mono text-[10.5px] text-blue-900"
                                >
                                  {inv.spvIndex}
                                </button>
                              ) : (
                                <span className="opacity-40">—</span>
                              )}
                            </td>
                            <td className="py-0.5 px-2 border-r border-[#D3D3D3] truncate max-w-[220px] text-[10.5px]">
                              {inv.notes || (inv.hasNir ? `NIR: ${inv.nirNumber}` : "Factură validată")}
                            </td>
                            <td className="py-0.5 px-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewInvoicePdf(inv);
                                  }}
                                  className="p-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                                  title="Vizualizează factura PDF"
                                >
                                  <FileText className="w-3 h-3" />
                                </button>
                                {inv.hasNir && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onViewNirPdf(inv);
                                    }}
                                    className="p-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 transition-colors"
                                    title={`Vizualizează Nota de Recepție (NIR: ${inv.nirNumber})`}
                                  >
                                    <FileText className="w-3 h-3 text-emerald-700" />
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

              {/* 4. BARA DE ACȚIUNI PENTRU MOD SITUAȚIE PARTENERI */}
              <div className="bg-[#ECE9D8] px-2 py-1 flex items-center justify-between border-t border-[#999999] shrink-0 text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSubView("all_invoices");
                      setSelectedPartnerKey(null);
                    }}
                    className="flex items-center gap-1 px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-semibold cursor-pointer shadow-2xs text-[11px]"
                  >
                    <span>◄</span>
                    <span>Toate Facturile</span>
                  </button>

                  {highlightedPartnerInList && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPartnerKey(highlightedPartnerInList.key);
                        setSubView("all_invoices");
                      }}
                      className="flex items-center gap-1 px-3 py-0.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] border-t border-l border-white border-b border-r border-[#808080] text-emerald-950 font-bold cursor-pointer shadow-2xs text-[11px]"
                    >
                      <span>Intră în Dosar: {highlightedPartnerInList.name}</span>
                      <span>➔</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={activeTab === "received" ? onExportExcel : onExportEmittedExcel}
                    className="flex items-center gap-1 px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Export Excel Parteneri</span>
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={onLockSession}
                    className="flex items-center gap-1.5 px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-red-700 font-bold cursor-pointer shadow-2xs text-[11px]"
                    title="Ieșire din ecran"
                  >
                    <span>🚪</span>
                    <span>Iesire</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ─────────────────────────────────────────────────────────────────
               MODALITATE B: VEDERE FACTURI (TOATE sau FILTRATE PE UN PARTENER)
               (CU FIȘĂ PARTENER SAGA, POZIȚII ARTICOLE ȘI BUTOANE PDF / NIR)
            ───────────────────────────────────────────────────────────────── */
            <>
              {/* ── BARA FIȘĂ PARTENER SAGA (CÂND S-A INTRAT PE UN FURNIZOR / CLIENT ANUME) ── */}
              {selectedPartnerKey && selectedPartnerObj && (
                <div className="bg-[#EBF3FB] border-b border-[#7F9DB9] px-2.5 py-1 flex flex-wrap items-center justify-between gap-1.5 shrink-0 text-[11px] shadow-2xs select-none">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPartnerKey(null);
                        setSubView("partners_list");
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-slate-100 border border-[#7F9DB9] text-blue-900 font-bold rounded-xs cursor-pointer shadow-2xs text-[10.5px]"
                      title="Revenire la lista centralizată de parteneri (tasta Esc)"
                    >
                      <ArrowLeft className="w-3 h-3 text-blue-700" />
                      <span>◄ Înapoi la Listă (Esc)</span>
                    </button>

                    <span className="w-px h-4 bg-[#B0C4DE]" />

                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#000080] bg-white px-1.5 py-0.2 border border-[#B0C4DE] rounded-xs text-[10.5px]">
                        {selectedPartnerObj.code}
                      </span>
                      <span className="font-bold text-slate-900 text-[11.5px]">
                        {selectedPartnerObj.name}
                      </span>
                      {selectedPartnerObj.cui && (
                        <span className="font-mono text-slate-600 bg-white/80 px-1 py-0.2 border border-[#B0C4DE] rounded-xs text-[10.5px]">
                          CUI: {selectedPartnerObj.cui}
                        </span>
                      )}
                    </div>

                    <span className="w-px h-4 bg-[#B0C4DE]" />

                    <div className="flex items-center gap-2 text-[10.5px]">
                      <span className="bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded-xs font-bold border border-blue-200">
                        {activeInvoices.length} factur{activeInvoices.length === 1 ? "ă" : "i"}
                      </span>
                      <span>
                        Bază: <strong className="font-mono text-slate-900">{formatSagaCurrency(selectedPartnerObj.totalBase)}</strong> lei
                      </span>
                      <span>
                        TVA: <strong className="font-mono text-slate-900">{formatSagaCurrency(selectedPartnerObj.totalVat)}</strong> lei
                      </span>
                      <span className="text-[#000080] font-bold">
                        Total: <strong className="font-mono">{formatSagaCurrency(selectedPartnerObj.totalGross)}</strong> lei
                      </span>

                      {activeTab === "received" && selectedPartnerObj.nirCount > 0 && (
                        <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded-xs font-bold border border-emerald-300">
                          ✓ {selectedPartnerObj.nirCount} NIR-uri recepționate
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[10px] text-slate-500 hidden sm:inline">Comută la:</span>
                    <select
                      value={selectedPartnerKey}
                      onChange={(e) => {
                        if (e.target.value === "all") {
                          setSelectedPartnerKey(null);
                        } else {
                          setSelectedPartnerKey(e.target.value);
                        }
                      }}
                      className="px-1.5 py-0.5 bg-white border border-[#7F9DB9] text-[10.5px] rounded-none font-sans focus:outline-none focus:border-[#316AC5] shadow-inner max-w-[200px]"
                    >
                      {(activeTab === "received" ? suppliersSummary : clientsSummary).map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.name} ({p.invoiceCount})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setSelectedPartnerKey(null)}
                      className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-[#7F9DB9] text-slate-700 font-semibold rounded-xs cursor-pointer shadow-2xs text-[10.5px]"
                      title="Arată facturile tuturor partenerilor"
                    >
                      ✕ Toate facturile
                    </button>
                  </div>
                </div>
              )}

              {/* 1. GRILA SUPERIOARĂ: ANTET FACTURI */}
              <div className="flex-1 min-h-[160px] max-h-[46vh] bg-[#FFFFEB] overflow-auto border-b border-[#808080] relative">
                <table className="w-full border-collapse text-[11px] font-sans">
                  <thead className="sticky top-0 bg-[#ECE9D8] text-black font-normal text-[11px] border-b border-[#808080] shadow-xs z-10 select-none">
                    <tr className="border-b border-[#808080]">
                      <th className="py-0.5 px-1 text-center border-r border-[#B0B0B0] w-8 font-normal">Tip</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-20 font-normal">Nr. int.</th>
                      <th className="py-0.5 px-1.5 text-left border-r border-[#B0B0B0] w-32 font-normal">Nr. doc.</th>
                      <th className="py-0.5 px-1 text-center border-r border-[#B0B0B0] w-14 font-normal">Cod</th>
                      <th className="py-0.5 px-2 text-left border-r border-[#B0B0B0] font-normal">
                        {activeTab === "received" ? "Furnizor" : "Client"}
                      </th>
                      <th className="py-0.5 px-1 text-center border-r border-[#B0B0B0] w-12 font-normal">TVA I</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-20 font-normal">Data</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-20 font-normal">Scadent</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-24 font-normal">Valoare</th>
                      <th className="py-0.5 px-1.5 text-right border-r border-[#B0B0B0] w-16 font-normal">Repartizat</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-20 font-normal">TVA</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-24 font-normal">Total</th>
                      <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-20 font-normal">Neachitat</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-24 font-normal">Data document</th>
                      <th className="py-0.5 px-2 text-left border-r border-[#B0B0B0] w-48 font-normal">Informatii suplimentare</th>
                      <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-28 font-normal">ID incarcare SPV</th>
                      <th className="py-0.5 px-1.5 text-center w-24 font-normal" title="Documente atașate (Factură fiscală PDF și Recepție NIR)">Doc. atașat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={17} className="py-10 text-center text-slate-500 italic bg-white">
                          Nu există documente pentru filtrele selectate.
                        </td>
                      </tr>
                    ) : (
                      activeInvoices.map((inv, idx) => {
                        const isSelected = selectedInvoice?.id === inv.id;
                        const partnerName = activeTab === "received" ? inv.supplierName : inv.clientName;
                        const partnerCui = activeTab === "received" ? inv.supplierCUI : inv.clientCUI;
                        const internalNr = getSagaInternalNumber(inv);
                        const partnerCode = getSagaPartnerCode(partnerCui, inv.id);
                        const isEven = idx % 2 === 0;

                        return (
                          <tr
                            key={inv.id}
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setSelectedLineIdx(0);
                            }}
                            onDoubleClick={() => onViewInvoicePdf(inv)}
                            className={`cursor-pointer border-b border-[#D5DCE2] leading-tight select-none ${
                              isSelected
                                ? "bg-[#000080] text-white font-medium"
                                : isEven
                                ? "bg-[#FFFFEB] hover:bg-[#EBF3FB] text-black"
                                : "bg-white hover:bg-[#EBF3FB] text-black"
                            }`}
                            style={{ height: "20px" }}
                          >
                            {/* Tip: Iconiță lacăt SAGA (blocat/validat) */}
                            <td className="py-0.5 px-1 text-center border-r border-[#D3D3D3]">
                              <span
                                className={`inline-block text-[11px] ${
                                  isSelected ? "text-amber-300" : "text-amber-800"
                                }`}
                                title="Document recepționat și validat în contabilitate"
                              >
                                🔒
                              </span>
                            </td>

                            {/* Nr. int. (Număr intern SAGA) */}
                            <td className="py-0.5 px-1.5 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {internalNr}
                            </td>

                            {/* Nr. doc. (Număr factură furnizor) */}
                            <td className="py-0.5 px-1.5 font-mono font-bold border-r border-[#D3D3D3] truncate max-w-[140px]">
                              {inv.invoiceNumber}
                            </td>

                            {/* Cod (Cod partener SAGA) */}
                            <td className="py-0.5 px-1 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {partnerCode}
                            </td>

                            {/* Furnizor / Client — Click pe partener deschide direct dosarul */}
                            <td
                              className="py-0.5 px-2 border-r border-[#D3D3D3] truncate max-w-[240px]"
                              title={`Click pentru a deschide dosarul partenerului: ${partnerName}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const cui = partnerCui || "";
                                    const name = partnerName || "";
                                    const key = cui.trim() || name.trim().toLowerCase();
                                    setSelectedPartnerKey(key);
                                    setSubView("all_invoices");
                                  }}
                                  className={`truncate text-left font-semibold hover:underline cursor-pointer bg-transparent border-0 p-0 text-[11px] ${
                                    isSelected ? "text-amber-200" : "text-[#000080]"
                                  }`}
                                  title={`Click pentru a intra pe fișa completă a partenerului: ${partnerName}`}
                                >
                                  {partnerName}
                                </button>
                                {partnerCui && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyCui(partnerCui);
                                    }}
                                    className={`text-[9px] px-1 rounded opacity-70 hover:opacity-100 shrink-0 ${
                                      isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"
                                    }`}
                                    title={`Copiază CUI: ${partnerCui}`}
                                  >
                                    {copiedCui === partnerCui ? "✓" : "CUI"}
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* TVA I (TVA la încasare: căsuță bifată) */}
                            <td className="py-0.5 px-1 text-center border-r border-[#D3D3D3]">
                              <span className="font-mono text-xs opacity-70">☐</span>
                            </td>

                            {/* Data */}
                            <td className="py-0.5 px-1.5 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {formatSagaDate(inv.issueDate)}
                            </td>

                            {/* Scadent */}
                            <td className="py-0.5 px-1.5 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {formatSagaDate(inv.dueDate || inv.issueDate)}
                            </td>

                            {/* Valoare (bază fără TVA) */}
                            <td className="py-0.5 px-2 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaCurrency(inv.totalBase)}
                            </td>

                            {/* Repartizat */}
                            <td className="py-0.5 px-1.5 text-right font-mono border-r border-[#D3D3D3]">
                              0.00
                            </td>

                            {/* TVA */}
                            <td className="py-0.5 px-2 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaCurrency(inv.totalVAT)}
                            </td>

                            {/* Total Factură */}
                            <td className="py-0.5 px-2 text-right font-mono font-bold border-r border-[#D3D3D3]">
                              {formatSagaCurrency(inv.total)}
                            </td>

                            {/* Neachitat */}
                            <td className="py-0.5 px-2 text-right font-mono border-r border-[#D3D3D3]">
                              0.00
                            </td>

                            {/* Data document */}
                            <td className="py-0.5 px-1.5 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {formatSagaDate(inv.issueDate)}
                            </td>

                            {/* Informatii suplimentare */}
                            <td
                              className="py-0.5 px-2 border-r border-[#D3D3D3] truncate max-w-[200px] text-[10.5px]"
                              title={inv.notes || (inv.hasNir ? `NIR: ${inv.nirNumber}` : "")}
                            >
                              {inv.notes || (inv.hasNir ? `NIR recepție: ${inv.nirNumber}` : "Se va achita cu OP")}
                            </td>

                            {/* ID incarcare SPV */}
                            <td className="py-0.5 px-1.5 text-center font-mono text-[10.5px] border-r border-[#D3D3D3]">
                              {inv.spvIndex ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSpvModal(true);
                                    setSpvSearchQuery(inv.spvIndex);
                                  }}
                                  className={`underline cursor-pointer bg-transparent border-0 p-0 font-mono text-[10.5px] ${
                                    isSelected ? "text-amber-200" : "text-blue-900"
                                  }`}
                                  title={`Click pentru detalii SPV ANAF: ${inv.spvIndex}`}
                                >
                                  {inv.spvIndex}
                                </button>
                              ) : (
                                <span className="opacity-40">—</span>
                              )}
                            </td>

                            {/* Acțiuni: 2 iconițe (Factură PDF albastră + NIR PDF verde) */}
                            <td className="py-0.5 px-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {/* Icon 1: Factură PDF (albastru) */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewInvoicePdf(inv);
                                  }}
                                  className={`p-0.5 rounded transition-colors ${
                                    isSelected
                                      ? "bg-white/20 hover:bg-white/30 text-white"
                                      : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                                  }`}
                                  title="Vizualizează factura PDF"
                                >
                                  <FileText className="w-3 h-3" />
                                </button>

                                {/* Icon 2: NIR PDF (verde, la fel ca la document doar că verde!) */}
                                {inv.hasNir && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onViewNirPdf(inv);
                                    }}
                                    className={`p-0.5 rounded transition-colors ${
                                      isSelected
                                        ? "bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold"
                                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300"
                                    }`}
                                    title={`Vizualizează Nota de Recepție (NIR: ${inv.nirNumber})`}
                                  >
                                    <FileText className="w-3 h-3 text-emerald-700" />
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

              {/* 2. BANDA INTERMEDIARĂ SAGA C: DOCUMENT SELECTAT (RECAPITULARE) */}
              <div className="bg-[#ECE9D8] px-2 py-1 flex items-center gap-1.5 border-b border-[#999999] shrink-0 text-[11px] shadow-2xs">
                <input
                  type="text"
                  readOnly
                  value={selectedNrInt}
                  title="Număr intern"
                  className="w-20 bg-white border border-[#7F9DB9] px-1.5 py-0.5 text-[10.5px] font-mono text-slate-900 rounded-none shadow-inner focus:outline-none"
                />
                <input
                  type="text"
                  readOnly
                  value={selectedNrDoc}
                  title="Număr document furnizor"
                  className="w-36 bg-white border border-[#7F9DB9] px-1.5 py-0.5 text-[10.5px] font-mono font-bold text-slate-900 rounded-none shadow-inner focus:outline-none"
                />
                <input
                  type="text"
                  readOnly
                  value={selectedCod}
                  title="Cod partener SAGA"
                  className="w-16 bg-white border border-[#7F9DB9] px-1.5 py-0.5 text-[10.5px] font-mono text-center text-slate-900 rounded-none shadow-inner focus:outline-none"
                />
                <input
                  type="text"
                  readOnly
                  value={selectedPartner}
                  title="Denumire partener"
                  className="flex-1 max-w-[380px] bg-white border border-[#7F9DB9] px-1.5 py-0.5 text-[10.5px] text-slate-900 rounded-none shadow-inner focus:outline-none truncate"
                />

                {selectedInvoice && (
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {/* 1. Iconiță Factură PDF (albastru) */}
                    <button
                      type="button"
                      onClick={() => onViewInvoicePdf(selectedInvoice)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 font-bold text-[10.5px] rounded-xs cursor-pointer shadow-2xs"
                      title="Deschide factura fiscală PDF (Enter)"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-700" />
                      <span>Factură PDF</span>
                    </button>

                    {/* 2. Iconiță NIR PDF (verde, la fel ca la document doar că verde!) */}
                    {selectedInvoice.hasNir && (
                      <button
                        type="button"
                        onClick={() => onViewNirPdf(selectedInvoice)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-[10.5px] rounded-xs cursor-pointer shadow-2xs"
                        title={`Deschide fișa NIR atașată (${selectedInvoice.nirNumber}) (tasta N)`}
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-700" />
                        <span>NIR: {selectedInvoice.nirNumber}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 3. BARA DE INSTRUMENTE POZIȚII (TOOLBAR LINII ARTICOLE SAGA C) */}
              <div className="bg-[#ECE9D8] px-2 py-1 flex items-center justify-between border-b border-[#999999] shrink-0 text-[11px]">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Adaug
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Modific
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Sterg
                  </button>

                  <span className="w-px h-4 bg-[#B0B0B0] mx-0.5" />

                  <button
                    type="button"
                    className="px-1.5 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black cursor-pointer shadow-2xs"
                    title="Caută în poziții"
                  >
                    <Search className="w-3 h-3 text-slate-700" />
                  </button>
                  <button
                    type="button"
                    className="px-1.5 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black cursor-pointer shadow-2xs"
                    title="Filtru linii"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-slate-700" />
                  </button>
                  <button
                    type="button"
                    className="px-1.5 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-mono font-bold cursor-pointer shadow-2xs text-[11px]"
                    title="Calculator"
                  >
                    fx
                  </button>

                  <button
                    type="button"
                    className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Serii &gt;&gt;
                  </button>
                  <button
                    type="button"
                    className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Preturi vanzare &gt;&gt;
                  </button>

                  {selectedInvoice?.hasNir && (
                    <button
                      type="button"
                      onClick={() => onViewNirPdf(selectedInvoice)}
                      className="px-2 py-0.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] border-t border-l border-white border-b border-r border-[#808080] text-[#1B5E20] font-bold cursor-pointer shadow-2xs text-[11px]"
                    >
                      Bon de consum...
                    </button>
                  )}

                  <button
                    type="button"
                    className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Facturi asociate (transport)...
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    className="px-2 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Detalii
                  </button>
                </div>
              </div>

              {/* 4. GRILA INFERIOARĂ: POZIȚII / LINII ARTICOLE (IDENTICĂ SAGA C) */}
              <div className="h-[210px] xl:h-[240px] bg-[#FFFFEB] overflow-auto shrink-0 border-b border-[#808080] relative">
                {isLinesLoading ? (
                  <div className="h-full flex items-center justify-center gap-2 text-slate-500 text-xs py-8 bg-[#FFFFEB]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#000080]" />
                    <span>Se încarcă articolele facturii din SAGA...</span>
                  </div>
                ) : documentLines.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-6 bg-[#FFFFEB]">
                    <BookOpen className="w-5 h-5 mb-1 text-slate-400" />
                    <span className="font-semibold">Factura este centralizată la nivel de antet fiscal.</span>
                    <span className="text-[10.5px] text-slate-500 mt-0.5">
                      Liniile detaliate sunt disponibile în fișierul PDF oficial (apăsați Tipărire / Enter) sau exportați XML SAGA.
                    </span>
                  </div>
                ) : (
                  <table className="w-full border-collapse text-[11px] font-sans">
                    <thead className="sticky top-0 bg-[#ECE9D8] text-black font-normal text-[10.5px] border-b border-[#808080] shadow-xs z-10 select-none">
                      <tr>
                        <th className="py-0.5 px-2 text-left border-r border-[#B0B0B0] w-28 font-normal">Tip</th>
                        <th className="py-0.5 px-2 text-left border-r border-[#B0B0B0] w-36 font-normal">Gestiune</th>
                        <th className="py-0.5 px-2 text-left border-r border-[#B0B0B0] font-normal">Denumire articol / serviciu</th>
                        <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-20 font-normal">Cod</th>
                        <th className="py-0.5 px-1 text-center border-r border-[#B0B0B0] w-12 font-normal">UM</th>
                        <th className="py-0.5 px-1 text-center border-r border-[#B0B0B0] w-10 font-normal">TVA</th>
                        <th className="py-0.5 px-1.5 text-right border-r border-[#B0B0B0] w-16 font-normal">Cantitate</th>
                        <th className="py-0.5 px-1.5 text-right border-r border-[#B0B0B0] w-20 font-normal">Pret unitar</th>
                        <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-20 font-normal">Valoare</th>
                        <th className="py-0.5 px-2 text-right border-r border-[#B0B0B0] w-20 font-normal">Total</th>
                        <th className="py-0.5 px-1.5 text-right border-r border-[#B0B0B0] w-16 font-normal">TVA</th>
                        <th className="py-0.5 px-1 text-right border-r border-[#B0B0B0] w-16 font-normal">Nedeductibil</th>
                        <th className="py-0.5 px-1.5 text-center border-r border-[#B0B0B0] w-14 font-normal">Cont</th>
                        <th className="py-0.5 px-1.5 text-right border-r border-[#B0B0B0] w-20 font-normal">Pret vanzare</th>
                        <th className="py-0.5 px-1.5 text-right border-r border-[#B0B0B0] w-16 font-normal">Adaos unitar</th>
                        <th className="py-0.5 px-1 text-center border-r border-[#B0B0B0] w-10 font-normal">%</th>
                        <th className="py-0.5 px-2 text-left w-32 font-normal">Informatii suplimentare</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentLines.map((line: any, idx: number) => {
                        const isSelectedLine = selectedLineIdx === idx;
                        const isEven = idx % 2 === 0;

                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedLineIdx(idx)}
                            className={`cursor-pointer border-b border-[#D5DCE2] leading-tight select-none ${
                              isSelectedLine
                                ? "bg-[#000080] text-white font-medium"
                                : isEven
                                ? "bg-[#FFFFEB] hover:bg-[#EBF3FB] text-black"
                                : "bg-white hover:bg-[#EBF3FB] text-black"
                            }`}
                            style={{ height: "20px" }}
                          >
                            {/* Tip articol */}
                            <td className="py-0.5 px-2 border-r border-[#D3D3D3] truncate max-w-[120px]">
                              {line.type || "Materiale auxiliare"}
                            </td>

                            {/* Gestiune */}
                            <td className="py-0.5 px-2 border-r border-[#D3D3D3] truncate max-w-[150px]">
                              {line.gestiune || "ATELIER TAMPLARIE"}
                            </td>

                            {/* Denumire articol / serviciu */}
                            <td
                              className="py-0.5 px-2 border-r border-[#D3D3D3] truncate max-w-[320px] font-medium"
                              title={line.description}
                            >
                              {line.description}
                            </td>

                            {/* Cod articol */}
                            <td className="py-0.5 px-1.5 text-center font-mono border-r border-[#D3D3D3] text-[10.5px]">
                              {line.code || String(idx + 1).padStart(8, "0")}
                            </td>

                            {/* UM */}
                            <td className="py-0.5 px-1 text-center font-mono border-r border-[#D3D3D3] uppercase text-[10.5px]">
                              {line.unit || "BUC"}
                            </td>

                            {/* TVA (%) */}
                            <td className="py-0.5 px-1 text-center font-mono border-r border-[#D3D3D3]">
                              {line.vatRate ? Math.round(line.vatRate) : "21"}
                            </td>

                            {/* Cantitate */}
                            <td className="py-0.5 px-1.5 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaQty(line.quantity)}
                            </td>

                            {/* Pret unitar */}
                            <td className="py-0.5 px-1.5 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaUnitPrice(line.unitPrice)}
                            </td>

                            {/* Valoare */}
                            <td className="py-0.5 px-2 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaCurrency(line.valoare ?? line.quantity * line.unitPrice)}
                            </td>

                            {/* Total */}
                            <td className="py-0.5 px-2 text-right font-mono font-bold border-r border-[#D3D3D3]">
                              {formatSagaCurrency(line.total)}
                            </td>

                            {/* TVA */}
                            <td className="py-0.5 px-1.5 text-right font-mono border-r border-[#D3D3D3]">
                              {formatSagaCurrency(line.tva ?? line.total - line.quantity * line.unitPrice)}
                            </td>

                            {/* Nedeductibil */}
                            <td className="py-0.5 px-1 text-right font-mono border-r border-[#D3D3D3]">
                              0.00
                            </td>

                            {/* Cont */}
                            <td className="py-0.5 px-1.5 text-center font-mono font-bold border-r border-[#D3D3D3]">
                              {line.account || "3028"}
                            </td>

                            {/* Pret vanzare */}
                            <td className="py-0.5 px-1.5 text-right font-mono border-r border-[#D3D3D3]">
                              0.0000
                            </td>

                            {/* Adaos unitar */}
                            <td className="py-0.5 px-1.5 text-right font-mono border-r border-[#D3D3D3]">
                              0.00
                            </td>

                            {/* % Adaos */}
                            <td className="py-0.5 px-1 text-center font-mono border-r border-[#D3D3D3]">
                              0
                            </td>

                            {/* Informatii suplimentare */}
                            <td className="py-0.5 px-2 truncate max-w-[140px] text-[10.5px]">
                              {line.infoSuplimentare || ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 5. BARA DE ACȚIUNI DIN SUBSOLUL FERESTREI (BOTTOM ACTION BAR SAGA C) */}
              <div className="bg-[#ECE9D8] px-2 py-1 flex items-center justify-between border-t border-[#999999] shrink-0 text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    <span>🔒</span>
                    <span>Validez</span>
                  </button>

                  <button
                    type="button"
                    className="px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Plata...
                  </button>

                  <button
                    type="button"
                    className="px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Stornez
                  </button>

                  <button
                    type="button"
                    className="px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    N.C...
                  </button>

                  {selectedInvoice && (
                    <button
                      type="button"
                      onClick={() => onViewInvoicePdf(selectedInvoice)}
                      className="px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-bold cursor-pointer shadow-2xs text-[11px]"
                      title="Tipărire document"
                    >
                      Tiparire...
                    </button>
                  )}

                  <button
                    type="button"
                    className="px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-normal cursor-pointer shadow-2xs text-[11px]"
                  >
                    Devalidez
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={onLockSession}
                    className="flex items-center gap-1.5 px-3 py-0.5 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-red-700 font-bold cursor-pointer shadow-2xs text-[11px]"
                    title="Ieșire din ecran"
                  >
                    <span>🚪</span>
                    <span>Iesire</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            8. BARA DE STARE GLOBALĂ SAGA (STATUS BAR) + WATERMARK SAGASOFT.RO
        ═════════════════════════════════════════════════════════════════════ */}
        <div className="mt-1 flex items-center justify-between text-[11px] text-white/90 select-none">
          <div className="flex items-center gap-3">
            {subView === "partners_list" ? (
              <>
                <span>
                  Total {activeTab === "received" ? "Furnizori" : "Clienți"}:{" "}
                  <strong className="font-mono text-white">{displayedPartners.length}</strong>
                </span>
                <span>·</span>
                <span>
                  Valoare Bază: <strong className="font-mono text-white">{formatSagaCurrency(currentKpiData.totalBase)} RON</strong>
                </span>
                <span>·</span>
                <span>
                  TVA: <strong className="font-mono text-white">{formatSagaCurrency(currentKpiData.totalVat)} RON</strong>
                </span>
                <span>·</span>
                <span>
                  Total Rulaj General:{" "}
                  <strong className="font-mono text-amber-300">
                    {formatSagaCurrency(currentKpiData.totalGross)} RON
                  </strong>
                </span>
              </>
            ) : selectedPartnerKey && selectedPartnerObj ? (
              <>
                <span className="text-amber-200 font-bold">
                  Dosar {activeTab === "received" ? "Furnizor" : "Client"}: {selectedPartnerObj.name}
                </span>
                <span>·</span>
                <span>
                  Documente: <strong className="font-mono text-white">{activeInvoices.length}</strong>
                </span>
                <span>·</span>
                <span>
                  Bază: <strong className="font-mono text-white">{formatSagaCurrency(selectedPartnerObj.totalBase)} RON</strong>
                </span>
                <span>·</span>
                <span>
                  TVA: <strong className="font-mono text-white">{formatSagaCurrency(selectedPartnerObj.totalVat)} RON</strong>
                </span>
                <span>·</span>
                <span>
                  Total: <strong className="font-mono text-amber-300">{formatSagaCurrency(selectedPartnerObj.totalGross)} RON</strong>
                </span>
              </>
            ) : (
              <>
                <span>
                  Total documente: <strong className="font-mono text-white">{currentKpiData.totalCount}</strong>
                </span>
                <span>·</span>
                <span>
                  Valoare Bază: <strong className="font-mono text-white">{formatSagaCurrency(currentKpiData.totalBase)} RON</strong>
                </span>
                <span>·</span>
                <span>
                  TVA: <strong className="font-mono text-white">{formatSagaCurrency(currentKpiData.totalVat)} RON</strong>
                </span>
                <span>·</span>
                <span>
                  Total General:{" "}
                  <strong className="font-mono text-amber-300">
                    {formatSagaCurrency(currentKpiData.totalGross)} RON
                  </strong>
                </span>

                {activeTab === "received" && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-200">
                      NIR-uri:{" "}
                      <strong className="font-mono">
                        {currentKpis.withNirCount} / {currentKpis.totalCount} ({currentKpis.nirCoveragePercent}%)
                      </strong>
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10.5px]">
            <span className="text-white/70">
              {subView === "partners_list"
                ? "Navigați cu tastele [↑] / [↓] · [Enter] intră în dosarul partenerului · [Esc] revine la facturi"
                : selectedPartnerKey
                ? "Fișă partener activă · [Esc] revine la lista de parteneri · [Enter] deschide factura · [N] NIR"
                : "Navigați cu tastele [↑] / [↓] · [Enter] deschide factura · [N] deschide NIR"}
            </span>
            <span className="text-cyan-200/60 font-mono tracking-wide">www.sagasoft.ro</span>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          9. MODAL DEDICAT SAGA C: e-FACTURA SPV ANAF (DATE REALE, FĂRĂ MOCK)
      ═════════════════════════════════════════════════════════════════════════ */}
      {showSpvModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-[#ECE9D8] border-2 border-[#0055EA] shadow-2xl rounded-t-sm w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-black font-sans text-xs">
            {/* Header Fereastră SPV */}
            <div className="bg-gradient-to-r from-[#0055EA] via-[#103869] to-[#2B609E] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#003B99] shrink-0">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-300" />
                <span className="font-bold text-xs tracking-wide">
                  e-Factura SPV — Preluare și Management Mesaje ANAF ({company.name || "Societate"})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSpvModal(false)}
                className="w-5 h-4 flex items-center justify-center bg-[#E81123] hover:bg-red-700 text-white rounded-xs text-[10px]"
                title="Închide fereastra"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bara de status conexiune SPV & Buton Sincronizare Live */}
            <div className="bg-[#FFFFEB] border-b border-[#BDC7D1] px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-emerald-900">
                    Conexiune SPV ANAF Activă
                  </span>
                  {spvStats?.tokenExpiresAt && (
                    <span className="text-[11px] text-slate-600">
                      (Token autorizat până la {formatSagaDate(spvStats.tokenExpiresAt)})
                    </span>
                  )}
                </div>

                <span className="w-px h-4 bg-[#BDC7D1]" />

                <div className="flex items-center gap-2 text-[11px] text-slate-700">
                  <span>
                    Facturi Primite din SPV:{" "}
                    <strong className="font-mono text-blue-900">{spvStats?.totalReceived || 0}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Validate la ANAF:{" "}
                    <strong className="font-mono text-emerald-800">{spvStats?.validatedEmitted || 0}</strong>
                  </span>
                  {(spvStats?.errorsCount || 0) > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-red-700 font-bold">
                        Erori ANAF: <strong className="font-mono">{spvStats?.errorsCount}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Buton Sincronizează cu SPV ANAF */}
              <button
                type="button"
                disabled={syncSpvMutation.isPending}
                onClick={() => syncSpvMutation.mutate({ token, sessionToken, zile: 60 })}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#1F4E79] hover:bg-[#102A43] text-white rounded-xs font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                title="Descarcă ultimele mesaje și facturi noi direct de la ANAF"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${syncSpvMutation.isPending ? "animate-spin" : ""}`}
                />
                <span>
                  {syncSpvMutation.isPending ? "Se descarcă din SPV..." : "Sincronizează cu SPV ANAF acum"}
                </span>
              </button>
            </div>

            {/* Filtre și căutare în mesajele SPV */}
            <div className="bg-[#ECE9D8] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#999999] shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSpvTabFilter("all")}
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-xs border cursor-pointer ${
                    spvTabFilter === "all"
                      ? "bg-white border-[#7F9DB9] text-black shadow-xs font-bold"
                      : "bg-[#ECE9D8] border-transparent text-slate-700 hover:bg-white/50"
                  }`}
                >
                  Toate Mesajele ({spvMessages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSpvTabFilter("in")}
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-xs border cursor-pointer ${
                    spvTabFilter === "in"
                      ? "bg-white border-[#7F9DB9] text-black shadow-xs font-bold"
                      : "bg-[#ECE9D8] border-transparent text-slate-700 hover:bg-white/50"
                  }`}
                >
                  Primite din SPV ({spvStats?.totalReceived || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setSpvTabFilter("out")}
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-xs border cursor-pointer ${
                    spvTabFilter === "out"
                      ? "bg-white border-[#7F9DB9] text-black shadow-xs font-bold"
                      : "bg-[#ECE9D8] border-transparent text-slate-700 hover:bg-white/50"
                  }`}
                >
                  Emise în SPV ({spvStats?.totalEmitted || 0})
                </button>
              </div>

              {/* Căutare rapidă */}
              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={spvSearchQuery}
                  onChange={(e) => setSpvSearchQuery(e.target.value)}
                  placeholder="Caută index, CUI, partener, număr..."
                  className="pl-6 pr-2 py-0.5 w-60 bg-white border border-[#7F9DB9] text-xs rounded-none shadow-inner focus:outline-none"
                />
              </div>
            </div>

            {/* Tabelul de Mesaje SPV */}
            <div className="flex-1 overflow-auto bg-[#FFFFEB] min-h-[300px]">
              <table className="w-full border-collapse text-[11px] font-sans">
                <thead className="sticky top-0 bg-[#ECE9D8] text-black border-b border-[#808080] font-normal z-10 select-none shadow-xs">
                  <tr>
                    <th className="py-1 px-1.5 text-center border-r border-[#B0B0B0] w-12 font-normal">Tip</th>
                    <th className="py-1 px-2 text-center border-r border-[#B0B0B0] w-28 font-normal">ID Încărcare SPV</th>
                    <th className="py-1 px-2 text-left border-r border-[#B0B0B0] w-36 font-normal">Număr Document</th>
                    <th className="py-1 px-2 text-left border-r border-[#B0B0B0] font-normal">Partener</th>
                    <th className="py-1 px-2 text-left border-r border-[#B0B0B0] w-24 font-normal">CUI / CIF</th>
                    <th className="py-1 px-2 text-center border-r border-[#B0B0B0] w-20 font-normal">Dată</th>
                    <th className="py-1 px-2 text-right border-r border-[#B0B0B0] w-24 font-normal">Valoare</th>
                    <th className="py-1 px-2 text-center border-r border-[#B0B0B0] w-24 font-normal">Stare ANAF</th>
                    <th className="py-1 px-2 text-center w-24 font-normal" title="Documente atașate (Factură fiscală PDF și Recepție NIR)">Doc. atașat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSpvMessages.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 italic bg-white">
                        Nu s-au găsit mesaje SPV conform criteriilor selectate.
                      </td>
                    </tr>
                  ) : (
                    filteredSpvMessages.map((msg: any, idx: number) => {
                      const isEven = idx % 2 === 0;
                      return (
                        <tr
                          key={msg.id}
                          className={`border-b border-[#D5DCE2] hover:bg-[#EBF3FB] leading-tight select-none ${
                            isEven ? "bg-[#FFFFEB]" : "bg-white"
                          }`}
                          style={{ height: "22px" }}
                        >
                          <td className="py-1 px-1.5 text-center border-r border-[#D3D3D3]">
                            <span
                              className={`px-1 py-0.2 text-[9.5px] font-bold rounded-xs ${
                                msg.direction === "in"
                                  ? "bg-blue-100 text-blue-900 border border-blue-200"
                                  : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                              }`}
                            >
                              {msg.direction === "in" ? "INTRARE" : "IEȘIRE"}
                            </span>
                          </td>

                          <td className="py-1 px-2 text-center font-mono font-bold border-r border-[#D3D3D3] text-blue-950">
                            {msg.spvIndex || "—"}
                          </td>

                          <td className="py-1 px-2 font-mono font-semibold border-r border-[#D3D3D3] truncate max-w-[140px]">
                            {msg.invoiceNumber}
                          </td>

                          <td className="py-1 px-2 border-r border-[#D3D3D3] truncate max-w-[260px]" title={msg.partnerName}>
                            {msg.partnerName}
                          </td>

                          <td className="py-1 px-2 font-mono border-r border-[#D3D3D3]">
                            {msg.partnerCui || "—"}
                          </td>

                          <td className="py-1 px-2 text-center font-mono border-r border-[#D3D3D3]">
                            {formatSagaDate(msg.issueDate)}
                          </td>

                          <td className="py-1 px-2 text-right font-mono font-bold border-r border-[#D3D3D3]">
                            {formatSagaCurrency(msg.total)}
                          </td>

                          <td className="py-1 px-2 text-center border-r border-[#D3D3D3]">
                            {msg.status === "eroare" ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-red-100 text-red-800 border border-red-300 font-bold text-[10px]">
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span>Eroare</span>
                              </span>
                            ) : msg.status === "in_procesare" ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px]">
                                <span>În procesare</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>Validat</span>
                              </span>
                            )}
                          </td>

                          <td className="py-1 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1. Iconiță Factură PDF (albastru) */}
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
                                  className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 transition-colors shadow-2xs cursor-pointer"
                                  title="Vizualizează factura fiscală PDF"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 2. Iconiță NIR PDF (verde, la fel ca la document doar că verde!) */}
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
                                  className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                                  title={`Vizualizează Nota de Recepție (NIR: ${msg.nirNumber})`}
                                >
                                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
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

            {/* Footer Modal SPV */}
            <div className="bg-[#ECE9D8] px-3 py-2 flex items-center justify-between border-t border-[#999999] shrink-0">
              <button
                type="button"
                onClick={onDownloadSagaXml}
                className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 border border-[#808080] text-black font-semibold text-xs rounded-xs shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                <span>Exportă fișierul XML compatibil SAGA C v3.0</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSpvModal(false)}
                className="px-4 py-1 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-bold text-xs rounded-xs shadow-2xs cursor-pointer"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          10. MODAL DEDICAT SAGA C: ALERTE ACTIVE SPV ANAF & CONTABILITATE
      ═════════════════════════════════════════════════════════════════════════ */}
      {showAlertsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 backdrop-blur-xs">
          <div className="bg-[#ECE9D8] border-2 border-[#0055EA] shadow-2xl rounded-t-sm w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-black font-sans text-xs">
            {/* Header Fereastră Alerte */}
            <div className="bg-gradient-to-r from-[#0055EA] via-[#103869] to-[#2B609E] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#003B99] shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                <span className="font-bold text-xs tracking-wide">
                  Alerte Active — SPV ANAF & Contabilitate ({realAlerts.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAlertsModal(false)}
                className="w-5 h-4 flex items-center justify-center bg-[#E81123] hover:bg-red-700 text-white rounded-xs text-[10px]"
                title="Închide fereastra"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Conținut Alerte Reale */}
            <div className="p-3 bg-[#FFFFEB] flex-1 overflow-y-auto space-y-2.5">
              {realAlerts.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-white border border-[#D5DCE2]">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <div className="font-bold text-sm text-slate-800">Nu există erori sau alerte active</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Toate facturile transmise sunt validate în SPV ANAF, iar recepțiile NIR sunt conforme.
                  </div>
                </div>
              ) : (
                realAlerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xs border text-xs leading-relaxed ${
                      alert.severity === "error"
                        ? "bg-red-50 border-red-300 text-red-950"
                        : "bg-amber-50 border-amber-300 text-amber-950"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {alert.severity === "error" ? (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold text-[12px]">{alert.title}</div>
                          <div className="mt-1 text-slate-700 whitespace-pre-wrap font-sans text-[11px]">
                            {alert.description}
                          </div>

                          <div className="mt-2 flex items-center gap-3 font-mono text-[10.5px] text-slate-600">
                            <span>Document: <strong>{alert.docNumber}</strong></span>
                            {alert.spvIndex && (
                              <span>Index SPV: <strong>{alert.spvIndex}</strong></span>
                            )}
                            {alert.amount !== undefined && (
                              <span>Valoare: <strong>{formatSagaCurrency(alert.amount)} RON</strong></span>
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
                          className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded-xs font-bold text-[10.5px] shrink-0 cursor-pointer shadow-xs"
                        >
                          Verifică în SPV
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Modal Alerte */}
            <div className="bg-[#ECE9D8] px-3 py-2 flex items-center justify-end border-t border-[#999999] shrink-0">
              <button
                type="button"
                onClick={() => setShowAlertsModal(false)}
                className="px-4 py-1 bg-[#ECE9D8] hover:bg-[#F5F2E6] border-t border-l border-white border-b border-r border-[#808080] text-black font-bold text-xs rounded-xs shadow-2xs cursor-pointer"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
