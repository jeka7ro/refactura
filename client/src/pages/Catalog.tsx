import { useState } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { trpc } from "@/lib/trpc";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageOpen,
} from "lucide-react";

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
    <div className="p-3 sm:p-5 max-w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <PackageOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Catalog Nomenclator
            </h1>
            <p className="text-sm text-slate-500">
              Baza de date e-Devize cu materiale, manoperă și utilaje
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[22px] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              className="w-full h-10 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-slate-100 pl-9"
              style={{
                paddingRight: search ? 84 : 16,
              }}
              placeholder="Caută după cod sau denumire..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums whitespace-nowrap">
                {items.length} / {total}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[#636366] dark:text-[#98989d] uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3 w-[50px] text-center">
                  Nr.
                </th>
                <th className="px-4 py-3">Cod</th>
                <th className="px-4 py-3 w-full">Denumire</th>
                <th className="px-4 py-3 text-right">Tip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-64 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-4" />
                    <p className="text-slate-500">Se încarcă catalogul...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-64 text-center">
                    <p className="text-slate-500">Niciun rezultat găsit.</p>
                  </td>
                </tr>
              ) : (
                items.map((item: any, index: number) => (
                  <tr
                    key={`${item.cod}-${index}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-center tabular-nums text-[13px] text-slate-500 dark:text-slate-400">
                      {(page - 1) * rowsPerPage + index + 1}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400 text-xs">
                      {item.cod}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-normal min-w-[300px]">
                      {item.denumire}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide
                        ${
                          item.tip === "Materiale"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : item.tip === "Manopera"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
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

        {/* FOOTER PAGINARE */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <span className="whitespace-nowrap">
              Afișează&nbsp;
              <select
                value={rowsPerPage}
                onChange={e => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-full px-2.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={9999}>Toți</option>
              </select>
            </span>
            <span className="whitespace-nowrap tabular-nums">
              Total înregistrări:{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {total}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span className="whitespace-nowrap tabular-nums">
              Pagina {page} din {totalPages}
            </span>
            <button
              aria-label="Pagina anterioară"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
            <button
              aria-label="Pagina următoare"
              className="w-8 h-8 rounded-full apple-btn-glass flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
