const PDFDocument = require("pdfkit");
const fs = require("fs");
const doc = new PDFDocument();
doc.pipe(fs.createWriteStream("test_corrupt.pdf"));
doc.font("Helvetica").text("DRA opacă LEKA 140x300 gri", 100, 100);
doc.end();
console.log("Generated with default Helvetica");
