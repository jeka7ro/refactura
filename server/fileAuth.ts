/**
 * Autentificare pentru endpoint-urile de fișiere (PDF-uri, uploads).
 * Aceste URL-uri se deschid direct din browser (href / iframe / window.open),
 * deci nu pot trimite header-ul Authorization. Clientul pune tokenul de sesiune
 * într-un cookie (vezi client/src/lib/authCookie.ts), iar aici îl verificăm.
 */
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { verifySessionToken, extractTokenFromHeader } from "./session";
import { getAccountById } from "./auth";
import { getDb, getDefaultTenantForUser } from "./db";
import { verifyAndExtractAccountantSession } from "./accountantPortalRouter";

export interface FileAuthInfo {
  accountId: number;
  tenantId: number;
  role: string;
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
  // 1. Suport prioritar pentru Portalul Contabil dacă token-ul este trimis explicit prin query sau header
  const explicitAccountantToken =
    (req.query.accountantToken as string) ||
    (req.headers["x-accountant-token"] as string);

  if (explicitAccountantToken) {
    const accountantAuth = verifyAndExtractAccountantSession(explicitAccountantToken);
    if (accountantAuth?.tenantId) {
      return {
        accountId: 0,
        tenantId: accountantAuth.tenantId,
        role: "accountant",
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
      if (account) {
        let tenantId: number | undefined = account.tenantId || undefined;
        if (!tenantId) {
          try {
            const t = await getDefaultTenantForUser(account.id);
            if (t) tenantId = t;
          } catch {
            /* ignore */
          }
        }
        if (tenantId) {
          return { accountId: account.id, tenantId, role: String(account.role || "user") };
        }
      }
    }
  }

  // 3. Suport fallback din cookie accountantSession
  const cookieAccountantToken = readCookie(req, "accountantSession");
  if (cookieAccountantToken) {
    const accountantAuth = verifyAndExtractAccountantSession(cookieAccountantToken);
    if (accountantAuth?.tenantId) {
      return {
        accountId: 0,
        tenantId: accountantAuth.tenantId,
        role: "accountant",
      };
    }
  }

  return null;
}

/** Cere doar autentificare (fără verificare de proprietar) — pentru fișiere statice. */
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
    // Previzualizare NIR nesalvat: doar autentificare (documentul nu există încă în DB)
    if (req.method === "POST" && req.path === "/nir-preview") {
      const auth = await authenticateFileRequest(req);
      if (!auth) {
        res.status(401).json({ error: "Neautentificat. Autentifică-te din nou." });
        return;
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
    };
    const table = tables[resource];
    if (!table) {
      res.status(404).json({ error: "Resursă inexistentă" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "DB unavailable" });
      return;
    }

    let [row] = await db
      .select({ tenantId: table.tenantId })
      .from(table)
      .where(eq(table.id, id));

    // Fallback pentru NIR: dacă se transmite id-ul de arhivă al facturii în loc de id-ul nir
    if (!row && resource === "nir") {
      const [byArchive] = await db
        .select({ tenantId: schema.nir.tenantId })
        .from(schema.nir)
        .where(eq(schema.nir.invoiceArchiveId, id));
      if (byArchive) {
        row = byArchive;
      }
    }

    if (!row) {
      res.status(404).json({ error: "Documentul nu a fost găsit" });
      return;
    }

    const docTenantId = row.tenantId;

    // A) Verificare token sesiune contabil (din query ?accountantToken=..., header sau cookie)
    const accountantToken =
      (req.query.accountantToken as string) ||
      (req.headers["x-accountant-token"] as string) ||
      readCookie(req, "accountantSession");

    if (accountantToken) {
      const accountantAuth = verifyAndExtractAccountantSession(accountantToken);
      if (accountantAuth && accountantAuth.tenantId === docTenantId) {
        (req as any).fileAuth = {
          accountId: 0,
          tenantId: docTenantId,
          role: "accountant",
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
        if (account) {
          // Superadminul are acces direct la toate firmele/documentele
          if (account.role === "superadmin") {
            (req as any).fileAuth = {
              accountId: account.id,
              tenantId: docTenantId,
              role: "superadmin",
            };
            return next();
          }

          // Utilizator pe propriul tenant direct
          if (account.tenantId === docTenantId) {
            (req as any).fileAuth = {
              accountId: account.id,
              tenantId: docTenantId,
              role: String(account.role || "user"),
            };
            return next();
          }

          // Verificare acces multi-tenant în tabela userTenants
          const { userTenants } = await import("../drizzle/schema");
          const { and: andOp, eq: eqOp } = await import("drizzle-orm");
          const [ut] = await db
            .select({ id: userTenants.id })
            .from(userTenants)
            .where(
              andOp(
                eqOp(userTenants.userId, account.id),
                eqOp(userTenants.tenantId, docTenantId),
                eqOp(userTenants.isActive, 1)
              )
            )
            .limit(1);

          if (ut) {
            (req as any).fileAuth = {
              accountId: account.id,
              tenantId: docTenantId,
              role: String(account.role || "user"),
            };
            return next();
          }
        }
      }
    }

    // Niciun mecanism de autentificare nu conferă acces la acest document
    res.status(404).json({ error: "Documentul nu a fost găsit" });
  } catch (e: any) {
    console.error("[FileAuth] error:", e?.message);
    res.status(500).json({ error: "Eroare de autentificare" });
  }
}

/**
 * Pentru /uploads/invoices și /uploads/contracts: pe lângă autentificare, un fișier
 * care aparține (e referit de) o altă firmă nu poate fi deschis de o firmă străină.
 * Fișierele încă nereferite (tocmai încărcate, înainte de salvare) rămân accesibile.
 */
export function requireUploadAccess(kind: "invoices" | "contracts") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let name = req.path.replace(/^\/+/, "");
      try {
        name = decodeURIComponent(name);
      } catch {
        /* keep raw */
      }
      if (!name || name.includes("..")) {
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
      const table: any = kind === "invoices" ? schema.invoiceArchive : schema.contracts;
      const owners = await db
        .select({ tenantId: table.tenantId })
        .from(table)
        .where(eq(table.fileUrl, url));

      // Fișiere încă nereferite (înainte de salvare)
      if (owners.length === 0) {
        const auth = await authenticateFileRequest(req);
        if (!auth) {
          res.status(401).json({ error: "Neautentificat" });
          return;
        }
        (req as any).fileAuth = auth;
        return next();
      }

      const ownerTenantIds = new Set(owners.map((o: any) => o.tenantId));

      // A) Verificare token sesiune contabil
      const accountantToken =
        (req.query.accountantToken as string) ||
        (req.headers["x-accountant-token"] as string) ||
        readCookie(req, "accountantSession");

      if (accountantToken) {
        const accountantAuth = verifyAndExtractAccountantSession(accountantToken);
        if (accountantAuth && ownerTenantIds.has(accountantAuth.tenantId)) {
          (req as any).fileAuth = {
            accountId: 0,
            tenantId: accountantAuth.tenantId,
            role: "accountant",
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
          if (account) {
            if (account.role === "superadmin") {
              (req as any).fileAuth = {
                accountId: account.id,
                tenantId: owners[0].tenantId,
                role: "superadmin",
              };
              return next();
            }

            if (account.tenantId && ownerTenantIds.has(account.tenantId)) {
              (req as any).fileAuth = {
                accountId: account.id,
                tenantId: account.tenantId,
                role: String(account.role || "user"),
              };
              return next();
            }

            const { userTenants } = await import("../drizzle/schema");
            const { and: andOp, eq: eqOp } = await import("drizzle-orm");
            for (const tId of Array.from(ownerTenantIds)) {
              const [ut] = await db
                .select({ id: userTenants.id })
                .from(userTenants)
                .where(
                  andOp(
                    eqOp(userTenants.userId, account.id),
                    eqOp(userTenants.tenantId, tId),
                    eqOp(userTenants.isActive, 1)
                  )
                )
                .limit(1);

              if (ut) {
                (req as any).fileAuth = {
                  accountId: account.id,
                  tenantId: tId,
                  role: String(account.role || "user"),
                };
                return next();
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
 * Tenantul efectiv pentru rutele de import/export: este mereu cel al utilizatorului
 * autentificat. Doar superadmin poate specifica explicit alt tenant.
 */
export function resolveRequestTenant(req: Request, requested?: unknown): number {
  const auth: FileAuthInfo | undefined = (req as any).fileAuth;
  if (!auth) throw new Error("Neautentificat");
  const asked = parseInt(String(requested ?? ""), 10);
  if (auth.role === "superadmin" && Number.isFinite(asked) && asked > 0) return asked;
  return auth.tenantId;
}
