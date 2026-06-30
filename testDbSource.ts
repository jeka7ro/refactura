import "dotenv/config";
import { getDb } from "./server/db.ts";
import { invoiceArchive } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
async function test() {
  const db = await getDb();
  const res = await db
    .select({
      id: invoiceArchive.id,
      number: invoiceArchive.invoiceNumber,
      source: invoiceArchive.source,
      supplier: invoiceArchive.supplierName,
      dir: invoiceArchive.direction,
    })
    .from(invoiceArchive)
    .where(eq(invoiceArchive.direction, "out"));
  console.log(res);
}
test();
