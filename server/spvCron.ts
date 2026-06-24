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
      // 1. Fetch invoice messages from ANAF e-Factura (last 60 days)
      const listUrl = `${ANAF_LIST_URL}?zile=${zile}&cif=${cif}`;
      console.log(`[SPV Cron] Fetching: ${listUrl}`);

      const response = await fetch(listUrl, {
        headers: {
          "Authorization": `Bearer ${intg.apiKey}`,
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[SPV Cron] Failed to fetch messages: ${response.status} ${errText}`);
        continue;
      }

      const data = await response.json();
      const messages = data.mesaje || [];
      console.log(`[SPV Cron] Found ${messages.length} messages`);

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

        const buffer = await zipResponse.arrayBuffer();
        const zip = new AdmZip(Buffer.from(buffer));
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
        const supplierParty = invoiceObj["cac:AccountingSupplierParty"];
        if (supplierParty?.["cac:Party"]) {
          const party = supplierParty["cac:Party"];
          supplierName = party["cac:PartyName"]?.["cbc:Name"]
            || party["cac:PartyLegalEntity"]?.["cbc:RegistrationName"]
            || "Furnizor necunoscut";
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

        // Determine direction
        const direction = msg.tip?.includes("PRIMITA") ? "in" : "out";

        // Check for duplicate by invoice number + supplier
        const [dup] = await db.select({ id: invoiceArchive.id, rawXml: invoiceArchive.rawXml })
          .from(invoiceArchive)
          .where(and(
            eq(invoiceArchive.tenantId, intg.tenantId),
            eq(invoiceArchive.invoiceNumber, String(invoiceNumber)),
            eq(invoiceArchive.supplierCUI, supplierCUI)
          ));

        if (dup) {
          // If duplicate exists but has no XML stored, update it
          if (!dup.rawXml) {
            await db.update(invoiceArchive)
              .set({ rawXml: xmlString })
              .where(eq(invoiceArchive.id, dup.id));
            console.log(`[SPV Cron] Updated XML for existing invoice ${invoiceNumber}`);
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
        await createInvoiceArchiveEntry({
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
