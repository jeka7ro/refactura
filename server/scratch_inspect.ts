import 'dotenv/config';
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { tenants, clients, inventoryItems } from "../drizzle/schema";
import { eq, or, like } from "drizzle-orm";

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(pool);

  const allTenants = await db.select().from(tenants);
  const rowood = allTenants.find(t => 
    (t.name && t.name.toLowerCase().includes("rowood")) || 
    (t.cui && t.cui.toLowerCase().includes("rowood")) ||
    (t.cui && t.cui === "28396216")
  );
  
  if (!rowood) {
    console.log("Tenant WOOD GLASS / rowoodbv not found");
    process.exit(1);
  }

  const tenantId = rowood.id;
  console.log("Found tenant:", rowood.name, "ID:", tenantId);

  // Execute wipe
  await db.delete(clients).where(eq(clients.tenantId, tenantId));
  console.log("Wiped clients (furnizori/clienti) for tenant", tenantId);

  await db.delete(inventoryItems).where(eq(inventoryItems.tenantId, tenantId));
  console.log("Wiped inventoryItems (articole) for tenant", tenantId);

  console.log("Cleanup complete!");
  process.exit(0);
}

main().catch(console.error);

main().catch(console.error);
