/**
 * SPV ANAF OAuth Sync — Descarcă automat facturi primite din Spațiul Privat Virtual
 * Flow: Utilizator → redirect SPV OAuth → callback token → descarca facturile
 */
import { createInvoiceArchiveEntry, getDb } from "./db";
import { integrations, tenants } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { XMLParser } from "fast-xml-parser";
import { convertXmlToPdf } from "./anafPdf";

const SPV_OAUTH_URL = "https://logon.anaf.ro/anaf-oauth/oauth/authorize";
const SPV_TOKEN_URL = "https://logon.anaf.ro/anaf-oauth/oauth/token";
const SPV_API_URL = "https://ws.anaf.ro/async/DataService/api";

export function getSpvOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "NOU_LISTA_DOCUMENTE",
    state,
  });
  return `${SPV_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeSpvCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(SPV_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SPV token exchange failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: parseInt(data.expires_in) || 3600,
  };
}

export async function syncSpvInvoices(
  tenantId: number,
  accessToken: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    if (!tenant) throw new Error("Tenant not found");
    const tenantCui = (tenant.cui || "").replace(/[^0-9]/g, "");

    // List received documents from SPV
    const res = await fetch(`${SPV_API_URL}/noutati`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`SPV list failed: ${res.status} ${txt}`);
    }

    const data = await res.json();
    const documents = data.documente || [];

    console.log(`[SPV] Fetched ${documents.length} documents`);

    for (const doc of documents) {
      try {
        // Download document as XML
        const xmlRes = await fetch(`${SPV_API_URL}/document/${doc.id}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/xml",
          },
        });

        if (!xmlRes.ok) {
          console.warn(`[SPV] Could not download doc ${doc.id}`);
          continue;
        }

        const xmlText = await xmlRes.text();
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "@_",
        });
        const parsedDoc = parser.parse(xmlText);
        const invoiceObj = parsedDoc.Invoice || parsedDoc.CreditNote;
        if (!invoiceObj) {
          skipped++;
          continue;
        }

        const invoiceNumber = invoiceObj["cbc:ID"] || `SPV-${doc.id}`;
        const issueDate = invoiceObj["cbc:IssueDate"] || "";
        const legalTotal = invoiceObj["cac:LegalMonetaryTotal"];
        const total = parseFloat(
          legalTotal?.["cbc:TaxInclusiveAmount"]?.["#text"] ||
            legalTotal?.["cbc:TaxInclusiveAmount"] ||
            "0"
        );
        const taxTotal = invoiceObj["cac:TaxTotal"];
        const totalVAT = parseFloat(
          taxTotal?.["cbc:TaxAmount"]?.["#text"] ||
            taxTotal?.["cbc:TaxAmount"] ||
            "0"
        );
        const currency =
          invoiceObj["cbc:DocumentCurrencyCode"]?.["#text"] ||
          invoiceObj["cbc:DocumentCurrencyCode"] ||
          "RON";

        let supplierName = "";
        let supplierCUI = "";
        const supplierParty = invoiceObj["cac:AccountingSupplierParty"];
        if (supplierParty && supplierParty["cac:Party"]) {
          const party = supplierParty["cac:Party"];
          supplierName =
            party["cac:PartyName"]?.["cbc:Name"] ||
            party["cac:PartyLegalEntity"]?.["cbc:RegistrationName"] ||
            "Unknown Supplier";
          supplierCUI = party["cac:PartyTaxScheme"]?.["cbc:CompanyID"] || "";
        }

        if (!invoiceNumber || !issueDate) {
          skipped++;
          continue;
        }

        // Check if already imported
        const [existing] = await db
          .select({ id: integrations.id })
          .from(integrations)
          .where(
            and(
              eq(integrations.tenantId, tenantId),
              eq(integrations.provider, "spv"),
              eq(integrations.apiKey, String(invoiceNumber))
            )
          );

        if (existing) {
          skipped++;
          continue;
        }

        // Generate PDF using ANAF API
        let fileUrl = "spv_import";
        const pdfRes = await convertXmlToPdf(
          xmlText,
          `Factura_${invoiceNumber}_${Date.now()}`
        );
        if (pdfRes) {
          fileUrl = pdfRes.url;
        }

        // Determine direction based on CUI matching
        const cleanSupplierCui = supplierCUI.replace(/[^0-9]/g, "");
        const direction =
          cleanSupplierCui === tenantCui && tenantCui !== "" ? "out" : "in";

        // Save invoice
        await createInvoiceArchiveEntry({
          tenantId,
          source: "spv_anaf",
          direction: direction,
          fileType: "xml",
          fileName: `SPV_${invoiceNumber}.xml`,
          fileUrl: fileUrl,
          invoiceNumber: String(invoiceNumber),
          supplierName,
          supplierCUI,
          issueDate,
          dueDate: issueDate,
          total: String(total),
          totalVAT: String(totalVAT),
          currency: currency,
          status: "pending",
        });

        imported++;
      } catch (e: any) {
        errors.push(`Doc ${doc.id}: ${e.message}`);
      }
    }

    console.log(
      `[SPV] Sync complete: imported=${imported}, skipped=${skipped}`
    );
  } catch (e: any) {
    errors.push(e.message);
    console.error("[SPV] Sync error:", e.message);
  }

  return { imported, skipped, errors };
}
