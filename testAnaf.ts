import 'dotenv/config';
import { getDb } from './server/db.ts';
import { integrations } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
async function test() {
  const db = await getDb();
  const res = await db.select().from(integrations).where(eq(integrations.provider, 'spv'));
  const spvIntg = res[0];
  if (!spvIntg?.apiKey) return console.log("No API Key");

  const cif = process.env.SPV_CUI || "42322117";
  const end = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const start = end - 60 * 24 * 60 * 60 * 1000;
  const url = "https://api.anaf.ro/prod/FCTEL/rest/listaMesajePaginatieFactura?startTime=" + start + "&endTime=" + end + "&cif=" + cif + "&pagina=1";
  
  console.log("Fetching:", url);
  const resp = await fetch(url, { headers: { Authorization: "Bearer " + spvIntg.apiKey }});
  const text = await resp.text();
  console.log("Status:", resp.status);
  console.log("Body:", text.slice(0, 500));
}
test();
