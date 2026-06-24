import PDFDocument from "pdfkit";
import fs from "fs";

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream("test_override.pdf"));
try {
  doc.registerFont("Helvetica", "server/assets/fonts/Roboto-Regular.ttf");
  doc.font("Helvetica");
  console.log("Registered Roboto as Helvetica");
} catch (e) {
  console.log("Failed", e);
}
doc.text("Test diacritice: ă î ș ț â");
doc.text("DRA opacă ALDRA 140x300 nisipie");
doc.end();
