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
  
  // Test 1: zile=60
  const url1 = `https://api.anaf.ro/prod/FCTEL/rest/listaMesajePaginatieFactura?zile=60&cif=${cif}&pagina=1`;
  const res1 = await fetch(url1, { headers: { Authorization: `Bearer ${spvIntg.apiKey}` }});
  const data1 = await res1.json();
  console.log("TEST 1 (zile=60):");
  console.log("Total inregistrari:", data1.numar_total_inregistrari);
  console.log("Mesaje (primul tip):", data1.mesaje?.[0]?.tip);
  
  // Test 2: startTime and endTime for last 60 days
  const end = Date.now();
  const start = end - 60 * 24 * 60 * 60 * 1000;
  const url2 = `https://api.anaf.ro/prod/FCTEL/rest/listaMesajePaginatieFactura?startTime=${start}&endTime=${end}&cif=${cif}&pagina=1`;
  const res2 = await fetch(url2, { headers: { Authorization: `Bearer ${spvIntg.apiKey}` }});
  const data2 = await res2.json();
  console.log("\nTEST 2 (startTime/endTime):");
  console.log("Total inregistrari:", data2.numar_total_inregistrari);
  console.log("Mesaje (primul tip):", data2.mesaje?.[0]?.tip);
}
test();
