import { and, desc, eq, like } from "drizzle-orm";
import { nir } from "../drizzle/schema";

/**
 * Următorul număr NIR pentru firmă. Numerotarea se resetează în fiecare an:
 *   NIR-2026-0001 … NIR-2026-0123, apoi NIR-2027-0001.
 * Dacă firma folosește un format propriu (care nu e NIR-AAAA-nnnn), continuăm
 * numerotarea după ultimul număr, ca înainte.
 */
export async function computeNextNirNumber(
  db: any,
  tenantId: number
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NIR-${year}-`;

  const rows: { nirNumber: string | null }[] = await db
    .select({ nirNumber: nir.nirNumber })
    .from(nir)
    .where(and(eq(nir.tenantId, tenantId), like(nir.nirNumber, `${prefix}%`)));

  const taken = new Set<string>(rows.map(r => String(r.nirNumber)));
  let maxNum = 0;
  for (const r of rows) {
    const m = String(r.nirNumber || "").match(/^NIR-\d{4}-(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }

  if (maxNum === 0) {
    // Niciun NIR în anul curent. Dacă ultimul NIR are format propriu, continuăm după el.
    const [last] = await db
      .select({ nirNumber: nir.nirNumber })
      .from(nir)
      .where(eq(nir.tenantId, tenantId))
      .orderBy(desc(nir.id))
      .limit(1);
    const lastNo = String(last?.nirNumber || "");
    if (lastNo && !/^NIR-\d{4}-\d+$/.test(lastNo)) {
      const m = lastNo.match(/(\d+)$/);
      if (m) maxNum = parseInt(m[1], 10);
    }
  }

  let next = maxNum + 1;
  let candidate = `${prefix}${String(next).padStart(4, "0")}`;
  while (taken.has(candidate)) {
    next++;
    candidate = `${prefix}${String(next).padStart(4, "0")}`;
  }
  return candidate;
}
