require("dotenv").config();
const mysql = require("mysql2/promise");

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await connection.execute(
    "SELECT * FROM invoiceArchive WHERE id = 5"
  );
  if (rows.length > 0) {
    console.log(rows[0]);
  }
  await connection.end();
}
run();
