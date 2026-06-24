import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search, Loader2 } from "lucide-react";

export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  actions?: (row: T) => React.ReactNode;
  isLoading?: boolean;
  searchable?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  selectable = false,
  onSelectionChange,
  actions,
  isLoading = false,
  searchable = true,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [selectedRows, setSelectedRows] = useState<Set<any>>(new Set());
  const [search, setSearch] = useState("");

  // Filter data
  const filteredData = useMemo(() => {
    if (!search) return data;
    return data.filter((row) =>
      columns.some((col) => {
        const value = row[col.key];
        return String(value).toLowerCase().includes(search.toLowerCase());
      })
    );
  }, [data, search, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Paginate
  const total = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const newSelected = new Set(paginatedData.map((row) => row[rowKey]));
      setSelectedRows(newSelected);
      onSelectionChange?.(paginatedData);
    }
  };

  const handleSelectRow = (row: T) => {
    const newSelected = new Set(selectedRows);
    const key = row[rowKey];
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedRows(newSelected);
    const selectedRowsData = paginatedData.filter((r) => newSelected.has(r[rowKey]));
    onSelectionChange?.(selectedRowsData);
  };

  const colCount = columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0) + 1;

  return (
    <div className="space-y-2">
      {/* Search */}
      {searchable && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative px-3 py-2">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              className="w-full sm:w-64 pl-7 pr-3 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="Caută număr, partener..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                {selectable && (
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                      onChange={handleSelectAll}
                      className="w-3 h-3 rounded border-slate-300"
                    />
                  </th>
                )}
                <th className="px-3 py-2 w-10 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nr.</th>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${col.sortable ? 'cursor-pointer hover:text-slate-600' : ''} ${col.className || ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortColumn === col.key && (
                        <span className="text-blue-500">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                ))}
                {actions && (
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">ACȚIUNI</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={colCount} className="p-8 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mb-1" />
                      <span className="text-xs">Se încarcă...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="p-8 text-center text-slate-400 text-xs">
                    Nicio înregistrare găsită
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr
                    key={String(row[rowKey])}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row[rowKey])}
                          onChange={(e) => { e.stopPropagation(); handleSelectRow(row); }}
                          className="w-3 h-3 rounded border-slate-300"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2 text-center text-[10px] text-slate-400 font-medium">
                      {(page - 1) * rowsPerPage + idx + 1}
                    </td>
                    {columns.map((col) => (
                      <td key={String(col.key)} className={`px-3 py-2 ${col.className || ''}`}>
                        {col.render ? col.render(row[col.key], row) : String(row[col.key] || "")}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {actions(row)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — compact, matching AllInvoices */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              Afișează
              <select
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-0.5 text-[10px] focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toți</option>
              </select>
            </div>
            <span>Total înregistrări: <strong className="text-slate-700 dark:text-slate-300">{filteredData.length}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span>Pg. <strong className="text-slate-700 dark:text-slate-300">{page}/{totalPages}</strong></span>
            <div className="flex items-center gap-0.5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-5 h-5 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-5 h-5 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
