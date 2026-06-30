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
      'SELECT supplierCUI, rawXml FROM invoiceArchive WHERE direction = "in"'
    );

    const updated = new Set();

    for (const inv of invoices) {
      if (!inv.supplierCUI || !inv.rawXml || updated.has(inv.supplierCUI))
        continue;
      try {
        const parsed = parser.parse(inv.rawXml);
        const invData = parsed.Invoice || parsed.Factura;
        if (!invData) continue;

        const supplierParty =
          invData["cac:AccountingSupplierParty"]?.["cac:Party"] || {};
        const addressInfo = supplierParty["cac:PostalAddress"] || {};

        const city = addressInfo["cbc:CityName"] || "";
        const address = addressInfo["cbc:StreetName"] || "";
        const regComObj =
          supplierParty["cac:PartyLegalEntity"]?.["cbc:CompanyID"];
        const regCom =
          typeof regComObj === "object" ? regComObj["#text"] : regComObj || "";

        const cleanCUI = String(inv.supplierCUI).replace(/^RO/i, "").trim();

        await connection.execute(
          'UPDATE clients SET address = ?, city = ?, regCom = ? WHERE REPLACE(UPPER(cui), "RO", "") = ?',
          [address, city, regCom, cleanCUI]
        );
        console.log(`Updated CUI ${inv.supplierCUI}: ${city}, ${address}`);
        updated.add(inv.supplierCUI);
      } catch (err) {
        console.log("Error parsing XML for CUI", inv.supplierCUI);
      }
    }
  } catch (e) {
    console.error(e.message);
  }
  await connection.end();
}
run();
