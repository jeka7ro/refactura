// Parser XML e-Factura ANAF — Folosit de server (SPV sync) și client (import XML)

export interface ParsedEfacturaLine {
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  vatRate: number;
}

export interface ParsedEfactura {
  invoiceNumber: string;
  supplierName: string;
  supplierCUI: string;
  issueDate: string;
  dueDate: string;
  total: number;
  totalVAT: number;
  currency: string;
  lines: ParsedEfacturaLine[];
  pdfUrl?: string;
}

export function parseEfacturaXML(xmlText: string): ParsedEfactura {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  const find = (names: string[]): string => {
    for (const name of names) {
      const els = doc.querySelectorAll(`*`);
      for (const el of els) {
        const tagName = el.tagName.split(":").pop() || "";
        if (tagName === name || el.tagName === name) {
          const text = el.textContent?.trim();
          if (text) return text;
        }
      }
    }
    return "";
  };

  const invoiceNumber = find(["ID", "Number", "InvoiceNumber"]);
  const issueDate = find(["IssueDate", "DocumentIssueDate", "Date"]);
  const dueDate = find(["DueDate", "DocumentDueDate"]) || issueDate;
  const currency = find(["DocumentCurrencyCode", "CurrencyCode"]) || "RON";

  let supplierName = "";
  let supplierCUI = "";
  const els = doc.querySelectorAll("*");
  for (const el of els) {
    const tag = el.tagName.split(":").pop() || "";
    if (tag === "RegistrationName" || tag === "Name") {
      if (!supplierName) supplierName = el.textContent?.trim() || "";
    }
    if (tag === "CompanyID") {
      if (!supplierCUI) supplierCUI = el.textContent?.trim() || "";
    }
  }

  let totalVAT = 0;
  let total = 0;
  for (const el of doc.querySelectorAll("*")) {
    const tag = el.tagName.split(":").pop() || "";
    const val = parseFloat(el.textContent || "0");
    if (tag === "TaxAmount") totalVAT = Math.max(totalVAT, val);
    if (tag === "PayableAmount" || tag === "DuePayableAmount") total = Math.max(total, val);
  }

  const lines: ParsedEfacturaLine[] = [];
  for (const el of doc.querySelectorAll("*")) {
    const tag = el.tagName.split(":").pop() || "";
    if (tag === "InvoiceLine") {
      const desc = find(["Name", "Description"]) || "Linie";
      const qty = parseFloat(find(["InvoicedQuantity", "Quantity"]) || "1");
      const price = parseFloat(find(["PriceAmount", "UnitPrice"]) || "0");
      const vat = parseFloat(find(["Percent", "TaxPercent"]) || "19");
      if (qty > 0 && price > 0) {
        lines.push({ description: desc, quantity: qty, unitPrice: price, unit: "buc", vatRate: vat });
      }
    }
  }

  let pdfUrl: string | undefined;
  for (const el of doc.querySelectorAll("*")) {
    for (const attr of el.attributes || []) {
      const val = attr.value || "";
      if ((val.includes("pdf") || val.includes("oblio") || val.includes("spv")) && val.includes("http")) {
        pdfUrl = val;
        break;
      }
    }
    const text = el.textContent?.trim() || "";
    if (!pdfUrl && (text.includes("pdf") || text.includes("oblio") || text.includes("spv")) && text.includes("http")) {
      pdfUrl = text;
      break;
    }
    if (pdfUrl) break;
  }

  return { invoiceNumber, supplierName, supplierCUI, issueDate, dueDate, total, totalVAT, currency, lines, pdfUrl };
}
