import { useState, useMemo, useEffect, useRef } from "react";
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
  ExternalLink,
  Layers,
  Sparkles,
  Eye,
  Calendar,
  X,
  RefreshCw,
  FolderArchive,
  BookOpen,
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

function formatSagaDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
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
  const [copiedCui, setCopiedCui] = useState<string | null>(null);

  const activeInvoices = activeTab === "received" ? filteredInvoices : filteredEmittedInvoices;

  // Asigurăm că avem mereu o factură selectată (prima din listă)
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

  // Navigare prin tastatură (Săgeți Sus/Jos pentru facturi, Enter pentru PDF)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Dacă este într-un input, nu interceptăm
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = activeInvoices.findIndex((i) => i.id === selectedInvoiceId);
        if (idx >= 0 && idx < activeInvoices.length - 1) {
          setSelectedInvoiceId(activeInvoices[idx + 1].id);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = activeInvoices.findIndex((i) => i.id === selectedInvoiceId);
        if (idx > 0) {
          setSelectedInvoiceId(activeInvoices[idx - 1].id);
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

  return (
    <div className="min-h-screen bg-[#EBECEF] text-slate-900 font-sans flex flex-col select-none text-[12px] antialiased">
      {/* ── 1. BARA DE TITLU FEREASTRĂ SAGA C ── */}
      <div className="bg-gradient-to-r from-[#1B365D] via-[#1F4E79] to-[#285A8E] text-white px-3 py-1.5 flex items-center justify-between shadow-sm border-b border-[#0F284A] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-white/15 border border-white/30 flex items-center justify-center font-bold text-[10px] text-amber-300">
            SC
          </div>
          <span className="font-bold text-xs tracking-wide truncate">
            SAGA C 3.0 — [{company.name || "Societate"} · CUI: {company.cui || "—"}] —{" "}
            <span className="text-amber-300 uppercase">
              {activeTab === "received" ? "INTRĂRI (Facturi primite de la furnizori)" : "IEȘIRI (Facturi emise către clienți)"}
            </span>
          </span>
        </div>

        {/* Butoane Bara de Titlu: Comutator Mod Modern & Deconectare */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSwitchToModern}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold shadow-xs transition-colors cursor-pointer border border-amber-500"
            title="Comută la vederea modernă cu carduri și grafice"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>Comută la Mod Modern</span>
          </button>

          <button
            type="button"
            onClick={onLockSession}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors cursor-pointer border border-white/20"
            title="Închide sesiunea de acces contabil"
          >
            <Lock className="w-3 h-3" />
            <span>Ieșire</span>
          </button>
        </div>
      </div>

      {/* ── 2. BARA DE MENIU & COMENZI SAGA C ── */}
      <div className="bg-[#ECE9D8] border-b border-[#BDC7D1] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs shrink-0">
        {/* Butoane Navigare Secțiuni (Intrări / Ieșiri) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("received")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer border ${
              activeTab === "received"
                ? "bg-[#1F4E79] text-white border-[#102A43] shadow-xs"
                : "bg-white text-slate-700 hover:bg-slate-100 border-[#BDC7D1]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Intrări (Furnizori)</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "received" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {portalData?.invoices?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("emitted")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer border ${
              activeTab === "emitted"
                ? "bg-[#1F4E79] text-white border-[#102A43] shadow-xs"
                : "bg-white text-slate-700 hover:bg-slate-100 border-[#BDC7D1]"
            }`}
          >
            <FileOutput className="w-3.5 h-3.5" />
            <span>Ieșiri (Clienți)</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "emitted" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {portalData?.emittedInvoices?.length || 0}
            </span>
          </button>

          <span className="w-px h-5 bg-[#BDC7D1] mx-1" />

          {/* Butoane Acțiuni SAGA C */}
          {selectedInvoice && (
            <button
              type="button"
              onClick={() => onViewInvoicePdf(selectedInvoice)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-blue-50 text-blue-900 border border-[#A2B5CD] font-bold text-xs shadow-2xs transition-colors cursor-pointer"
              title="Vizualizează factura fiscală în format PDF (sau apăsați Enter)"
            >
              <Eye className="w-3.5 h-3.5 text-blue-700" />
              <span>Vizualizare PDF</span>
            </button>
          )}

          {selectedInvoice?.hasNir && (
            <button
              type="button"
              onClick={() => onViewNirPdf(selectedInvoice)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
              title="Vizualizează Nota de Recepție și Constatare de Diferențe (sau tasta N)"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>NIR: {selectedInvoice.nirNumber}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDownloadSagaXml}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#E4EBF2] hover:bg-[#D4E0EC] text-[#1E3A5F] border border-[#B0C4DE] font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            title="Generează și descarcă fișierul XML compatibil 100% cu importul SAGA C"
          >
            <Download className="w-3.5 h-3.5 text-[#1F4E79]" />
            <span>Export XML SAGA</span>
          </button>

          <button
            type="button"
            onClick={activeTab === "received" ? onExportExcel : onExportEmittedExcel}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-800 border border-[#BDC7D1] font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
            title="Exportă tabelul curent în fișier Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={onDownloadZip}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-800 border border-[#BDC7D1] font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
            title="Descarcă toate documentele selectate într-o arhivă ZIP"
          >
            <FolderArchive className="w-3.5 h-3.5 text-amber-600" />
            <span>Pachet ZIP</span>
          </button>
        </div>

        {/* Filtre Rapide SAGA C */}
        <div className="flex items-center gap-2">
          {/* Căutare rapidă */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={activeTab === "received" ? search : searchEmitted}
              onChange={(e) =>
                activeTab === "received" ? setSearch(e.target.value) : setSearchEmitted(e.target.value)
              }
              placeholder="Caută partener, CUI, nr..."
              className="pl-7 pr-2 py-0.5 w-48 bg-white border border-[#BDC7D1] rounded text-[11px] placeholder:text-slate-400 focus:outline-none focus:border-[#1F4E79]"
            />
          </div>

          {/* Filtru Perioadă */}
          {activeTab === "received" ? (
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="px-2 py-0.5 bg-white border border-[#BDC7D1] rounded text-[11px] font-medium focus:outline-none focus:border-[#1F4E79]"
            >
              <option value="all">Toată perioada</option>
              <option value="current_month">Luna curentă</option>
              <option value="last_month">Luna trecută</option>
              <option value="last_3_months">Ultimele 3 luni</option>
              <option value="current_year">Anul curent (2026)</option>
            </select>
          ) : (
            <select
              value={periodEmitted}
              onChange={(e) => setPeriodEmitted(e.target.value as any)}
              className="px-2 py-0.5 bg-white border border-[#BDC7D1] rounded text-[11px] font-medium focus:outline-none focus:border-[#1F4E79]"
            >
              <option value="all">Toată perioada</option>
              <option value="current_month">Luna curentă</option>
              <option value="last_month">Luna trecută</option>
              <option value="last_3_months">Ultimele 3 luni</option>
              <option value="current_year">Anul curent (2026)</option>
            </select>
          )}

          {/* Filtru NIR (doar la Intrări) */}
          {activeTab === "received" && (
            <select
              value={nirFilter}
              onChange={(e) => setNirFilter(e.target.value as any)}
              className="px-2 py-0.5 bg-white border border-[#BDC7D1] rounded text-[11px] font-medium focus:outline-none focus:border-[#1F4E79]"
            >
              <option value="all">NIR: Toate</option>
              <option value="cu_nir">Doar Cu NIR</option>
              <option value="fara_nir">Fără NIR</option>
            </select>
          )}
        </div>
      </div>

      {/* ── 3. ZONA SPLIT: TABELUL DE SUS (ANTET DOCUMENTE) ── */}
      <div className="flex-1 min-h-[300px] max-h-[50vh] flex flex-col bg-white border-b-2 border-[#1F4E79] overflow-hidden">
        {/* Antet tabel SAGA */}
        <div className="bg-[#D9E2EC] border-b border-[#BDC7D1] px-3 py-1 flex items-center justify-between text-[11px] font-bold text-[#102A43] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1F4E79]" />
            <span>
              {activeTab === "received" ? "Antet Intrări — Facturi Furnizori" : "Antet Ieșiri — Facturi Clienți"} (
              {activeInvoices.length} documente găsite)
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-normal italic">
            Navigați cu tastele [↑] / [↓] · [Enter] deschide factura · [N] deschide NIR
          </div>
        </div>

        {/* Grila documentelor */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-[#E8EEF5] text-[#102A43] font-bold text-[10.5px] border-b border-[#BDC7D1] shadow-2xs z-10">
              <tr>
                <th className="py-1 px-1.5 text-center border-r border-[#BDC7D1] w-10">Nr.</th>
                <th className="py-1 px-1.5 text-center border-r border-[#BDC7D1] w-14">Tip</th>
                <th className="py-1 px-2 text-left border-r border-[#BDC7D1] w-28">Număr doc.</th>
                <th className="py-1 px-2 text-center border-r border-[#BDC7D1] w-20">Dată</th>
                <th className="py-1 px-2 text-center border-r border-[#BDC7D1] w-20">Scadență</th>
                <th className="py-1 px-2 text-left border-r border-[#BDC7D1]">
                  {activeTab === "received" ? "Furnizor" : "Client"}
                </th>
                <th className="py-1 px-2 text-left border-r border-[#BDC7D1] w-28">Cod fiscal</th>
                <th className="py-1 px-2 text-right border-r border-[#BDC7D1] w-28">Valoare (fără TVA)</th>
                <th className="py-1 px-2 text-right border-r border-[#BDC7D1] w-24">TVA</th>
                <th className="py-1 px-2 text-right border-r border-[#BDC7D1] w-28 font-extrabold">Total Factură</th>
                <th className="py-1 px-1.5 text-center border-r border-[#BDC7D1] w-20">Cont</th>
                <th className="py-1 px-2 text-center border-r border-[#BDC7D1] w-28">Index SPV</th>
                {activeTab === "received" && (
                  <th className="py-1 px-2 text-center border-r border-[#BDC7D1] w-24">Recepție NIR</th>
                )}
                <th className="py-1 px-1.5 text-center w-16">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {activeInvoices.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400 italic">
                    Nu s-au găsit documente conform filtrelor selectate.
                  </td>
                </tr>
              ) : (
                activeInvoices.map((inv, idx) => {
                  const isSelected = selectedInvoice?.id === inv.id;
                  const partnerName = activeTab === "received" ? inv.supplierName : inv.clientName;
                  const partnerCui = activeTab === "received" ? inv.supplierCUI : inv.clientCUI;
                  const account = activeTab === "received" ? "401.00001" : "4111.00001";

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedInvoiceId(inv.id)}
                      onDoubleClick={() => onViewInvoicePdf(inv)}
                      className={`cursor-pointer border-b border-[#D5DCE2] transition-colors leading-tight ${
                        isSelected
                          ? "bg-[#1F4E79] text-white font-semibold"
                          : idx % 2 === 1
                          ? "bg-[#F7FAFC] hover:bg-[#EBF3FB] text-slate-800"
                          : "bg-white hover:bg-[#EBF3FB] text-slate-800"
                      }`}
                    >
                      <td className="py-1 px-1.5 text-center font-mono border-r border-[#D5DCE2]/80 opacity-80">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-1.5 text-center border-r border-[#D5DCE2]/80">
                        <span
                          className={`px-1 py-0.2 rounded text-[9.5px] uppercase font-bold ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          Factură
                        </span>
                      </td>
                      <td className="py-1 px-2 font-mono font-bold border-r border-[#D5DCE2]/80 truncate">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-1 px-2 text-center font-mono border-r border-[#D5DCE2]/80">
                        {formatSagaDate(inv.issueDate)}
                      </td>
                      <td className="py-1 px-2 text-center font-mono border-r border-[#D5DCE2]/80">
                        {formatSagaDate(inv.dueDate)}
                      </td>
                      <td className="py-1 px-2 border-r border-[#D5DCE2]/80 truncate max-w-[220px]" title={partnerName}>
                        {partnerName}
                      </td>
                      <td className="py-1 px-2 font-mono border-r border-[#D5DCE2]/80">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">{partnerCui || "—"}</span>
                          {partnerCui && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyCui(partnerCui);
                              }}
                              className={`p-0.5 rounded transition-colors ${
                                isSelected ? "hover:bg-white/20 text-white" : "hover:bg-slate-200 text-slate-400"
                              }`}
                              title="Copiază CUI"
                            >
                              {copiedCui === partnerCui ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-1 px-2 text-right font-mono border-r border-[#D5DCE2]/80">
                        {formatSagaCurrency(inv.totalBase)}
                      </td>
                      <td className="py-1 px-2 text-right font-mono border-r border-[#D5DCE2]/80">
                        {formatSagaCurrency(inv.totalVAT)}
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-bold border-r border-[#D5DCE2]/80">
                        {formatSagaCurrency(inv.total)}
                      </td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-[#D5DCE2]/80 text-[10.5px]">
                        {account}
                      </td>
                      <td className="py-1 px-2 text-center font-mono border-r border-[#D5DCE2]/80 text-[10.5px]">
                        {inv.spvIndex ? (
                          <span
                            className={`px-1 py-0.2 rounded font-bold ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                            title={`Index SPV: ${inv.spvIndex}`}
                          >
                            {inv.spvIndex}
                          </span>
                        ) : (
                          <span className="opacity-50">—</span>
                        )}
                      </td>
                      {activeTab === "received" && (
                        <td className="py-1 px-2 text-center border-r border-[#D5DCE2]/80">
                          {inv.hasNir ? (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isSelected
                                  ? "bg-emerald-400 text-slate-950"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              }`}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{inv.nirNumber || "NIR"}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] opacity-60">Fără NIR</span>
                          )}
                        </td>
                      )}
                      <td className="py-1 px-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewInvoicePdf(inv);
                            }}
                            className={`p-1 rounded transition-colors ${
                              isSelected
                                ? "bg-white/20 hover:bg-white/30 text-white"
                                : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                            }`}
                            title="Deschide factura PDF"
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
                              className={`p-1 rounded transition-colors ${
                                isSelected
                                  ? "bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                              }`}
                              title="Deschide fișa NIR"
                            >
                              <CheckCircle2 className="w-3 h-3" />
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
      </div>

      {/* ── 4. ZONA SPLIT: TABELUL DE JOS (LINII / ARTICOLE DOCUMENT SELECTAT) ── */}
      <div className="h-[210px] xl:h-[240px] flex flex-col bg-white shrink-0 overflow-hidden">
        {/* Antet grilă articole */}
        <div className="bg-[#E4EBF2] border-b border-[#BDC7D1] px-3 py-1 flex items-center justify-between text-[11px] font-bold text-[#102A43] shrink-0">
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-[#1F4E79]" />
            <span>
              Poziții articol / serviciu aferente facturii:{" "}
              <strong className="text-[#1F4E79]">
                {selectedInvoice?.invoiceNumber || "—"}
              </strong>{" "}
              ({activeTab === "received" ? selectedInvoice?.supplierName : selectedInvoice?.clientName})
            </span>
          </div>

          {selectedInvoice && (
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span>
                Valoare fără TVA: <strong>{formatSagaCurrency(selectedInvoice.totalBase)} RON</strong>
              </span>
              <span>·</span>
              <span>
                TVA: <strong>{formatSagaCurrency(selectedInvoice.totalVAT)} RON</strong>
              </span>
              <span>·</span>
              <span className="text-[#1F4E79]">
                Total: <strong>{formatSagaCurrency(selectedInvoice.total)} RON</strong>
              </span>
            </div>
          )}
        </div>

        {/* Tabel poziții */}
        <div className="flex-1 overflow-auto bg-[#FAFAFA]">
          {isLinesLoading ? (
            <div className="h-full flex items-center justify-center gap-2 text-slate-400 text-xs py-8">
              <Loader2 className="w-4 h-4 animate-spin text-[#1F4E79]" />
              <span>Se încarcă articolele facturii din SAGA...</span>
            </div>
          ) : documentLines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-6">
              <BookOpen className="w-6 h-6 mb-1 text-slate-300" />
              <span>Documentul este centralizat la nivel de antet fiscal.</span>
              <span className="text-[10.5px] text-slate-400 mt-0.5">
                Pentru detalii pe linii, consultați fișierul PDF oficial atașat sau exportați XML SAGA.
              </span>
            </div>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-[#F0F4F8] text-[#102A43] font-bold text-[10px] border-b border-[#BDC7D1] z-10">
                <tr>
                  <th className="py-1 px-1.5 text-center border-r border-[#BDC7D1] w-10">Nr.</th>
                  <th className="py-1 px-2 text-left border-r border-[#BDC7D1] w-24">Tip articol</th>
                  <th className="py-1 px-2 text-left border-r border-[#BDC7D1]">Denumire articol / serviciu</th>
                  <th className="py-1 px-1.5 text-center border-r border-[#BDC7D1] w-14">U.M.</th>
                  <th className="py-1 px-2 text-right border-r border-[#BDC7D1] w-20">Cantitate</th>
                  <th className="py-1 px-2 text-right border-r border-[#BDC7D1] w-24">Preț unitar</th>
                  <th className="py-1 px-2 text-right border-r border-[#BDC7D1] w-28">Valoare</th>
                  <th className="py-1 px-1.5 text-center border-r border-[#BDC7D1] w-16">% TVA</th>
                  <th className="py-1 px-2 text-right border-r border-[#BDC7D1] w-24">TVA</th>
                  <th className="py-1 px-2 text-right border-r border-[#BDC7D1] w-28 font-bold">Total</th>
                  <th className="py-1 px-2 text-center border-r border-[#BDC7D1] w-20">Cont stoc/ch</th>
                </tr>
              </thead>
              <tbody>
                {documentLines.map((line: any, idx: number) => (
                  <tr
                    key={idx}
                    className={`border-b border-[#E2E8F0] ${idx % 2 === 1 ? "bg-white" : "bg-[#F8FAFC]"} hover:bg-amber-50/70`}
                  >
                    <td className="py-1 px-1.5 text-center font-mono border-r border-[#E2E8F0] text-slate-500">
                      {line.lineOrder || idx + 1}
                    </td>
                    <td className="py-1 px-2 border-r border-[#E2E8F0] font-medium text-slate-700">
                      {line.type || "Mărfuri"}
                    </td>
                    <td className="py-1 px-2 border-r border-[#E2E8F0] font-medium text-slate-900 truncate max-w-[340px]" title={line.description}>
                      {line.description}
                    </td>
                    <td className="py-1 px-1.5 text-center border-r border-[#E2E8F0] font-mono text-slate-600">
                      {line.unit || "buc"}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r border-[#E2E8F0]">
                      {line.quantity?.toFixed ? line.quantity.toFixed(2) : line.quantity}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r border-[#E2E8F0]">
                      {formatSagaCurrency(line.unitPrice)}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r border-[#E2E8F0]">
                      {formatSagaCurrency(line.quantity * line.unitPrice)}
                    </td>
                    <td className="py-1 px-1.5 text-center font-mono border-r border-[#E2E8F0]">
                      {line.vatRate ? `${Math.round(line.vatRate)}%` : "21%"}
                    </td>
                    <td className="py-1 px-2 text-right font-mono border-r border-[#E2E8F0]">
                      {formatSagaCurrency(line.total - line.quantity * line.unitPrice)}
                    </td>
                    <td className="py-1 px-2 text-right font-mono font-bold border-r border-[#E2E8F0] text-[#1F4E79]">
                      {formatSagaCurrency(line.total)}
                    </td>
                    <td className="py-1 px-2 text-center font-mono font-bold text-slate-700 border-r border-[#E2E8F0]">
                      {line.account || "371"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── 5. BARA DE STARE SAGA C (FOOTER STATUS BAR) ── */}
      <div className="bg-[#D9E2EC] border-t border-[#BDC7D1] px-4 py-1.5 flex flex-wrap items-center justify-between text-[11px] font-medium text-[#102A43] shrink-0">
        <div className="flex items-center gap-4">
          <span>
            Total documente: <strong className="font-mono text-xs">{currentKpiData.totalCount}</strong>
          </span>
          <span>·</span>
          <span>
            Valoare Bază: <strong className="font-mono text-xs">{formatSagaCurrency(currentKpiData.totalBase)} RON</strong>
          </span>
          <span>·</span>
          <span>
            TVA: <strong className="font-mono text-xs">{formatSagaCurrency(currentKpiData.totalVat)} RON</strong>
          </span>
          <span>·</span>
          <span>
            Total General:{" "}
            <strong className="font-mono text-xs text-[#1F4E79]">
              {formatSagaCurrency(currentKpiData.totalGross)} RON
            </strong>
          </span>

          {activeTab === "received" && (
            <>
              <span>·</span>
              <span className="text-emerald-800">
                NIR-uri:{" "}
                <strong className="font-mono">
                  {currentKpis.withNirCount} / {currentKpis.totalCount} ({currentKpis.nirCoveragePercent}%)
                </strong>
              </span>
            </>
          )}
        </div>

        <div className="text-[10px] text-slate-600 font-mono">
          Filtru: <strong>{period === "all" ? "Toate" : period}</strong> · XML SAGA C Compatibil v3.0
        </div>
      </div>
    </div>
  );
}
