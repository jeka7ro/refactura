import cron from "node-cron";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { getDb, createInvoiceArchiveEntry } from "./db";
import { integrations, invoiceArchive } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { convertXmlToPdf } from "./anafPdf";

// ── Correct ANAF e-Factura API URLs ─────────────────────────────────────────
const ANAF_LIST_URL = "https://api.anaf.ro/prod/FCTEL/rest/listaMesajeFactura";
const ANAF_DOWNLOAD_URL = "https://api.anaf.ro/prod/FCTEL/rest/descarcare";

export function startSpvCron() {
  // Run every 4 hours
  cron.schedule("0 */4 * * *", async () => {
    console.log("[SPV Cron] Starting SPV synchronization job...");
    await syncAllSpv();
  });
}

export async function syncAllSpv(zile: number = 60) {
  const db = await getDb();
  if (!db) return;

  const spvIntegrations = await db.select().from(integrations)
    .where(and(eq(integrations.provider, "spv"), eq(integrations.status, "active")));

  for (const intg of spvIntegrations) {
    if (!intg.apiKey) continue;

    const cif = process.env.SPV_CUI || "42322117";
    console.log(`[SPV Cron] Syncing for tenant ${intg.tenantId}, CIF ${cif}, zile=${zile}`);

    try {
      const messages: any[] = [];
      const CHUNK_DAYS = 60;
      let daysRemaining = zile;
      let currentEndTime = Date.now();

      while (daysRemaining > 0) {
        const daysToFetch = Math.min(daysRemaining, CHUNK_DAYS);
        const currentStartTime = currentEndTime - (daysToFetch * 24 * 60 * 60 * 1000);
        
        let pagina = 1;
        let totalPagini = 1;

        while (pagina <= totalPagini) {
          const listUrl = `https://api.anaf.ro/prod/FCTEL/rest/listaMesajePaginatieFactura?startTime=${currentStartTime}&endTime=${currentEndTime}&cif=${cif}&pagina=${pagina}`;
          console.log(`[SPV Cron] Fetching: ${listUrl} (days chunk: ${daysToFetch}, page: ${pagina})`);

          const response = await fetch(listUrl, {
            headers: { "Authorization": `Bearer ${intg.apiKey}` }
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(`[SPV Cron] Failed to fetch messages for chunk: ${response.status} ${errText}`);
            break; // Stop fetching further pages for this chunk if one fails
          }

          const data = await response.json();
          if (data.mesaje && Array.isArray(data.mesaje)) {
            messages.push(...data.mesaje);
          }
          
          totalPagini = data.numar_total_pagini || 1;
          pagina++;
        }

        daysRemaining -= daysToFetch;
        currentEndTime = currentStartTime;
      }

      console.log(`[SPV Cron] Found total ${messages.length} messages across all chunks`);

      let imported = 0;
      let skipped = 0;

      for (const msg of messages) {
        // Only process FACTURA PRIMITA and FACTURA TRIMISA
        if (!msg.tip || (!msg.tip.includes("FACTURA") && msg.tip !== "FACTURA PRIMITA" && msg.tip !== "FACTURA TRIMISA")) {
          continue;
        }

        const downloadId = msg.id_descarcare || msg.id;
        if (!downloadId) continue;

        // Check if already imported (by SPV download ID)
        const [existing] = await db.select({ id: invoiceArchive.id })
          .from(invoiceArchive)
          .where(and(
            eq(invoiceArchive.tenantId, intg.tenantId),
            eq(invoiceArchive.fileName, `SPV_${downloadId}.zip`)
          ));

        if (existing) {
          skipped++;
          continue;
        }

        // 2. Download the ZIP
        const downloadUrl = `${ANAF_DOWNLOAD_URL}?id=${downloadId}`;
        console.log(`[SPV Cron] Downloading: ${downloadUrl}`);

        const zipResponse = await fetch(downloadUrl, {
          headers: {
            "Authorization": `Bearer ${intg.apiKey}`,
          }
        });

        if (!zipResponse.ok) {
          console.warn(`[SPV Cron] Failed to download ${downloadId}: ${zipResponse.status}`);
          continue;
        }

        const contentType = zipResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errData = await zipResponse.json();
          console.warn(`[SPV Cron] ANAF Error for ${downloadId}:`, errData.eroare);
          continue;
        }

        let zip;
        try {
          const buffer = await zipResponse.arrayBuffer();
          zip = new AdmZip(Buffer.from(buffer));
        } catch (err: any) {
          console.warn(`[SPV Cron] Failed to parse ZIP for ${downloadId}:`, err.message);
          continue;
        }
        const zipEntries = zip.getEntries();

        // Find the XML file (not signature)
        const xmlEntry = zipEntries.find(e =>
          e.entryName.toLowerCase().endsWith(".xml") &&
          !e.entryName.toLowerCase().includes("semnatura")
        );

        if (!xmlEntry) {
          console.warn(`[SPV Cron] No XML found in ZIP for ${downloadId}`);
          continue;
        }

        const xmlString = xmlEntry.getData().toString("utf8");

        // Parse XML
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
        const parsed = parser.parse(xmlString);
        const invoiceObj = parsed.Invoice || parsed.CreditNote;
        if (!invoiceObj) {
          console.warn(`[SPV Cron] No Invoice/CreditNote in XML for ${downloadId}`);
          continue;
        }

        // Extract invoice details
        const invoiceNumber = invoiceObj["cbc:ID"] || `SPV-${downloadId}`;
        const issueDate = invoiceObj["cbc:IssueDate"] || "";
        const dueDate = invoiceObj["cbc:DueDate"] || issueDate;

        let supplierName = "";
        let supplierCUI = "";
        
        // Determine direction first so we can map parties correctly
        const direction = msg.tip?.includes("PRIMITA") ? "in" : "out";

        // For incoming invoices (Primite), the supplier is the sender.
        // For outgoing invoices (Emise), the supplier is US, but the UI/DB expects the CLIENT's details in supplierName/CUI
        const targetParty = direction === "in" 
          ? invoiceObj["cac:AccountingSupplierParty"] 
          : invoiceObj["cac:AccountingCustomerParty"];

        if (targetParty?.["cac:Party"]) {
          const party = targetParty["cac:Party"];
          supplierName = party["cac:PartyName"]?.["cbc:Name"]
            || party["cac:PartyLegalEntity"]?.["cbc:RegistrationName"]
            || "Client necunoscut";
          supplierCUI = party["cac:PartyTaxScheme"]?.["cbc:CompanyID"]
            || party["cac:PartyLegalEntity"]?.["cbc:CompanyID"]
            || "";
        }

        const legalTotal = invoiceObj["cac:LegalMonetaryTotal"];
        const total = parseFloat(
          legalTotal?.["cbc:TaxInclusiveAmount"]?.["#text"]
          || legalTotal?.["cbc:TaxInclusiveAmount"]
          || legalTotal?.["cbc:PayableAmount"]?.["#text"]
          || legalTotal?.["cbc:PayableAmount"]
          || "0"
        );

        const taxTotal = invoiceObj["cac:TaxTotal"];
        const totalVAT = parseFloat(
          taxTotal?.["cbc:TaxAmount"]?.["#text"]
          || taxTotal?.["cbc:TaxAmount"]
          || "0"
        );

        const currency = invoiceObj["cbc:DocumentCurrencyCode"]?.["#text"]
          || invoiceObj["cbc:DocumentCurrencyCode"]
          || "RON";

        // Check for duplicate by invoice number + supplier (normalize CUI - strip RO prefix)
        const normalizedCUI = String(supplierCUI).replace(/^RO/i, '');
        const cleanInvoiceNumber = String(invoiceNumber).replace(/[^a-zA-Z0-9]/g, '');
        
        const { sql } = await import("drizzle-orm");
        
        const [dup] = await db.select({ id: invoiceArchive.id, rawXml: invoiceArchive.rawXml })
          .from(invoiceArchive)
          .where(and(
            eq(invoiceArchive.tenantId, intg.tenantId),
            sql`REPLACE(REPLACE(${invoiceArchive.invoiceNumber}, '-', ''), ' ', '') = ${cleanInvoiceNumber}`,
            sql`REPLACE(UPPER(${invoiceArchive.supplierCUI}), 'RO', '') = ${normalizedCUI}`
          ));

        if (dup) {
          // If duplicate exists but has no XML stored, update it (+ fix fileName for future lookups)
          if (!dup.rawXml) {
            await db.update(invoiceArchive)
              .set({ rawXml: xmlString, fileName: `SPV_${downloadId}.zip` })
              .where(eq(invoiceArchive.id, dup.id));
            console.log(`[SPV Cron] Updated XML + fileName for existing invoice ${invoiceNumber}`);
          }

          // Backfill lines if missing
          try {
            const { invoiceArchiveLines } = await import("../drizzle/schema");
            const existingLines = await db.select({ id: invoiceArchiveLines.id })
              .from(invoiceArchiveLines)
              .where(eq(invoiceArchiveLines.invoiceArchiveId, dup.id));

            if (existingLines.length === 0) {
              let xmlLines = invoiceObj["cac:InvoiceLine"] || invoiceObj["cac:CreditNoteLine"] || [];
              if (!Array.isArray(xmlLines)) xmlLines = [xmlLines];
              if (xmlLines.length > 0) {
                const linesToInsert = xmlLines.map((line: any) => {
                  const item = line["cac:Item"];
                  const price = line["cac:Price"];
                  const description = item?.["cbc:Name"] || item?.["cbc:Description"] || "Articol";
                  const qty = parseFloat(line["cbc:InvoicedQuantity"]?.["#text"] || line["cbc:InvoicedQuantity"] || line["cbc:CreditedQuantity"]?.["#text"] || line["cbc:CreditedQuantity"] || "1");
                  const unitPrice = parseFloat(price?.["cbc:PriceAmount"]?.["#text"] || price?.["cbc:PriceAmount"] || "0");
                  const unit = line["cbc:InvoicedQuantity"]?.["@_unitCode"] || line["cbc:CreditedQuantity"]?.["@_unitCode"] || "buc";
                  const lineTotal = parseFloat(line["cbc:LineExtensionAmount"]?.["#text"] || line["cbc:LineExtensionAmount"] || String(qty * unitPrice));
                  let vatRate = 19;
                  const taxCategory = item?.["cac:ClassifiedTaxCategory"];
                  if (taxCategory?.["cbc:Percent"]) {
                    vatRate = parseFloat(taxCategory["cbc:Percent"]?.["#text"] || taxCategory["cbc:Percent"] || "19");
                  }
                  return {
                    invoiceArchiveId: dup.id,
                    description: String(description),
                    quantity: String(qty),
                    unitPrice: String(unitPrice),
                    unit: String(unit),
                    vatRate: String(vatRate),
                    total: String(lineTotal),
                    currency,
                  };
                });
                await db.insert(invoiceArchiveLines).values(linesToInsert);
                console.log(`[SPV Cron] Backfilled ${linesToInsert.length} lines for existing invoice ${invoiceNumber}`);
              }
            }
          } catch (lineErr: any) {
            console.warn(`[SPV Cron] Failed to backfill lines for ${invoiceNumber}: ${lineErr.message}`);
          }

          skipped++;
          continue;
        }

        // Generate PDF
        let fileUrl = "spv_import";
        try {
          const pdfRes = await convertXmlToPdf(xmlString, `Factura_${invoiceNumber}_${Date.now()}`);
          if (pdfRes) fileUrl = pdfRes.url;
        } catch (pdfErr: any) {
          console.warn(`[SPV Cron] PDF conversion failed for ${invoiceNumber}: ${pdfErr.message}`);
        }

        // Save to invoiceArchive (with raw XML for PDF conversion)
        const archiveResult = await createInvoiceArchiveEntry({
          tenantId: intg.tenantId,
          source: "spv_anaf",
          direction,
          fileName: `SPV_${downloadId}.zip`,
          fileType: "xml",
          fileUrl,
          invoiceNumber: String(invoiceNumber),
          supplierName,
          supplierCUI,
          issueDate,
          dueDate,
          total: String(total),
          totalVAT: String(totalVAT),
          currency,
          status: "pending",
          rawXml: xmlString,
        });

        // Extract and save invoice lines from XML
        try {
          const { invoiceArchiveLines } = await import("../drizzle/schema");
          let xmlLines = invoiceObj["cac:InvoiceLine"] || invoiceObj["cac:CreditNoteLine"] || [];
          if (!Array.isArray(xmlLines)) xmlLines = [xmlLines];

          const archiveId = (archiveResult as any)?.insertId || (archiveResult as any)?.id;
          if (archiveId && xmlLines.length > 0) {
            const linesToInsert = xmlLines.map((line: any) => {
              const item = line["cac:Item"];
              const price = line["cac:Price"];
              const description = item?.["cbc:Name"] || item?.["cbc:Description"] || "Articol";
              const qty = parseFloat(line["cbc:InvoicedQuantity"]?.["#text"] || line["cbc:InvoicedQuantity"] || line["cbc:CreditedQuantity"]?.["#text"] || line["cbc:CreditedQuantity"] || "1");
              const unitPrice = parseFloat(price?.["cbc:PriceAmount"]?.["#text"] || price?.["cbc:PriceAmount"] || "0");
              const unit = line["cbc:InvoicedQuantity"]?.["@_unitCode"] || line["cbc:CreditedQuantity"]?.["@_unitCode"] || "buc";
              const lineTotal = parseFloat(line["cbc:LineExtensionAmount"]?.["#text"] || line["cbc:LineExtensionAmount"] || String(qty * unitPrice));
              
              // Extract VAT rate
              let vatRate = 19;
              const taxCategory = item?.["cac:ClassifiedTaxCategory"];
              if (taxCategory?.["cbc:Percent"]) {
                vatRate = parseFloat(taxCategory["cbc:Percent"]?.["#text"] || taxCategory["cbc:Percent"] || "19");
              }

              return {
                invoiceArchiveId: archiveId,
                description: String(description),
                quantity: String(qty),
                unitPrice: String(unitPrice),
                unit: String(unit),
                vatRate: String(vatRate),
                total: String(lineTotal),
                currency,
              };
            });

            await db!.insert(invoiceArchiveLines).values(linesToInsert);
            console.log(`[SPV Cron] Saved ${linesToInsert.length} lines for invoice ${invoiceNumber}`);
          }
        } catch (lineErr: any) {
          console.warn(`[SPV Cron] Failed to extract lines for ${invoiceNumber}: ${lineErr.message}`);
        }

        imported++;
        console.log(`[SPV Cron] ✓ Imported ${direction === "in" ? "received" : "sent"} invoice ${invoiceNumber} from ${supplierName}`);
      }

      // Update sync time
      await db.update(integrations)
        .set({ lastSyncAt: new Date(), syncCount: (intg.syncCount || 0) + imported })
        .where(eq(integrations.id, intg.id));

      console.log(`[SPV Cron] Done for tenant ${intg.tenantId}: imported=${imported}, skipped=${skipped}`);

    } catch (e: any) {
      console.error(`[SPV Cron] Error syncing for tenant ${intg.tenantId}:`, e.message);
    }
  }
}
