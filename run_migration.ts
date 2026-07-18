import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("No DATABASE_URL");
    return;
  }
  const db = drizzle(process.env.DATABASE_URL);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`passwordResets\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`email\` varchar(320) NOT NULL,
      \`token\` varchar(255) NOT NULL,
      \`expiresAt\` timestamp NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    );
  `);
  console.log("Table passwordResets created!");
  process.exit(0);
}
main().catch(console.error);
