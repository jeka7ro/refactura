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
        className="sm:max-w-[96vw] max-w-[96vw] w-[1360px] h-[88vh] p-0 gap-0 flex flex-col overflow-hidden bg-[#d9e4f1] border-2 border-[#6b90b2] rounded-[4px] shadow-2xl font-sans select-none"
      >
        {/* ═══════════════════════════════════════════════════════════════════
            1. FERESTRĂ WINDOWS / SAGA C TITLE BAR
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="h-8 px-2.5 bg-gradient-to-b from-[#e9f1fb] via-[#d2e2f5] to-[#b9d1ea] border-b border-[#8ba8c7] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-4 h-4 rounded-[2px] bg-[#0f548c] flex items-center justify-center shadow-xs shrink-0">
              <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
            </div>
            <DialogTitle className="text-[12px] font-normal text-slate-900 truncate flex items-center gap-2">
              <span className="font-semibold">
                Intrari (facturi &amp; bonuri de casa &amp; avize)
              </span>
              <span className="text-[11px] text-slate-600">
                — Simulare Import SAGA C.3.0 {data?.companyName ? `[${data.companyName}]` : ""}
              </span>
            </DialogTitle>
          </div>

          {/* Right Window Controls + Quick XML Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {data && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRawXml((v) => !v)}
                  className="h-6 px-2.5 rounded-[2px] text-[11px] font-medium bg-[#f4f7fb] hover:bg-white text-slate-800 border border-[#7f9db9] shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-[#0f548c]" />
                  {showRawXml ? "Înapoi la Fereastra SAGA" : "Vezi XML generat"}
                </button>
                <button
                  type="button"
                  disabled={savingXml}
                  onClick={handleSaveXml}
                  className="h-6 px-2.5 rounded-[2px] text-[11px] font-semibold bg-[#15803d] hover:bg-[#166534] text-white border border-[#14532d] shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  {savingXml ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  Salvează XML în PC
                </button>
              </>
            )}

            {/* Classic Windows Minimize / Maximize / Red Close button */}
            <div className="flex items-center ml-2 border border-[#7f9db9] rounded-[2px] overflow-hidden">
              <span className="w-6 h-5 bg-gradient-to-b from-[#f4f8fc] to-[#d3e2f2] border-r border-[#7f9db9] flex items-center justify-center text-[10px] text-slate-600">
                _
              </span>
              <span className="w-6 h-5 bg-gradient-to-b from-[#f4f8fc] to-[#d3e2f2] border-r border-[#7f9db9] flex items-center justify-center text-[10px] text-slate-600">
                □
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                title="Închide fereastra"
                className="w-8 h-5 bg-gradient-to-b from-[#e87975] via-[#d9443f] to-[#b9241e] hover:brightness-110 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            2. BODY: LOADING / RAW XML / SAGA C 2-PANE WINDOW
            ═══════════════════════════════════════════════════════════════════ */}
        {loading || !data ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-700 bg-[#eef3f9]">
            <Loader2 className="w-8 h-8 animate-spin text-[#0f548c]" />
            <p className="text-xs font-semibold">
              Se verifică documentele și se construiește fereastra de Intrări SAGA C...
            </p>
          </div>
        ) : showRawXml ? (
          <div className="flex-1 flex flex-col overflow-hidden p-3 bg-slate-900 text-slate-100 select-text">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700 text-xs text-slate-400">
              <span>
                Fișier generat: <strong className="text-white font-mono">{data.filename}</strong> (Codificare SAGA: Windows-1250)
              </span>
              <span>{data.xml.length.toLocaleString("ro-RO")} caractere</span>
            </div>
            <pre className="flex-1 overflow-auto font-mono text-xs leading-relaxed text-emerald-300 bg-slate-950 p-4 rounded border border-slate-800 select-all">
              {data.xml}
            </pre>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#f0f4f9] p-1.5 gap-1">
            {/* ───────────────────────────────────────────────────────────────
                TOP SAGA TOOLBAR: Adaug | Modific | Sterg + Status Verificare
                ─────────────────────────────────────────────────────────────── */}
            <div className="h-7 px-2 bg-[#f5f7fa] border border-[#b8c7d9] flex items-center justify-between text-[11px] shrink-0">
              <div className="flex items-center gap-3 text-slate-500">
                <span className="underline decoration-slate-400">A</span>daug
                <span className="underline decoration-slate-400">M</span>odific
                <span className="underline decoration-slate-400">S</span>terg
                <span className="h-4 w-px bg-slate-300 mx-0.5" />
                <Search className="w-3.5 h-3.5 text-[#1d639e]" />
                <Printer className="w-3.5 h-3.5 text-[#1d639e]" />
                <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
              </div>

              {/* Compact Simulation Summary Badges */}
              <div className="flex items-center gap-2">
                {data.summary.totalErrorsCount > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-bold bg-red-100 text-red-800 border border-red-300">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    {data.summary.totalErrorsCount} erori
                  </span>
                ) : data.summary.totalWarningsCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowWarningsPanel((v) => !v)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-400 hover:bg-amber-200 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    {data.summary.totalWarningsCount} atenționări ({showWarningsPanel ? "ascunde" : "afișează"})
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Validat fără erori
                  </span>
                )}

                <span className="px-2 py-0.5 bg-sky-50 text-sky-900 border border-sky-300 rounded-[2px] text-[11px]">
                  Cod SAGA <b>000...</b>: <b>{data.summary.totalSaga000Count}</b>
                </span>

                {data.summary.totalWordsPriceMatchedCount > 0 && (
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-300 rounded-[2px] text-[11px] inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    Asociate (2+ cuv &amp; preț): <b>{data.summary.totalWordsPriceMatchedCount}</b>
                  </span>
                )}

                <span className="px-2 py-0.5 bg-violet-50 text-violet-900 border border-violet-300 rounded-[2px] text-[11px]">
                  Cod Nou Aplicație <b>088...</b>: <b>{data.summary.totalNew088Count}</b>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-gradient-to-b from-white to-slate-200 border border-slate-400 text-[10px] text-slate-700">
                  &lt;&lt;
                </span>
                <span className="px-2 py-0.5 bg-gradient-to-b from-white to-slate-200 border border-slate-400 text-[11px] text-slate-800">
                  <span className="underline">D</span>etalii
                </span>
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────────────
                TOP GRID: MASTER TABLE (Intrari - exact 14 columns as in SAGA C)
                ─────────────────────────────────────────────────────────────── */}
            <div className="bg-white border border-[#7f9db9] overflow-auto h-[175px] shrink-0">
              <table className="w-full border-collapse text-[11px] font-sans table-fixed">
                <thead className="bg-gradient-to-b from-[#f9fbfd] to-[#e4ecf5] sticky top-0 z-10 border-b border-[#a0b3c6] text-slate-800 font-normal">
                  <tr>
                    <th className="w-[26px] py-1 border-r border-[#c5d2df] text-center"></th>
                    <th className="w-[36px] px-1.5 py-1 border-r border-[#c5d2df] text-left font-normal">Tip</th>
                    <th className="w-[78px] px-1.5 py-1 border-r border-[#c5d2df] text-left font-normal">Nr. int.</th>
                    <th className="w-[125px] px-1.5 py-1 border-r border-[#c5d2df] text-left font-normal">Nr. doc.</th>
                    <th className="w-[58px] px-1.5 py-1 border-r border-[#c5d2df] text-left font-normal">Cod</th>
                    <th className="px-2 py-1 border-r border-[#c5d2df] text-left font-normal">Furnizor</th>
                    <th className="w-[44px] px-1 py-1 border-r border-[#c5d2df] text-center font-normal">TVA I</th>
                    <th className="w-[80px] px-1.5 py-1 border-r border-[#c5d2df] text-center font-normal">
                      Data <span className="text-[#1d639e] text-[9px]">▲</span>
                    </th>
                    <th className="w-[80px] px-1.5 py-1 border-r border-[#c5d2df] text-center font-normal">Scadent</th>
                    <th className="w-[92px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">Valoare</th>
                    <th className="w-[76px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">Repartizat</th>
                    <th className="w-[78px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">TVA</th>
                    <th className="w-[92px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">Total</th>
                    <th className="w-[92px] px-1.5 py-1 text-right font-normal">Neachitat</th>
                  </tr>
                </thead>
                <tbody>
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
                        className={`cursor-pointer border-b border-[#d9e2ec] h-[22px] ${
                          isSelected
                            ? "bg-[#d9ebf9] text-slate-950 outline-1 -outline-offset-1 outline-dotted outline-slate-600"
                            : idx % 2 === 0
                            ? "bg-white hover:bg-[#f2f7fc]"
                            : "bg-[#f8fafc] hover:bg-[#f2f7fc]"
                        }`}
                      >
                        <td className="px-1 py-0.5 border-r border-[#d9e2ec] text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            {isSelected && <span className="text-[9px] text-black leading-none">▶</span>}
                            {hasWarnings ? (
                              <AlertTriangle className="w-3 h-3 text-amber-600 inline shrink-0" />
                            ) : (
                              <Lock className="w-3 h-3 text-amber-700 inline shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] truncate text-slate-800">
                          {doc.moneda !== "RON" ? doc.moneda : ""}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] truncate text-slate-900">
                          {doc.nrInternSaga}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] truncate text-slate-900">
                          {doc.nrDoc}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] truncate text-slate-900">
                          {doc.isNewSupplier ? (
                            <span className="text-amber-800 font-bold" title="Furnizor nou în SAGA">
                              NOU
                            </span>
                          ) : (
                            doc.furnizorCodSaga
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-[#d9e2ec] truncate text-slate-900">
                          {doc.furnizorNume}
                        </td>
                        <td className="px-1 py-0.5 border-r border-[#d9e2ec] text-center">
                          <input
                            type="checkbox"
                            checked={doc.tvaIncasare}
                            readOnly
                            className="h-3 w-3 align-middle pointer-events-none"
                          />
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-center text-slate-900">
                          {formatSagaDate(doc.dataDoc)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-center text-slate-900">
                          {formatSagaDate(doc.dataScadenta)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right font-bold text-slate-900">
                          {formatSagaNumber(doc.valoare, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right text-slate-800">
                          0.00
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right text-slate-900">
                          {formatSagaNumber(doc.tva, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right font-bold text-slate-950">
                          {formatSagaNumber(doc.total, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 text-right font-bold text-slate-950">
                          {formatSagaNumber(doc.total, 2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ───────────────────────────────────────────────────────────────
                MIDDLE SAGA BAR:
                Row 1: [Nr.Int] [Nr.Doc] [Cod] [Furnizor] + Compact Warnings
                Row 2: Adaug | Modific | Sterg | Serii >> | Preturi vanzare >> | Bon de consum... | Facturi asociate...
                ─────────────────────────────────────────────────────────────── */}
            {selectedDoc && (
              <div className="flex flex-col gap-1 shrink-0">
                {/* Row 1: The 4 SAGA C boxes + inline warning pills */}
                <div className="flex items-center gap-1.5 px-1 py-0.5 bg-[#eaf0f7] border border-[#b8c7d9] text-[11px]">
                  <div className="w-[82px] h-[22px] px-1.5 bg-white border border-[#7f9db9] flex items-center text-slate-900 truncate">
                    {selectedDoc.nrInternSaga}
                  </div>
                  <div className="w-[125px] h-[22px] px-1.5 bg-white border border-[#7f9db9] flex items-center text-slate-900 truncate">
                    {selectedDoc.nrDoc}
                  </div>
                  <div className="w-[58px] h-[22px] px-1.5 bg-white border border-[#7f9db9] flex items-center text-slate-900 truncate">
                    {selectedDoc.isNewSupplier ? "NOU" : selectedDoc.furnizorCodSaga}
                  </div>
                  <div className="w-[260px] h-[22px] px-2 bg-white border border-[#7f9db9] flex items-center text-slate-900 font-medium truncate">
                    {selectedDoc.furnizorNume}
                  </div>

                  {/* Inline compact warnings so they don't eat vertical height */}
                  {showWarningsPanel && selectedDoc.warnings.length > 0 && (
                    <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-0.5">
                      {selectedDoc.warnings.map((w, i) => (
                        <div
                          key={i}
                          title={w.message}
                          className={`px-2 py-0.5 rounded-[2px] border text-[11px] flex items-center gap-1 shrink-0 ${
                            w.level === "error"
                              ? "bg-red-50 border-red-300 text-red-900"
                              : w.level === "warning"
                              ? "bg-amber-50 border-amber-300 text-amber-950"
                              : "bg-sky-50 border-sky-300 text-sky-900"
                          }`}
                        >
                          {w.level === "error" ? (
                            <XCircle className="w-3 h-3 text-red-600 shrink-0" />
                          ) : w.level === "warning" ? (
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          ) : (
                            <Info className="w-3 h-3 text-sky-600 shrink-0" />
                          )}
                          <span>{w.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Row 2: SAGA C Detail Toolbar */}
                <div className="h-7 px-2 bg-[#f5f7fa] border border-[#b8c7d9] flex items-center justify-between text-[11px] text-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">
                      <span className="underline">A</span>daug
                    </span>
                    <span className="text-slate-400">
                      <span className="underline">M</span>odific
                    </span>
                    <span className="text-slate-400">
                      <span className="underline">S</span>terg
                    </span>
                    <Search className="w-3.5 h-3.5 text-[#1d639e]" />
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-slate-800">
                      S<span className="underline">e</span>rii &gt;&gt;
                    </span>
                    <span className="text-slate-800">
                      Preturi vanzare &gt;&gt;
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-slate-800">
                      <span className="underline">B</span>on de consum...
                    </span>
                    <span className="text-slate-800">
                      Facturi asociate (transport)...
                    </span>
                    <span className="px-2 py-0.5 bg-gradient-to-b from-white to-slate-200 border border-slate-400 text-[11px] text-slate-800">
                      <span className="underline">D</span>etalii
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ───────────────────────────────────────────────────────────────
                BOTTOM GRID: DETAIL LINES TABLE (Exact 12 SAGA C columns!)
                Tip | Gestiune | Denumire articol / serviciu | Cod | UM | TVA | Cantitate | Pret unitar | Valoare | Total | TVA | Nedeductibil
                ─────────────────────────────────────────────────────────────── */}
            <div className="bg-white border border-[#7f9db9] flex-1 overflow-auto min-h-[220px]">
              <table className="w-full border-collapse text-[11px] font-sans table-fixed">
                <thead className="bg-gradient-to-b from-[#f9fbfd] to-[#e4ecf5] sticky top-0 z-10 border-b border-[#a0b3c6] text-slate-800 font-normal">
                  <tr>
                    <th className="w-[22px] py-1 border-r border-[#c5d2df] text-center"></th>
                    <th className="w-[135px] px-1.5 py-1 border-r border-[#c5d2df] text-left font-normal">Tip</th>
                    <th className="w-[125px] px-1.5 py-1 border-r border-[#c5d2df] text-left font-normal">Gestiune</th>
                    <th className="px-2 py-1 border-r border-[#c5d2df] text-left font-normal">
                      Denumire articol / serviciu
                    </th>
                    <th className="w-[130px] px-1.5 py-1 border-r border-[#c5d2df] text-left font-normal">Cod</th>
                    <th className="w-[48px] px-1.5 py-1 border-r border-[#c5d2df] text-left font-normal">UM</th>
                    <th className="w-[42px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">TVA</th>
                    <th className="w-[82px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">Cantitate</th>
                    <th className="w-[88px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">
                      Pret unitar
                    </th>
                    <th className="w-[82px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">Valoare</th>
                    <th className="w-[82px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">Total</th>
                    <th className="w-[74px] px-1.5 py-1 border-r border-[#c5d2df] text-right font-normal">TVA</th>
                    <th className="w-[86px] px-1.5 py-1 text-right font-normal">Nedeductibil</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDoc?.lines.map((line, idx) => {
                    const isLineSelected = idx === selectedLineIdx;
                    return (
                      <tr
                        key={line.nrCrt}
                        onClick={() => setSelectedLineIdx(idx)}
                        className={`cursor-pointer border-b border-[#d9e2ec] h-[22px] ${
                          isLineSelected
                            ? "bg-[#d9ebf9] text-slate-950 outline-1 -outline-offset-1 outline-dotted outline-slate-600"
                            : idx % 2 === 0
                            ? "bg-white hover:bg-[#f2f7fc]"
                            : "bg-[#f8fafc] hover:bg-[#f2f7fc]"
                        }`}
                      >
                        <td className="px-0.5 py-0.5 border-r border-[#d9e2ec] text-center">
                          {isLineSelected && <span className="text-[9px] text-black leading-none">▶</span>}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] truncate text-slate-900" title={`Cont: ${line.cont}`}>
                          {line.tip}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] truncate text-slate-900">
                          {line.gestiune ? (
                            line.gestiune
                          ) : line.codeOrigin === "service_none" ? (
                            ""
                          ) : (
                            <span className="text-amber-700 font-semibold text-[10px]">
                              (fără gestiune)
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-0.5 border-r border-[#d9e2ec] truncate text-slate-900" title={line.denumire}>
                          <div className="flex items-center justify-between gap-2 truncate">
                            <span className="truncate">{line.denumire}</span>
                            {line.matchType === "words_and_price" && line.sagaArticleName && (
                              <span
                                className="px-1.5 py-0.2 rounded-[2px] bg-indigo-100 text-indigo-900 border border-indigo-300 text-[10px] shrink-0"
                                title={`Asociat cu articolul SAGA "${line.sagaArticleName}" (cuvinte comune: ${(line.matchedWords || []).join(", ")})`}
                              >
                                ≈ {line.sagaArticleName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] font-mono text-slate-900">
                          {line.cod ? (
                            <div className="flex items-center justify-between gap-1">
                              <span>{line.cod}</span>
                              {line.matchType === "words_and_price" ? (
                                <span
                                  className="px-1 rounded-[2px] text-[9px] font-sans font-bold bg-indigo-100 text-indigo-800 border border-indigo-300"
                                  title="Asociat automat: 2+ cuvinte comune + același preț"
                                >
                                  2+CUV
                                </span>
                              ) : line.codeOrigin === "app_088" ? (
                                <span
                                  className="px-1 rounded-[2px] text-[9px] font-sans font-bold bg-violet-100 text-violet-800 border border-violet-300"
                                  title="Articol nou creat automat cu cod 088xxxxx"
                                >
                                  088
                                </span>
                              ) : line.codeOrigin === "saga_000" ? (
                                <span
                                  className="px-1 rounded-[2px] text-[9px] font-sans font-bold bg-sky-100 text-sky-800 border border-sky-300"
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
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] uppercase text-slate-900">
                          {line.um}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right text-slate-900">
                          {line.tvaPercent}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right text-slate-900">
                          {formatSagaNumber(line.cantitate, 3)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right text-slate-900">
                          {formatSagaNumber(line.pretUnitar, 4)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right text-slate-900">
                          {formatSagaNumber(line.valoare, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right text-slate-900">
                          {formatSagaNumber(line.total, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 border-r border-[#d9e2ec] text-right text-slate-900">
                          {formatSagaNumber(line.tvaSuma, 2)}
                        </td>
                        <td className="px-1.5 py-0.5 text-right text-slate-500">
                          Cont {line.cont}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ───────────────────────────────────────────────────────────────
                BOTTOM SAGA C FOOTER BAR:
                [Validez] [Plata...] [Stornez] [N.C....] [Tiparire...] [Devalidez] ... [Salvează XML] [Iesire]
                ─────────────────────────────────────────────────────────────── */}
            <div className="h-9 px-2 bg-[#eaf0f7] border-t border-[#b8c7d9] flex items-center justify-between shrink-0 text-[11px]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled
                  className="h-6 px-3 bg-gradient-to-b from-[#f8fafc] to-[#dce4ee] border border-[#9aaec4] text-slate-400 rounded-[2px] flex items-center gap-1"
                >
                  <Lock className="w-3 h-3 text-amber-700/60" />
                  Validez
                </button>
                <button
                  type="button"
                  disabled
                  className="h-6 px-3 bg-gradient-to-b from-[#ffffff] to-[#dce4ee] border border-[#7f9db9] text-slate-800 rounded-[2px]"
                >
                  <span className="underline">P</span>lata...
                </button>
                <button
                  type="button"
                  disabled
                  className="h-6 px-3 bg-gradient-to-b from-[#ffffff] to-[#dce4ee] border border-[#7f9db9] text-slate-800 rounded-[2px]"
                >
                  Storne<span className="underline">z</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="h-6 px-3 bg-gradient-to-b from-[#ffffff] to-[#dce4ee] border border-[#7f9db9] text-slate-800 rounded-[2px]"
                >
                  <span className="underline">N</span>.C....
                </button>
                <button
                  type="button"
                  disabled
                  className="h-6 px-3 bg-gradient-to-b from-[#ffffff] to-[#dce4ee] border border-[#7f9db9] text-slate-800 rounded-[2px]"
                >
                  <span className="underline">T</span>iparire...
                </button>
                <button
                  type="button"
                  disabled
                  className="h-6 px-3 bg-gradient-to-b from-[#ffffff] to-[#dce4ee] border border-[#7f9db9] text-slate-800 rounded-[2px] flex items-center gap-1"
                >
                  <LockOpen className="w-3 h-3 text-amber-700" />
                  De<span className="underline">v</span>alidez
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingXml}
                  onClick={handleSaveXml}
                  className="h-6 px-3 bg-gradient-to-b from-[#16a34a] to-[#15803d] hover:brightness-105 border border-[#14532d] text-white font-semibold rounded-[2px] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {savingXml ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  Salvează XML pentru SAGA C (Alege calea...)
                </button>

                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="h-6 px-3 bg-gradient-to-b from-[#ffffff] to-[#dce4ee] hover:bg-white border border-[#7f9db9] text-slate-900 rounded-[2px] flex items-center gap-1 cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 text-white flex items-center justify-center text-[8px] font-bold">
                    −
                  </span>
                  <span className="underline">I</span>esire
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
