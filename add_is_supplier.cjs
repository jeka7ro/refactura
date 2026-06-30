require("dotenv").config();
const mysql = require("mysql2/promise");

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.query(
      "ALTER TABLE clients ADD COLUMN isSupplier INT DEFAULT 0"
    );
    console.log("Column added!");
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log("Column already exists.");
    } else {
      console.error(e.message);
    }
  }

  // Set JYSK and any previously added as supplier if they were added via cron
  // We can't know for sure, but we can set isSupplier=1 for JYSK as a test
  await connection.query(
    'UPDATE clients SET isSupplier = 1 WHERE name LIKE "%JYSK%"'
  );
  console.log("Updated JYSK as supplier");

  await connection.end();
}
run();
