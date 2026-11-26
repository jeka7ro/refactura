import { useState } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { trpc } from "@/lib/trpc";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("catalog", 15);

  const { data: rawData, isLoading } = trpc.edevize.search.useQuery(
    {
      query: search || undefined,
      limit: rowsPerPage,
      offset: (page - 1) * rowsPerPage,
    },
    { placeholderData: (prev: any) => prev }
  );

  const items = rawData?.items || [];
  const total = rawData?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Catalog nomenclator
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Baza de date e-Devize cu materiale, manoperă și utilaje ·{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {total.toLocaleString("ro-RO")}
            </strong>{" "}
            repere
          </p>
        </div>
      </div>

      {/* Unified Single-Row Filter & Search Toolbar */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 w-full min-w-0">
          <div className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] tabular-nums px-1">
            {search ? (
              <span>
                Rezultate găsite:{" "}
                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                  {total.toLocaleString("ro-RO")}
                </strong>
              </span>
            ) : (
              <span>
                Total nomenclator:{" "}
                <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                  {total.toLocaleString("ro-RO")}
                </strong>{" "}
                articole
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto sm:flex-1 justify-end min-w-0">
            <div className="relative flex-1 min-w-[160px] max-w-full sm:max-w-[360px]">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
                style={{
                  paddingLeft: 34,
                  paddingRight: search ? 84 : 14,
                }}
                placeholder="Caută după cod sau denumire..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <>
                  <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap">
                    {items.length}/{total}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    aria-label="Șterge căutarea"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/[0.07] dark:hover:bg-white/[0.12] cursor-pointer"
                  >
                    <X className="w-3 h-3 text-[#6e6e73] dark:text-[#98989d]" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table Surface */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto min-h-[360px]">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="px-4 py-3 w-14 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Nr.
                </th>
                <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Cod
                </th>
                <th className="px-4 py-3 w-full text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Denumire
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Tip
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#6e6e73] mb-2" />
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                      Se încarcă catalogul...
                    </p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-14 text-center">
                    <p className="text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                      Niciun rezultat găsit.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item: any, index: number) => (
                  <tr
                    key={`${item.cod}-${index}`}
                    className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                  >
                    <td className="px-4 py-3 text-center tabular-nums text-[12px] font-medium text-[#8e8e93]">
                      {(page - 1) * rowsPerPage + index + 1}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                      {item.cod}
                    </td>
                    <td className="px-4 py-3 text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] whitespace-normal min-w-[280px]">
                      {item.denumire}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border leading-none ${
                          item.tip === "Materiale"
                            ? "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/18 dark:text-amber-300 dark:border-amber-500/25"
                            : item.tip === "Manopera"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/18 dark:text-emerald-300 dark:border-emerald-500/25"
                              : "bg-[#f2f2f7] text-[#3a3a3c] border-black/[0.06] dark:bg-[#2c2c2e] dark:text-[#ebebf5] dark:border-white/[0.08]"
                        }`}
                      >
                        {item.tip}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Paginare */}
        <div className="px-4 py-3 bg-[#fafafa] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between gap-3 flex-wrap tabular-nums">
          <div className="flex items-center gap-3 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span>Afișează</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 px-2.5 text-xs border-black/[0.08] bg-white dark:bg-[#2c2c2e] dark:border-white/[0.10] w-[68px] rounded-full tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="9999">Toți</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="whitespace-nowrap">
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {total.toLocaleString("ro-RO")}
              </strong>{" "}
              înregistrări
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d]">
            <span className="mr-1.5 whitespace-nowrap">
              Pagina{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {page}
              </strong>{" "}
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {totalPages}
              </strong>
            </span>
            <button
              type="button"
              aria-label="Pagina anterioară"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Pagina următoare"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] hover:text-[#1d1d1f] dark:hover:text-white disabled:opacity-35 transition-colors cursor-pointer"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
