import { getDb } from "./server/db.ts";
import { invoiceArchive, invoiceArchiveLines } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { XMLParser } from "fast-xml-parser";

async function backfill() {
  const db = await getDb();
  if (!db) return;

  const archives = await db.select().from(invoiceArchive).where(eq(invoiceArchive.source, "spv_anaf"));
  const lines = await db.select().from(invoiceArchiveLines);

  const archiveIdsWithLines = new Set(lines.map(l => l.invoiceArchiveId));
  const missing = archives.filter(a => !archiveIdsWithLines.has(a.id) && a.rawXml);

  console.log(`Archives with missing lines to fix: ${missing.length}`);

  const parser = new XMLParser({ ignoreAttributes: false });

  for (const doc of missing) {
    if (!doc.rawXml) continue;
    try {
      const jsonObj = parser.parse(doc.rawXml);
      const invoiceObj = jsonObj["Invoice"] || jsonObj["CreditNote"] || jsonObj;
      
      let xmlLines = invoiceObj["cac:InvoiceLine"] || invoiceObj["cac:CreditNoteLine"] || [];
      if (!Array.isArray(xmlLines)) xmlLines = [xmlLines];

      if (xmlLines.length > 0) {
        const linesToInsert = xmlLines.map((line: any) => {
          const item = line["cac:Item"];
          const price = line["cac:Price"];
          const description = item?.["cbc:Name"] || item?.["cbc:Description"] || "Articol";
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
            invoiceArchiveId: doc.id,
            description: String(description),
            quantity: String(qty),
            unitPrice: String(unitPrice),
            unit: String(unit),
            vatRate: String(vatRate),
            total: String(lineTotal),
            currency: doc.currency || "RON",
          };
        });

        await db.insert(invoiceArchiveLines).values(linesToInsert);
        console.log(`[BACKFILL] Inserted ${linesToInsert.length} lines for Invoice ID ${doc.id}`);
      }
    } catch (e) {
      console.error(`Failed to parse XML for ID ${doc.id}`);
    }
  }
}

backfill().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
