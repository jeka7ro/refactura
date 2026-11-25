import fs from "fs";
import path from "path";
import { unitLabel } from "../shared/unitLabels";

const UPLOAD_DIR = path.resolve(process.cwd(), "dist/public/uploads/invoices");

// Ensure upload directory exists
function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function convertXmlToPdf(
  xmlText: string,
  fileNameBase: string,
  tenantId?: number
): Promise<{ key: string; url: string } | null> {
  try {
    const { XMLParser } = await import("fast-xml-parser");
    const PDFDocument = (await import("pdfkit")).default;

    const parser = new XMLParser({ numberParseOptions: { leadingZeros: false, hex: false, eNotation: false },
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

        const parseXmlNumber = (node: any, fallback = 0): number => {
          if (node === null || node === undefined) return fallback;
          if (typeof node === "number") return isNaN(node) ? fallback : node;
          if (typeof node === "object") {
            if (node["#text"] !== undefined) return parseXmlNumber(node["#text"], fallback);
            if (node["_text"] !== undefined) return parseXmlNumber(node["_text"], fallback);
            if (node["text"] !== undefined) return parseXmlNumber(node["text"], fallback);
            return fallback;
          }
          const str = String(node).trim().replace(",", ".");
          const num = parseFloat(str);
          return isNaN(num) ? fallback : num;
        };

        const invNumber = getXmlText(invoice["cbc:ID"] || invoice["ID"]);
        const issueDate = getXmlText(invoice["cbc:IssueDate"] || invoice["IssueDate"]);
        const dueDate = getXmlText(invoice["cbc:DueDate"] || invoice["DueDate"], issueDate);
        const currency = getXmlText(invoice["cbc:DocumentCurrencyCode"] || invoice["DocumentCurrencyCode"], "RON");
        const isCreditNote = Boolean(
          parsed.CreditNote ||
          parsed["ubl:CreditNote"] ||
          invoice["cbc:CreditNoteTypeCode"] ||
          invoice["CreditNoteTypeCode"] ||
          String(invoice["cbc:InvoiceTypeCode"] || invoice["InvoiceTypeCode"] || "").trim() === "381"
        );

        const firstNode = (v: any) => (Array.isArray(v) ? v[0] : v);
        const extractPartyCui = (party: any): string => {
          if (!party || typeof party !== "object") return "";
          const taxSchemes = party["cac:PartyTaxScheme"] ?? party["PartyTaxScheme"];
          const taxArr = Array.isArray(taxSchemes) ? taxSchemes : taxSchemes ? [taxSchemes] : [];
          for (const ts of taxArr) {
            const cid = getXmlText(ts?.["cbc:CompanyID"] ?? ts?.["CompanyID"]);
            if (cid) return cid;
          }
          const legalEntities = party["cac:PartyLegalEntity"] ?? party["PartyLegalEntity"];
          const legArr = Array.isArray(legalEntities) ? legalEntities : legalEntities ? [legalEntities] : [];
          for (const le of legArr) {
            const cid = getXmlText(le?.["cbc:CompanyID"] ?? le?.["CompanyID"]);
            if (cid) return cid;
          }
          return "";
        };

        // Supplier
        const supParty =
          invoice["cac:AccountingSupplierParty"]?.["cac:Party"] ||
          invoice["AccountingSupplierParty"]?.["Party"] ||
          {};
        const supLegal = firstNode(supParty["cac:PartyLegalEntity"] ?? supParty["PartyLegalEntity"]);
        const supName =
          getXmlText(firstNode(supParty["cac:PartyName"] ?? supParty["PartyName"])?.["cbc:Name"] ?? firstNode(supParty["cac:PartyName"] ?? supParty["PartyName"])?.["Name"]) ||
          getXmlText(supLegal?.["cbc:RegistrationName"] ?? supLegal?.["RegistrationName"]) ||
          "";
        const supCUI = extractPartyCui(supParty);
        const supAddress =
          getXmlText((supParty["cac:PostalAddress"] ?? supParty["PostalAddress"])?.["cbc:StreetName"] ?? (supParty["cac:PostalAddress"] ?? supParty["PostalAddress"])?.["StreetName"]) || "";
        const supCity = getXmlText((supParty["cac:PostalAddress"] ?? supParty["PostalAddress"])?.["cbc:CityName"] ?? (supParty["cac:PostalAddress"] ?? supParty["PostalAddress"])?.["CityName"]) || "";

        // Customer
        const cusParty =
          invoice["cac:AccountingCustomerParty"]?.["cac:Party"] ||
          invoice["AccountingCustomerParty"]?.["Party"] ||
          {};
        const cusLegal = firstNode(cusParty["cac:PartyLegalEntity"] ?? cusParty["PartyLegalEntity"]);
        const cusName =
          getXmlText(firstNode(cusParty["cac:PartyName"] ?? cusParty["PartyName"])?.["cbc:Name"] ?? firstNode(cusParty["cac:PartyName"] ?? cusParty["PartyName"])?.["Name"]) ||
          getXmlText(cusLegal?.["cbc:RegistrationName"] ?? cusLegal?.["RegistrationName"]) ||
          "";
        const cusCUI = extractPartyCui(cusParty);
        const cusAddress =
          getXmlText(cusParty["cac:PostalAddress"]?.["cbc:StreetName"]) || "";
        const cusCity = getXmlText(cusParty["cac:PostalAddress"]?.["cbc:CityName"]) || "";

        let lines =
          invoice["cac:InvoiceLine"] ||
          invoice["cac:CreditNoteLine"] ||
          invoice["InvoiceLine"] ||
          invoice["CreditNoteLine"] ||
          [];
        if (!Array.isArray(lines)) lines = [lines];

        const mappedLines = lines.map((l: any) => {
          const name =
            getXmlText(l["cac:Item"]?.["cbc:Name"]) ||
            getXmlText(l["cac:Item"]?.["cbc:Description"]) ||
            "Produs";
          const um = unitLabel(l["cbc:InvoicedQuantity"]?.["@_unitCode"] || l["cbc:CreditedQuantity"]?.["@_unitCode"]);
          const rawQty = parseXmlNumber(
            l["cbc:InvoicedQuantity"] ?? l["cbc:CreditedQuantity"],
            1
          );
          const price = parseXmlNumber(
            l["cac:Price"]?.["cbc:PriceAmount"],
            0
          );
          const rawVal = parseXmlNumber(
            l["cbc:LineExtensionAmount"],
            rawQty * price
          );
          const qty = isCreditNote && rawQty > 0 ? -rawQty : rawQty;
          const val = isCreditNote && rawVal > 0 ? -rawVal : rawVal;

          const tvaNode =
            l["cac:Item"]?.["cac:ClassifiedTaxCategory"] ||
            l["cac:TaxTotal"]?.["cac:TaxSubtotal"];
          const tvaNodeObj = Array.isArray(tvaNode) ? tvaNode[0] : tvaNode;
          const tvaPercent = parseXmlNumber(tvaNodeObj?.["cbc:Percent"], 0);

          return {
            description: name,
            quantity: qty,
            unitPrice: price,
            unit: um,
            vatRate: tvaPercent,
            total: val,
          };
        });

        // AllowanceCharge
        let xmlAllowances =
          invoice["cac:AllowanceCharge"] ||
          invoice["AllowanceCharge"] ||
          [];
        if (!Array.isArray(xmlAllowances)) xmlAllowances = [xmlAllowances];

        const allowanceLines = xmlAllowances.map((ac: any) => {
          const isCharge = String(
            ac["cbc:ChargeIndicator"] ?? ac["ChargeIndicator"] ?? "false"
          ).toLowerCase() === "true";

          const rawReason = getXmlText(
            ac["cbc:AllowanceChargeReason"] || ac["AllowanceChargeReason"],
            isCharge ? "Taxă suplimentară" : "Deducere / Rabat"
          );
          const reasonCode = getXmlText(
            ac["cbc:AllowanceChargeReasonCode"] || ac["AllowanceChargeReasonCode"],
            ""
          );
          const percent = ac["cbc:MultiplierFactorNumeric"] ?? ac["MultiplierFactorNumeric"];
          const amount = parseXmlNumber(ac["cbc:Amount"] ?? ac["Amount"], 0);

          let desc = rawReason;
          if (!isCharge) {
            desc = percent ? `Deducere / Rabat (${percent}%): ${rawReason}` : `Deducere / Rabat: ${rawReason}`;
          } else {
            desc = reasonCode ? `Taxă suplimentară: ${rawReason} (${reasonCode})` : `Taxă suplimentară: ${rawReason}`;
          }

          const signedAmount = isCharge ? Math.abs(amount) : -Math.abs(amount);
          return {
            description: desc,
            quantity: 1,
            unitPrice: signedAmount,
            unit: isCharge ? "serv" : "buc",
            vatRate: 0,
            total: signedAmount,
          };
        });

        const allMappedLines = [...mappedLines, ...allowanceLines];

        const legalTotal = invoice["cac:LegalMonetaryTotal"] || invoice["LegalMonetaryTotal"] || {};
        const taxTotal = invoice["cac:TaxTotal"] || invoice["TaxTotal"] || {};
        const taxTotalArr = Array.isArray(taxTotal) ? taxTotal : [taxTotal];
        const taxTotalObj =
          taxTotalArr.find((tt: any) => {
            const amtNode = tt?.["cbc:TaxAmount"] ?? tt?.["TaxAmount"];
            const curAttr = String(amtNode?.["@_currencyID"] || "").trim().toUpperCase();
            return curAttr && curAttr === currency.toUpperCase();
          }) || taxTotalArr[0];

        // Reverse charge detection
        const taxSubtotal = taxTotalObj?.["cac:TaxSubtotal"] || taxTotalObj?.["TaxSubtotal"];
        const taxSubtotalArr = Array.isArray(taxSubtotal) ? taxSubtotal : (taxSubtotal ? [taxSubtotal] : []);
        let isReverseCharge = false;
        let taxExemptionReason = "";
        for (const st of taxSubtotalArr) {
          const cat = st?.["cac:TaxCategory"] || st?.["TaxCategory"];
          const catId = String(cat?.["cbc:ID"] ?? cat?.["ID"] ?? "").trim().toUpperCase();
          const reason = String(cat?.["cbc:TaxExemptionReason"] ?? cat?.["TaxExemptionReason"] ?? "").trim();
          if (catId === "AE" || /taxare\s*invers/i.test(reason)) {
            isReverseCharge = true;
            taxExemptionReason = reason || "Taxare inversă conform art. 331 Codul Fiscal";
            break;
          }
        }

        let totalTaxAmt = parseXmlNumber(taxTotalObj?.["cbc:TaxAmount"] ?? taxTotalObj?.["TaxAmount"], 0);
        let subTotal = parseXmlNumber(
          legalTotal["cbc:TaxExclusiveAmount"] ?? legalTotal["TaxExclusiveAmount"] ?? legalTotal["cbc:LineExtensionAmount"] ?? legalTotal["LineExtensionAmount"],
          0
        );
        let payable = parseXmlNumber(
          legalTotal["cbc:TaxInclusiveAmount"] ?? legalTotal["TaxInclusiveAmount"] ?? legalTotal["cbc:PayableAmount"] ?? legalTotal["PayableAmount"],
          0
        );
        if (isCreditNote) {
          if (subTotal > 0) subTotal = -subTotal;
          if (totalTaxAmt > 0) totalTaxAmt = -totalTaxAmt;
          if (payable > 0) payable = -payable;
        }

        const data: any = {
          tenantId: tenantId && tenantId > 0 ? tenantId : undefined,
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
          isCreditNote,
          documentTitle: isCreditNote ? "FACTURĂ STORNO" : undefined,
          currency: currency,
          subtotal: subTotal,
          totalVAT: totalTaxAmt,
          total: payable,
          lines: allMappedLines,
          isReverseCharge,
          taxExemptionReason,
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

    const cleanBase = fileNameBase.replace(/[^a-zA-Z0-9_-]/g, "_");
    const scopedFileName =
      tenantId && tenantId > 0
        ? `t${tenantId}-${Date.now()}_${cleanBase}.pdf`
        : `${cleanBase}.pdf`;

    // Try Forge storage first
    try {
      const { storagePut } = await import("./storage");
      const result = await storagePut(
        `invoices/${scopedFileName}`,
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
    const fileName = scopedFileName;
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
