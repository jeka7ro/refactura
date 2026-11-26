import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  Info,
  Loader2,
  Lock,
  LockOpen,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { encodeWindows1250Blob, saveWithFilePicker } from "@/lib/fileSave";
import { toast } from "sonner";

export interface SimulatedSagaWarning {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface SimulatedSagaLine {
  nrCrt: number;
  tip: string;
  gestiune: string;
  denumire: string;
  cod: string;
  codeOrigin: "saga_000" | "app_088" | "custom" | "service_none";
  matchType: "exact" | "words_and_price" | "new_088" | "new_custom" | "none";
  matchedWords?: string[];
  matchedPrice?: number | null;
  sagaArticleName?: string | null;
  um: string;
  tvaPercent: number;
  cantitate: number;
  pretUnitar: number;
  valoare: number;
  total: number;
  tvaSuma: number;
  cont: string;
  warnings: SimulatedSagaWarning[];
}

export interface SimulatedSagaDocument {
  docIndex: number;
  nirId: number | null;
  nirNumber: string;
  nrInternSaga: string;
  nrDoc: string;
  furnizorCodSaga: string;
  furnizorNume: string;
  furnizorCui: string;
  isNewSupplier: boolean;
  tvaIncasare: boolean;
  dataDoc: string;
  dataScadenta: string;
  moneda: string;
  curs: number;
  valoare: number;
  tva: number;
  total: number;
  spvIndex: string;
  archiveTotal: number | null;
  gestiuneHeader: string;
  warnings: SimulatedSagaWarning[];
  lines: SimulatedSagaLine[];
}

export interface SagaSimulationResult {
  companyName: string;
  companyCui: string;
  filename: string;
  xml: string;
  documents: SimulatedSagaDocument[];
  summary: {
    totalDocuments: number;
    totalLines: number;
    totalSaga000Count: number;
    totalWordsPriceMatchedCount: number;
    totalNew088Count: number;
    totalWarningsCount: number;
    totalErrorsCount: number;
  };
}

interface SagaImportSimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  data: SagaSimulationResult | null;
}

function formatSagaNumber(val: number, decimals = 2): string {
  const fixed = (Number(val) || 0).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSpaces}.${decPart}`;
}

function formatSagaDate(d?: string): string {
  if (!d) return "";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return d;
}

export function SagaImportSimulatorModal({
  open,
  onOpenChange,
  loading,
  data,
}: SagaImportSimulatorModalProps) {
  const [selectedDocIdx, setSelectedDocIdx] = useState(0);
  const [selectedLineIdx, setSelectedLineIdx] = useState(0);
  const [showRawXml, setShowRawXml] = useState(false);
  const [showWarningsPanel, setShowWarningsPanel] = useState(true);
  const [savingXml, setSavingXml] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedDocIdx(0);
      setSelectedLineIdx(0);
      setShowRawXml(false);
      setShowWarningsPanel(true);
    }
  }, [open, data]);

  const selectedDoc =
    data?.documents && data.documents.length > 0
      ? data.documents[Math.min(selectedDocIdx, data.documents.length - 1)]
      : null;

  const handleSaveXml = async () => {
    if (!data?.xml) return;
    setSavingXml(true);
    try {
      const savedName = await saveWithFilePicker(
        {
          suggestedName: data.filename || "F_EXPORT_NIR.xml",
          acceptMimeType: "text/xml",
          description: "Fișier XML SAGA C",
          extensions: [".xml"],
          pickerId: "saga_nir_xml_export",
        },
        async () => encodeWindows1250Blob(data.xml)
      );
      if (savedName) {
        toast.success(`Fișierul SAGA XML a fost salvat: ${savedName}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Eroare la salvarea fișierului XML");
    } finally {
      setSavingXml(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        style={{ maxWidth: "96vw", width: "1360px", height: "88vh" }}
        className="sm:max-w-[96vw] max-w-[96vw] w-[1360px] h-[88vh] p-0 gap-0 flex flex-col overflow-hidden bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-[20px] shadow-2xl font-sans select-none overscroll-contain"
      >
        {/* ═══════════════════════════════════════════════════════════════════
            1. HEADER BAR — SIMULARE IMPORT SAGA C.3.0
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="h-11 px-4 bg-[#fafafa] dark:bg-[#242426] border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-[6px] bg-[#0071e3]/12 dark:bg-[#0a84ff]/20 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#64d2ff]" />
            </div>
            <DialogTitle className="text-[13px] font-normal text-[#1d1d1f] dark:text-[#f5f5f7] truncate flex items-center gap-2">
              <span className="font-semibold">
                Intrări (facturi &amp; bonuri de casă &amp; avize)
              </span>
              <span className="text-[11.5px] text-[#6e6e73] dark:text-[#98989d] hidden sm:inline">
                — Simulare import SAGA C.3.0 {data?.companyName ? `[${data.companyName}]` : ""}
              </span>
            </DialogTitle>
          </div>

          {/* Right Window Controls + Quick XML Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {data && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRawXml((v) => !v)}
                  className="apple-btn-glass h-7 px-3 text-[11.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-1.5 cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#64d2ff]" />
                  <span>{showRawXml ? "Înapoi la fereastra SAGA" : "Vezi XML generat"}</span>
                </button>
                <button
                  type="button"
                  disabled={savingXml}
                  onClick={handleSaveXml}
                  className="apple-btn-prominent h-7 px-3 text-[11.5px] font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {savingXml ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>Salvează XML în PC</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              title="Închide fereastra"
              className="apple-btn-glass w-7 h-7 flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            2. BODY: LOADING / RAW XML / SAGA C 2-PANE WINDOW
            ═══════════════════════════════════════════════════════════════════ */}
        {loading || !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#6e6e73] dark:text-[#98989d] bg-[#f5f5f7] dark:bg-[#141416]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-medium">
              Se verifică documentele și se construiește fereastra de Intrări SAGA C...
            </p>
          </div>
        ) : showRawXml ? (
          <div className="flex-1 flex flex-col overflow-hidden p-4 bg-[#f5f5f7] dark:bg-[#141416] text-[#1d1d1f] dark:text-[#f5f5f7] select-text">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-black/[0.06] dark:border-white/[0.08] text-xs text-[#6e6e73] dark:text-[#98989d]">
              <span>
                Fișier generat: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">{data.filename}</strong> (Codificare SAGA: Windows-1250)
              </span>
              <span className="tabular-nums">{data.xml.length.toLocaleString("ro-RO")} caractere</span>
            </div>
            <pre className="flex-1 overflow-auto font-sans tabular-nums text-xs leading-relaxed text-[#1d1d1f] dark:text-emerald-300 bg-white dark:bg-[#1c1c1e] p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.08] select-all">
              {data.xml}
            </pre>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f5f7] dark:bg-[#141416] p-2 gap-1.5">
            {/* ───────────────────────────────────────────────────────────────
                TOP SAGA TOOLBAR: Adaug | Modific | Sterg + Status Verificare
                ─────────────────────────────────────────────────────────────── */}
            <div className="min-h-[32px] px-2.5 py-1 bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/[0.06] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
              <div className="flex items-center gap-3 text-[#6e6e73] dark:text-[#98989d]">
                <span><span className="underline">A</span>daug</span>
                <span><span className="underline">M</span>odific</span>
                <span><span className="underline">S</span>terg</span>
                <span className="h-3.5 w-px bg-black/[0.08] dark:bg-white/[0.10] mx-0.5" />
                <Search className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#64d2ff]" />
                <Printer className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#64d2ff]" />
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>

              {/* Compact Simulation Summary Badges */}
              <div className="flex items-center gap-1.5 flex-wrap tabular-nums">
                {data.summary.totalErrorsCount > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ff3b30]/10 text-[#d70015] dark:bg-[#ff453a]/18 dark:text-[#ff6961] border border-[#ff3b30]/20">
                    <XCircle className="w-3.5 h-3.5" />
                    {data.summary.totalErrorsCount} erori
                  </span>
                ) : data.summary.totalWarningsCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowWarningsPanel((v) => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/12 text-amber-800 dark:bg-amber-500/18 dark:text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {data.summary.totalWarningsCount} atenționări ({showWarningsPanel ? "ascunde" : "afișează"})
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Validat fără erori
                  </span>
                )}

                <span className="px-2.5 py-0.5 bg-[#0071e3]/10 text-[#0071e3] dark:bg-[#0a84ff]/18 dark:text-[#64d2ff] border border-[#0071e3]/20 rounded-full text-[11px]">
                  Cod SAGA <b>000...</b>: <b>{data.summary.totalSaga000Count}</b>
                </span>

                {data.summary.totalWordsPriceMatchedCount > 0 && (
                  <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/18 dark:text-indigo-300 border border-indigo-500/20 rounded-full text-[11px] inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Asociate (2+ cuv &amp; preț): <b>{data.summary.totalWordsPriceMatchedCount}</b>
                  </span>
                )}

                <span className="px-2.5 py-0.5 bg-violet-500/10 text-violet-700 dark:bg-violet-500/18 dark:text-violet-300 border border-violet-500/20 rounded-full text-[11px]">
                  Cod nou <b>088...</b>: <b>{data.summary.totalNew088Count}</b>
                </span>
              </div>

              <div className="flex items-center gap-1 text-[#6e6e73] dark:text-[#98989d]">
                <span className="px-2 py-0.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-md text-[10px]">
                  &lt;&lt;
                </span>
                <span className="px-2 py-0.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-md text-[11px] text-[#1d1d1f] dark:text-[#ebebf5]">
                  <span className="underline">D</span>etalii
                </span>
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────────────
                TOP GRID: MASTER TABLE (Intrari - exact 14 columns as in SAGA C)
                ─────────────────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/[0.06] dark:border-white/[0.08] overflow-auto h-[175px] shrink-0">
              <table className="w-full border-collapse text-[11.5px] font-sans table-fixed">
                <thead className="bg-[#fafafa] dark:bg-[#242426] sticky top-0 z-10 border-b border-black/[0.06] dark:border-white/[0.08] text-[#6e6e73] dark:text-[#98989d] font-medium">
                  <tr>
                    <th className="w-[26px] py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-center"></th>
                    <th className="w-[36px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">Tip</th>
                    <th className="w-[78px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">Nr. int.</th>
                    <th className="w-[125px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">Nr. doc.</th>
                    <th className="w-[58px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">Cod</th>
                    <th className="px-2 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">Furnizor</th>
                    <th className="w-[44px] px-1 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-center font-medium">TVA I</th>
                    <th className="w-[84px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-center font-medium">
                      Data <span className="text-[#0071e3] dark:text-[#64d2ff] text-[9px]">▲</span>
                    </th>
                    <th className="w-[84px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-center font-medium">Scadent</th>
                    <th className="w-[92px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">Valoare</th>
                    <th className="w-[76px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">Repartizat</th>
                    <th className="w-[78px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">TVA</th>
                    <th className="w-[92px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">Total</th>
                    <th className="w-[92px] px-1.5 py-1.5 text-right font-medium">Neachitat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                  {data.documents.map((doc, idx) => {
                    const isSelected = idx === selectedDocIdx;
                    const hasWarnings =
                      doc.warnings.some((w) => w.level === "warning" || w.level === "error") ||
                      doc.lines.some((l) => l.warnings.some((w) => w.level === "warning" || w.level === "error"));

                    return (
                      <tr
                        key={`${doc.docIndex}-${doc.nrDoc}`}
                        onClick={() => {
                          setSelectedDocIdx(idx);
                          setSelectedLineIdx(0);
                        }}
                        className={`cursor-pointer h-[26px] transition-colors ${
                          isSelected
                            ? "bg-[#0071e3]/[0.10] dark:bg-[#0a84ff]/[0.20] text-[#1d1d1f] dark:text-white"
                            : "hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.04] text-[#1d1d1f] dark:text-[#ebebf5]"
                        }`}
                      >
                        <td className="px-1 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            {isSelected && <span className="text-[9px] text-[#0071e3] dark:text-[#64d2ff] leading-none">▶</span>}
                            {hasWarnings ? (
                              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 inline shrink-0" />
                            ) : (
                              <Lock className="w-3 h-3 text-amber-600/80 dark:text-amber-400/80 inline shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] truncate text-[#6e6e73] dark:text-[#98989d]">
                          {doc.moneda !== "RON" ? doc.moneda : ""}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] truncate">
                          {doc.nrInternSaga}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] truncate font-medium">
                          {doc.nrDoc}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] truncate">
                          {doc.isNewSupplier ? (
                            <span className="text-amber-700 dark:text-amber-400 font-bold" title="Furnizor nou în SAGA">
                              NOU
                            </span>
                          ) : (
                            doc.furnizorCodSaga
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] truncate font-sans">
                          {doc.furnizorNume}
                        </td>
                        <td className="px-1 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-center">
                          <input
                            type="checkbox"
                            checked={doc.tvaIncasare}
                            readOnly
                            className="h-3 w-3 align-middle pointer-events-none"
                          />
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-center">
                          {formatSagaDate(doc.dataDoc)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-center">
                          {formatSagaDate(doc.dataScadenta)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right font-semibold">
                          {formatSagaNumber(doc.valoare, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right text-[#6e6e73] dark:text-[#98989d]">
                          0.00
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right">
                          {formatSagaNumber(doc.tva, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {formatSagaNumber(doc.total, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 text-right font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {formatSagaNumber(doc.total, 2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ───────────────────────────────────────────────────────────────
                MIDDLE SAGA BAR
                ─────────────────────────────────────────────────────────────── */}
            {selectedDoc && (
              <div className="flex flex-col gap-1 shrink-0">
                {/* Row 1: The 4 SAGA C boxes + inline warning pills */}
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-[11px]">
                  <div className="w-[82px] h-6 px-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-md flex items-center text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums truncate">
                    {selectedDoc.nrInternSaga}
                  </div>
                  <div className="w-[125px] h-6 px-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-md flex items-center text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums truncate">
                    {selectedDoc.nrDoc}
                  </div>
                  <div className="w-[58px] h-6 px-2 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-md flex items-center text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums truncate">
                    {selectedDoc.isNewSupplier ? "NOU" : selectedDoc.furnizorCodSaga}
                  </div>
                  <div className="w-[260px] h-6 px-2.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-md flex items-center text-[#1d1d1f] dark:text-[#f5f5f7] font-medium truncate">
                    {selectedDoc.furnizorNume}
                  </div>

                  {/* Inline compact warnings */}
                  {showWarningsPanel && selectedDoc.warnings.length > 0 && (
                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                      {selectedDoc.warnings.map((w, i) => (
                        <div
                          key={i}
                          title={w.message}
                          className={`px-2.5 py-0.5 rounded-full border text-[11px] flex items-center gap-1 shrink-0 ${
                            w.level === "error"
                              ? "bg-[#ff3b30]/10 border-[#ff3b30]/25 text-[#d70015] dark:text-[#ff6961]"
                              : w.level === "warning"
                              ? "bg-amber-500/12 border-amber-500/25 text-amber-800 dark:text-amber-300"
                              : "bg-[#0071e3]/10 border-[#0071e3]/20 text-[#0071e3] dark:text-[#64d2ff]"
                          }`}
                        >
                          {w.level === "error" ? (
                            <XCircle className="w-3 h-3 shrink-0" />
                          ) : w.level === "warning" ? (
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                          ) : (
                            <Info className="w-3 h-3 shrink-0" />
                          )}
                          <span>{w.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Row 2: SAGA C Detail Toolbar */}
                <div className="h-7 px-2.5 bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-[11px] text-[#6e6e73] dark:text-[#98989d]">
                  <div className="flex items-center gap-3">
                    <span className="opacity-60">
                      <span className="underline">A</span>daug
                    </span>
                    <span className="opacity-60">
                      <span className="underline">M</span>odific
                    </span>
                    <span className="opacity-60">
                      <span className="underline">S</span>terg
                    </span>
                    <Search className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#64d2ff]" />
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[#1d1d1f] dark:text-[#ebebf5]">
                      S<span className="underline">e</span>rii &gt;&gt;
                    </span>
                    <span className="text-[#1d1d1f] dark:text-[#ebebf5]">
                      Prețuri vânzare &gt;&gt;
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[#1d1d1f] dark:text-[#ebebf5]">
                      <span className="underline">B</span>on de consum...
                    </span>
                    <span className="text-[#1d1d1f] dark:text-[#ebebf5] hidden sm:inline">
                      Facturi asociate (transport)...
                    </span>
                    <span className="px-2 py-0.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] rounded-md text-[11px] text-[#1d1d1f] dark:text-[#ebebf5]">
                      <span className="underline">D</span>etalii
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ───────────────────────────────────────────────────────────────
                BOTTOM GRID: DETAIL LINES TABLE (Exact 12 SAGA C columns!)
                ─────────────────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/[0.06] dark:border-white/[0.08] flex-1 overflow-auto min-h-[220px]">
              <table className="w-full border-collapse text-[11.5px] font-sans table-fixed">
                <thead className="bg-[#fafafa] dark:bg-[#242426] sticky top-0 z-10 border-b border-black/[0.06] dark:border-white/[0.08] text-[#6e6e73] dark:text-[#98989d] font-medium">
                  <tr>
                    <th className="w-[22px] py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-center"></th>
                    <th className="w-[135px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">Tip</th>
                    <th className="w-[125px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">Gestiune</th>
                    <th className="px-2 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">
                      Denumire articol / serviciu
                    </th>
                    <th className="w-[130px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">Cod</th>
                    <th className="w-[48px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-left font-medium">UM</th>
                    <th className="w-[42px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">TVA</th>
                    <th className="w-[82px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">Cantitate</th>
                    <th className="w-[88px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">
                      Preț unitar
                    </th>
                    <th className="w-[82px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">Valoare</th>
                    <th className="w-[82px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">Total</th>
                    <th className="w-[74px] px-1.5 py-1.5 border-r border-black/[0.05] dark:border-white/[0.06] text-right font-medium">TVA</th>
                    <th className="w-[86px] px-1.5 py-1.5 text-right font-medium">Nedeductibil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06] tabular-nums">
                  {selectedDoc?.lines.map((line, idx) => {
                    const isLineSelected = idx === selectedLineIdx;
                    return (
                      <tr
                        key={line.nrCrt}
                        onClick={() => setSelectedLineIdx(idx)}
                        className={`cursor-pointer h-[26px] transition-colors ${
                          isLineSelected
                            ? "bg-[#0071e3]/[0.10] dark:bg-[#0a84ff]/[0.20] text-[#1d1d1f] dark:text-white"
                            : "hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.04] text-[#1d1d1f] dark:text-[#ebebf5]"
                        }`}
                      >
                        <td className="px-0.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-center">
                          {isLineSelected && <span className="text-[9px] text-[#0071e3] dark:text-[#64d2ff] leading-none">▶</span>}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] truncate font-sans" title={`Cont: ${line.cont}`}>
                          {line.tip}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] truncate font-sans">
                          {line.gestiune ? (
                            line.gestiune
                          ) : line.codeOrigin === "service_none" ? (
                            ""
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-semibold text-[10px]">
                              (fără gestiune)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] truncate font-sans" title={line.denumire}>
                          <div className="flex items-center justify-between gap-2 truncate">
                            <span className="truncate">{line.denumire}</span>
                            {line.matchType === "words_and_price" && line.sagaArticleName && (
                              <span
                                className="px-1.5 py-0.5 rounded-md bg-indigo-500/12 text-indigo-800 dark:text-indigo-300 border border-indigo-500/25 text-[10px] shrink-0"
                                title={`Asociat cu articolul SAGA "${line.sagaArticleName}" (cuvinte comune: ${(line.matchedWords || []).join(", ")})`}
                              >
                                ≈ {line.sagaArticleName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] tabular-nums">
                          {line.cod ? (
                            <div className="flex items-center justify-between gap-1">
                              <span>{line.cod}</span>
                              {line.matchType === "words_and_price" ? (
                                <span
                                  className="px-1.5 rounded-md text-[9px] font-sans font-bold bg-indigo-500/12 text-indigo-700 dark:text-indigo-300"
                                  title="Asociat automat: 2+ cuvinte comune + același preț"
                                >
                                  2+CUV
                                </span>
                              ) : line.codeOrigin === "app_088" ? (
                                <span
                                  className="px-1.5 rounded-md text-[9px] font-sans font-bold bg-violet-500/12 text-violet-700 dark:text-violet-300"
                                  title="Articol nou creat automat cu cod 088xxxxx"
                                >
                                  088
                                </span>
                              ) : line.codeOrigin === "saga_000" ? (
                                <span
                                  className="px-1.5 rounded-md text-[9px] font-sans font-bold bg-[#0071e3]/12 text-[#0071e3] dark:text-[#64d2ff]"
                                  title="Cod existent în SAGA C (000xxxxx)"
                                >
                                  SAGA
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] uppercase text-[#6e6e73] dark:text-[#98989d]">
                          {line.um}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right">
                          {line.tvaPercent}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right">
                          {formatSagaNumber(line.cantitate, 3)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right">
                          {formatSagaNumber(line.pretUnitar, 4)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right">
                          {formatSagaNumber(line.valoare, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {formatSagaNumber(line.total, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-black/[0.04] dark:border-white/[0.05] text-right">
                          {formatSagaNumber(line.tvaSuma, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 text-right text-[#6e6e73] dark:text-[#98989d]">
                          Cont {line.cont}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ───────────────────────────────────────────────────────────────
                BOTTOM SAGA C FOOTER BAR
                ─────────────────────────────────────────────────────────────── */}
            <div className="min-h-[40px] px-3 py-1.5 bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/[0.06] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 shrink-0 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  disabled
                  className="h-7 px-3 bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#8e8e93] rounded-full flex items-center gap-1 opacity-70"
                >
                  <Lock className="w-3 h-3 text-amber-600/70" />
                  Validez
                </button>
                <button
                  type="button"
                  disabled
                  className="h-7 px-3 bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] rounded-full opacity-70"
                >
                  <span className="underline">P</span>lată...
                </button>
                <button
                  type="button"
                  disabled
                  className="h-7 px-3 bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] rounded-full opacity-70"
                >
                  Storne<span className="underline">z</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="h-7 px-3 bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] rounded-full opacity-70"
                >
                  <span className="underline">N</span>.C....
                </button>
                <button
                  type="button"
                  disabled
                  className="h-7 px-3 bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] rounded-full opacity-70"
                >
                  <span className="underline">T</span>ipărire...
                </button>
                <button
                  type="button"
                  disabled
                  className="h-7 px-3 bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] rounded-full flex items-center gap-1 opacity-70"
                >
                  <LockOpen className="w-3 h-3 text-amber-600/80" />
                  De<span className="underline">v</span>alidez
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingXml}
                  onClick={handleSaveXml}
                  className="apple-btn-prominent h-7 px-3.5 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {savingXml ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>Salvează XML pentru SAGA C (Alege calea...)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="apple-btn-glass h-7 px-3.5 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff3b30] text-white flex items-center justify-center text-[8px] font-bold">
                    −
                  </span>
                  <span><span className="underline">I</span>eșire</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
