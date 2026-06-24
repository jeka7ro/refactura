import { getDb } from "./db";
import { integrations, reInvoices } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const ANAF_UPLOAD_URL = "https://api.anaf.ro/prod/FCTEL/rest/upload?standard=UBL&cif=";
// For testing you might use:
// const ANAF_UPLOAD_URL = "https://api.anaf.ro/test/FCTEL/rest/upload?standard=UBL&cif=";

export async function uploadInvoiceToSPV(
  tenantId: number,
  invoiceId: number,
  xmlContent: string,
  cif: string
): Promise<{ success: boolean; index_incarcare?: string; error?: string }> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database not connected" };

    // Get the integration token
    const intg = await db.select().from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.provider, "spv"), eq(integrations.status, "active")))
      .limit(1);

    if (intg.length === 0 || !intg[0].apiKey) {
      return { success: false, error: "SPV Nu este integrat sau token lipsă." };
    }

    const token = intg[0].apiKey;
    const url = `${ANAF_UPLOAD_URL}${cif}`;

    console.log(`[SPV Upload] Trimitere factura ID ${invoiceId} pentru CIF ${cif}`);

    // Create a Blob from the XML string to send as multipart/form-data if required, or raw body?
    // ANAF documentation usually requires just raw XML string in body or multipart?
    // Actually standard=UBL expects the body to be the raw XML content. Let's send raw XML.
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/xml"
      },
      body: xmlContent
    });

    const responseText = await response.text();
    console.log(`[SPV Upload] Status HTTP: ${response.status}. Răspuns: ${responseText}`);

    if (!response.ok) {
      return { success: false, error: `Eroare ${response.status}: ${responseText}` };
    }

    // Response structure: 
    // <?xml version="1.0" encoding="UTF-8" standalone="yes"?><dateRsp><cui>42322117</cui><dateResponse><ExecutionStatus>0</ExecutionStatus><index_incarcare>66612345</index_incarcare></dateResponse></dateRsp>
    // Sometimes it's JSON if we ask for it? Let's parse XML simply via regex or fast-xml-parser
    let indexMatch = responseText.match(/<index_incarcare>(\d+)<\/index_incarcare>/);
    let errorMatch = responseText.match(/<Errors[^>]*>(.*?)<\/Errors>/i);

    if (indexMatch && indexMatch[1]) {
      const spvIndex = indexMatch[1];
      
      // Update DB
      await db.update(reInvoices)
        .set({ 
          spvIndex, 
          spvStatus: "in_procesare",
          rawXml: xmlContent 
        })
        .where(eq(reInvoices.id, invoiceId));

      return { success: true, index_incarcare: spvIndex };
    } else {
      // Failed to parse index, likely an ANAF error response
      const errMsg = errorMatch ? errorMatch[1] : responseText;
      await db.update(reInvoices)
        .set({
          spvStatus: "eroare",
          spvError: errMsg,
          rawXml: xmlContent
        })
        .where(eq(reInvoices.id, invoiceId));

      return { success: false, error: `Răspuns invalid ANAF: ${errMsg}` };
    }

  } catch (error: any) {
    console.error("[SPV Upload] Eroare critică:", error);
    return { success: false, error: error.message };
  }
}
