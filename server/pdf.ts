import PDFDocument from "pdfkit";
import { Readable } from "stream";

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

export function generateReInvoicePDF(data: ReInvoiceData): Readable {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
  });

  const pageWidth = doc.page.width - 80;
  const now = new Date();

  // Header with company info
  doc.fontSize(24).font("Helvetica-Bold").text("RE-FACTURĂ", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica").text(`Seria: ${data.number}`, { align: "center" });
  doc.moveDown(1);

  // Company info (left) vs Client info (right)
  const leftX = 40;
  const rightX = 300;

  doc.fontSize(11).font("Helvetica-Bold").text("Emitent:", leftX, doc.y);
  doc.fontSize(10).font("Helvetica");
  doc.text(data.companyName, leftX, doc.y);
  doc.text(`CUI: ${data.companyCUI}`, leftX, doc.y);
  doc.text(`${data.companyAddress}, ${data.companyCity}`, leftX, doc.y);
  doc.text(`${data.companyCounty}`, leftX, doc.y);
  doc.text(`Tel: ${data.companyPhone}`, leftX, doc.y);
  doc.text(`Email: ${data.companyEmail}`, leftX, doc.y);
  doc.text(`IBAN: ${data.companyIBAN}`, leftX, doc.y);
  doc.text(`Banca: ${data.companyBank}`, leftX, doc.y);

  const clientY = doc.y - 8 * 10 - 10;
  doc.fontSize(11).font("Helvetica-Bold").text("Client:", rightX, clientY);
  doc.fontSize(10).font("Helvetica");
  doc.text(data.clientName, rightX, clientY + 15);
  doc.text(`CUI: ${data.clientCUI}`, rightX, doc.y);
  doc.text(`${data.clientAddress}, ${data.clientCity}`, rightX, doc.y);
  doc.text(`${data.clientCounty}`, rightX, doc.y);
  doc.text(`Tel: ${data.clientPhone}`, rightX, doc.y);
  doc.text(`Email: ${data.clientEmail}`, rightX, doc.y);

  doc.moveDown(1.5);

  // Dates
  doc.fontSize(10).font("Helvetica");
  doc.text(`Data emiterii: ${new Date(data.date).toLocaleDateString("ro-RO")}`, leftX);
  doc.text(`Scadență: ${new Date(data.dueDate).toLocaleDateString("ro-RO")}`, leftX);

  doc.moveDown(1);

  // Lines table
  const tableTop = doc.y;
  const colWidths = {
    description: 200,
    quantity: 60,
    unitPrice: 80,
    vatRate: 50,
    total: 80,
  };

  // Table header
  doc.rect(leftX, tableTop, pageWidth, 20).stroke();
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Descriere", leftX + 5, tableTop + 5, { width: colWidths.description - 10 });
  doc.text("Cant.", leftX + colWidths.description, tableTop + 5, { width: colWidths.quantity - 5, align: "right" });
  doc.text("Preț Unit.", leftX + colWidths.description + colWidths.quantity, tableTop + 5, {
    width: colWidths.unitPrice - 5,
    align: "right",
  });
  doc.text("TVA %", leftX + colWidths.description + colWidths.quantity + colWidths.unitPrice, tableTop + 5, {
    width: colWidths.vatRate - 5,
    align: "right",
  });
  doc.text("Total", leftX + colWidths.description + colWidths.quantity + colWidths.unitPrice + colWidths.vatRate, tableTop + 5, {
    width: colWidths.total - 5,
    align: "right",
  });

  // Table rows
  let currentY = tableTop + 20;
  doc.fontSize(9).font("Helvetica");

  data.lines.forEach((line) => {
    const rowHeight = 40;
    if (currentY + rowHeight > doc.page.height - 60) {
      doc.addPage();
      currentY = 40;
    }

    doc.rect(leftX, currentY, pageWidth, rowHeight).stroke();

    doc.text(line.description, leftX + 5, currentY + 5, { width: colWidths.description - 10, height: rowHeight - 10 });
    doc.text(line.quantity.toString(), leftX + colWidths.description, currentY + 5, {
      width: colWidths.quantity - 5,
      align: "right",
      height: rowHeight - 10,
    });
    doc.text(`${line.unitPrice.toFixed(2)} ${data.currency}`, leftX + colWidths.description + colWidths.quantity, currentY + 5, {
      width: colWidths.unitPrice - 5,
      align: "right",
      height: rowHeight - 10,
    });
    doc.text(line.vatRate.toString(), leftX + colWidths.description + colWidths.quantity + colWidths.unitPrice, currentY + 5, {
      width: colWidths.vatRate - 5,
      align: "right",
      height: rowHeight - 10,
    });
    doc.text(`${line.total.toFixed(2)} ${data.currency}`, leftX + colWidths.description + colWidths.quantity + colWidths.unitPrice + colWidths.vatRate, currentY + 5, {
      width: colWidths.total - 5,
      align: "right",
      height: rowHeight - 10,
    });

    currentY += rowHeight;
  });

  // Totals section
  doc.moveDown(1);
  const totalsX = leftX + colWidths.description + colWidths.quantity + colWidths.unitPrice + 10;

  doc.fontSize(10).font("Helvetica");
  doc.text("Subtotal:", totalsX, doc.y, { width: 100, align: "right" });
  doc.text(`${data.subtotal.toFixed(2)} ${data.currency}`, totalsX + 110, doc.y - 10, { width: 80, align: "right" });

  doc.text("TVA:", totalsX, doc.y + 5, { width: 100, align: "right" });
  doc.text(`${data.totalVAT.toFixed(2)} ${data.currency}`, totalsX + 110, doc.y - 10, { width: 80, align: "right" });

  doc.moveDown(0.5);
  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("TOTAL:", totalsX, doc.y, { width: 100, align: "right" });
  doc.text(`${data.total.toFixed(2)} ${data.currency}`, totalsX + 110, doc.y - 12, { width: 80, align: "right" });

  // Notes
  if (data.notes) {
    doc.moveDown(1);
    doc.fontSize(9).font("Helvetica");
    doc.text("Observații:", leftX);
    doc.text(data.notes, leftX, doc.y, { width: pageWidth });
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).font("Helvetica").text("Generat automat de RefacturaRO", { align: "center" });
  doc.text(`${now.toLocaleDateString("ro-RO")} ${now.toLocaleTimeString("ro-RO")}`, { align: "center" });

  doc.end();

  return doc;
}
