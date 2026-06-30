import { getDb } from "../server/db";
import { invoiceArchive } from "../drizzle/schema";
import { convertXmlToPdf } from "../server/anafPdf";
import { eq, isNotNull } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) {
    console.error("No DB available");
    process.exit(1);
  }
  const invoices = await db
    .select()
    .from(invoiceArchive)
    .where(isNotNull(invoiceArchive.rawXml));
  console.log(`Found ${invoices.length} invoices with XML.`);

  for (const inv of invoices) {
    if (inv.rawXml && inv.fileName) {
      if (inv.fileUrl && inv.fileUrl.startsWith("/uploads/invoices/")) {
        const baseName = inv.fileUrl
          .replace("/uploads/invoices/", "")
          .replace(".pdf", "");
        console.log(`Regenerating PDF for ${baseName}...`);
        await convertXmlToPdf(inv.rawXml, baseName);
      }
    }
  }
  console.log("Done.");
  process.exit(0);
}

run().catch(console.error);
