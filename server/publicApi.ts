import type { Express, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { getDb } from "./db";
import { apiKeys, costCenters, invoiceArchive, emittedInvoices, emittedInvoiceLines, clients, devize, devizeLines } from "../drizzle/schema";
import { eq, and, gte, lte, like, or, sql, desc } from "drizzle-orm";

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
          cui: costCenters.cui,
          city: costCenters.city,
          address: costCenters.address,
          email: costCenters.email,
          phone: costCenters.phone,
          isActive: costCenters.isActive,
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

  // ── POST /api/v1/facturi-emise ───────────────────────────
  // Salvează factura trimisă din QR Pontaj (sau alt serviciu) cu seria QRP și fără SPV
  app.post("/api/v1/facturi-emise", async (req: Request, res: Response) => {
    const auth = await resolveApiKey(req.headers.authorization);
    if (!auth) return res.status(401).json({ error: "Invalid or missing API key" });

    try {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const body = req.body || {};
      const tenantId = auth.tenantId;

      // Seria: specificată în body sau implicit "QRP"
      const series = (body.series || "QRP").trim().toUpperCase();

      // Numărul facturii: dacă nu este furnizat, calculăm următorul număr pentru această serie
      let invoiceNumber = body.number ? String(body.number).trim() : "";
      if (!invoiceNumber) {
        const matches = await db
          .select({ number: emittedInvoices.number })
          .from(emittedInvoices)
          .where(
            and(
              eq(emittedInvoices.tenantId, tenantId),
              or(
                eq(emittedInvoices.series, series),
                like(emittedInvoices.number, `${series}%`)
              )
            )
          );

        let maxNum = 0;
        for (const row of matches) {
          const m = (row.number || "").match(/(\d+)$/);
          if (m) {
            const val = parseInt(m[1], 10);
            if (val > maxNum) maxNum = val;
          }
        }
        const nextNum = maxNum + 1;
        invoiceNumber = `${series}-${String(nextNum).padStart(4, "0")}`;
      }

      // Prevenim duplicarea pe același număr și serie pentru această firmă
      const existing = await db
        .select({ id: emittedInvoices.id })
        .from(emittedInvoices)
        .where(
          and(
            eq(emittedInvoices.tenantId, tenantId),
            eq(emittedInvoices.number, invoiceNumber)
          )
        )
        .limit(1);

      if (existing[0]) {
        return res.status(409).json({
          error: `O factură cu numărul "${invoiceNumber}" există deja în sistem.`,
          existingId: existing[0].id,
        });
      }

      // Date client
      const clientName = (
        body.clientName ||
        body.customerName ||
        body.client?.name ||
        body.tenantName ||
        "Client QR Pontaj"
      ).trim();

      const rawCui = body.clientCUI || body.client?.cui || body.cui || "";
      const clientCUI = rawCui ? String(rawCui).trim() : null;
      const clientRegCom = body.clientRegCom || body.client?.regCom || null;
      const clientAddress = body.clientAddress || body.client?.address || null;
      const clientCity = body.clientCity || body.client?.city || null;
      const clientEmail = body.clientEmail || body.client?.email || null;
      const clientPhone = body.clientPhone || body.client?.phone || null;

      let clientCountry = "RO";
      if (body.clientCountry) {
        clientCountry = String(body.clientCountry).trim().slice(0, 2).toUpperCase();
      } else if (clientCUI) {
        const m = clientCUI.match(/^([A-Za-z]{2})/);
        if (m && m[1].toUpperCase() !== "RO") {
          clientCountry = m[1].toUpperCase();
        }
      }

      // Asociere automată clientId dacă există în tabela clients
      let clientId = body.clientId ? parseInt(String(body.clientId)) : null;
      if (!clientId && (clientCUI || clientName)) {
        const conds: any[] = [eq(clients.tenantId, tenantId)];
        if (clientCUI) {
          const normCui = clientCUI.replace(/^RO/i, "").trim();
          conds.push(or(eq(clients.cui, clientCUI), like(clients.cui, `%${normCui}%`)));
        } else {
          conds.push(eq(clients.name, clientName));
        }
        const [cMatch] = await db
          .select({ id: clients.id })
          .from(clients)
          .where(and(...conds))
          .limit(1);
        if (cMatch) clientId = cMatch.id;
      }

      // Date factură
      const nowStr = new Date().toISOString().slice(0, 10);
      const issueDate = body.issueDate ? String(body.issueDate).slice(0, 10) : nowStr;
      const dueDate = body.dueDate ? String(body.dueDate).slice(0, 10) : null;
      const currency = (body.currency || "RON").trim().toUpperCase();

      // Parsare linii factură (suportă body.lines sau body.items)
      const rawLines = Array.isArray(body.lines)
        ? body.lines
        : Array.isArray(body.items)
        ? body.items
        : [];

      let calcSubtotal = 0;
      let calcVat = 0;

      const processedLines = rawLines.map((l: any, idx: number) => {
        const qty = parseFloat(String(l.quantity ?? l.cantitate ?? 1)) || 1;
        const price = parseFloat(String(l.unitPrice ?? l.pretUnitar ?? l.price ?? 0)) || 0;
        const rate = parseFloat(String(l.vatRate ?? l.cotaTva ?? body.defaultVatRate ?? 19)) || 0;
        const lineTotal = l.total !== undefined ? parseFloat(String(l.total)) : Math.round(qty * price * 100) / 100;
        const lineVat = Math.round(lineTotal * (rate / 100) * 100) / 100;

        calcSubtotal += lineTotal;
        calcVat += lineVat;

        return {
          description: String(l.description || l.denumire || `Abonament / Servicii QR Pontaj`).trim(),
          quantity: String(qty),
          unitPrice: String(price),
          unit: String(l.unit || l.um || "buc").trim(),
          vatRate: String(rate),
          total: String(lineTotal),
          devizCode: l.devizCode ? String(l.devizCode) : null,
          devizType: l.devizType ? String(l.devizType) : null,
          lineOrder: idx,
        };
      });

      const finalSubtotal = body.subtotal !== undefined
        ? parseFloat(String(body.subtotal))
        : Math.round(calcSubtotal * 100) / 100;

      const finalTotalVAT = body.totalVAT !== undefined
        ? parseFloat(String(body.totalVAT))
        : Math.round(calcVat * 100) / 100;

      const finalTotal = body.total !== undefined
        ? parseFloat(String(body.total))
        : Math.round((finalSubtotal + finalTotalVAT) * 100) / 100;

      const notes = body.notes ? String(body.notes).trim() : "Factură generată automat din Smart QR Pontaj.";
      const status = body.status && ["draft", "sent", "paid", "overdue", "cancelled"].includes(body.status)
        ? body.status
        : "sent";

      // Inserare factură emisă: fără SPV (spvStatus = "extern", spvIndex = null)
      const [insertResult] = await db
        .insert(emittedInvoices)
        .values({
          tenantId,
          number: invoiceNumber,
          series,
          clientId,
          clientName,
          clientCUI,
          clientRegCom,
          clientAddress,
          clientCity,
          clientCountry,
          clientEmail,
          clientPhone,
          issueDate,
          dueDate,
          subtotal: String(finalSubtotal.toFixed(2)),
          totalVAT: String(finalTotalVAT.toFixed(2)),
          total: String(finalTotal.toFixed(2)),
          currency,
          companyIBAN: body.companyIBAN || null,
          companyBank: body.companyBank || null,
          status,
          notes,
          spvStatus: null, // FĂRĂ SPV (factură internă curată)
          spvIndex: null,
          spvError: null,
        } as any)
        .$returningId();

      const invoiceId = insertResult.id;

      // Inserare linii factură
      if (processedLines.length > 0) {
        await db.insert(emittedInvoiceLines).values(
          processedLines.map((l: any) => ({
            emittedInvoiceId: invoiceId,
            ...l,
          }))
        );
      } else {
        await db.insert(emittedInvoiceLines).values({
          emittedInvoiceId: invoiceId,
          description: "Servicii conform raport Smart QR Pontaj",
          quantity: "1",
          unitPrice: String(finalSubtotal.toFixed(2)),
          unit: "serviciu",
          vatRate: String(finalTotalVAT > 0 ? "19.00" : "0.00"),
          total: String(finalSubtotal.toFixed(2)),
          lineOrder: 0,
        });
      }

      // Deviz opțional dacă este furnizat de QR Pontaj (customDevizLines sau devizLines)
      const devizLinesInput = body.customDevizLines || body.devizLines || body.deviz?.lines;
      if (body.createDeviz || (Array.isArray(devizLinesInput) && devizLinesInput.length > 0)) {
        try {
          const devizNum = `DEV-${invoiceId}`;
          const devizNotes = body.devizNotes || body.deviz?.notes || "Anexă deviz nominal Smart QR Pontaj";

          const linesArr = Array.isArray(devizLinesInput) ? devizLinesInput : [];
          let dTot = 0;
          for (const dl of linesArr) {
            dTot += parseFloat(String(dl.total || 0)) || 0;
          }

          const [dRes] = await db
            .insert(devize)
            .values({
              tenantId,
              number: devizNum,
              date: new Date(),
              invoiceId,
              totalMaterials: "0",
              totalLabor: String(dTot.toFixed(2)),
              total: String(dTot.toFixed(2)),
              status: "final",
              notes: devizNotes,
            } as any)
            .$returningId();

          if (linesArr.length > 0) {
            await db.insert(devizeLines).values(
              linesArr.map((dl: any, i: number) => ({
                devizId: dRes.id,
                type: dl.type || "MANOPERA",
                code: dl.code || `QRP-${i + 1}`,
                description: String(dl.description || dl.numeAngajat || "Activitate pontaj"),
                quantity: String(dl.quantity || dl.ore || 1),
                unitPrice: String(dl.unitPrice || dl.tarifOrar || dl.total || 0),
                total: String(dl.total || 0),
                lineOrder: i,
              }))
            );
          }
        } catch (devizErr: any) {
          console.warn("[PUBLIC API] Warning la crearea devizului anexat:", devizErr.message);
        }
      }

      return res.status(201).json({
        success: true,
        message: "Factura a fost salvată cu succes în Smart Invoice!",
        data: {
          id: invoiceId,
          series,
          number: invoiceNumber,
          clientName,
          clientCUI,
          issueDate,
          dueDate,
          total: Number(finalTotal.toFixed(2)),
          subtotal: Number(finalSubtotal.toFixed(2)),
          totalVAT: Number(finalTotalVAT.toFixed(2)),
          currency,
          status,
          spvStatus: null,
          linesCount: processedLines.length || 1,
        },
      });
    } catch (e: any) {
      console.error("[PUBLIC API] Error POST /api/v1/facturi-emise:", e);
      return res.status(500).json({ error: e.message || "Internal server error" });
    }
  });
}

// ─── API Key management helpers (called from tRPC routers) ───
export { generateApiKey, hashKey };
