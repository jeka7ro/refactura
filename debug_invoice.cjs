require("dotenv").config();
const mysql = require("mysql2/promise");

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await connection.execute(
    "SELECT * FROM invoiceArchive WHERE id = 5"
  );
  if (rows.length > 0) {
    const r = rows[0];
    console.log(
      JSON.stringify(
        {
          id: r.id,
          number: r.number,
          total: r.total,
          subtotal: r.subtotal,
          totalVAT: r.totalVAT,
          rawXmlLength: r.rawXml ? r.rawXml.length : 0,
        },
        null,
        2
      )
    );
  } else {
    console.log("Invoice not found.");
  }
  await connection.end();
}
run();
