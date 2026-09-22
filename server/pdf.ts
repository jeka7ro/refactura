import PDFDocument from "pdfkit";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

function sanitizeData(obj: any): any {
  if (typeof obj === "string") return obj; // Removed stripDiacritics
  if (Array.isArray(obj)) return obj.map(sanitizeData);
  if (obj !== null && typeof obj === "object") {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      if (key === "logoBase64") {
        res[key] = obj[key];
      } else {
        res[key] = sanitizeData(obj[key]);
      }
    }
    return res;
  }
  return obj;
}

export type InvoiceTemplate = "classic" | "modern" | "minimal";

export interface ReInvoiceData {
  number: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientCUI: string;
  clientAddress: string;
  clientCity: string;
  clientCounty: string;
  clientCountry?: string;
  clientEmail: string;
  clientPhone: string;
  companyName: string;
  companyCUI: string;
  companyAddress: string;
  companyCity: string;
  companyCounty: string;
  companyCountry?: string;
  companyEmail: string;
  companyPhone: string;
  companyIBAN: string;
  companyBank: string;
  logoBase64?: string;
  template?: InvoiceTemplate;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    unit: string;
    vatRate: number;
    total: number;
  }>;
  subtotal: number;
  totalVAT: number;
  total: number;
  currency: string;
  notes?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isBilingualInvoice(data: ReInvoiceData): boolean {
  const country = (data.clientCountry || "").trim().toUpperCase();
  if (country && country !== "RO") return true;
  const cui = (data.clientCUI || "").trim().toUpperCase();
  if (cui && !cui.startsWith("RO") && /^[A-Z]{2}/.test(cui)) return true;
  return false;
}

export function formatPdfDate(dateInput: any): string {
  if (!dateInput) return "";
  if (typeof dateInput === "object" && dateInput["#text"]) {
    dateInput = dateInput["#text"];
  }
  const str = String(dateInput).trim();
  if (!str || str === "[object Object]") return "";
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("ro-RO");
    }
  } catch {}
  return str;
}

export function formatPdfNumber(numInput: any): string {
  if (!numInput) return "";
  if (typeof numInput === "object" && numInput["#text"]) {
    return String(numInput["#text"]).trim();
  }
  const str = String(numInput).trim();
  return str === "[object Object]" ? "" : str;
}

function getLabels(isBilingual: boolean) {
  if (!isBilingual) {
    return {
      title: "Factura",
      titleUpper: "FACTURĂ",
      issueDate: "Data emiterii:",
      dueDate: "Termen plata:",
      supplier: "Furnizor:",
      supplierUpper: "EMITENT",
      customer: "Client:",
      customerUpper: "CLIENT",
      cif: "CIF:",
      address: "Adresa:",
      iban: "IBAN",
      bank: "Banca:",
      phone: "Tel.:",
      email: "Email:",
      from: "DE LA",
      to: "CĂTRE",
      number: "Nr.",
      description: "Denumire produse / servicii",
      descriptionUpper: "DESCRIERE",
      unit: "UM",
      qty: "Cantitate",
      qtyShort: "CANT.",
      price: "Preț unitar",
      priceShort: "PREȚ/U",
      val: "Valoare",
      vat: "Valoare TVA",
      vatUpper: "TVA",
      total: "TOTAL",
      subtotal: "Total fără TVA:",
      subtotalAlt: "Subtotal (fără TVA):",
      totalVat: "Total TVA:",
      totalDue: "TOTAL DE PLATĂ:",
      notes: "Observații:",
      notesUpper: "OBSERVAȚII:",
    };
  }
  return {
    title: "Factură / Invoice",
    titleUpper: "FACTURĂ / INVOICE",
    issueDate: "Data emiterii / Issue date:",
    dueDate: "Termen plată / Due date:",
    supplier: "Furnizor / Supplier:",
    supplierUpper: "EMITENT / SUPPLIER",
    customer: "Client / Customer:",
    customerUpper: "CLIENT / CUSTOMER",
    cif: "CIF / VAT ID:",
    address: "Adresă / Address:",
    iban: "IBAN",
    bank: "Bancă / Bank:",
    phone: "Tel. / Phone:",
    email: "Email:",
    from: "DE LA / FROM",
    to: "CĂTRE / TO",
    number: "Nr. / No.",
    description: "Denumire / Description",
    descriptionUpper: "DESCRIERE / DESCRIPTION",
    unit: "UM / Unit",
    qty: "Cantitate / Qty",
    qtyShort: "CANT. / QTY",
    price: "Preț unitar / Unit price",
    priceShort: "PREȚ / PRICE",
    val: "Valoare / Amount",
    vat: "Valoare TVA / VAT",
    vatUpper: "TVA / VAT",
    total: "TOTAL",
    subtotal: "Total fără TVA / Subtotal:",
    subtotalAlt: "Subtotal (excl. VAT):",
    totalVat: "Total TVA / Total VAT:",
    totalDue: "TOTAL DE PLATĂ / TOTAL DUE:",
    notes: "Observații / Notes:",
    notesUpper: "OBSERVAȚII / NOTES:",
  };
}

function drawLogo(
  doc: PDFKit.PDFDocument,
  logoBase64: string,
  x: number,
  y: number,
  w = 115,
  h = 34
) {
  if (!logoBase64 || logoBase64 === "DEFAULT_TEXT_LOGO") {
    return;
  }

  // Card elegant cu fundal întunecat și colțuri rotunjite pentru contrast impecabil
  const cardR = 7;
  doc.save();
  doc.fillColor("#0f172a");
  doc.roundedRect(x, y, w, h, cardR).fill();
  doc.restore();

  const padX = 7;
  const padY = 4;
  const imgW = w - padX * 2;
  const imgH = h - padY * 2;

  try {
    const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, "base64");
    doc.image(imgBuffer, x + padX, y + padY, {
      fit: [imgW, imgH],
      align: "center",
      valign: "center",
    });
  } catch (_) {
    /* ignoră logo invalid */
  }
}

function drawTableRows(
  doc: PDFKit.PDFDocument,
  data: ReInvoiceData,
  startY: number,
  leftX: number,
  pageWidth: number,
  rowBg: string | null,
  altBg: string | null
) {
  const colWidths = { desc: 210, qty: 55, price: 85, vat: 45, total: 85 };
  let y = startY;

  data.lines.forEach((line, idx) => {
    const rowH = 30;
    if (y + rowH > doc.page.height - 60) {
      doc.addPage();
      y = 50;
    }

    if (rowBg) {
      doc
        .rect(leftX, y, pageWidth, rowH)
        .fillColor(idx % 2 === 0 ? rowBg : (altBg ?? rowBg))
        .fill();
    }
    doc
      .rect(leftX, y, pageWidth, rowH)
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .stroke();

    doc.fillColor("#1e293b").fontSize(9).font("Roboto");
    doc.text(line.description, leftX + 5, y + 9, {
      width: colWidths.desc - 8,
      height: rowH - 8,
    });
    doc.text(line.quantity.toString(), leftX + colWidths.desc, y + 9, {
      width: colWidths.qty - 4,
      align: "right",
    });
    doc.text(
      `${line.unitPrice.toFixed(2)} ${data.currency}`,
      leftX + colWidths.desc + colWidths.qty,
      y + 9,
      { width: colWidths.price - 4, align: "right" }
    );
    doc.text(
      `${line.vatRate}%`,
      leftX + colWidths.desc + colWidths.qty + colWidths.price,
      y + 9,
      { width: colWidths.vat - 4, align: "right" }
    );
    doc.text(
      `${line.total.toFixed(2)} ${data.currency}`,
      leftX + colWidths.desc + colWidths.qty + colWidths.price + colWidths.vat,
      y + 9,
      { width: colWidths.total - 4, align: "right" }
    );
    y += rowH;
  });

  return y;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  data: ReInvoiceData,
  afterY: number,
  leftX: number,
  pageWidth: number,
  accentColor: string
) {
  const isBilingual = isBilingualInvoice(data);
  const L = getLabels(isBilingual);
  const totW = isBilingual ? 260 : 220;
  const totX = leftX + pageWidth - totW;
  const labelW = isBilingual ? 160 : 130;
  const valW = totW - labelW;
  let y = afterY + 12;

  doc.fontSize(9).font("Roboto").fillColor("#64748b");
  doc.text(L.subtotalAlt, totX, y, { width: labelW });
  doc.text(`${data.subtotal.toFixed(2)} ${data.currency}`, totX + labelW, y, {
    width: valW,
    align: "right",
  });
  y += 16;
  doc.text(L.totalVat, totX, y, { width: labelW });
  doc.text(`${data.totalVAT.toFixed(2)} ${data.currency}`, totX + labelW, y, {
    width: valW,
    align: "right",
  });
  y += 20;

  const totalDueBlue = accentColor || "#0088fe";
  doc.save();
  doc.fillColor(totalDueBlue);
  doc.roundedRect(totX - 4, y - 4, totW + 4, 28, 6).fill();
  doc.restore();

  doc.fontSize(isBilingual ? 9.5 : 11).font("Roboto-Bold").fillColor("#ffffff");
  doc.text(L.totalDue, totX + 4, y + 6, { width: labelW });
  doc.text(`${data.total.toFixed(2)} ${data.currency}`, totX + labelW, y + 6, {
    width: valW - 8,
    align: "right",
  });
  doc.fillColor("#1e293b");
  return y + 34;
}

function generateClassic(doc: PDFKit.PDFDocument, data: ReInvoiceData) {
  const leftX = 40;
  const pageWidth = doc.page.width - 80;
  let y = 40;

  const isBilingual = isBilingualInvoice(data);
  const L = getLabels(isBilingual);

  // Logo
  if (data.logoBase64) {
    drawLogo(doc, data.logoBase64, leftX, y, 115, 34);
  }

  // Header: Left "Factura", Right "Seria și numărul"
  doc
    .fontSize(isBilingual ? 18 : 24)
    .font("Roboto-Bold")
    .fillColor("#000000")
    .text(L.title, leftX + (data.logoBase64 && data.logoBase64 !== "DEFAULT_TEXT_LOGO" ? (isBilingual ? 130 : 180) : 0), y + 5);

  const rightColW = isBilingual ? 215 : 180;
  const rightColX = leftX + pageWidth - rightColW;
  doc
    .fontSize(16)
    .font("Roboto-Bold")
    .text(formatPdfNumber(data.number), rightColX, y, { width: rightColW, align: "right" });

  y += 30;
  const metaLabelW = isBilingual ? 120 : 80;
  const metaValW = rightColW - metaLabelW;
  doc.fontSize(8.5).font("Roboto-Bold");
  doc.text(L.issueDate, rightColX, y, { width: metaLabelW });
  doc
    .font("Roboto")
    .text(formatPdfDate(data.date), rightColX + metaLabelW, y, {
      width: metaValW,
      align: "right",
    });

  y += 14;
  doc.font("Roboto-Bold").text(L.dueDate, rightColX, y, { width: metaLabelW });
  doc
    .font("Roboto")
    .text(
      formatPdfDate(data.dueDate),
      rightColX + metaLabelW,
      y,
      { width: metaValW, align: "right" }
    );

  y += 30;
  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .strokeColor("#000000")
    .lineWidth(1)
    .stroke();
  y += 15;

  // Furnizor / Client columns
  const colW = pageWidth / 2 - 20;

  // Furnizor Column
  doc.fontSize(9).font("Roboto-Bold").text(L.supplier, leftX, y);
  doc.fontSize(11).text(data.companyName, leftX, y + 12, { width: colW });

  let leftInfoY = y + 30;
  const addInfo = (label: string, val: string, x: number, currY: number, alignRight = false) => {
    if (!val) return currY;
    if (alignRight) {
      const fullText = `${label} ${val}`;
      doc.fontSize(8).font("Roboto").text(fullText, x, currY, { width: colW, align: "right" });
      const textHeight = doc.heightOfString(fullText, { width: colW });
      return currY + Math.max(12, textHeight + 2);
    } else {
      const labelW = isBilingual ? 85 : 60;
      doc.fontSize(8).font("Roboto-Bold").text(label, x, currY, { width: labelW });
      const textHeight = doc.font("Roboto").heightOfString(val, { width: colW - labelW });
      doc.text(val, x + labelW, currY, { width: colW - labelW });
      return currY + Math.max(12, textHeight + 2);
    }
  };

  const formatAddr = (address?: string, city?: string, county?: string, country?: string) => {
    return [address, city, county, country]
      .map(s => (s || "").trim().replace(/,+$/, ""))
      .filter(Boolean)
      .join(", ");
  };

  leftInfoY = addInfo(L.cif, data.companyCUI, leftX, leftInfoY);
  leftInfoY = addInfo(
    L.address,
    formatAddr(data.companyAddress, data.companyCity, data.companyCounty, data.companyCountry),
    leftX,
    leftInfoY
  );
  const ibanLabel = data.currency ? `IBAN (${data.currency}):` : "IBAN:";
  leftInfoY = addInfo(ibanLabel, data.companyIBAN, leftX, leftInfoY);
  leftInfoY = addInfo(L.bank, data.companyBank, leftX, leftInfoY);
  leftInfoY = addInfo(L.phone, data.companyPhone, leftX, leftInfoY);
  leftInfoY = addInfo(L.email, data.companyEmail, leftX, leftInfoY);

  // Client Column
  doc
    .fontSize(9)
    .font("Roboto-Bold")
    .text(L.customer, leftX + colW + 20, y, { width: colW, align: "right" });
  doc
    .fontSize(11)
    .text(data.clientName, leftX + colW + 20, y + 12, { width: colW, align: "right" });

  let rightInfoY = y + 30;
  rightInfoY = addInfo(L.cif, data.clientCUI, leftX + colW + 20, rightInfoY, true);
  rightInfoY = addInfo(
    L.address,
    formatAddr(data.clientAddress, data.clientCity, data.clientCounty, data.clientCountry),
    leftX + colW + 20,
    rightInfoY,
    true
  );
  rightInfoY = addInfo(
    L.phone,
    data.clientPhone,
    leftX + colW + 20,
    rightInfoY,
    true
  );
  rightInfoY = addInfo(
    L.email,
    data.clientEmail,
    leftX + colW + 20,
    rightInfoY,
    true
  );

  y = Math.max(leftInfoY, rightInfoY) + 20;

  // Table header
  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .lineWidth(1.5)
    .stroke();
  y += 6;

  const colWidths = isBilingual
    ? {
        crt: 25,
        desc: 180,
        um: 35,
        qty: 50,
        price: 75,
        val: 75,
        vat: 75,
      }
    : {
        crt: 30,
        desc: 180,
        um: 30,
        qty: 50,
        price: 70,
        val: 70,
        vat: 85,
      };

  let curX = leftX;

  if (isBilingual) {
    // Rândul 1: Română (Bold, negru)
    doc.fontSize(7.5).font("Roboto-Bold").fillColor("#000000");
    curX = leftX;
    doc.text("Nr. crt.", curX, y, { width: colWidths.crt });
    curX += colWidths.crt;
    doc.text("Denumire produse / servicii", curX, y, { width: colWidths.desc });
    curX += colWidths.desc;
    doc.text("U.M.", curX, y, { width: colWidths.um, align: "center" });
    curX += colWidths.um;
    doc.text("Cantitate", curX, y, { width: colWidths.qty, align: "center" });
    curX += colWidths.qty;
    doc.text("Preț unitar", curX, y, { width: colWidths.price, align: "right" });
    curX += colWidths.price;
    doc.text("Valoare", curX, y, { width: colWidths.val, align: "right" });
    curX += colWidths.val;
    doc.text("Valoare TVA", curX, y, { width: colWidths.vat, align: "right" });

    // Rândul 2: Engleză (Regular, gri)
    doc.fontSize(6.5).font("Roboto").fillColor("#64748b");
    curX = leftX;
    doc.text("No.", curX, y + 9, { width: colWidths.crt });
    curX += colWidths.crt;
    doc.text("Description of goods / services", curX, y + 9, { width: colWidths.desc });
    curX += colWidths.desc;
    doc.text("Unit", curX, y + 9, { width: colWidths.um, align: "center" });
    curX += colWidths.um;
    doc.text("Quantity", curX, y + 9, { width: colWidths.qty, align: "center" });
    curX += colWidths.qty;
    doc.text("Unit price", curX, y + 9, { width: colWidths.price, align: "right" });
    curX += colWidths.price;
    doc.text("Amount", curX, y + 9, { width: colWidths.val, align: "right" });
    curX += colWidths.val;
    doc.text("VAT amount", curX, y + 9, { width: colWidths.vat, align: "right" });

    y += 21;
    doc.fillColor("#000000");
  } else {
    doc.fontSize(8).font("Roboto-Bold").fillColor("#000000");
    curX = leftX;
    doc.text("Nr.", curX, y, { width: colWidths.crt });
    curX += colWidths.crt;
    doc.text("Denumire produse / servicii", curX, y, { width: colWidths.desc });
    curX += colWidths.desc;
    doc.text("UM", curX, y, { width: colWidths.um, align: "center" });
    curX += colWidths.um;
    doc.text("Cantitate", curX, y, { width: colWidths.qty, align: "center" });
    curX += colWidths.qty;
    doc.text("Preț unitar", curX, y, { width: colWidths.price, align: "right" });
    curX += colWidths.price;
    doc.text("Valoare", curX, y, { width: colWidths.val, align: "right" });
    curX += colWidths.val;
    doc.text("Valoare TVA", curX, y, { width: colWidths.vat, align: "right" });

    y += 14;
  }

  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .lineWidth(1.5)
    .stroke();
  y += 8;

  // Table rows
  doc.font("Roboto").fontSize(8);
  data.lines.forEach((line, idx) => {
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 50;
    }

    curX = leftX;
    const rowH =
      doc.heightOfString(line.description, { width: colWidths.desc }) + 5;

    const lineVal = line.quantity * line.unitPrice;
    const lineVat = (lineVal * (line.vatRate || 0)) / 100;

    doc.text((idx + 1).toString(), curX, y, { width: colWidths.crt });
    curX += colWidths.crt;
    doc.text(line.description, curX, y, { width: colWidths.desc });
    curX += colWidths.desc;
    doc.text(line.unit, curX, y, { width: colWidths.um, align: "center" });
    curX += colWidths.um;
    doc.text(line.quantity.toString(), curX, y, {
      width: colWidths.qty,
      align: "center",
    });
    curX += colWidths.qty;
    doc.text(line.unitPrice.toFixed(2), curX, y, {
      width: colWidths.price,
      align: "right",
    });
    curX += colWidths.price;
    doc.text(lineVal.toFixed(2), curX, y, {
      width: colWidths.val,
      align: "right",
    });
    curX += colWidths.val;
    doc.text(lineVat.toFixed(2), curX, y, {
      width: colWidths.vat,
      align: "right",
    });

    y += Math.max(rowH, 15);
  });

  y += 10;
  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .lineWidth(1)
    .strokeColor("#cccccc")
    .stroke();
  y += 10;

  // Footer Totals
  const totW = isBilingual ? 260 : 200;
  const totX = leftX + pageWidth - totW;
  const labelW = isBilingual ? 160 : 100;
  const valW = totW - labelW;

  doc.font("Roboto-Bold").fontSize(9);
  doc.text(L.subtotal, totX, y, { width: labelW });
  doc
    .font("Roboto")
    .text(`${data.subtotal.toFixed(2)} ${data.currency}`, totX + labelW, y, {
      width: valW,
      align: "right",
    });
  y += 15;

  doc.font("Roboto-Bold").text(L.totalVat, totX, y, { width: labelW });
  doc
    .font("Roboto")
    .text(`${data.totalVAT.toFixed(2)} ${data.currency}`, totX + labelW, y, {
      width: valW,
      align: "right",
    });
  y += 15;

  const totalDueBg = "#0088fe";
  doc.save();
  doc.fillColor(totalDueBg);
  doc.roundedRect(totX, y, totW, 26, 6).fill();
  doc.restore();

  doc.fillColor("#ffffff").font("Roboto-Bold").fontSize(isBilingual ? 9.5 : 11);
  doc.text(L.totalDue, totX + 8, y + 7, { width: labelW });
  doc.text(`${data.total.toFixed(2)} ${data.currency}`, totX + labelW, y + 7, {
    width: valW - 8,
    align: "right",
  });
  doc.fillColor("#000000");

  if (data.notes) {
    doc
      .fontSize(8)
      .font("Roboto-Bold")
      .text(L.notes, leftX, y + 35);
    doc.font("Roboto").text(data.notes, leftX, y + 47, { width: pageWidth });
  }

  const footerY = doc.page.height - 30;
  const now = new Date();
  doc
    .fontSize(7.5)
    .font("Roboto")
    .fillColor("#cbd5e1")
    .text(
      `Grup și Echipă de Producție Aplicație: GettsApp • www.refactura.ro • ${now.toLocaleDateString("ro-RO")}`,
      leftX,
      footerY,
      { width: pageWidth, align: "center" }
    );
}

// ─── TEMPLATE 2: MODERN ──────────────────────────────────────────────────────
// Header colorat (albastru navy), logo stânga, număr factură în bloc color

function generateModern(doc: PDFKit.PDFDocument, data: ReInvoiceData) {
  const leftX = 40;
  const pageWidth = doc.page.width - 80;
  const accentBlue = "#2563eb";
  const now = new Date();

  const isBilingual = isBilingualInvoice(data);
  const L = getLabels(isBilingual);

  // Header band
  doc.rect(0, 0, doc.page.width, 90).fillColor("#0f172a").fill();

  if (data.logoBase64) {
    drawLogo(doc, data.logoBase64, leftX, 18, 90, 54);
  }

  // Company name top-left
  doc
    .fontSize(11)
    .font("Roboto-Bold")
    .fillColor("#ffffff")
    .text(data.companyName, leftX + (data.logoBase64 ? 105 : 0), 26);
  doc
    .fontSize(8)
    .font("Roboto")
    .fillColor("#94a3b8")
    .text(
      `CUI: ${data.companyCUI}  |  ${data.companyEmail}`,
      leftX + (data.logoBase64 ? 105 : 0),
      41
    );

  // Invoice badge top-right
  doc
    .rect(doc.page.width - 190, 18, 150, 54)
    .fillColor(accentBlue)
    .fill();
  doc
    .fontSize(isBilingual ? 11 : 14)
    .font("Roboto-Bold")
    .fillColor("#ffffff")
    .text(isBilingual ? "FACTURĂ / INVOICE" : "FACTURĂ", doc.page.width - 185, 26, {
      width: 140,
      align: "center",
    });
  doc
    .fontSize(9)
    .font("Roboto")
    .fillColor("#bfdbfe")
    .text(`Nr. ${data.number}`, doc.page.width - 185, 44, {
      width: 140,
      align: "center",
    });
  doc
    .fontSize(8)
    .font("Roboto")
    .fillColor("#bfdbfe")
    .text(
      formatPdfDate(data.date),
      doc.page.width - 185,
      57,
      { width: 140, align: "center" }
    );

  // Dates row
  let y = 105;
  doc
    .fontSize(8)
    .font("Roboto-Bold")
    .fillColor("#64748b")
    .text(isBilingual ? "DATA EMITERII / ISSUE" : "DATA EMITERII", leftX, y)
    .text(isBilingual ? "SCADENȚĂ / DUE" : "SCADENȚĂ", leftX + 160, y);
  y += 12;
  doc
    .fontSize(10)
    .font("Roboto-Bold")
    .fillColor("#1e293b")
    .text(formatPdfDate(data.date), leftX, y)
    .text(formatPdfDate(data.dueDate), leftX + 160, y);

  // Emitent / Client cards
  y += 28;
  [
    { label: isBilingual ? "EMITENT / SUPPLIER" : "EMITENT", x: leftX },
    { label: isBilingual ? "CLIENT / CUSTOMER" : "CLIENT", x: leftX + pageWidth / 2 + 8 },
  ].forEach((col, idx) => {
    const isClient = idx === 1;
    const name = isClient ? data.clientName : data.companyName;
    const cui = isClient ? data.clientCUI : data.companyCUI;
    const addr = isClient
      ? [data.clientAddress, data.clientCity, data.clientCounty, data.clientCountry]
          .map(s => (s || "").trim().replace(/,+$/, ""))
          .filter(Boolean)
          .join(", ")
      : [data.companyAddress, data.companyCity, data.companyCounty, data.companyCountry]
          .map(s => (s || "").trim().replace(/,+$/, ""))
          .filter(Boolean)
          .join(", ");
    const contact = isClient
      ? `${data.clientPhone} | ${data.clientEmail}`
      : `${data.companyPhone} | ${data.companyEmail}`;
    const banking = isClient
      ? ""
      : `IBAN: ${data.companyIBAN} | ${data.companyBank}`;

    doc
      .rect(col.x, y, pageWidth / 2 - 8, 75)
      .fillColor("#f1f5f9")
      .fill();
    doc.rect(col.x, y, 3, 75).fillColor(accentBlue).fill();
    doc
      .fontSize(7.5)
      .font("Roboto-Bold")
      .fillColor("#64748b")
      .text(col.label, col.x + 10, y + 8);
    doc
      .fontSize(9.5)
      .font("Roboto-Bold")
      .fillColor("#0f172a")
      .text(name, col.x + 10, y + 20, { width: pageWidth / 2 - 22 });
    doc
      .fontSize(8)
      .font("Roboto")
      .fillColor("#475569")
      .text(`${L.cif} ${cui}`, col.x + 10, y + 36);
    doc.text(addr, col.x + 10, y + 48, { width: pageWidth / 2 - 22 });
    if (banking)
      doc.text(banking, col.x + 10, y + 60, { width: pageWidth / 2 - 22 });
    else doc.text(contact, col.x + 10, y + 60, { width: pageWidth / 2 - 22 });
  });

  y += 85;

  // Table header
  const colWidths = { desc: 210, qty: 55, price: 85, vat: 45, total: 85 };
  doc.rect(leftX, y, pageWidth, 22).fillColor(accentBlue).fill();
  doc.fontSize(8).font("Roboto-Bold").fillColor("#ffffff");
  doc.text(isBilingual ? "DESCRIERE / DESCRIPTION" : "DESCRIERE", leftX + 5, y + 6, { width: colWidths.desc - 8 });
  doc.text(isBilingual ? "CANT./QTY" : "CANT.", leftX + colWidths.desc, y + 6, {
    width: colWidths.qty - 4,
    align: "right",
  });
  doc.text(isBilingual ? "PREȚ / UNIT" : "PREȚ/U", leftX + colWidths.desc + colWidths.qty, y + 6, {
    width: colWidths.price - 4,
    align: "right",
  });
  doc.text(
    isBilingual ? "TVA/VAT" : "TVA",
    leftX + colWidths.desc + colWidths.qty + colWidths.price,
    y + 6,
    { width: colWidths.vat - 4, align: "right" }
  );
  doc.text(
    "TOTAL",
    leftX + colWidths.desc + colWidths.qty + colWidths.price + colWidths.vat,
    y + 6,
    { width: colWidths.total - 4, align: "right" }
  );
  y += 22;

  y = drawTableRows(doc, data, y, leftX, pageWidth, "#f8fafc", "#ffffff");
  y = drawTotals(doc, data, y, leftX, pageWidth, accentBlue);

  if (data.notes) {
    y += 10;
    doc
      .fontSize(8.5)
      .font("Roboto-Bold")
      .fillColor("#64748b")
      .text(L.notesUpper, leftX, y);
    doc
      .fontSize(8.5)
      .font("Roboto")
      .fillColor("#1e293b")
      .text(data.notes, leftX, y + 12, { width: pageWidth });
  }

  const footerY = doc.page.height - 35;
  doc
    .rect(0, footerY - 8, doc.page.width, 45)
    .fillColor("#0f172a")
    .fill();
  doc
    .fontSize(7.5)
    .font("Roboto")
    .fillColor("#94a3b8")
    .text(
      `Grup și Echipă de Producție Aplicație: GettsApp • www.refactura.ro • Generat automat • ${now.toLocaleDateString("ro-RO")} ${now.toLocaleTimeString("ro-RO")}`,
      0,
      footerY + 2,
      { align: "center", width: doc.page.width }
    );
}

// ─── TEMPLATE 3: MINIMAL ─────────────────────────────────────────────────────
// Design curat, fără borduri grele. Linii subtile, spațiere generoasă

function generateMinimal(doc: PDFKit.PDFDocument, data: ReInvoiceData) {
  const leftX = 50;
  const pageWidth = doc.page.width - 100;
  const now = new Date();
  const accentGreen = "#059669";

  const isBilingual = isBilingualInvoice(data);
  const L = getLabels(isBilingual);

  let y = 50;

  if (data.logoBase64) {
    drawLogo(doc, data.logoBase64, leftX, y, 90, 45);
    y += 60;
  }

  // Title left-aligned
  doc
    .fontSize(isBilingual ? 22 : 28)
    .font("Roboto-Bold")
    .fillColor("#0f172a")
    .text(L.title, leftX, y);
  doc
    .moveTo(leftX, y + (isBilingual ? 32 : 38))
    .lineTo(leftX + 60, y + (isBilingual ? 32 : 38))
    .strokeColor(accentGreen)
    .lineWidth(3)
    .stroke();
  y += 55;

  // Metadata pills
  doc.fontSize(9).font("Roboto").fillColor("#64748b");
  doc.text(`${L.number} ${formatPdfNumber(data.number)}`, leftX, y);
  doc.text(
    `${isBilingual ? "Date:" : "Emisă:"} ${formatPdfDate(data.date)}`,
    leftX + 120,
    y
  );
  doc.text(
    `${isBilingual ? "Due:" : "Scadentă:"} ${formatPdfDate(data.dueDate)}`,
    leftX + 260,
    y
  );
  y += 30;

  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .strokeColor("#e2e8f0")
    .lineWidth(0.5)
    .stroke();
  y += 16;

  // Emitent / Client compact
  doc
    .fontSize(8)
    .font("Roboto-Bold")
    .fillColor("#94a3b8")
    .text(L.from, leftX, y)
    .text(L.to, leftX + pageWidth / 2, y);
  y += 12;
  doc
    .fontSize(10)
    .font("Roboto-Bold")
    .fillColor("#0f172a")
    .text(data.companyName, leftX, y, { width: pageWidth / 2 - 20 });
  doc.text(data.clientName, leftX + pageWidth / 2, y, { width: pageWidth / 2 });
  y += 15;
  doc.fontSize(8.5).font("Roboto").fillColor("#475569");
  doc
    .text(`${L.cif} ${data.companyCUI}`, leftX, y)
    .text(`${L.cif} ${data.clientCUI}`, leftX + pageWidth / 2, y);
  y += 12;
  const minCompAddr = [data.companyAddress, data.companyCity, data.companyCounty, data.companyCountry]
    .map(s => (s || "").trim().replace(/,+$/, ""))
    .filter(Boolean)
    .join(", ");
  const minCliAddr = [data.clientAddress, data.clientCity, data.clientCounty, data.clientCountry]
    .map(s => (s || "").trim().replace(/,+$/, ""))
    .filter(Boolean)
    .join(", ");
  doc
    .text(minCompAddr, leftX, y, { width: pageWidth / 2 - 20 })
    .text(minCliAddr, leftX + pageWidth / 2, y, {
      width: pageWidth / 2,
    });
  y += 12;
  if (data.companyIBAN)
    doc.text(`IBAN: ${data.companyIBAN}`, leftX, y, {
      width: pageWidth / 2 - 20,
    });
  y += 20;

  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .strokeColor("#e2e8f0")
    .lineWidth(0.5)
    .stroke();
  y += 16;

  // Table — minimal, no box, just subtle lines
  const colWidths = { desc: 210, qty: 55, price: 85, vat: 45, total: 85 };
  doc.fontSize(8).font("Roboto-Bold").fillColor("#94a3b8");
  doc.text(isBilingual ? "DESCRIERE / DESCRIPTION" : "DESCRIERE", leftX, y, { width: colWidths.desc });
  doc.text(isBilingual ? "CANT./QTY" : "CANT.", leftX + colWidths.desc, y, {
    width: colWidths.qty,
    align: "right",
  });
  doc.text(isBilingual ? "PREȚ / UNIT" : "PREȚ/U", leftX + colWidths.desc + colWidths.qty, y, {
    width: colWidths.price,
    align: "right",
  });
  doc.text(isBilingual ? "TVA/VAT" : "TVA", leftX + colWidths.desc + colWidths.qty + colWidths.price, y, {
    width: colWidths.vat,
    align: "right",
  });
  doc.text(
    "TOTAL",
    leftX + colWidths.desc + colWidths.qty + colWidths.price + colWidths.vat,
    y,
    { width: colWidths.total, align: "right" }
  );
  y += 16;
  doc
    .moveTo(leftX, y)
    .lineTo(leftX + pageWidth, y)
    .strokeColor("#e2e8f0")
    .lineWidth(0.5)
    .stroke();
  y += 8;

  data.lines.forEach((line, idx) => {
    if (y + 25 > doc.page.height - 80) {
      doc.addPage();
      y = 50;
    }
    if (idx % 2 === 0) {
      doc
        .rect(leftX - 6, y - 3, pageWidth + 12, 23)
        .fillColor("#f8fafc")
        .fill();
    }
    const lineVal = line.quantity * line.unitPrice;
    const lineVat = (lineVal * (line.vatRate || 0)) / 100;
    const lineTotal = lineVal + lineVat;

    doc.fontSize(9).font("Roboto").fillColor("#1e293b");
    doc.text(line.description, leftX, y + 3, { width: colWidths.desc - 8 });
    doc.text(String(line.quantity), leftX + colWidths.desc, y + 3, {
      width: colWidths.qty - 4,
      align: "right",
    });
    doc.text(
      `${line.unitPrice.toFixed(2)} ${data.currency}`,
      leftX + colWidths.desc + colWidths.qty,
      y + 3,
      { width: colWidths.price - 4, align: "right" }
    );
    doc.text(
      `${line.vatRate}%`,
      leftX + colWidths.desc + colWidths.qty + colWidths.price,
      y + 3,
      { width: colWidths.vat - 4, align: "right" }
    );
    doc.text(
      `${lineTotal.toFixed(2)} ${data.currency}`,
      leftX + colWidths.desc + colWidths.qty + colWidths.price + colWidths.vat,
      y + 3,
      { width: colWidths.total - 4, align: "right" }
    );
    y += 24;
  });

  doc
    .moveTo(leftX, y + 4)
    .lineTo(leftX + pageWidth, y + 4)
    .strokeColor("#e2e8f0")
    .lineWidth(0.5)
    .stroke();
  y += 18;

  // Totals right-aligned, minimal
  const totW = isBilingual ? 260 : 220;
  const totX = leftX + pageWidth - totW;
  const labelW = isBilingual ? 160 : 130;
  const valW = totW - labelW;

  doc.fontSize(9).font("Roboto").fillColor("#64748b");
  doc
    .text(L.subtotalAlt, totX, y, { width: labelW })
    .text(`${data.subtotal.toFixed(2)} ${data.currency}`, totX + labelW, y, {
      width: valW,
      align: "right",
    });
  y += 16;
  doc
    .text(L.totalVat, totX, y, { width: labelW })
    .text(`${data.totalVAT.toFixed(2)} ${data.currency}`, totX + labelW, y, {
      width: valW,
      align: "right",
    });
  y += 16;
  doc
    .moveTo(totX, y)
    .lineTo(totX + totW, y)
    .strokeColor(accentGreen)
    .lineWidth(1.5)
    .stroke();
  y += 10;
  doc.fontSize(isBilingual ? 11 : 13).font("Roboto-Bold").fillColor("#0f172a");
  doc
    .text(L.totalDue, totX, y, { width: labelW })
    .text(`${data.total.toFixed(2)} ${data.currency}`, totX + labelW, y, {
      width: valW,
      align: "right",
    });

  if (data.notes) {
    y += 35;
    doc
      .fontSize(8.5)
      .font("Roboto-Bold")
      .fillColor("#94a3b8")
      .text(L.notesUpper, leftX, y);
    y += 12;
    doc
      .fontSize(8.5)
      .font("Roboto")
      .fillColor("#475569")
      .text(data.notes, leftX, y, { width: pageWidth });
  }

  const footerY = doc.page.height - 30;
  doc
    .fontSize(7.5)
    .font("Roboto")
    .fillColor("#cbd5e1")
    .text(
      `Grup și Echipă de Producție Aplicație: GettsApp • www.refactura.ro • ${now.toLocaleDateString("ro-RO")}`,
      leftX,
      footerY,
      { width: pageWidth, align: "center" }
    );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function generateReInvoicePDF(rawData: ReInvoiceData): Readable {
  const doc = new PDFDocument({ size: "A4", margin: 0 });

  // Înregistrăm Roboto cu numele exact pentru a suporta diacriticele fără a rescrie toate template-urile
  try {
    const robotoReg = path.resolve(
      process.cwd(),
      "server/assets/fonts/Roboto-Regular.ttf"
    );
    const robotoBold = path.resolve(
      process.cwd(),
      "server/assets/fonts/Roboto-Bold.ttf"
    );
    if (fs.existsSync(robotoReg)) doc.registerFont("Roboto", robotoReg);
    if (fs.existsSync(robotoBold)) doc.registerFont("Roboto-Bold", robotoBold);
  } catch (err) {
    console.error("[PDF] Could not load Roboto fonts for diacritics", err);
  }

  const data = sanitizeData(rawData);

  const template: InvoiceTemplate = data.template ?? "classic";

  if (template === "modern") {
    generateModern(doc, data);
  } else if (template === "minimal") {
    generateMinimal(doc, data);
  } else {
    generateClassic(doc, data);
  }

  doc.end();
  return doc;
}
