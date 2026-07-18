import { drizzle } from "drizzle-orm/mysql2";
import { accounts } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("No DATABASE_URL");
    return;
  }
  const db = drizzle(process.env.DATABASE_URL);
  
  // Set password to Admin123!
  const newHash = "$2b$10$HA5DBLgjx15OxnAdzW2Pl.rFvUoB3EB9M6rGZjxhqPj0rvQ0ugNp.";
  
  await db.update(accounts).set({ passwordHash: newHash }).where(eq(accounts.email, 'jeka7ro@gmail.com'));
  console.log("Password hash fixed!");
  process.exit(0);
}
main().catch(console.error);
