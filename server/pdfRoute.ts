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

      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Route] Error:", e.message);
      res.status(500).json({ error: e.message });
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
      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Archive Route] Error:", e.message);
      res.status(500).json({ error: e.message });
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

      pdfStream.pipe(res);
    } catch (e: any) {
      console.error("[PDF Emitted Route] Error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.use("/api/pdf", router);
}
