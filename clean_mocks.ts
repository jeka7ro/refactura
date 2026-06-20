import "dotenv/config";
import { getDb } from "./server/db";
import { invoiceArchive, invoices, clients } from "./drizzle/schema";
import { like, or, eq, inArray } from "drizzle-orm";

async function cleanMocks() {
  const db = await getDb();
  if (!db) { console.error("No DB"); return; }

  console.log("=== Curăță date mock din DB ===\n");

  // 1. Arată ce există în invoiceArchive înainte
  const allArchive = await db.select({
    id: invoiceArchive.id,
    invoiceNumber: invoiceArchive.invoiceNumber,
    supplierName: invoiceArchive.supplierName,
    source: invoiceArchive.source,
  }).from(invoiceArchive);
  
  console.log(`invoiceArchive (${allArchive.length} total):`);
  allArchive.forEach(i => console.log(`  [${i.id}] ${i.invoiceNumber} — ${i.supplierName} (${i.source})`));

  // 2. Șterge facturile cu source = 'mock' sau supplier-name mock-uri cunoscute
  const mockSuppliers = ["Dedeman SRL", "eMAG Marketplace", "OMV Petrom SA", "ConstructMaster SRL"];
  
  const toDelete = allArchive.filter(i => 
    i.source === "mock" || 
    mockSuppliers.some(m => i.supplierName?.includes(m.split(" ")[0]))
  );

  if (toDelete.length > 0) {
    const ids = toDelete.map(i => i.id);
    await db.delete(invoiceArchive).where(inArray(invoiceArchive.id, ids));
    console.log(`\n✅ Șterse ${toDelete.length} facturi mock: ${toDelete.map(i => i.invoiceNumber).join(", ")}`);
  } else {
    console.log("\nNicio factură mock găsită în invoiceArchive.");
  }

  // 3. Arată ce există în invoices (tabela principală)
  try {
    const allInvoices = await db.select().from(invoices);
    console.log(`\ninvoices (${allInvoices.length} total):`);
    allInvoices.forEach((i: any) => console.log(`  [${i.id}] ${i.invoiceNumber || i.number} — ${i.supplierName || i.clientName}`));
    
    // Șterge toate din invoices dacă sunt mock-uri (source mock sau known mocks)
    const mockInv = allInvoices.filter((i: any) => 
      i.source === "mock" ||
      mockSuppliers.some(m => (i.supplierName || i.clientName || "")?.includes(m.split(" ")[0]))
    );
    if (mockInv.length > 0) {
      const ids = mockInv.map((i: any) => i.id);
      await db.delete(invoices).where(inArray((invoices as any).id, ids));
      console.log(`✅ Șterse ${mockInv.length} facturi mock din invoices`);
    }
  } catch (e: any) {
    console.log(`invoices table: ${e.message}`);
  }

  // 4. Arată ce clienți mock există
  const allClients = await db.select({ id: clients.id, name: clients.name, cui: clients.cui }).from(clients);
  console.log(`\nclients (${allClients.length} total):`);
  allClients.forEach(c => console.log(`  [${c.id}] ${c.name} — CUI: ${c.cui}`));

  // 5. Arată ce mai rămâne în invoiceArchive
  const remaining = await db.select({ invoiceNumber: invoiceArchive.invoiceNumber, supplierName: invoiceArchive.supplierName, source: invoiceArchive.source }).from(invoiceArchive);
  console.log(`\n=== Rămase după curățare: ${remaining.length} facturi ===`);
  remaining.forEach(i => console.log(`  ${i.invoiceNumber} — ${i.supplierName} (${i.source})`));

  process.exit(0);
}

cleanMocks().catch(console.error);
