// spvDeadline.ts — Calculul termenului legal de 5 zile lucrătoare pentru transmiterea în RO e-Factura (SPV)
// Conform OUG 120/2021 actualizată prin OUG 89/2025 (5 zile lucrătoare de la emitere, fără weekend și sărbători legale)

/**
 * Verifică dacă o dată este sărbătoare legală în România
 */
export function isRomanianPublicHoliday(d: Date): boolean {
  const month = d.getMonth() + 1; // 1-12
  const day = d.getDate();
  const year = d.getFullYear();

  // 1. Sărbători fixe
  if (month === 1 && (day === 1 || day === 2 || day === 6 || day === 7 || day === 24)) return true;
  if (month === 5 && day === 1) return true;
  if (month === 6 && day === 1) return true;
  if (month === 8 && day === 15) return true;
  if (month === 11 && day === 30) return true;
  if (month === 12 && (day === 1 || day === 25 || day === 26)) return true;

  // 2. Sărbători mobile (Paștele Ortodox, Vinerea Mare, Rusaliile) pentru anii recenți
  const mobileHolidays: Record<number, string[]> = {
    2024: ["2024-05-03", "2024-05-05", "2024-05-06", "2024-06-23", "2024-06-24"],
    2025: ["2025-04-18", "2025-04-20", "2025-04-21", "2025-06-08", "2025-06-09"],
    2026: ["2026-04-10", "2026-04-12", "2026-04-13", "2026-05-31", "2026-06-01"],
    2027: ["2027-04-30", "2027-05-02", "2027-05-03", "2027-06-20", "2027-06-21"],
    2028: ["2028-04-14", "2028-04-16", "2028-04-17", "2028-06-04", "2028-06-05"],
  };

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (mobileHolidays[year]?.includes(iso)) return true;

  return false;
}

/**
 * Verifică dacă o zi este zi lucrătoare (nu e weekend și nu e sărbătoare legală)
 */
export function isWorkingDay(d: Date): boolean {
  const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  if (isRomanianPublicHoliday(d)) return false;
  return true;
}

/**
 * Calculează data limită (5 zile lucrătoare de la data emiterii)
 */
export function getSpvDeadlineDate(issueDateStr: string | Date): Date {
  const start = new Date(issueDateStr);
  // Reset time to start of day
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  
  let addedWorkingDays = 0;
  while (addedWorkingDays < 5) {
    cur.setDate(cur.getDate() + 1);
    if (isWorkingDay(cur)) {
      addedWorkingDays++;
    }
  }

  // Set to end of deadline day (23:59:59)
  cur.setHours(23, 59, 59, 999);
  return cur;
}

export interface SpvDeadlineInfo {
  deadline: Date;
  workingDaysLeft: number;
  calendarDaysLeft: number;
  isExpired: boolean;
  expiresToday: boolean;
  isUrgent: boolean; // <= 2 zile lucrătoare rămase
  label: string;
  badgeClass: string;
}

/**
 * Calculează statusul termenului SPV pe baza datei emiterii
 */
export function getSpvDeadlineInfo(issueDateStr: string | Date): SpvDeadlineInfo | null {
  if (!issueDateStr) return null;
  const issueDate = new Date(issueDateStr);
  if (isNaN(issueDate.getTime())) return null;

  const deadline = getSpvDeadlineDate(issueDate);
  const now = new Date();
  
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDayStart = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

  const msDiff = deadlineDayStart.getTime() - todayStart.getTime();
  const calendarDaysLeft = Math.round(msDiff / (1000 * 60 * 60 * 24));

  // Numărăm zilele lucrătoare rămase între todayStart și deadlineDayStart
  let workingDaysLeft = 0;
  if (calendarDaysLeft > 0) {
    const temp = new Date(todayStart);
    while (temp < deadlineDayStart) {
      temp.setDate(temp.getDate() + 1);
      if (isWorkingDay(temp)) {
        workingDaysLeft++;
      }
    }
  } else if (calendarDaysLeft < 0) {
    // Calculăm câte zile lucrătoare au trecut de la termen
    const temp = new Date(deadlineDayStart);
    while (temp < todayStart) {
      temp.setDate(temp.getDate() + 1);
      if (isWorkingDay(temp)) {
        workingDaysLeft--; // va fi negativ
      }
    }
  }

  const isExpired = calendarDaysLeft < 0;
  const expiresToday = calendarDaysLeft === 0;
  const isUrgent = !isExpired && (expiresToday || workingDaysLeft <= 2);

  let label = "";
  let badgeClass = "";

  if (isExpired) {
    const daysOverdue = Math.abs(workingDaysLeft) || 1;
    label = `Termen SPV depășit (-${daysOverdue}z)`;
    badgeClass = "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 animate-pulse font-bold";
  } else if (expiresToday) {
    label = "Expiră azi în SPV!";
    badgeClass = "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 font-extrabold";
  } else if (workingDaysLeft === 1) {
    label = "1 zi lucrătoare rămasă";
    badgeClass = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-bold";
  } else if (workingDaysLeft === 2) {
    label = "2 zile lucrătoare rămase";
    badgeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800 font-semibold";
  } else {
    label = `${workingDaysLeft} zile lucrătoare rămase`;
    badgeClass = "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800";
  }

  return {
    deadline,
    workingDaysLeft,
    calendarDaysLeft,
    isExpired,
    expiresToday,
    isUrgent,
    label,
    badgeClass,
  };
}

/**
 * Verifică dacă transmiterea facturii a fost realizată în termenul legal (5 zile lucrătoare de la emitere)
 */
export function isTransmittedInDeadline(
  issueDateStr?: string | Date | null,
  sentDateStr?: string | Date | null
): boolean {
  if (!issueDateStr || !sentDateStr) return true;
  const deadline = getSpvDeadlineDate(issueDateStr);
  const sent = new Date(sentDateStr);
  if (isNaN(deadline.getTime()) || isNaN(sent.getTime())) return true;
  return sent.getTime() <= deadline.getTime();
}
