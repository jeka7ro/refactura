// DevizDetail.tsx — Vizualizare Deviz de Lucrări
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Loader2, ArrowLeft, FileDown, Eye, EyeOff, Pencil, Building2, User, FileText, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/store";
import { EditDevizModal } from "@/components/EditDevizModal";
import { Link } from "wouter";

export default function DevizDetail() {
  const [, params] = useRoute("/devize/:id");
  const [, navigate] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;

  const [showCodes, setShowCodes] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data, isLoading, refetch } = trpc.devize.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!data || !data.deviz) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate("/devize")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-6 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Înapoi la devize
        </button>
        <div className="text-center py-12 text-slate-500">
          Devizul nu a fost găsit.
        </div>
      </div>
    );
  }

  const { deviz, lines, invoice, issuer } = data as any;
  const vatRate = Number(deviz.vatRate) || 21;
  const currency = deviz.currency || "RON";

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-full">
      {/* Header & Butoane Acțiuni */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/devize")}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            title="Înapoi la lista de devize"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Deviz de Lucrări #{deviz.number}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                {deviz.status || "FINAL"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Data emiterii: <strong>{formatDate(String(deviz.date))}</strong>
              {invoice?.number && (
                <>
                  <span className="mx-2">•</span>
                  Factură asociată:{" "}
                  <Link
                    href={`/facturi-emise-nou/${invoice.id}`}
                    className="font-bold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    {invoice.number}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCodes(!showCodes)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            {showCodes ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {showCodes ? "Ascunde coduri" : "Arată coduri"}
          </button>
          <button
            onClick={() => setIsEditOpen(true)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editează rânduri
          </button>
          <a
            href={`/api/pdf/deviz/${deviz.id}?download=1&showCodes=${showCodes ? "1" : "0"}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5" />
            Descarcă PDF
          </a>
        </div>
      </div>

      {/* Carduri Părți Contractante (Prestator & Beneficiar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Prestator / Furnizor */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Prestator / Emitent
            </span>
            <Building2 className="w-4 h-4 text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {issuer?.name || "Companie Emitentă"}
            </h3>
            <p className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
              CUI / CIF: {issuer?.cui || "—"}
            </p>
            {issuer?.regCom && (
              <p className="text-xs text-slate-500">Reg. Com: {issuer.regCom}</p>
            )}
            {issuer?.address && (
              <p className="text-xs text-slate-500 mt-1">{issuer.address}</p>
            )}
            {issuer?.iban && (
              <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1">
                IBAN: {issuer.iban} {issuer.bank ? `(${issuer.bank})` : ""}
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
            <span>Întocmit de: <strong>{invoice?.intocmitDe || issuer?.intocmitDe || "Administrator"}</strong></span>
            {invoice?.delegat && <span>Delegat: <strong>{invoice.delegat}</strong></span>}
          </div>
        </div>

        {/* Beneficiar / Client */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Beneficiar / Client
            </span>
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {invoice?.clientName || deviz?.clientName || "—"}
            </h3>
            <p className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
              CUI / CIF: {invoice?.clientCUI || deviz?.clientCUI || "—"}
            </p>
            {invoice?.clientRegCom && (
              <p className="text-xs text-slate-500">Reg. Com: {invoice.clientRegCom}</p>
            )}
            {invoice?.clientAddress && (
              <p className="text-xs text-slate-500 mt-1">{invoice.clientAddress}</p>
            )}
            {invoice?.clientCity && (
              <p className="text-xs text-slate-500">Localitate: {invoice.clientCity}</p>
            )}
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
            <span>Factură: <strong>{invoice?.number || (deviz.invoiceId ? `#${deviz.invoiceId}` : "—")}</strong></span>
            <span>Monedă: <strong>{currency}</strong></span>
          </div>
        </div>
      </div>

      {/* Tabel Linii Deviz cu Defalcare TVA */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-10">
                  #
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Denumire Lucrare / Material
                </th>
                {showCodes && (
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Cod CSV
                  </th>
                )}
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">
                  Cantitate
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28">
                  Preț fără TVA
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28">
                  Valoare fără TVA
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">
                  TVA ({vatRate}%)
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 w-32">
                  Total cu TVA ({currency})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={showCodes ? 8 : 7}
                    className="py-8 text-center text-slate-400"
                  >
                    Nu există linii în acest deviz.
                  </td>
                </tr>
              ) : (
                lines.map((l: any, i: number) => {
                  const lineNet = Number(l.total) || 0;
                  const lineVat = Number((lineNet * (vatRate / 100)).toFixed(2));
                  const lineGross = Number((lineNet + lineVat).toFixed(2));

                  return (
                    <tr
                      key={l.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                        {l.type !== "MANOPERA" && Number(deviz.totalMaterials) > 0 && (
                          <span className="text-[10px] font-bold text-slate-400 mr-2 uppercase tracking-wider">
                            [{l.type}]
                          </span>
                        )}
                        {(l.description || "").replace(/^\[MANOPERA\]\s*/i, "")}
                      </td>
                      {showCodes && (
                        <td className="px-3 py-2.5 text-slate-500 font-mono text-[11px]">
                          {l.code || "—"}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                        {Number(l.quantity).toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                        {Number(l.unitPrice).toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-900 dark:text-white">
                        {lineNet.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                        {lineVat.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {lineGross.toFixed(2)} {currency}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-xs">
              {Number(deviz.totalMaterials) > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={showCodes ? 5 : 4}
                      className="px-3 py-2 text-right font-semibold text-slate-500"
                    >
                      Total Materiale fără TVA:
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                      {Number(deviz.totalMaterials).toFixed(2)} {currency}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                  <tr>
                    <td
                      colSpan={showCodes ? 5 : 4}
                      className="px-3 py-2 text-right font-semibold text-slate-500"
                    >
                      Total Manoperă / Servicii fără TVA:
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                      {Number(deviz.totalLabor).toFixed(2)} {currency}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </>
              )}
              <tr>
                <td
                  colSpan={showCodes ? 5 : 4}
                  className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300"
                >
                  TOTAL FĂRĂ TVA:
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                  {Number(deviz.total).toFixed(2)} {currency}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr>
                <td
                  colSpan={showCodes ? 5 : 4}
                  className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300"
                >
                  TOTAL TVA ({vatRate}%):
                </td>
                <td colSpan={2} className="px-3 py-2 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                  {Number(deviz.totalVAT).toFixed(2)} {currency}
                </td>
                <td></td>
              </tr>
              <tr className="bg-sky-50 dark:bg-sky-950/40 border-t border-sky-200 dark:border-sky-800">
                <td
                  colSpan={showCodes ? 5 : 4}
                  className="px-3 py-3 text-right font-black text-sky-800 dark:text-sky-300 text-sm"
                >
                  TOTAL GENERAL DEVIZ (CU TVA):
                </td>
                <td
                  colSpan={3}
                  className="px-3 py-3 text-right font-black text-sky-800 dark:text-sky-300 text-base font-mono"
                >
                  {Number(deviz.totalWithVAT).toFixed(2)} {currency}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {deviz.notes && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Mențiuni & Observații
          </h3>
          <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {deviz.notes}
          </p>
        </div>
      )}

      <EditDevizModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        devizId={deviz.id}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
