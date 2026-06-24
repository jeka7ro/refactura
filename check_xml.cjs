require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [invoices] = await connection.execute('SELECT supplierCUI, rawXml FROM invoiceArchive WHERE direction = "in" LIMIT 1');
    console.log(invoices[0].rawXml.substring(0, 2000));
  } catch (e) {
    console.error(e.message);
  }
  await connection.end();
}
run();
