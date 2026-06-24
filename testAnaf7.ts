import 'dotenv/config';
import { getDb } from './server/db.ts';
import { integrations } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
async function test() {
  const db = await getDb();
  const res = await db.select().from(integrations).where(eq(integrations.provider, 'spv'));
  const spvIntg = res[0];
  const url = `https://api.anaf.ro/prod/FCTEL/rest/descarcare?id=7743462385`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${spvIntg.apiKey}` }});
  const text = await resp.text();
  console.log("Status:", resp.status);
  console.log("Body length:", text.length);
  console.log("Body:", text.slice(0, 500));
}
test();
