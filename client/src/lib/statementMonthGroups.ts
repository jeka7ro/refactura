export interface MonthAccountSummary {
  key: string;
  bankName: string;
  iban: string;
  currency: string;
  openingBalance: number | null;
  closingBalance: number | null;
  count: number;
}

export interface StatementMonthGroup<T = any> {
  monthKey: string;
  monthLabel: string;
  items: T[];
  accounts: MonthAccountSummary[];
}

export function formatStatementMonthLabel(ym?: string | null): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || "Fără lună";
  const [y, m] = ym.split("-").map(Number);
  if (!y || m < 1 || m > 12) return ym;
  const d = new Date(y, m - 1, 1);
  const raw = d.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatStatementPeriodLabel(
  periodStart?: string | null,
  periodEnd?: string | null,
  fallback?: string | null
): string {
  const fmt = (iso?: string | null) => {
    if (!iso) return "";
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };
  const s = fmt(periodStart);
  const e = fmt(periodEnd);
  if (s && e) {
    return s === e ? s : `${s} – ${e}`;
  }
  return s || e || fallback || "—";
}

export function groupStatementsByMonth<T extends Record<string, any>>(
  statements: T[]
): StatementMonthGroup<T>[] {
  const byMonth = new Map<string, T[]>();

  for (const st of statements) {
    const ym = String(st.statementMonth || "").trim() || "0000-00";
    const list = byMonth.get(ym);
    if (list) list.push(st);
    else byMonth.set(ym, [st]);
  }

  const sortedMonths = Array.from(byMonth.keys()).sort((a, b) =>
    b.localeCompare(a)
  );

  return sortedMonths.map((monthKey) => {
    const rawList = byMonth.get(monthKey) || [];
    // Sort chronologically inside the month (01 -> 31) so running balances flow naturally top-to-bottom
    const items = [...rawList].sort((a, b) => {
      const aStart = String(a.periodStart || a.periodEnd || "");
      const bStart = String(b.periodStart || b.periodEnd || "");
      if (aStart !== bStart) return aStart.localeCompare(bStart);
      const aEnd = String(a.periodEnd || "");
      const bEnd = String(b.periodEnd || "");
      if (aEnd !== bEnd) return aEnd.localeCompare(bEnd);
      return String(a.fileName || "").localeCompare(
        String(b.fileName || ""),
        undefined,
        { numeric: true }
      );
    });

    const accMap = new Map<string, MonthAccountSummary>();
    for (const item of items) {
      const cur = String(item.currency || "RON").toUpperCase();
      const ibanClean = String(item.iban || "").replace(/\s+/g, "").toUpperCase();
      const bankClean = String(item.bankName || "Cont Bancar").trim();
      const accKey = ibanClean ? `${ibanClean}_${cur}` : `${bankClean}_${cur}`;

      const openNum =
        item.openingBalance !== null &&
        item.openingBalance !== undefined &&
        !isNaN(Number(item.openingBalance))
          ? Number(item.openingBalance)
          : null;
      const closeNum =
        item.closingBalance !== null &&
        item.closingBalance !== undefined &&
        !isNaN(Number(item.closingBalance))
          ? Number(item.closingBalance)
          : null;

      const existing = accMap.get(accKey);
      if (!existing) {
        accMap.set(accKey, {
          key: accKey,
          bankName: bankClean,
          iban: ibanClean,
          currency: cur,
          openingBalance: openNum,
          closingBalance: closeNum,
          count: 1,
        });
      } else {
        existing.count += 1;
        if (existing.openingBalance === null && openNum !== null) {
          existing.openingBalance = openNum;
        }
        if (closeNum !== null) {
          existing.closingBalance = closeNum;
        }
      }
    }

    return {
      monthKey,
      monthLabel: formatStatementMonthLabel(monthKey),
      items,
      accounts: Array.from(accMap.values()),
    };
  });
}
