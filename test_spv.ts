import 'dotenv/config';
import { getDb } from "./server/db";
import { integrations } from "./drizzle/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if(!db) { console.error("No DB"); return; }
  const [intg] = await db.select().from(integrations)
    .where(and(eq(integrations.provider, "spv"), eq(integrations.status, "active"))).limit(1);
  if(!intg) { console.error("No intg"); return; }
  
  const cif = "42322117";
  const currentEndTime = Date.now();
  const currentStartTime = currentEndTime - (30 * 24 * 60 * 60 * 1000);
  
  const listUrl2 = `https://api.anaf.ro/prod/FCTEL/rest/listaMesajePaginatieFactura?startTime=${currentStartTime}&endTime=${currentEndTime}&cif=${cif}&pagina=1`;
  console.log("Testing:", listUrl2);
  const res2 = await fetch(listUrl2, { headers: { "Authorization": `Bearer ${intg.apiKey}` } });
  console.log("res2 status:", res2.status, await res2.text().catch(e=>e.message));

  process.exit(0);
}
main().catch(console.error);
