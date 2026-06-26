import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizeText } from "@/lib/utils";
import { useTableSort } from "@/hooks/useTableSort";

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
  headerContent?: React.ReactNode;
  tableId?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  onRowClick,
  selectable = false,
  onSelectionChange,
  actions,
  isLoading = false,
  searchable = true,
  headerContent,
  tableId,
}: DataTableProps<T>) {
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

  const { sortedData, handleSort, sortColumn, sortDirection, getSortIcon } = useTableSort(filteredData, tableId);

  // Paginate
  const total = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);

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
      {/* Search & Header Content */}
      {(searchable || headerContent) && (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2 flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          {searchable ? (
            <div style={{ position: "relative", width: "100%", maxWidth: 340 }}>
              <Search className="w-3.5 h-3.5 text-slate-400" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={{ paddingLeft: 30, paddingRight: search ? 72 : 12, borderRadius: 9999, width: "100%", height: 32, border: "1px solid #e2e8f0", outline: "none", fontSize: 13 }}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white dark:border-slate-700"
                placeholder="Caută număr, partener..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          ) : <div />}
          
          {headerContent && (
            <div className="flex flex-wrap gap-1.5 justify-end w-full sm:w-auto">
              {headerContent}
            </div>
          )}
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
                {columns.map((col) => {
                  const isSortable = col.sortable !== false;
                  return (
                    <th
                      key={String(col.key)}
                      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${isSortable ? 'cursor-pointer hover:text-slate-600' : ''} ${col.className || ''}`}
                      onClick={() => isSortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <span className="text-blue-500">{getSortIcon(col.key)}</span>
                      </div>
                    </th>
                  );
                })}
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
                  <td colSpan={colCount} className="py-4 text-center text-slate-400 text-[11px] bg-slate-50/50 dark:bg-slate-800/20 border-b border-dashed border-slate-200 dark:border-slate-800">
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
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 whitespace-nowrap">
              Afișează
              <Select value={rowsPerPage.toString()} onValueChange={(val) => { setRowsPerPage(Number(val)); setPage(1); }}>
                <SelectTrigger className="h-6 px-2 text-xs border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 w-[55px] rounded-lg focus:ring-1 focus:ring-blue-500 mx-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="9999">Toți</SelectItem>
                </SelectContent>
              </Select>
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
