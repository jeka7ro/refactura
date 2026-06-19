import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, Search } from "lucide-react";

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
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  selectable = false,
  onSelectionChange,
  actions,
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
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search className="w-4 h-4" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: '#94a3b8' }} />
        <input
          style={{
            width: '100%',
            paddingLeft: 36,
            paddingRight: search ? 80 : 16,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 9999,
            border: '1px solid #cbd5e1',
            background: '#fff',
            color: '#1e293b',
            fontSize: 14,
            outline: 'none',
          }}
          placeholder="Caută..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        {search && (
          <div style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: '#3b82f6', color: 'white', borderRadius: 9999,
            padding: '2px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            {filtered} / {data.length}
          </div>
        )}
      </div>

      {/* ── TABLE ── */}
      <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {selectable && (
                <th style={{ padding: '12px 16px', width: 48 }}>
                  <input
                    type="checkbox"
                    checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              <th style={{ width: 50, textAlign: 'center', padding: '12px 8px', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Nr.
              </th>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
                    color: '#64748b', textTransform: 'uppercase',
                    cursor: col.sortable ? 'pointer' : 'default',
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={col.className}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {col.sortable && <ArrowUpDown className="w-3.5 h-3.5" style={{ opacity: 0.4 }} />}
                  </div>
                </th>
              ))}
              {actions && (
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  ACȚIUNI
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0) + 1}
                  style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}
                >
                  Nicio înregistrare
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={String(row[rowKey])}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: onRowClick ? 'pointer' : 'default' }}
                  onClick={() => onRowClick?.(row)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {selectable && (
                    <td style={{ padding: '12px 16px' }}>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row[rowKey])}
                        onChange={() => handleSelectRow(row)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '12px 8px' }}>
                    {(page - 1) * rowsPerPage + idx + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      style={{ padding: '12px 16px', fontSize: 14, color: '#1e293b' }}
                      className={col.className}
                    >
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                  {actions && (
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* ── FOOTER PAGINARE ── */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#f8fafc',
          borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
          flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
              Afișează&nbsp;
              <select
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 9999, padding: '2px 8px', fontSize: 13,
                  color: '#1e293b',
                }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={9999}>Toți</option>
              </select>
            </span>
            <span style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
              Total înregistrări: <strong>{total}</strong>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
              Pagina {page} din {totalPages}
            </span>
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.35 : 1, display: 'inline-flex', alignItems: 'center' }}
            >
              <ChevronsLeft className="w-4 h-4" style={{ color: '#475569' }} />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.35 : 1, display: 'inline-flex', alignItems: 'center' }}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: '#475569' }} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.35 : 1, display: 'inline-flex', alignItems: 'center' }}
            >
              <ChevronRight className="w-4 h-4" style={{ color: '#475569' }} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.35 : 1, display: 'inline-flex', alignItems: 'center' }}
            >
              <ChevronsRight className="w-4 h-4" style={{ color: '#475569' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
