require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.execute('SELECT id, invoiceArchiveId, description FROM invoiceArchiveLines WHERE description LIKE "%opac 2%" OR description LIKE "%ÄE$%" LIMIT 10');
    console.log("Bad lines:", rows);
  } catch (e) {
    console.error(e.message);
  }
  await connection.end();
}
run();
