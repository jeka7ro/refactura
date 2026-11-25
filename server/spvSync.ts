/**
 * SPV ANAF OAuth Sync — Descarcă automat facturi primite din Spațiul Privat Virtual
 * Flow: Utilizator → redirect SPV OAuth → callback token → descarca facturile
 */
import { createInvoiceArchiveEntry, getDb } from "./db";
import { integrations, tenants, costCenterRules, invoiceArchive } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { XMLParser } from "fast-xml-parser";
import { convertXmlToPdf } from "./anafPdf";

function normalizeSpvCif(raw: any): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/^RO/i, "")
    .replace(/[^A-Z0-9]/g, "");
}

function xmlNodeText(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return String(v["#text"] ?? v["_text"] ?? "").trim();
  return String(v).trim();
}

function extractPartyCifs(partyWrapper: any): string[] {
  const party = partyWrapper?.["Party"] ?? partyWrapper?.["cac:Party"] ?? partyWrapper;
  if (!party || typeof party !== "object") return [];
  const cifs = new Set<string>();
  const taxSchemes = party["PartyTaxScheme"] ?? party["cac:PartyTaxScheme"];
  const taxArr = Array.isArray(taxSchemes) ? taxSchemes : taxSchemes ? [taxSchemes] : [];
  for (const ts of taxArr) {
    const c = normalizeSpvCif(xmlNodeText(ts?.["CompanyID"] ?? ts?.["cbc:CompanyID"]));
    if (c) cifs.add(c);
  }
  const legals = party["PartyLegalEntity"] ?? party["cac:PartyLegalEntity"];
  const legArr = Array.isArray(legals) ? legals : legals ? [legals] : [];
  for (const le of legArr) {
    const c = normalizeSpvCif(xmlNodeText(le?.["CompanyID"] ?? le?.["cbc:CompanyID"]));
    if (c) cifs.add(c);
  }
  return Array.from(cifs);
}

function extractFirstPartyCui(partyWrapper: any): string {
  const party = partyWrapper?.["Party"] ?? partyWrapper?.["cac:Party"] ?? partyWrapper;
  if (!party || typeof party !== "object") return "";
  const taxSchemes = party["PartyTaxScheme"] ?? party["cac:PartyTaxScheme"];
  const taxArr = Array.isArray(taxSchemes) ? taxSchemes : taxSchemes ? [taxSchemes] : [];
  for (const ts of taxArr) {
    const c = xmlNodeText(ts?.["CompanyID"] ?? ts?.["cbc:CompanyID"]);
    if (c) return c;
  }
  const legals = party["PartyLegalEntity"] ?? party["cac:PartyLegalEntity"];
  const legArr = Array.isArray(legals) ? legals : legals ? [legals] : [];
  for (const le of legArr) {
    const c = xmlNodeText(le?.["CompanyID"] ?? le?.["cbc:CompanyID"]);
    if (c) return c;
  }
  return "";
}

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
      .select({ id: tenants.id, cui: tenants.cui })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    if (!tenant) throw new Error("Tenant not found");
    const cleanTenantCif = normalizeSpvCif(tenant.cui);
    if (!cleanTenantCif) {
      throw new Error("CUI-ul firmei nu este configurat în profilul companiei.");
    }

    const rules = await db
      .select()
      .from(costCenterRules)
      .where(and(eq(costCenterRules.tenantId, tenantId), eq(costCenterRules.isActive, 1)));

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
        if (doc.cif && normalizeSpvCif(doc.cif) !== cleanTenantCif) {
          console.warn(
            `[SPV] Rejecting doc ${doc.id} with foreign CIF ${doc.cif} (expected ${cleanTenantCif})`
          );
          skipped++;
          continue;
        }

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
        const parser = new XMLParser({ numberParseOptions: { leadingZeros: false, hex: false, eNotation: false },
          ignoreAttributes: false,
          attributeNamePrefix: "@_",
          removeNSPrefix: true,
        });
        const parsedDoc = parser.parse(xmlText);
        const rootKey = Object.keys(parsedDoc).find(
          k => k.includes("Invoice") || k.includes("CreditNote")
        );
        const invoiceObj = rootKey ? parsedDoc[rootKey] : null;
        if (!invoiceObj) {
          skipped++;
          continue;
        }

        const invoiceNumber = invoiceObj["ID"] || `SPV-${doc.id}`;
        const issueDate = invoiceObj["IssueDate"] || "";
        const legalTotal = invoiceObj["LegalMonetaryTotal"];
        const rawTotal =
          legalTotal?.["TaxInclusiveAmount"]?.["#text"] ||
          legalTotal?.["TaxInclusiveAmount"] ||
          "0";
        const parsedTotal = parseFloat(typeof rawTotal === "object" ? "0" : rawTotal);
        const total = isNaN(parsedTotal) ? 0 : parsedTotal;

        const taxTotal = invoiceObj["TaxTotal"];
        const taxTotalObj = Array.isArray(taxTotal) ? taxTotal[0] : taxTotal;
        const rawVAT =
          taxTotalObj?.["TaxAmount"]?.["#text"] ||
          taxTotalObj?.["TaxAmount"] ||
          "0";
        const parsedVAT = parseFloat(typeof rawVAT === "object" ? "0" : rawVAT);
        const totalVAT = isNaN(parsedVAT) ? 0 : parsedVAT;
        const currency =
          invoiceObj["DocumentCurrencyCode"]?.["#text"] ||
          invoiceObj["DocumentCurrencyCode"] ||
          "RON";

        const supplierParty = invoiceObj["AccountingSupplierParty"];
        const customerParty = invoiceObj["AccountingCustomerParty"];
        const supCifs = extractPartyCifs(supplierParty);
        const cusCifs = extractPartyCifs(customerParty);

        if (!supCifs.includes(cleanTenantCif) && !cusCifs.includes(cleanTenantCif)) {
          console.warn(
            `[SPV] Rejecting UBL doc ${doc.id}: neither supplier (${supCifs.join(",")}) nor customer (${cusCifs.join(",")}) matches tenant CIF ${cleanTenantCif}`
          );
          skipped++;
          continue;
        }

        const direction =
          supCifs.includes(cleanTenantCif) && !cusCifs.includes(cleanTenantCif)
            ? "out"
            : "in";
        const counterpartWrapper = direction === "in" ? supplierParty : customerParty;
        let supplierName = "";
        let supplierCUI = "";
        let supplierAddress = "";
        if (counterpartWrapper && counterpartWrapper["Party"]) {
          const party = counterpartWrapper["Party"];
          const pName = Array.isArray(party["PartyName"]) ? party["PartyName"][0] : party["PartyName"];
          const pLegal = Array.isArray(party["PartyLegalEntity"]) ? party["PartyLegalEntity"][0] : party["PartyLegalEntity"];
          supplierName =
            xmlNodeText(pName?.["Name"]) ||
            xmlNodeText(pLegal?.["RegistrationName"]) ||
            "Unknown Supplier";
          supplierCUI = extractFirstPartyCui(counterpartWrapper);
        }

        // Extract Delivery Location (Punct de Lucru) — NOT the supplier HQ
        // In UBL e-Factura, Delivery.DeliveryLocation.Address contains the actual work point
        const deliveryNode = invoiceObj["Delivery"];
        if (deliveryNode) {
          const deliveryArr = Array.isArray(deliveryNode) ? deliveryNode : [deliveryNode];
          for (const d of deliveryArr) {
            const loc = d["DeliveryLocation"]?.["Address"];
            if (loc) {
              supplierAddress = [
                loc["StreetName"],
                loc["CityName"],
                loc["CountrySubentity"],
                loc["PostalZone"]
              ].filter(Boolean).join(", ");
              break;
            }
          }
        }
        // Fallback: if no Delivery location, try supplier PostalAddress
        if (!supplierAddress && supplierParty?.["Party"]?.["PostalAddress"]) {
          const pa = supplierParty["Party"]["PostalAddress"];
          supplierAddress = [
            pa["StreetName"],
            pa["CityName"],
            pa["CountrySubentity"],
            pa["PostalZone"]
          ].filter(Boolean).join(", ");
        }

        if (!invoiceNumber || !issueDate) {
          skipped++;
          continue;
        }

        // Check if already imported by (invoiceNumber, normalized supplierCUI, direction)
        const normalizedSupCui = normalizeSpvCif(supplierCUI);
        const [existing] = await db
          .select({ id: invoiceArchive.id })
          .from(invoiceArchive)
          .where(
            and(
              eq(invoiceArchive.tenantId, tenantId),
              eq(invoiceArchive.direction, direction),
              eq(invoiceArchive.invoiceNumber, String(invoiceNumber)),
              sql`REPLACE(REPLACE(REPLACE(UPPER(TRIM(COALESCE(${invoiceArchive.supplierCUI}, ''))), 'RO', ''), ' ', ''), '-', '') = ${normalizedSupCui}`
            )
          );

        if (existing) {
          skipped++;
          continue;
        }

        // Generate PDF
        let fileUrl = "spv_import";
        const pdfRes = await convertXmlToPdf(
          xmlText,
          `Factura_${invoiceNumber}_${Date.now()}`,
          tenantId
        );
        if (pdfRes) {
          fileUrl = pdfRes.url;
        }

        // Evaluate rules - MULTI condition: all non-empty fields must match (AND logic)
        let assignedCostCenterId = null;
        for (const rule of rules) {
          const hasCUI = rule.conditionValue && rule.conditionValue.trim() !== "";
          const hasName = rule.matchName && rule.matchName.trim() !== "";
          const hasAddr = rule.addressKeyword && rule.addressKeyword.trim() !== "";

          if (!hasCUI && !hasName && !hasAddr) continue;

          const cuiOk = !hasCUI || (supplierCUI && supplierCUI.toLowerCase().includes(rule.conditionValue!.toLowerCase()));
          const nameOk = !hasName || (supplierName && supplierName.toLowerCase().includes(rule.matchName!.toLowerCase()));
          const addrOk = !hasAddr || (supplierAddress && supplierAddress.toLowerCase().includes(rule.addressKeyword!.toLowerCase()));

          if (cuiOk && nameOk && addrOk) {
            assignedCostCenterId = rule.costCenterId;
            break;
          }
        }

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
          costCenterId: assignedCostCenterId || undefined,
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
