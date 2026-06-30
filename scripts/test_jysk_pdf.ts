import { getDb } from "../server/db";
import { invoiceArchive } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { convertXmlToPdf } from "../server/anafPdf";
import * as dotenv from "dotenv";

dotenv.config();

async function run() {
  const db = await getDb();
  const [inv] = await db
    .select()
    .from(invoiceArchive)
    .where(eq(invoiceArchive.id, 21));
  if (inv && inv.rawXml) {
    console.log("Generating PDF...");
    await convertXmlToPdf(inv.rawXml, "test_jysk_local");
    console.log("Generated test_jysk_local.pdf in uploads folder");
  }
  process.exit(0);
}
run().catch(console.error);
