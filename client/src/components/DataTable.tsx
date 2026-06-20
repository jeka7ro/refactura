import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, Search, Loader2 } from "lucide-react";

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
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
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

  // Paginate data
  const total = sortedData.length;
  const filtered = filteredData.length;
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

  return (
    <div>
      {/* ── SEARCH BAR ── */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full pl-10 pr-4 py-2.5 bg-white/50 backdrop-blur-md border border-slate-200/60 rounded-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all shadow-sm"
          placeholder="Caută în tabel..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        {search && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            {filtered} / {data.length}
          </div>
        )}
      </div>

      {/* ── TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50/50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              {selectable && (
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </th>
              )}
              <th className="px-4 py-3 w-16 text-center">Nr.</th>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 cursor-pointer hover:text-slate-700 transition-colors ${col.className || ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable && <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right">ACȚIUNI</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0) + 1} className="p-8 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-sm">Se încarcă datele...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0) + 1}
                  className="p-8 text-center text-slate-500 text-sm"
                >
                  Nicio înregistrare găsită
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={String(row[rowKey])}
                  className={`hover:bg-slate-50/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row[rowKey])}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectRow(row);
                        }}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-center text-slate-500 font-medium">
                    {(page - 1) * rowsPerPage + idx + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={String(col.key)} className={`px-4 py-3 ${col.className || ''}`}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] || "")}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {/* ── PAGINATION ── */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border-t border-slate-200">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              Afișează
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toți</option>
              </select>
            </div>
            <span>Total înregistrări: <span className="font-semibold text-slate-700">{filtered}</span></span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              Pagina <span className="font-semibold text-slate-700">{page}</span> din {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(1)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 disabled:opacity-50 transition-colors"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 disabled:opacity-50 transition-colors"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
