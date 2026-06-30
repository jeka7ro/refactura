const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream("test2.pdf"));
try {
  const iconPath = path.resolve(process.cwd(), "client/public/logo.png");
  const imgBuffer = fs.readFileSync(iconPath);
  doc.image(imgBuffer, 40, 40, { width: 140 });
  console.log("Image drawn successfully.");
} catch (e) {
  console.log("Error drawing image:", e);
}
doc.end();
