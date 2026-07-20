import { getDb } from "./server/db.ts";
import { invoiceArchiveLines } from "./drizzle/schema.ts";

async function checkLines() {
  const db = await getDb();
  const lines = await db.select().from(invoiceArchiveLines);
  console.log("Total lines in DB:", lines.length);
  if (lines.length > 0) {
    console.log("Sample:", lines[0]);
  }
}
checkLines().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
