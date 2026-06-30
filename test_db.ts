import "dotenv/config";
import { getDb } from "./server/db";
import { invoiceArchive } from "./drizzle/schema";
import { like, or, isNull } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("No DB");
    return;
  }
  const res = await db
    .select({
      id: invoiceArchive.id,
      invoiceNumber: invoiceArchive.invoiceNumber,
      supplierName: invoiceArchive.supplierName,
      fileName: invoiceArchive.fileName,
      source: invoiceArchive.source,
      missingXml: isNull(invoiceArchive.rawXml),
    })
    .from(invoiceArchive)
    .where(
      or(
        like(invoiceArchive.supplierName, "%Orange%"),
        like(invoiceArchive.supplierName, "%Autoklass%")
      )
    );
  console.log(res);
  process.exit(0);
}
main().catch(console.error);
