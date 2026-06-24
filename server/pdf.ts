import PDFDocument from "pdfkit";
import { Readable } from "stream";

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
  clientEmail: string;
  clientPhone: string;
  companyName: string;
  companyCUI: string;
  companyAddress: string;
  companyCity: string;
  companyCounty: string;
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

function drawLogo(doc: PDFKit.PDFDocument, logoBase64: string, x: number, y: number, w = 110, h = 55) {
  try {
    const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, "base64");
    doc.image(imgBuffer, x, y, { width: w, height: h, fit: [w, h], align: "left", valign: "center" });
  } catch (_) { /* ignoră logo invalid */ }
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
    if (y + rowH > doc.page.height - 60) { doc.addPage(); y = 50; }

    if (rowBg) {
      doc.rect(leftX, y, pageWidth, rowH)
        .fillColor(idx % 2 === 0 ? rowBg : (altBg ?? rowBg))
        .fill();
    }
    doc.rect(leftX, y, pageWidth, rowH).strokeColor("#e2e8f0").lineWidth(0.5).stroke();

    doc.fillColor("#1e293b").fontSize(9).font("Helvetica");
    doc.text(line.description, leftX + 5, y + 9, { width: colWidths.desc - 8, height: rowH - 8 });
    doc.text(line.quantity.toString(), leftX + colWidths.desc, y + 9, { width: colWidths.qty - 4, align: "right" });
    doc.text(`${line.unitPrice.toFixed(2)} ${data.currency}`, leftX + colWidths.desc + colWidths.qty, y + 9, { width: colWidths.price - 4, align: "right" });
    doc.text(`${line.vatRate}%`, leftX + colWidths.desc + colWidths.qty + colWidths.price, y + 9, { width: colWidths.vat - 4, align: "right" });
    doc.text(`${line.total.toFixed(2)} ${data.currency}`, leftX + colWidths.desc + colWidths.qty + colWidths.price + colWidths.vat, y + 9, { width: colWidths.total - 4, align: "right" });
    y += rowH;
  });

  return y;
}

function drawTotals(doc: PDFKit.PDFDocument, data: ReInvoiceData, afterY: number, leftX: number, pageWidth: number, accentColor: string) {
  const totW = 220;
  const totX = leftX + pageWidth - totW;
  let y = afterY + 12;

  doc.fontSize(9).font("Helvetica").fillColor("#64748b");
  doc.text("Subtotal (fără TVA):", totX, y, { width: 130 });
  doc.text(`${data.subtotal.toFixed(2)} ${data.currency}`, totX + 130, y, { width: 85, align: "right" });
  y += 16;
  doc.text("TVA:", totX, y, { width: 130 });
  doc.text(`${data.totalVAT.toFixed(2)} ${data.currency}`, totX + 130, y, { width: 85, align: "right" });
  y += 20;

  doc.rect(totX - 4, y - 4, totW + 4, 28).fillColor(accentColor).fill();
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#ffffff");
  doc.text("TOTAL:", totX, y + 6, { width: 130 });
  doc.text(`${data.total.toFixed(2)} ${data.currency}`, totX + 130, y + 6, { width: 85, align: "right" });
  doc.fillColor("#1e293b");
  return y + 34;
}

// ─── TEMPLATE 1: CLASSIC ─────────────────────────────────────────────────────
// Aspect profesional clasic: header text centrat, linie separator, tabel cu borduri

function generateClassic(doc: PDFKit.PDFDocument, data: ReInvoiceData) {
  const leftX = 40;
  const pageWidth = doc.page.width - 80;
  const now = new Date();

  // Logo
  let headerY = 40;
  if (data.logoBase64) { drawLogo(doc, data.logoBase64, leftX, headerY, 100, 50); }

  // Title
  doc.fontSize(22).font("Helvetica-Bold").fillColor("#1e293b")
    .text("RE-FACTURĂ FISCALĂ", 0, 45, { align: "center" });
  doc.fontSize(10).font("Helvetica").fillColor("#64748b")
    .text(`Nr. ${data.number}  |  Data: ${new Date(data.date).toLocaleDateString("ro-RO")}  |  Scadență: ${new Date(data.dueDate).toLocaleDateString("ro-RO")}`, 0, 72, { align: "center" });

  doc.moveTo(leftX, 92).lineTo(leftX + pageWidth, 92).strokeColor("#cbd5e1").lineWidth(1).stroke();
  doc.moveDown(0.5);

  // Emitent / Client columns
  const colW = pageWidth / 2 - 10;
  let y = 105;
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#64748b")
    .text("EMITENT", leftX, y).text("DESTINATAR", leftX + colW + 20, y);
  y += 14;
  const infoLines = (name: string, cui: string, addr: string, city: string, phone: string, email: string, iban: string, bank: string) =>
    [`${name}`, `CUI: ${cui}`, `${addr}`, `${city}`, `Tel: ${phone}`, `Email: ${email}`, `IBAN: ${iban}`, `Banca: ${bank}`];

  const emitentLines = infoLines(data.companyName, data.companyCUI, data.companyAddress, `${data.companyCity} ${data.companyCounty}`, data.companyPhone, data.companyEmail, data.companyIBAN, data.companyBank);
  const clientLines  = infoLines(data.clientName, data.clientCUI, data.clientAddress, `${data.clientCity} ${data.clientCounty}`, data.clientPhone, data.clientEmail, "", "");

  doc.fontSize(9).font("Helvetica").fillColor("#1e293b");
  emitentLines.forEach((l, i) => { if (l.trim() !== "IBAN: " && l.trim() !== "Banca: ") doc.text(l, leftX, y + i * 13, { width: colW }); });
  clientLines.forEach((l, i)  => { if (l.trim() !== "IBAN: " && l.trim() !== "Banca: ") doc.text(l, leftX + colW + 20, y + i * 13, { width: colW }); });

  y += 115;
  doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
  y += 10;

  // Table header
  const colWidths = { desc: 210, qty: 55, price: 85, vat: 45, total: 85 };
  doc.rect(leftX, y, pageWidth, 22).fillColor("#1e293b").fill();
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#ffffff");
  doc.text("DESCRIERE", leftX + 5, y + 6, { width: colWidths.desc - 8 });
  doc.text("CANT.", leftX + colWidths.desc, y + 6, { width: colWidths.qty - 4, align: "right" });
  doc.text("PREȚ/U", leftX + colWidths.desc + colWidths.qty, y + 6, { width: colWidths.price - 4, align: "right" });
  doc.text("TVA", leftX + colWidths.desc + colWidths.qty + colWidths.price, y + 6, { width: colWidths.vat - 4, align: "right" });
  doc.text("TOTAL", leftX + colWidths.desc + colWidths.qty + colWidths.price + colWidths.vat, y + 6, { width: colWidths.total - 4, align: "right" });
  y += 22;

  y = drawTableRows(doc, data, y, leftX, pageWidth, "#f8fafc", "#ffffff");
  y = drawTotals(doc, data, y, leftX, pageWidth, "#1e293b");

  if (data.notes) {
    y += 12;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#64748b").text("Observații:", leftX, y);
    doc.fontSize(9).font("Helvetica").fillColor("#1e293b").text(data.notes, leftX, y + 13, { width: pageWidth });
  }

  const footerY = doc.page.height - 35;
  doc.fontSize(7.5).font("Helvetica").fillColor("#94a3b8")
    .text(`Generat de RefacturaRO • ${now.toLocaleDateString("ro-RO")} ${now.toLocaleTimeString("ro-RO")}`, leftX, footerY, { width: pageWidth, align: "center" });
}

// ─── TEMPLATE 2: MODERN ──────────────────────────────────────────────────────
// Header colorat (albastru navy), logo stânga, număr factură în bloc color

function generateModern(doc: PDFKit.PDFDocument, data: ReInvoiceData) {
  const leftX = 40;
  const pageWidth = doc.page.width - 80;
  const accentBlue = "#2563eb";
  const now = new Date();

  // Header band
  doc.rect(0, 0, doc.page.width, 90).fillColor("#0f172a").fill();

  if (data.logoBase64) { drawLogo(doc, data.logoBase64, leftX, 18, 90, 54); }

  // Company name top-left
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#ffffff").text(data.companyName, leftX + (data.logoBase64 ? 105 : 0), 26);
  doc.fontSize(8).font("Helvetica").fillColor("#94a3b8").text(`CUI: ${data.companyCUI}  |  ${data.companyEmail}`, leftX + (data.logoBase64 ? 105 : 0), 41);

  // Invoice badge top-right
  doc.rect(doc.page.width - 180, 18, 140, 54).fillColor(accentBlue).fill();
  doc.fontSize(14).font("Helvetica-Bold").fillColor("#ffffff").text("RE-FACTURĂ", doc.page.width - 175, 26, { width: 130, align: "center" });
  doc.fontSize(9).font("Helvetica").fillColor("#bfdbfe").text(`Nr. ${data.number}`, doc.page.width - 175, 44, { width: 130, align: "center" });
  doc.fontSize(8).font("Helvetica").fillColor("#bfdbfe").text(`${new Date(data.date).toLocaleDateString("ro-RO")}`, doc.page.width - 175, 57, { width: 130, align: "center" });

  // Dates row
  let y = 105;
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#64748b").text("DATA EMITERII", leftX, y).text("SCADENȚĂ", leftX + 140, y);
  y += 12;
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#1e293b")
    .text(new Date(data.date).toLocaleDateString("ro-RO"), leftX, y)
    .text(new Date(data.dueDate).toLocaleDateString("ro-RO"), leftX + 140, y);

  // Emitent / Client cards
  y += 28;
  [{ label: "EMITENT", x: leftX }, { label: "CLIENT", x: leftX + pageWidth / 2 + 8 }].forEach((col, idx) => {
    const isClient = idx === 1;
    const name    = isClient ? data.clientName : data.companyName;
    const cui     = isClient ? data.clientCUI : data.companyCUI;
    const addr    = isClient ? `${data.clientAddress}, ${data.clientCity}` : `${data.companyAddress}, ${data.companyCity}`;
    const contact = isClient ? `${data.clientPhone} | ${data.clientEmail}` : `${data.companyPhone} | ${data.companyEmail}`;
    const banking = isClient ? "" : `IBAN: ${data.companyIBAN} | ${data.companyBank}`;

    doc.rect(col.x, y, pageWidth / 2 - 8, 75).fillColor("#f1f5f9").fill();
    doc.rect(col.x, y, 3, 75).fillColor(accentBlue).fill();
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#64748b").text(col.label, col.x + 10, y + 8);
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text(name, col.x + 10, y + 20, { width: pageWidth / 2 - 22 });
    doc.fontSize(8).font("Helvetica").fillColor("#475569").text(`CUI: ${cui}`, col.x + 10, y + 36);
    doc.text(addr, col.x + 10, y + 48, { width: pageWidth / 2 - 22 });
    if (banking) doc.text(banking, col.x + 10, y + 60, { width: pageWidth / 2 - 22 });
    else doc.text(contact, col.x + 10, y + 60, { width: pageWidth / 2 - 22 });
  });

  y += 85;

  // Table header
  const colWidths = { desc: 210, qty: 55, price: 85, vat: 45, total: 85 };
  doc.rect(leftX, y, pageWidth, 22).fillColor(accentBlue).fill();
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#ffffff");
  doc.text("DESCRIERE", leftX + 5, y + 6, { width: colWidths.desc - 8 });
  doc.text("CANT.", leftX + colWidths.desc, y + 6, { width: colWidths.qty - 4, align: "right" });
  doc.text("PREȚ/U", leftX + colWidths.desc + colWidths.qty, y + 6, { width: colWidths.price - 4, align: "right" });
  doc.text("TVA", leftX + colWidths.desc + colWidths.qty + colWidths.price, y + 6, { width: colWidths.vat - 4, align: "right" });
  doc.text("TOTAL", leftX + colWidths.desc + colWidths.qty + colWidths.price + colWidths.vat, y + 6, { width: colWidths.total - 4, align: "right" });
  y += 22;

  y = drawTableRows(doc, data, y, leftX, pageWidth, "#f8fafc", "#ffffff");
  y = drawTotals(doc, data, y, leftX, pageWidth, accentBlue);

  if (data.notes) {
    y += 10;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#64748b").text("OBSERVAȚII:", leftX, y);
    doc.fontSize(8.5).font("Helvetica").fillColor("#1e293b").text(data.notes, leftX, y + 12, { width: pageWidth });
  }

  const footerY = doc.page.height - 35;
  doc.rect(0, footerY - 8, doc.page.width, 45).fillColor("#0f172a").fill();
  doc.fontSize(7.5).font("Helvetica").fillColor("#94a3b8")
    .text(`RefacturaRO • Generat automat • ${now.toLocaleDateString("ro-RO")} ${now.toLocaleTimeString("ro-RO")}`, 0, footerY + 2, { align: "center", width: doc.page.width });
}

// ─── TEMPLATE 3: MINIMAL ─────────────────────────────────────────────────────
// Design curat, fără borduri grele. Linii subtile, spațiere generoasă

function generateMinimal(doc: PDFKit.PDFDocument, data: ReInvoiceData) {
  const leftX = 50;
  const pageWidth = doc.page.width - 100;
  const now = new Date();
  const accentGreen = "#059669";

  let y = 50;

  if (data.logoBase64) { drawLogo(doc, data.logoBase64, leftX, y, 90, 45); y += 60; }

  // Title left-aligned
  doc.fontSize(28).font("Helvetica-Bold").fillColor("#0f172a").text("Factură", leftX, y);
  doc.moveTo(leftX, y + 38).lineTo(leftX + 60, y + 38).strokeColor(accentGreen).lineWidth(3).stroke();
  y += 55;

  // Metadata pills
  doc.fontSize(9).font("Helvetica").fillColor("#64748b");
  doc.text(`Nr. ${data.number}`, leftX, y);
  doc.text(`Emisă: ${new Date(data.date).toLocaleDateString("ro-RO")}`, leftX + 120, y);
  doc.text(`Scadentă: ${new Date(data.dueDate).toLocaleDateString("ro-RO")}`, leftX + 260, y);
  y += 30;

  doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
  y += 16;

  // Emitent / Client compact
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#94a3b8").text("DE LA", leftX, y).text("CĂTRE", leftX + pageWidth / 2, y);
  y += 12;
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text(data.companyName, leftX, y, { width: pageWidth / 2 - 20 });
  doc.text(data.clientName, leftX + pageWidth / 2, y, { width: pageWidth / 2 });
  y += 15;
  doc.fontSize(8.5).font("Helvetica").fillColor("#475569");
  doc.text(`CUI: ${data.companyCUI}`, leftX, y).text(`CUI: ${data.clientCUI}`, leftX + pageWidth / 2, y);
  y += 12;
  doc.text(data.companyAddress, leftX, y, { width: pageWidth / 2 - 20 }).text(data.clientAddress, leftX + pageWidth / 2, y, { width: pageWidth / 2 });
  y += 12;
  if (data.companyIBAN) doc.text(`IBAN: ${data.companyIBAN}`, leftX, y, { width: pageWidth / 2 - 20 });
  y += 20;

  doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
  y += 16;

  // Table — minimal, no box, just subtle lines
  const colWidths = { desc: 210, qty: 55, price: 85, vat: 45, total: 85 };
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#94a3b8");
  doc.text("DESCRIERE", leftX, y, { width: colWidths.desc });
  doc.text("CANT.", leftX + colWidths.desc, y, { width: colWidths.qty, align: "right" });
  doc.text("PREȚ/U", leftX + colWidths.desc + colWidths.qty, y, { width: colWidths.price, align: "right" });
  doc.text("TVA", leftX + colWidths.desc + colWidths.qty + colWidths.price, y, { width: colWidths.vat, align: "right" });
  doc.text("TOTAL", leftX + colWidths.desc + colWidths.qty + colWidths.price + colWidths.vat, y, { width: colWidths.total, align: "right" });
  y += 16;
  doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
  y += 8;

  data.lines.forEach((line, idx) => {
    if (y + 25 > doc.page.height - 80) { doc.addPage(); y = 50; }
    if (idx % 2 === 0) { doc.rect(leftX - 6, y - 3, pageWidth + 12, 23).fillColor("#f8fafc").fill(); }
    doc.fontSize(9).font("Helvetica").fillColor("#1e293b");
    doc.text(line.description, leftX, y + 3, { width: colWidths.desc - 8 });
    doc.text(String(line.quantity), leftX + colWidths.desc, y + 3, { width: colWidths.qty - 4, align: "right" });
    doc.text(`${line.unitPrice.toFixed(2)} ${data.currency}`, leftX + colWidths.desc + colWidths.qty, y + 3, { width: colWidths.price - 4, align: "right" });
    doc.text(`${line.vatRate}%`, leftX + colWidths.desc + colWidths.qty + colWidths.price, y + 3, { width: colWidths.vat - 4, align: "right" });
    doc.text(`${line.total.toFixed(2)} ${data.currency}`, leftX + colWidths.desc + colWidths.qty + colWidths.price + colWidths.vat, y + 3, { width: colWidths.total - 4, align: "right" });
    y += 24;
  });

  doc.moveTo(leftX, y + 4).lineTo(leftX + pageWidth, y + 4).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
  y += 18;

  // Totals right-aligned, minimal
  const totW = 220;
  const totX = leftX + pageWidth - totW;
  doc.fontSize(9).font("Helvetica").fillColor("#64748b");
  doc.text("Subtotal:", totX, y).text(`${data.subtotal.toFixed(2)} ${data.currency}`, totX + 130, y, { width: 85, align: "right" }); y += 16;
  doc.text("TVA:", totX, y).text(`${data.totalVAT.toFixed(2)} ${data.currency}`, totX + 130, y, { width: 85, align: "right" }); y += 16;
  doc.moveTo(totX, y).lineTo(totX + totW, y).strokeColor(accentGreen).lineWidth(1.5).stroke(); y += 10;
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a");
  doc.text("Total:", totX, y).text(`${data.total.toFixed(2)} ${data.currency}`, totX + 130, y, { width: 85, align: "right" });

  if (data.notes) {
    y += 35;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#94a3b8").text("OBSERVAȚII", leftX, y);
    y += 12;
    doc.fontSize(8.5).font("Helvetica").fillColor("#475569").text(data.notes, leftX, y, { width: pageWidth });
  }

  const footerY = doc.page.height - 30;
  doc.fontSize(7.5).font("Helvetica").fillColor("#cbd5e1")
    .text(`RefacturaRO • ${now.toLocaleDateString("ro-RO")}`, leftX, footerY, { width: pageWidth, align: "center" });
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function generateReInvoicePDF(data: ReInvoiceData): Readable {
  const doc = new PDFDocument({ size: "A4", margin: 0 });

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
