import PDFDocument from "pdfkit";
import fs from "fs";

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream("test_font.pdf"));
try {
  doc.registerFont("Roboto", "server/assets/fonts/Roboto-Regular.ttf");
  doc.font("Roboto");
  console.log("Registered Roboto");
} catch (e) {
  console.log("Failed to register Roboto", e);
  doc.font("Helvetica");
}
doc.text("Test diacritice: ă î ș ț â");
doc.text("DRA opacă ALDRA 140x300 nisipie");
doc.end();
