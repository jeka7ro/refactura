import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { tenants, userTenants } from "../drizzle/schema";

/**
 * Returnează firma (tenant) utilizatorului curent.
 * Nu mai există fallback tăcut la firma 1 — fără firmă setată, accesul este refuzat,
 * ca să nu se vadă niciodată datele altei firme.
 */
export function tenantOf(ctx: {
  user?: { tenantId?: number | null } | null;
}): number {
  const t = ctx.user?.tenantId;
  if (!t) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Contul nu are nicio firmă selectată. Selectează sau creează o firmă.",
    });
  }
  return t;
}

export function parseSettingsJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") {
    return !Array.isArray(raw) ? (raw as Record<string, any>) : {};
  }
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/**
 * Verifică dacă două firme (PF <-> PJ) sunt legate BIDIRECȚIONAL în settings:
 * (A.pairedPfTenantId === B && B.pairedPjTenantId === A) SAU
 * (A.pairedPjTenantId === B && B.pairedPfTenantId === A).
 */
export async function isValidBidirectionalPair(
  db: any,
  tenantAId: number | null | undefined,
  tenantBId: number | null | undefined
): Promise<boolean> {
  const a = Number(tenantAId);
  const b = Number(tenantBId);
  if (!db || !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return false;
  }
  if (a === b) return true;

  const rows = await db
    .select({ id: tenants.id, settings: tenants.settings })
    .from(tenants)
    .where(inArray(tenants.id, [a, b]));

  const rowA = rows.find((r: any) => r.id === a);
  const rowB = rows.find((r: any) => r.id === b);
  if (!rowA || !rowB) return false;

  const sA = parseSettingsJson(rowA.settings);
  const sB = parseSettingsJson(rowB.settings);

  return (
    (Number(sA.pairedPfTenantId) === b && Number(sB.pairedPjTenantId) === a) ||
    (Number(sA.pairedPjTenantId) === b && Number(sB.pairedPfTenantId) === a)
  );
}

/**
 * Rezolvă read-only tenantId-ul verificat al unui cont și lista tuturor firmelor accesibile
 * (userTenants cu isActive = 1 + perechi bidirecționale PF<->PJ ale acestora).
 * Nu creează niciodată automat un tenant nou și nu are încredere oarbă în account.tenantId
 * dacă apartenența din userTenants a fost revocată.
 */
export async function resolveVerifiedAccountTenant(
  db: any,
  account: { id: number; role?: string | null; tenantId?: number | null }
): Promise<{ tenantId: number | undefined; allowedTenantIds: number[] }> {
  if (account.role === "superadmin") {
    const tid =
      account.tenantId && Number(account.tenantId) > 0
        ? Number(account.tenantId)
        : undefined;
    return { tenantId: tid, allowedTenantIds: tid ? [tid] : [] };
  }

  if (!db || !account?.id) {
    return { tenantId: undefined, allowedTenantIds: [] };
  }

  const rows = await db
    .select({ tenantId: userTenants.tenantId })
    .from(userTenants)
    .where(
      and(eq(userTenants.userId, account.id), eq(userTenants.isActive, 1))
    )
    .orderBy(asc(userTenants.id));

  const activeIds: number[] = Array.from(
    new Set(
      rows
        .map((r: any) => Number(r.tenantId))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    )
  );

  if (activeIds.length === 0) {
    return { tenantId: undefined, allowedTenantIds: [] };
  }

  const allowedSet = new Set<number>(activeIds);

  // Include valid bidirectional PF<->PJ pairs of the user's active tenants
  const activeTenantRows = await db
    .select({ id: tenants.id, settings: tenants.settings })
    .from(tenants)
    .where(inArray(tenants.id, activeIds));

  const potentialPairIds = new Set<number>();
  for (const row of activeTenantRows) {
    const s = parseSettingsJson(row.settings);
    const pfId = Number(s.pairedPfTenantId);
    const pjId = Number(s.pairedPjTenantId);
    if (Number.isFinite(pfId) && pfId > 0 && !allowedSet.has(pfId)) {
      potentialPairIds.add(pfId);
    }
    if (Number.isFinite(pjId) && pjId > 0 && !allowedSet.has(pjId)) {
      potentialPairIds.add(pjId);
    }
  }

  for (const pairCandidateId of Array.from(potentialPairIds)) {
    for (const activeId of activeIds) {
      if (await isValidBidirectionalPair(db, activeId, pairCandidateId)) {
        allowedSet.add(pairCandidateId);
        break;
      }
    }
  }

  const candidate = account.tenantId ? Number(account.tenantId) : 0;
  const resolvedTenantId =
    candidate > 0 && allowedSet.has(candidate) ? candidate : activeIds[0];

  return {
    tenantId: resolvedTenantId,
    allowedTenantIds: Array.from(allowedSet),
  };
}

function isPrivateOrReservedIpv4(
  o1: number,
  o2: number,
  o3: number,
  o4: number
): boolean {
  if (
    !Number.isInteger(o1) ||
    !Number.isInteger(o2) ||
    !Number.isInteger(o3) ||
    !Number.isInteger(o4) ||
    o1 < 0 ||
    o1 > 255 ||
    o2 < 0 ||
    o2 > 255 ||
    o3 < 0 ||
    o3 > 255 ||
    o4 < 0 ||
    o4 > 255
  ) {
    return true;
  }
  return (
    o1 === 0 ||
    o1 === 10 ||
    o1 === 127 ||
    (o1 === 169 && o2 === 254) ||
    (o1 === 172 && o2 >= 16 && o2 <= 31) ||
    (o1 === 192 && o2 === 168) ||
    (o1 === 100 && o2 >= 64 && o2 <= 127) ||
    o1 >= 224
  );
}

/**
 * Blochează URL-uri webhook către localhost, adrese private RFC1918, link-local (169.254.0.0/16) sau IPv6 locale (SSRF).
 */
export function assertSafeWebhookUrl(rawUrl: string): void {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "URL-ul webhook este invalid.",
    });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "URL-ul webhook trebuie să folosească protocolul http sau https.",
    });
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1" ||
    /^(?:0{1,4}:){7}0{1,4}$/.test(host) ||
    /^(?:0{1,4}:){7}0*1$/.test(host) ||
    host.startsWith("::ffff:") ||
    /^(?:0{1,4}:){5}ffff:/.test(host) ||
    host.startsWith("::") ||
    host.startsWith("fe80:") ||
    host.startsWith("fe9") ||
    host.startsWith("fea") ||
    host.startsWith("feb") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "URL-ul webhook nu poate indica spre adrese locale sau private.",
    });
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const o1 = parseInt(ipv4Match[1], 10);
    const o2 = parseInt(ipv4Match[2], 10);
    const o3 = parseInt(ipv4Match[3], 10);
    const o4 = parseInt(ipv4Match[4], 10);
    if (isPrivateOrReservedIpv4(o1, o2, o3, o4)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "URL-ul webhook nu poate indica spre adrese IP private sau link-local.",
      });
    }
  }
}
