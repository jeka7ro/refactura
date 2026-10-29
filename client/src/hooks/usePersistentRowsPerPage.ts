import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "smart_invoice:rows_per_page:";
const DEFAULT_STORAGE_KEY = `${STORAGE_PREFIX}default`;
const EVENT_NAME = "smart_invoice:rows_per_page_changed";

function readStoredRowsPerPage(tableKey: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const specific = window.localStorage.getItem(`${STORAGE_PREFIX}${tableKey}`);
    if (specific !== null) {
      const parsed = parseInt(specific, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    const globalPref = window.localStorage.getItem(DEFAULT_STORAGE_KEY);
    if (globalPref !== null) {
      const parsed = parseInt(globalPref, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return fallback;
}

/**
 * Păstrează în localStorage preferința utilizatorului pentru numărul de rânduri
 * afișate în tabel (atât pe tabelul curent, cât și ca preferință generală),
 * astfel încât alegerea rămâne activă la navigare, refresh sau redeschidere,
 * până când utilizatorul o schimbă manual.
 */
export function usePersistentRowsPerPage(
  tableKey: string,
  defaultValue: number = 15
): [number, (value: number | ((prev: number) => number)) => void] {
  const [rowsPerPage, setRowsPerPageState] = useState<number>(() =>
    readStoredRowsPerPage(tableKey, defaultValue)
  );

  const setRowsPerPage = useCallback(
    (next: number | ((prev: number) => number)) => {
      setRowsPerPageState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        const parsed = Number(resolved);
        const valid = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
        try {
          window.localStorage.setItem(`${STORAGE_PREFIX}${tableKey}`, String(valid));
          window.localStorage.setItem(DEFAULT_STORAGE_KEY, String(valid));
          window.dispatchEvent(
            new CustomEvent(EVENT_NAME, { detail: { tableKey, value: valid } })
          );
        } catch {
          // ignore storage errors
        }
        return valid;
      });
    },
    [tableKey, defaultValue]
  );

  useEffect(() => {
    const handleStorageOrCustom = () => {
      const stored = readStoredRowsPerPage(tableKey, defaultValue);
      setRowsPerPageState((prev) => (prev !== stored ? stored : prev));
    };
    window.addEventListener("storage", handleStorageOrCustom);
    window.addEventListener(EVENT_NAME, handleStorageOrCustom);
    return () => {
      window.removeEventListener("storage", handleStorageOrCustom);
      window.removeEventListener(EVENT_NAME, handleStorageOrCustom);
    };
  }, [tableKey, defaultValue]);

  return [rowsPerPage, setRowsPerPage];
}
