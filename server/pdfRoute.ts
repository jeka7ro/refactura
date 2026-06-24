/**
 * PDF HTTP Route — /api/pdf/reinvoice/:id
 * Generează PDF-ul re-facturii direct și îl returnează ca stream HTTP.
 * Poate fi deschis în browser (previzualizare) sau descărcat.
 */
import { Router, type Request, type Response } from "express";
import { generateReInvoicePDF } from "./pdf";
import { getReInvoiceById } from "./db";
import { getDb } from "./db";
import { tenants } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export function registerPdfRoute(app: any) {
  const router = Router();

  // GET /api/pdf/reinvoice/:id?download=1
  // Returnează PDF ca stream. download=1 → attachment, altfel inline (previzualizare)
  router.get("/reinvoice/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ error: "ID invalid" }); return; }

      // Obținem sesiunea din cookie (dacă există) — fără auth strict pt simplitate
      // Fetch re-invoice from DB direct
      const db = await getDb();
      if (!db) { res.status(500).json({ error: "DB unavailable" }); return; }

      // Import schema
      const { reInvoices, reInvoiceLines } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      const [ri] = await db.select().from(reInvoices).where(eq(reInvoices.id, id));
      if (!ri) { res.status(404).json({ error: "Re-factura nu a fost găsită" }); return; }

      // Fetch lines
      const lines = await db.select().from(reInvoiceLines).where(eq(reInvoiceLines.reInvoiceId, id));

      // Fetch tenant settings
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, ri.tenantId));
      let settings: any = {};
      try { settings = JSON.parse(tenant?.settings || "{}"); } catch {}

      const isDownload = req.query.download === "1";
      const filename   = `${ri.number || `RF-${id}`}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      const pdfStream = generateReInvoicePDF({
        number:       ri.number || `RF-${id}`,
        date:         ri.issueDate || new Date().toISOString().split("T")[0],
        dueDate:      ri.dueDate || "",
        clientName:   ri.clientName || "",
        clientCUI:    ri.clientCUI || "",
        clientAddress: ri.clientAddress || "",
        clientCity:   ri.clientCity || "",
        clientCounty: "",
        clientEmail:  ri.clientEmail || "",
        clientPhone:  ri.clientPhone || "",
        companyName:  tenant?.name || "",
        companyCUI:   tenant?.cui || "",
        companyAddress: tenant?.address || "",
        companyCity:  settings.city || "",
        companyCounty: settings.county || "",
        companyEmail: tenant?.email || "",
        companyPhone: tenant?.phone || "",
        companyIBAN:  settings.iban || "",
        companyBank:  settings.bank || "",
        logoBase64:   settings.logoBase64 || undefined,
        template:     settings.invoiceTemplate || "classic",
        lines: lines.map(l => ({
          description: l.description || "",
          quantity:    parseFloat(l.quantity || "1"),
          unitPrice:   parseFloat(l.unitPrice || "0"),
          unit:        l.unit || "buc",
          vatRate:     parseFloat(l.vatRate || "21"),
          total:       parseFloat(l.total || "0"),
        })),
        subtotal:  parseFloat(ri.subtotal || "0"),
        totalVAT:  parseFloat(ri.totalVAT || "0"),
        total:     parseFloat(ri.total || "0"),
        currency:  ri.currency || "RON",
        notes:     ri.notes || undefined,
      });

      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Route] Error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.use("/api/pdf", router);
}
