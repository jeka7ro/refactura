import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.resolve(process.cwd(), "dist/public/uploads/invoices");

// Ensure upload directory exists
function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function convertXmlToPdf(xmlText: string, fileNameBase: string): Promise<{ key: string, url: string } | null> {
  try {
    const { XMLParser } = await import("fast-xml-parser");
    const PDFDocument = (await import("pdfkit")).default;

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xmlText);
    const invoice = parsed.Invoice || parsed.CreditNote;
    
    if (!invoice) {
      console.error("[ANAF PDF] Invalid XML: No Invoice or CreditNote node found");
      return null;
    }

    // Wrap PDFKit in a promise to generate the buffer
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Helper to safely get nested properties
        const getVal = (obj: any, pathStr: string) => {
          return pathStr.split('.').reduce((acc, part) => acc && acc[part], obj) || "";
        };

        const invNumber = invoice["cbc:ID"] || "";
        const issueDate = invoice["cbc:IssueDate"] || "";
        const dueDate = invoice["cbc:DueDate"] || issueDate;
        const currency = invoice["cbc:DocumentCurrencyCode"] || "RON";

        // Supplier
        const supParty = invoice["cac:AccountingSupplierParty"]?.["cac:Party"] || {};
        const supName = supParty["cac:PartyName"]?.["cbc:Name"] || supParty["cac:PartyLegalEntity"]?.["cbc:RegistrationName"] || "";
        const supCUI = supParty["cac:PartyTaxScheme"]?.["cbc:CompanyID"] || supParty["cac:PartyLegalEntity"]?.["cbc:CompanyID"] || "";
        const supAddress = supParty["cac:PostalAddress"]?.["cbc:StreetName"] || "";
        const supCity = supParty["cac:PostalAddress"]?.["cbc:CityName"] || "";

        // Customer
        const cusParty = invoice["cac:AccountingCustomerParty"]?.["cac:Party"] || {};
        const cusName = cusParty["cac:PartyName"]?.["cbc:Name"] || cusParty["cac:PartyLegalEntity"]?.["cbc:RegistrationName"] || "";
        const cusCUI = cusParty["cac:PartyTaxScheme"]?.["cbc:CompanyID"] || cusParty["cac:PartyLegalEntity"]?.["cbc:CompanyID"] || "";
        const cusAddress = cusParty["cac:PostalAddress"]?.["cbc:StreetName"] || "";
        const cusCity = cusParty["cac:PostalAddress"]?.["cbc:CityName"] || "";

        // HEADER
        doc.fontSize(24).font('Helvetica-Bold').text('FACTURĂ FISCALĂ', { align: 'right' });
        doc.fontSize(10).font('Helvetica').text(`Seria / Numărul: ${invNumber}`, { align: 'right' });
        doc.text(`Data emiterii: ${issueDate}`, { align: 'right' });
        doc.text(`Data scadenței: ${dueDate}`, { align: 'right' });
        doc.moveDown(2);

        const startY = doc.y;

        // Supplier Box
        doc.fontSize(12).font('Helvetica-Bold').text('Furnizor', 40, startY);
        doc.fontSize(10).font('Helvetica').text(supName);
        doc.text(`CUI: ${supCUI}`);
        doc.text(`Adresă: ${supAddress}, ${supCity}`);

        // Customer Box
        doc.fontSize(12).font('Helvetica-Bold').text('Client', 300, startY);
        doc.fontSize(10).font('Helvetica').text(cusName, 300, startY + 14);
        doc.text(`CUI: ${cusCUI}`, 300, doc.y);
        doc.text(`Adresă: ${cusAddress}, ${cusCity}`, 300, doc.y);

        doc.moveDown(3);

        // TABLE
        const tableTop = Math.max(doc.y, 250);
        const itemX = 40, umX = 250, qtyX = 300, priceX = 360, valX = 430, tvaX = 490;

        doc.font('Helvetica-Bold').fontSize(9);
        doc.rect(40, tableTop - 5, 515, 20).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor('#334155');
        doc.text('Denumire produs / serviciu', itemX + 5, tableTop);
        doc.text('U.M.', umX, tableTop);
        doc.text('Cant.', qtyX, tableTop);
        doc.text('Preț Unitar', priceX, tableTop);
        doc.text('Valoare', valX, tableTop);
        doc.text('TVA', tvaX, tableTop);

        doc.moveDown();
        let y = tableTop + 25;
        doc.font('Helvetica').fillColor('#0f172a');

        let lines = invoice["cac:InvoiceLine"];
        if (!lines) lines = [];
        if (!Array.isArray(lines)) lines = [lines];

        lines.forEach((l: any, index: number) => {
          // Pagination if needed
          if (y > 750) {
            doc.addPage();
            y = 50;
          }

          const name = l["cac:Item"]?.["cbc:Name"] || l["cac:Item"]?.["cbc:Description"] || "Produs";
          const um = l["cbc:InvoicedQuantity"]?.["@_unitCode"] || "buc";
          const qty = l["cbc:InvoicedQuantity"]?.["#text"] || l["cbc:InvoicedQuantity"] || "0";
          const price = l["cac:Price"]?.["cbc:PriceAmount"]?.["#text"] || l["cac:Price"]?.["cbc:PriceAmount"] || "0";
          const val = l["cbc:LineExtensionAmount"]?.["#text"] || l["cbc:LineExtensionAmount"] || "0";
          
          const tvaNode = l["cac:TaxTotal"]?.["cac:TaxSubtotal"];
          let tvaVal = "0.00";
          if (Array.isArray(tvaNode)) {
            tvaVal = tvaNode[0]?.["cbc:TaxAmount"]?.["#text"] || "0";
          } else if (tvaNode) {
            tvaVal = tvaNode["cbc:TaxAmount"]?.["#text"] || tvaNode["cbc:TaxAmount"] || "0";
          }

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
        if (y > 700) { doc.addPage(); y = 50; }
        doc.moveDown(2);
        const totalY = y + 20;
        const legalTotal = invoice["cac:LegalMonetaryTotal"] || {};
        const taxTotal = invoice["cac:TaxTotal"] || {};
        
        let totalTaxAmt = "0.00";
        if (Array.isArray(taxTotal)) {
          totalTaxAmt = taxTotal[0]?.["cbc:TaxAmount"]?.["#text"] || "0.00";
        } else {
          totalTaxAmt = taxTotal["cbc:TaxAmount"]?.["#text"] || taxTotal["cbc:TaxAmount"] || "0.00";
        }
        
        const subTotal = legalTotal["cbc:TaxExclusiveAmount"]?.["#text"] || legalTotal["cbc:TaxExclusiveAmount"] || "0.00";
        const payable = legalTotal["cbc:PayableAmount"]?.["#text"] || legalTotal["cbc:PayableAmount"] || "0.00";

        doc.rect(340, totalY - 10, 215, 90).fillAndStroke('#f8fafc', '#e2e8f0');
        doc.fillColor('#0f172a');

        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('TOTALURI', 350, totalY);
        doc.font('Helvetica');
        doc.text(`Valoare fără TVA:`, 350, totalY + 20); doc.text(subTotal.toString(), 450, totalY + 20, { align: 'right' });
        doc.text(`TVA:`, 350, totalY + 35); doc.text(totalTaxAmt.toString(), 450, totalY + 35, { align: 'right' });
        
        doc.font('Helvetica-Bold').fontSize(12);
        doc.text(`Total de plată:`, 350, totalY + 55); 
        doc.text(`${payable.toString()} ${currency}`, 450, totalY + 55, { align: 'right' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    // Try Forge storage first
    try {
      const { storagePut } = await import("./storage");
      const result = await storagePut(`invoices/${fileNameBase}.pdf`, pdfBuffer, "application/pdf");
      console.log(`[ANAF PDF] Stored via Forge: ${result.url}`);
      return result;
    } catch (forgeErr) {
      console.log("[ANAF PDF] Forge not available, saving locally");
    }

    // Local file storage fallback
    ensureDir();
    const fileName = `${fileNameBase.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, pdfBuffer);
    
    const url = `/uploads/invoices/${fileName}`;
    console.log(`[ANAF PDF] Stored locally: ${url}`);
    return { key: fileName, url };
  } catch (error) {
    console.error("[ANAF PDF] Error converting XML to PDF locally:", error);
    return null;
  }
}
