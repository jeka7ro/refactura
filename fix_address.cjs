require("dotenv").config();
const mysql = require("mysql2/promise");
const { XMLParser } = require("fast-xml-parser");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

async function run() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [invoices] = await connection.execute(
      'SELECT supplierCUI, rawXml FROM invoiceArchive WHERE direction = "in" GROUP BY supplierCUI'
    );
    console.log(`Found ${invoices.length} unique suppliers with XML`);

    for (const inv of invoices) {
      if (!inv.supplierCUI || !inv.rawXml) continue;
      try {
        const parsed = parser.parse(inv.rawXml);
        const invData = parsed.Invoice || parsed.Factura;
        if (!invData) continue;

        const supplierParty = invData.AccountingSupplierParty?.Party || {};
        const addressInfo = supplierParty.PostalAddress || {};
        const name = supplierParty.PartyName?.Name || "";

        const city = addressInfo.CityName || "";
        const address = addressInfo.StreetName || "";
        const regCom = supplierParty.PartyLegalEntity?.CompanyID || "";

        const cleanCUI = String(inv.supplierCUI).replace(/^RO/i, "").trim();

        await connection.execute(
          'UPDATE clients SET address = ?, city = ?, regCom = ? WHERE REPLACE(UPPER(cui), "RO", "") = ?',
          [address, city, regCom, cleanCUI]
        );
        console.log(
          `Updated address for CUI ${inv.supplierCUI}: ${city}, ${address}`
        );
      } catch (err) {
        console.log("Error parsing XML for CUI", inv.supplierCUI);
      }
    }
    console.log("Sync complete");
  } catch (e) {
    console.error(e.message);
  }
  await connection.end();
}
run();
