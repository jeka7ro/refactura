import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Search, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: items, isLoading } = trpc.inventory.list.useQuery();

  const filteredItems = items?.filter(item => 
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.gestiune?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 w-full p-4 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-800/50">
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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Caută după produs, furnizor sau gestiune..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
            />
          </div>
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Filter className="w-4 h-4" />
            Filtre
          </button>
        </div>

        {/* Table Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap table-auto min-w-[1000px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
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
                      <td className="px-4 py-3 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[250px] truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {item.receiptDate}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title={item.supplierName || ""}>
                        {item.supplierName || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {item.nirNumber || "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">
                        {item.unit || "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatNumber(Number(item.unitPrice))}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">
                        {item.vatRate}
                      </td>
                      <td className="px-4 py-3 text-center bg-green-50/30 dark:bg-green-900/5">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-bold text-green-700 bg-green-100 dark:bg-green-500/20 dark:text-green-400">
                          {formatNumber(item.availableQty, 2)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center text-xs text-slate-500">
            <span>
              Afișare {filteredItems?.length || 0} poziții cu stoc activ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
