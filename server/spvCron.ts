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
  if (!db) return { imported: 0, limitHit: 0, limitDetails: [] };

  const spvIntegrations = await db
    .select()
    .from(integrations)
    .where(
      and(eq(integrations.provider, "spv"), eq(integrations.status, "active"))
    );

  let totalImported = 0;
  let totalLimitHit = 0;
  const totalLimitDetails: string[] = [];

  for (const intg of spvIntegrations) {
    if (!intg.apiKey) continue;

    const cif = process.env.SPV_CUI || "42322117";
    console.log(
      `[SPV Cron] Syncing for tenant ${intg.tenantId}, CIF ${cif}, zile=${zile}`
    );

    try {
      const messages: any[] = [];
      const CHUNK_DAYS = 60;
      let daysRemaining = zile;
      let currentEndTime = Date.now();

      while (daysRemaining > 0) {
        const daysToFetch = Math.min(daysRemaining, CHUNK_DAYS);
        const currentStartTime =
          currentEndTime - daysToFetch * 24 * 60 * 60 * 1000;

        let pagina = 1;
        let totalPagini = 1;

        while (pagina <= totalPagini) {
          const listUrl = `https://api.anaf.ro/prod/FCTEL/rest/listaMesajePaginatieFactura?startTime=${currentStartTime}&endTime=${currentEndTime}&cif=${cif}&pagina=${pagina}`;
          console.log(
            `[SPV Cron] Fetching: ${listUrl} (days chunk: ${daysToFetch}, page: ${pagina})`
          );

          const response = await fetch(listUrl, {
            headers: { Authorization: `Bearer ${intg.apiKey}` },
          });

          if (!response.ok) {
            const errText = await response.text();
            console.error(
              `[SPV Cron] Failed to fetch messages for chunk: ${response.status} ${errText}`
            );
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

      console.log(
        `[SPV Cron] Found total ${messages.length} messages across all chunks`
      );

      let imported = 0;
      let skipped = 0;
      let limitHit = 0;
      const limitDetails: string[] = [];

      for (const msg of messages) {
        // Log every message so we can see exactly what ANAF sends
        console.log(`[SPV Cron] MSG tip=${msg.tip} cif=${msg.cif} id=${msg.id} id_descarcare=${msg.id_descarcare} id_solicitare=${msg.id_solicitare} detalii=${msg.detalii || ""}`);

        // Only process FACTURA PRIMITA and FACTURA TRIMISA — skip ERORI FACTURA (ANAF error notifications)
        if (
          !msg.tip ||
          msg.tip === "ERORI FACTURA" ||
          (msg.tip !== "FACTURA PRIMITA" &&
            msg.tip !== "FACTURA TRIMISA" &&
            !msg.tip.startsWith("FACTURA"))
        ) {
          console.log(`[SPV Cron] SKIP (tip mismatch): ${msg.tip}`);
          continue;
        }

        const downloadId = msg.id_descarcare || msg.id;
        if (!downloadId) { console.log(`[SPV Cron] SKIP (no downloadId)`); continue; }

        // 1. Check if this message corresponds to a ReInvoice we sent to SPV
        if (msg.id_solicitare) {
          const { reInvoices } = await import("../drizzle/schema");
          const [matchReInvoice] = await db
            .select({ id: reInvoices.id })
            .from(reInvoices)
            .where(eq(reInvoices.spvIndex, String(msg.id_solicitare)));

          if (matchReInvoice) {
            await db
              .update(reInvoices)
              .set({ spvStatus: "validat" })
              .where(eq(reInvoices.id, matchReInvoice.id));
            console.log(
              `[SPV Cron] Re-Invoice ${matchReInvoice.id} validated in SPV!`
            );
            skipped++;
            continue;
          }

          const { emittedInvoices } = await import("../drizzle/schema");
          const [matchEmitted] = await db
            .select({ id: emittedInvoices.id })
            .from(emittedInvoices)
            .where(eq(emittedInvoices.spvIndex, String(msg.id_solicitare)));

          if (matchEmitted) {
            await db
              .update(emittedInvoices)
              .set({ spvStatus: "validat" })
              .where(eq(emittedInvoices.id, matchEmitted.id));
            console.log(
              `[SPV Cron] Emitted Invoice ${matchEmitted.id} validated in SPV!`
            );
            skipped++;
            continue;
          }
        }

        // Check if already imported (by SPV download ID)
        const [existing] = await db
          .select({ id: invoiceArchive.id })
          .from(invoiceArchive)
          .where(
            and(
              eq(invoiceArchive.tenantId, intg.tenantId),
              eq(invoiceArchive.fileName, `SPV_${downloadId}.zip`)
            )
          );

        if (existing) {
          skipped++;
          continue;
        }

        // 2. Download the ZIP
        const downloadUrl = `${ANAF_DOWNLOAD_URL}?id=${downloadId}`;
        console.log(`[SPV Cron] Downloading: ${downloadUrl}`);

        const zipResponse = await fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${intg.apiKey}`,
          },
        });

        if (!zipResponse.ok) {
          console.warn(
            `[SPV Cron] Failed to download ${downloadId}: ${zipResponse.status}`
          );
          continue;
        }

        const contentType = zipResponse.headers.get("content-type") || "";

        let xmlString: string | null = null;

        try {
          const buffer = await zipResponse.arrayBuffer();
          const buf = Buffer.from(buffer);
          console.log(`[SPV Cron] Downloaded ${buf.length} bytes for ${downloadId}, first bytes: ${buf.slice(0,120).toString("utf8").replace(/[\r\n]/g, " ")}`);

          // Detect JSON error response regardless of content-type (ANAF sends JSON with wrong content-type sometimes)
          const firstChar = buf.slice(0, 1).toString("utf8").trim();
          if (firstChar === "{" || contentType.includes("application/json")) {
            try {
              const errData = JSON.parse(buf.toString("utf8"));
              if (errData.eroare) {
                console.warn(`[SPV Cron] ANAF Error for ${downloadId}: ${errData.eroare}`);
                // If it's a download limit error, track it
                if (errData.eroare.includes("descarcari")) {
                  limitHit++;
                  limitDetails.push(`id=${downloadId}`);
                  console.warn(`[SPV Cron] Download limit hit for ${downloadId} — will retry tomorrow`);
                }
                continue;
              }
            } catch {
              // Not JSON, continue to ZIP/XML parsing
            }
          }

          const firstBytes = buf.slice(0, 4).toString("hex");
          // ZIP magic bytes: 504b0304
          if (firstBytes === "504b0304") {
            // It's a real ZIP
            const zip = new AdmZip(buf);
            const zipEntries = zip.getEntries();
            const xmlEntry = zipEntries.find(
              e =>
                e.entryName.toLowerCase().endsWith(".xml") &&
                !e.entryName.toLowerCase().includes("semnatura")
            );
            if (!xmlEntry) {
              console.warn(`[SPV Cron] No XML found in ZIP for ${downloadId}`);
              continue;
            }
            xmlString = xmlEntry.getData().toString("utf8");
          } else {
            // Not a ZIP — try treating as raw XML
            const rawText = buf.toString("utf8");
            if (rawText.includes("<Invoice") || rawText.includes("<CreditNote") || rawText.includes(":Invoice") || rawText.includes(":CreditNote")) {
              console.log(`[SPV Cron] Content for ${downloadId} is raw XML, not ZIP — using directly`);
              xmlString = rawText;
            } else {
              console.warn(`[SPV Cron] Unknown content format for ${downloadId}: ${rawText.slice(0, 200)}`);
              continue;
            }
          }
        } catch (err: any) {
          console.warn(
            `[SPV Cron] Failed to process download for ${downloadId}:`,
            err.message
          );
          continue;
        }

        if (!xmlString) continue;

        // Parse XML
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "@_",
          removeNSPrefix: true,
        });
        const parsed = parser.parse(xmlString);
        const rootKey = Object.keys(parsed).find(
          k => k.includes("Invoice") || k.includes("CreditNote")
        );
        const invoiceObj = rootKey ? parsed[rootKey] : null;
        if (!invoiceObj) {
          console.warn(
            `[SPV Cron] No Invoice/CreditNote in XML for ${downloadId}`
          );
          continue;
        }

        // Extract invoice details
        const invoiceNumber = invoiceObj["ID"] || `SPV-${downloadId}`;
        const issueDate = invoiceObj["IssueDate"] || "";
        const dueDate = invoiceObj["DueDate"] || issueDate;

        let supplierName = "";
        let supplierCUI = "";

        // Determine direction first so we can map parties correctly
        const direction = msg.tip?.includes("PRIMITA") ? "in" : "out";

        // For incoming invoices (Primite), the supplier is the sender.
        // For outgoing invoices (Emise), the supplier is US, but the UI/DB expects the CLIENT's details in supplierName/CUI
        const targetParty =
          direction === "in"
            ? invoiceObj["AccountingSupplierParty"]
            : invoiceObj["AccountingCustomerParty"];

        if (targetParty?.["Party"]) {
          const party = targetParty["Party"];
          supplierName =
            party["PartyName"]?.["Name"] ||
            party["PartyLegalEntity"]?.["RegistrationName"] ||
            "Client necunoscut";
          supplierCUI =
            party["PartyTaxScheme"]?.["CompanyID"] ||
            party["PartyLegalEntity"]?.["CompanyID"] ||
            "";
        }

        const legalTotal = invoiceObj["LegalMonetaryTotal"];
        const rawTotal =
          legalTotal?.["TaxInclusiveAmount"]?.["#text"] ||
          legalTotal?.["TaxInclusiveAmount"] ||
          legalTotal?.["PayableAmount"]?.["#text"] ||
          legalTotal?.["PayableAmount"] ||
          "0";
        const parsedTotal = parseFloat(typeof rawTotal === "object" ? "0" : rawTotal);
        const total = isNaN(parsedTotal) ? 0 : parsedTotal;

        const taxTotal = invoiceObj["TaxTotal"];
        const taxTotalObj = Array.isArray(taxTotal) ? taxTotal[0] : taxTotal;
        const rawVAT =
          taxTotalObj?.["TaxAmount"]?.["#text"] ||
          taxTotalObj?.["TaxAmount"] ||
          "0";
        const parsedVAT = parseFloat(typeof rawVAT === "object" ? "0" : rawVAT);
        const totalVAT = isNaN(parsedVAT) ? 0 : parsedVAT;

        const currency =
          invoiceObj["DocumentCurrencyCode"]?.["#text"] ||
          invoiceObj["DocumentCurrencyCode"] ||
          "RON";

        // Check for duplicate by invoice number + supplier (normalize CUI - strip RO prefix)
        const normalizedCUI = String(supplierCUI).replace(/^RO/i, "");
        const cleanInvoiceNumber = String(invoiceNumber).replace(
          /[^a-zA-Z0-9]/g,
          ""
        );

        const { sql } = await import("drizzle-orm");

        const [dup] = await db
          .select({ id: invoiceArchive.id, rawXml: invoiceArchive.rawXml })
          .from(invoiceArchive)
          .where(
            and(
              eq(invoiceArchive.tenantId, intg.tenantId),
              sql`REPLACE(REPLACE(${invoiceArchive.invoiceNumber}, '-', ''), ' ', '') = ${cleanInvoiceNumber}`,
              sql`REPLACE(UPPER(${invoiceArchive.supplierCUI}), 'RO', '') = ${normalizedCUI}`
            )
          );

        if (dup) {
          // If duplicate exists but has no XML stored, update it (+ fix fileName for future lookups)
          if (!dup.rawXml) {
            await db
              .update(invoiceArchive)
              .set({ rawXml: xmlString, fileName: `SPV_${downloadId}.zip` })
              .where(eq(invoiceArchive.id, dup.id));
            console.log(
              `[SPV Cron] Updated XML + fileName for existing invoice ${invoiceNumber}`
            );
          }

          // Backfill lines if missing
          try {
            const { invoiceArchiveLines } = await import("../drizzle/schema");
            const existingLines = await db
              .select({ id: invoiceArchiveLines.id })
              .from(invoiceArchiveLines)
              .where(eq(invoiceArchiveLines.invoiceArchiveId, dup.id));

            if (existingLines.length === 0) {
              let xmlLines =
                invoiceObj["InvoiceLine"] ||
                invoiceObj["CreditNoteLine"] ||
                [];
              if (!Array.isArray(xmlLines)) xmlLines = [xmlLines];
              if (xmlLines.length > 0) {
                const linesToInsert = xmlLines.map((line: any) => {
                  const item = line["Item"];
                  const price = line["Price"];
                  const description =
                    item?.["Name"] ||
                    item?.["Description"] ||
                    "Articol";
                  const qty = parseFloat(
                    line["InvoicedQuantity"]?.["#text"] ||
                      line["InvoicedQuantity"] ||
                      line["CreditedQuantity"]?.["#text"] ||
                      line["CreditedQuantity"] ||
                      "1"
                  );
                  const unitPrice = parseFloat(
                    price?.["PriceAmount"]?.["#text"] ||
                      price?.["PriceAmount"] ||
                      "0"
                  );
                  const unit =
                    line["InvoicedQuantity"]?.["@_unitCode"] ||
                    line["CreditedQuantity"]?.["@_unitCode"] ||
                    "buc";
                  const lineTotal = parseFloat(
                    line["LineExtensionAmount"]?.["#text"] ||
                      line["LineExtensionAmount"] ||
                      String(qty * unitPrice)
                  );
                  let vatRate = 19;
                  const taxCategory = item?.["ClassifiedTaxCategory"];
                  if (taxCategory?.["Percent"]) {
                    vatRate = parseFloat(
                      taxCategory["Percent"]?.["#text"] ||
                        taxCategory["Percent"] ||
                        "19"
                    );
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
                console.log(
                  `[SPV Cron] Backfilled ${linesToInsert.length} lines for existing invoice ${invoiceNumber}`
                );
              }
            }
          } catch (lineErr: any) {
            console.warn(
              `[SPV Cron] Failed to backfill lines for ${invoiceNumber}: ${lineErr.message}`
            );
          }

          skipped++;
          continue;
        }

        // Generate PDF
        let fileUrl = "spv_import";
        try {
          const pdfRes = await convertXmlToPdf(
            xmlString,
            `Factura_${invoiceNumber}_${Date.now()}`
          );
          if (pdfRes) fileUrl = pdfRes.url;
        } catch (pdfErr: any) {
          console.warn(
            `[SPV Cron] PDF conversion failed for ${invoiceNumber}: ${pdfErr.message}`
          );
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

        // --- ADD CLIENT IF NOT EXISTS ---
        if (
          supplierCUI &&
          supplierName &&
          supplierName !== "Client necunoscut"
        ) {
          try {
            const { clients } = await import("../drizzle/schema");
            const cleanCUI = String(supplierCUI).replace(/^RO/i, "").trim();

            const [existingClient] = await db
              .select({ id: clients.id })
              .from(clients)
              .where(
                and(
                  eq(clients.tenantId, intg.tenantId),
                  sql`REPLACE(UPPER(${clients.cui}), 'RO', '') = ${cleanCUI}`
                )
              );

            if (!existingClient) {
              const party = targetParty?.["cac:Party"];
              const address =
                party?.["cac:PostalAddress"]?.["cbc:StreetName"] || "";
              const city = party?.["cac:PostalAddress"]?.["cbc:CityName"] || "";
              const county =
                party?.["cac:PostalAddress"]?.["cbc:CountrySubentity"] || "";
              const email =
                party?.["cac:Contact"]?.["cbc:ElectronicMail"] || "";
              const phone = party?.["cac:Contact"]?.["cbc:Telephone"] || "";
              const tva = String(supplierCUI).toUpperCase().startsWith("RO");

              await db.insert(clients).values({
                tenantId: intg.tenantId,
                name: String(supplierName),
                cui: String(supplierCUI),
                regCom: "",
                address: String(address),
                city: String(city),
                country: "RO",
                email: String(email),
                phone: String(phone),
                tva: tva ? 1 : 0,
              });
              console.log(
                `[SPV Cron] Added new client: ${supplierName} (${supplierCUI})`
              );
            }
          } catch (err: any) {
            console.warn(
              `[SPV Cron] Failed to add client ${supplierName}:`,
              err.message
            );
          }
        }
        // --- END ADD CLIENT ---

        // Extract and save invoice lines from XML
        try {
          const { invoiceArchiveLines } = await import("../drizzle/schema");
          let xmlLines =
            invoiceObj["cac:InvoiceLine"] ||
            invoiceObj["cac:CreditNoteLine"] ||
            [];
          if (!Array.isArray(xmlLines)) xmlLines = [xmlLines];

          const archiveId =
            (archiveResult as any)?.insertId || (archiveResult as any)?.id;
          if (archiveId && xmlLines.length > 0) {
            const linesToInsert = xmlLines.map((line: any) => {
              const item = line["cac:Item"];
              const price = line["cac:Price"];
              const description =
                item?.["cbc:Name"] || item?.["cbc:Description"] || "Articol";
              const qty = parseFloat(
                line["cbc:InvoicedQuantity"]?.["#text"] ||
                  line["cbc:InvoicedQuantity"] ||
                  line["cbc:CreditedQuantity"]?.["#text"] ||
                  line["cbc:CreditedQuantity"] ||
                  "1"
              );
              const unitPrice = parseFloat(
                price?.["cbc:PriceAmount"]?.["#text"] ||
                  price?.["cbc:PriceAmount"] ||
                  "0"
              );
              const unit =
                line["cbc:InvoicedQuantity"]?.["@_unitCode"] ||
                line["cbc:CreditedQuantity"]?.["@_unitCode"] ||
                "buc";
              const lineTotal = parseFloat(
                line["cbc:LineExtensionAmount"]?.["#text"] ||
                  line["cbc:LineExtensionAmount"] ||
                  String(qty * unitPrice)
              );

              // Extract VAT rate
              let vatRate = 19;
              const taxCategory = item?.["cac:ClassifiedTaxCategory"];
              if (taxCategory?.["cbc:Percent"]) {
                vatRate = parseFloat(
                  taxCategory["cbc:Percent"]?.["#text"] ||
                    taxCategory["cbc:Percent"] ||
                    "19"
                );
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
            console.log(
              `[SPV Cron] Saved ${linesToInsert.length} lines for invoice ${invoiceNumber}`
            );
          }
        } catch (lineErr: any) {
          console.warn(
            `[SPV Cron] Failed to extract lines for ${invoiceNumber}: ${lineErr.message}`
          );
        }

        imported++;
        console.log(
          `[SPV Cron] ✓ Imported ${direction === "in" ? "received" : "sent"} invoice ${invoiceNumber} from ${supplierName}`
        );
      }

      // Update sync time
      await db
        .update(integrations)
        .set({
          lastSyncAt: new Date(),
          syncCount: (intg.syncCount || 0) + imported,
        })
        .where(eq(integrations.id, intg.id));

      console.log(
        `[SPV Cron] Done for tenant ${intg.tenantId}: imported=${imported}, skipped=${skipped}, limitHit=${limitHit}`
      );
      totalImported += imported;
      totalLimitHit += limitHit;
      totalLimitDetails.push(...limitDetails);
    } catch (e: any) {
      console.error(
        `[SPV Cron] Error syncing for tenant ${intg.tenantId}:`,
        e.message
      );
    }
  }
  return { imported: totalImported, limitHit: totalLimitHit, limitDetails: totalLimitDetails };
}
