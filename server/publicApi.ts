import type { Express, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { getDb } from "./db";
import { apiKeys, costCenters, invoiceArchive, emittedInvoices } from "../drizzle/schema";
import { eq, and, gte, lte, like, or, sql } from "drizzle-orm";

// ─── helpers ─────────────────────────────────────────────────
function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = "sk_" + randomBytes(32).toString("hex");
  const prefix = raw.slice(0, 10);
  const hash = hashKey(raw);
  return { raw, prefix, hash };
}

async function resolveApiKey(
  authHeader: string | undefined
): Promise<{ tenantId: number; keyId: number } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7).trim();
  if (!raw) return null;
  const hash = hashKey(raw);
  const db = await getDb();
  const rows = await db
    .select({ id: apiKeys.id, tenantId: apiKeys.tenantId, isActive: apiKeys.isActive, expiresAt: apiKeys.expiresAt })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);
  const key = rows[0];
  if (!key || !key.isActive) return null;
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return null;
  // Update lastUsedAt async (no await — don't block)
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).execute();
  return { tenantId: key.tenantId, keyId: key.id };
}

// ─── register routes ─────────────────────────────────────────
export function registerPublicApi(app: Express) {
  // ── GET /api/v1/cost-centers ─────────────────────────────
  app.get("/api/v1/cost-centers", async (req: Request, res: Response) => {
    const auth = await resolveApiKey(req.headers.authorization);
    if (!auth) return res.status(401).json({ error: "Invalid or missing API key" });
    try {
      const db = await getDb();
      const centers = await db
        .select({
          id: costCenters.id,
          name: costCenters.name,
          code: costCenters.code,
          city: costCenters.city,
          address: costCenters.address,
        })
        .from(costCenters)
        .where(eq(costCenters.tenantId, auth.tenantId));
      return res.json({ data: centers });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/cost-centers/:id ─────────────────────────
  app.get("/api/v1/cost-centers/:id", async (req: Request, res: Response) => {
    const auth = await resolveApiKey(req.headers.authorization);
    if (!auth) return res.status(401).json({ error: "Invalid or missing API key" });
    const centerId = parseInt(req.params.id);
    if (isNaN(centerId)) return res.status(400).json({ error: "Invalid id" });
    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(costCenters)
        .where(and(eq(costCenters.id, centerId), eq(costCenters.tenantId, auth.tenantId)))
        .limit(1);
      if (!rows[0]) return res.status(404).json({ error: "Cost center not found" });
      return res.json({ data: rows[0] });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/cost-centers/:id/invoices ────────────────
  // Query params: from, to, supplier, limit (max 500)
  app.get("/api/v1/cost-centers/:id/invoices", async (req: Request, res: Response) => {
    const auth = await resolveApiKey(req.headers.authorization);
    if (!auth) return res.status(401).json({ error: "Invalid or missing API key" });
    const centerId = parseInt(req.params.id);
    if (isNaN(centerId)) return res.status(400).json({ error: "Invalid id" });
    const { from, to, supplier } = req.query as Record<string, string>;
    const limit = Math.min(parseInt((req.query.limit as string) || "200"), 500);
    try {
      const db = await getDb();
      // Verify center belongs to tenant
      const centerRows = await db.select({ id: costCenters.id })
        .from(costCenters)
        .where(and(eq(costCenters.id, centerId), eq(costCenters.tenantId, auth.tenantId)))
        .limit(1);
      if (!centerRows[0]) return res.status(404).json({ error: "Cost center not found" });

      const conditions: any[] = [
        eq(invoiceArchive.tenantId, auth.tenantId),
        eq(invoiceArchive.costCenterId, centerId),
      ];
      if (from) conditions.push(gte(invoiceArchive.issueDate, from));
      if (to)   conditions.push(lte(invoiceArchive.issueDate, to));
      if (supplier) {
        const term = `%${supplier}%`;
        conditions.push(or(like(invoiceArchive.supplierName, term), like(invoiceArchive.supplierCUI, term)));
      }

      const invoices = await db
        .select({
          id: invoiceArchive.id,
          invoiceNumber: invoiceArchive.invoiceNumber,
          supplierName: invoiceArchive.supplierName,
          supplierCUI: invoiceArchive.supplierCUI,
          issueDate: invoiceArchive.issueDate,
          dueDate: invoiceArchive.dueDate,
          total: invoiceArchive.total,
          totalVAT: invoiceArchive.totalVAT,
          currency: invoiceArchive.currency,
          status: invoiceArchive.status,
          direction: invoiceArchive.direction,
          fileUrl: invoiceArchive.fileUrl,
        })
        .from(invoiceArchive)
        .where(and(...conditions))
        .orderBy(invoiceArchive.issueDate)
        .limit(limit);

      const totalSpend = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
      const totalVAT   = invoices.reduce((s, i) => s + (Number(i.totalVAT) || 0), 0);

      return res.json({
        data: invoices,
        meta: {
          count: invoices.length,
          totalSpend: Number(totalSpend.toFixed(2)),
          totalVAT: Number(totalVAT.toFixed(2)),
          currency: invoices[0]?.currency || "RON",
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/cost-centers/:id/summary ─────────────────
  app.get("/api/v1/cost-centers/:id/summary", async (req: Request, res: Response) => {
    const auth = await resolveApiKey(req.headers.authorization);
    if (!auth) return res.status(401).json({ error: "Invalid or missing API key" });
    const centerId = parseInt(req.params.id);
    if (isNaN(centerId)) return res.status(400).json({ error: "Invalid id" });
    try {
      const db = await getDb();
      const centerRows = await db.select()
        .from(costCenters)
        .where(and(eq(costCenters.id, centerId), eq(costCenters.tenantId, auth.tenantId)))
        .limit(1);
      if (!centerRows[0]) return res.status(404).json({ error: "Cost center not found" });

      const invoices = await db
        .select({ total: invoiceArchive.total, totalVAT: invoiceArchive.totalVAT, supplierCUI: invoiceArchive.supplierCUI })
        .from(invoiceArchive)
        .where(and(eq(invoiceArchive.tenantId, auth.tenantId), eq(invoiceArchive.costCenterId, centerId)));

      const totalSpend = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
      const totalVAT   = invoices.reduce((s, i) => s + (Number(i.totalVAT) || 0), 0);
      const uniqueSuppliers = new Set(invoices.map(i => i.supplierCUI).filter(Boolean)).size;

      return res.json({
        data: {
          center: centerRows[0],
          summary: {
            invoiceCount: invoices.length,
            totalSpend: Number(totalSpend.toFixed(2)),
            totalVAT: Number(totalVAT.toFixed(2)),
            totalNoVAT: Number((totalSpend - totalVAT).toFixed(2)),
            uniqueSuppliers,
          },
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // FACTURI PRIMITE (invoiceArchive)
  // ═══════════════════════════════════════════════════════════

  // ── GET /api/v1/facturi-primite ───────────────────────────
  // Filtre: from, to, supplier, status, costCenterId, limit
  app.get("/api/v1/facturi-primite", async (req: Request, res: Response) => {
    const auth = await resolveApiKey(req.headers.authorization);
    if (!auth) return res.status(401).json({ error: "Invalid or missing API key" });
    const { from, to, supplier, status, costCenterId } = req.query as Record<string, string>;
    const limit = Math.min(parseInt((req.query.limit as string) || "200"), 1000);
    try {
      const db = await getDb();
      const conditions: any[] = [eq(invoiceArchive.tenantId, auth.tenantId)];
      if (from) conditions.push(gte(invoiceArchive.issueDate, from));
      if (to)   conditions.push(lte(invoiceArchive.issueDate, to));
      if (status) conditions.push(eq(invoiceArchive.status, status as any));
      if (costCenterId) conditions.push(eq(invoiceArchive.costCenterId, parseInt(costCenterId)));
      if (supplier) {
        const term = `%${supplier}%`;
        conditions.push(or(like(invoiceArchive.supplierName, term), like(invoiceArchive.supplierCUI, term)));
      }
      const rows = await db
        .select({
          id: invoiceArchive.id,
          invoiceNumber: invoiceArchive.invoiceNumber,
          supplierName: invoiceArchive.supplierName,
          supplierCUI: invoiceArchive.supplierCUI,
          issueDate: invoiceArchive.issueDate,
          dueDate: invoiceArchive.dueDate,
          total: invoiceArchive.total,
          totalVAT: invoiceArchive.totalVAT,
          currency: invoiceArchive.currency,
          status: invoiceArchive.status,
          direction: invoiceArchive.direction,
          costCenterId: invoiceArchive.costCenterId,
          fileUrl: invoiceArchive.fileUrl,
          source: invoiceArchive.source,
        })
        .from(invoiceArchive)
        .where(and(...conditions))
        .orderBy(invoiceArchive.issueDate)
        .limit(limit);
      const total = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
      const totalVAT = rows.reduce((s, r) => s + (Number(r.totalVAT) || 0), 0);
      return res.json({
        data: rows,
        meta: { count: rows.length, totalSpend: +total.toFixed(2), totalVAT: +totalVAT.toFixed(2) },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/facturi-primite/:id ──────────────────────
  app.get("/api/v1/facturi-primite/:id", async (req: Request, res: Response) => {
    const auth = await resolveApiKey(req.headers.authorization);
    if (!auth) return res.status(401).json({ error: "Invalid or missing API key" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(invoiceArchive)
        .where(and(eq(invoiceArchive.id, id), eq(invoiceArchive.tenantId, auth.tenantId)))
        .limit(1);
      if (!rows[0]) return res.status(404).json({ error: "Invoice not found" });
      return res.json({ data: rows[0] });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // FACTURI EMISE (emittedInvoices)
  // ═══════════════════════════════════════════════════════════

  // ── GET /api/v1/facturi-emise ─────────────────────────────
  // Filtre: from, to, client, status, limit
  app.get("/api/v1/facturi-emise", async (req: Request, res: Response) => {
    const auth = await resolveApiKey(req.headers.authorization);
    if (!auth) return res.status(401).json({ error: "Invalid or missing API key" });
    const { from, to, client, status } = req.query as Record<string, string>;
    const limit = Math.min(parseInt((req.query.limit as string) || "200"), 1000);
    try {
      const db = await getDb();
      const conditions: any[] = [eq(emittedInvoices.tenantId, auth.tenantId)];
      if (from) conditions.push(gte(emittedInvoices.issueDate, from));
      if (to)   conditions.push(lte(emittedInvoices.issueDate, to));
      if (status) conditions.push(eq(emittedInvoices.status, status as any));
      if (client) {
        const term = `%${client}%`;
        conditions.push(or(like(emittedInvoices.clientName, term), like(emittedInvoices.clientCUI, term)));
      }
      const rows = await db
        .select({
          id: emittedInvoices.id,
          number: emittedInvoices.number,
          series: emittedInvoices.series,
          clientName: emittedInvoices.clientName,
          clientCUI: emittedInvoices.clientCUI,
          clientEmail: emittedInvoices.clientEmail,
          issueDate: emittedInvoices.issueDate,
          dueDate: emittedInvoices.dueDate,
          subtotal: emittedInvoices.subtotal,
          totalVAT: emittedInvoices.totalVAT,
          total: emittedInvoices.total,
          currency: emittedInvoices.currency,
          status: emittedInvoices.status,
          spvStatus: emittedInvoices.spvStatus,
          pdfUrl: emittedInvoices.pdfUrl,
          createdAt: emittedInvoices.createdAt,
        })
        .from(emittedInvoices)
        .where(and(...conditions))
        .orderBy(emittedInvoices.issueDate)
        .limit(limit);
      const totalSpend = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
      const totalVAT   = rows.reduce((s, r) => s + (Number(r.totalVAT) || 0), 0);
      return res.json({
        data: rows,
        meta: { count: rows.length, totalRevenue: +totalSpend.toFixed(2), totalVAT: +totalVAT.toFixed(2) },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/facturi-emise/:id ────────────────────────
  app.get("/api/v1/facturi-emise/:id", async (req: Request, res: Response) => {
    const auth = await resolveApiKey(req.headers.authorization);
    if (!auth) return res.status(401).json({ error: "Invalid or missing API key" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(emittedInvoices)
        .where(and(eq(emittedInvoices.id, id), eq(emittedInvoices.tenantId, auth.tenantId)))
        .limit(1);
      if (!rows[0]) return res.status(404).json({ error: "Invoice not found" });
      return res.json({ data: rows[0] });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
}

// ─── API Key management helpers (called from tRPC routers) ───
export { generateApiKey, hashKey };
