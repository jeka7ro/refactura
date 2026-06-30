const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream("test_jysk.pdf"));

const robotoPath = path.resolve(
  process.cwd(),
  "server/assets/fonts/Roboto-Regular.ttf"
);
const robotoBoldPath = path.resolve(
  process.cwd(),
  "server/assets/fonts/Roboto-Bold.ttf"
);
console.log("Roboto exists?", fs.existsSync(robotoPath));

if (fs.existsSync(robotoPath) && fs.existsSync(robotoBoldPath)) {
  doc.registerFont("Helvetica", robotoPath);
  doc.registerFont("Helvetica-Bold", robotoBoldPath);
  console.log("Fonts registered!");
}

doc
  .font("Helvetica")
  .fontSize(12)
  .text("DRA opacă ALDRA 140x300 nisipie", 100, 100);
doc.end();
console.log("PDF generated!");
