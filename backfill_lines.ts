import { getDb } from "./server/db";
import { invoiceArchive, invoiceArchiveLines } from "./drizzle/schema";
import { XMLParser } from "fast-xml-parser";
import { eq, inArray } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) return;

  const allInvoices = await db.select().from(invoiceArchive);
  
  // Get existing lines
  const existingLines = await db.select().from(invoiceArchiveLines);
  const invoicesWithLines = new Set(existingLines.map(l => l.invoiceArchiveId));

  const parser = new XMLParser({ ignoreAttributes: false });

  let insertedCount = 0;

  for (const inv of allInvoices) {
    if (invoicesWithLines.has(inv.id)) continue;
    if (!inv.rawXml) continue;

    try {
      const parsed = parser.parse(inv.rawXml);
      const invoiceObj = parsed.Invoice || parsed.CreditNote || parsed.Factura;
      if (!invoiceObj) continue;

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
          let unitPrice = parseFloat(
            price?.["cbc:PriceAmount"]?.["#text"] ||
            price?.["cbc:PriceAmount"] ||
            "0"
          );
          if (isNaN(unitPrice)) unitPrice = 0;
          const unit =
            line["cbc:InvoicedQuantity"]?.["@_unitCode"] ||
            line["cbc:CreditedQuantity"]?.["@_unitCode"] ||
            "buc";
          let lineTotal = parseFloat(
            line["cbc:LineExtensionAmount"]?.["#text"] ||
            line["cbc:LineExtensionAmount"] ||
            String(qty * unitPrice)
          );
          if (isNaN(lineTotal)) lineTotal = 0;

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
            invoiceArchiveId: inv.id,
            description: String(description),
            quantity: String(qty) as any,
            unitPrice: String(unitPrice) as any,
            unit: String(unit),
            vatRate: String(vatRate) as any,
            total: String(lineTotal) as any,
            currency: inv.currency || "RON",
          };
        });

        await db.insert(invoiceArchiveLines).values(linesToInsert);
        insertedCount += linesToInsert.length;
        console.log(`Inserted ${linesToInsert.length} lines for invoice ${inv.id} (${inv.invoiceNumber})`);
      }
    } catch (e) {
      console.error(`Error parsing invoice ${inv.id}:`, e);
    }
  }

  console.log(`Backfill complete! Inserted ${insertedCount} lines in total.`);
}

run().catch(console.error).finally(() => process.exit(0));
