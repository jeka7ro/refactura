import cron from "node-cron";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { getDb, createInvoiceArchiveEntry } from "./db";
import { integrations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const ANAF_SPV_MESSAGES_URL = "https://logincert.anaf.ro/api/v1/ws/listaMesajeFactura";
const ANAF_SPV_DOWNLOAD_URL = "https://logincert.anaf.ro/api/v1/ws/descarcare";

export function startSpvCron() {
  // Run every 4 hours
  cron.schedule("0 */4 * * *", async () => {
    console.log("[SPV Cron] Starting SPV synchronization job...");
    await syncAllSpv();
  });
  
  // Optionally, trigger an initial sync immediately or manually via a button later.
}

export async function syncAllSpv() {
  const db = await getDb();
  if (!db) return;

  const spvIntegrations = await db.select().from(integrations)
    .where(and(eq(integrations.provider, "spv"), eq(integrations.status, "active")));

  for (const intg of spvIntegrations) {
    if (!intg.apiKey) continue;
    
    // In a real app, check if tokenExpiresAt is past and refresh the token here using intg.apiSecret (refreshToken)
    
    console.log(`[SPV Cron] Syncing for tenant ${intg.tenantId}`);
    try {
      // 1. Fetch invoice messages from ANAF (we look back X days)
      const lookbackDays = 7;
      const response = await fetch(`${ANAF_SPV_MESSAGES_URL}?zile=${lookbackDays}`, {
        headers: {
          "Authorization": `Bearer ${intg.apiKey}`,
        }
      });
      
      if (!response.ok) {
        console.error(`[SPV Cron] Failed to fetch messages for tenant ${intg.tenantId}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const messages = data.mesaje || [];

      for (const msg of messages) {
        // Skip if not invoice (factura)
        if (msg.tip !== "FACTURA") continue;
        
        // In a real application, check if msg.id is already downloaded to avoid duplicates!
        // We'll proceed with download for demonstration
        
        const zipResponse = await fetch(`${ANAF_SPV_DOWNLOAD_URL}?id=${msg.id}`, {
          headers: {
            "Authorization": `Bearer ${intg.apiKey}`,
          }
        });

        if (!zipResponse.ok) continue;

        const buffer = await zipResponse.arrayBuffer();
        const zip = new AdmZip(Buffer.from(buffer));
        const zipEntries = zip.getEntries();
        
        // Find the XML file inside the ZIP (usually contains the word "factura" or is .xml)
        const xmlEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith(".xml") && !e.entryName.toLowerCase().includes("semnatura"));
        
        if (xmlEntry) {
          const xmlString = xmlEntry.getData().toString("utf8");
          
          // Parse XML using fast-xml-parser
          const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
          const parsed = parser.parse(xmlString);
          
          // Basic extraction from UBL XML (Invoice)
          const invoiceObj = parsed.Invoice || parsed.CreditNote; // simplified
          if (!invoiceObj) continue;

          // Extract basic details
          const invoiceNumber = invoiceObj["cbc:ID"] || msg.id;
          const issueDate = invoiceObj["cbc:IssueDate"] || "";
          let supplierName = "";
          let supplierCUI = "";
          
          const supplierParty = invoiceObj["cac:AccountingSupplierParty"];
          if (supplierParty && supplierParty["cac:Party"]) {
             const party = supplierParty["cac:Party"];
             supplierName = party["cac:PartyName"]?.["cbc:Name"] || party["cac:PartyLegalEntity"]?.["cbc:RegistrationName"] || "Unknown Supplier";
             supplierCUI = party["cac:PartyTaxScheme"]?.["cbc:CompanyID"] || "";
          }

          const legalTotal = invoiceObj["cac:LegalMonetaryTotal"];
          const total = parseFloat(legalTotal?.["cbc:TaxInclusiveAmount"]?.["#text"] || legalTotal?.["cbc:TaxInclusiveAmount"] || "0");
          
          const taxTotal = invoiceObj["cac:TaxTotal"];
          const totalVAT = parseFloat(taxTotal?.["cbc:TaxAmount"]?.["#text"] || taxTotal?.["cbc:TaxAmount"] || "0");
          
          const currency = invoiceObj["cbc:DocumentCurrencyCode"]?.["#text"] || invoiceObj["cbc:DocumentCurrencyCode"] || "RON";

          // Save to invoiceArchive
          await createInvoiceArchiveEntry({
            tenantId: intg.tenantId,
            source: "spv_anaf",
            fileName: `SPV_${msg.id}.xml`,
            fileType: "xml",
            invoiceNumber: String(invoiceNumber),
            supplierName,
            supplierCUI,
            issueDate,
            total: String(total),
            totalVAT: String(totalVAT),
            currency,
            status: "pending",
          });
          console.log(`[SPV Cron] Saved invoice ${invoiceNumber} for tenant ${intg.tenantId}`);
        }
      }
      
      // Update sync time
      await db.update(integrations)
        .set({ lastSyncAt: new Date(), syncCount: (intg.syncCount || 0) + messages.length })
        .where(eq(integrations.id, intg.id));
        
    } catch (e: any) {
      console.error(`[SPV Cron] Error syncing for tenant ${intg.tenantId}:`, e.message);
    }
  }
}
