require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await connection.execute('SELECT total, totalVAT, notes FROM invoiceArchive WHERE id = 5');
  console.log(rows);
  await connection.end();
}
run();
