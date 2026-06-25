import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Search, ChevronLeft, ChevronRight, Loader2, PackageOpen } from "lucide-react";

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const { data: rawData, isLoading } = trpc.edevize.search.useQuery(
    { query: search || undefined, limit: rowsPerPage, offset: (page - 1) * rowsPerPage },
    { keepPreviousData: true }
  );

  const items = rawData?.items || [];
  const total = rawData?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {/* SEARCH BAR conform regulilor UI */}
          <div style={{ position: 'relative' }} className="w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
            <input
              className="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-slate-100"
              style={{ paddingLeft: 36, paddingRight: search ? 80 : 16, borderRadius: 9999 }}
              placeholder="Caută după cod sau denumire..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: '#2563eb', color: 'white', borderRadius: 9999, padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {items.length} / {total}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium">
              <tr>
                <th style={{ width: 50, textAlign: 'center' }} className="px-4 py-3">Nr.</th>
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
                  <tr key={`${item.cod}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }} className="px-4 py-3">
                      {(page - 1) * rowsPerPage + index + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                      {item.cod}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-normal min-w-[300px]">
                      {item.denumire}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide
                        ${item.tip === 'Materiale' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          item.tip === 'Manopera' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`
                      }>
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
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }} className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} className="text-sm text-slate-600 dark:text-slate-400">
            <span style={{ whiteSpace: 'nowrap' }}>
              Afișează&nbsp;
              <select 
                value={rowsPerPage} 
                onChange={e => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }} 
                style={{ borderRadius: 9999, padding: '2px 8px' }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>Total înregistrări: <strong className="text-slate-900 dark:text-slate-100">{total}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="text-sm text-slate-600 dark:text-slate-400">
            <span style={{ whiteSpace: 'nowrap' }}>Pagina {page} din {totalPages}</span>
            <button 
              className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors" 
              onClick={() => setPage(p => p - 1)} 
              disabled={page === 1}
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <button 
              className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors" 
              onClick={() => setPage(p => p + 1)} 
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
