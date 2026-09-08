import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sagaArticles, sagaFurnizori, sagaGestiuni, sagaArticleMappings } from "../modules/saga/schema";
import { eq } from "drizzle-orm";

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(pool);

  console.log("Wiping saga tables for tenant 4 (WOOD GLASS SRL)...");
  
  await db.delete(sagaArticles).where(eq(sagaArticles.tenantId, 4));
  console.log("Wiped sagaArticles");
  
  await db.delete(sagaFurnizori).where(eq(sagaFurnizori.tenantId, 4));
  console.log("Wiped sagaFurnizori");
  
  await db.delete(sagaGestiuni).where(eq(sagaGestiuni.tenantId, 4));
  console.log("Wiped sagaGestiuni");
  
  await db.delete(sagaArticleMappings).where(eq(sagaArticleMappings.tenantId, 4));
  console.log("Wiped sagaArticleMappings");

  console.log("Done wiping saga tables.");
  process.exit(0);
}

main().catch(console.error);
