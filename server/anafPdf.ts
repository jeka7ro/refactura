import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.resolve(process.cwd(), "dist/public/uploads/invoices");

// Ensure upload directory exists
function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function convertXmlToPdf(xmlText: string, fileNameBase: string): Promise<{ key: string, url: string } | null> {
  try {
    // ANAF XML to PDF conversion service
    const response = await fetch("https://webservicesp.anaf.ro/prod/FCTEL/rest/transformare/FACT1/DA", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain"
      },
      body: xmlText,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[ANAF PDF] Conversion failed: ${response.status} ${response.statusText}`, text);
      return null;
    }

    const pdfBuffer = await response.arrayBuffer();
    
    // Check if the response is actually a PDF
    const header = Buffer.from(pdfBuffer.slice(0, 5)).toString("utf8");
    if (!header.includes("%PDF")) {
      console.error("[ANAF PDF] The returned file is not a valid PDF. Header:", header);
      return null;
    }

    // Try Forge storage first (for Manus hosting)
    try {
      const { storagePut } = await import("./storage");
      const result = await storagePut(`invoices/${fileNameBase}.pdf`, Buffer.from(pdfBuffer), "application/pdf");
      console.log(`[ANAF PDF] Stored via Forge: ${result.url}`);
      return result;
    } catch (forgeErr) {
      // Forge not configured, fall back to local file storage
      console.log("[ANAF PDF] Forge not available, saving locally");
    }

    // Local file storage fallback
    ensureDir();
    const fileName = `${fileNameBase.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
    
    const url = `/uploads/invoices/${fileName}`;
    console.log(`[ANAF PDF] Stored locally: ${url}`);
    return { key: fileName, url };
  } catch (error) {
    console.error("[ANAF PDF] Error converting XML to PDF:", error);
    return null;
  }
}
