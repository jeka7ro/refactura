import 'dotenv/config';
import { getDb } from './server/db.ts';
import { invoiceArchive } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';
async function test() {
  const db = await getDb();
  const res = await db.select({ 
    id: invoiceArchive.id, 
    number: invoiceArchive.invoiceNumber, 
    source: invoiceArchive.source, 
    fileUrl: invoiceArchive.fileUrl,
    fileName: invoiceArchive.fileName
  }).from(invoiceArchive).where(eq(invoiceArchive.source, 'spv_anaf'));
  console.log(res.slice(0, 5));
}
test();
