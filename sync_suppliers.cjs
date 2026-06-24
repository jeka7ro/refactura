require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [invoices] = await connection.execute('SELECT tenantId, supplierName, supplierCUI FROM invoiceArchive WHERE direction = "in" GROUP BY tenantId, supplierName, supplierCUI');
    console.log(`Found ${invoices.length} unique suppliers in archive`);
    
    for (const inv of invoices) {
       if (!inv.supplierCUI || !inv.supplierName) continue;
       const cleanCUI = String(inv.supplierCUI).replace(/^RO/i, '').trim();
       const [exists] = await connection.execute('SELECT id FROM clients WHERE tenantId = ? AND REPLACE(UPPER(cui), "RO", "") = ?', [inv.tenantId, cleanCUI]);
       if (exists.length === 0) {
          const tva = String(inv.supplierCUI).toUpperCase().startsWith("RO") ? 1 : 0;
          await connection.execute('INSERT INTO clients (tenantId, name, cui, regCom, address, city, country, email, phone, tva, isSupplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
             inv.tenantId,
             inv.supplierName,
             inv.supplierCUI,
             "", "", "", "RO", "", "", tva, 1
          ]);
          console.log(`Inserted ${inv.supplierName}`);
       } else {
          // ensure it's marked as supplier
          await connection.execute('UPDATE clients SET isSupplier = 1 WHERE id = ?', [exists[0].id]);
       }
    }
    console.log("Sync complete");
  } catch (e) {
    console.error(e.message);
  }
  await connection.end();
}
run();
