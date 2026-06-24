import { storagePut } from "./storage";

export async function convertXmlToPdf(xmlText: string, fileNameBase: string): Promise<{ key: string, url: string } | null> {
  try {
    const response = await fetch("https://webservicesp.anaf.ro/prod/FCTEL/rest/transformare/FACT1/DA", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain"
      },
      body: xmlText,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[ANAF PDF] Conversion failed: ${response.status} ${response.statusText}`, text);
      return null;
    }

    const pdfBuffer = await response.arrayBuffer();
    
    // Check if the response is actually a PDF (it should start with %PDF)
    const header = Buffer.from(pdfBuffer.slice(0, 5)).toString("utf8");
    if (!header.includes("%PDF")) {
      console.error("[ANAF PDF] The returned file is not a valid PDF. Header:", header);
      return null;
    }

    // Store the PDF using local storage
    const result = await storagePut(`invoices/${fileNameBase}.pdf`, Buffer.from(pdfBuffer), "application/pdf");
    return result;
  } catch (error) {
    console.error("[ANAF PDF] Error converting XML to PDF:", error);
    return null;
  }
}
