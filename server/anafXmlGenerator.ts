import { ReInvoice, ReInvoiceLine, Tenant } from "../drizzle/schema";

/**
 * Generates an ANAF compliant UBL 2.1 e-Factura XML string.
 * Currently supports standard VAT (19%, 9%, 5%) and basic structures.
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

  const supplierCui = (tenant.cui || "").replace(/[^A-Z0-9]/g, "");
  const clientCui = (invoice.clientCUI || "").replace(/[^A-Z0-9]/g, "");

  let tenantSettings: any = {};
  try {
    if (tenant.settings) tenantSettings = JSON.parse(tenant.settings);
  } catch (e) {}

  const tenantCity = tenantSettings.city || "Nesetata";
  const tenantRegCom = tenantSettings.regCom || "";

  // Generate lines
  const xmlLines = lines
    .map((line, idx) => {
      const qty = parseFloat(String(line.quantity));
      const unitPrice = parseFloat(String(line.unitPrice));
      const lineTotal = qty * unitPrice;
      const vatRate = parseFloat(String(line.vatRate || "0"));
      const taxSchemeId = vatRate > 0 ? "S" : "E"; // Standard or Exempt (simplified)

      return `
    <cac:InvoiceLine>
        <cbc:ID>${idx + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="EA">${qty.toFixed(2)}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${invoice.currency}">${lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Name>${escapeXml(line.description)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${taxSchemeId}</cbc:ID>
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
      const taxSchemeId = rate > 0 ? "S" : "E";
      return `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${invoice.currency}">${group.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${invoice.currency}">${group.taxAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>${taxSchemeId}</cbc:ID>
                <cbc:Percent>${rate.toFixed(2)}</cbc:Percent>
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
    <cbc:DocumentCurrencyCode>${invoice.currency}</cbc:DocumentCurrencyCode>

    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(tenant.name)}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(tenant.address || "Nesetata")}</cbc:StreetName>
                <cbc:CityName>${escapeXml(tenantCity)}</cbc:CityName>
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
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXml(invoice.clientAddress || "Nesetata")}</cbc:StreetName>
                <cbc:CityName>${escapeXml(invoice.clientCity || "Nesetata")}</cbc:CityName>
                <cac:Country>
                    <cbc:IdentificationCode>RO</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${clientCui}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(invoice.clientName)}</cbc:RegistrationName>
                <cbc:CompanyID>${clientCui}</cbc:CompanyID>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>

    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${invoice.currency}">${totalVat.toFixed(2)}</cbc:TaxAmount>
${xmlTaxSubtotals}
    </cac:TaxTotal>

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
  return unsafe.replace(/[<>&'"]/g, c => {
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
