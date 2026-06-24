require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.execute('SELECT id, description FROM invoiceArchiveLines WHERE description LIKE "%DRA opac%" LIMIT 5');
    console.log("Lines in DB:", rows);
  } catch (e) {
    console.error(e.message);
  }
  await connection.end();
}
run();
