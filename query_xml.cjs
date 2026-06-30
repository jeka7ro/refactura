require("dotenv").config();
const mysql = require("mysql2/promise");

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await connection.execute(
      'SELECT id, invoiceNumber FROM invoiceArchive WHERE rawXml LIKE "%ÄE$%" OR rawXml LIKE "%DRA opac 2%"'
    );
    console.log("Bad XMLs:", rows);

    // Also try to find JYSK invoice by name
    const [jysk] = await connection.execute(
      'SELECT id, invoiceNumber, rawXml FROM invoiceArchive WHERE supplierName LIKE "%JYSK%"'
    );
    if (jysk.length > 0) {
      console.log("Found JYSK invoice:", jysk[0].id, jysk[0].invoiceNumber);
      const match = jysk[0].rawXml.match(/<cbc:Name>(.*?)<\/cbc:Name>/g);
      console.log("JYSK items:", match ? match.slice(0, 5) : "none");
    }
  } catch (e) {
    console.error(e.message);
  }
  await connection.end();
}
run();
