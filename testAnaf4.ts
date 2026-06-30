import "dotenv/config";
import { getDb } from "./server/db.ts";
import { integrations } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
async function test() {
  const db = await getDb();
  const res = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "spv"));
  const spvIntg = res[0];
  const cif = process.env.SPV_CUI || "42322117";
  const end = Date.now();
  const start = end - 60 * 24 * 60 * 60 * 1000;
  const url = `https://api.anaf.ro/prod/FCTEL/rest/listaMesajePaginatieFactura?startTime=${start}&endTime=${end}&cif=${cif}&pagina=1`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${spvIntg.apiKey}` },
  });
  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
