import { useRoute, Link } from "wouter";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/store";

export default function BonConsumDetail() {
  const [, params] = useRoute("/bonuri-consum/:id");
  const id = Number(params?.id);

  const { data: bon, isLoading } = trpc.bonuriConsum.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  if (isLoading)
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#6e6e73]" />
      </div>
    );
  if (!bon)
    return (
      <div className="p-8 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]">
        Bonul de consum nu a fost găsit.
      </div>
    );

  const grandTotal = (bon.lines || []).reduce(
    (sum: number, l: any) => sum + (Number(l.total) || 0),
    0
  );

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-5 overflow-x-hidden">
      {/* Header — Apple macOS Window Title & Action */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/bonuri-consum">
            <button
              type="button"
              aria-label="Înapoi la Bonuri de Consum"
              className="apple-btn-glass w-9 h-9 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight truncate tabular-nums">
              Bon de Consum · {bon.bon.number}
            </h1>
            <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
              Gestiune:{" "}
              <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                {bon.bon.gestiune || "—"}
              </strong>
              {bon.bon.date ? ` · Dată: ${formatDate(String(bon.bon.date))}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/pdf/bon-consum/${bon.bon.id}?download=1`}
            target="_blank"
            rel="noreferrer"
            className="apple-btn-prominent flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-white text-[12.5px] font-semibold transition-all"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Descarcă PDF</span>
          </a>
        </div>
      </div>

      {/* Lines Table Surface */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="px-3 py-3 w-12 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Nr.
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Denumire material
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Cantitate
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Preț unitar
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d] whitespace-nowrap">
                  Valoare
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {bon.lines.map((l: any, i: number) => (
                <tr
                  key={i}
                  className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                >
                  <td className="px-3 py-3 text-center text-[12px] text-[#8e8e93] font-medium tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3 text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">
                    {l.description}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#6e6e73] dark:text-[#98989d] text-right tabular-nums whitespace-nowrap">
                    {l.quantity}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#6e6e73] dark:text-[#98989d] text-right tabular-nums whitespace-nowrap">
                    {l.unitPrice}
                  </td>
                  <td className="px-4 py-3 text-[13.5px] text-[#1d1d1f] dark:text-[#f5f5f7] text-right font-semibold tabular-nums whitespace-nowrap">
                    {Number(l.total || 0).toLocaleString("ro-RO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    <span className="text-[11px] font-medium text-[#8e8e93]">RON</span>
                  </td>
                </tr>
              ))}
            </tbody>
            {bon.lines.length > 0 && (
              <tfoot className="bg-[#fafafa]/85 dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08]">
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-right text-[12.5px] font-semibold text-[#6e6e73] dark:text-[#98989d]"
                  >
                    Total bon consum:
                  </td>
                  <td className="px-4 py-3 text-right text-[14.5px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums whitespace-nowrap">
                    {grandTotal.toLocaleString("ro-RO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    <span className="text-[11.5px] font-medium text-[#8e8e93]">RON</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
