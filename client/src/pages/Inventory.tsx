import { useState, useMemo } from "react";
import { Package, Search, Filter, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [gestiuneFilter, setGestiuneFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");

  const { data: items, isLoading } = trpc.inventory.list.useQuery();

  const gestiuni = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach(item => {
      if (item.gestiune) set.add(item.gestiune);
    });
    return Array.from(set).sort();
  }, [items]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach(item => {
      if (item.supplierName) set.add(item.supplierName);
    });
    return Array.from(set).sort();
  }, [items]);

  const hasActiveFilters = gestiuneFilter !== "all" || supplierFilter !== "all";

  const filteredItems = items?.filter(item => {
    if (gestiuneFilter !== "all" && item.gestiune !== gestiuneFilter) return false;
    if (supplierFilter !== "all" && item.supplierName !== supplierFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.description.toLowerCase().includes(q) ||
      item.supplierName?.toLowerCase().includes(q) ||
      item.gestiune?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 w-full p-4 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-800/50">
              <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventar Curent</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Gestiunea stocurilor pe baza intrărilor (NIR) și ieșirilor (Bonuri Consum)
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Section */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Caută după produs, furnizor sau gestiune..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-full text-sm font-medium transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtre
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-[22px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <select
                value={gestiuneFilter}
                onChange={e => setGestiuneFilter(e.target.value)}
                className="h-9 px-3.5 rounded-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="all">Gestiune: Toate ({gestiuni.length})</option>
                {gestiuni.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <select
                value={supplierFilter}
                onChange={e => setSupplierFilter(e.target.value)}
                className="h-9 px-3.5 rounded-full text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 max-w-[260px]"
              >
                <option value="all">Furnizor: Toți ({suppliers.length})</option>
                {suppliers.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setGestiuneFilter("all");
                    setSupplierFilter("all");
                  }}
                  className="h-9 px-3.5 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 inline-flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Resetează
                </button>
              )}
            </div>
          )}
        </div>

        {/* Table Section */}
        <div className="bg-white dark:bg-slate-900 rounded-[22px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap table-auto min-w-[1000px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[#636366] dark:text-[#98989d] uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Nr. Crt.</th>
                  <th className="px-4 py-3">Denumire produs/serviciu</th>
                  <th className="px-4 py-3">Data Recepției</th>
                  <th className="px-4 py-3">Furnizor</th>
                  <th className="px-4 py-3">Nr. NIR</th>
                  <th className="px-4 py-3 text-center">U/M</th>
                  <th className="px-4 py-3 text-right">Preț unit.</th>
                  <th className="px-4 py-3 text-center">TVA %</th>
                  <th className="px-4 py-3 text-center bg-green-50/50 dark:bg-green-900/10 text-green-700 dark:text-green-500">Stoc Curent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Se încarcă stocurile...
                    </td>
                  </tr>
                ) : filteredItems?.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Niciun produs în stoc curent. Toate produsele au fost consumate sau nu există intrări.
                    </td>
                  </tr>
                ) : (
                  filteredItems?.map((item, idx) => (
                    <tr key={item.lineId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 tabular-nums text-slate-400 font-medium">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[250px] truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                        {item.receiptDate}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title={item.supplierName || ""}>
                        {item.supplierName || "-"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                        {item.nirNumber || "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">
                        {item.unit || "-"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNumber(Number(item.unitPrice))}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-slate-600 dark:text-slate-300">
                        {item.vatRate}
                      </td>
                      <td className="px-4 py-3 text-center bg-green-50/30 dark:bg-green-900/5">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full tabular-nums font-bold text-green-700 bg-green-100 dark:bg-green-500/20 dark:text-green-400">
                          {formatNumber(item.availableQty, 2)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-xs text-slate-500 tabular-nums">
            <span>
              Afișare {filteredItems?.length || 0} poziții cu stoc activ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
