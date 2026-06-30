import { getDb } from "./server/db";
import { accounts, tenants } from "./drizzle/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB connection failed");
    process.exit(1);
  }

  // Check for the user
  const accountList = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, "jeka7ro@gmail.com"));
  const account = accountList[0];
  if (!account) {
    console.error("User jeka7ro@gmail.com not found!");
    process.exit(1);
  }

  // Create a default tenant
  const [insertResult] = await db.insert(tenants).values({
    name: "SmartDevize HQ",
    email: "jeka7ro@gmail.com",
    address: "Bucuresti",
    cui: "RO12345678",
  });

  const tenantId = insertResult.insertId;
  console.log("Created tenant with ID:", tenantId);

  // Update account with tenantId
  await db
    .update(accounts)
    .set({ tenantId })
    .where(eq(accounts.id, account.id));
  console.log("Updated jeka7ro@gmail.com with tenantId:", tenantId);

  process.exit(0);
}
main().catch(console.error);
