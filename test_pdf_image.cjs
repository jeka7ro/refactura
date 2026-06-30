const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream("test.pdf"));
try {
  doc.image("client/public/favicon.png", 40, 40, { width: 30, height: 30 });
} catch (e) {
  console.log("Error:", e);
}
doc.end();
