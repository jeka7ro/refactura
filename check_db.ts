import { drizzle } from "drizzle-orm/mysql2";
import { accounts } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("No DATABASE_URL");
    return;
  }
  const db = drizzle(process.env.DATABASE_URL);
  const accList = await db.select().from(accounts).where(eq(accounts.email, 'jeka7ro@gmail.com'));
  console.log("Found accounts:", accList);
  process.exit(0);
}
main().catch(console.error);
