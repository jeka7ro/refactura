require("dotenv").config();
const mysql = require("mysql2/promise");

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  // Fix invoiceArchive where notes like '%STORNO%'
  const [resArchive] = await connection.execute(`
    UPDATE invoiceArchive 
    SET total = -ABS(total), totalVAT = -ABS(totalVAT)
    WHERE notes LIKE '%STORNO%' AND total > 0
  `);
  console.log("Fixed invoiceArchive:", resArchive.affectedRows);

  // Also check reInvoices
  const [resRe] = await connection.execute(`
    UPDATE reInvoices 
    SET total = -ABS(total), subtotal = -ABS(subtotal), totalVAT = -ABS(totalVAT)
    WHERE id IN (
      SELECT reInvoiceId FROM invoiceArchive WHERE notes LIKE '%STORNO%' AND reInvoiceId IS NOT NULL
    ) AND total > 0
  `);
  console.log("Fixed reInvoices:", resRe.affectedRows);

  await connection.end();
}
run();
