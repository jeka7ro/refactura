import { describe, expect, it } from "vitest";
import {
  parseFlexibleDateToIso,
  parseFlexibleAmount,
  extractExternalInvoiceMetadata,
  extractBankStatementMetadata,
} from "./uploadRoute";
import { detectBankFromIban } from "./bankStatementsRouter";

describe("External Non-SPV Invoice & Bank Statement Parsers", () => {
  it("normalizes European, US, and English human-readable invoice dates", () => {
    expect(parseFlexibleDateToIso("2026-11-27")).toBe("2026-11-27");
    expect(parseFlexibleDateToIso("27.11.2026")).toBe("2026-11-27");
    expect(parseFlexibleDateToIso("Nov 25, 2026")).toBe("2026-11-25");
    expect(parseFlexibleDateToIso("15 noiembrie 2026")).toBe("2026-11-15");
  });

  it("normalizes European and US decimal/thousand amounts including storno negatives", () => {
    expect(parseFlexibleAmount("1.234,56")).toBe("1234.56");
    expect(parseFlexibleAmount("1,234.56")).toBe("1234.56");
    expect(parseFlexibleAmount("-150,40")).toBe("-150.40");
    expect(parseFlexibleAmount("(89.99)")).toBe("-89.99");
  });

  it("extracts UBL XML external invoice metadata and detects direction vs tenant CUI", async () => {
    const ublXml = `<?xml version="1.0" encoding="UTF-8"?>
      <Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
               xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
        <cbc:ID>GGL-2026-9912</cbc:ID>
        <cbc:IssueDate>2026-11-20</cbc:IssueDate>
        <cbc:DueDate>2026-11-30</cbc:DueDate>
        <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
        <cac:AccountingSupplierParty>
          <cac:Party>
            <cac:PartyTaxScheme><cbc:CompanyID>IE6388047V</cbc:CompanyID></cac:PartyTaxScheme>
            <cac:PartyLegalEntity><cbc:RegistrationName>Google Ireland Limited</cbc:RegistrationName></cac:PartyLegalEntity>
          </cac:Party>
        </cac:AccountingSupplierParty>
        <cac:AccountingCustomerParty>
          <cac:Party>
            <cac:PartyTaxScheme><cbc:CompanyID>RO42322117</cbc:CompanyID></cac:PartyTaxScheme>
            <cac:PartyLegalEntity><cbc:RegistrationName>TRADE INVEST NETWORK SRL</cbc:RegistrationName></cac:PartyLegalEntity>
          </cac:Party>
        </cac:AccountingCustomerParty>
        <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount></cac:TaxTotal>
        <cac:LegalMonetaryTotal>
          <cbc:TaxInclusiveAmount currencyID="EUR">240.50</cbc:TaxInclusiveAmount>
        </cac:LegalMonetaryTotal>
      </Invoice>`;

    const meta = await extractExternalInvoiceMetadata(
      Buffer.from(ublXml, "utf8"),
      "google_ads_nov.xml",
      "RO42322117",
      "TRADE INVEST NETWORK SRL"
    );

    expect(meta.direction).toBe("in");
    expect(meta.invoiceNumber).toBe("GGL-2026-9912");
    expect(meta.supplierName).toBe("Google Ireland Limited");
    expect(meta.supplierCUI).toBe("IE6388047V");
    expect(meta.currency).toBe("EUR");
    expect(meta.total).toBe("240.50");
    expect(meta.totalVAT).toBe("0.00");
    expect(meta.issueDate).toBe("2026-11-20");
  });

  it("extracts global vendor PDF metadata without confusing buyer CUI with supplier VAT ID", async () => {
    const samplePdfLike = Buffer.from(
      "%PDF-1.4\nGoogle Ireland Limited\nVAT ID: IE6388047V\nBill to: TRADE INVEST NETWORK SRL RO42322117\nInvoice number: 5120998123\nInvoice date: Nov 24, 2026\nTotal in EUR €185.00\nVAT (0%): €0.00\n%%EOF",
      "latin1"
    );
    const meta = await extractExternalInvoiceMetadata(
      samplePdfLike,
      "google-invoice-5120998123.pdf",
      "RO42322117",
      "TRADE INVEST NETWORK SRL"
    );

    expect(meta.supplierName).toBe("Google Ireland Limited");
    expect(meta.supplierCUI).toBe("IE6388047V");
    expect(meta.invoiceNumber).toBe("5120998123");
    expect(meta.issueDate).toBe("2026-11-24");
    expect(meta.currency).toBe("EUR");
    expect(meta.total).toBe("185.00");
    expect(meta.totalVAT).toBe("0.00");
  });

  it("detects Romanian and Revolut banks from IBAN and parses MT940 statements accurately", () => {
    expect(detectBankFromIban("RO96BTRL04401202820193XX")).toBe("Banca Transilvania");
    expect(detectBankFromIban("RO49INGB0000999901234567")).toBe("ING Bank");
    expect(detectBankFromIban("RO12BACX0000001234567000")).toBe("UniCredit Bank");

    const mt940 = [
      ":20:STMT202611",
      ":25:RO96BTRLEUR01202820193XX",
      ":28C:00011/001",
      ":60F:C261101EUR1500,00",
      ":61:2611101110D185,00NTRFNONREF",
      ":61:2611201120C500,00NTRFNONREF",
      ":62F:C261130EUR1815,00",
    ].join("\r\n");

    const parsed = extractBankStatementMetadata(Buffer.from(mt940, "utf8"), "BT_EUR_2026_11.sta");
    expect(parsed.bankName).toBe("Banca Transilvania");
    expect(parsed.iban).toBe("RO96BTRLEUR01202820193XX");
    expect(parsed.currency).toBe("EUR");
    expect(parsed.statementMonth).toBe("2026-11");
    expect(parsed.periodStart).toBe("2026-11-01");
    expect(parsed.periodEnd).toBe("2026-11-30");
    expect(parsed.openingBalance).toBe("1500.00");
    expect(parsed.closingBalance).toBe("1815.00");
    expect(parsed.transactionsCount).toBe(2);
  });
});
