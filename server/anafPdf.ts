import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.resolve(process.cwd(), "dist/public/uploads/invoices");

// Ensure upload directory exists
function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function convertXmlToPdf(
  xmlText: string,
  fileNameBase: string
): Promise<{ key: string; url: string } | null> {
  try {
    const { XMLParser } = await import("fast-xml-parser");
    const PDFDocument = (await import("pdfkit")).default;

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const parsed = parser.parse(xmlText);
    const invoice = parsed.Invoice || parsed.CreditNote;

    if (!invoice) {
      console.error(
        "[ANAF PDF] Invalid XML: No Invoice or CreditNote node found"
      );
      return null;
    }

    // Wrap PDFKit in a promise to generate the buffer
    const pdfBuffer: Buffer = await new Promise(async (resolve, reject) => {
      try {
        const getXmlText = (node: any, fallback = ""): string => {
          if (node === null || node === undefined) return fallback;
          if (typeof node === "string") return node.trim() || fallback;
          if (typeof node === "number") return String(node);
          if (typeof node === "object") {
            if (node["#text"] !== undefined) return String(node["#text"]).trim() || fallback;
            if (node["_text"] !== undefined) return String(node["_text"]).trim() || fallback;
          }
          const str = String(node).trim();
          return str === "[object Object]" ? fallback : (str || fallback);
        };

        const invNumber = getXmlText(invoice["cbc:ID"]);
        const issueDate = getXmlText(invoice["cbc:IssueDate"]);
        const dueDate = getXmlText(invoice["cbc:DueDate"], issueDate);
        const currency = getXmlText(invoice["cbc:DocumentCurrencyCode"], "RON");

        // Supplier
        const supParty =
          invoice["cac:AccountingSupplierParty"]?.["cac:Party"] || {};
        const supName =
          getXmlText(supParty["cac:PartyName"]?.["cbc:Name"]) ||
          getXmlText(supParty["cac:PartyLegalEntity"]?.["cbc:RegistrationName"]) ||
          "";
        const supCUI =
          getXmlText(supParty["cac:PartyTaxScheme"]?.["cbc:CompanyID"]) ||
          getXmlText(supParty["cac:PartyLegalEntity"]?.["cbc:CompanyID"]) ||
          "";
        const supAddress =
          getXmlText(supParty["cac:PostalAddress"]?.["cbc:StreetName"]) || "";
        const supCity = getXmlText(supParty["cac:PostalAddress"]?.["cbc:CityName"]) || "";

        // Customer
        const cusParty =
          invoice["cac:AccountingCustomerParty"]?.["cac:Party"] || {};
        const cusName =
          getXmlText(cusParty["cac:PartyName"]?.["cbc:Name"]) ||
          getXmlText(cusParty["cac:PartyLegalEntity"]?.["cbc:RegistrationName"]) ||
          "";
        const cusCUI =
          getXmlText(cusParty["cac:PartyTaxScheme"]?.["cbc:CompanyID"]) ||
          getXmlText(cusParty["cac:PartyLegalEntity"]?.["cbc:CompanyID"]) ||
          "";
        const cusAddress =
          getXmlText(cusParty["cac:PostalAddress"]?.["cbc:StreetName"]) || "";
        const cusCity = getXmlText(cusParty["cac:PostalAddress"]?.["cbc:CityName"]) || "";

        let lines = invoice["cac:InvoiceLine"];
        if (!lines) lines = [];
        if (!Array.isArray(lines)) lines = [lines];

        const mappedLines = lines.map((l: any) => {
          const name =
            l["cac:Item"]?.["cbc:Name"] ||
            l["cac:Item"]?.["cbc:Description"] ||
            "Produs";
          const um = l["cbc:InvoicedQuantity"]?.["@_unitCode"] || "buc";
          const qty =
            l["cbc:InvoicedQuantity"]?.["#text"] ||
            l["cbc:InvoicedQuantity"] ||
            "0";
          const price =
            l["cac:Price"]?.["cbc:PriceAmount"]?.["#text"] ||
            l["cac:Price"]?.["cbc:PriceAmount"] ||
            "0";
          const val =
            l["cbc:LineExtensionAmount"]?.["#text"] ||
            l["cbc:LineExtensionAmount"] ||
            "0";

          const tvaNode =
            l["cac:Item"]?.["cac:ClassifiedTaxCategory"] ||
            l["cac:TaxTotal"]?.["cac:TaxSubtotal"];
          let tvaPercent = "19"; // default
          if (Array.isArray(tvaNode)) {
            tvaPercent = tvaNode[0]?.["cbc:Percent"] || "19";
          } else if (tvaNode) {
            tvaPercent = tvaNode["cbc:Percent"] || "19";
          }

          return {
            description: name,
            quantity: parseFloat(qty),
            unitPrice: parseFloat(price),
            unit: um,
            vatRate: parseFloat(tvaPercent),
            total: parseFloat(val),
          };
        });

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

        const data: any = {
          number: invNumber,
          date: issueDate,
          dueDate: dueDate,
          clientName: cusName,
          clientCUI: cusCUI,
          clientAddress: cusAddress,
          clientCity: cusCity,
          clientCounty: "",
          clientEmail: "",
          clientPhone: "",
          companyName: supName,
          companyCUI: supCUI,
          companyAddress: supAddress,
          companyCity: supCity,
          companyCounty: "",
          companyEmail: "",
          companyPhone: "",
          companyIBAN: "",
          companyBank: "",
          logoBase64: "DEFAULT_TEXT_LOGO",
          template: "classic",
          currency: currency,
          subtotal: parseFloat(subTotal),
          totalVAT: parseFloat(totalTaxAmt),
          total: parseFloat(payable),
          lines: mappedLines,
          spvIndex: (fileNameBase || "").match(/SPV_(\d+)/i)?.[1] || undefined,
        };

        const { generateReInvoicePDF } = await import("./pdf");
        const pdfStream = generateReInvoicePDF(data as any);
        const buffers: Buffer[] = [];
        pdfStream.on("data", buffers.push.bind(buffers));
        pdfStream.on("end", () => resolve(Buffer.concat(buffers)));
        pdfStream.on("error", reject);
      } catch (err) {
        reject(err);
      }
    });

    // Try Forge storage first
    try {
      const { storagePut } = await import("./storage");
      const result = await storagePut(
        `invoices/${fileNameBase}.pdf`,
        pdfBuffer,
        "application/pdf"
      );
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
