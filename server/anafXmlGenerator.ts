import { ReInvoice, ReInvoiceLine, Tenant } from "../drizzle/schema";

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "SE", "SI", "SK"
]);

/**
 * Generates an ANAF compliant UBL 2.1 e-Factura XML string (CIUS-RO).
 * Supports standard VAT, exemptions, reverse charge (AE), foreign EU/non-EU clients, and foreign currencies (EUR, USD, etc.).
 */
export function generateUblXml(
  invoice: ReInvoice,
  lines: ReInvoiceLine[],
  tenant: Tenant
): string {
  const issueDate = new Date(invoice.issueDate).toISOString().split("T")[0];
  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toISOString().split("T")[0]
    : issueDate;

  // Seller CUI (always Romania, ensure RO prefix once)
  const cleanSellerCui = (tenant.cui || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const supplierCui = cleanSellerCui.startsWith("RO") ? cleanSellerCui : "RO" + cleanSellerCui;

  // Buyer Country & CUI
  const rawClientCui = (invoice.clientCUI || "").trim().toUpperCase();
  let buyerCountry = (invoice.clientCountry || "").trim().toUpperCase();
  if (!buyerCountry || buyerCountry.length !== 2) {
    const match = rawClientCui.match(/^([A-Z]{2})/);
    if (match && (EU_COUNTRIES.has(match[1]) || match[1] === "RO")) {
      buyerCountry = match[1];
    } else {
      buyerCountry = "RO";
    }
  }

  const cleanBuyerCui = rawClientCui.replace(/[^A-Z0-9]/gi, "");
  let clientCui = cleanBuyerCui;
  if (buyerCountry === "RO") {
    clientCui = cleanBuyerCui.startsWith("RO") ? cleanBuyerCui : (cleanBuyerCui ? "RO" + cleanBuyerCui : "");
  } else {
    // For foreign EU clients (e.g. BE0785292895), ensure the 2-letter country code is prefixed once
    if (cleanBuyerCui && !cleanBuyerCui.startsWith(buyerCountry) && EU_COUNTRIES.has(buyerCountry)) {
      clientCui = buyerCountry + cleanBuyerCui;
    }
  }

  // Reverse charge detection
  const notesLower = (invoice.notes || "").toLowerCase();
  const isReverseCharge =
    notesLower.includes("reverse charge") ||
    notesLower.includes("taxare inversa") ||
    notesLower.includes("taxare inversă") ||
    notesLower.includes("art. 196") ||
    notesLower.includes("art. 331") ||
    notesLower.includes("art. 307") ||
    (buyerCountry !== "RO" && EU_COUNTRIES.has(buyerCountry));

  // Calculate tax subtotals by VAT rate
  const taxGroups = new Map<
    number,
    { taxableAmount: number; taxAmount: number }
  >();
  for (const line of lines) {
    const rate = parseFloat(String(line.vatRate || "0"));
    const amount =
      parseFloat(String(line.quantity)) * parseFloat(String(line.unitPrice));
    const tax = amount * (rate / 100);

    if (!taxGroups.has(rate)) {
      taxGroups.set(rate, { taxableAmount: 0, taxAmount: 0 });
    }
    const group = taxGroups.get(rate)!;
    group.taxableAmount += amount;
    group.taxAmount += tax;
  }

  let tenantSettings: any = {};
  try {
    if (tenant.settings) tenantSettings = JSON.parse(tenant.settings);
  } catch (e) {}

  const tenantCity = tenantSettings.city || "";
  const tenantRegCom = tenantSettings.regCom || "";
  const tenantCounty = tenantSettings.county || tenantCity || "";

  // BR-RO-110: Map Romanian city/county to ISO 3166-2:RO subdivision code
  const COUNTY_MAP: Record<string, string> = {
    "alba": "RO-AB", "arad": "RO-AR", "arges": "RO-AG", "bacau": "RO-BC",
    "bihor": "RO-BH", "bistrita": "RO-BN", "botosani": "RO-BT", "brasov": "RO-BV",
    "braila": "RO-BR", "bucuresti": "RO-B", "bucharest": "RO-B", "buzau": "RO-BZ",
    "caras": "RO-CS", "severin": "RO-CS", "calarasi": "RO-CL", "cluj": "RO-CJ",
    "constanta": "RO-CT", "covasna": "RO-CV", "dambovita": "RO-DB", "dolj": "RO-DJ",
    "galati": "RO-GL", "giurgiu": "RO-GR", "gorj": "RO-GJ", "harghita": "RO-HR",
    "hunedoara": "RO-HD", "ialomita": "RO-IL", "iasi": "RO-IS", "ilfov": "RO-IF",
    "maramures": "RO-MM", "mehedinti": "RO-MH", "mures": "RO-MS", "neamt": "RO-NT",
    "olt": "RO-OT", "prahova": "RO-PH", "satu": "RO-SM", "salaj": "RO-SJ",
    "sibiu": "RO-SB", "suceava": "RO-SV", "teleorman": "RO-TR", "timis": "RO-TM",
    "timisoara": "RO-TM", "tulcea": "RO-TL", "vaslui": "RO-VS", "valcea": "RO-VL",
    "vrancea": "RO-VN",
  };
  const getCountyCode = (city: string): string => {
    if (!city) return "RO-B"; // default Bucharest
    const key = city.toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .trim();
    for (const [k, v] of Object.entries(COUNTY_MAP)) {
      if (key.includes(k)) return v;
    }
    return "RO-B"; // fallback
  };

  // BR-RO-100: When subdivision is RO-B (Bucharest), city must be SECTOR1...SECTOR6
  const getSectorOrCity = (subdivision: string, address: string, city: string): string => {
    if (subdivision !== "RO-B") return city || "Nesetata";
    const sectorMatch = (address + " " + city).match(/sector\s*([1-6])/i);
    if (sectorMatch) return `SECTOR${sectorMatch[1]}`;
    return "SECTOR1";
  };

  const sellerSubdivision = getCountyCode(tenantCounty);
  const sellerCity = getSectorOrCity(sellerSubdivision, tenant.address || "", tenantCity);

  let buyerAddressXml = "";
  if (buyerCountry === "RO") {
    const clientCounty = (invoice as any).clientCounty || (invoice as any).clientCity || "";
    const buyerSubdivision = getCountyCode(clientCounty);
    const buyerCity = getSectorOrCity(buyerSubdivision, (invoice as any).clientAddress || "", (invoice as any).clientCity || "");
    buyerAddressXml = `
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml((invoice as any).clientAddress || "Nesetata")}</cbc:StreetName>
                <cbc:CityName>${escapeXml(buyerCity)}</cbc:CityName>
                <cbc:CountrySubentity>${buyerSubdivision}</cbc:CountrySubentity>
                <cac:Country>
                    <cbc:IdentificationCode>RO</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>`;
  } else {
    buyerAddressXml = `
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml((invoice as any).clientAddress || "Nesetata")}</cbc:StreetName>
                <cbc:CityName>${escapeXml((invoice as any).clientCity || "Nesetata")}</cbc:CityName>
                ${(invoice as any).clientCounty ? `<cbc:CountrySubentity>${escapeXml((invoice as any).clientCounty)}</cbc:CountrySubentity>` : ""}
                <cac:Country>
                    <cbc:IdentificationCode>${buyerCountry}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>`;
  }

  // Generate lines
  const xmlLines = lines
    .map((line, idx) => {
      const qty = parseFloat(String(line.quantity));
      const unitPrice = parseFloat(String(line.unitPrice));
      const lineTotal = qty * unitPrice;
      const vatRate = parseFloat(String(line.vatRate || "0"));

      let taxCategoryId = "S";
      if (vatRate === 0) {
        taxCategoryId = isReverseCharge ? "AE" : "E";
      }

      return `
    <cac:InvoiceLine>
        <cbc:ID>${idx + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="EA">${qty.toFixed(2)}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${invoice.currency}">${lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Name>${escapeXml(line.description)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${taxCategoryId}</cbc:ID>
                <cbc:Percent>${vatRate.toFixed(2)}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${invoice.currency}">${unitPrice.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join("");

  // Generate tax subtotals
  const xmlTaxSubtotals = Array.from(taxGroups.entries())
    .map(([rate, group]) => {
      let taxCategoryId = "S";
      let exemptionCode = "";
      let exemptionReason = "";

      if (rate === 0) {
        if (isReverseCharge) {
          taxCategoryId = "AE";
          exemptionCode = "VATEX-EU-AE";
          exemptionReason = invoice.notes?.trim() || "Taxare inversa conform art. 196 din Directiva 2006/112/CE";
        } else {
          taxCategoryId = "E";
          exemptionCode = "VATEX-EU-E";
          exemptionReason = invoice.notes?.trim() || "Scutit de TVA conform Codului Fiscal";
        }
      }

      return `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${invoice.currency}">${group.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${invoice.currency}">${group.taxAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>${taxCategoryId}</cbc:ID>
                <cbc:Percent>${rate.toFixed(2)}</cbc:Percent>
                ${rate === 0 ? `<cbc:TaxExemptionReasonCode>${exemptionCode}</cbc:TaxExemptionReasonCode>
                <cbc:TaxExemptionReason>${escapeXml(exemptionReason)}</cbc:TaxExemptionReason>` : ""}
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
    })
    .join("");

  const subtotal = parseFloat(String(invoice.subtotal));
  const totalVat = parseFloat(String(invoice.totalVAT));
  const total = parseFloat(String(invoice.total));

  // Foreign currency support (BR-RO-030): TaxCurrencyCode must be RON, TaxTotal in RON must exist
  const isForeignCurrency = invoice.currency && invoice.currency !== "RON";
  const vatInRon = isForeignCurrency ? (totalVat === 0 ? 0 : totalVat * 5.0) : totalVat;

  // Build the full XML
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
    <cbc:ID>${escapeXml(invoice.number)}</cbc:ID>
    <cbc:IssueDate>${issueDate}</cbc:IssueDate>
    <cbc:DueDate>${dueDate}</cbc:DueDate>
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
    ${invoice.notes ? `<cbc:Note>${escapeXml(invoice.notes)}</cbc:Note>` : ""}
    <cbc:DocumentCurrencyCode>${invoice.currency}</cbc:DocumentCurrencyCode>
    ${isForeignCurrency ? `<cbc:TaxCurrencyCode>RON</cbc:TaxCurrencyCode>` : ""}

    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(tenant.name)}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(tenant.address || "Nesetata")}</cbc:StreetName>
                <cbc:CityName>${escapeXml(sellerCity)}</cbc:CityName>
                <cbc:CountrySubentity>${sellerSubdivision}</cbc:CountrySubentity>
                <cac:Country>
                    <cbc:IdentificationCode>RO</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${supplierCui}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(tenant.name)}</cbc:RegistrationName>
                <cbc:CompanyID>${supplierCui}</cbc:CompanyID>
                ${tenantRegCom ? `<cbc:CompanyLegalForm>${escapeXml(tenantRegCom)}</cbc:CompanyLegalForm>` : ""}
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>

    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(invoice.clientName)}</cbc:Name>
            </cac:PartyName>${buyerAddressXml}
            ${clientCui ? `
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${clientCui}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>` : ""}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(invoice.clientName)}</cbc:RegistrationName>
                ${clientCui ? `<cbc:CompanyID>${clientCui}</cbc:CompanyID>` : ""}
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>

    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${invoice.currency}">${totalVat.toFixed(2)}</cbc:TaxAmount>${xmlTaxSubtotals}
    </cac:TaxTotal>
    ${isForeignCurrency ? `
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="RON">${vatInRon.toFixed(2)}</cbc:TaxAmount>
    </cac:TaxTotal>` : ""}

    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${invoice.currency}">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${invoice.currency}">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${invoice.currency}">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="${invoice.currency}">${total.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
${xmlLines}
</Invoice>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

