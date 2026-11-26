// DevizDetail.tsx — Vizualizare Deviz de Lucrări
import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  Loader2,
  ArrowLeft,
  FileDown,
  Eye,
  EyeOff,
  Pencil,
  Building2,
  User,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/store";
import { EditDevizModal } from "@/components/EditDevizModal";

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
        <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73]" />
      </div>
    );
  }

  if (!data || !data.deviz) {
    return (
      <div className="p-3 sm:p-5 max-w-full space-y-4">
        <button
          type="button"
          onClick={() => navigate("/devize")}
          className="apple-btn-glass inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Înapoi la devize
        </button>
        <div className="apple-surface py-14 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]">
          Devizul nu a fost găsit.
        </div>
      </div>
    );
  }

  const { deviz, lines, invoice, issuer } = data as any;
  const vatRate = deviz.vatRate ?? 21;
  const currency = deviz.currency || "RON";

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-full">
      {/* Header & Butoane Acțiuni */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/devize")}
            aria-label="Înapoi la lista de devize"
            className="apple-btn-glass w-9 h-9 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-colors shrink-0 cursor-pointer"
            title="Înapoi la lista de devize"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight tabular-nums">
                Deviz de lucrări #{deviz.number}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-500/18 dark:text-emerald-300 dark:border-emerald-500/25">
                {deviz.status === "draft" ? "Ciornă" : "Finalizat"}
              </span>
            </div>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
              Data emiterii:{" "}
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {formatDate(String(deviz.date))}
              </strong>
              {invoice?.number && (
                <>
                  <span className="mx-2 text-[#8e8e93]">·</span>
                  Factură asociată:{" "}
                  <Link
                    href={`/facturi-emise-nou/view/${invoice.id}`}
                    className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] hover:underline tabular-nums"
                  >
                    {invoice.number}
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCodes(!showCodes)}
            className="apple-btn-glass flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold cursor-pointer"
          >
            {showCodes ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span>{showCodes ? "Ascunde coduri" : "Arată coduri"}</span>
          </button>
          <a
            href={`/api/pdf/deviz/${deviz.id}?download=1&showCodes=${showCodes ? "1" : "0"}`}
            target="_blank"
            rel="noreferrer"
            className="apple-btn-glass flex items-center justify-center gap-1.5 px-3.5 h-9 rounded-full text-[#1d1d1f] dark:text-[#f5f5f7] text-[12.5px] font-semibold cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Descarcă PDF</span>
          </a>
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Editează rânduri</span>
          </button>
        </div>
      </div>

      {/* Carduri Părți Contractante (Prestator & Beneficiar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Prestator / Furnizor */}
        <div className="apple-surface p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.05] dark:border-white/[0.07]">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
              Prestator / Emitent
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-[14px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {issuer?.name || "Companie Emitentă"}
            </h3>
            <p className="text-[12.5px] tabular-nums font-medium text-[#3a3a3c] dark:text-[#ebebf5]">
              CUI / CIF: {issuer?.cui || "—"}
            </p>
            {issuer?.regCom && (
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                Reg. Com: {issuer.regCom}
              </p>
            )}
            {issuer?.address && (
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] pt-0.5">
                {issuer.address}
              </p>
            )}
            {issuer?.iban && (
              <p className="text-[12px] tabular-nums text-[#6e6e73] dark:text-[#98989d] pt-0.5">
                IBAN: {issuer.iban} {issuer.bank ? `(${issuer.bank})` : ""}
              </p>
            )}
          </div>
          <div className="pt-2.5 border-t border-black/[0.05] dark:border-white/[0.07] text-[12px] text-[#6e6e73] dark:text-[#98989d] flex justify-between flex-wrap gap-2">
            <span>
              Întocmit de:{" "}
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {invoice?.intocmitDe || issuer?.intocmitDe || "Administrator"}
              </strong>
            </span>
            {invoice?.delegat && (
              <span>
                Delegat:{" "}
                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                  {invoice.delegat}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Beneficiar / Client */}
        <div className="apple-surface p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.05] dark:border-white/[0.07]">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
              Beneficiar / Client
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-[14px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {invoice?.clientName || deviz?.clientName || "—"}
            </h3>
            <p className="text-[12.5px] tabular-nums font-medium text-[#3a3a3c] dark:text-[#ebebf5]">
              CUI / CIF: {invoice?.clientCUI || deviz?.clientCUI || "—"}
            </p>
            {invoice?.clientRegCom && (
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                Reg. Com: {invoice.clientRegCom}
              </p>
            )}
            {invoice?.clientAddress && (
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d] pt-0.5">
                {invoice.clientAddress}
              </p>
            )}
            {invoice?.clientCity && (
              <p className="text-[12px] text-[#6e6e73] dark:text-[#98989d]">
                Localitate: {invoice.clientCity}
              </p>
            )}
          </div>
          <div className="pt-2.5 border-t border-black/[0.05] dark:border-white/[0.07] text-[12px] text-[#6e6e73] dark:text-[#98989d] flex justify-between flex-wrap gap-2 tabular-nums">
            <span>
              Factură:{" "}
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {invoice?.number || (deviz.invoiceId ? `#${deviz.invoiceId}` : "—")}
              </strong>
            </span>
            <span>
              Monedă:{" "}
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {currency}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Tabel Linii Deviz cu Defalcare TVA */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="px-3 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-12">
                  Nr.
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Denumire lucrare / material
                </th>
                {showCodes && (
                  <th className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                    Cod CSV
                  </th>
                )}
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-24 whitespace-nowrap">
                  Cantitate
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-28 whitespace-nowrap">
                  Preț fără TVA
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-32 whitespace-nowrap">
                  Valoare fără TVA
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-28 whitespace-nowrap">
                  TVA ({vatRate}%)
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] w-36 whitespace-nowrap">
                  Total cu TVA ({currency})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={showCodes ? 8 : 7}
                    className="py-10 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]"
                  >
                    Nu există linii în acest deviz.
                  </td>
                </tr>
              ) : (
                lines.map((l: any, i: number) => {
                  const lineNet = Number(l.total) || 0;
                  const lineVat = Number((lineNet * (Number(vatRate) / 100)).toFixed(2));
                  const lineGross = Number((lineNet + lineVat).toFixed(2));

                  return (
                    <tr
                      key={l.id}
                      className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                    >
                      <td className="px-3 py-3 text-center text-[12px] font-medium text-[#8e8e93] tabular-nums">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {l.type !== "MANOPERA" && Number(deviz.totalMaterials) > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 mr-2 rounded-full text-[10.5px] font-medium bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d]">
                            {l.type}
                          </span>
                        )}
                        {(l.description || "").replace(/^\[MANOPERA\]\s*/i, "")}
                      </td>
                      {showCodes && (
                        <td className="px-4 py-3 text-[#6e6e73] dark:text-[#98989d] tabular-nums text-[12px]">
                          {l.code || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                        {Number(l.quantity).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                        {Number(l.unitPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-[#1d1d1f] dark:text-[#ebebf5]">
                        {lineNet.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#6e6e73] dark:text-[#98989d]">
                        {lineVat.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {lineGross.toFixed(2)} {currency}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="border-t border-black/[0.07] dark:border-white/[0.09] bg-[#fafafa] dark:bg-white/[0.025] text-[12.5px] tabular-nums">
              {Number(deviz.totalMaterials) > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={showCodes ? 5 : 4}
                      className="px-4 py-2 text-right font-medium text-[#6e6e73] dark:text-[#98989d]"
                    >
                      Total materiale fără TVA:
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-[#1d1d1f] dark:text-[#ebebf5]">
                      {Number(deviz.totalMaterials).toFixed(2)} {currency}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                  <tr>
                    <td
                      colSpan={showCodes ? 5 : 4}
                      className="px-4 py-2 text-right font-medium text-[#6e6e73] dark:text-[#98989d]"
                    >
                      Total manoperă / servicii fără TVA:
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-[#1d1d1f] dark:text-[#ebebf5]">
                      {Number(deviz.totalLabor).toFixed(2)} {currency}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </>
              )}
              <tr>
                <td
                  colSpan={showCodes ? 5 : 4}
                  className="px-4 py-2 text-right font-semibold text-[#6e6e73] dark:text-[#98989d]"
                >
                  Total fără TVA:
                </td>
                <td className="px-4 py-2 text-right font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {Number(deviz.total).toFixed(2)} {currency}
                </td>
                <td colSpan={2}></td>
              </tr>
              <tr>
                <td
                  colSpan={showCodes ? 5 : 4}
                  className="px-4 py-2 text-right font-semibold text-[#6e6e73] dark:text-[#98989d]"
                >
                  Total TVA ({vatRate}%):
                </td>
                <td
                  colSpan={2}
                  className="px-4 py-2 text-right font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
                >
                  {Number(deviz.totalVAT).toFixed(2)} {currency}
                </td>
                <td></td>
              </tr>
              <tr className="bg-[#f2f2f7]/80 dark:bg-white/[0.045] border-t border-black/[0.06] dark:border-white/[0.08]">
                <td
                  colSpan={showCodes ? 5 : 4}
                  className="px-4 py-3.5 text-right font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-[13.5px]"
                >
                  Total general deviz (cu TVA):
                </td>
                <td
                  colSpan={3}
                  className="px-4 py-3.5 text-right font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-[16px] tracking-[-0.02em] tabular-nums"
                >
                  {Number(deviz.totalWithVAT).toFixed(2)} {currency}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {deviz.notes && (
        <div className="apple-surface p-4 sm:p-5">
          <h3 className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] mb-1.5">
            Mențiuni & observații
          </h3>
          <p className="text-[13px] text-[#1d1d1f] dark:text-[#ebebf5] whitespace-pre-wrap">
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
