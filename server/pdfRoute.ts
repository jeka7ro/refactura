/**
 * PDF HTTP Route — /api/pdf/reinvoice/:id
 * Generează PDF-ul re-facturii direct și îl returnează ca stream HTTP.
 * Poate fi deschis în browser (previzualizare) sau descărcat.
 */
import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
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

      let logoBase64 = settings.logoBase64 || "DEFAULT_TEXT_LOGO";

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
        logoBase64:   logoBase64 || undefined,
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

      pdfStream.on("error", (err: any) => {
        if (!res.headersSent) res.status(500).json({ error: err.message });
      });
      res.on("close", () => { try { pdfStream.destroy?.(); } catch {} });
      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // GET /api/pdf/archive/:id — Convert stored XML to PDF on-the-fly via ANAF
  router.get("/archive/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ error: "ID invalid" }); return; }

      const db = await getDb();
      if (!db) { res.status(500).json({ error: "DB unavailable" }); return; }

      const { invoiceArchive, integrations } = await import("../drizzle/schema");
      const { and: andOp } = await import("drizzle-orm");
      const [inv] = await db.select().from(invoiceArchive).where(eq(invoiceArchive.id, id));
      if (!inv) { res.status(404).json({ error: "Factura nu a fost găsită" }); return; }

      let xmlContent = inv.rawXml;

      // If rawXml missing, try to re-download from SPV
      if (!xmlContent && inv.source === "spv_anaf" && inv.fileName) {
        console.log(`[PDF Archive] rawXml missing for ${inv.invoiceNumber}, attempting re-download...`);
        
        // Extract download ID from fileName (format: SPV_<downloadId>.zip)
        const match = inv.fileName.match(/SPV_(\d+)\.zip/);
        if (match) {
          const downloadId = match[1];
          
          // Get SPV access token
          const [spvIntg] = await db.select().from(integrations)
            .where(andOp(
              eq(integrations.tenantId, inv.tenantId),
              eq(integrations.provider, "spv"),
              eq(integrations.status, "active")
            ));

          if (spvIntg?.apiKey) {
            try {
              const AdmZip = (await import("adm-zip")).default;
              const zipRes = await fetch(`https://api.anaf.ro/prod/FCTEL/rest/descarcare?id=${downloadId}`, {
                headers: { "Authorization": `Bearer ${spvIntg.apiKey}` },
                signal: AbortSignal.timeout(30000),
              });

              if (zipRes.ok) {
                const buffer = await zipRes.arrayBuffer();
                const zip = new AdmZip(Buffer.from(buffer));
                const xmlEntry = zip.getEntries().find(e => 
                  e.entryName.toLowerCase().endsWith(".xml") && !e.entryName.toLowerCase().includes("semnatura")
                );
                if (xmlEntry) {
                  xmlContent = xmlEntry.getData().toString("utf8");
                  // Store it for future use
                  await db.update(invoiceArchive).set({ rawXml: xmlContent }).where(eq(invoiceArchive.id, id));
                  console.log(`[PDF Archive] Re-downloaded and stored XML for ${inv.invoiceNumber}`);
                }
              }
            } catch (dlErr: any) {
              console.error(`[PDF Archive] Re-download failed: ${dlErr.message}`);
            }
          }
        }
      }

      if (!xmlContent) {
        res.status(404).json({ error: "XML-ul original nu este disponibil. Mergi la Integrări → SPV → Sincronizează pentru a re-descărca facturile." });
        return;
      }

      // Parse XML internally instead of calling ANAF
      const { XMLParser } = await import("fast-xml-parser");
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
      const parsed = parser.parse(xmlContent);
      const invoiceObj = parsed.Invoice || parsed.CreditNote;

      if (!invoiceObj) {
        res.status(500).json({ error: "Invalid SPV XML format: neither Invoice nor CreditNote found." });
        return;
      }

      // Default logo string for the text-based layout
      let logoBase64 = "DEFAULT_TEXT_LOGO";
      try {
        const { tenants } = await import("../drizzle/schema");
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, inv.tenantId));
        if (tenant?.settings) {
          const settings = JSON.parse(tenant.settings);
          if (settings.logoBase64) logoBase64 = settings.logoBase64;
        }
      } catch (_) {}

      const direction = inv.direction; // 'in' or 'out'
      const supplierParty = invoiceObj["cac:AccountingSupplierParty"]?.["cac:Party"];
      const customerParty = invoiceObj["cac:AccountingCustomerParty"]?.["cac:Party"];

      const extractPartyDetails = (party: any) => ({
        name: party?.["cac:PartyName"]?.["cbc:Name"] || party?.["cac:PartyLegalEntity"]?.["cbc:RegistrationName"] || "",
        cui: party?.["cac:PartyTaxScheme"]?.["cbc:CompanyID"] || party?.["cac:PartyLegalEntity"]?.["cbc:CompanyID"] || "",
        address: party?.["cac:PostalAddress"]?.["cbc:StreetName"] || "",
        city: party?.["cac:PostalAddress"]?.["cbc:CityName"] || "",
        county: party?.["cac:PostalAddress"]?.["cbc:CountrySubentity"] || "",
        email: party?.["cac:Contact"]?.["cbc:ElectronicMail"] || "",
        phone: party?.["cac:Contact"]?.["cbc:Telephone"] || "",
        iban: party?.["cac:PartyTaxScheme"]?.["cac:TaxScheme"]?.["cbc:ID"] || "" // Simplified, usually IBAN is in PaymentMeans
      });

      const supplierDetails = extractPartyDetails(supplierParty);
      const customerDetails = extractPartyDetails(customerParty);

      let xmlLines = invoiceObj["cac:InvoiceLine"] || invoiceObj["cac:CreditNoteLine"] || [];
      if (!Array.isArray(xmlLines)) xmlLines = [xmlLines];

      const lines = xmlLines.map((line: any) => {
        const item = line["cac:Item"];
        const price = line["cac:Price"];
        const taxCategory = item?.["cac:ClassifiedTaxCategory"];
        
        return {
          description: String(item?.["cbc:Name"] || item?.["cbc:Description"] || "Articol"),
          quantity: parseFloat(line["cbc:InvoicedQuantity"]?.["#text"] || line["cbc:InvoicedQuantity"] || line["cbc:CreditedQuantity"]?.["#text"] || line["cbc:CreditedQuantity"] || "1"),
          unitPrice: parseFloat(price?.["cbc:PriceAmount"]?.["#text"] || price?.["cbc:PriceAmount"] || "0"),
          unit: String(line["cbc:InvoicedQuantity"]?.["@_unitCode"] || line["cbc:CreditedQuantity"]?.["@_unitCode"] || "buc"),
          vatRate: parseFloat(taxCategory?.["cbc:Percent"]?.["#text"] || taxCategory?.["cbc:Percent"] || "19"),
          total: parseFloat(line["cbc:LineExtensionAmount"]?.["#text"] || line["cbc:LineExtensionAmount"] || "0"),
        };
      });

      const legalTotal = invoiceObj["cac:LegalMonetaryTotal"];
      const taxTotal = invoiceObj["cac:TaxTotal"];

      const pdfData = {
        number: String(invoiceObj["cbc:ID"] || inv.invoiceNumber),
        date: String(invoiceObj["cbc:IssueDate"] || inv.issueDate),
        dueDate: String(invoiceObj["cbc:DueDate"] || invoiceObj["cbc:IssueDate"] || inv.dueDate),
        
        companyName: supplierDetails.name,
        companyCUI: supplierDetails.cui,
        companyAddress: supplierDetails.address,
        companyCity: supplierDetails.city,
        companyCounty: supplierDetails.county,
        companyEmail: supplierDetails.email,
        companyPhone: supplierDetails.phone,
        companyIBAN: supplierDetails.iban,
        companyBank: "",
        
        clientName: customerDetails.name,
        clientCUI: customerDetails.cui,
        clientAddress: customerDetails.address,
        clientCity: customerDetails.city,
        clientCounty: customerDetails.county,
        clientEmail: customerDetails.email,
        clientPhone: customerDetails.phone,
        
        logoBase64,
        template: "classic" as any,
        lines,
        
        subtotal: parseFloat(legalTotal?.["cbc:TaxExclusiveAmount"]?.["#text"] || legalTotal?.["cbc:TaxExclusiveAmount"] || "0"),
        totalVAT: parseFloat(taxTotal?.["cbc:TaxAmount"]?.["#text"] || taxTotal?.["cbc:TaxAmount"] || "0"),
        total: parseFloat(legalTotal?.["cbc:TaxInclusiveAmount"]?.["#text"] || legalTotal?.["cbc:TaxInclusiveAmount"] || legalTotal?.["cbc:PayableAmount"]?.["#text"] || "0"),
        currency: String(invoiceObj["cbc:DocumentCurrencyCode"]?.["#text"] || invoiceObj["cbc:DocumentCurrencyCode"] || "RON")
      };

      const isDownload = req.query.download === "1";
      const filename = `SPV_${pdfData.number}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      const pdfStream = generateReInvoicePDF(pdfData);
      pdfStream.on("error", (err: any) => { if (!res.headersSent) res.status(500).json({ error: err.message }); });
      res.on("close", () => { try { pdfStream.destroy?.(); } catch {} });
      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Archive Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // GET /api/pdf/emitted/:id
  router.get("/emitted/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ error: "ID invalid" }); return; }

      const db = await getDb();
      if (!db) { res.status(500).json({ error: "DB unavailable" }); return; }

      const { emittedInvoices, emittedInvoiceLines, tenants } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const [inv] = await db.select().from(emittedInvoices).where(eq(emittedInvoices.id, id));
      if (!inv) { res.status(404).json({ error: "Factura nu a fost găsită" }); return; }

      const lines = await db.select().from(emittedInvoiceLines).where(eq(emittedInvoiceLines.emittedInvoiceId, id));

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, inv.tenantId));
      let settings: any = {};
      try { settings = JSON.parse(tenant?.settings || "{}"); } catch {}

      const isDownload = req.query.download === "1";
      const filename = `${inv.series}${inv.number || `FACT-${id}`}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${filename}"`
      );

      let logoBase64 = settings.logoBase64 || "DEFAULT_TEXT_LOGO";

      const pdfStream = generateReInvoicePDF({
        number: `${inv.series || ''} ${inv.number || ''}`.trim(),
        date: inv.issueDate || new Date().toISOString().split("T")[0],
        dueDate: inv.dueDate || "",
        clientName: inv.clientName || "",
        clientCUI: inv.clientCUI || "",
        clientAddress: inv.clientAddress || "",
        clientCity: "",
        clientCounty: "",
        clientEmail: "",
        clientPhone: "",
        companyName: tenant?.name || "",
        companyCUI: tenant?.cui || "",
        companyAddress: tenant?.address || "",
        companyCity: settings.city || "",
        companyCounty: settings.county || "",
        companyEmail: tenant?.email || "",
        companyPhone: tenant?.phone || "",
        companyIBAN: settings.iban || "",
        companyBank: settings.bank || "",
        logoBase64,
        template: settings.invoiceTemplate || "classic",
        lines: lines.map(l => ({
          description: l.description || "",
          quantity: parseFloat(l.quantity || "1"),
          unitPrice: parseFloat(l.unitPrice || "0"),
          unit: l.unit || "buc",
          vatRate: parseFloat(l.vatRate || "21"),
          total: parseFloat(l.total || "0"),
        })),
        subtotal: parseFloat(inv.subtotal || "0"),
        totalVAT: parseFloat(inv.totalVAT || "0"),
        total: parseFloat(inv.total || "0"),
        currency: inv.currency || "RON",
        notes: inv.mentions || undefined,
      });

      pdfStream.on("error", (err: any) => { if (!res.headersSent) res.status(500).json({ error: err.message }); });
      res.on("close", () => { try { pdfStream.destroy?.(); } catch {} });
      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Emitted Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  // ─── GET /api/pdf/nir/:id — PDF Nota de Intrare-Recepție ─────────────────────
  router.get("/nir/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ error: "ID invalid" }); return; }

      const db = await getDb();
      if (!db) { res.status(500).json({ error: "DB unavailable" }); return; }

      const { nir, nirLines } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");

      const [nirRow] = await db.select().from(nir).where(eqOp(nir.id, id));
      if (!nirRow) { res.status(404).json({ error: "NIR nu a fost găsit" }); return; }

      const lines = await db.select().from(nirLines).where(eqOp(nirLines.nirId, id)).orderBy(nirLines.lineOrder);
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, nirRow.tenantId));
      let settings: any = {};
      try { settings = JSON.parse(tenant?.settings || "{}"); } catch {}

      const logoBase64: string | undefined = settings.logoBase64 || undefined;
      const isDownload = req.query.download === "1";
      const filename = `NIR-${nirRow.nirNumber || id}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `${isDownload ? "attachment" : "inline"}; filename="${filename}"`);

      // ── Generate NIR PDF with PDFKit ──
      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
      // Inregistrare fonturi cu diacritice (Roboto)
      const robotoReg = path.resolve(process.cwd(), "server/assets/fonts/Roboto-Regular.ttf");
      const robotoBold = path.resolve(process.cwd(), "server/assets/fonts/Roboto-Bold.ttf");
      if (fs.existsSync(robotoReg)) doc.registerFont("Roboto", robotoReg);
      if (fs.existsSync(robotoBold)) doc.registerFont("Roboto-Bold", robotoBold);

      // Pipe to response
      doc.pipe(res);

      const W = doc.page.width - 80; // usable width
      const BLUE = "#1e6fbf";
      const TEAL = "#0d9488";
      const GRAY = "#64748b";
      const LIGHT = "#f8fafc";
      const BORDER = "#e2e8f0";

      // ── HEADER ──────────────────────────────────────────────────────────────
      // Logo stânga
      logoBase64 = "DEFAULT_TEXT_LOGO"; // Ignorăm logoBase64 din baza de date pentru că utilizatorul vrea exclusiv logoul GetApp peste tot
      if (logoBase64 === "DEFAULT_TEXT_LOGO") {
        let foundPath = null;
        try {
          const possiblePaths = [
            path.resolve(process.cwd(), "client/public/logo.png"),
            path.resolve(process.cwd(), "../client/public/logo.png"),
            path.resolve(process.cwd(), "dist/public/logo.png"),
            path.resolve(process.cwd(), "server/assets/logo.png")
          ];
          for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
              foundPath = p;
              break;
            }
          }
          if (foundPath) {
            const imgBuffer = fs.readFileSync(foundPath);
            doc.image(imgBuffer, 40, 30, { width: 140 }); 
          } else {
            doc.fontSize(14).font("Roboto-Bold").fillColor(BLUE).text(tenant?.name || "Firma", 40, 40);
          }
        } catch {
           doc.fontSize(14).font("Roboto-Bold").fillColor(BLUE).text(tenant?.name || "Firma", 40, 40);
        }
      } else {
        try {
          const imgBuf = Buffer.from(logoBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
          doc.image(imgBuf, 40, 30, { height: 50, fit: [160, 50] });
        } catch { doc.fontSize(14).font("Roboto-Bold").fillColor(BLUE).text(tenant?.name || "Firma", 40, 40); }
      }


      // Titlu NIR dreapta
      doc.fontSize(18).font("Roboto-Bold").fillColor(TEAL)
        .text("NOTĂ DE INTRARE-RECEPȚIE", 0, 35, { align: "right" });
      doc.fontSize(9).font("Roboto").fillColor(GRAY)
        .text("(Cod formular 14-3-1/aA — OMFP 2634/2015)", 0, 57, { align: "right" });

      doc.moveDown(0.3);
      doc.moveTo(40, 90).lineTo(doc.page.width - 40, 90).strokeColor(TEAL).lineWidth(2).stroke();

      // ── DATE NIR ─────────────────────────────────────────────────────────────
      let y = 100;
      doc.rect(40, y, W, 70).fillColor(LIGHT).fill();
      doc.rect(40, y, W, 70).strokeColor(BORDER).lineWidth(0.5).stroke();

      doc.fontSize(7).font("Roboto-Bold").fillColor(GRAY).text("DATE NIR", 50, y + 6);
      y += 16;

      const col = W / 4;
      const fields: [string, string][] = [
        ["Nr. NIR:", nirRow.nirNumber],
        ["Data recepție:", nirRow.receiptDate],
        ["Nr. factură:", nirRow.invoiceNumber || "—"],
        ["Nr. aviz:", nirRow.avizNumber || "—"],
      ];
      fields.forEach(([label, val], i) => {
        const x = 50 + i * col;
        doc.fontSize(7).font("Roboto").fillColor(GRAY).text(label, x, y);
        doc.fontSize(8).font("Roboto-Bold").fillColor("#1e293b").text(val, x, y + 10);
      });

      y += 32;
      doc.fontSize(7).font("Roboto").fillColor(GRAY).text("Gestiunea:", 50, y);
      doc.fontSize(8).font("Roboto-Bold").fillColor("#1e293b").text(nirRow.gestiune || "—", 50, y + 10);

      // ── FURNIZOR + FIRMA ──────────────────────────────────────────────────────
      y = 180;
      const halfW = (W - 10) / 2;

      // Furnizor box
      doc.rect(40, y, halfW, 70).fillColor(LIGHT).fill();
      doc.rect(40, y, halfW, 70).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fontSize(7).font("Roboto-Bold").fillColor(GRAY).text("FURNIZOR", 50, y + 6);
      doc.fontSize(9).font("Roboto-Bold").fillColor("#1e293b").text(nirRow.supplierName || "—", 50, y + 18, { width: halfW - 20 });
      doc.fontSize(7).font("Roboto").fillColor(GRAY)
        .text(`CUI: ${nirRow.supplierCUI || "—"}`, 50, y + 31)
        .text(nirRow.supplierAddress || "", 50, y + 42, { width: halfW - 20 });

      // Firma box
      const x2 = 40 + halfW + 10;
      doc.rect(x2, y, halfW, 70).fillColor(LIGHT).fill();
      doc.rect(x2, y, halfW, 70).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fontSize(7).font("Roboto-Bold").fillColor(GRAY).text("UNITATEA", x2 + 10, y + 6);
      doc.fontSize(9).font("Roboto-Bold").fillColor("#1e293b").text(tenant?.name || "—", x2 + 10, y + 18, { width: halfW - 20 });
      doc.fontSize(7).font("Roboto").fillColor(GRAY)
        .text(`CUI: ${tenant?.cui || "—"}`, x2 + 10, y + 31)
        .text(tenant?.address || "", x2 + 10, y + 42, { width: halfW - 20 });

      // ── TABEL PRODUSE ─────────────────────────────────────────────────────────
      y = 260;
      doc.fontSize(7).font("Roboto-Bold").fillColor(GRAY).text("PRODUSE / SERVICII RECEPȚIONATE", 40, y);
      y += 12;

      // Header tabel
      const cols = [30, 170, 30, 50, 50, 50, 55]; // widths
      const headers = ["Nr.", "Denumire produs/serviciu", "U/M", "Cant. doc.", "Cant. recept.", "Preț unit.", "Valoare RON"];
      let xOff = 40;
      doc.rect(40, y, W, 16).fillColor(TEAL).fill();
      headers.forEach((h, i) => {
        doc.fontSize(6.5).font("Roboto-Bold").fillColor("white")
          .text(h, xOff + 3, y + 5, { width: cols[i] - 4, align: i > 2 ? "right" : "left" });
        xOff += cols[i];
      });
      y += 16;

      // Rows
      lines.forEach((line, idx) => {
        const rowH = 16;
        const hasDiff = parseFloat(line.cantitateReceptionata || "0") !== parseFloat(line.cantitateComanda || "0");
        doc.rect(40, y, W, rowH).fillColor(idx % 2 === 0 ? LIGHT : "white").fill();
        if (hasDiff) {
          doc.rect(40, y, W, rowH).fillColor("#fef3c7").fill();
        }
        doc.rect(40, y, W, rowH).strokeColor(BORDER).lineWidth(0.3).stroke();

        let xc = 40;
        const cells = [
          { val: String(idx + 1), align: "left" as const },
          { val: line.description, align: "left" as const },
          { val: line.unit || "buc", align: "left" as const },
          { val: parseFloat(line.cantitateComanda || "0").toLocaleString("ro-RO"), align: "right" as const },
          { val: parseFloat(line.cantitateReceptionata || "0").toLocaleString("ro-RO"), align: "right" as const },
          { val: parseFloat(line.unitPrice || "0").toLocaleString("ro-RO", { minimumFractionDigits: 2 }), align: "right" as const },
          { val: parseFloat(line.total || "0").toLocaleString("ro-RO", { minimumFractionDigits: 2 }), align: "right" as const },
        ];
        cells.forEach((cell, ci) => {
          const color = ci === 4 && hasDiff ? "#b45309" : "#1e293b";
          doc.fontSize(7).font(ci === 4 && hasDiff ? "Roboto-Bold" : "Roboto")
            .fillColor(color)
            .text(cell.val, xc + 3, y + 5, { width: cols[ci] - 6, align: cell.align, ellipsis: true });
          xc += cols[ci];
        });
        y += rowH;

        // New page if needed
        if (y > doc.page.height - 180) {
          doc.addPage();
          y = 40;
        }
      });

      // Total row
      doc.rect(40, y, W, 18).fillColor(TEAL).fill();
      doc.fontSize(8).font("Roboto-Bold").fillColor("white")
        .text("TOTAL VALOARE RECEPȚIONATĂ:", 40 + 3, y + 5, { width: W - 65, align: "right" });
      const total = lines.reduce((s, l) => s + parseFloat(l.total || "0"), 0);
      doc.text(`${total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON`, 40 + W - 60, y + 5, { width: 55, align: "right" });
      y += 26;

      // Diferente alert
      const hasDifferences = lines.some(l => parseFloat(l.cantitateReceptionata || "0") !== parseFloat(l.cantitateComanda || "0"));
      if (hasDifferences) {
        doc.rect(40, y, W, 24).fillColor("#fef3c7").fill();
        doc.rect(40, y, W, 24).strokeColor("#f59e0b").lineWidth(0.5).stroke();
        doc.fontSize(8).font("Roboto-Bold").fillColor("#92400e")
          .text("⚠ ATENȚIE: Există diferențe cantitative — NIR se întocmește în 3 exemplare (conf. OMFP 2634/2015)", 50, y + 8);
        y += 30;
        if (nirRow.differenceNotes) {
          doc.fontSize(7).font("Roboto").fillColor(GRAY).text(`Constatări: ${nirRow.differenceNotes}`, 50, y);
          y += 14;
        }
      }

      // ── COMISIA DE RECEPȚIE ───────────────────────────────────────────────────
      y += 8;
      if (y > doc.page.height - 120) { doc.addPage(); y = 40; }

      doc.fontSize(8).font("Roboto-Bold").fillColor(GRAY).text("COMISIA DE RECEPȚIE", 40, y);
      y += 12;

      const members = [
        { name: nirRow.member1Name, func: nirRow.member1Function },
        { name: nirRow.member2Name, func: nirRow.member2Function },
        { name: nirRow.member3Name, func: nirRow.member3Function },
      ].filter(m => m.name);

      if (members.length > 0) {
        const mW = W / 3;
        members.forEach((m, i) => {
          const mx = 40 + i * mW;
          doc.rect(mx, y, mW - 8, 55).strokeColor(BORDER).lineWidth(0.5).stroke();
          doc.fontSize(7).font("Roboto-Bold").fillColor(GRAY).text(m.func || "Membru", mx + 6, y + 5);
          doc.fontSize(8).font("Roboto").fillColor("#1e293b").text(m.name || "", mx + 6, y + 16);
          // Signature line
          doc.moveTo(mx + 6, y + 46).lineTo(mx + mW - 20, y + 46).strokeColor("#94a3b8").lineWidth(0.5).stroke();
          doc.fontSize(6).font("Roboto").fillColor(GRAY).text("Semnătura", mx + 6, y + 48);
        });
        y += 65;
      } else {
        // Empty signature boxes
        const mW = W / 3;
        ["Gestionar", "Contabil", "Șef depozit"].forEach((label, i) => {
          const mx = 40 + i * mW;
          doc.rect(mx, y, mW - 8, 55).strokeColor(BORDER).lineWidth(0.5).stroke();
          doc.fontSize(7).font("Roboto-Bold").fillColor(GRAY).text(label, mx + 6, y + 5);
          doc.moveTo(mx + 6, y + 46).lineTo(mx + mW - 20, y + 46).strokeColor("#94a3b8").lineWidth(0.5).stroke();
          doc.fontSize(6).font("Roboto").fillColor(GRAY).text("Semnătura", mx + 6, y + 48);
        });
        y += 65;
      }

      // Observatii
      if (nirRow.notes) {
        y += 5;
        doc.fontSize(7).font("Roboto-Bold").fillColor(GRAY).text("OBSERVAȚII:", 40, y);
        doc.fontSize(7).font("Roboto").fillColor("#1e293b").text(nirRow.notes, 110, y, { width: W - 70 });
        y += 14;
      }

      // Footer
      const footerY = doc.page.height - 35;
      doc.moveTo(40, footerY - 5).lineTo(doc.page.width - 40, footerY - 5).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fontSize(6.5).font("Roboto").fillColor(GRAY)
        .text(`NIR ${nirRow.nirNumber} • Generat: ${new Date().toLocaleDateString("ro-RO")} • ${tenant?.name || ""}`, 40, footerY, { align: "center", width: W });

      doc.end();

    } catch (e: any) {
      console.error("[PDF NIR Route] Error:", e.message);
      if (!res.headersSent) res.status(500).json({ error: e.message });
    }
  });

  app.use("/api/pdf", router);
}
