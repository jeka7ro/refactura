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
  const token =
    extractTokenFromHeader(req.headers.authorization) ||
    readCookie(req, "authToken");
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload?.accountId) return null;

  const account: any = await getAccountById(payload.accountId);
  if (!account) return null;

  let tenantId: number | undefined = account.tenantId || undefined;
  if (!tenantId) {
    try {
      const t = await getDefaultTenantForUser(account.id);
      if (t) tenantId = t;
    } catch {
      /* ignore */
    }
  }
  if (!tenantId) return null;
  return { accountId: account.id, tenantId, role: String(account.role || "user") };
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
 * faptul că documentul aparține firmei utilizatorului.
 */
export async function requirePdfAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = await authenticateFileRequest(req);
    if (!auth) {
      res.status(401).json({ error: "Neautentificat. Autentifică-te din nou." });
      return;
    }
    (req as any).fileAuth = auth;

    // Previzualizare NIR nesalvat: doar autentificare (documentul nu există încă în DB)
    if (req.method === "POST" && req.path === "/nir-preview") {
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
    const [row] = await db
      .select({ tenantId: table.tenantId })
      .from(table)
      .where(eq(table.id, id));

    // Inexistent → lăsăm handlerul să răspundă 404; altă firmă → 404 (nu divulgăm existența)
    if (row && row.tenantId !== auth.tenantId) {
      res.status(404).json({ error: "Documentul nu a fost găsit" });
      return;
    }
    next();
  } catch (e: any) {
    console.error("[FileAuth] error:", e?.message);
    res.status(500).json({ error: "Eroare de autentificare" });
  }
}

/**
 * Pentru /uploads/invoices și /uploads/contracts: pe lângă autentificare, un fișier
 * care aparține (e referit de) o altă firmă nu poate fi deschis de firma curentă.
 * Fișierele încă nereferite (tocmai încărcate, înainte de salvare) rămân accesibile.
 */
export function requireUploadAccess(kind: "invoices" | "contracts") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = await authenticateFileRequest(req);
      if (!auth) {
        res.status(401).json({ error: "Neautentificat" });
        return;
      }
      (req as any).fileAuth = auth;

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
      if (owners.length > 0 && !owners.some((o: any) => o.tenantId === auth.tenantId)) {
        res.status(404).json({ error: "Fișierul nu a fost găsit" });
        return;
      }
      next();
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
