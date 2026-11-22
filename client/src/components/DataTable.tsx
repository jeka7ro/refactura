import { useState, useMemo, useEffect } from "react";
import { usePersistentRowsPerPage } from "@/hooks/usePersistentRowsPerPage";
import { ChevronLeft, ChevronRight, Search, Loader2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  searchFields?: string[];
  filterFn?: (row: T, search: string) => boolean;
  initialSearch?: string;
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
  searchFields,
  filterFn,
  initialSearch,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = usePersistentRowsPerPage(
    tableId ? `datatable_${tableId}` : "datatable_default",
    15
  );
  const [selectedRows, setSelectedRows] = useState<Set<any>>(new Set());
  const [search, setSearch] = useState(initialSearch || "");

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearch(initialSearch);
      setPage(1);
    }
  }, [initialSearch]);

  // Filter data with diacritics normalization, custom searchFields, and auto country/name matching
  const filteredData = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return data;

    if (filterFn) {
      return data.filter(row => filterFn(row, search));
    }

    return data.filter(row => {
      // 1. Check all rendered column keys
      const matchedColumn = columns.some(col => {
        const value = row[col.key];
        if (value === null || value === undefined) return false;
        return normalizeText(String(value)).includes(q);
      });
      if (matchedColumn) return true;

      // 2. Check explicit searchFields if provided
      if (searchFields && searchFields.length > 0) {
        const matchedField = searchFields.some(field => {
          const value = row[field];
          if (value === null || value === undefined) return false;
          return normalizeText(String(value)).includes(q);
        });
        if (matchedField) return true;
      }

      // 3. Fallback: check country, countryName, cui, sagaCode, name, city, address
      const extraFields = [
        "country",
        "countryName",
        "cui",
        "sagaCode",
        "name",
        "city",
        "address",
        "regime",
        "typeLabel",
      ];
      return extraFields.some(field => {
        const value = row[field];
        if (value === null || value === undefined) return false;
        return normalizeText(String(value)).includes(q);
      });
    });
  }, [data, search, columns, filterFn, searchFields]);

  const { sortedData, handleSort, sortColumn, sortDirection, getSortIcon } =
    useTableSort(filteredData, tableId);

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
      const newSelected = new Set(paginatedData.map(row => row[rowKey]));
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
    const selectedRowsData = paginatedData.filter(r =>
      newSelected.has(r[rowKey])
    );
    onSelectionChange?.(selectedRowsData);
  };

  const colCount =
    columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0) + 1;

  return (
    <div className="space-y-2.5">
      {/* Search & Header Content */}
      {(searchable || headerContent) && (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_16px_-4px_rgba(0,0,0,0.04)] px-4 py-2.5 flex flex-col sm:flex-row gap-3 justify-between items-center">
          {searchable ? (
            <div className="relative w-full max-w-[340px]">
              <Search
                className="w-3.5 h-3.5 text-[#636366] dark:text-[#98989d] pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                style={{
                  borderRadius: 9999,
                  paddingRight: search ? 40 : 12,
                }}
                className="w-full h-9 pl-8.5 text-[13px] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white placeholder:text-[#636366] dark:placeholder:text-[#98989d] border border-black/[0.06] dark:border-white/[0.08] focus:bg-white dark:focus:bg-[#3a3a3c] transition-colors outline-none rounded-full"
                placeholder="Caută număr, partener..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Șterge căutarea"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="w-7 h-7 right-1 top-1/2 -translate-y-1/2 absolute rounded-full inline-flex items-center justify-center text-[#636366] dark:text-[#98989d] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div />
          )}

          {headerContent && (
            <div className="flex flex-wrap gap-1.5 justify-end w-full sm:w-auto">
              {headerContent}
            </div>
          )}
        </div>
      )}

      {/* Table card */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[22px] border border-black/[0.06] dark:border-white/[0.09] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_16px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-[#f9f9fb] dark:bg-white/[0.02]">
                {selectable && (
                  <th className="px-3 py-2.5 w-9">
                    <input
                      type="checkbox"
                      aria-label="Selectează toate rândurile"
                      checked={
                        selectedRows.size === paginatedData.length &&
                        paginatedData.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                    />
                  </th>
                )}
                <th className="px-3 py-2.5 w-10 text-[11px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d]">
                  Nr.
                </th>
                {columns.map(col => {
                  const isSortable = col.sortable !== false;
                  return (
                    <th
                      key={String(col.key)}
                      className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] ${isSortable ? "cursor-pointer hover:text-[#1d1d1f] dark:hover:text-white transition-colors select-none" : ""} ${col.className || ""}`}
                      onClick={() => isSortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <span className="text-primary">
                          {getSortIcon(col.key)}
                        </span>
                      </div>
                    </th>
                  );
                })}
                {actions && (
                  <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#636366] dark:text-[#98989d] text-right">
                    Acțiuni
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={colCount} className="p-8 text-center">
                    <div className="flex flex-col items-center justify-center text-[#636366] dark:text-[#98989d]">
                      <Loader2 className="w-5 h-5 animate-spin mb-1" />
                      <span className="text-xs">Se încarcă...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="py-6 text-center text-[#636366] dark:text-[#98989d] text-xs bg-black/[0.015] dark:bg-white/[0.02]"
                  >
                    Nicio înregistrare găsită
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr
                    key={String(row[rowKey])}
                    className={`hover:bg-black/[0.025] dark:hover:bg-white/[0.04] transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row[rowKey])}
                          onChange={e => {
                            e.stopPropagation();
                            handleSelectRow(row);
                          }}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center text-[11px] text-[#636366] dark:text-[#98989d] font-medium tabular-nums">
                      {(page - 1) * rowsPerPage + idx + 1}
                    </td>
                    {columns.map(col => (
                      <td
                        key={String(col.key)}
                        className={`px-3 py-2.5 ${col.className || ""}`}
                      >
                        {col.render
                          ? col.render(row[col.key], row)
                          : String(row[col.key] || "")}
                      </td>
                    ))}
                    {actions && (
                      <td
                        className="px-3 py-2.5 text-right"
                        onClick={e => e.stopPropagation()}
                      >
                        {actions(row)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — Apple HIG accessible 28x28pt desktop controls */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#f9f9fb] dark:bg-white/[0.02] border-t border-black/[0.06] dark:border-white/[0.08] text-xs text-[#636366] dark:text-[#98989d]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              Afișează
              <Select
                value={rowsPerPage.toString()}
                onValueChange={val => {
                  setRowsPerPage(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 px-2.5 text-xs border-black/[0.08] bg-white dark:bg-[#2c2c2e] dark:border-white/[0.10] w-[62px] rounded-lg mx-0.5 tabular-nums">
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
            <span className="tabular-nums">
              Total înregistrări:{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {filteredData.length}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 tabular-nums">
            <span>
              Pg.{" "}
              <strong className="text-[#1d1d1f] dark:text-white font-semibold">
                {page}/{totalPages}
              </strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Pagina anterioară"
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-35 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Pagina următoare"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#2c2c2e] text-[#3a3a3c] dark:text-[#ebebf5] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] disabled:opacity-35 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
