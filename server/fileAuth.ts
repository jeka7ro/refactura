/**
 * Autentificare pentru endpoint-urile de fișiere (PDF-uri, uploads).
 * Aceste URL-uri se deschid direct din browser (href / iframe / window.open),
 * deci nu pot trimite header-ul Authorization. Clientul pune tokenul de sesiune
 * într-un cookie (vezi client/src/lib/authCookie.ts), iar aici îl verificăm.
 */
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { and, eq, sql } from "drizzle-orm";
import { verifySessionToken, extractTokenFromHeader } from "./session";
import { getAccountById } from "./auth";
import { getDb } from "./db";
import {
  verifyAndExtractAccountantSession,
  computeAccountantCredFingerprint,
} from "./accountantPortalRouter";
import {
  isValidBidirectionalPair,
  parseSettingsJson,
  resolveVerifiedAccountTenant,
} from "./tenant";

export interface FileAuthInfo {
  accountId: number;
  tenantId: number;
  role: string;
  allowedTenantIds?: number[];
}

async function isValidAccountantSessionForTenant(
  accountantAuth: { tenantId: number; credFp: string } | null,
  expectedTenantId?: number
): Promise<boolean> {
  try {
    if (!accountantAuth?.tenantId || !accountantAuth.credFp) return false;
    if (
      expectedTenantId !== undefined &&
      accountantAuth.tenantId !== expectedTenantId
    ) {
      return false;
    }
    const db = await getDb();
    if (!db) return false;
    const { tenants } = await import("../drizzle/schema");
    const [tenant] = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, accountantAuth.tenantId))
      .limit(1);
    if (!tenant?.settings) return false;
    const parsed = parseSettingsJson(tenant.settings);
    if (Boolean(parsed?.accountantPortal?.enabled) !== true) return false;

    const currentFp = computeAccountantCredFingerprint(parsed);
    const a = Buffer.from(accountantAuth.credFp, "utf8");
    const b = Buffer.from(currentFp, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function canAccessTenantOwner(
  db: any,
  auth: FileAuthInfo,
  ownerTenantId: number
): Promise<boolean> {
  if (!ownerTenantId || ownerTenantId <= 0) return false;
  if (auth.role === "superadmin") return true;
  if (auth.role === "accountant") return auth.tenantId === ownerTenantId;
  if (!auth.accountId) return false;
  if (auth.allowedTenantIds?.includes(ownerTenantId)) return true;

  const { userTenants } = await import("../drizzle/schema");
  const activeRows = await db
    .select({ tenantId: userTenants.tenantId })
    .from(userTenants)
    .where(
      and(
        eq(userTenants.userId, auth.accountId),
        eq(userTenants.isActive, 1)
      )
    );

  const activeIds = activeRows
    .map((r: any) => Number(r.tenantId))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  if (activeIds.includes(ownerTenantId)) return true;

  for (const activeId of activeIds) {
    if (await isValidBidirectionalPair(db, activeId, ownerTenantId)) {
      return true;
    }
  }
  return false;
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return null;
}

export async function authenticateFileRequest(
  req: Request
): Promise<FileAuthInfo | null> {
  const rawQueryTenantId = req.query?.tenantId;
  const requestedTenantId =
    rawQueryTenantId !== undefined
      ? parseInt(String(rawQueryTenantId), 10)
      : NaN;
  const hasValidQueryTenant =
    Number.isFinite(requestedTenantId) && requestedTenantId > 0;

  // 1. Suport prioritar pentru Portalul Contabil dacă token-ul este trimis explicit prin query sau header
  const explicitAccountantToken =
    (req.query?.accountantToken as string) ||
    (req.headers["x-accountant-token"] as string);

  if (explicitAccountantToken) {
    const accountantAuth = verifyAndExtractAccountantSession(explicitAccountantToken);
    if (
      accountantAuth &&
      (!hasValidQueryTenant || accountantAuth.tenantId === requestedTenantId) &&
      (await isValidAccountantSessionForTenant(accountantAuth))
    ) {
      return {
        accountId: 0,
        tenantId: accountantAuth.tenantId,
        role: "accountant",
        allowedTenantIds: [accountantAuth.tenantId],
      };
    }
  }

  // 2. Token de sesiune utilizator autentificat (header Authorization sau cookie authToken)
  const token =
    extractTokenFromHeader(req.headers.authorization) ||
    readCookie(req, "authToken");

  if (token) {
    const payload = await verifySessionToken(token);
    if (payload?.accountId) {
      const account: any = await getAccountById(payload.accountId);
      if (!account || !account.isActive) {
        return null;
      }
      if (account.role === "superadmin") {
        const effectiveTenantId = hasValidQueryTenant
          ? requestedTenantId
          : account.tenantId || 1;
        return {
          accountId: account.id,
          tenantId: effectiveTenantId,
          role: "superadmin",
        };
      }

      const db = await getDb();
      if (db) {
        const resolved = await resolveVerifiedAccountTenant(db, account);
        if (resolved.tenantId) {
          const auth: FileAuthInfo = {
            accountId: account.id,
            tenantId: resolved.tenantId,
            role: String(account.role || "user"),
            allowedTenantIds: resolved.allowedTenantIds,
          };
          if (
            hasValidQueryTenant &&
            (await canAccessTenantOwner(db, auth, requestedTenantId))
          ) {
            auth.tenantId = requestedTenantId;
            if (!auth.allowedTenantIds?.includes(requestedTenantId)) {
              auth.allowedTenantIds = [
                ...(auth.allowedTenantIds || []),
                requestedTenantId,
              ];
            }
          }
          return auth;
        }
      }
    }
  }

  // 3. Suport fallback din cookie accountantSession
  const cookieAccountantToken = readCookie(req, "accountantSession");
  if (cookieAccountantToken) {
    const accountantAuth = verifyAndExtractAccountantSession(cookieAccountantToken);
    if (
      accountantAuth &&
      (!hasValidQueryTenant || accountantAuth.tenantId === requestedTenantId) &&
      (await isValidAccountantSessionForTenant(accountantAuth))
    ) {
      return {
        accountId: 0,
        tenantId: accountantAuth.tenantId,
        role: "accountant",
        allowedTenantIds: [accountantAuth.tenantId],
      };
    }
  }

  return null;
}

/** Cere doar autentificare (fără verificare de proprietar) — pentru fișiere statice / export read-only. */
export async function requireFileAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = await authenticateFileRequest(req);
    if (!auth) {
      res.status(401).json({ error: "Neautentificat" });
      return;
    }
    (req as any).fileAuth = auth;
    next();
  } catch {
    res.status(401).json({ error: "Neautentificat" });
  }
}

/** Cere autentificare de utilizator activ (blochează sesiunile read-only de Portal Contabil). */
export async function requireUserAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = await authenticateFileRequest(req);
    if (!auth) {
      res.status(401).json({ error: "Neautentificat" });
      return;
    }
    if (auth.role === "accountant" || !auth.accountId) {
      res.status(403).json({ error: "Acces interzis (sesiune doar pentru citire)" });
      return;
    }
    (req as any).fileAuth = auth;
    next();
  } catch {
    res.status(401).json({ error: "Neautentificat" });
  }
}

/**
 * Middleware pentru /api/pdf/:resource/:id — cere autentificare și verifică
 * faptul că documentul aparține firmei utilizatorului sau sesiunii de contabil.
 */
export async function requirePdfAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawQueryTenantId = req.query?.tenantId;
    const requestedTenantId =
      rawQueryTenantId !== undefined
        ? parseInt(String(rawQueryTenantId), 10)
        : NaN;
    const hasExplicitTenantQuery =
      Number.isFinite(requestedTenantId) && requestedTenantId > 0;

    // Previzualizare NIR nesalvat: doar autentificare (documentul nu există încă în DB)
    if (req.method === "POST" && req.path === "/nir-preview") {
      const auth = await authenticateFileRequest(req);
      if (!auth) {
        res.status(401).json({ error: "Neautentificat. Autentifică-te din nou." });
        return;
      }
      if (hasExplicitTenantQuery && auth.role !== "superadmin") {
        const db = await getDb();
        if (!db || !(await canAccessTenantOwner(db, auth, requestedTenantId))) {
          res.status(403).json({ error: "Acces interzis la firma solicitată." });
          return;
        }
        auth.tenantId = requestedTenantId;
      }
      (req as any).fileAuth = auth;
      next();
      return;
    }

    const m = req.path.match(/^\/([a-z-]+)\/(\d+)/i);
    if (!m) {
      res.status(404).json({ error: "Resursă inexistentă" });
      return;
    }
    const [, resource, idStr] = m;
    const id = parseInt(idStr, 10);

    const schema = await import("../drizzle/schema");
    const tables: Record<string, any> = {
      reinvoice: schema.reInvoices,
      archive: schema.invoiceArchive,
      emitted: schema.emittedInvoices,
      nir: schema.nir,
      deviz: schema.devize,
      "bon-consum": schema.bonuriConsum,
      contract: schema.contracts,
      "bank-statement": schema.bankStatements,
    };
    const table = tables[resource];
    if (!table && resource !== "spv-document") {
      res.status(404).json({ error: "Resursă inexistentă" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "DB unavailable" });
      return;
    }

    if (resource === "bank-statement") {
      const { ensureBankStatementsTable } = await import("./bankStatementsRouter");
      await ensureBankStatementsTable(db);
    }

    let row: any = null;
    if (resource === "spv-document") {
      const [spvRows]: any = await (db as any).execute(
        sql`SELECT tenantId FROM spv_portal_documents WHERE id = ${id}`
      );
      row = spvRows?.[0];
    } else if (resource === "nir") {
      const preAuth = await authenticateFileRequest(req);
      if (preAuth && (preAuth.role !== "superadmin" || hasExplicitTenantQuery)) {
        const [ownDirect] = await db
          .select({ tenantId: schema.nir.tenantId })
          .from(schema.nir)
          .where(and(eq(schema.nir.id, id), eq(schema.nir.tenantId, preAuth.tenantId)));
        if (ownDirect) {
          row = ownDirect;
        } else {
          const [ownByArchive] = await db
            .select({ tenantId: schema.nir.tenantId })
            .from(schema.nir)
            .where(and(eq(schema.nir.invoiceArchiveId, id), eq(schema.nir.tenantId, preAuth.tenantId)));
          if (ownByArchive) {
            row = ownByArchive;
          } else {
            const [invArchive] = await db
              .select({ invoiceNumber: schema.invoiceArchive.invoiceNumber, tenantId: schema.invoiceArchive.tenantId })
              .from(schema.invoiceArchive)
              .where(
                and(
                  eq(schema.invoiceArchive.id, id),
                  eq(schema.invoiceArchive.tenantId, preAuth.tenantId),
                  eq(schema.invoiceArchive.direction, "in")
                )
              );
            if (invArchive && invArchive.invoiceNumber) {
              const [byNum] = await db
                .select({ tenantId: schema.nir.tenantId })
                .from(schema.nir)
                .where(
                  and(
                    eq(schema.nir.tenantId, invArchive.tenantId),
                    eq(schema.nir.invoiceNumber, invArchive.invoiceNumber)
                  )
                )
                .limit(1);
              if (byNum) row = byNum;
            }
          }
        }
      }
      if (!row) {
        const [r] = await db
          .select({ tenantId: table.tenantId })
          .from(table)
          .where(eq(table.id, id));
        row = r;
        if (!row) {
          const [byArchive] = await db
            .select({ tenantId: schema.nir.tenantId })
            .from(schema.nir)
            .where(eq(schema.nir.invoiceArchiveId, id));
          if (byArchive) {
            row = byArchive;
          } else {
            const [invArchive] = await db
              .select({ invoiceNumber: schema.invoiceArchive.invoiceNumber, tenantId: schema.invoiceArchive.tenantId })
              .from(schema.invoiceArchive)
              .where(and(eq(schema.invoiceArchive.id, id), eq(schema.invoiceArchive.direction, "in")));
            if (invArchive && invArchive.invoiceNumber) {
              const [byNum] = await db
                .select({ tenantId: schema.nir.tenantId })
                .from(schema.nir)
                .where(
                  and(
                    eq(schema.nir.tenantId, invArchive.tenantId),
                    eq(schema.nir.invoiceNumber, invArchive.invoiceNumber)
                  )
                )
                .limit(1);
              if (byNum) row = byNum;
            }
          }
        }
      }
    } else {
      const [r] = await db
        .select({ tenantId: table.tenantId })
        .from(table)
        .where(eq(table.id, id));
      row = r;
    }

    if (!row) {
      console.warn(`[FileAuth:requirePdfAccess] Document not found for resource="${resource}" id=${id}`);
      res.status(404).json({ error: "Documentul nu a fost găsit" });
      return;
    }

    const docTenantId = Number(row.tenantId);

    // A) Verificare token sesiune contabil (din query ?accountantToken=..., header sau cookie)
    const accountantToken =
      (req.query.accountantToken as string) ||
      (req.headers["x-accountant-token"] as string) ||
      readCookie(req, "accountantSession");

    if (accountantToken) {
      const accountantAuth = verifyAndExtractAccountantSession(accountantToken);
      if (
        accountantAuth &&
        (!hasExplicitTenantQuery || requestedTenantId === docTenantId) &&
        (await isValidAccountantSessionForTenant(accountantAuth, docTenantId))
      ) {
        (req as any).fileAuth = {
          accountId: 0,
          tenantId: docTenantId,
          role: "accountant",
          allowedTenantIds: [docTenantId],
        };
        return next();
      }
    }

    // B) Verificare sesiune utilizator autentificat (header Authorization sau cookie authToken)
    const token =
      extractTokenFromHeader(req.headers.authorization) ||
      readCookie(req, "authToken");

    if (token) {
      const payload = await verifySessionToken(token);
      if (payload?.accountId) {
        const account: any = await getAccountById(payload.accountId);
        if (account && account.isActive) {
          // Superadminul are acces direct la toate firmele/documentele
          if (account.role === "superadmin") {
            const effectiveTid =
              hasExplicitTenantQuery && requestedTenantId === docTenantId
                ? requestedTenantId
                : docTenantId;
            (req as any).fileAuth = {
              accountId: account.id,
              tenantId: effectiveTid,
              role: "superadmin",
            };
            return next();
          }

          const resolved = await resolveVerifiedAccountTenant(db, account);
          if (resolved.tenantId) {
            const userAuth: FileAuthInfo = {
              accountId: account.id,
              tenantId: resolved.tenantId,
              role: String(account.role || "user"),
              allowedTenantIds: resolved.allowedTenantIds,
            };

            const canAccessDoc = await canAccessTenantOwner(db, userAuth, docTenantId);
            const canAccessRequested =
              !hasExplicitTenantQuery ||
              (requestedTenantId === docTenantId &&
                (await canAccessTenantOwner(db, userAuth, requestedTenantId)));

            if (canAccessDoc && canAccessRequested) {
              const allowed = new Set<number>(userAuth.allowedTenantIds || []);
              allowed.add(docTenantId);
              (req as any).fileAuth = {
                accountId: account.id,
                tenantId: docTenantId,
                role: String(account.role || "user"),
                allowedTenantIds: Array.from(allowed),
              };
              return next();
            }
          }
        }
      }
    }

    // Niciun mecanism de autentificare nu conferă acces la acest document
    console.warn(`[FileAuth:requirePdfAccess] Access denied for resource="${resource}" id=${id} (docTenantId=${docTenantId}). Has accountantToken=${Boolean(accountantToken)}, has userToken=${Boolean(token)}`);
    res.status(404).json({ error: "Documentul nu a fost găsit" });
  } catch (e: any) {
    console.error("[FileAuth] error:", e?.message);
    res.status(500).json({ error: "Eroare de autentificare" });
  }
}

/**
 * Pentru /uploads/invoices, /uploads/contracts și /uploads/spv_documents: pe lângă autentificare,
 * un fișier care aparține (e referit de) o altă firmă nu poate fi deschis de o firmă străină.
 * Fișierele încă nereferite trebuie să poarte prefixul t${tenantId}- al unei firme accesibile utilizatorului.
 */
export function requireUploadAccess(
  kind: "invoices" | "contracts" | "spv_documents" | "bank_statements"
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let name = req.path.replace(/^\/+/, "");
      try {
        name = decodeURIComponent(name);
      } catch {
        res.status(400).json({ error: "Cale invalidă" });
        return;
      }
      if (!name || name.includes("..") || name.includes("/") || name.includes("\\") || name.includes("\0")) {
        res.status(400).json({ error: "Cale invalidă" });
        return;
      }
      const url = `/uploads/${kind}/${name}`;

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "DB unavailable" });
        return;
      }
      const schema = await import("../drizzle/schema");
      let owners: Array<{ tenantId: number }> = [];
      if (kind === "spv_documents") {
        const [spvRows]: any = await (db as any).execute(
          sql`SELECT tenantId FROM spv_portal_documents WHERE fileUrl = ${url}`
        );
        owners = (spvRows || []).filter((r: any) => r?.tenantId);
      } else if (kind === "bank_statements") {
        const { ensureBankStatementsTable } = await import("./bankStatementsRouter");
        await ensureBankStatementsTable(db);
        owners = await db
          .select({ tenantId: schema.bankStatements.tenantId })
          .from(schema.bankStatements)
          .where(eq(schema.bankStatements.fileUrl, url));
      } else {
        const table: any = kind === "invoices" ? schema.invoiceArchive : schema.contracts;
        owners = await db
          .select({ tenantId: table.tenantId })
          .from(table)
          .where(eq(table.fileUrl, url));
      }

      // Fișiere încă nereferite (înainte de salvare)
      if (owners.length === 0) {
        if (kind === "spv_documents") {
          res.status(404).json({ error: "Fișierul nu a fost găsit" });
          return;
        }
        const auth = await authenticateFileRequest(req);
        if (!auth) {
          res.status(401).json({ error: "Neautentificat" });
          return;
        }
        if (auth.role === "superadmin") {
          (req as any).fileAuth = auth;
          return next();
        }
        const prefixMatch = name.match(/^t(\d+)-/);
        if (prefixMatch) {
          const prefixTenantId = parseInt(prefixMatch[1], 10);
          if (
            prefixTenantId > 0 &&
            (await canAccessTenantOwner(db, auth, prefixTenantId))
          ) {
            (req as any).fileAuth = auth;
            return next();
          }
        }
        res.status(404).json({ error: "Fișierul nu a fost găsit" });
        return;
      }

      const ownerTenantIds = new Set(owners.map((o: any) => Number(o.tenantId)));

      // A) Verificare token sesiune contabil
      const accountantToken =
        (req.query.accountantToken as string) ||
        (req.headers["x-accountant-token"] as string) ||
        readCookie(req, "accountantSession");

      if (accountantToken) {
        const accountantAuth = verifyAndExtractAccountantSession(accountantToken);
        if (
          accountantAuth &&
          ownerTenantIds.has(accountantAuth.tenantId) &&
          (await isValidAccountantSessionForTenant(accountantAuth, accountantAuth.tenantId))
        ) {
          (req as any).fileAuth = {
            accountId: 0,
            tenantId: accountantAuth.tenantId,
            role: "accountant",
            allowedTenantIds: [accountantAuth.tenantId],
          };
          return next();
        }
      }

      // B) Verificare sesiune utilizator
      const token =
        extractTokenFromHeader(req.headers.authorization) ||
        readCookie(req, "authToken");

      if (token) {
        const payload = await verifySessionToken(token);
        if (payload?.accountId) {
          const account: any = await getAccountById(payload.accountId);
          if (account && account.isActive) {
            if (account.role === "superadmin") {
              (req as any).fileAuth = {
                accountId: account.id,
                tenantId: owners[0].tenantId,
                role: "superadmin",
              };
              return next();
            }

            const resolved = await resolveVerifiedAccountTenant(db, account);
            if (resolved.tenantId) {
              const userAuth: FileAuthInfo = {
                accountId: account.id,
                tenantId: resolved.tenantId,
                role: String(account.role || "user"),
                allowedTenantIds: resolved.allowedTenantIds,
              };
              for (const tId of Array.from(ownerTenantIds)) {
                if (await canAccessTenantOwner(db, userAuth, tId)) {
                  const allowed = new Set<number>(userAuth.allowedTenantIds || []);
                  allowed.add(tId);
                  (req as any).fileAuth = {
                    accountId: account.id,
                    tenantId: tId,
                    role: String(account.role || "user"),
                    allowedTenantIds: Array.from(allowed),
                  };
                  return next();
                }
              }
            }
          }
        }
      }

      res.status(404).json({ error: "Fișierul nu a fost găsit" });
    } catch (e: any) {
      console.error("[UploadAccess] error:", e?.message);
      res.status(500).json({ error: "Eroare de autentificare" });
    }
  };
}

/**
 * Tenantul efectiv pentru rutele de import/export: este cel al utilizatorului autentificat,
 * dar onorează explicit ?tenantId= (sau parametrul cerut) pentru superadmin și pentru utilizatori
 * multi-tenant verificați prin canAccessTenantOwner (allowedTenantIds).
 */
export function resolveRequestTenant(req: Request, requested?: unknown): number {
  const auth: FileAuthInfo | undefined = (req as any).fileAuth;
  if (!auth) throw new Error("Neautentificat");
  const explicitQuery = req.query?.tenantId;
  const candidate =
    requested !== undefined && requested !== null && requested !== ""
      ? requested
      : explicitQuery;
  const asked = parseInt(String(candidate ?? ""), 10);
  if (Number.isFinite(asked) && asked > 0) {
    if (auth.role === "superadmin") return asked;
    const hasExplicitParam =
      explicitQuery !== undefined ||
      (req as any).body?.tenantId !== undefined ||
      (req as any).body === undefined;
    if (hasExplicitParam && auth.allowedTenantIds?.includes(asked)) {
      return asked;
    }
  }
  return auth.tenantId;
}
