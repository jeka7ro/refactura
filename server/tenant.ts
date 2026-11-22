import { TRPCError } from "@trpc/server";
import { inArray } from "drizzle-orm";
import { tenants } from "../drizzle/schema";

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

function parseSettingsJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  try {
    return JSON.parse(String(raw));
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
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("::ffff:127.") ||
    host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.") ||
    host.startsWith("::ffff:169.254.")
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "URL-ul webhook nu poate indica spre adrese locale sau private.",
    });
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [o1, o2] = [
      parseInt(ipv4Match[1], 10),
      parseInt(ipv4Match[2], 10),
    ];
    if (
      o1 === 0 ||
      o1 === 10 ||
      o1 === 127 ||
      (o1 === 169 && o2 === 254) ||
      (o1 === 172 && o2 >= 16 && o2 <= 31) ||
      (o1 === 192 && o2 === 168) ||
      (o1 === 100 && o2 >= 64 && o2 <= 127)
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "URL-ul webhook nu poate indica spre adrese IP private sau link-local.",
      });
    }
  }
}
