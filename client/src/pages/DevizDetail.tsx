// DevizDetail.tsx — Vizualizare Deviz
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Loader2, ArrowLeft, FileDown, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/store";

export default function DevizDetail() {
  const [, params] = useRoute("/devize/:id");
  const [, navigate] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;
  
  const [showCodes, setShowCodes] = useState(false);

  const { data, isLoading } = trpc.devize.getById.useQuery({ id }, { enabled: !!id });

  if (isLoading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>;
  }

  if (!data || !data.deviz) {
    return (
      <div className="p-6">
        <button onClick={() => navigate("/devize")} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Înapoi la devize
        </button>
        <div className="text-center py-12 text-slate-500">Devizul nu a fost găsit.</div>
      </div>
    );
  }

  const { deviz, lines } = data;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/devize")}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Deviz #{deviz.number}
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <span>Data: {formatDate(String(deviz.date))}</span>
              {deviz.invoiceId && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>Factura: #{deviz.invoiceId}</span>
                </>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCodes(!showCodes)}
            className="flex items-center gap-2 px-4 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {showCodes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showCodes ? "Ascunde coduri" : "Arată coduri"}
          </button>
          <a
            href={`/api/pdf/deviz/${deviz.id}?download=1&showCodes=${showCodes ? "1" : "0"}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 h-10 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            Descarcă PDF
          </a>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 w-12">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Denumire / Tip</th>
                {showCodes && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Cod CSV</th>}
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Cantitate</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Preț Unitar</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Total RON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.length === 0 ? (
                <tr><td colSpan={showCodes ? 6 : 5} className="py-8 text-center text-slate-400">Nu există linii.</td></tr>
              ) : (
                lines.map((l, i) => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      <span className="text-xs font-bold text-slate-400 mr-2 uppercase tracking-wider">[{l.type}]</span>
                      {l.description}
                    </td>
                    {showCodes && <td className="px-4 py-3 text-slate-500">{l.code || "—"}</td>}
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{Number(l.quantity).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{Number(l.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">{Number(l.total).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700">
              <tr>
                <td colSpan={showCodes ? 5 : 4} className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-400">TOTAL MATERIALE:</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{Number(deviz.totalMaterials).toFixed(2)} RON</td>
              </tr>
              <tr>
                <td colSpan={showCodes ? 5 : 4} className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-400">TOTAL MANOPERĂ:</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{Number(deviz.totalLabor).toFixed(2)} RON</td>
              </tr>
              <tr className="bg-sky-50 dark:bg-sky-900/20">
                <td colSpan={showCodes ? 5 : 4} className="px-4 py-4 text-right font-black text-sky-700 dark:text-sky-400 text-base">TOTAL DEVIZ:</td>
                <td className="px-4 py-4 text-right font-black text-sky-700 dark:text-sky-400 text-base">{Number(deviz.total).toFixed(2)} RON</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      {deviz.notes && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Observații</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{deviz.notes}</p>
        </div>
      )}
    </div>
  );
}
