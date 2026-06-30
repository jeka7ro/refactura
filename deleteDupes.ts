import "dotenv/config";
import { getDb } from "./server/db.ts";
import { invoiceArchive } from "./drizzle/schema.ts";
import { eq, and } from "drizzle-orm";
async function run() {
  const db = await getDb();
  // Find all OUT invoices from spv_anaf
  const spvOut = await db
    .select()
    .from(invoiceArchive)
    .where(
      and(
        eq(invoiceArchive.direction, "out"),
        eq(invoiceArchive.source, "spv_anaf")
      )
    );

  console.log("Found", spvOut.length, "SPV out invoices. Deleting them...");
  for (const inv of spvOut) {
    await db.delete(invoiceArchive).where(eq(invoiceArchive.id, inv.id));
    console.log("Deleted SPV duplicate", inv.invoiceNumber);
  }

  // Re-run SPV sync to merge them into Oblio invoices!
  const { syncAllSpv } = await import("./server/spvCron.ts");
  console.log("Running SPV Sync to merge...");
  await syncAllSpv(365);
  console.log("Finished.");
}
run();
