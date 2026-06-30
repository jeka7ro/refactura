import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import PDFDocument from "pdfkit";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export async function createOblioStylePdf(
  xmlString: string,
  outputPath: string
) {
  const parsed = parser.parse(xmlString);
  const invoice = parsed.Invoice || parsed.CreditNote;
  if (!invoice) throw new Error("Invalid e-Factura XML");

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Helper to safely get nested properties
  const getVal = (obj: any, pathStr: string) => {
    return (
      pathStr.split(".").reduce((acc, part) => acc && acc[part], obj) || ""
    );
  };

  const invNumber = invoice["cbc:ID"] || "";
  const issueDate = invoice["cbc:IssueDate"] || "";
  const dueDate = invoice["cbc:DueDate"] || issueDate;
  const currency = invoice["cbc:DocumentCurrencyCode"] || "RON";

  // Supplier
  const supParty = invoice["cac:AccountingSupplierParty"]?.["cac:Party"] || {};
  const supName =
    supParty["cac:PartyName"]?.["cbc:Name"] ||
    supParty["cac:PartyLegalEntity"]?.["cbc:RegistrationName"] ||
    "";
  const supCUI =
    supParty["cac:PartyTaxScheme"]?.["cbc:CompanyID"] ||
    supParty["cac:PartyLegalEntity"]?.["cbc:CompanyID"] ||
    "";
  const supAddress = supParty["cac:PostalAddress"]?.["cbc:StreetName"] || "";
  const supCity = supParty["cac:PostalAddress"]?.["cbc:CityName"] || "";

  // Customer
  const cusParty = invoice["cac:AccountingCustomerParty"]?.["cac:Party"] || {};
  const cusName =
    cusParty["cac:PartyName"]?.["cbc:Name"] ||
    cusParty["cac:PartyLegalEntity"]?.["cbc:RegistrationName"] ||
    "";
  const cusCUI =
    cusParty["cac:PartyTaxScheme"]?.["cbc:CompanyID"] ||
    cusParty["cac:PartyLegalEntity"]?.["cbc:CompanyID"] ||
    "";
  const cusAddress = cusParty["cac:PostalAddress"]?.["cbc:StreetName"] || "";
  const cusCity = cusParty["cac:PostalAddress"]?.["cbc:CityName"] || "";

  // HEADER
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("FACTURĂ FISCALĂ", { align: "right" });
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Seria / Numărul: ${invNumber}`, { align: "right" });
  doc.text(`Data emiterii: ${issueDate}`, { align: "right" });
  doc.text(`Data scadenței: ${dueDate}`, { align: "right" });
  doc.moveDown(2);

  const startY = doc.y;

  // Supplier Box
  doc.fontSize(12).font("Helvetica-Bold").text("Furnizor", 40, startY);
  doc.fontSize(10).font("Helvetica").text(supName);
  doc.text(`CUI: ${supCUI}`);
  doc.text(`Adresă: ${supAddress}, ${supCity}`);

  // Customer Box
  doc.fontSize(12).font("Helvetica-Bold").text("Client", 300, startY);
  doc.fontSize(10).font("Helvetica").text(cusName, 300, doc.y);
  doc.text(`CUI: ${cusCUI}`, 300, doc.y);
  doc.text(`Adresă: ${cusAddress}, ${cusCity}`, 300, doc.y);

  doc.moveDown(3);

  // TABLE
  const tableTop = Math.max(doc.y, 250);
  const itemX = 40,
    umX = 250,
    qtyX = 300,
    priceX = 350,
    valX = 430,
    tvaX = 500;

  doc.font("Helvetica-Bold").fontSize(9);
  doc.rect(40, tableTop - 5, 515, 20).fillAndStroke("#f1f5f9", "#cbd5e1");
  doc.fillColor("#334155");
  doc.text("Denumire produs / serviciu", itemX + 5, tableTop);
  doc.text("U.M.", umX, tableTop);
  doc.text("Cant.", qtyX, tableTop);
  doc.text("Preț Unitar", priceX, tableTop);
  doc.text("Valoare", valX, tableTop);
  doc.text("Val. TVA", tvaX, tableTop);

  doc.moveDown();
  let y = tableTop + 25;
  doc.font("Helvetica").fillColor("#0f172a");

  let lines = invoice["cac:InvoiceLine"];
  if (!lines) lines = [];
  if (!Array.isArray(lines)) lines = [lines];

  lines.forEach((l: any, index: number) => {
    const name =
      l["cac:Item"]?.["cbc:Name"] ||
      l["cac:Item"]?.["cbc:Description"] ||
      "Produs";
    const um = l["cbc:InvoicedQuantity"]?.["@_unitCode"] || "buc";
    const qty =
      l["cbc:InvoicedQuantity"]?.["#text"] || l["cbc:InvoicedQuantity"] || "0";
    const price =
      l["cac:Price"]?.["cbc:PriceAmount"]?.["#text"] ||
      l["cac:Price"]?.["cbc:PriceAmount"] ||
      "0";
    const val =
      l["cbc:LineExtensionAmount"]?.["#text"] ||
      l["cbc:LineExtensionAmount"] ||
      "0";

    // Simplistic VAT extraction
    const tvaNode = l["cac:TaxTotal"]?.["cac:TaxSubtotal"];
    let tvaVal = "0.00";
    if (Array.isArray(tvaNode)) {
      tvaVal = tvaNode[0]?.["cbc:TaxAmount"]?.["#text"] || "0";
    } else if (tvaNode) {
      tvaVal =
        tvaNode["cbc:TaxAmount"]?.["#text"] || tvaNode["cbc:TaxAmount"] || "0";
    }

    // Wrap text for product name
    const nameHeight = doc.heightOfString(name, { width: 200 });
    doc.text(name, itemX + 5, y, { width: 200 });
    doc.text(um, umX, y);
    doc.text(qty.toString(), qtyX, y);
    doc.text(price.toString(), priceX, y);
    doc.text(val.toString(), valX, y);
    doc.text(tvaVal.toString(), tvaX, y);

    y += nameHeight + 10;
  });

  // Totals
  doc.moveDown(2);
  const totalY = y + 20;
  const legalTotal = invoice["cac:LegalMonetaryTotal"] || {};
  const taxTotal = invoice["cac:TaxTotal"] || {};

  let totalTaxAmt = "0.00";
  if (Array.isArray(taxTotal)) {
    totalTaxAmt = taxTotal[0]?.["cbc:TaxAmount"]?.["#text"] || "0.00";
  } else {
    totalTaxAmt =
      taxTotal["cbc:TaxAmount"]?.["#text"] ||
      taxTotal["cbc:TaxAmount"] ||
      "0.00";
  }

  const subTotal =
    legalTotal["cbc:TaxExclusiveAmount"]?.["#text"] ||
    legalTotal["cbc:TaxExclusiveAmount"] ||
    "0.00";
  const payable =
    legalTotal["cbc:PayableAmount"]?.["#text"] ||
    legalTotal["cbc:PayableAmount"] ||
    "0.00";

  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("TOTALURI", 350, totalY);
  doc.font("Helvetica");
  doc.text(`Valoare fără TVA:`, 350, totalY + 15);
  doc.text(subTotal.toString(), 450, totalY + 15, { align: "right" });
  doc.text(`TVA:`, 350, totalY + 30);
  doc.text(totalTaxAmt.toString(), 450, totalY + 30, { align: "right" });

  doc.font("Helvetica-Bold").fontSize(12);
  doc.text(`Total de plată:`, 350, totalY + 50);
  doc.text(`${payable.toString()} ${currency}`, 450, totalY + 50, {
    align: "right",
  });

  doc.end();

  return new Promise(resolve => writeStream.on("finish", resolve));
}

async function main() {
  const xml = fs.readFileSync("test_invoice.xml", "utf8").catch(() => null);
  if (!xml) {
    console.log("Create a test_invoice.xml file first");
    return;
  }
  await createOblioStylePdf(xml, "test_output.pdf");
  console.log("PDF generated at test_output.pdf");
}
// main();
