import { getDb } from "../server/db";
import { invoiceArchive } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) {
    console.error("No DB available");
    process.exit(1);
  }
  
  // Find JYSK invoice. We can search by invoiceNumber or id=21
  const [inv] = await db.select().from(invoiceArchive).where(eq(invoiceArchive.id, 21));
  if (inv && inv.rawXml) {
    console.log("Found XML:");
    console.log(inv.rawXml.substring(0, 500));
    
    // Also log a line with descriptions
    console.log("\nSearching for 'PE DIMMA':");
    const lines = inv.rawXml.split('\n');
    for (const line of lines) {
      if (line.includes('DIMMA') || line.includes('opac')) {
        console.log(line);
      }
    }
  } else {
    console.log("Invoice 21 not found or no XML.");
  }
  
  process.exit(0);
}

run().catch(console.error);
