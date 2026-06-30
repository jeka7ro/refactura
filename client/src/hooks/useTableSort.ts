import { useState, useMemo, useEffect } from "react";

export function useTableSort<T extends Record<string, any>>(
  data: T[],
  tableId?: string
) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(() => {
    if (tableId) {
      const saved = localStorage.getItem(`dt_sort_${tableId}`);
      if (saved) return saved as keyof T;
    }
    return null;
  });

  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(() => {
    if (tableId) {
      const saved = localStorage.getItem(`dt_dir_${tableId}`);
      if (saved === "asc" || saved === "desc") return saved;
    }
    return "asc";
  });

  useEffect(() => {
    if (tableId && sortColumn) {
      localStorage.setItem(`dt_sort_${tableId}`, String(sortColumn));
      localStorage.setItem(`dt_dir_${tableId}`, sortDirection);
    }
  }, [tableId, sortColumn, sortDirection]);

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle string vs number sorting nicely
      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal, "ro", { numeric: true });
      } else {
        comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: keyof T) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? "↑" : "↓";
  };

  return { sortedData, handleSort, sortColumn, sortDirection, getSortIcon };
}
