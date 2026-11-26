import { useState, useMemo } from "react";
import {
  Package,
  Search,
  Layers,
  Building2,
  Coins,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatNumber } from "@/lib/utils";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [gestiuneFilter, setGestiuneFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage("inventory_list", 25);

  const { data: items = [], isLoading } = trpc.inventory.list.useQuery();

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

  const hasActiveFilters =
    gestiuneFilter !== "all" || supplierFilter !== "all" || searchTerm.trim() !== "";

  const filteredItems = useMemo(() => {
    return (items || []).filter(item => {
      if (gestiuneFilter !== "all" && item.gestiune !== gestiuneFilter) return false;
      if (supplierFilter !== "all" && item.supplierName !== supplierFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        item.description.toLowerCase().includes(q) ||
        item.supplierName?.toLowerCase().includes(q) ||
        item.gestiune?.toLowerCase().includes(q) ||
        item.nirNumber?.toLowerCase().includes(q)
      );
    });
  }, [items, gestiuneFilter, supplierFilter, searchTerm]);

  const totalStockValue = useMemo(() => {
    return filteredItems.reduce(
      (sum, item) => sum + (Number(item.availableQty) || 0) * (Number(item.unitPrice) || 0),
      0
    );
  }, [filteredItems]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  );

  return (
    <div className="p-3 sm:p-5 max-w-full space-y-4 overflow-x-hidden">
      {/* Header — Apple macOS Window Title */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-0.5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.026em] text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
            Inventar Curent
          </h1>
          <p className="text-[12.5px] text-[#6e6e73] dark:text-[#98989d] mt-0.5 tabular-nums">
            Gestiunea stocurilor pe baza intrărilor (NIR) și ieșirilor (Bonuri Consum) ·{" "}
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
              {items.length}
            </strong>{" "}
            poziții cu stoc activ
            {filteredItems.length !== items.length && (
              <span className="ml-1.5 text-[#1d1d1f] dark:text-white font-medium">
                ({filteredItems.length} afișate)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Poziții în stoc
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#f2f4f7] dark:bg-[#2c2c2e] flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#0a84ff]" />
            </span>
          </div>
          <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {filteredItems.length}
          </span>
        </div>

        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Gestiuni active
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {gestiuni.length}
          </span>
        </div>

        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Furnizori
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#fff6eb] dark:bg-amber-500/18 flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </span>
          </div>
          <span className="text-[22px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums">
            {suppliers.length}
          </span>
        </div>

        <div className="apple-surface outline-none px-4 sm:px-5 py-3.5 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[12.5px] font-medium text-[#6e6e73] dark:text-[#98989d] truncate">
              Valoare stoc (fără TVA)
            </span>
            <span className="w-7 h-7 rounded-[8px] bg-[#eefbf3] dark:bg-emerald-500/18 flex items-center justify-center shrink-0">
              <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
          </div>
          <span className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.026em] leading-none tabular-nums truncate">
            {formatNumber(totalStockValue, 2)} RON
          </span>
        </div>
      </div>

      {/* Unified Filter & Search Toolbar */}
      <div className="apple-surface px-3 py-2.5">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 2xl:gap-2 w-full min-w-0">
          <Select
            value={gestiuneFilter}
            onValueChange={val => {
              setGestiuneFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger
              data-filtered={gestiuneFilter !== "all"}
              className="apple-pill-control h-[34px] w-auto shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3"
            >
              <Layers className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
              <SelectValue placeholder="Gestiune" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Gestiune: Toate ({gestiuni.length})</SelectItem>
              {gestiuni.map(g => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={supplierFilter}
            onValueChange={val => {
              setSupplierFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger
              data-filtered={supplierFilter !== "all"}
              className="apple-pill-control h-[34px] w-auto max-w-[220px] shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3"
            >
              <Building2 className="w-3.5 h-3.5 text-[#6e6e73] dark:text-[#98989d] shrink-0" />
              <SelectValue placeholder="Furnizor" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">Furnizor: Toți ({suppliers.length})</SelectItem>
              {suppliers.map(s => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="sm:ml-auto flex items-center gap-1.5 w-full sm:w-auto sm:flex-1 justify-end min-w-0">
            <div className="relative flex-1 min-w-[160px] max-w-full sm:max-w-[300px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8e8e93] pointer-events-none" />
              <input
                type="text"
                placeholder="Caută produs, furnizor, NIR sau gestiune..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                style={{ paddingLeft: 34, paddingRight: searchTerm ? 72 : 14 }}
                className="apple-pill-control rounded-full w-full h-[34px] outline-none text-[13px] text-[#1d1d1f] dark:text-white placeholder:text-[#8e8e93] focus:bg-white dark:focus:bg-[#2c2c2e] focus:border-black/15 dark:focus:border-white/20"
              />
              {searchTerm && (
                <>
                  <span className="absolute right-7 top-1/2 -translate-y-1/2 bg-black/[0.07] dark:bg-white/[0.14] text-[#1d1d1f] dark:text-white rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {filteredItems.length}/{items.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
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

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setGestiuneFilter("all");
                  setSupplierFilter("all");
                  setSearchTerm("");
                  setPage(1);
                }}
                title="Elimină toate filtrele"
                aria-label="Elimină toate filtrele"
                className="apple-pill-control w-[34px] h-[34px] shrink-0 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#98989d] dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="apple-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap table-auto min-w-[900px]">
            <thead className="bg-[#fafafa] dark:bg-white/[0.025] border-b border-black/[0.05] dark:border-white/[0.07]">
              <tr>
                <th className="px-3 py-3 w-12 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Nr.
                </th>
                <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Denumire produs / serviciu
                </th>
                <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Dată recepție
                </th>
                <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Furnizor
                </th>
                <th className="px-4 py-3 text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Nr. NIR
                </th>
                <th className="px-4 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  U/M
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Preț unitar
                </th>
                <th className="px-4 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  TVA %
                </th>
                <th className="px-4 py-3 text-center text-[12px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Stoc curent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.045] dark:divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73] mx-auto" />
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]"
                  >
                    Niciun produs în stoc curent. Toate produsele au fost consumate sau nu există intrări.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => (
                  <tr
                    key={item.lineId}
                    className="hover:bg-[#f5f5f7]/80 dark:hover:bg-white/[0.035] transition-colors"
                  >
                    <td className="px-3 py-3 text-center tabular-nums text-[12px] text-[#8e8e93] font-medium">
                      {(safePage - 1) * rowsPerPage + idx + 1}
                    </td>
                    <td
                      className="px-4 py-3 text-[13.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[260px] truncate"
                      title={item.description}
                    >
                      {item.description}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                      {item.receiptDate}
                    </td>
                    <td
                      className="px-4 py-3 text-[13px] text-[#1d1d1f] dark:text-[#ebebf5] max-w-[180px] truncate"
                      title={item.supplierName || ""}
                    >
                      {item.supplierName || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {item.nirNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                      {item.unit || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[13px] text-[#1d1d1f] dark:text-[#ebebf5]">
                      {formatNumber(Number(item.unitPrice))}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-[13px] text-[#6e6e73] dark:text-[#98989d]">
                      {item.vatRate}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[12px] tabular-nums font-semibold bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300 leading-none">
                        {formatNumber(item.availableQty, 2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Paginare */}
        <div className="px-4 py-3 border-t border-black/[0.05] dark:border-white/[0.07] bg-[#fafafa]/85 dark:bg-white/[0.02] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span className="flex items-center whitespace-nowrap">
              Afișează
              <Select
                value={rowsPerPage.toString()}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="apple-pill-control h-7 px-2.5 text-[12px] w-[66px] mx-1.5 bg-white dark:bg-[#2c2c2e]">
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
            </span>
            <span className="whitespace-nowrap ml-1">
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {filteredItems.length}
              </strong>{" "}
              poziții active
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[#6e6e73] dark:text-[#98989d] tabular-nums">
            <span className="whitespace-nowrap mr-1.5">
              Pagina{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {safePage}
              </strong>{" "}
              din{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {totalPages}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Pagina anterioară"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Pagina următoare"
              className="apple-btn-glass w-8 h-8 rounded-full flex items-center justify-center text-[#3a3a3c] dark:text-[#ebebf5] disabled:opacity-35 transition-all cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
