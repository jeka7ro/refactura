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
  const [showSearchModal, setShowSearchModal] = useState(false);

  const activeInvoices = activeTab === "received" ? filteredInvoices : filteredEmittedInvoices;

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

  // Navigare prin tastatură (Săgeți Sus/Jos pentru facturi, Enter pentru PDF, N pentru NIR)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

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
  }, [activeInvoices, selectedInvoiceId, selectedInvoice, onViewInvoicePdf, onViewNirPdf]);

  const company = portalData?.company || {};
  const currentKpiData = activeTab === "received" ? currentKpis : currentEmittedKpis;

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
          <div className="hidden md:flex items-center gap-2.5 text-[11px] text-slate-800">
            <span className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs">Fișiere</span>
            <span className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs">Operații</span>
            <span className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs">Situații - Listări</span>
            <span className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs">Diverse</span>
            <span className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs">Administrare</span>
            <span className="cursor-pointer hover:bg-[#316AC5] hover:text-white px-1.5 py-0.5 rounded-xs">Ajutor</span>
          </div>

          <span className="hidden lg:inline text-[10.5px] text-slate-600 font-mono">
            Interval (01.01.2025 - 31.12.2026)
          </span>
        </div>

        {/* Zona Dreapta: Alerte SAGA, Comutator Mod Modern și Ieșire */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-blue-800 underline text-[11px] cursor-pointer hover:text-blue-950 font-medium">
            e-Facturi ({activeInvoices.length})
          </span>
          <span className="hidden sm:inline text-blue-800 underline text-[11px] cursor-pointer hover:text-blue-950 font-medium">
            Alerte ({activeInvoices.filter((i) => !i.hasNir && activeTab === "received").length})
          </span>

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
                {activeTab === "received"
                  ? "Intrari (facturi & bonuri de casa & avize)"
                  : "Iesiri (facturi & bonuri de casa & avize)"}
              </span>
            </div>

            {/* Butoane comutare Intrări / Ieșiri + Window Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-black/20 p-0.5 rounded border border-white/20">
                <button
                  type="button"
                  onClick={() => setActiveTab("received")}
                  className={`px-2 py-0.5 text-[10.5px] font-bold rounded-xs transition-all cursor-pointer ${
                    activeTab === "received"
                      ? "bg-[#FFFFEB] text-slate-950 shadow-xs"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  Intrări ({portalData?.invoices?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("emitted")}
                  className={`px-2 py-0.5 text-[10.5px] font-bold rounded-xs transition-all cursor-pointer ${
                    activeTab === "emitted"
                      ? "bg-[#FFFFEB] text-slate-950 shadow-xs"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  Ieșiri ({portalData?.emittedInvoices?.length || 0})
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
            {/* Butoane acțiune antet SAGA C */}
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
                  className="pl-5 pr-1 py-0.5 w-36 md:w-44 bg-white border border-[#7F9DB9] text-[10.5px] rounded-none focus:outline-none focus:border-[#316AC5] shadow-inner font-sans"
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

              {/* Buton e-Factura SPV */}
              <button
                type="button"
                onClick={onDownloadSagaXml}
                className="flex items-center gap-1 px-2 py-0.5 bg-[#E4EBF2] hover:bg-[#D4E0EC] border-t border-l border-white border-b border-r border-[#808080] text-blue-900 font-bold cursor-pointer shadow-2xs text-[11px]"
                title="Descarcă fișier XML 100% conform importului SAGA C"
              >
                <Download className="w-3 h-3 text-[#1F4E79]" />
                <span>e-Factura XML</span>
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

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-600 font-mono hidden md:inline">
                {activeInvoices.length} doc. găsite
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
              3. ZONA SUPERIOARĂ: GRILA ANTET DOCUMENT (IDENTICĂ SAGA C 3.0.605)
          ═════════════════════════════════════════════════════════════════════ */}
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
                  <th className="py-0.5 px-1.5 text-center w-28 font-normal">ID incarcare SPV</th>
                </tr>
              </thead>
              <tbody>
                {activeInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="py-10 text-center text-slate-500 italic bg-white">
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

                        {/* Furnizor / Client */}
                        <td
                          className="py-0.5 px-2 border-r border-[#D3D3D3] truncate max-w-[240px]"
                          title={`${partnerName} (${partnerCui || "fără CUI"})`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{partnerName}</span>
                            {partnerCui && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyCui(partnerCui);
                                }}
                                className={`text-[9px] px-1 rounded opacity-70 hover:opacity-100 ${
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
                        <td className="py-0.5 px-1.5 text-center font-mono text-[10.5px]">
                          {inv.spvIndex ? (
                            <span
                              className={`underline ${isSelected ? "text-amber-200" : "text-blue-900"}`}
                              title={`Index încărcare ANAF e-Factura: ${inv.spvIndex}`}
                            >
                              {inv.spvIndex}
                            </span>
                          ) : (
                            <span className="opacity-40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════
              4. BANDA INTERMEDIARĂ SAGA C: DOCUMENT SELECTAT (RECAPITULARE)
              (Bara orizontală cu căsuțe de input ce afișează linia activă)
          ═════════════════════════════════════════════════════════════════════ */}
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

            {selectedInvoice?.hasNir && (
              <button
                type="button"
                onClick={() => onViewNirPdf(selectedInvoice)}
                className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-[#E8F5E9] hover:bg-[#C8E6C9] border border-[#81C784] text-[#1B5E20] font-bold text-[10.5px] cursor-pointer"
                title="Deschide fișa NIR atașată (tasta N)"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                <span>NIR: {selectedInvoice.nirNumber}</span>
              </button>
            )}
          </div>

          {/* ═════════════════════════════════════════════════════════════════════
              5. BARA DE INSTRUMENTE POZIȚII (TOOLBAR LINII ARTICOLE SAGA C)
          ═════════════════════════════════════════════════════════════════════ */}
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

          {/* ═════════════════════════════════════════════════════════════════════
              6. ZONA INFERIOARĂ: GRILA POZIȚII / LINII ARTICOLE (IDENTICĂ SAGA C)
          ═════════════════════════════════════════════════════════════════════ */}
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
                    <th className="py-0.5 px-1 text-right border-r border-[#B0B0B0] w-16 font-normal">Adaos unitar</th>
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
                        <td className="py-0.5 px-1 text-right font-mono border-r border-[#D3D3D3]">
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

          {/* ═════════════════════════════════════════════════════════════════════
              7. BARA DE ACȚIUNI DIN SUBSOLUL FERESTREI (BOTTOM ACTION BAR SAGA C)
          ═════════════════════════════════════════════════════════════════════ */}
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
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            8. BARA DE STARE GLOBALĂ SAGA (STATUS BAR) + WATERMARK SAGASOFT.RO
        ═════════════════════════════════════════════════════════════════════ */}
        <div className="mt-1 flex items-center justify-between text-[11px] text-white/90 select-none">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex items-center gap-3 text-[10.5px]">
            <span className="text-white/70">Navigați cu tastele [↑] / [↓] · [Enter] deschide factura · [N] deschide NIR</span>
            <span className="text-cyan-200/60 font-mono tracking-wide">www.sagasoft.ro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
